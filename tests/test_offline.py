"""O caminho offline deve falhar fechado, sem iniciar downloads."""

import json
from pathlib import Path
import socket
import tempfile
import unittest
from unittest.mock import patch

import pandas as pd

from etl.extract import digest, extract, hospital_reference
from etl.main import main
from test_etl import fixture


class OfflineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.cache = Path(self.temp.name) / "cache"
        self.cache.mkdir()

    def create_cache(self):
        path = self.cache / "RDRJ2501.parquet"
        pd.DataFrame([fixture()]).to_parquet(path, index=False)
        info = {"sha256": digest(path), "source": "origin-curl", "file": path.name}
        path.with_suffix(".json").write_text(json.dumps(info))
        return path

    def test_valid_cache_works_with_no_subprocess_or_socket(self):
        self.create_cache()
        with (
            patch("etl.extract.subprocess.run", side_effect=AssertionError("subprocesso proibido")),
            patch.object(socket, "socket", side_effect=AssertionError("rede proibida")),
        ):
            frame, info = extract(2025, 1, self.cache, "origin-curl", offline=True)
        self.assertEqual(len(frame), 1)
        self.assertEqual(info["source"], "origin-curl")

    def test_missing_corrupt_and_wrong_source_never_download(self):
        with patch("etl.extract.read_origin_dbc", side_effect=AssertionError("download proibido")):
            with self.assertRaisesRegex(FileNotFoundError, "offline"):
                extract(2025, 1, self.cache, "origin-curl", offline=True)
            path = self.create_cache()
            path.write_bytes(b"cache corrompido")
            with self.assertRaisesRegex(FileNotFoundError, "offline"):
                extract(2025, 1, self.cache, "origin-curl", offline=True)
            self.create_cache()
            with self.assertRaisesRegex(FileNotFoundError, "outra fonte"):
                extract(2025, 1, self.cache, "catalog", offline=True)

    def test_refresh_and_offline_are_incompatible(self):
        with self.assertRaisesRegex(ValueError, "incompatível"):
            extract(2025, 1, self.cache, refresh=True, offline=True)

    def test_failed_offline_run_preserves_published_directory(self):
        output = Path(self.temp.name) / "published"
        output.mkdir()
        manifest = output / "manifest.json"
        manifest.write_text('{"previous": true}')
        with patch.object(socket, "socket", side_effect=AssertionError("rede proibida")):
            result = main(
                [
                    "--start-year",
                    "2025",
                    "--end-year",
                    "2025",
                    "--months",
                    "1",
                    "--cache",
                    str(self.cache),
                    "--output",
                    str(output),
                    "--offline",
                ]
            )
        self.assertEqual(result, 1)
        self.assertEqual(manifest.read_text(), '{"previous": true}')
        self.assertEqual(len(list(output.iterdir())), 1)

    def test_hospital_reference_does_not_download_by_default(self):
        with patch("etl.extract.subprocess.run", side_effect=AssertionError("download proibido")):
            self.assertEqual(hospital_reference(self.cache, download=False), ({}, None))
