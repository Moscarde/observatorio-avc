"""python etl/main.py --start-year 2020 --end-year 2025"""

import argparse
import json
import logging
from pathlib import Path
import sys

# Permite executar diretamente a CLI a partir de qualquer diretório.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pandas as pd

from etl.extract import extract, geography, hospital_reference
from etl.export import export
from etl.transform import DIMS, MEASURES, transform

ROOT = Path(__file__).resolve().parents[1]


def main(argv=None):
    parser = argparse.ArgumentParser(description="SIH-RD RJ: competências de 2020 a 2025")
    parser.add_argument("--start-year", type=int, default=2020)
    parser.add_argument("--end-year", type=int, default=2025)
    parser.add_argument("--months", type=int, nargs="+", default=list(range(1, 13)))
    parser.add_argument("--cache", type=Path, default=ROOT / ".cache")
    parser.add_argument("--output", type=Path, default=ROOT / "frontend/public/data")
    parser.add_argument(
        "--source",
        choices=["catalog", "origin", "origin-curl"],
        default="catalog",
        help="Catálogo PySUS, FTP PySUS ou FTP curl + leitor PySUS",
    )
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="Reconsulta PySUS; para revisões também limpe seu cache interno",
    )
    parser.add_argument(
        "--allow-partial",
        action="store_true",
        help="Publica cobertura parcial explicitamente identificada",
    )
    parser.add_argument(
        "--hospital-names",
        type=Path,
        help="JSON opcional {CNES: nome} obtido de fonte CNES confiável",
    )
    parser.add_argument(
        "--offline",
        action="store_true",
        help="Usa apenas cache e referências locais; nunca acessa a rede",
    )
    args = parser.parse_args(argv)
    if args.offline and args.refresh:
        parser.error("--offline é incompatível com --refresh")
    if not 2020 <= args.start_year <= args.end_year <= 2025 or not all(
        1 <= month <= 12 for month in args.months
    ):
        parser.error("Use anos de 2020 a 2025 e meses de 1 a 12")
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    coverage, failures, provenance, audits, cubes = [], [], [], {}, {}
    for year in range(args.start_year, args.end_year + 1):
        parts = []
        for month in sorted(set(args.months)):
            period = f"{year}-{month:02}"
            try:
                frame, info = extract(
                    year, month, args.cache / "raw", args.source, args.refresh, offline=args.offline
                )
                cube, audit = transform(frame, year, month)
                parts.append(cube)
                coverage.append(period)
                provenance.append({"period": period, **info})
                audits[period] = audit
                logging.info("%s: %s internações", period, int(cube.n.sum()))
            except Exception as exc:
                logging.error("%s: %s", period, exc)
                failures.append({"period": period, "reason": str(exc)})
        if parts:
            cubes[year] = pd.concat(parts, ignore_index=True).sort_values(DIMS)
        else:
            cubes[year] = pd.DataFrame(columns=DIMS + MEASURES)
    try:
        geo, names = geography(args.cache / "geo", offline=args.offline)
    except Exception as exc:
        logging.error("Malha IBGE: %s", exc)
        geo, names = None, {}
        failures.append({"period": "geography", "reason": str(exc)})
    if failures and not args.allow_partial:
        logging.error(
            "Exportação cancelada; dados publicados preservados. Use --allow-partial para publicar lacunas visíveis."
        )
        return 1
    hospital_source = None
    if args.hospital_names:
        hospital_names = json.loads(args.hospital_names.read_text())
    else:
        try:
            hospital_names, hospital_source = hospital_reference(
                args.cache / "raw", download=args.source == "origin-curl" and not args.offline
            )
        except Exception as exc:
            logging.warning("Nomes hospitalares indisponíveis: %s", exc)
            hospital_names = {}
    result = export(
        cubes,
        coverage,
        failures,
        provenance,
        audits,
        geo,
        names,
        args.output,
        args.start_year,
        args.end_year,
        hospital_names,
        hospital_source,
    )
    logging.info("Exportado: %s, %s competências", result["status"], len(coverage))
    return 0 if result["status"] == "complete" and geo else 1


if __name__ == "__main__":
    sys.exit(main())
