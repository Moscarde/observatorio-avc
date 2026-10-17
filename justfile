# Observatório de AVC — build e deploy como serviço systemd.
# Uso: `just deploy` (serviço de usuário) ou `SERVICE_MODE=system just deploy` (requer sudo).

set dotenv-load

service := env_var_or_default("SERVICE_NAME", "observatorio-avc")
host := env_var_or_default("HOST", "0.0.0.0")
port := env_var_or_default("PORT", "4173")
mode := env_var_or_default("SERVICE_MODE", "user")

root := justfile_directory()
frontend := root / "frontend"
systemctl := if mode == "system" { "sudo systemctl" } else { "systemctl --user" }
journalctl := if mode == "system" { "sudo journalctl -u" } else { "journalctl --user -u" }
unit_dir := if mode == "system" { "/etc/systemd/system" } else { env_var("HOME") / ".config/systemd/user" }
wanted_by := if mode == "system" { "multi-user.target" } else { "default.target" }

default:
    @just --list

# Instala dependências do frontend.
install:
    cd {{frontend}} && npm ci

# Gera o site estático em frontend/dist.
build:
    cd {{frontend}} && npm run build

# Lint e testes do frontend e do ETL (requer .venv com requirements.txt e ruff).
check:
    cd {{frontend}} && npm run lint && npm test
    {{root}}/.venv/bin/python -m unittest discover -s {{root}}/tests
    {{root}}/.venv/bin/ruff check {{root}}/etl {{root}}/tests

# Recoleta os dados do SIH/SUS e regenera frontend/public/data.
etl start="2020" end="2025":
    cd {{root}} && .venv/bin/python etl/main.py --start-year {{start}} --end-year {{end}} --source origin-curl

# Servidor de desenvolvimento.
dev:
    cd {{frontend}} && npm run dev

# Instala dependências, gera o build, instala a unit systemd e (re)inicia o serviço.
deploy: install build install-service restart
    @echo "Servindo em http://{{host}}:{{port}} ({{service}}, modo {{mode}})"

# Escreve a unit systemd que serve frontend/dist.
install-service:
    #!/usr/bin/env bash
    set -euo pipefail
    node="$(command -v node)"
    unit="$(mktemp)"
    {
      echo "[Unit]"
      echo "Description=Observatório de AVC (site estático)"
      echo "After=network.target"
      echo
      echo "[Service]"
      echo "Type=simple"
      echo "WorkingDirectory={{frontend}}"
      if [ "{{mode}}" = "system" ]; then echo "User=$(id -un)"; fi
      echo "Environment=NODE_ENV=production"
      echo "ExecStart=$node {{frontend}}/node_modules/vite/bin/vite.js preview --host {{host}} --port {{port}} --strictPort"
      echo "Restart=on-failure"
      echo "RestartSec=5"
      echo
      echo "[Install]"
      echo "WantedBy={{wanted_by}}"
    } > "$unit"
    if [ "{{mode}}" = "system" ]; then
      sudo install -m 644 "$unit" "{{unit_dir}}/{{service}}.service"
    else
      mkdir -p "{{unit_dir}}"
      install -m 644 "$unit" "{{unit_dir}}/{{service}}.service"
    fi
    rm -f "$unit"
    {{systemctl}} daemon-reload
    {{systemctl}} enable {{service}}.service

# Mantém o serviço de usuário ativo após logout e no boot.
linger:
    sudo loginctl enable-linger "$(id -un)"

restart:
    {{systemctl}} restart {{service}}.service

stop:
    {{systemctl}} stop {{service}}.service

status:
    {{systemctl}} status {{service}}.service --no-pager

logs:
    {{journalctl}} {{service}}.service -f

# Remove o serviço e a unit.
uninstall:
    -{{systemctl}} disable --now {{service}}.service
    {{ if mode == "system" { "sudo rm -f" } else { "rm -f" } }} {{unit_dir}}/{{service}}.service
    {{systemctl}} daemon-reload
