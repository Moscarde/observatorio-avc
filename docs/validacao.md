# Evidências de validação local

Verificações executadas em **17/10/2026**, em Linux, com Python 3.12.3 e Node.js 22.23.3. Esta página registra uma execução local; o workflow ainda não foi executado no GitHub. Os testes e comandos podem ser repetidos conforme [operação](operacao.md).

| Verificação | Resultado |
|---|---|
| Ruff lint e formatação, `etl/` e `tests/` | Aprovados |
| Suíte Python completa, com dependências de extração | 31 testes aprovados |
| Ambiente limpo instalado com hashes, sem PySUS | Relatório gerado; 8 testes do ETL aprovados e 2 específicos de PySUS explicitamente ignorados |
| Validador offline nos agregados reais | 72 competências; hashes, grão, domínios, medidas e auditorias aprovados |
| Reconciliação Python/SQL | 9 grupos de medidas aditivas por execução, incluindo bases territoriais e eixos de perfil |
| Reconciliação SQL/TypeScript | Todos os indicadores e medidas em 3 recortes reais |
| Cálculos TypeScript | 7 testes aprovados |
| Mapa SSR e importação ESM de desenvolvimento | Aprovados; 92 municípios renderizados |
| Instalação limpa `npm ci`, lint/tipagem e build | Aprovados |
| Testes de navegador no build de produção, desktop e celular | 8 testes aprovados |
| `npm audit` na instalação limpa | Nenhuma vulnerabilidade reportada naquela execução; não equivale a uma auditoria de segurança do projeto |

## Base de dados examinada

- Período: janeiro de 2020 a dezembro de 2025, competências de processamento.
- Cobertura: 72 competências, sem falhas declaradas no manifest herdado.
- Linhas agregadas: 66.635.
- Internações: 112.150.
- Óbitos hospitalares: 23.200.
- Registros examinados na extração original, segundo as auditorias herdadas: 4.950.224.
- Idades excluídas da média por ausência ou implausibilidade, segundo a auditoria: 7.

Contagens de seleção e ausências foram reconciliadas com as auditorias do manifest. Os totais não representam pacientes únicos. A validade histórica dos arquivos oficiais brutos não foi reavaliada porque eles não estão disponíveis nesta cópia.

## Comportamentos exercitados

- Falha em arquivo ausente, hash divergente, grão duplicado, denominador inválido, medida não finita e cobertura inconsistente.
- Rejeição de alteração nas auditorias de seleção/ausências e de caminhos de artefatos incompatíveis.
- Mesmos filtros aplicados a totais, série, perfil e hospitais; comparação com o TypeScript do painel.
- Taxas nulas no recorte sem denominador e contagens zero em competências cobertas sem observações no recorte.
- Repetição da execução com Parquets de mesmo conteúdo e sem duplicar fatos.
- Falha de reconciliação preservando a publicação anterior e gerando registro de falha.
- Restauração de execução válida e rejeição de artefato corrompido antes de alterar o ponteiro.
- Cache offline válido, ausente, corrompido ou de fonte incompatível; ausência de download.
- Navegação, filtros, metodologia, tratamento de erro e ausência de transbordamento da página em desktop e celular.
- Relatório aberto como arquivo local, com tentativas de rede bloqueadas e sem requisições externas.

## Capturas reais

Capturas feitas com os agregados existentes, sem fixtures sintéticas. Os arquivos registram a apresentação local naquele momento.

- [Painel em desktop](images/painel-desktop.png)
- [Análise territorial no painel](images/painel-analise.png)
- [Painel em celular](images/painel-mobile.png)
- [Relatório em desktop](images/relatorio-desktop.png)
- [Relatório em celular](images/relatorio-mobile.png)

## Limites

A instalação de dependências e do navegador usa rede, mas não baixa dados de internações. Testes de PySUS usam mocks ou fixtures e não comprovam a disponibilidade atual do FTP. O modo offline não foi executado sobre os 72 arquivos brutos históricos, ausentes localmente.

O código do CI está versionado, mas sua aprovação remota depende do repositório GitHub. Não houve publicação remota ou alteração do deploy da RioCode. Durações e hashes específicos de cada execução analítica ficam em seu `run.json`; não são tratados como benchmark de desempenho.
