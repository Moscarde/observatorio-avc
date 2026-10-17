# Entregas da versão pessoal

## Escopo acordado

Engenharia de dados com Python e SQL, execução local sem orçamento financeiro e demonstração de coleta, manipulação e entrega por painel e relatório. Reutilização do código e dos elementos visuais autorizada pelo autor, sócio da RioCode. Diretório de trabalho: `../observatorio-avc/`; `../rc-avc/` permanece referência.

Commits incrementais no padrão Conventional Commits + gitmoji, com descrição imperativa em português e sem Codex ou Claude como coautores. Dados existentes reutilizados; nenhuma nova coleta nesta evolução.

## Estado das entregas

| Marco | Entrega local | Estado |
|---|---|---|
| M0 | Base independente, instruções e histórico pessoal | Concluído |
| M1 | Contrato v1, validador offline, qualidade JSON/Markdown e regressões | Implementado e testado |
| M2 | Três ambientes Python com hashes, comandos locais e workflow de CI | Instalação local validada; workflow remoto ainda não executado |
| M3 | Parquet, DuckDB e seis marts SQL com reconciliação | Implementado e testado |
| M4 | Relatório HTML portátil, filtros, tabelas e gráfico | Gerado e verificado em desktop e celular |
| M5 | ETL offline, rastreio de execução e restauração por hashes | Implementado e testado; extração histórica real depende de cache ausente |
| M6 | MIT, créditos, contribuição, screenshots e documentação de release | Preparado localmente; publicação remota ainda não realizada |

## O que é demonstrável agora

- Validar os agregados existentes sem rede e rejeitar alterações de conteúdo, cobertura, grão ou denominadores.
- Converter para Parquet, executar SQL e gerar relatório sem servidor ou serviço pago.
- Reconciliar medidas e indicadores com o cálculo TypeScript usado pelo painel.
- Aplicar filtros combinados a todas as saídas analíticas; preservar nulos em taxas sem denominador.
- Repetir a análise sem duplicar dados e obter o mesmo conteúdo Parquet.
- Simular falhas nos testes, preservar a última publicação válida e restaurar uma execução após verificar seus hashes.
- Executar o ETL em modo offline com cache válido ou falhar sem iniciar coleta.

As evidências e os limites estão em [validação](validacao.md). Os comandos estão em [operação](operacao.md).

## Limites de reprodução

A referência disponível contém cubos anuais, manifest, geografia e referências cadastrais; não contém DBCs ou cache Parquet da extração histórica. O caminho analítico executado começa nos agregados, sem reconstruir microdados ou afirmar nova coleta. A capacidade de extração permanece no ETL herdado e é testada com fixtures.

Quando arquivos já coletados forem disponibilizados localmente, será possível demonstrar o reprocessamento histórico com `--offline`, reconciliar seus resultados e registrar essa evidência. Não fazer downloads para contornar a ausência.

## Próximos passos externos

1. Criar o repositório pessoal `moscarde/observatorio-avc` e enviar o histórico local.
2. Executar o workflow no GitHub e acompanhar o resultado antes de exibir badge de aprovação.
3. Publicar a release 0.1.0 com as evidências e limitações documentadas.
4. Decidir se o projeto pessoal terá uma hospedagem própria; a demonstração de origem permanece em <https://avc.riocode.com.br/> e não acompanha automaticamente este histórico.

Essas etapas não são requisitos para executar o projeto localmente. Nenhum serviço pago foi contratado ou configurado.
