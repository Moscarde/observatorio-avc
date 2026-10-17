# Planejamento da versão pessoal

## Objetivo e decisões acordadas

Portar a base de `riocode7/rc-avc` para um projeto pessoal com destino previsto em `moscarde/observatorio-avc`, demonstrando proficiência em coleta, manipulação e entrega de dados por painéis e relatórios.

- Foco profissional: engenharia de dados com Python e SQL.
- Orçamento financeiro: zero; a execução local deve ser suficiente.
- Prazo: não definido; trabalhar por entregas verificáveis.
- Reutilização: autorizada pelo autor, sócio da RioCode, incluindo código e elementos visuais.
- Diretório de trabalho: `../observatorio-avc/`; o diretório de referência não recebe alterações.
- Dados: reaproveitar os existentes, sem nova coleta nesta migração.
- Histórico: commits incrementais no padrão Conventional Commits + gitmoji, com tipo em inglês e descrição imperativa em português (`tipo(escopo opcional): gitmoji descrição`); sem Codex ou Claude como coautores.
- Demonstração existente: <https://avc.riocode.com.br/>. Não pressupor que o deploy acompanha os commits pessoais.

Este documento é um plano de execução. Uma entrega planejada só passa a concluída quando seus critérios de aceite forem verificados.

## Diagnóstico da base

| Área | Implementado na referência | Evolução proposta |
|---|---|---|
| Ingestão | CLI Python, PySUS/curl, retries, timeout e cache | Modo estritamente offline, contratos e rastreio por execução |
| Tratamento | Validações, deduplicação e agregação Pandas | Etapas explícitas e contratos documentados |
| Proveniência | Hashes, URLs, cobertura e auditoria no manifest | Relacionar entrada, versão do código e artefatos da execução |
| Consumo | Painel React com filtros e agregados aditivos | Modelos SQL e relatório derivado da mesma base |
| Qualidade | Testes Python e frontend | Reconciliação automatizada e CI independente da fonte externa |
| Publicação | JSONs com hash e manifest substituído por último | Processo documentado de validação e recuperação |
| Portfólio | Aplicação e documentação operacional | Arquitetura, modelo, decisões e demonstração reproduzível |

## Disponibilidade dos dados e limite de reprodução

A cópia inicial contém seis cubos anuais, manifest, geografia e referências utilizadas pelo painel. O manifest declara 72 competências completas de 2020–2025. Não há `.cache/` nem arquivos brutos no diretório de referência disponível nesta sessão.

Consequências:

1. O painel pode usar os dados copiados sem nova coleta.
2. A primeira camada SQL pode consumir os agregados existentes, sem inventar registros individuais.
3. A reexecução histórica desde DBC/Parquet depende de arquivos brutos ou cache previamente existentes que sejam disponibilizados localmente. Não baixar novamente para contornar essa ausência.
4. Validar os agregados não equivale a reconciliá-los com os arquivos oficiais brutos. Separar essas evidências na documentação e no relatório de qualidade.
5. O ETL atual tenta acessar a rede na falta de cache válido. Não executá-lo nesta fase como se fosse um comando offline.

## Arquitetura proposta

### Primeira entrega: dados existentes e SQL local

```text
Cubos JSON + manifest herdados
             ↓
Validação de schema, cobertura e medidas
             ↓
Conversão controlada para Parquet local
             ↓
Consultas SQL no DuckDB
             ↓
Relatório reproduzível + reconciliação com os cubos
```

O painel continua consumindo seu contrato atual durante essa etapa. A migração do produtor dos JSONs só ocorre depois da comprovação de equivalência dos resultados.

### Caminho completo: reaproveitar o ETL existente

```text
Arquivos oficiais preservados, quando disponíveis localmente
             ↓
ETL Python existente → validação e tratamento
             ↓
Parquet tratado → modelos SQL → agregados
             ↓
Manifest + painel + relatório
```

A coleta oficial permanece uma capacidade do código herdado. A demonstração desta migração não deve declarar nova coleta realizada. O caminho completo será validado com arquivos locais já coletados quando estiverem disponíveis.

### Escolhas técnicas

- Python: ingestão, normalização, validações e exportação; aproveitar os módulos existentes.
- Parquet: persistência local de dados intermediários; manter arquivos gerados fora do Git.
- DuckDB: executar SQL localmente sobre dados colunares, sem serviço de banco permanente.
- React/TypeScript/ECharts: preservar a aplicação existente e seus contratos.
- unittest e verificações do frontend: aproveitar os testes atuais e adicionar regressões de comportamento.
- GitHub Actions: proposta para CI de testes e build, sem coleta externa obrigatória. Confirmar condições de uso antes de habilitar; execução local continua suficiente.

Airflow, Spark, Kafka, Kubernetes, dbt, backend e cloud não integram o escopo inicial. Adicionar ferramentas só diante de uma necessidade demonstrável e compatível com o orçamento.

## Modelo analítico e contratos

O grão do agregado atual é a combinação de competência, município de residência, município de internação, estabelecimento, sexo, faixa etária e CID. Ele não permite reconstruir registros individuais.

Medidas existentes: internações (`n`), óbitos, denominador de desfecho conhecido, dias e seu denominador, centavos e seu denominador, soma de idades e seu denominador. Preservar códigos municipais e CNES como texto, incluindo zeros à esquerda.

Modelos SQL propostos:

- `stg_internacoes_agregadas`: tipagem e contrato dos cubos herdados.
- `mart_evolucao_mensal`: internações, desfechos e medidas por competência.
- `mart_distribuicao_territorial`: análises com dimensão territorial explicitamente selecionada.
- `mart_perfil_internacoes`: distribuição por sexo, faixa etária e CID.
- `mart_rede_hospitalar`: comparação descritiva, sem inferir qualidade assistencial ou ajustar gravidade.

Taxas e médias são calculadas a partir das somas e denominadores válidos, nunca pela soma de taxas ou média simples das médias. Valores monetários devem preservar centavos inteiros; a precisão da soma de idades deve ter tolerância explícita de reconciliação.

Contratos devem documentar schema e versão, grão, tipos, nulidade, domínios, medidas, denominadores, cobertura e compatibilidade com o frontend. Não publicar identificadores de AIH ou bases tratadas em nível individual.

## Backlog incremental

### M0 — Base pessoal e planejamento

Entregas: cópia seletiva da base, Git independente, instruções locais, README conciso e plano versionado.

Aceite: arquivos copiados conferidos com a referência; agregados preservados; sem `.git` de origem ou configurações privadas copiadas; nenhum download de dados; commits no padrão solicitado.

Estado: base e documentação preparadas nesta etapa. Não equivale a publicação no GitHub.

### M1 — Contrato e validação offline dos dados existentes

Entregas: comando Python de validação dos artefatos, contrato versionado e relatório de qualidade legível por máquina e por pessoa.

Aceite: verificar cobertura, referências do manifest, hashes, dimensões, medidas finitas/não negativas, denominadores e reconciliação entre cubos e auditorias. Arquivo ausente ou inválido deve causar erro claro. O comando deve funcionar com rede indisponível, sem modificar os agregados originais.

Exemplo de commit: `test: ✅ Valida os agregados publicados sem acesso à rede`.

### M2 — Execução reproduzível e CI

Depende de M1.

Entregas: dependências Python controladas e separação das dependências necessárias à análise offline e à extração; comandos padronizados; CI de lint, testes e build.

Aceite: instalar a partir de ambiente limpo, executar os checks documentados e registrar versões. A instalação de dependências pode usar rede; a validação dos dados não pode depender do DATASUS. Só exibir badges depois de existirem execuções reais correspondentes.

Exemplo de commit: `ci: 👷 Automatiza os testes e a construção do painel`.

### M3 — Manipulação e modelos SQL

Depende de M1 e M2.

Entregas: conversão dos cubos para Parquet ignorado pelo Git, consultas SQL separadas, dicionário e documentação do grão.

Aceite: reconciliar totais e indicadores com a base atual, incluindo recortes combinados, valores ausentes e residência versus internação. A mesma entrada deve produzir o mesmo conteúdo analítico; metadados de execução podem variar. Não chamar essa camada agregada de base de microdados.

Exemplo de commit: `feat: ✨ Modela os indicadores em SQL com DuckDB`.

### M4 — Relatório e entrega ao consumidor

Depende de M3.

Entregas: relatório HTML estático gerado por Python/SQL e documentação do contrato de exportação. Preferir bibliotecas e formatos simples, sem servidor ou API paga.

Aceite: apresentar período, fonte, cobertura, indicadores e limitações; reconciliar seus números com o painel para o mesmo recorte. O relatório deve ser regenerável por comando. Usar imagens e métricas medidas em execução real.

Exemplo de commit: `feat: ✨ Gera o relatório a partir dos modelos SQL`.

### M5 — Operação local e reprocessamento

Depende de M3. A validação desde os brutos depende também da disponibilidade de arquivos locais previamente coletados.

Entregas: modo offline explícito no ETL, identificação da execução, registro de hashes/versão do código/duração/resultado e procedimentos de reprocessamento e recuperação.

Aceite: cache ausente ou inválido não inicia download em modo offline; falhas preservam a publicação válida; repetir uma entrada não duplica dados; uma revisão local de competência tem tratamento documentado. Testar falhas com fixtures sintéticas restritas aos testes.

Exemplo de commit: `feat: ✨ Permite reprocessar o cache sem acessar a rede`.

### M6 — Preparação para publicação open source

Depende de M1–M4; documentar explicitamente qualquer parte de M5 ainda pendente.

Entregas: licença do código próprio, revisão dos avisos de terceiros, orientações de contribuição, screenshots reais, revisão de arquivos e histórico destinados ao público e primeira release.

Aceite: README distingue o implementado do planejado; execução rápida funciona; links apontam aos destinos corretos; licença e atribuições estão definidas; não há credenciais/configurações privadas nos arquivos ou histórico a publicar. Separar a licença do software das condições das fontes de dados e ativos.

O repositório remoto ainda não foi criado. Escolha da licença e publicação são próximas decisões; não há cronograma ou custo contratado.

Exemplo de commit: `docs: 📝 Prepara a documentação da primeira versão pública`.

## Evidências e apresentação do portfólio

O visitante deve conseguir responder: qual problema o projeto resolve, de onde vêm os dados, como foram tratados, quais controles existem, como reproduzir e quais são as limitações.

Artefatos esperados: README, arquitetura, dicionário de dados, contratos, relatório de qualidade, consultas SQL, relatório analítico e demonstração do painel. Registrar decisões e seus motivos, sem apresentar ferramentas planejadas como implementadas.

Critérios de sucesso: uma validação offline; uma consulta SQL reproduzível; um relatório reconciliado com o painel; uma falha controlada com resultado verificável; documentação que permita repetir os passos. Medir duração e volumes antes de divulgar resultados de desempenho.

## Referências técnicas

- [DuckDB: leitura e escrita de Parquet](https://duckdb.org/docs/data/parquet).
- [GitHub: licenciamento de repositórios](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository).
- [Metodologia e fontes do projeto](metodologia.md).
- [Operação herdada do ETL](operacao.md).
