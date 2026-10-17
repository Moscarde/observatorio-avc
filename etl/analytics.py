"""Pipeline local: agregados validados → Parquet → SQL → relatório HTML."""

import argparse
from datetime import datetime, timezone
from importlib.metadata import version
import math
from pathlib import Path
import subprocess
import tempfile
import time
import uuid

import duckdb
import pandas as pd

from etl.validate import (
    CONTRACT,
    DIMS,
    MEASURES,
    ROOT,
    atomic_json,
    digest,
    require,
    validate_dataset,
)

MARTS = [
    "mart_indicadores",
    "mart_evolucao_mensal",
    "mart_distribuicao_territorial",
    "mart_perfil_internacoes",
    "mart_rede_hospitalar",
    "mart_evolucao_anual",
]


def records(connection, query, params=None):
    cursor = connection.execute(query, params or [])
    columns = [d[0] for d in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def select_cohort(rows, filters):
    return [
        r
        for r in rows
        if all(
            value is None
            or (
                r[key][:3] == value
                if key == "cid"
                else r["period"] >= value
                if key == "start_period"
                else r["period"] <= value
                if key == "end_period"
                else r[key] == value
            )
            for key, value in filters.items()
        )
    ]


def apply_filters(connection, filters):
    clauses, values = [], []
    for key, value in filters.items():
        if value is None:
            continue
        if key == "cid":
            clause = "substr(cid, 1, 3) = ?"
        elif key in ("start_period", "end_period"):
            clause = "period >= ?" if key == "start_period" else "period <= ?"
        else:
            require(key in DIMS, "Dimensão de filtro inválida")
            clause = f'"{key}" = ?'
        clauses.append(clause)
        values.append(value)
    connection.execute(
        "CREATE TABLE cohort AS SELECT * FROM stg_internacoes_agregadas WHERE "
        + (" AND ".join(clauses) or "true"),
        values,
    )


def reconcile(connection, source_rows):
    expected = {m: math.fsum(r[m] for r in source_rows) for m in MEASURES}
    slices = [
        ("mart_indicadores", "true"),
        ("mart_evolucao_mensal", "true"),
        ("mart_rede_hospitalar", "true"),
        ("mart_evolucao_anual", "true"),
        *(
            ("mart_distribuicao_territorial", f"basis = '{basis}'")
            for basis in ("residence", "hospital_city")
        ),
        *(("mart_perfil_internacoes", f"axis = '{axis}'") for axis in ("sex", "age", "cid")),
    ]
    for table, clause in slices:
        result = records(
            connection,
            "SELECT "
            + ", ".join(f"coalesce(sum({m}), 0) AS {m}" for m in MEASURES)
            + f" FROM {table} WHERE {clause}",
        )[0]
        for measure in MEASURES:
            tolerance = CONTRACT["age_sum_absolute_tolerance"] if measure == "age_sum" else 0
            require(
                math.isclose(
                    float(result[measure]), expected[measure], rel_tol=0, abs_tol=tolerance
                ),
                f"Reconciliação SQL diverge: {table}/{measure}",
            )
    return {
        "status": "passed",
        "groups_checked": len(slices),
        "totals": expected,
        "age_sum_absolute_tolerance": CONTRACT["age_sum_absolute_tolerance"],
    }


def git_metadata():
    def read(*args):
        result = subprocess.run(
            ["git", "-C", str(ROOT), *args], capture_output=True, text=True, check=False
        )
        return result.stdout.strip() if result.returncode == 0 else None

    return {"commit": read("rev-parse", "HEAD"), "dirty": bool(read("status", "--porcelain"))}


def build(data, output, filters=None):
    from etl.report import render_report

    filters = filters or {}
    start = time.monotonic()
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:8]
    output = Path(output).resolve()
    data = Path(data).resolve()
    require(
        output != data and data not in output.parents and output not in data.parents,
        "Saída analítica deve ser separada dos dados publicados",
    )
    output.mkdir(parents=True, exist_ok=True)
    runs = output / "runs"
    runs.mkdir(exist_ok=True)
    try:
        dataset = validate_dataset(data)
        source_rows = select_cohort(dataset.rows, filters)
        with tempfile.TemporaryDirectory(prefix=".building-", dir=runs) as temporary:
            stage = Path(temporary)
            database = stage / "warehouse.duckdb"
            with duckdb.connect(
                str(database),
                config={
                    "threads": "1",
                    "autoinstall_known_extensions": "false",
                    "autoload_known_extensions": "false",
                },
            ) as con:
                frame = pd.DataFrame(dataset.rows, columns=DIMS + MEASURES)
                for name in CONTRACT["integers"]:
                    frame[name] = frame[name].astype("int64")
                con.register("input_frame", frame)
                order = ", ".join(DIMS)
                con.execute(
                    f"COPY (SELECT * FROM input_frame ORDER BY {order}) TO ? "
                    "(FORMAT PARQUET, COMPRESSION ZSTD)",
                    [str(stage / "aggregates.parquet")],
                )
                con.unregister("input_frame")
                con.execute(
                    "CREATE TABLE stg_internacoes_agregadas AS SELECT * FROM read_parquet(?)",
                    [str(stage / "aggregates.parquet")],
                )
                con.execute("CREATE TABLE coverage (period VARCHAR PRIMARY KEY)")
                covered = [
                    p
                    for p in dataset.manifest["coverage"]
                    if (not filters.get("start_period") or p >= filters["start_period"])
                    and (not filters.get("end_period") or p <= filters["end_period"])
                ]
                if covered:
                    con.executemany("INSERT INTO coverage VALUES (?)", [(p,) for p in covered])
                apply_filters(con, filters)
                for path in sorted((ROOT / "sql").glob("*.sql")):
                    con.execute(path.read_text())
                reconciliation = reconcile(con, source_rows)
                marts = {name: records(con, f"SELECT * FROM {name}") for name in MARTS}
                for name in MARTS:
                    con.execute(
                        f"COPY {name} TO ? (FORMAT PARQUET, COMPRESSION ZSTD)",
                        [str(stage / f"{name}.parquet")],
                    )
                con.execute("CHECKPOINT")
            atomic_json(stage / "quality.json", dataset.quality)
            atomic_json(stage / "reconciliation.json", reconciliation)
            atomic_json(stage / "marts.json", marts)
            inputs = dataset.quality["files_sha256"]
            implementation = {
                str(p.relative_to(ROOT)): digest(p)
                for p in [
                    *sorted((ROOT / "sql").glob("*.sql")),
                    ROOT / "contracts/cube-v1.json",
                    ROOT / "etl/analytics.py",
                    ROOT / "etl/report.py",
                    ROOT / "etl/validate.py",
                    ROOT / "templates/report.html",
                ]
            }
            run = {
                "id": run_id,
                "status": "complete",
                "git": git_metadata(),
                "filters": filters,
                "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "duration_seconds": round(time.monotonic() - start, 3),
                "input_sha256": inputs,
                "implementation_sha256": implementation,
                "versions": {p: version(p) for p in ("duckdb", "pandas", "pyarrow")},
                "aggregate_rows": len(dataset.rows),
                "cohort_rows": len(source_rows),
                "coverage": covered,
                "evidence": dataset.quality["evidence"],
            }
            html = render_report(dataset.manifest, marts, run, reconciliation)
            (stage / "report.html").write_text(html, encoding="utf-8")
            run["output_sha256"] = {
                p.name: digest(p) for p in sorted(stage.iterdir()) if p.is_file()
            }
            atomic_json(stage / "run.json", run)
            destination = runs / run_id
            stage.rename(destination)
        # Só publica ponteiros depois de todos os artefatos e reconciliações estarem prontos.
        with tempfile.NamedTemporaryFile(dir=output, delete=False) as f:
            index = Path(f.name)
            f.write((destination / "report.html").read_bytes())
        index.replace(output / "index.html")
        atomic_json(
            output / "latest.json",
            {"run": f"runs/{run_id}", "id": run_id, "report": f"runs/{run_id}/report.html"},
        )
        return destination
    except Exception as exc:
        atomic_json(
            output / "failures" / f"{run_id}.json",
            {
                "id": run_id,
                "status": "failed",
                "error": str(exc),
                "git": git_metadata(),
                "duration_seconds": round(time.monotonic() - start, 3),
            },
        )
        raise


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=ROOT / "frontend/public/data")
    parser.add_argument("--output", type=Path, default=ROOT / "reports")
    parser.add_argument("--sex", choices=CONTRACT["sex"])
    parser.add_argument("--age", choices=CONTRACT["age"])
    parser.add_argument("--cid", choices=["I60", "I61", "I62", "I63", "I64"])
    parser.add_argument("--residence")
    parser.add_argument("--hospital-city")
    parser.add_argument("--hospital")
    parser.add_argument("--start-period")
    parser.add_argument("--end-period")
    args = parser.parse_args(argv)
    filters = {k: v for k, v in vars(args).items() if k not in ("data", "output") and v is not None}
    import re

    for key in ("start_period", "end_period"):
        if filters.get(key) and not re.fullmatch(r"20\d{2}-(0[1-9]|1[0-2])", filters[key]):
            parser.error("Use competência no formato AAAA-MM")
    if args.start_period and args.end_period and args.start_period > args.end_period:
        parser.error("Competência inicial posterior à final")
    try:
        destination = build(args.data, args.output, filters)
    except (ValueError, OSError, duckdb.Error) as exc:
        print(f"Pipeline interrompido; publicação anterior preservada: {exc}")
        return 1
    print(f"Relatório: {destination / 'report.html'}")
    print(f"Banco SQL: {destination / 'warehouse.duckdb'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
