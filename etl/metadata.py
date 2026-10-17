"""Metadados de execução sem dependências externas."""

from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def git_metadata():
    def read(*args):
        try:
            result = subprocess.run(
                ["git", "-C", str(ROOT), *args], capture_output=True, text=True, check=False
            )
        except OSError:
            return None
        return result.stdout.strip() if result.returncode == 0 else None

    return {"commit": read("rev-parse", "HEAD"), "dirty": bool(read("status", "--porcelain"))}
