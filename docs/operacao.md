# Operação do ETL e publicação

Procedimentos herdados da referência. Não execute os comandos de extração durante a preparação da versão pessoal: a migração reutiliza os agregados existentes e não faz novos downloads. O ETL atual pode acessar a rede se o cache estiver ausente ou inválido.


A API atual consultada retorna DataFrame com `pysus.ftp.sih(state="RJ", year=ano, month=mes, group="RD", as_dataframe=True)`. O padrão usa o catálogo espelho do PySUS; `--source origin` consulta o FTP via PySUS. `--source origin-curl` usa curl para baixar os DBCs oficiais e o descompressor/leitor utilizado pelo PySUS para convertê-los. Esse transporte permitiu a coleta neste ambiente e requer curl instalado. Cada competência roda em subprocesso com limite de 90 segundos (180 no transporte curl), tentativas de rede e cache verificado por SHA-256. Use `--months 1 2` para uma coleta pequena.

Falhas cancelam a exportação e preservam os arquivos anteriores. `--allow-partial` permite publicar lacunas explícitas; o comando retorna código 1 se faltar cobertura anual ou geografia. `--refresh` ignora o cache mensal do ETL; para baixar revisões nos modos PySUS também remova `.cache/raw/pysus/`, seu cache interno. No modo `origin-curl`, o DBC é baixado novamente. Arquivos brutos nunca são versionados. Cubos anuais com somas e denominadores alimentam todos os filtros; médias e taxas são recalculadas. O conteúdo dos cubos é determinístico; a data do manifest registra cada exportação.

Nomes são obtidos da tabela `DBF/TCNESRJ.dbf` do arquivo auxiliar oficial `TAB_SIH.zip`. O modo `origin-curl` também coleta essa referência, cuja versão atual tem data de **15/09/2026**. São nomes cadastrais de referência, não uma reconstrução dos nomes históricos entre 2020 e 2025. URL, data e hash estão no manifest. `--hospital-names caminho.json` continua disponível para um mapeamento externo confiável `{ "CNES": "Nome" }`.

Em servidor próprio com systemd e [just](https://just.systems): `just deploy` instala dependências, gera o build e cria o serviço `observatorio-avc` (porta 4173, serviço de usuário; `SERVICE_MODE=system`, `PORT` e `HOST` são configuráveis). `just linger` mantém o serviço de usuário após logout; `just status`, `just logs` e `just uninstall` administram o serviço.

Na Vercel ou Cloudflare Pages: diretório raiz `frontend`, instalação `npm ci`, build `npm run build`, saída `dist`. Os JSONs de `public/data` são incluídos no build. Nenhuma chamada à API, Python ou banco é necessária em produção. Origem do projeto: repositório privado `riocode7/rc-avc`. O repositório pessoal de destino previsto é `moscarde/observatorio-avc`.

