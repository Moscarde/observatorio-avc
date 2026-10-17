import { useMemo } from "react";
import * as echarts from "../lib/charts";
import { Chart, Empty } from "./Chart";
import { StepHead, Tip } from "./Guide";
import { format, group } from "../lib/analytics";
import type { Filters, GeoJSON, Manifest, Row } from "../types/data";
export function Geography({
  rows,
  geo,
  manifest,
  filters,
  onSelect,
  hasCoverage,
}: {
  rows: Row[];
  geo: GeoJSON | null;
  manifest: Manifest;
  filters: Filters;
  onSelect: (name: string) => void;
  hasCoverage: boolean;
}) {
  const ranking = useMemo(
    () => group(rows, (r) => r[filters.dimension]),
    [rows, filters.dimension],
  );
  const lookup = new Map(ranking.map((r) => [r.name, r.n]));
  const option = useMemo(() => {
    if (!geo) return {};
    echarts.registerMap("RJ", geo);
    const max = Math.max(1, ...ranking.map((r) => r.n));
    return {
      tooltip: {
        trigger: "item",
        renderMode: "richText",
        formatter: (p: { name: string; value: number }) =>
          `${manifest.municipalities[p.name] ?? p.name}\n${hasCoverage ? format(Number.isFinite(p.value) ? p.value : 0) + " internações" : "Dados de saúde indisponíveis"}`,
      },
      visualMap: hasCoverage
        ? {
            min: 0,
            max,
            calculable: false,
            orient: "horizontal",
            left: "center",
            bottom: 2,
            inRange: { color: ["#e9f0ee", "#c1ded4", "#6cac96", "#1a6b58"] },
            text: ["Mais internações", "Menos"],
            textStyle: { fontSize: 12, color: "#68817d" },
            itemWidth: 12,
            itemHeight: 150,
          }
        : undefined,
      series: [
        {
          type: "map",
          map: "RJ",
          roam: true,
          scaleLimit: { min: 1, max: 4 },
          layoutCenter: ["50%", "47%"],
          layoutSize: "95%",
          selectedMode: "single",
          data: geo.features.map((f) => ({
            name: f.properties.name,
            value: hasCoverage ? (lookup.get(f.properties.name) ?? 0) : null,
            selected: f.properties.name === filters.municipality,
          })),
          label: { show: false },
          itemStyle: {
            areaColor: "#dfe9e5",
            borderColor: "#ffffff",
            borderWidth: 1,
          },
          emphasis: {
            label: {
              show: true,
              formatter: (p: { name: string }) =>
                manifest.municipalities[p.name],
              fontSize: 12,
              color: "#173f34",
            },
            itemStyle: { areaColor: "#91c6b0" },
          },
          select: {
            label: { show: false },
            itemStyle: {
              areaColor: "#d4553a",
              borderColor: "#7a2a18",
              borderWidth: 2,
            },
          },
        },
      ],
    };
  }, [geo, ranking, manifest, hasCoverage, filters.municipality]);
  return (
    <section className="panel geography" id="territorio">
      <StepHead
        step="2"
        label="Território"
        title="Onde as internações se concentram"
        question={`Volume absoluto de internações por município de ${filters.dimension === "residence" ? "residência do paciente" : "internação (onde fica o hospital)"}.`}
        aside={<span className="small-tag">92 municípios</span>}
      />
      <div className="map-content">
        <div className="map-wrap">
          {geo ? (
            <Chart
              className="map-chart"
              label="Mapa municipal do Rio de Janeiro. Selecione um município para filtrar."
              option={option}
              onClick={onSelect}
            />
          ) : (
            <Empty
              message="Malha geográfica indisponível."
              detail="Execute o ETL para obter a malha municipal."
            />
          )}
          <span className="map-ocean" aria-hidden="true">
            OCEANO ATLÂNTICO
          </span>
          {!hasCoverage && (
            <span className="map-status">
              Malha territorial · sem dados de saúde
            </span>
          )}
        </div>
        <div className="municipal-ranking">
          <span className="eyebrow">Top 5 municípios</span>
          {ranking.length ? (
            ranking.slice(0, 5).map((r, index) => (
              <button
                className="rank-item"
                key={r.name}
                onClick={() => onSelect(r.name)}
              >
                <span className="rank-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <span>
                    {manifest.municipalities[r.name] ?? `Código ${r.name}`}
                  </span>
                  <div className="rank-bar">
                    <i style={{ width: `${(r.n / ranking[0].n) * 100}%` }} />
                  </div>
                </div>
                <strong>{format(r.n)}</strong>
              </button>
            ))
          ) : (
            <div className="ranking-empty">
              <span>—</span>
              <p>O ranking aparecerá após a coleta das AIHs.</p>
            </div>
          )}
          <p className="map-hint">
            Clique no mapa ou no ranking para filtrar todo o painel por um
            município; clique de novo para desfazer. Arraste ou use a roda do
            mouse para navegar no mapa.
          </p>
        </div>
      </div>
      <Tip>
        Cores mais escuras indicam mais internações registradas. Municípios
        populosos tendem a concentrar volume; o mapa não mede risco nem
        incidência. Troque “Território” nos filtros para comparar residência e
        local de atendimento.
      </Tip>
      <div className="panel-foot">
        Malha: IBGE via geodata-br · volumes não representam incidência
        populacional.
      </div>
    </section>
  );
}
