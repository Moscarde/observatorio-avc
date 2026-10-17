# Executar e recuperar

## Ambientes

Requisitos: Python 3.12+ e Node.js 22.18+. `.nvmrc` seleciona Node 22. A instalação das dependências requer rede; a validação e a análise dos agregados existentes não coletam dados.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --require-hashes -r requirements-dev.txt
cd frontend
npm ci
cd ..
```

`requirements.txt` contém a análise; `requirements-dev.txt` inclui Ruff; `requirements-extract.txt` inclui também o transporte PySUS e suas dependências. Para testar tudo, instale este último em vez do arquivo de desenvolvimento. Os locks são gerados a partir de `pyproject.toml`, para Python 3.12+, com `uv pip compile --generate-hashes`, incluindo os extras correspondentes.

## Validar e gerar o relatório

```bash
python -m etl.validate
python -m etl.analytics
python -m etl.analytics --output reports/recorte --sex Feminino --cid I63 --residence 330455 --start-period 2024-01 --end-period 2025-12
```

O primeiro comando gera `.cache/quality.json` e `.cache/quality.md`, com exit code 1 em falha. O segundo publica `reports/index.html` e o ponteiro `reports/latest.json`, preservando as execuções anteriores em `reports/runs/<id>/`.

Abra `reports/index.html` diretamente no navegador. O arquivo contém CSS, SVG e tabelas, sem dependências externas de visualização. O endereço da aplicação de origem não é atualizado por estes comandos.

Filtros disponíveis: `--sex`, `--age`, `--cid`, `--residence`, `--hospital-city`, `--hospital`, `--start-period` e `--end-period`. `--cid` seleciona a categoria de três caracteres, incluindo subcategorias. Todos os marts usam a mesma coorte.

Cada execução completa contém Parquet dos agregados, banco `warehouse.duckdb`, seis marts Parquet, `marts.json`, validação, reconciliação, relatório e `run.json`. Para consultar o banco:

```python
import duckdb
import json
from pathlib import Path

latest = json.loads(Path("reports/latest.json").read_text())
with duckdb.connect(str(Path("reports") / latest["run"] / "warehouse.duckdb"), read_only=True) as con:
    print(con.sql("SELECT * FROM mart_evolucao_anual").fetchall())
```

## Falhas e restauração

Erro de entrada, validação ou reconciliação não publica uma execução nova. O registro da falha fica em `reports/failures/`; a publicação anterior permanece disponível. `latest.json` identifica a execução atual. `run.json` registra hashes e metadados; diretórios em `runs/` preservam o histórico local.

Para restaurar uma execução, utilize o `id` de seu `run.json`:

```bash
python -m etl.analytics --restore ID_DA_EXECUCAO
```

O comando verifica todos os hashes de saída registrados antes de substituir o relatório e o ponteiro. Não apague execuções antigas enquanto precisar delas para recuperação. Para outro diretório de relatórios, inclua `--output caminho`.

## Reprocessar o cache do extrator

Os arquivos brutos e o cache da coleta histórica não estão na referência disponível. O comando abaixo é apenas para um cache **já existente**, não necessário ao painel ou ao relatório:

```bash
python -m etl.main --offline --source origin-curl --start-year 2020 --end-year 2025 --cache /caminho/do/cache --output /caminho/de/saida-separada
```

Falta de cache válido causa erro sem download. `--offline` não combina com `--refresh`. A fonte informada precisa corresponder à proveniência do cache. Execuções, cobertura e falhas são registradas em `<cache>/runs/`.

A rotina herdada sem `--offline` pode acessar o DATASUS e não deve ser executada como parte desta migração. `--allow-partial` autoriza explicitamente publicar lacunas e pode substituir a publicação anterior por dados parciais; não faz parte do fluxo padrão.

## Painel e checks

```bash
python -m unittest discover -s tests -v
ruff check etl tests
ruff format --check etl tests
cd frontend
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm test` também executa o pipeline Python para reconciliar os cálculos SQL/TypeScript. `PYTHON` permite selecionar o executável. O CI executa os mesmos checks com os extras de extração; não agenda coleta nem faz deploy. Sua execução remota depende da publicação do repositório.

`just` é opcional: `just validate`, `just report`, `just check`, `just build`, `just dev` e `just etl-offline` encapsulam os comandos locais.

## Publicação estática

O painel é construído com `cd frontend && npm ci && npm run build`; o conteúdo de `frontend/dist/` pode ser hospedado estaticamente. `npm run preview` é uma prévia local, não um serviço de produção.

O relatório é um HTML independente. A versão online existente é <https://avc.riocode.com.br/>, mantida separadamente. Nenhum repositório remoto, hospedagem paga ou deploy automático é exigido para executar esta versão pessoal.
