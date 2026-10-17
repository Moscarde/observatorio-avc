# Repository Guidelines

## Structure

`etl/`: Python SIH-RD extraction, transformation, export and CLI. `tests/`: Python unit tests. `frontend/src/`: React components, hooks, analytics and types. `frontend/tests/`: calculation and browser tests. `assets/`: public geographic reference. `frontend/public/data/`: generated static aggregates only. `frontend/vendor/echarts/`: official Apache ECharts bundle with license and NOTICE.

Do not place application code in `.agents/`, `.codex/`, `.aws/` or `.git/`. Raw downloads belong in ignored `.cache/`. Keep README concise and accurate about data coverage and validation.

## Commands

Python 3.12+: `python3 -m venv .venv`, activate, `pip install -r requirements.txt`. Extract: `python etl/main.py --start-year 2020 --end-year 2025 --source origin-curl` (curl transport, PySUS reader; optional catalog/origin modes remain available). Tests: `python -m unittest discover -s tests -v`. Lint/format: `ruff check etl tests`, `ruff format --check etl tests`.

Node 22.18+, from `frontend/`: `npm ci`, `npm run dev`, `npm run build`, `npm run preview`, `npm run lint`, `npm test`. Optional browser checks: `npx playwright install chromium`, `npm run test:e2e`.

## Style and tests

Python uses Ruff, React/TypeScript uses strict TypeScript and Prettier (`npm run format`). Use clear names and comments only when useful. Add regression tests for behavior changes. Synthetic fixtures belong only in tests, never in published datasets. All dashboard components must use the same filtered cohort; aggregate additive measures and valid denominators instead of summing rates or averages.

## Data and security

Preserve distinct residence and hospitalization municipalities. Keep I62 identifiable. Exclude G45, I69 and AIH extensions from main indicators. Never label AIHs as unique patients, hospital mortality as population mortality, or AIH values as full economic cost. Do not fabricate coverage or silently replace missing data. Validate official field layouts during real extraction. Never commit credentials, tokens or private configuration.

## Commits and PRs

Use concise imperative subjects. Keep changes focused; describe purpose and validation, identify checks that could not run, and include screenshots when browser access permits them. The initial environment has no usable Git repository and its `.git/` directory is read-only.
