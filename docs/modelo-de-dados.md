# Modelo de dados e indicadores

O contrato verificável está em [`contracts/cube-v1.json`](../contracts/cube-v1.json) e é aplicado por `etl.validate`. Schema público atual: **1**. A estrutura deve conter exatamente as dimensões e medidas declaradas, sem dimensões nulas, medidas negativas ou não finitas.

## Grão e dimensões

Uma linha representa a soma de AIHs normais na combinação abaixo. Não representa paciente individual e não permite reconstruir microdados.

| Campo | Tipo | Significado |
|---|---|---|
| `period` | texto AAAA-MM | Competência de processamento, dentro da cobertura declarada |
| `residence` | texto, 6 dígitos ou `unknown` | Município de residência; pode ser externo ao RJ |
| `hospital_city` | texto, 6 dígitos ou `unknown` | Município de internação |
| `hospital` | texto, 7 dígitos ou `unknown` | Código CNES; preservar zeros à esquerda |
| `sex` | domínio textual | Masculino, Feminino ou Ignorado |
| `age` | domínio textual | Faixas do contrato, incluindo Ignorada |
| `cid` | texto I60–I64 com subcategoria opcional | Diagnóstico principal; I62 permanece separado |

A chave formada por todas as dimensões deve ser única. Códigos desconhecidos não são eliminados dos totais. Nomes de hospitais são referências cadastrais, não nomes históricos garantidos.

## Medidas aditivas

| Campo | Tipo lógico | Conteúdo |
|---|---|---|
| `n` | inteiro | Registros de internação selecionados e deduplicados |
| `deaths` | inteiro | Óbitos hospitalares registrados |
| `death_n` | inteiro | Registros com desfecho conhecido |
| `days` / `days_n` | numérico / inteiro | Soma de dias válidos / registros com permanência válida |
| `cents` / `value_n` | inteiro / inteiro | Soma em centavos / registros com valor válido |
| `age_sum` / `age_n` | numérico / inteiro | Soma de idades convertidas em anos / idades válidas |

Cada denominador está entre zero e `n`; `deaths <= death_n`. Soma com denominador zero deve ser zero. As ausências declaradas na auditoria precisam reconciliar com `n - denominador`. O número de internações por competência reconcilia com selecionados menos duplicatas da auditoria registrada.

## Indicadores derivados

| Indicador SQL | Fórmula |
|---|---|
| `hospital_mortality_pct` | `100 * SUM(deaths) / NULLIF(SUM(death_n), 0)` |
| `mean_stay_days` | `SUM(days) / NULLIF(SUM(days_n), 0)` |
| `mean_aih_value_brl` | `SUM(cents) / (100 * NULLIF(SUM(value_n), 0))` |
| `mean_age_years` | `SUM(age_sum) / NULLIF(SUM(age_n), 0)` |

Denominador zero produz `NULL`, exibido como travessão no relatório. Nunca somar taxas ou usar média simples de médias. Valores monetários são nominais. A soma de idades usa tolerância absoluta de `0,00001` na reconciliação; contagens, dias e centavos exigem igualdade.

## Tabelas SQL

| Tabela | Grão |
|---|---|
| `stg_internacoes_agregadas` | Mesmo grão dos cubos públicos |
| `cohort` | Linhas após todos os filtros da execução |
| `mart_indicadores` | Uma linha de totais da coorte |
| `mart_evolucao_mensal` | Competência coberta no período selecionado |
| `mart_evolucao_anual` | Ano de processamento dentro do período selecionado |
| `mart_distribuicao_territorial` | Base territorial (`residence` ou `hospital_city`) × município |
| `mart_perfil_internacoes` | Eixo (`sex`, `age` ou `cid`) × categoria |
| `mart_rede_hospitalar` | CNES × município de internação |

As bases territoriais e os eixos de perfil são visões alternativas da mesma população: não somar entre bases ou entre eixos. Competências cobertas sem observações na coorte são zero conhecido; competências não cobertas não são fabricadas. O pipeline analítico exige cobertura completa da base; o validador permite examinar cobertura parcial somente com opção explícita.

## Evidência e limitações

A proveniência registrada identifica arquivos oficiais e seus hashes, mas eles não estão disponíveis localmente. A reconciliação atual comprova consistência entre agregados, auditorias registradas, SQL e cálculos TypeScript; não substitui revalidação independente dos brutos.

Os testes de seleção do ETL usam fixtures sintéticas exclusivamente em `tests/`. Não há incidência populacional, mortalidade populacional, ajuste de gravidade, identificação de pacientes únicos ou estimativa de custo econômico integral.
