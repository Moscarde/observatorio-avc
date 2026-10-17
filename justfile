# Comandos locais; nenhum alvo de validação ou análise coleta dados.
root := justfile_directory()
python := root / ".venv/bin/python"
ruff := root / ".venv/bin/ruff"

default:
    @just --list

# Instalação opcional: os mesmos passos podem ser executados sem just.
setup:
    python3 -m venv .venv
    {{python}} -m pip install --require-hashes -r requirements-dev.txt
    cd frontend && npm ci

validate:
    {{python}} -m etl.validate

report *args:
    {{python}} -m etl.analytics {{args}}

check:
    {{ruff}} check etl tests
    {{ruff}} format --check etl tests
    {{python}} -m unittest discover -s tests -v
    cd frontend && npm run lint && npm test && npm run build

build:
    cd frontend && npm run build

dev:
    cd frontend && npm run dev

# Reprocessa exclusivamente o cache local; precisa de arquivos já coletados.
etl-offline start="2020" end="2025":
    {{python}} -m etl.main --start-year {{start}} --end-year {{end}} --source origin-curl --offline
