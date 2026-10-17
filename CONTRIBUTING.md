# Contribuir

Use Python 3.12+ e Node.js 22.18+. Instale `requirements-dev.txt` com `pip install --require-hashes -r requirements-dev.txt` e execute `npm ci` em `frontend/`. Para executar também os testes do transporte PySUS, instale `requirements-extract.txt` em vez do arquivo de desenvolvimento.

Antes de enviar uma alteração, execute:

```bash
ruff check etl tests
ruff format --check etl tests
python -m unittest discover -s tests -v
python -m etl.validate
cd frontend
npm run lint
npm test
npm run build
```

`npm test` inclui uma reconciliação SQL/TypeScript e precisa do Python com as dependências analíticas. Ele procura `.venv/bin/python` na raiz; a variável `PYTHON` permite escolher outro executável. Os testes PySUS são explicitamente ignorados quando o extra de extração não está instalado.

Para testes de navegador, instale Chromium com `npx playwright install chromium` e execute `npm run test:e2e`. Instalações precisam de rede; os testes não coletam dados do DATASUS.

Faça commits pequenos no padrão `tipo(escopo opcional): gitmoji descrição imperativa em português`, por exemplo:

- `feat(etl): ✨ Adiciona validação offline`
- `fix(dados): 🐛 Corrige o denominador de permanência`
- `docs: 📝 Explica o grão analítico`
- `ci: 👷 Atualiza a validação contínua`

Não adicione Codex ou Claude como coautores. Preserve créditos existentes. Mudanças em comportamento devem incluir regressões relevantes; não versionar fixtures sintéticas nos dados públicos, arquivos brutos, caches, credenciais ou configurações privadas.

Mudanças de indicadores devem preservar a mesma coorte em todas as visualizações, separar residência de internação, manter I62 identificável e usar denominadores válidos. Nunca interpretar AIHs como pacientes únicos ou valores aprovados como custo econômico integral.
