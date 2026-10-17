# Observatório de AVC

Pipeline de dados públicos e painel sobre internações por AVC no Rio de Janeiro. Projeto de portfólio com foco em coleta, tratamento, qualidade de dados e comunicação de indicadores.

**Versão online:** [avc.riocode.com.br](https://avc.riocode.com.br/).

Desenvolvido inicialmente na RioCode e portado com autorização para uma versão pessoal. A evolução planejada prioriza Python e SQL, execução local e ausência de serviços pagos obrigatórios.

## Estado atual

O ETL em Python extrai arquivos SIH-RD do DATASUS, valida os registros e gera agregados consumidos por um painel React/TypeScript. O manifest herdado registra 72 competências, de janeiro de 2020 a dezembro de 2025: **112.150 internações** e **23.200 óbitos hospitalares**. Esses dados foram reaproveitados; a migração não realizou nova coleta.

O código já inclui cache Parquet, proveniência com hashes, testes e medidas aditivas para recalcular taxas e médias sob filtros. A camada SQL e a automação em CI estão no [planejamento](docs/planejamento.md); ainda não estão implementadas.

## Executar o painel

Requisito: Node.js 22.18+ e acesso à rede para instalar dependências.

```bash
cd frontend
npm ci
npm run dev
```

Abra `http://127.0.0.1:5180`. Os agregados já estão em `frontend/public/data/`; executar o painel não exige Python, banco de dados ou nova coleta.

## Validar o código

Python 3.12+:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m unittest discover -s tests -v
ruff check etl tests
ruff format --check etl tests
```

Na pasta `frontend/`:

```bash
npm run lint
npm test
npm run build
```

Teste opcional de navegador: `npx playwright install chromium` e `npm run test:e2e`. A instalação de dependências e do navegador requer rede. A documentação lista os comandos, sem afirmar que foram executados nesta migração.

## Organização

| Diretório | Responsabilidade |
|---|---|
| `etl/` | Extração, transformação, exportação e CLI |
| `tests/` | Testes Python com fixtures sintéticas |
| `frontend/src/` | Painel, filtros e cálculos dos indicadores |
| `frontend/tests/` | Testes de cálculos, mapa e navegador |
| `frontend/public/data/` | Agregados públicos e manifest de proveniência |
| `assets/` | Referência geográfica |
| `docs/` | Planejamento, metodologia e operação |

## Dados e interpretação

Fonte: SIH/SUS — DATASUS, arquivos RJ, por competência de processamento. O recorte inclui AIHs normais (`IDENT=1`) e diagnóstico principal I60–I64, mantendo I62 identificável; exclui G45, I69 e prorrogações.

AIHs são registros de internação, não pacientes únicos. A mortalidade é hospitalar; valores de AIH não representam custo econômico integral. Residência e internação são dimensões distintas. Nenhum identificador de AIH é publicado nos agregados.

Consulte [metodologia, fontes e limites](docs/metodologia.md), [operação do ETL e publicação](docs/operacao.md) e o [plano de evolução](docs/planejamento.md).

## Licenciamento

A licença do código próprio será definida antes da publicação open source. As licenças e atribuições de terceiros devem ser preservadas: Apache ECharts em `frontend/vendor/echarts/`, IBM Plex em `frontend/public/fonts/OFL.txt` e demais ativos descritos na metodologia. A futura licença do código não substitui as condições de reutilização das fontes e dos ativos.
