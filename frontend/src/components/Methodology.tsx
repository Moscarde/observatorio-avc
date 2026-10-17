import type { ReactNode } from "react";
import { format, qualityByYear } from "../lib/analytics";
import type { Manifest } from "../types/data";
import { images } from "../lib/media";
const pipeline = [
  [
    "Coleta",
    "Arquivos RD mensais do SIH/SUS (RJ) baixados do FTP DATASUS e convertidos com o leitor do PySUS.",
  ],
  [
    "Validação",
    "Layout oficial, competência interna e número da AIH conferidos antes de qualquer cálculo.",
  ],
  ["Seleção", "AIHs normais (IDENT=1) com diagnóstico principal I60–I64."],
  [
    "Tratamento",
    "Cópias idênticas removidas, idades convertidas, códigos e valores padronizados.",
  ],
  [
    "Agregação",
    "Cubos anuais com somas e denominadores válidos; nenhuma AIH individual é publicada.",
  ],
  [
    "Publicação",
    "JSONs estáticos com hash no nome e manifest com cobertura, qualidade e proveniência.",
  ],
] as const;
const fields: [string, string, string][] = [
  [
    "DIAG_PRINC",
    "Diagnóstico principal",
    "Seleção I60–I64; código original preservado",
  ],
  ["IDENT", "Tipo de AIH", "Somente 1 (normal); prorrogações excluídas"],
  [
    "N_AIH",
    "Número da AIH",
    "Validação (13 dígitos) e deduplicação; não publicado",
  ],
  [
    "ANO_CMPT · MES_CMPT",
    "Competência",
    "Deve coincidir com o arquivo solicitado",
  ],
  [
    "MUNIC_RES",
    "Município de residência",
    "Código de 6 dígitos; ausente vira “ignorado”",
  ],
  [
    "MUNIC_MOV",
    "Município do estabelecimento",
    "Dimensão “município de internação”",
  ],
  [
    "CNES",
    "Estabelecimento",
    "Código de 7 dígitos; nome pela tabela CNES do DATASUS",
  ],
  ["SEXO", "Sexo registrado", "1 masculino, 3 feminino, demais ignorado"],
  [
    "COD_IDADE · IDADE",
    "Idade",
    "Horas, dias, meses e anos convertidos para anos",
  ],
  ["MORTE", "Desfecho", "0/1; outros valores ficam fora do denominador"],
  ["DIAS_PERM", "Permanência", "Dias válidos e não negativos"],
  [
    "VAL_TOT",
    "Valor aprovado",
    "Convertido para centavos com precisão decimal",
  ],
  [
    "DT_INTER · DT_SAIDA",
    "Datas",
    "Inconsistências auditadas, sem alterar a competência",
  ],
];
const indicators: [string, string, string, string][] = [
  [
    "Internações registradas",
    "Número de AIHs normais selecionadas",
    "—",
    "Não equivale a pacientes únicos",
  ],
  [
    "Óbitos hospitalares",
    "AIHs com MORTE = 1",
    "—",
    "Óbitos durante a internação registrada",
  ],
  [
    "Mortalidade hospitalar",
    "Óbitos × 100",
    "AIHs com desfecho conhecido (MORTE 0 ou 1)",
    "Não é mortalidade populacional",
  ],
  [
    "Permanência média",
    "Soma de DIAS_PERM",
    "AIHs com permanência válida",
    "Média aritmética; sensível a casos longos",
  ],
  [
    "Idade média",
    "Soma das idades em anos",
    "AIHs com idade válida (até 120 anos)",
    "Idades ausentes ficam na faixa “ignorada”",
  ],
  [
    "Valor total aprovado",
    "Soma de VAL_TOT",
    "—",
    "Reais nominais; não é custo integral",
  ],
  [
    "Valor médio por AIH",
    "Soma de VAL_TOT",
    "AIHs com valor válido",
    "Sem correção inflacionária",
  ],
];
function Section({
  id,
  index,
  title,
  lead,
  children,
}: {
  id: string;
  index: number;
  title: string;
  lead?: string;
  children: ReactNode;
}) {
  return (
    <section className="method-section" id={id}>
      <header>
        <span className="step-number" aria-hidden="true">
          {index}
        </span>
        <div>
          <h2>{title}</h2>
          {lead && <p>{lead}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}
const toc = [
  ["m-fluxo", "Fluxo de dados"],
  ["m-coleta", "Coleta"],
  ["m-selecao", "Seleção do recorte"],
  ["m-tratamento", "Tratamento"],
  ["m-indicadores", "Indicadores"],
  ["m-qualidade", "Qualidade e cobertura"],
  ["m-limites", "Limites de interpretação"],
  ["m-fontes", "Fontes e reprodução"],
] as const;
export function Methodology({ manifest }: { manifest: Manifest | null }) {
  const years = qualityByYear(manifest?.quality);
  const total = years.reduce(
    (t, y) => ({
      source: t.source + y.source_rows,
      selected: t.selected + y.stroke_normal_rows,
      duplicates: t.duplicates + y.duplicate_rows,
      dates: t.dates + y.invalid_dates,
      age: t.age + y.missing_age,
    }),
    { source: 0, selected: 0, duplicates: 0, dates: 0, age: 0 },
  );
  const has = years.length > 0;
  const published = total.selected - total.duplicates;
  const pysus = manifest?.provenance?.find(
    (p) => p.pysus_version,
  )?.pysus_version;
  const reference = manifest?.hospital_reference;
  const jump = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  return (
    <div className="method-page">
      <section className="method-hero">
        <img
          className="hero-photo"
          src={images.method.src}
          srcSet={`${images.method.small} 1200w, ${images.method.src} 2400w`}
          sizes="(max-width: 1440px) 100vw, 1440px"
          alt={images.method.alt}
        />
        <div className="method-hero-copy">
          <span className="hero-kicker">Metodologia</span>
          <h1>Da AIH ao painel</h1>
          <p>
            Cada número do observatório vem dos arquivos públicos do SIH/SUS.
            Esta página descreve, passo a passo, a coleta, as regras de seleção,
            o tratamento e as verificações de qualidade aplicadas.
          </p>
          <a className="action" href="#/">
            ← Voltar ao painel
          </a>
        </div>
        <a
          className="photo-credit"
          href={images.method.page}
          target="_blank"
          rel="noreferrer"
        >
          Foto: {images.method.credit} · {images.method.license}
        </a>
      </section>
      <dl className="method-facts">
        <div>
          <dt>Registros RD examinados</dt>
          <dd>{has ? format(total.source) : "—"}</dd>
        </div>
        <div>
          <dt>Internações por AVC publicadas</dt>
          <dd className="accent">{has ? format(published) : "—"}</dd>
        </div>
        <div>
          <dt>Competências com dados</dt>
          <dd>
            {manifest ? manifest.coverage.length : "—"}
            {manifest && (
              <small>
                {" "}
                de{" "}
                {(manifest.requested.end - manifest.requested.start + 1) * 12}
              </small>
            )}
          </dd>
        </div>
        <div>
          <dt>Última exportação</dt>
          <dd>
            {manifest?.generated_at
              ? new Date(manifest.generated_at).toLocaleDateString("pt-BR")
              : "pendente"}
          </dd>
        </div>
      </dl>
      <div className="method-layout">
        <nav className="method-toc" aria-label="Nesta página">
          <span className="eyebrow">Nesta página</span>
          {toc.map(([id, label], index) => (
            <button key={id} onClick={() => jump(id)}>
              <span>{index + 1}</span>
              {label}
            </button>
          ))}
        </nav>
        <div className="method-body">
          <Section
            id="m-fluxo"
            index={1}
            title="Fluxo de dados"
            lead="Seis etapas sequenciais. Uma falha em qualquer etapa interrompe a exportação e preserva os dados publicados anteriormente."
          >
            <ol className="pipeline">
              {pipeline.map(([title, text], index) => (
                <li key={title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
            {has && (
              <div className="funnel" aria-label="Funil de seleção">
                {(
                  [
                    ["Registros RD do RJ examinados", total.source],
                    ["AIHs normais com diagnóstico I60–I64", total.selected],
                    ["Após remover cópias idênticas", published],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <div className="funnel-bar">
                      <i
                        style={{
                          width: `${Math.max(1.5, (value / total.source) * 100)}%`,
                        }}
                      />
                    </div>
                    <strong>
                      {format(value)}
                      <small>{format((value / total.source) * 100, 1)}%</small>
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </Section>
          <Section
            id="m-coleta"
            index={2}
            title="Coleta"
            lead="Fonte primária: arquivos reduzidos de AIH (RD) do Sistema de Informações Hospitalares do SUS, publicados pelo DATASUS."
          >
            <div className="method-cards">
              <article>
                <h3>O que é baixado</h3>
                <p>
                  Um arquivo por competência, no padrão{" "}
                  <code>RDRJaamm.dbc</code>, de janeiro de 2020 a dezembro de
                  2025. O transporte padrão usa curl sobre o FTP oficial; o
                  arquivo DBC é descompactado e lido com o mesmo leitor do PySUS
                  {pysus ? ` ${pysus}` : ""} e guardado em cache Parquet.
                </p>
              </article>
              <article>
                <h3>Robustez</h3>
                <p>
                  Cada competência roda em processo separado, com limite de
                  tempo e novas tentativas de rede. O cache é verificado por
                  SHA-256 do arquivo bruto e do processado; arquivos brutos
                  nunca são versionados.
                </p>
              </article>
              <article>
                <h3>Referências auxiliares</h3>
                <p>
                  Nomes dos estabelecimentos vêm da tabela{" "}
                  <code>{reference?.table ?? "DBF/TCNESRJ.dbf"}</code> do
                  arquivo oficial <code>TAB_SIH.zip</code>
                  {reference &&
                    `, versão de ${reference.reference_date.split("-").reverse().join("/")}`}
                  . São nomes cadastrais atuais, não uma reconstrução histórica.
                  A malha municipal é a do IBGE redistribuída pelo geodata-br
                  (CC0), com os 92 códigos validados.
                </p>
              </article>
            </div>
          </Section>
          <Section
            id="m-selecao"
            index={3}
            title="Seleção do recorte"
            lead="Quais internações entram — e quais ficam de fora — de todos os indicadores."
          >
            <div className="include-grid">
              <div className="include">
                <h3>Incluído</h3>
                <ul>
                  <li>Arquivos RD do estado do Rio de Janeiro</li>
                  <li>Competências de processamento de 2020 a 2025</li>
                  <li>AIHs normais (IDENT = 1)</li>
                  <li>
                    Diagnóstico principal I60, I61, I62, I63 ou I64, com
                    subcategorias
                  </li>
                  <li>
                    I62 identificado separadamente por suas diferenças clínicas
                  </li>
                </ul>
              </div>
              <div className="exclude">
                <h3>Excluído</h3>
                <ul>
                  <li>G45 — ataque isquêmico transitório</li>
                  <li>I69 — sequelas de doenças cerebrovasculares</li>
                  <li>
                    AIHs de prorrogação (longa permanência), inclusive nos
                    valores
                  </li>
                  <li>
                    Internações de residentes do RJ registradas em arquivos de
                    outros estados
                  </li>
                </ul>
              </div>
            </div>
          </Section>
          <Section
            id="m-tratamento"
            index={4}
            title="Tratamento e padronização"
            lead="Regras aplicadas a cada AIH selecionada antes da agregação."
          >
            <div className="method-cards">
              <article>
                <h3>Validação obrigatória</h3>
                <p>
                  Os 16 campos usados precisam existir no layout. A competência
                  interna deve coincidir com o arquivo e o número da AIH deve
                  ter 13 dígitos. Qualquer violação interrompe a competência.
                </p>
              </article>
              <article>
                <h3>Duplicidades</h3>
                <p>
                  Cópias idênticas da mesma AIH na mesma competência são
                  removidas. Versões conflitantes da mesma AIH interrompem o
                  processamento para revisão — nada é escolhido automaticamente.
                </p>
              </article>
              <article>
                <h3>Ausências</h3>
                <p>
                  Campos ausentes ou implausíveis não viram zero: a internação
                  continua contada, mas fica fora do denominador do indicador
                  afetado. Idades ausentes entram na faixa “ignorada”.
                </p>
              </article>
            </div>
            <div className="table-scroll method-table">
              <table>
                <caption>Campos do SIH-RD utilizados</caption>
                <thead>
                  <tr>
                    <th>Campo</th>
                    <th>Significado</th>
                    <th>Tratamento</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map(([field, meaning, rule]) => (
                    <tr key={field}>
                      <td>
                        <code>{field}</code>
                      </td>
                      <td>{meaning}</td>
                      <td>{rule}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
          <Section
            id="m-indicadores"
            index={5}
            title="Como os indicadores são calculados"
            lead="Os cubos guardam somas e denominadores, nunca médias prontas. Ao filtrar, o painel soma as partes e recalcula cada razão — taxas e médias nunca são somadas."
          >
            <div className="table-scroll method-table">
              <table>
                <thead>
                  <tr>
                    <th>Indicador</th>
                    <th>Numerador</th>
                    <th>Denominador</th>
                    <th>Atenção</th>
                  </tr>
                </thead>
                <tbody>
                  {indicators.map(([name, num, den, note]) => (
                    <tr key={name}>
                      <td>
                        <strong>{name}</strong>
                      </td>
                      <td>{num}</td>
                      <td>{den}</td>
                      <td>{note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
          <Section
            id="m-qualidade"
            index={6}
            title="Qualidade e cobertura"
            lead="Auditoria registrada no manifest para cada competência extraída."
          >
            {has ? (
              <>
                <ul className="quality-summary">
                  <li>
                    <strong>{format(total.duplicates)}</strong> cópias
                    duplicadas removidas
                  </li>
                  <li>
                    <strong>{format(total.dates)}</strong> AIHs com datas
                    inconsistentes (mantidas, auditadas)
                  </li>
                  <li>
                    <strong>{format(total.age)}</strong> idades ausentes ou
                    implausíveis fora da idade média
                  </li>
                  <li>
                    <strong>{manifest?.failures.length ?? 0}</strong> falhas de
                    coleta
                  </li>
                </ul>
                <div className="table-scroll method-table">
                  <table>
                    <caption>Auditoria por ano de competência</caption>
                    <thead>
                      <tr>
                        <th>Ano</th>
                        <th>Competências</th>
                        <th>Registros RD</th>
                        <th>AVC selecionados</th>
                        <th>Duplicatas</th>
                        <th>Datas inconsist.</th>
                        <th>Sem idade</th>
                        <th>Sem desfecho</th>
                        <th>Sem permanência</th>
                        <th>Sem valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {years.map((y) => (
                        <tr key={y.year}>
                          <td>
                            <strong>{y.year}</strong>
                          </td>
                          <td>{y.periods}/12</td>
                          <td>{format(y.source_rows)}</td>
                          <td>{format(y.stroke_normal_rows)}</td>
                          <td>{format(y.duplicate_rows)}</td>
                          <td>{format(y.invalid_dates)}</td>
                          <td>{format(y.missing_age)}</td>
                          <td>{format(y.missing_death)}</td>
                          <td>{format(y.missing_days)}</td>
                          <td>{format(y.missing_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="method-empty">
                Auditoria indisponível: a coleta ainda não foi concluída neste
                ambiente.
              </p>
            )}
            {manifest && manifest.failures.length > 0 && (
              <details className="failures">
                <summary>
                  Consultar lacunas e falhas de coleta (
                  {manifest.failures.length})
                </summary>
                <ul>
                  {manifest.failures.map((f, i) => (
                    <li key={i}>
                      <strong>{f.period}</strong> — {f.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <p className="method-note">
              Lacunas não são preenchidas nem estimadas. Por padrão, uma falha
              cancela a exportação; publicar cobertura parcial exige opção
              explícita, e as competências ausentes aparecem vazias nos
              gráficos.
            </p>
          </Section>
          <Section
            id="m-limites"
            index={7}
            title="Limites de interpretação"
            lead="O que estes dados permitem — e não permitem — afirmar."
          >
            <div className="limits">
              <article>
                <h3>A unidade é a internação registrada</h3>
                <p>
                  AIHs não representam pacientes únicos. Transferências,
                  reinternações e reapresentações podem gerar registros
                  adicionais.
                </p>
              </article>
              <article>
                <h3>Mortalidade hospitalar ≠ populacional</h3>
                <p>
                  É a proporção de óbitos entre internações com desfecho
                  conhecido. Volumes também não medem incidência na população.
                </p>
              </article>
              <article>
                <h3>Valor aprovado ≠ custo</h3>
                <p>
                  Valores nominais aprovados das AIHs normais, sem correção
                  inflacionária; não medem o custo econômico integral da
                  assistência.
                </p>
              </article>
              <article>
                <h3>Rankings são descritivos</h3>
                <p>
                  Não há ajuste por gravidade ou perfil assistencial; rankings
                  não avaliam a qualidade dos hospitais.
                </p>
              </article>
              <article>
                <h3>Território</h3>
                <p>
                  Residência e internação são dimensões diferentes. Residências
                  fora do RJ ou ignoradas integram os totais, mas não aparecem
                  no mapa. A malha histórica pode não refletir limites recentes.
                </p>
              </article>
              <article>
                <h3>Competência de processamento</h3>
                <p>
                  O período corresponde ao mês de processamento da AIH, que pode
                  diferir do mês de internação ou alta.
                </p>
              </article>
            </div>
          </Section>
          <Section
            id="m-fontes"
            index={8}
            title="Fontes e reprodução"
            lead="Tudo é reproduzível a partir de fontes públicas; o site não depende de API, banco ou backend."
          >
            <ul className="sources">
              <li>
                <a
                  href="https://datasus.saude.gov.br/acesso-a-informacao/producao-hospitalar-sih-sus/"
                  target="_blank"
                  rel="noreferrer"
                >
                  SIH/SUS — DATASUS ↗
                </a>
                <span>{manifest?.source ?? "AIH reduzida (RD)"}</span>
              </li>
              <li>
                <a
                  href="https://tabnet.datasus.gov.br/cgi/sih/midescr.htm"
                  target="_blank"
                  rel="noreferrer"
                >
                  Notas técnicas DATASUS ↗
                </a>
                <span>Descrição das variáveis e regras do sistema</span>
              </li>
              <li>
                <a
                  href="https://pysus.readthedocs.io/en/latest/"
                  target="_blank"
                  rel="noreferrer"
                >
                  PySUS ↗
                </a>
                <span>Leitor dos arquivos DBC{pysus ? ` · ${pysus}` : ""}</span>
              </li>
              <li>
                <a
                  href="https://github.com/tbrugz/geodata-br"
                  target="_blank"
                  rel="noreferrer"
                >
                  Malha municipal ↗
                </a>
                <span>
                  {manifest?.geography_source ?? "IBGE · geodata-br (CC0)"}
                </span>
              </li>
              {reference && (
                <li>
                  <a href={reference.source_url}>Tabela CNES (TAB_SIH) ↗</a>
                  <span>
                    {format(reference.name_count)} nomes
                    {reference.sha256 &&
                      ` · SHA-256 ${reference.sha256.slice(0, 12)}…`}
                  </span>
                </li>
              )}
              <li>
                <a
                  href={`${import.meta.env.BASE_URL}data/manifest.json`}
                  download
                >
                  Metadados (manifest.json) ↓
                </a>
                <span>
                  Cobertura, auditoria e hashes de cada arquivo extraído
                </span>
              </li>
            </ul>
            <pre className="commands">
              <code>{`python etl/main.py --start-year 2020 --end-year 2025 --source origin-curl
cd frontend && npm ci && npm run build`}</code>
            </pre>
          </Section>
        </div>
      </div>
    </div>
  );
}
