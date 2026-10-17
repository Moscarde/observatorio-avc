import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filterRows,
  group,
  metrics,
  months,
  qualityByYear,
} from "../src/lib/analytics.ts";
import type { Filters, Row } from "../src/types/data.ts";
const base: Row = {
  period: "2025-01",
  residence: "330455",
  hospital_city: "330330",
  hospital: "0012345",
  sex: "Feminino",
  age: "60–69",
  cid: "I639",
  n: 10,
  deaths: 2,
  death_n: 10,
  days: 80,
  days_n: 10,
  cents: 120015,
  value_n: 10,
  age_sum: 650,
  age_n: 10,
};
const rows = [
  base,
  {
    ...base,
    period: "2025-02",
    sex: "Masculino",
    age: "70–79",
    n: 1,
    deaths: 1,
    death_n: 1,
    days: 20,
    days_n: 1,
    cents: 20000,
    value_n: 1,
    age_sum: 75,
    age_n: 1,
  },
  {
    ...base,
    residence: "330170",
    hospital: "0098765",
    cid: "I629",
    n: 3,
    deaths: 0,
    death_n: 2,
    days: 0,
    days_n: 0,
    cents: 0,
    value_n: 0,
    age_sum: 0,
    age_n: 0,
  },
];
const filters: Filters = {
  start: "2025-01",
  end: "2025-12",
  municipality: "",
  dimension: "residence",
  sex: "",
  age: "",
  type: "",
};
const types = { I63: "Isquêmico", I62: "Outras hemorragias (I62)" };
test("Combined filters select exactly the shared cohort", () => {
  const selected = filterRows(
    rows,
    {
      ...filters,
      municipality: "330455",
      sex: "Feminino",
      age: "60–69",
      type: "Isquêmico",
    },
    types,
  );
  assert.deepEqual(selected, [base]);
  assert.equal(metrics(selected).n, 10);
  assert.equal(group(selected, (r) => r.hospital)[0].n, 10);
});
test("Residence and hospital municipality are distinct", () => {
  assert.equal(
    filterRows(rows, { ...filters, municipality: "330330" }, types).length,
    0,
  );
  assert.equal(
    filterRows(
      rows,
      { ...filters, municipality: "330330", dimension: "hospital_city" },
      types,
    ).length,
    3,
  );
});
test("Rates and averages are weighted from additive measures", () => {
  const m = metrics(rows);
  assert.equal(m.n, 14);
  assert.equal(m.deaths, 3);
  assert.equal(m.mortality, (3 / 13) * 100);
  assert.equal(m.stay, 100 / 11);
  assert.equal(m.meanAge, 725 / 11);
  assert.equal(m.meanValue, 1400.15 / 11);
  assert.notEqual(m.mortality, (20 + 100 + 0) / 3);
});
test("Unknown denominators never become zero-valued rates", () => {
  const m = metrics([]);
  assert.equal(m.mortality, null);
  assert.equal(m.stay, null);
  assert.equal(m.meanAge, null);
  assert.equal(m.meanValue, null);
});
test("Time filtering is inclusive and months include gaps", () => {
  assert.equal(
    filterRows(rows, { ...filters, start: "2025-02", end: "2025-02" }, types)
      .length,
    1,
  );
  assert.deepEqual(months("2024-12", "2025-02"), [
    "2024-12",
    "2025-01",
    "2025-02",
  ]);
});
test("Grouped totals conserve the filtered cohort", () => {
  for (const dimension of [
    "period",
    "cid",
    "sex",
    "age",
    "hospital",
    "residence",
    "hospital_city",
  ] as const) {
    assert.equal(
      group(rows, (r) => r[dimension]).reduce((n, r) => n + r.n, 0),
      metrics(rows).n,
    );
  }
});
test("Quality audits are summed by year without inventing missing periods", () => {
  const audit = {
    source_rows: 100,
    stroke_normal_rows: 3,
    duplicate_rows: 0,
    invalid_dates: 1,
    missing_age: 2,
    missing_death: 0,
    missing_days: 0,
    missing_value: 0,
  };
  const years = qualityByYear({
    "2021-02": { ...audit, source_rows: 50 },
    "2020-12": audit,
    "2021-01": audit,
  });
  assert.deepEqual(
    years.map((y) => [y.year, y.periods, y.source_rows, y.missing_age]),
    [
      ["2020", 1, 100, 2],
      ["2021", 2, 150, 4],
    ],
  );
  assert.deepEqual(qualityByYear(undefined), []);
});
