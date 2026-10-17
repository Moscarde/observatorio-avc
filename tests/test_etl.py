"""Registros sintéticos somente em testes; nunca exportados ao dashboard."""

from importlib.util import find_spec
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace

import pandas as pd

from etl.extract import _extract, geography
from etl.export import export
from etl.transform import age_years, cents, transform, validate


def fixture(**updates):
    return {
        "DIAG_PRINC": "I639",
        "IDENT": "1",
        "N_AIH": "3325000000001",
        "ANO_CMPT": "2025",
        "MES_CMPT": "1",
        "MUNIC_RES": "330455",
        "MUNIC_MOV": "330330",
        "CNES": "0012345",
        "SEXO": "3",
        "COD_IDADE": "4",
        "IDADE": "65",
        "MORTE": "0",
        "DIAS_PERM": "8",
        "VAL_TOT": "1200.15",
        "DT_INTER": "20241228",
        "DT_SAIDA": "20250105",
        **updates,
    }


class PipelineTests(unittest.TestCase):
    def test_cid_and_normal_aih_selection(self):
        records = [
            fixture(DIAG_PRINC=cid, N_AIH=f"33250000000{i:02}")
            for i, cid in enumerate(
                ["I60", "I61.9", "I629", "I63", "I64", "G459", "I699", "I640X", "I65"]
            )
        ]
        records.append(fixture(IDENT="5"))
        cube, _ = transform(pd.DataFrame(records), 2025, 1)
        self.assertEqual(cube.n.sum(), 5)
        self.assertIn("I629", cube.cid.values)
        self.assertIn("I619", cube.cid.values)

    def test_identical_copies_removed_and_conflicts_rejected(self):
        cube, audit = transform(pd.DataFrame([fixture(), fixture()]), 2025, 1)
        self.assertEqual(cube.n.sum(), 1)
        self.assertEqual(audit["duplicate_rows"], 1)
        with self.assertRaisesRegex(ValueError, "conflitante"):
            transform(pd.DataFrame([fixture(), fixture(MORTE="1")]), 2025, 1)

    def test_age_units_and_unknowns(self):
        self.assertAlmostEqual(age_years("1", "24"), 1 / 365.25)
        self.assertAlmostEqual(age_years("2", "365"), 365 / 365.25)
        self.assertEqual(age_years("3", "6"), 0.5)
        self.assertEqual(age_years("5", "3"), 103)
        self.assertIsNone(age_years("0", "65"))
        self.assertIsNone(age_years("4", "150"))
        self.assertEqual(cents("1200,15"), 120015)

    def test_missing_values_do_not_become_valid_zero_observations(self):
        cube, audit = transform(
            pd.DataFrame(
                [
                    fixture(),
                    fixture(N_AIH="3325000000002", MORTE="", IDADE="", DIAS_PERM="-1", VAL_TOT=""),
                ]
            ),
            2025,
            1,
        )
        self.assertEqual(cube.n.sum(), 2)
        for key in ["age_n", "death_n", "days_n", "value_n"]:
            self.assertEqual(cube[key].sum(), 1)
        self.assertEqual(audit["missing_death"], 1)
        self.assertEqual(cube.cents.sum(), 120015)

    def test_competence_schema_dates_and_negative_validation(self):
        with self.assertRaisesRegex(ValueError, "Competência"):
            transform(pd.DataFrame([fixture(MES_CMPT="13")]), 2025, 1)
        with self.assertRaisesRegex(ValueError, "Colunas"):
            transform(pd.DataFrame([{"DIAG_PRINC": "I64"}]), 2025, 1)
        cube, audit = transform(pd.DataFrame([fixture(DT_SAIDA="20240101")]), 2025, 1)
        self.assertEqual(audit["invalid_dates"], 1)
        cube.loc[0, "n"] = -1
        with self.assertRaisesRegex(ValueError, "negativas"):
            validate(cube)

    def test_separate_geographical_dimensions_and_leading_zero_cnes(self):
        cube, _ = transform(pd.DataFrame([fixture()]), 2025, 1)
        self.assertEqual(cube.iloc[0].hospital, "0012345")
        self.assertNotEqual(cube.iloc[0].residence, cube.iloc[0].hospital_city)

    def test_weighted_additive_totals_and_deterministic_payload(self):
        frame = pd.DataFrame(
            [fixture(), fixture(N_AIH="3325000000002", MORTE="1", DIAS_PERM="12", IDADE="75")]
        )
        cube, audit = transform(frame, 2025, 1)
        self.assertEqual(cube.deaths.sum() / cube.death_n.sum() * 100, 50)
        self.assertEqual(cube.days.sum() / cube.days_n.sum(), 10)
        self.assertEqual(cube.age_sum.sum() / cube.age_n.sum(), 70)
        with tempfile.TemporaryDirectory() as folder:
            out = Path(folder)
            a = export(
                {2025: cube}, ["2025-01"], [], [], {"2025-01": audit}, None, {}, out, 2025, 2025
            )
            payload = (out / a["files"][0]["file"]).read_bytes()
            b = export(
                {2025: transform(frame.iloc[::-1], 2025, 1)[0]},
                ["2025-01"],
                [],
                [],
                {},
                None,
                {},
                out,
                2025,
                2025,
            )
            self.assertEqual(a["files"], b["files"])
            self.assertEqual(payload, (out / b["files"][0]["file"]).read_bytes())
            self.assertEqual(a["status"], "partial")
            self.assertNotIn("N_AIH", payload.decode())

    @unittest.skipUnless(find_spec("pysus"), "Instale requirements-extract.txt para testar PySUS")
    def test_cache_avoids_network_and_preserves_checksum(self):
        with tempfile.TemporaryDirectory() as folder:
            cache = Path(folder)
            with patch("pysus.ftp.sih", return_value=pd.DataFrame([fixture()])) as fetch:
                a, info = _extract(2025, 1, cache)
                b, cached = _extract(2025, 1, cache)
                self.assertEqual(fetch.call_count, 1)
                pd.testing.assert_frame_equal(a, b)
                self.assertEqual(info["sha256"], cached["sha256"])
                self.assertEqual(fetch.call_args.kwargs["group"], "RD")

    def test_geography_contains_92_unique_rj_municipalities(self):
        geo, names = geography(Path(".cache/geo"))
        self.assertEqual(len(geo["features"]), 92)
        self.assertEqual(len(names), 92)
        self.assertTrue(all(code.startswith("33") and len(code) == 6 for code in names))
        self.assertEqual(names["330455"], "Rio de Janeiro")

    @unittest.skipUnless(find_spec("pysus"), "Instale requirements-extract.txt para testar PySUS")
    def test_origin_curl_preserves_official_raw_provenance(self):
        with tempfile.TemporaryDirectory() as folder:
            cache = Path(folder)
            raw = cache / "RDRJ2501.dbc"
            raw.write_bytes(b"test fixture, not official data")
            with (
                patch("pyreaddbc.dbc2dbf"),
                patch(
                    "pysus.data.dbf_reader.read_dbf_fast", return_value=pd.DataFrame([fixture()])
                ) as reader,
                patch(
                    "pysus.data.dbf_reader.read_dbf_schema",
                    return_value=SimpleNamespace(num_records=1),
                ),
            ):
                a, info = _extract(2025, 1, cache, "origin-curl")
                b, cached = _extract(2025, 1, cache, "origin-curl")
                self.assertEqual(reader.call_count, 1)
                pd.testing.assert_frame_equal(a, b)
                self.assertEqual(info["raw_sha256"], cached["raw_sha256"])
                self.assertEqual(
                    info["source_url"],
                    "ftp://ftp.datasus.gov.br/dissemin/publicos/SIHSUS/200801_/Dados/RDRJ2501.dbc",
                )


if __name__ == "__main__":
    unittest.main()
