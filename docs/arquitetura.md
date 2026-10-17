# Arquitetura e decisões

## Caminho implementado com os dados disponíveis

```text
frontend/public/data/ — cubos JSON, manifest e geografia
              ↓ etl.validate (biblioteca padrão; sem rede)
contrato v1 + hashes + auditorias + cobertura
              ↓ etl.analytics
aggregates.parquet → stg_internacoes_agregadas → cohort
              ↓ sql/*.sql (DuckDB)
6 marts → reconciliação Python/SQL → relatório HTML
              ↓ execução completa
reports/runs/<id>/ + reports/index.html + latest.json
```

O painel React continua lendo os JSONs publicados. Seu cálculo TypeScript é reconciliado com o SQL em três recortes reais nos testes. Um erro na camada analítica não sobrescreve os cubos do painel.

Cada execução analítica registra os hashes das entradas e da implementação, commit, alterações locais, versões de DuckDB/Pandas/PyArrow, filtros, duração e hashes das saídas. Relatórios e bancos ficam ignorados pelo Git. A página HTML incorpora CSS e SVG, sem CDN, JavaScript ou arquivos laterais necessários à leitura.

## Caminho de extração

`etl.extract` obtém DBCs oficiais, converte para DataFrame e mantém cache Parquet com proveniência. `etl.transform` seleciona e trata os registros, audita problemas e agrega as dimensões. `etl.export` publica cubos com nome derivado de hash e substitui o manifest por último.

O modo `--offline` verifica o cache existente e não inicia downloads. Ele rejeita cache ausente, checksum inválido, fonte incompatível ou combinação com `--refresh`. A geografia e os nomes hospitalares também não são baixados nesse modo. Execuções são registradas em `.cache/runs/`.

A referência disponível não contém os arquivos brutos ou o cache original. Por isso, a validação atual começa nos agregados publicados; não foi reexecutada a coleta histórica. O modo offline do extrator foi testado com fixtures restritas aos testes.

## Decisões

| Decisão | Motivo e consequência |
|---|---|
| Python + SQL local | Demonstra ingestão, tratamento e análise sem infraestrutura paga. |
| DuckDB + Parquet | SQL sobre dados colunares, sem serviço de banco permanente. |
| Consumir primeiro os agregados existentes | Respeita a restrição de não coletar novamente e não reconstrói microdados inexistentes. |
| Preservar o contrato do painel | Reduz risco de alterar indicadores ao introduzir SQL. |
| Uma coorte antes de todos os marts | Filtros consistentes entre indicadores, gráficos e tabelas. |
| Centavos inteiros | Evita perda de precisão monetária por ponto flutuante. |
| Threads SQL fixadas em 1 e ordenação explícita | Conteúdo Parquet reproduzível, adequado ao volume atual; desempenho pode ser reavaliado com medição. |
| Execuções separadas e ponteiro publicado no final | Mantém evidência e permite restaurar uma versão validada. |
| Sem extensões DuckDB automáticas | O pipeline não precisa instalar extensões ou acessar serviços externos. |
| Dependências com versões e hashes | Instalações verificáveis; separar análise, desenvolvimento e extração. |
| Relatório HTML autossuficiente | Leitura local e compartilhamento do arquivo sem backend. |

Não há demanda demonstrada para Spark, Kafka, Airflow ou serviços cloud. A escala atual é explicitada nos dados e nos registros de execução; não se reivindica uma arquitetura distribuída.
