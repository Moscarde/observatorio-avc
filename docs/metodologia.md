# Metodologia, fontes e limites

As informações sobre a coleta descrevem a extração registrada no manifest. A validação dos agregados não substitui a revalidação dos arquivos brutos.


- [SIH/SUS — DATASUS](https://datasus.saude.gov.br/acesso-a-informacao/producao-hospitalar-sih-sus/) e [notas técnicas](https://tabnet.datasus.gov.br/cgi/sih/midescr.htm).
- [API atual do PySUS](https://pysus.readthedocs.io/en/latest/databases/data-sources.html).
- Imagens locais em `frontend/public/images/`, todas do Wikimedia Commons: fotos do Rio de Janeiro por Wilfredor ([CC0](https://commons.wikimedia.org/wiki/File:Rio_de_Janeiro_coastal_skyline_at_sunset,_Brazil.jpg), [CC0](https://commons.wikimedia.org/wiki/File:Aerial_view_of_Rio_de_Janeiro_and_its_mountains,_Brazil.jpg)) e gravura de Gray's Anatomy, 1918 ([domínio público](https://commons.wikimedia.org/wiki/File:Gray516.png)). Tipografia IBM Plex em `frontend/public/fonts/` (SIL OFL 1.1, licença incluída).
- [geodata-br](https://github.com/tbrugz/geodata-br): malha histórica atribuída ao IBGE, CC0. Os 92 códigos municipais foram validados. A versão da malha não foi informada pelo distribuidor; não representa necessariamente limites territoriais recentes.

Recorte: arquivos RJ, competências de processamento de 2020–2025, AIHs normais (`IDENT=1`) e diagnóstico principal I60–I64. I62 aparece separadamente; G45/AIT e I69/sequelas são excluídos. Prorrogações são excluídas de **todos** os indicadores, inclusive valores. Isso deve ser considerado ao comparar valores com tabulações que incluem AIHs de longa permanência.

AIHs são registros, não pacientes únicos. Transferências, reinternações e reapresentações podem aumentar a contagem. Cópias idênticas da mesma AIH na mesma competência são removidas; conflitos interrompem a competência. Residência e internação são dimensões distintas; internações de residentes do RJ em arquivos de outros estados não integram este universo.

Mortalidade hospitalar usa desfechos conhecidos; permanência, valor médio e idade média usam seus próprios denominadores válidos. Idades em horas, dias, meses e anos são convertidas, incluindo o código de idade acima de 100 anos. Datas inconsistentes são auditadas sem alterar a competência. Campos obrigatórios ausentes interrompem o processamento. Na coleta atual não houve duplicatas, datas inconsistentes ou ausência de desfecho, permanência e valor. Sete idades ausentes/implausíveis foram excluídas da média, mantendo as internações na faixa ignorada. Os totais incluem 379 internações com residência fora do RJ ou ignorada; o mapa RJ não mostra essas residências. Não há incidência populacional, mortalidade populacional, custo integral ou ajuste de gravidade nos rankings. Lacunas não viram zero; o gráfico anual só apresenta anos com todas as competências do recorte disponíveis.

