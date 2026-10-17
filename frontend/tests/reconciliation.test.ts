import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { filterRows, measureKeys, metrics } from "../src/lib/analytics.ts";
import type { Filters, Manifest, Row } from "../src/types/data.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const localPython = join(root, ".venv/bin/python");
const python =
  process.env.PYTHON ?? (existsSync(localPython) ? localPython : "python3");
const data = join(root, "frontend/public/data");
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const manifest = read(join(data, "manifest.json")) as Manifest;
const rows: Row[] = manifest.files.flatMap((file) => {
  const cube = read(join(data, file.file)) as {
    columns: string[];
    rows: (string | number)[][];
  };
  return cube.rows.map(
    (values) =>
      Object.fromEntries(
        cube.columns.map((key, i) => [key, values[i]]),
      ) as unknown as Row,
  );
});
const initial: Filters = {
  start: "2020-01",
  end: "2025-12",
  municipality: "",
  dimension: "residence",
  sex: "",
  age: "",
  type: "",
};
const cases: [Partial<Filters>, string[]][] = [
  [{}, []],
  [
    {
      municipality: "330455",
      sex: "Feminino",
      type: "Isquêmico",
      start: "2024-01",
    },
    [
      "--residence",
      "330455",
      "--sex",
      "Feminino",
      "--cid",
      "I63",
      "--start-period",
      "2024-01",
    ],
  ],
  [
    { municipality: "330330", dimension: "hospital_city", age: "70–79" },
    ["--hospital-city", "330330", "--age", "70–79"],
  ],
];
const temporary = mkdtempSync(join(tmpdir(), "avc-reconciliation-"));
try {
  for (const [overrides, args] of cases) {
    execFileSync(
      python,
      ["-m", "etl.analytics", "--output", temporary, ...args],
      { cwd: root, timeout: 60000 },
    );
    const latest = read(join(temporary, "latest.json"));
    const sql = read(join(temporary, latest.run, "marts.json"))
      .mart_indicadores[0];
    const frontend = metrics(
      filterRows(rows, { ...initial, ...overrides }, manifest.types),
    );
    for (const measure of measureKeys) {
      const tolerance = measure === "age_sum" ? 0.00001 : 0;
      assert.ok(
        Math.abs(sql[measure] - frontend[measure]) <= tolerance,
        `Medida divergente: ${measure}`,
      );
    }
    for (const [sqlName, frontendName] of [
      ["hospital_mortality_pct", "mortality"],
      ["mean_stay_days", "stay"],
      ["mean_age_years", "meanAge"],
      ["mean_aih_value_brl", "meanValue"],
    ] as const) {
      const a = sql[sqlName] as number | null;
      const b = frontend[frontendName];
      if (a === null || b === null) assert.equal(a, b);
      else
        assert.ok(
          Math.abs(a - b) <= 0.000001,
          `Indicador divergente: ${sqlName}`,
        );
    }
  }
  console.log(
    "Reconciliação SQL ↔ TypeScript: três recortes, todas as medidas e indicadores conferidos.",
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
