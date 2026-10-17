import { useEffect, useMemo, useState } from "react";
import { ActiveFilters, Filters as FilterPanel } from "./components/Filters";
import { Geography } from "./components/Geography";
import { Timeline } from "./components/Timeline";
import { Profile } from "./components/Profile";
import { Hospitals } from "./components/Hospitals";
import { Methodology } from "./components/Methodology";
import { SectionNav, StepHead } from "./components/Guide";
import { useData } from "./hooks/useData";
import { images } from "./lib/media";
import { currency, filterRows, format, metrics, months } from "./lib/analytics";
import type { Filters } from "./types/data";
const initial: Filters = {
  start: "2020-01",
  end: "2025-12",
  municipality: "",
  dimension: "residence",
  sex: "",
  age: "",
  type: "",
};
function Brand() {
  return (
    <a className="brand" href="#/">
      <span className="brand-icon" aria-hidden="true">
        <svg viewBox="0 0 32 32">
          <path d="M3 17h6l4-9 6 17 4-8h6" />
        </svg>
      </span>
      <span>
        Observatório <strong>de AVC</strong>
        <small>RIO DE JANEIRO</small>
      </span>
    </a>
  );
}
function useRoute() {
  const [hash, setHash] = useState(() => location.hash);
  useEffect(() => {
    const onHash = () => setHash(location.hash);
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);
  const methodology = hash.startsWith("#/metodologia");
  // Troca de página ou "#/" volta ao topo; âncoras de seção mantêm a rolagem nativa.
  useEffect(() => {
    if (methodology || hash === "#/") scrollTo({ top: 0, behavior: "instant" });
  }, [methodology, hash]);
  return methodology ? "methodology" : "dashboard";
}
export default function App() {
  const { data, error, reload } = useData();
  const route = useRoute();
  const [filters, setFilters] = useState<Filters>(initial);
  const rows = useMemo(
    () => (data ? filterRows(data.rows, filters, data.manifest.types) : []),
    [data, filters],
  );
  const m = metrics(rows);
  const overall = useMemo(
    () =>
      data
        ? {
            ...metrics(data.rows),
            hospitals: new Set(
              data.rows.map((r) => r.hospital).filter((h) => h !== "unknown"),
            ).size,
          }
        : null,
    [data],
  );
  const periods = months(filters.start, filters.end);
  const coverage =
    data?.manifest.coverage.filter((p) => periods.includes(p)) ?? [];
  const hasCoverage = coverage.length > 0;
  const values: [string, string, string, string][] = [
    [
      "Internações registradas",
      hasCoverage ? format(m.n) : "—",
      "AIHs normais aprovadas",
      "Cada AIH é uma internação registrada, não um paciente único.",
    ],
    [
      "Óbitos hospitalares",
      hasCoverage ? format(m.deaths) : "—",
      "Desfechos registrados",
      "Óbitos ocorridos durante a internação.",
    ],
    [
      "Mortalidade hospitalar",
      format(m.mortality, 1) + (m.mortality === null ? "" : "%"),
      "Óbitos / desfechos conhecidos",
      "Proporção hospitalar; não é mortalidade da população.",
    ],
    [
      "Permanência média",
      format(m.stay, 1) + (m.stay === null ? "" : " dias"),
      "Registros com permanência válida",
      "Média de dias entre internação e saída.",
    ],
    [
      "Valor total aprovado",
      m.value_n ? currency(m.cents / 100) : "—",
      "AIHs normais · reais nominais",
      "Valor pago pelo SUS; não é o custo integral.",
    ],
  ];
  const selectMunicipality = (code: string) =>
    setFilters((f) => ({
      ...f,
      municipality: f.municipality === code ? "" : code,
    }));
  const place = filters.municipality
    ? `${data?.manifest.municipalities[filters.municipality] ?? filters.municipality} (${filters.dimension === "residence" ? "residência" : "internação"})`
    : "no estado do Rio de Janeiro";
  const content = error ? (
    <section className="error-state" role="alert">
      <h2>Não foi possível carregar os dados</h2>
      <p>{error}</p>
      <button className="action" onClick={reload}>
        Tentar novamente
      </button>
    </section>
  ) : !data ? (
    <section className="loading" role="status">
      <div className="loading-line" />
      <p>Carregando o observatório…</p>
    </section>
  ) : (
    <>
      {data.manifest.status !== "complete" && (
        <aside className="coverage-notice" role="status">
          <span aria-hidden="true">ⓘ</span>
          <div>
            <strong>
              {data.manifest.status === "unavailable"
                ? "Dados de internação ainda não disponíveis"
                : "Cobertura parcial dos dados"}
            </strong>
            <p>
              {data.manifest.status === "unavailable"
                ? "A coleta do SIH/SUS não foi concluída neste ambiente. O mapa mostra apenas a malha territorial; os indicadores permanecem sem valores."
                : `${data.manifest.coverage.length} competências extraídas. Lacunas não são preenchidas ou estimadas.`}
            </p>
          </div>
          <a href="#/metodologia">Sobre os dados →</a>
        </aside>
      )}
      <FilterPanel
        value={filters}
        onChange={setFilters}
        manifest={data.manifest}
        municipalityCodes={[
          ...new Set(data.rows.map((row) => row[filters.dimension])),
        ]}
        onReset={() => setFilters(initial)}
      />
      <div className="context-bar">
        <ActiveFilters
          value={filters}
          onChange={setFilters}
          manifest={data.manifest}
          municipalityCodes={[
            ...new Set(data.rows.map((row) => row[filters.dimension])),
          ]}
          defaults={initial}
          available={coverage.length}
          expected={periods.length}
        />
        <SectionNav />
      </div>
      <section className="overview" id="visao-geral">
        <StepHead
          step="1"
          label="Visão geral"
          title="O recorte em cinco números"
          question="Indicadores calculados sobre todas as internações que atendem aos filtros."
        />
        {hasCoverage && m.n > 0 && (
          <p className="summary-sentence">
            Entre {filters.start.split("-").reverse().join("/")} e{" "}
            {filters.end.split("-").reverse().join("/")}, foram registradas{" "}
            <strong>{format(m.n)} internações por AVC</strong> {place}, com{" "}
            <strong>{format(m.deaths)} óbitos hospitalares</strong>
            {m.mortality !== null && (
              <>
                {" "}
                — {format(m.mortality, 1)}% das internações com desfecho
                conhecido
              </>
            )}
            . Em média, cada internação durou {format(m.stay, 1)} dias.
          </p>
        )}
        <div className="kpi-grid" role="list" aria-label="Indicadores gerais">
          {values.map(([label, value, note, help], index) => (
            <article className="kpi" key={label} role="listitem">
              <span>{label}</span>
              <strong
                className={index === 0 ? "accent" : index < 3 ? "warm" : ""}
              >
                {value}
              </strong>
              <small>{note}</small>
              <p>{help}</p>
            </article>
          ))}
        </div>
        {hasCoverage &&
          (m.death_n < m.n ||
            m.age_n < m.n ||
            m.days_n < m.n ||
            m.value_n < m.n) && (
            <p className="quality-note">
              Registros válidos no recorte: desfecho {format(m.death_n)}/
              {format(m.n)} · idade {format(m.age_n)}/{format(m.n)} ·
              permanência {format(m.days_n)}/{format(m.n)} · valor{" "}
              {format(m.value_n)}/{format(m.n)}. Ausentes não entram nas
              respectivas médias ou taxas.
            </p>
          )}
      </section>
      <div className="central-grid">
        <Geography
          rows={rows}
          geo={data.geo}
          manifest={data.manifest}
          filters={filters}
          onSelect={selectMunicipality}
          hasCoverage={hasCoverage}
        />
        <Timeline rows={rows} filters={filters} manifest={data.manifest} />
      </div>
      <Profile rows={rows} manifest={data.manifest} />
      <Hospitals rows={rows} manifest={data.manifest} />
      <section className="reading-notes" id="notas">
        <StepHead
          step="6"
          label="Notas de leitura"
          title="Antes de tirar conclusões"
          question="Dados abertos pedem interpretação responsável. Estes são os pontos essenciais."
          aside={
            <a className="action" href="#/metodologia">
              Ver metodologia completa →
            </a>
          }
        />
        <div className="notes-grid">
          <article>
            <h3>Fonte e abrangência</h3>
            <p>
              Arquivos reduzidos de AIH (RD) do SIH/SUS para o RJ, competências
              de processamento de 2020 a 2025. AIHs normais (IDENT=1), com
              diagnóstico principal I60, I61, I62, I63 ou I64. G45 e I69 são
              excluídos. I62 aparece separadamente por suas diferenças clínicas.
            </p>
          </article>
          <article>
            <h3>A unidade é a internação registrada</h3>
            <p>
              AIHs não representam pacientes únicos. Transferências,
              reinternações e reapresentações podem gerar registros adicionais.
              Prorrogações são excluídas de todos os indicadores deste
              observatório. Os valores aprovados se referem apenas às AIHs
              normais.
            </p>
          </article>
          <article>
            <h3>As comparações têm limites</h3>
            <p>
              Mortalidade hospitalar é a proporção de óbitos entre registros com
              desfecho conhecido; não é mortalidade populacional. Volumes não
              medem incidência. Valores nominais aprovados não medem o custo
              econômico integral. Rankings não avaliam qualidade dos hospitais.
            </p>
          </article>
          <article>
            <h3>Território e cobertura</h3>
            <p>
              Residência e internação são dimensões diferentes. O universo é o
              arquivo RJ, não todas as internações de residentes do RJ em outros
              estados. A malha histórica do IBGE é redistribuída pelo geodata-br
              (CC0). Municípios externos ou ignorados podem integrar os totais e
              não aparecer no mapa. Lacunas não são tratadas como zero.
            </p>
          </article>
        </div>
        <p className="update-line">
          Atualização:{" "}
          {data.manifest.status !== "unavailable" && data.manifest.generated_at
            ? new Date(data.manifest.generated_at).toLocaleDateString("pt-BR")
            : "coleta pendente"}{" "}
          ·{" "}
          <a href={`${import.meta.env.BASE_URL}data/manifest.json`} download>
            Metadados ↓
          </a>
        </p>
      </section>
    </>
  );
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="site-header">
        <div className="shell header-inner">
          <Brand />
          <nav className="main-nav" aria-label="Navegação principal">
            <a
              href="#/"
              aria-current={route === "dashboard" ? "page" : undefined}
            >
              Painel
            </a>
            <a
              href="#/metodologia"
              aria-current={route === "methodology" ? "page" : undefined}
            >
              Metodologia
            </a>
          </nav>
          <a
            className="source-link"
            href="https://datasus.saude.gov.br/acesso-a-informacao/producao-hospitalar-sih-sus/"
            target="_blank"
            rel="noreferrer"
          >
            SIH / SUS ↗
          </a>
        </div>
      </header>
      <main id="conteudo">
        {route === "methodology" ? (
          <div className="shell">
            {error ? (
              content
            ) : (
              <Methodology manifest={data?.manifest ?? null} />
            )}
          </div>
        ) : (
          <>
            <section className="hero">
              <img
                className="hero-photo"
                src={images.hero.src}
                srcSet={`${images.hero.small} 1200w, ${images.hero.src} 2400w`}
                sizes="100vw"
                alt={images.hero.alt}
                fetchPriority="high"
              />
              <div className="shell hero-inner">
                <div className="hero-copy">
                  <span className="hero-kicker">
                    SIH/SUS · Estado do Rio de Janeiro · 2020–2025
                  </span>
                  <h1>Internações por AVC no Rio de Janeiro</h1>
                  <p>
                    Onde, quando e em quem o acidente vascular cerebral leva à
                    internação no SUS — e como a rede hospitalar responde. Um
                    painel aberto, feito com dados públicos do DATASUS.
                  </p>
                </div>
                <dl className="hero-stats">
                  <div>
                    <dt>internações registradas</dt>
                    <dd>{overall ? format(overall.n) : "—"}</dd>
                  </div>
                  <div className="warm">
                    <dt>óbitos hospitalares</dt>
                    <dd>{overall ? format(overall.deaths) : "—"}</dd>
                  </div>
                  <div>
                    <dt>municípios no mapa</dt>
                    <dd>{data?.geo ? data.geo.features.length : "—"}</dd>
                  </div>
                  <div>
                    <dt>estabelecimentos</dt>
                    <dd>{overall ? format(overall.hospitals) : "—"}</dd>
                  </div>
                </dl>
              </div>
              <a
                className="photo-credit"
                href={images.hero.page}
                target="_blank"
                rel="noreferrer"
              >
                Foto: {images.hero.credit} · {images.hero.license}
              </a>
            </section>
            <div className="shell">
              <ol className="how-to" aria-label="Como usar o painel">
                <li>
                  <span>1</span>
                  <div>
                    <strong>Defina o recorte</strong>
                    <p>
                      Escolha período, território e perfil. Tudo abaixo responde
                      aos mesmos filtros.
                    </p>
                  </div>
                </li>
                <li>
                  <span>2</span>
                  <div>
                    <strong>Explore as seções</strong>
                    <p>
                      Visão geral, mapa, série histórica, perfil e rede
                      hospitalar — cada uma com uma dica de leitura.
                    </p>
                  </div>
                </li>
                <li>
                  <span>3</span>
                  <div>
                    <strong>Interprete com cuidado</strong>
                    <p>
                      AIHs não são pacientes únicos. Veja as{" "}
                      <a href="#/metodologia">regras de coleta e tratamento</a>.
                    </p>
                  </div>
                </li>
              </ol>
              {content}
            </div>
          </>
        )}
      </main>
      <footer className="site-footer">
        <div className="shell">
          <span>
            Observatório de AVC <span className="separator">/</span> Rio de
            Janeiro
          </span>
          <span>
            <a href="#/metodologia">Metodologia</a>{" "}
            <span className="separator">/</span> Dados públicos. Conhecimento
            compartilhado.
          </span>
          <span className="credits">
            Imagens:{" "}
            {Object.values(images).map((image, index) => (
              <span key={image.page}>
                {index > 0 && " · "}
                <a href={image.page} target="_blank" rel="noreferrer">
                  {image.credit}
                </a>{" "}
                ({image.license})
              </span>
            ))}{" "}
            · Wikimedia Commons. Tipografia IBM Plex (OFL).
          </span>
        </div>
      </footer>
    </>
  );
}
