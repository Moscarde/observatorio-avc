"""JSONs anuais compactos, com medidas aditivas para filtros combinados."""

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import tempfile

from etl.transform import AGES, CIDS, DIMS, MEASURES, TYPES, validate


def dump(path, data):
    path.write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":"), allow_nan=False),
        encoding="utf-8",
    )


def export(
    cubes,
    coverage,
    failures,
    provenance,
    audits,
    geo,
    names,
    output,
    start,
    end,
    hospital_names=None,
    hospital_source=None,
):
    output.mkdir(parents=True, exist_ok=True)
    # Conteúdo endereçado por hash: publicar manifest por último mantém leitores consistentes.
    files = []
    for year, cube in sorted(cubes.items()):
        validate(cube)
        payload = {"columns": DIMS + MEASURES, "rows": cube[DIMS + MEASURES].values.tolist()}
        content = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        filename = f"cube-{year}-{hashlib.sha256(content.encode()).hexdigest()[:12]}.json"
        (output / filename).write_text(content, encoding="utf-8")
        files.append({"year": year, "file": filename})
    geo_file = None
    if geo:
        content = json.dumps(geo, ensure_ascii=False, separators=(",", ":"))
        geo_file = f"municipalities-{hashlib.sha256(content.encode()).hexdigest()[:12]}.geojson"
        (output / geo_file).write_text(content, encoding="utf-8")
    manifest = {
        "schema": 1,
        "status": "complete"
        if len(coverage) == (end - start + 1) * 12
        else "partial"
        if coverage
        else "unavailable",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "requested": {"start": start, "end": end},
        "coverage": sorted(coverage),
        "failures": failures,
        "source": "SIH/SUS · DATASUS · AIH reduzida (RD)",
        "state": "RJ",
        "basis": "competência de processamento; IDENT=1",
        "files": files,
        "geography": geo_file,
        "geography_source": "IBGE · geodata-br (CC0), malha histórica sem versão informada",
        "municipalities": names,
        "hospitals": hospital_names or {},
        "hospital_reference": hospital_source,
        "cid_labels": CIDS,
        "types": TYPES,
        "ages": AGES,
        "provenance": provenance,
        "quality": audits,
    }
    with tempfile.NamedTemporaryFile(dir=output, mode="w", encoding="utf-8", delete=False) as temp:
        temp.write(json.dumps(manifest, ensure_ascii=False, separators=(",", ":"), allow_nan=False))
        temporary = Path(temp.name)
    temporary.chmod(0o644)
    temporary.replace(output / "manifest.json")
    return manifest
