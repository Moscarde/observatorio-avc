"""Reconciliação SQL, idempotência e preservação de publicações válidas."""

import json
from pathlib import Path
import socket
import tempfile
import unittest
from unittest.mock import patch

import duckdb

from etl.analytics import build, records, restore
from etl.validate import ROOT


class AnalyticsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.output = Path(cls.temp.name) / "reports"
        cls.data = ROOT / "frontend/public/data"
        with patch.object(socket, "socket", side_effect=AssertionError("rede proibida")):
            cls.baseline_run = build(cls.data, cls.output)
        cls.marts = json.loads((cls.baseline_run / "marts.json").read_text())

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_totals_rates_and_dimensions_reconcile(self):
        total = self.marts["mart_indicadores"][0]
        self.assertEqual(total["n"], 112150)
        self.assertEqual(total["deaths"], 23200)
        self.assertAlmostEqual(total["hospital_mortality_pct"], 23200 / 112150 * 100)
        self.assertEqual(len(self.marts["mart_evolucao_mensal"]), 72)
        self.assertIn("I62", {r["category"] for r in self.marts["mart_perfil_internacoes"]})
        for basis in ("residence", "hospital_city"):
            self.assertEqual(
                sum(
                    r["n"]
                    for r in self.marts["mart_distribuicao_territorial"]
                    if r["basis"] == basis
                ),
                112150,
            )

    def test_repeat_has_same_parquet_content_and_no_duplicate_facts(self):
        run = build(self.data, self.output)
        first = json.loads((self.baseline_run / "run.json").read_text())
        second = json.loads((run / "run.json").read_text())
        self.assertNotEqual(first["id"], second["id"])
        for name in first["output_sha256"]:
            if name.endswith(".parquet"):
                self.assertEqual(first["output_sha256"][name], second["output_sha256"][name])
        with duckdb.connect(str(run / "warehouse.duckdb"), read_only=True) as con:
            self.assertEqual(records(con, "SELECT sum(n) AS n FROM cohort")[0]["n"], 112150)

    def test_combined_filters_apply_to_all_outputs(self):
        run = build(
            self.data,
            self.output,
            {"sex": "Feminino", "cid": "I63", "residence": "330455", "start_period": "2024-01"},
        )
        marts = json.loads((run / "marts.json").read_text())
        count = marts["mart_indicadores"][0]["n"]
        self.assertGreater(count, 0)
        self.assertLess(count, 112150)
        sex = [r["category"] for r in marts["mart_perfil_internacoes"] if r["axis"] == "sex"]
        self.assertEqual(sex, ["Feminino"])
        self.assertEqual(len(marts["mart_evolucao_mensal"]), 24)
        self.assertEqual(sum(r["n"] for r in marts["mart_rede_hospitalar"]), count)

    def test_empty_cohort_uses_null_rates_and_known_zero_counts(self):
        run = build(self.data, self.output, {"residence": "999999"})
        total = json.loads((run / "marts.json").read_text())["mart_indicadores"][0]
        self.assertEqual(total["n"], 0)
        self.assertIsNone(total["hospital_mortality_pct"])
        self.assertIsNone(total["mean_stay_days"])
        self.assertIn("Nenhuma internação neste recorte", (run / "report.html").read_text())

    def test_failure_preserves_latest_and_report(self):
        latest = (self.output / "latest.json").read_bytes()
        report = (self.output / "index.html").read_bytes()
        with patch("etl.analytics.reconcile", side_effect=ValueError("falha controlada")):
            with self.assertRaisesRegex(ValueError, "falha controlada"):
                build(self.data, self.output)
        self.assertEqual((self.output / "latest.json").read_bytes(), latest)
        self.assertEqual((self.output / "index.html").read_bytes(), report)
        failures = list((self.output / "failures").glob("*.json"))
        self.assertTrue(failures)
        self.assertEqual(json.loads(failures[-1].read_text())["status"], "failed")

    def test_report_is_portable_and_inputs_are_not_overwritten(self):
        html = (self.baseline_run / "report.html").read_text()
        self.assertNotIn("<script src=", html)
        self.assertNotIn("<link ", html)
        self.assertIn('lang="pt-BR"', html)
        self.assertIn("Manifest SHA-256", html)
        with self.assertRaisesRegex(ValueError, "separada"):
            build(self.data, self.data)

    def test_restore_checks_hashes_before_changing_publication(self):
        run = json.loads((self.baseline_run / "run.json").read_text())
        restored = restore(self.output, run["id"])
        self.assertEqual(restored, self.baseline_run)
        self.assertEqual(
            (self.output / "index.html").read_bytes(), (restored / "report.html").read_bytes()
        )
        before = (self.output / "latest.json").read_bytes()
        with self.assertRaisesRegex(ValueError, "ID"):
            restore(self.output, "../../invalid")
        self.assertEqual(before, (self.output / "latest.json").read_bytes())
