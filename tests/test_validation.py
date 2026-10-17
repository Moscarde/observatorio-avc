"""Regressões do contrato público, sem acesso à rede."""

from copy import deepcopy
import hashlib
import json
from pathlib import Path
import shutil
import socket
import tempfile
import unittest
from unittest.mock import patch

from etl.validate import DataValidationError, ROOT, validate_dataset


class ValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = ROOT / "frontend/public/data"

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.data = Path(self.temp.name) / "data"
        shutil.copytree(self.source, self.data)
        self.manifest = json.loads((self.data / "manifest.json").read_text())

    def save_manifest(self):
        (self.data / "manifest.json").write_text(json.dumps(self.manifest))

    def mutate_cube(self, mutate):
        entry = self.manifest["files"][0]
        cube = json.loads((self.data / entry["file"]).read_text())
        mutate(cube)
        content = json.dumps(cube).encode()
        name = f"cube-{entry['year']}-{hashlib.sha256(content).hexdigest()[:12]}.json"
        (self.data / name).write_bytes(content)
        entry["file"] = name
        self.save_manifest()

    def test_real_aggregates_validate_without_network(self):
        with patch.object(socket, "socket", side_effect=AssertionError("rede proibida")):
            result = validate_dataset(self.data)
        self.assertEqual(result.quality["totals"]["n"], 112150)
        self.assertEqual(result.quality["totals"]["deaths"], 23200)
        self.assertEqual(len(result.quality["coverage"]), 72)

    def test_missing_and_corrupt_artifacts_fail(self):
        path = self.data / self.manifest["files"][0]["file"]
        original = path.read_bytes()
        path.write_bytes(original + b" ")
        with self.assertRaisesRegex(DataValidationError, "Hash"):
            validate_dataset(self.data)
        path.unlink()
        with self.assertRaisesRegex(DataValidationError, "ausente"):
            validate_dataset(self.data)

    def test_hash_valid_but_duplicate_grain_fails(self):
        self.mutate_cube(lambda c: c["rows"].append(deepcopy(c["rows"][0])))
        with self.assertRaisesRegex(DataValidationError, "duplicado"):
            validate_dataset(self.data)

    def test_hash_valid_but_invalid_denominator_fails(self):
        def mutate(cube):
            cube["rows"][0][cube["columns"].index("death_n")] = 999

        self.mutate_cube(mutate)
        with self.assertRaisesRegex(DataValidationError, "Denominador"):
            validate_dataset(self.data)

    def test_selection_and_missing_audits_must_reconcile(self):
        self.manifest["quality"]["2020-01"]["missing_age"] += 1
        self.save_manifest()
        with self.assertRaisesRegex(DataValidationError, "ausências"):
            validate_dataset(self.data)

    def test_coverage_cannot_claim_complete(self):
        self.manifest["coverage"].pop()
        self.save_manifest()
        with self.assertRaisesRegex(DataValidationError, "Status"):
            validate_dataset(self.data)

    def test_nonfinite_and_unexpected_columns_fail(self):
        self.mutate_cube(
            lambda c: c["rows"][0].__setitem__(c["columns"].index("days"), float("nan"))
        )
        with self.assertRaisesRegex(DataValidationError, "Medida"):
            validate_dataset(self.data)

    def test_path_traversal_is_rejected(self):
        self.manifest["files"][0]["file"] = "../manifest.json"
        self.save_manifest()
        with self.assertRaisesRegex(DataValidationError, "Nome"):
            validate_dataset(self.data)
