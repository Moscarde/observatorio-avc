import { Chart, Empty } from "./Chart";
import { StepHead, Tip } from "./Guide";
import { format, group, metrics, typeColors } from "../lib/analytics";
import { images } from "../lib/media";
import type { Manifest, Row } from "../types/data";
function bars(
  labels: string[],
  values: number[],
  horizontal = true,
  colors?: string[],
) {
  return {
    grid: {
      left: horizontal ? 160 : 44,
      right: 40,
      top: 16,
      bottom: 38,
    },
    tooltip: { trigger: "axis", renderMode: "richText" },
    xAxis: horizontal
      ? {
          type: "value",
          min: 0,
          splitLine: { show: false },
          axisLabel: { fontSize: 12, formatter: (v: number) => format(v) },
        }
      : {
          type: "category",
          data: labels,
          axisTick: { show: false },
          axisLabel: { fontSize: 12 },
          axisLine: { lineStyle: { color: "#d8e1df" } },
        },
    yAxis: horizontal
      ? {
          type: "category",
          data: labels,
          inverse: true,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { fontSize: 12, color: "#516b62" },
        }
      : {
          type: "value",
          min: 0,
          splitLine: { lineStyle: { color: "#edf1ef" } },
          axisLabel: { fontSize: 12, formatter: (v: number) => format(v) },
        },
    series: [
      {
        type: "bar",
        data: values,
        barMaxWidth: horizontal ? 17 : 30,
        itemStyle: {
          color: colors
            ? (p: { dataIndex: number }) => colors[p.dataIndex]
            : "#2f7d66",
          borderRadius: horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0],
        },
        label: {
          show: horizontal,
          position: "right",
          fontSize: 12,
          color: "#47665a",
          formatter: (p: { value: number }) => format(p.value),
        },
      },
    ],
  };
}
export function Profile({
  rows,
  manifest,
}: {
  rows: Row[];
  manifest: Manifest;
}) {
  const types = group(rows, (r) => manifest.types[r.cid.slice(0, 3)]);
  const ages = group(rows, (r) => r.age);
  const sexes = group(rows, (r) => r.sex);
  const cids = group(rows, (r) => r.cid);
  const m = metrics(rows);
  return (
    <section id="perfil">
      <StepHead
        step="4"
        label="Perfil das internações"
        title="Quem está nos registros"
        question="Tipo de AVC, idade, sexo e diagnóstico detalhado no mesmo recorte dos filtros."
      />
      <Tip>
        Barras mostram contagens de internações, não pacientes. Use os filtros
        de sexo, idade ou tipo para ver como os demais gráficos mudam; o filtro
        selecionado aparecerá concentrado em uma única categoria.
      </Tip>
      <div className="stroke-types">
        <figure>
          <img
            src={images.arteries.src}
            alt={images.arteries.alt}
            loading="lazy"
          />
          <figcaption>
            Artérias da base do encéfalo. Gravura de{" "}
            <a href={images.arteries.page} target="_blank" rel="noreferrer">
              {images.arteries.credit}
            </a>{" "}
            · {images.arteries.license}.
          </figcaption>
        </figure>
        <div className="stroke-types-text">
          <span className="eyebrow">Para entender as categorias</span>
          <h3>Dois mecanismos, a mesma urgência</h3>
          <dl>
            <div style={{ borderColor: typeColors["Isquêmico"] }}>
              <dt>Isquêmico · I63</dt>
              <dd>
                Uma artéria é obstruída e parte do cérebro deixa de receber
                sangue.
              </dd>
            </div>
            <div style={{ borderColor: typeColors["Hemorrágico"] }}>
              <dt>Hemorrágico · I60, I61</dt>
              <dd>
                Um vaso se rompe e há sangramento dentro ou ao redor do cérebro.
              </dd>
            </div>
            <div
              style={{ borderColor: typeColors["Outras hemorragias (I62)"] }}
            >
              <dt>Outras hemorragias · I62</dt>
              <dd>
                Hemorragias intracranianas não traumáticas, mantidas à parte por
                suas diferenças clínicas.
              </dd>
            </div>
            <div style={{ borderColor: typeColors["Não especificado"] }}>
              <dt>Não especificado · I64</dt>
              <dd>
                O registro não informa se o AVC foi isquêmico ou hemorrágico — a
                categoria mais frequente nesta base.
              </dd>
            </div>
          </dl>
        </div>
      </div>
      <div className="profile-grid">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Classificação de AVC</h3>
              <p>Diagnóstico principal · I60–I64</p>
            </div>
          </div>
          {rows.length ? (
            <Chart
              className="profile-chart"
              label="Distribuição por classificação de AVC"
              option={bars(
                types.map((r) => r.name),
                types.map((r) => r.n),
                true,
                types.map((r) => typeColors[r.name] ?? "#8c9a94"),
              )}
            />
          ) : (
            <Empty detail="I62 é apresentado separadamente." />
          )}
        </div>
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Faixa etária</h3>
              <p>
                Idade média: {format(m.meanAge, 1)}{" "}
                {m.meanAge === null ? "" : "anos"} · unidades convertidas
              </p>
            </div>
          </div>
          {rows.length ? (
            <Chart
              className="profile-chart"
              label="Internações por faixa etária"
              option={bars(
                manifest.ages,
                manifest.ages.map(
                  (a) => ages.find((r) => r.name === a)?.n ?? 0,
                ),
                false,
              )}
            />
          ) : (
            <Empty detail="Faixas calculadas a partir de COD_IDADE + IDADE." />
          )}
        </div>
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Sexo registrado</h3>
              <p>Inclui registros ignorados</p>
            </div>
          </div>
          {rows.length ? (
            <div className="sex-list">
              {sexes.map((r) => (
                <div key={r.name}>
                  <span>{r.name}</span>
                  <strong>
                    {format(r.n)}
                    <small>{format((r.n / m.n) * 100, 1)}%</small>
                  </strong>
                  <div className="rank-bar">
                    <i style={{ width: `${(r.n / m.n) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty detail="Codificação SIH: 1 masculino, 3 feminino." />
          )}
        </div>
      </div>
      <div className="panel cid-panel">
        <div>
          <h3>Diagnósticos CID-10</h3>
          <p>
            Agrupados pela categoria de três caracteres. Subcategorias com o
            código original preservado aparecem abaixo de cada grupo.
          </p>
        </div>
        <div className="cid-groups">
          {Object.entries(manifest.cid_labels).map(([cid, label]) => {
            const items = cids.filter((r) => r.name.slice(0, 3) === cid);
            const total = items.reduce((n, r) => n + r.n, 0);
            return (
              <div className="cid-group" key={cid}>
                <div className="cid-group-head">
                  <span
                    className="cid-code"
                    style={{ background: typeColors[manifest.types[cid]] }}
                  >
                    {cid}
                  </span>
                  <span>
                    {label}
                    <small>{manifest.types[cid]}</small>
                  </span>
                  <strong>
                    {cids.length ? format(total) : "—"}
                    {cids.length > 0 && m.n > 0 && (
                      <small>{format((total / m.n) * 100, 1)}%</small>
                    )}
                  </strong>
                </div>
                <div className="rank-bar">
                  <i
                    style={{
                      width: m.n ? `${(total / m.n) * 100}%` : 0,
                      background: typeColors[manifest.types[cid]],
                    }}
                  />
                </div>
                {items.length > 0 && (
                  <ul className="cid-list">
                    {items.map((r) => (
                      <li key={r.name}>
                        <span>{r.name}</span>
                        <strong>{format(r.n)}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
