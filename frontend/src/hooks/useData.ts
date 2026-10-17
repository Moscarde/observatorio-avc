import { useEffect, useState } from "react";
import type { GeoJSON, Manifest, Row } from "../types/data";
import { measureKeys } from "../lib/analytics";
const base = import.meta.env.BASE_URL + "data/";
async function read<T>(file: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(base + file, { signal });
  if (!response.ok)
    throw new Error(
      `Não foi possível carregar ${file} (HTTP ${response.status}).`,
    );
  return response.json() as Promise<T>;
}
export function useData() {
  const [data, setData] = useState<{
    manifest: Manifest;
    rows: Row[];
    geo: GeoJSON | null;
  } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setData(null);
    async function load() {
      try {
        const manifest = await read<Manifest>(
          "manifest.json",
          controller.signal,
        );
        if (manifest.schema !== 1)
          throw new Error("Formato dos dados incompatível.");
        const [cubes, geo] = await Promise.all([
          Promise.all(
            manifest.files.map((f) =>
              read<{ columns: (keyof Row)[]; rows: (string | number)[][] }>(
                f.file,
                controller.signal,
              ),
            ),
          ),
          manifest.geography
            ? read<GeoJSON>(manifest.geography, controller.signal)
            : Promise.resolve(null),
        ]);
        const rows = cubes.flatMap((c) => {
          const required = [
            "period",
            "residence",
            "hospital_city",
            "hospital",
            "sex",
            "age",
            "cid",
            ...measureKeys,
          ];
          if (required.some((k) => !c.columns.includes(k as keyof Row)))
            throw new Error("Agregação incompleta.");
          return c.rows.map((values) => {
            const row = Object.fromEntries(
              c.columns.map((key, index) => [key, values[index]]),
            ) as unknown as Row;
            if (
              !/^I6[0-4]\d?$/.test(row.cid) ||
              !/^20\d{2}-(0[1-9]|1[0-2])$/.test(row.period) ||
              !manifest.coverage.includes(row.period) ||
              measureKeys.some(
                (k) =>
                  typeof row[k] !== "number" ||
                  !Number.isFinite(row[k]) ||
                  row[k] < 0,
              ) ||
              row.deaths > row.death_n ||
              ["death_n", "age_n", "days_n", "value_n"].some(
                (k) =>
                  row[k as "death_n" | "age_n" | "days_n" | "value_n"] > row.n,
              )
            )
              throw new Error("Indicadores inválidos no arquivo de dados.");
            return row;
          });
        });
        setData({ manifest, rows, geo });
      } catch (err) {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error ? err.message : "Falha ao carregar dados.",
          );
      }
    }
    void load();
    return () => controller.abort();
  }, [retry]);
  return { data, error, reload: () => setRetry((n) => n + 1) };
}
