import type { Filters, Measures, Quality, Row } from "../types/data.ts";
// Cores fixas por classificação, compartilhadas por gráficos e legendas.
export const typeColors: Record<string, string> = {
  Isquêmico: "#1f7a63",
  Hemorrágico: "#d4553a",
  "Outras hemorragias (I62)": "#e09a2d",
  "Não especificado": "#8c9a94",
};
export const measureKeys = [
  "n",
  "deaths",
  "death_n",
  "days",
  "days_n",
  "cents",
  "value_n",
  "age_sum",
  "age_n",
] as const;
export const empty = (): Measures => ({
  n: 0,
  deaths: 0,
  death_n: 0,
  days: 0,
  days_n: 0,
  cents: 0,
  value_n: 0,
  age_sum: 0,
  age_n: 0,
});
export function sum(rows: Row[]): Measures {
  const result = empty();
  for (const row of rows)
    for (const key of measureKeys) result[key] += row[key];
  return result;
}
export const ratio = (numerator: number, denominator: number) =>
  denominator > 0 ? numerator / denominator : null;
export function metrics(rows: Row[]) {
  const m = sum(rows);
  return {
    ...m,
    mortality: ratio(m.deaths * 100, m.death_n),
    stay: ratio(m.days, m.days_n),
    meanAge: ratio(m.age_sum, m.age_n),
    meanValue: ratio(m.cents / 100, m.value_n),
  };
}
export function filterRows(
  rows: Row[],
  f: Filters,
  types: Record<string, string>,
) {
  return rows.filter(
    (r) =>
      r.period >= f.start &&
      r.period <= f.end &&
      (!f.municipality || r[f.dimension] === f.municipality) &&
      (!f.sex || r.sex === f.sex) &&
      (!f.age || r.age === f.age) &&
      (!f.type || types[r.cid.slice(0, 3)] === f.type),
  );
}
export function group(rows: Row[], key: (r: Row) => string) {
  const buckets = new Map<string, Row[]>();
  for (const r of rows) {
    const k = key(r);
    const list = buckets.get(k) ?? [];
    list.push(r);
    buckets.set(k, list);
  }
  return [...buckets]
    .map(([name, values]) => ({ name, ...metrics(values) }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}
export function months(start: string, end: string) {
  const result: string[] = [];
  let [year, month] = start.split("-").map(Number);
  while (`${year}-${String(month).padStart(2, "0")}` <= end) {
    result.push(`${year}-${String(month).padStart(2, "0")}`);
    if (++month > 12) {
      month = 1;
      year++;
    }
  }
  return result;
}
export const format = (value: number | null, digits = 0) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      }).format(value);
export const currency = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(value);
export const qualityKeys = [
  "source_rows",
  "stroke_normal_rows",
  "duplicate_rows",
  "invalid_dates",
  "missing_age",
  "missing_death",
  "missing_days",
  "missing_value",
] as const;
// Soma auditorias mensais por ano; competências ausentes ficam fora, sem virar zero.
export function qualityByYear(quality: Record<string, Quality> = {}) {
  const years = new Map<string, Quality & { periods: number }>();
  for (const [period, audit] of Object.entries(quality).sort()) {
    const year = period.slice(0, 4);
    const total = years.get(year) ?? {
      periods: 0,
      ...(Object.fromEntries(
        qualityKeys.map((k) => [k, 0]),
      ) as unknown as Quality),
    };
    total.periods++;
    for (const key of qualityKeys) total[key] += audit[key] ?? 0;
    years.set(year, total);
  }
  return [...years].map(([year, total]) => ({ year, ...total }));
}
