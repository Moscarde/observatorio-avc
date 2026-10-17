"""Validação offline dos agregados publicados; utiliza apenas a biblioteca padrão."""

import argparse
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import re
import tempfile

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = json.loads((ROOT / "contracts/cube-v1.json").read_text())
DIMS = CONTRACT["dimensions"]
MEASURES = CONTRACT["measures"]


class DataValidationError(ValueError):
    """Entrada incompatível com o contrato público de dados."""


@dataclass
class Dataset:
    manifest: dict
    rows: list[dict]
    quality: dict


def require(condition, message):
    if not condition:
        raise DataValidationError(message)


def read_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise DataValidationError(f"Não foi possível ler {path.name}: {exc}") from exc


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def atomic_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        dir=path.parent, mode="w", encoding="utf-8", delete=False
    ) as f:
        temporary = Path(f.name)
        try:
            json.dump(data, f, ensure_ascii=False, indent=2, allow_nan=False)
            f.write("\n")
        except Exception:
            temporary.unlink(missing_ok=True)
            raise
    temporary.replace(path)


def artifact(root, name, pattern):
    require(isinstance(name, str) and re.fullmatch(pattern, name), "Nome de artefato inválido")
    path = root / name
    require(path.is_file() and path.resolve().parent == root.resolve(), f"Arquivo ausente: {name}")
    checksum = digest(path)
    require(checksum[:12] in name, f"Hash divergente: {name}")
    return path, checksum


def validate_dataset(directory, *, allow_partial=False):
    root = Path(directory)
    manifest = read_json(root / "manifest.json")
    require(isinstance(manifest, dict), "Manifest deve ser objeto")
    require(manifest.get("schema") == CONTRACT["schema"], "Schema incompatível")
    require(manifest.get("state") == CONTRACT["state"], "Estado incompatível com o contrato RJ")
    requested = manifest.get("requested", {})
    start, end = requested.get("start"), requested.get("end")
    require(
        type(start) is int and type(end) is int and 2000 <= start <= end <= 2099,
        "Período solicitado inválido",
    )
    expected = {f"{year}-{month:02}" for year in range(start, end + 1) for month in range(1, 13)}
    coverage = manifest.get("coverage")
    require(
        isinstance(coverage, list) and all(isinstance(p, str) for p in coverage),
        "Cobertura inválida",
    )
    require(
        len(set(coverage)) == len(coverage) and set(coverage) <= expected,
        "Competência duplicada ou fora do período",
    )
    status = "complete" if set(coverage) == expected else "partial" if coverage else "unavailable"
    require(manifest.get("status") == status, "Status diverge da cobertura")
    require(allow_partial or status == "complete", "Cobertura incompleta; publicação bloqueada")
    failures = manifest.get("failures")
    require(isinstance(failures, list), "Lista de falhas ausente")
    require(status != "complete" or not failures, "Cobertura completa com falhas declaradas")
    provenance = manifest.get("provenance", [])
    require(
        isinstance(provenance, list) and all(isinstance(p, dict) for p in provenance),
        "Proveniência inválida",
    )
    periods = [p.get("period") for p in provenance]
    require(
        len(periods) == len(set(periods)) and set(periods) == set(coverage),
        "Proveniência não corresponde à cobertura",
    )
    for info in provenance:
        require(
            all(
                isinstance(info.get(k), str) and re.fullmatch(r"[a-f0-9]{64}", info[k])
                for k in ("sha256", "raw_sha256")
            ),
            "Hashes de proveniência ausentes/inválidos",
        )
        require(isinstance(info.get("source_url"), str), "URL de origem ausente")
    audits = manifest.get("quality")
    require(
        isinstance(audits, dict) and set(audits) == set(coverage),
        "Auditorias não correspondem à cobertura",
    )
    files = manifest.get("files")
    require(isinstance(files, list), "Lista de cubos inválida")
    rows, hashes, seen, years = [], {}, set(), set()
    by_period = {p: defaultdict(float) for p in coverage}
    for entry in files:
        year = entry.get("year")
        require(
            type(year) is int and start <= year <= end and year not in years,
            "Ano de cubo inválido ou duplicado",
        )
        years.add(year)
        path, checksum = artifact(root, entry.get("file"), rf"cube-{year}-[a-f0-9]{{12}}\.json")
        hashes[path.name] = checksum
        cube = read_json(path)
        require(cube.get("columns") == DIMS + MEASURES, f"Colunas incompatíveis: {path.name}")
        require(isinstance(cube.get("rows"), list), "Linhas do cubo inválidas")
        for values in cube["rows"]:
            require(
                isinstance(values, list) and len(values) == len(DIMS + MEASURES),
                "Quantidade de colunas inválida",
            )
            row = dict(zip(DIMS + MEASURES, values))
            require(all(isinstance(row[d], str) for d in DIMS), "Dimensões devem ser texto")
            key = tuple(row[d] for d in DIMS)
            require(key not in seen, "Grão duplicado no cubo")
            seen.add(key)
            period = row["period"]
            require(
                period in by_period and period.startswith(f"{year}-"),
                "Competência fora da cobertura ou do cubo anual",
            )
            require(re.fullmatch(CONTRACT["cid_pattern"], row["cid"]), "CID fora do recorte")
            for name, size in (("residence", 6), ("hospital_city", 6), ("hospital", 7)):
                value = row[name]
                require(
                    value == "unknown"
                    or (re.fullmatch(rf"\d{{{size}}}", value) and set(value) != {"0"}),
                    f"Código inválido: {name}",
                )
            require(
                row["sex"] in CONTRACT["sex"] and row["age"] in CONTRACT["age"],
                "Sexo ou faixa etária inválidos",
            )
            for name in MEASURES:
                value = row[name]
                require(
                    type(value) in (int, float) and math.isfinite(value) and value >= 0,
                    f"Medida inválida: {name}",
                )
                if name in CONTRACT["integers"]:
                    require(value == int(value), f"Medida deve ser inteira: {name}")
                by_period[period][name] += value
            require(row["n"] > 0, "Linha agregada sem internações")
            require(row["deaths"] <= row["death_n"] <= row["n"], "Denominador de óbito inválido")
            for total, denominator in (
                ("days", "days_n"),
                ("cents", "value_n"),
                ("age_sum", "age_n"),
            ):
                require(row[denominator] <= row["n"], f"Denominador inválido: {denominator}")
                require(
                    row[denominator] > 0 or row[total] == 0, f"Soma sem denominador válido: {total}"
                )
            require(row["age_sum"] <= 120 * row["age_n"] + 1e-5, "Soma de idades inválida")
            rows.append(row)
    require({int(p[:4]) for p in coverage} <= years, "Cubo anual ausente")
    for period, audit in audits.items():
        require(isinstance(audit, dict), f"Auditoria inválida: {period}")
        for name in (
            "source_rows",
            "stroke_normal_rows",
            "duplicate_rows",
            "invalid_dates",
            "missing_age",
            "missing_death",
            "missing_days",
            "missing_value",
        ):
            require(
                type(audit.get(name)) is int and audit[name] >= 0,
                f"Contador de auditoria inválido: {name}",
            )
        counts = by_period[period]
        require(
            audit["source_rows"] >= audit["stroke_normal_rows"] >= audit["duplicate_rows"],
            "Contagens de seleção inválidas",
        )
        require(
            counts["n"] == audit["stroke_normal_rows"] - audit["duplicate_rows"],
            f"Reconciliação da seleção diverge: {period}",
        )
        require(audit["invalid_dates"] <= counts["n"], "Contagem de datas inválida")
        for missing, denominator in (
            ("age", "age_n"),
            ("death", "death_n"),
            ("days", "days_n"),
            ("value", "value_n"),
        ):
            require(
                audit[f"missing_{missing}"] == counts["n"] - counts[denominator],
                f"Reconciliação de ausências diverge: {period}/{missing}",
            )
    geo_path, checksum = artifact(
        root, manifest.get("geography"), r"municipalities-[a-f0-9]{12}\.geojson"
    )
    hashes[geo_path.name] = checksum
    geo = read_json(geo_path)
    require(geo.get("type") == "FeatureCollection", "Tipo de geografia inválido")
    features = geo.get("features", [])
    codes = [f.get("properties", {}).get("name") for f in features]
    names = manifest.get("municipalities", {})
    require(
        len(codes) == CONTRACT["municipalities"]
        and len(set(codes)) == len(codes)
        and set(codes) == set(names),
        "Referências municipais inconsistentes",
    )
    require(all(re.fullmatch(r"33\d{4}", c) for c in codes), "Município fora do RJ")
    require(
        all(f["properties"].get("label") == names[f["properties"]["name"]] for f in features),
        "Nomes municipais divergentes",
    )
    quality = {
        "status": "passed",
        "dataset_status": status,
        "schema": CONTRACT["schema"],
        "checked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "coverage": sorted(coverage),
        "aggregate_rows": len(rows),
        "totals": {m: math.fsum(r[m] for r in rows) for m in MEASURES},
        "source_rows_declared": sum(a["source_rows"] for a in audits.values()),
        "files_sha256": {"manifest.json": digest(root / "manifest.json"), **hashes},
        "evidence": "Agregados reconciliados com auditorias herdadas; brutos não revalidados.",
        "checks": [
            "schema",
            "coverage",
            "hashes",
            "grain",
            "domains",
            "measures",
            "denominators",
            "selection_audits",
            "missing_audits",
            "geography",
        ],
    }
    return Dataset(manifest, rows, quality)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=ROOT / "frontend/public/data")
    parser.add_argument("--output", type=Path, default=ROOT / ".cache/quality.json")
    parser.add_argument("--allow-partial", action="store_true")
    args = parser.parse_args(argv)
    try:
        dataset = validate_dataset(args.data, allow_partial=args.allow_partial)
        result = dataset.quality
    except (DataValidationError, KeyError, TypeError, AttributeError) as exc:
        result = {"status": "failed", "error": str(exc)}
    atomic_json(args.output, result)
    text = f"Validação: {result['status']}\n\n" + (
        f"Competências: {len(result['coverage'])}\n\n"
        f"Internações: {result['totals']['n']:.0f}\n\n"
        f"Óbitos hospitalares: {result['totals']['deaths']:.0f}\n\n{result['evidence']}\n"
        if result["status"] == "passed"
        else result["error"] + "\n"
    )
    args.output.with_suffix(".md").write_text(text, encoding="utf-8")
    print(text)
    return 0 if result["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
