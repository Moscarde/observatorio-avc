"""Extração mensal PySUS 2.11; cache Parquet e proveniência verificável."""

from datetime import datetime, timezone
from importlib.metadata import version
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path
import time
import zipfile
from urllib.request import urlopen

import pandas as pd

GEO_URL = "https://servicodados.ibge.gov.br/api/v3/malhas/estados/33?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
NAMES_URL = "https://servicodados.ibge.gov.br/api/v1/localidades/estados/33/municipios"
FTP_ROOT = "ftp://ftp.datasus.gov.br/dissemin/publicos/SIHSUS/200801_/Dados/"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_origin_dbc(year, month, cache, refresh=False):
    """Transporte curl opcional; descompressor e leitor usados pelo PySUS 2.11."""
    from pyreaddbc import dbc2dbf
    from pysus.data.dbf_reader import read_dbf_fast, read_dbf_schema

    raw = cache / f"RDRJ{year % 100:02}{month:02}.dbc"
    url = FTP_ROOT + raw.name
    if refresh or not raw.exists():
        temporary = raw.with_suffix(".dbc.download")
        subprocess.run(
            [
                "curl",
                "--fail",
                "--silent",
                "--show-error",
                "--max-time",
                "60",
                "--retry",
                "1",
                url,
                "--output",
                str(temporary),
            ],
            check=True,
            timeout=135,
            capture_output=True,
            text=True,
        )
        temporary.replace(raw)
    dbf = raw.with_suffix(".tmp.dbf")
    try:
        dbc2dbf(str(raw), str(dbf))
        schema = read_dbf_schema(dbf)
        frame = read_dbf_fast(dbf)
        if len(frame) != schema.num_records:
            raise ValueError("Quantidade de registros diverge do cabeçalho DBF")
    finally:
        dbf.unlink(missing_ok=True)
    return frame, {
        "raw_file": raw.name,
        "raw_sha256": digest(raw),
        "source_url": url,
        "transport": "curl / FTP DATASUS",
    }


def hospital_reference(cache, download=False):
    """Nomes oficiais da tabela auxiliar CNES/RJ; sem inferência por código."""
    from etl.transform import clean, code

    archive = cache / "TAB_SIH.zip"
    url = "ftp://ftp.datasus.gov.br/dissemin/publicos/SIHSUS/200801_/Auxiliar/TAB_SIH.zip"
    if not archive.exists():
        if not download:
            return {}, None
        temporary = archive.with_suffix(".zip.download")
        subprocess.run(
            [
                "curl",
                "--fail",
                "--silent",
                "--show-error",
                "--max-time",
                "60",
                "--retry",
                "1",
                url,
                "--output",
                str(temporary),
            ],
            check=True,
            timeout=135,
            capture_output=True,
            text=True,
        )
        temporary.replace(archive)
    from pysus.data.dbf_reader import read_dbf_fast

    table = cache / "TCNESRJ.dbf"
    member = "DBF/TCNESRJ.dbf"
    with zipfile.ZipFile(archive) as zipped:
        reference_date = "-".join(str(n).zfill(2) for n in zipped.getinfo(member).date_time[:3])
        table.write_bytes(zipped.read(member))
    frame = read_dbf_fast(table)
    if not {"CNES", "NOMEFANT"}.issubset(frame.columns):
        raise ValueError("Tabela CNES sem código ou nome oficial")
    names = {}
    for record in frame.to_dict("records"):
        cnes, name = code(record["CNES"], 7), clean(record["NOMEFANT"])
        if cnes == "unknown" or not name:
            continue
        if cnes in names and names[cnes] != name:
            raise ValueError("Nomes conflitantes na tabela CNES")
        names[cnes] = name
    return names, {
        "source_url": url,
        "table": member,
        "reference_date": reference_date,
        "sha256": digest(table),
        "name_count": len(names),
    }


def _extract(year, month, cache, source="catalog", refresh=False, offline=False):
    if offline and refresh:
        raise ValueError("--offline é incompatível com --refresh")
    if not offline:
        cache.mkdir(parents=True, exist_ok=True)
    path = cache / f"RDRJ{year % 100:02}{month:02}.parquet"
    provenance = path.with_suffix(".json")
    if path.exists() and provenance.exists() and not refresh:
        info = json.loads(provenance.read_text())
        raw = cache / info.get("raw_file", "missing.dbc")
        raw_matches = not raw.exists() or info.get("raw_sha256") == digest(raw)
        if info["sha256"] == digest(path) and info["source"] == source and raw_matches:
            return pd.read_parquet(path), info
    if offline:
        raise FileNotFoundError(
            f"Cache ausente, inválido ou de outra fonte: {path.name}; modo offline não acessa a rede"
        )
    os.environ.setdefault("PYSUS_CACHEPATH", str(cache.resolve() / "pysus"))
    import pysus

    error = None
    for attempt in range(3):
        try:
            origin_info = {}
            if source == "origin-curl":
                frame, origin_info = read_origin_dbc(year, month, cache, refresh)
            else:
                frame = pysus.ftp.sih(
                    state="RJ", year=year, month=month, group="RD", source=source, as_dataframe=True
                )
            if not isinstance(frame, pd.DataFrame) or frame.empty:
                raise ValueError("Competência indisponível ou retorno vazio do PySUS")
            temporary = path.with_suffix(".tmp.parquet")
            frame.to_parquet(temporary, index=False)
            temporary.replace(path)
            info = {
                "file": path.name,
                "source": source,
                "sha256": digest(path),
                "rows": len(frame),
                "pysus_version": version("pysus"),
                "downloaded_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "columns": sorted(frame.columns.tolist()),
                **origin_info,
            }
            provenance.write_text(json.dumps(info, ensure_ascii=False), encoding="utf-8")
            return frame, info
        except Exception as exc:
            error = exc
            if attempt < 2:
                time.sleep(2**attempt)
    raise RuntimeError(f"Falha em {year}-{month:02}: {error}") from error


def extract(year, month, cache, source="catalog", refresh=False, offline=False):
    if offline:
        return _extract(year, month, cache, source, refresh, offline=True)
    # Contém falhas nativas DBC e limita a espera por competência.
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "etl.extract",
            str(year),
            str(month),
            str(cache.resolve()),
            source,
            str(int(refresh)),
        ],
        cwd=Path(__file__).resolve().parents[1],
        capture_output=True,
        text=True,
        timeout=180 if source == "origin-curl" else 90,
    )
    if result.returncode:
        raise RuntimeError(result.stderr.strip()[-1500:] or "Extração interrompida")
    return _extract(year, month, cache, source, False)


def geography(cache, offline=False):
    bundled = Path(__file__).resolve().parents[1] / "assets/municipalities.geojson"
    if bundled.exists():
        geo = json.loads(bundled.read_text())
        if len(geo.get("features", [])) != 92:
            raise ValueError("Malha deve conter os 92 municípios")
        names = {f["properties"]["name"]: f["properties"]["label"] for f in geo["features"]}
        return geo, names
    cache.mkdir(parents=True, exist_ok=True)
    paths = [cache / "municipalities.geojson", cache / "municipalities.json"]
    for path, url in zip(paths, [GEO_URL, NAMES_URL]):
        if not path.exists():
            if offline:
                raise FileNotFoundError(f"Referência geográfica ausente: {path.name}")
            with urlopen(url, timeout=45) as response:
                content = response.read()
            parsed = json.loads(content)
            if path.suffix == ".geojson":
                if (
                    parsed.get("type") != "FeatureCollection"
                    or len(parsed.get("features", [])) != 92
                ):
                    raise ValueError("Malha IBGE não contém os 92 municípios do RJ")
            temporary = path.with_suffix(".tmp")
            temporary.write_bytes(content)
            temporary.replace(path)
    geo = json.loads(paths[0].read_text())
    names = {str(item["id"])[:6]: item["nome"] for item in json.loads(paths[1].read_text())}
    for feature in geo["features"]:
        properties = feature["properties"]
        full_code = str(properties.get("codarea", properties.get("CD_MUN", "")))
        if full_code[:6] not in names:
            raise ValueError("Código da malha IBGE não reconhecido")
        feature["properties"] = {
            "name": full_code[:6],
            "label": names[full_code[:6]],
            "ibge": full_code,
        }
    return geo, names


if __name__ == "__main__":
    _extract(
        int(sys.argv[1]), int(sys.argv[2]), Path(sys.argv[3]), sys.argv[4], bool(int(sys.argv[5]))
    )
