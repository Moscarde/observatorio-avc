import { useMemo, useState } from "react";
import { Chart, Empty } from "./Chart";
import { StepHead, Tip } from "./Guide";
import { format, group, months } from "../lib/analytics";
import type { Filters, Manifest, Row } from "../types/data";
export function Timeline({
  rows,
  filters,
  manifest,
}: {
  rows: Row[];
  filters: Filters;
  manifest: Manifest;
}) {
  const [metric, setMetric] = useState<"n" | "deaths" | "mortality">("n");
  const [annual, setAnnual] = useState(false);
  const option = useMemo(() => {
    const periods = months(filters.start, filters.end);
    const keys = annual
      ? [...new Set(periods.map((p) => p.slice(0, 4)))]
      : periods;
    const values = new Map(
      group(rows, (r) => (annual ? r.period.slice(0, 4) : r.period)).map(
        (r) => [r.name, r],
      ),
    );
    const covered = new Set(manifest.coverage);
    const series = keys.map((key) => {
      const expected = periods.filter((p) => p.startsWith(key));
      if (!expected.every((p) => covered.has(p))) return null;
      const value = values.get(key);
      return value?.[metric] ?? (metric === "mortality" ? null : 0);
    });
    const color = metric === "n" ? "#1f7a63" : "#d4553a";
    return {
      grid: { left: 52, right: 22, top: 26, bottom: 52 },
      tooltip: {
        trigger: "axis",
        renderMode: "richText",
        valueFormatter: (value: number | null) =>
          value === null
            ? "Sem cobertura"
            : format(value, metric === "mortality" ? 1 : 0) +
              (metric === "mortality" ? "%" : ""),
      },
      xAxis: {
        type: "category",
        data: keys,
        axisLine: { lineStyle: { color: "#d8e1df" } },
        axisTick: { show: false },
        axisLabel: {
          color: "#6d807d",
          fontSize: 12,
          formatter: (v: string) =>
            annual
              ? v
              : v.endsWith("-01")
                ? v.slice(0, 4)
                : v.slice(5) + "/" + v.slice(2, 4),
        },
      },
      yAxis: {
        type: "value",
        min: 0,
        axisLabel: {
          fontSize: 12,
          formatter: (v: number) =>
            format(v) + (metric === "mortality" ? "%" : ""),
        },
        splitLine: { lineStyle: { color: "#e9efed", type: "dashed" } },
      },
      dataZoom: [
        { type: "inside" },
        {
          type: "slider",
          height: 14,
          bottom: 0,
          showDetail: false,
          borderColor: "transparent",
          fillerColor: "#d9ebe2",
          handleStyle: { color: "#1f7a63", borderColor: "#1f7a63" },
          moveHandleStyle: { color: "#1f7a63" },
          dataBackground: {
            lineStyle: { color: "#b7cfc4" },
            areaStyle: { color: "#e6efe9" },
          },
        },
      ],
      series: [
        {
          type: "line",
          data: series,
          smooth: false,
          connectNulls: false,
          showSymbol: annual,
          lineStyle: { width: 2.5, color },
          itemStyle: { color },
          areaStyle: { color, opacity: 0.08 },
        },
      ],
    };
  }, [rows, filters, manifest, metric, annual]);
  const has = manifest.coverage.some(
    (p) => p >= filters.start && p <= filters.end,
  );
  return (
    <section className="panel timeline" id="evolucao">
      <StepHead
        step="3"
        label="Evolução"
        title="Como o volume muda ao longo do tempo"
        question={`${
          metric === "mortality"
            ? "Óbitos / AIHs normais com desfecho conhecido (%)"
            : metric === "deaths"
              ? "Óbitos hospitalares registrados"
              : "AIHs normais aprovadas"
        } · por competência de processamento.`}
        aside={
          <div className="segmented compact" aria-label="Agregação temporal">
            <button aria-pressed={!annual} onClick={() => setAnnual(false)}>
              Mensal
            </button>
            <button aria-pressed={annual} onClick={() => setAnnual(true)}>
              Anual
            </button>
          </div>
        }
      />
      <div className="segmented metric-tabs" aria-label="Indicador da série">
        {(
          [
            ["n", "Internações"],
            ["deaths", "Óbitos"],
            ["mortality", "Mortalidade"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            aria-pressed={metric === key}
            onClick={() => setMetric(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {has ? (
        <Chart
          option={option}
          label={`Evolução ${annual ? "anual" : "mensal"} de ${metric === "n" ? "internações" : metric === "deaths" ? "óbitos" : "mortalidade hospitalar"}`}
        />
      ) : (
        <Empty
          message="Série histórica ainda indisponível."
          detail="Aguardando extração das competências de 2020 a 2025."
        />
      )}
      <Tip>
        Escolha o indicador nas abas e arraste a barra inferior para aproximar
        um intervalo. A competência é o mês de processamento da AIH, não
        necessariamente o mês da internação.
      </Tip>
      <div className="panel-foot">
        Lacunas permanecem vazias. Anos incompletos não recebem totais no
        gráfico anual.
      </div>
    </section>
  );
}
