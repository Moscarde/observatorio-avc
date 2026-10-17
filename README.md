# Observatório de AVC

Um observatório estático das internações por AVC no Rio de Janeiro. Mapa municipal e série temporal no centro da experiência, filtros combinados, perfil das internações e comparação descritiva da rede hospitalar.

**Versão online:** [avc.riocode.com.br](https://avc.riocode.com.br/).

**Dados reais:** as 72 competências de janeiro de 2020 a dezembro de 2025 foram coletadas diretamente do FTP DATASUS. Foram examinados 4.950.224 registros RD e selecionadas **112.150 internações por AVC** em AIHs normais, com **23.200 óbitos hospitalares**. A malha tem 92 municípios; os 191 estabelecimentos do recorte possuem nomes vinculados à tabela oficial DATASUS/CNES. Não há dados demonstrativos publicados.

**Stack:** Python 3.12+, PySUS 2.11.7, Pandas, Parquet para cache; React, TypeScript, Vite, Tailwind CSS e Apache ECharts. Sem backend ou serviços permanentes.

## Executar

Requisitos: Python 3.12+ e Node.js 22.18+; rede para instalação e coleta.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python etl/main.py --start-year 2020 --end-year 2025 --source origin-curl

cd frontend
npm ci
npm run dev
# Abrir http://127.0.0.1:5180
```

```bash
# Na pasta frontend
npm run build
npm run preview
npm run lint
npm test

# Na raiz, com o ambiente Python ativado
python -m unittest discover -s tests -v
ruff check etl tests
ruff format --check etl tests
```

Teste de navegador opcional: em `frontend`, `npx playwright install chromium` e `npm run test:e2e`. Fixtures sintéticas ficam apenas nos testes. Build, tipagem/lint e 18 verificações de ETL/cálculo/mapa/importação passaram. A instalação limpa do PySUS 2.11.7 foi concluída. Uma conferência independente dos 72 Parquets reconciliou internações, óbitos, dias e centavos com os JSONs; hashes dos arquivos brutos e processados foram verificados. Não há captura de tela; o navegador automatizado permanece limitado pelo sandbox.

## Coleta e publicação

A API atual consultada retorna DataFrame com `pysus.ftp.sih(state="RJ", year=ano, month=mes, group="RD", as_dataframe=True)`. O padrão usa o catálogo espelho do PySUS; `--source origin` consulta o FTP via PySUS. `--source origin-curl` usa curl para baixar os DBCs oficiais e o descompressor/leitor utilizado pelo PySUS para convertê-los. Esse transporte permitiu a coleta neste ambiente e requer curl instalado. Cada competência roda em subprocesso com limite de 90 segundos (180 no transporte curl), tentativas de rede e cache verificado por SHA-256. Use `--months 1 2` para uma coleta pequena.

Falhas cancelam a exportação e preservam os arquivos anteriores. `--allow-partial` permite publicar lacunas explícitas; o comando retorna código 1 se faltar cobertura anual ou geografia. `--refresh` ignora o cache mensal do ETL; para baixar revisões nos modos PySUS também remova `.cache/raw/pysus/`, seu cache interno. No modo `origin-curl`, o DBC é baixado novamente. Arquivos brutos nunca são versionados. Cubos anuais com somas e denominadores alimentam todos os filtros; médias e taxas são recalculadas. O conteúdo dos cubos é determinístico; a data do manifest registra cada exportação.

Nomes são obtidos da tabela `DBF/TCNESRJ.dbf` do arquivo auxiliar oficial `TAB_SIH.zip`. O modo `origin-curl` também coleta essa referência, cuja versão atual tem data de **15/09/2026**. São nomes cadastrais de referência, não uma reconstrução dos nomes históricos entre 2020 e 2025. URL, data e hash estão no manifest. `--hospital-names caminho.json` continua disponível para um mapeamento externo confiável `{ "CNES": "Nome" }`.

Em servidor próprio com systemd e [just](https://just.systems): `just deploy` instala dependências, gera o build e cria o serviço `observatorio-avc` (porta 4173, serviço de usuário; `SERVICE_MODE=system`, `PORT` e `HOST` são configuráveis). `just linger` mantém o serviço de usuário após logout; `just status`, `just logs` e `just uninstall` administram o serviço.

Na Vercel ou Cloudflare Pages: diretório raiz `frontend`, instalação `npm ci`, build `npm run build`, saída `dist`. Os JSONs de `public/data` são incluídos no build. Nenhuma chamada à API, Python ou banco é necessária em produção. Repositório: [riocode7/rc-avc](https://github.com/riocode7/rc-avc).

## Fontes e limites

- [SIH/SUS — DATASUS](https://datasus.saude.gov.br/acesso-a-informacao/producao-hospitalar-sih-sus/) e [notas técnicas](https://tabnet.datasus.gov.br/cgi/sih/midescr.htm).
- [API atual do PySUS](https://pysus.readthedocs.io/en/latest/databases/data-sources.html).
- Imagens locais em `frontend/public/images/`, todas do Wikimedia Commons: fotos do Rio de Janeiro por Wilfredor ([CC0](https://commons.wikimedia.org/wiki/File:Rio_de_Janeiro_coastal_skyline_at_sunset,_Brazil.jpg), [CC0](https://commons.wikimedia.org/wiki/File:Aerial_view_of_Rio_de_Janeiro_and_its_mountains,_Brazil.jpg)) e gravura de Gray's Anatomy, 1918 ([domínio público](https://commons.wikimedia.org/wiki/File:Gray516.png)). Tipografia IBM Plex em `frontend/public/fonts/` (SIL OFL 1.1, licença incluída).
- [geodata-br](https://github.com/tbrugz/geodata-br): malha histórica atribuída ao IBGE, CC0. Os 92 códigos municipais foram validados. A versão da malha não foi informada pelo distribuidor; não representa necessariamente limites territoriais recentes.

Recorte: arquivos RJ, competências de processamento de 2020–2025, AIHs normais (`IDENT=1`) e diagnóstico principal I60–I64. I62 aparece separadamente; G45/AIT e I69/sequelas são excluídos. Prorrogações são excluídas de **todos** os indicadores, inclusive valores. Isso deve ser considerado ao comparar valores com tabulações que incluem AIHs de longa permanência.

AIHs são registros, não pacientes únicos. Transferências, reinternações e reapresentações podem aumentar a contagem. Cópias idênticas da mesma AIH na mesma competência são removidas; conflitos interrompem a competência. Residência e internação são dimensões distintas; internações de residentes do RJ em arquivos de outros estados não integram este universo.

Mortalidade hospitalar usa desfechos conhecidos; permanência, valor médio e idade média usam seus próprios denominadores válidos. Idades em horas, dias, meses e anos são convertidas, incluindo o código de idade acima de 100 anos. Datas inconsistentes são auditadas sem alterar a competência. Campos obrigatórios ausentes interrompem o processamento. Na coleta atual não houve duplicatas, datas inconsistentes ou ausência de desfecho, permanência e valor. Sete idades ausentes/implausíveis foram excluídas da média, mantendo as internações na faixa ignorada. Os totais incluem 379 internações com residência fora do RJ ou ignorada; o mapa RJ não mostra essas residências. Não há incidência populacional, mortalidade populacional, custo integral ou ajuste de gravidade nos rankings. Lacunas não viram zero; o gráfico anual só apresenta anos com todas as competências do recorte disponíveis.

## Organização

`etl/` contém extração, transformação, exportação e CLI. `tests/` verifica o ETL. `frontend/src/` contém componentes, cálculo dos filtros, tipos e carregamento; o painel (`#/`) guia a leitura por seções numeradas e a página `#/metodologia` detalha coleta, seleção, tratamento, indicadores e a auditoria de qualidade lida do manifest; `frontend/tests/` verifica cálculos e navegação. `assets/` guarda a malha de referência. `frontend/vendor/echarts/` inclui o [bundle oficial 6.0.0](https://github.com/apache/echarts/tree/6.0.0/dist), licença Apache-2.0 e NOTICE; foi obtido do repositório Apache devido à restrição de rede npm. O manifest registra cobertura, lacunas, qualidade e proveniência dos arquivos extraídos. Nenhum identificador de AIH é publicado.
