import { useState } from "react";
import { Empty } from "./Chart";
import { StepHead, Tip } from "./Guide";
import { currency, format, group, metrics } from "../lib/analytics";
import type { Manifest, Row } from "../types/data";
export function Hospitals({
  rows,
  manifest,
}: {
  rows: Row[];
  manifest: Manifest;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"n" | "mortality" | "stay">("n");
  const [all, setAll] = useState(false);
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const hospitals = group(rows, (r) => r.hospital)
    .filter((r) =>
      normalize(`${manifest.hospitals[r.name] ?? ""} ${r.name}`).includes(
        normalize(query),
      ),
    )
    .sort(
      (a, b) =>
        (b[sort] ?? -1) - (a[sort] ?? -1) || a.name.localeCompare(b.name),
    );
  const m = metrics(rows);
  const maxN = Math.max(1, ...hospitals.map((r) => r.n));
  return (
    <section className="panel hospitals" id="rede">
      <StepHead
        step="5"
        label="Rede hospitalar"
        title="Estabelecimentos que registram internações"
        question="Comparações descritivas entre hospitais · sem ajuste por gravidade ou perfil assistencial."
        aside={
          <label className="search">
            <span className="sr-only">Buscar hospital por nome ou CNES</span>
            <input
              type="search"
              placeholder="Buscar nome ou CNES…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setAll(false);
              }}
            />
            <span aria-hidden="true">⌕</span>
          </label>
        }
      />
      <Tip>
        Clique no título de uma coluna para ordenar. Hospitais de referência
        recebem casos mais graves e transferências; mortalidade ou permanência
        maiores não indicam, sozinhas, pior qualidade.
        {manifest.hospital_reference &&
          ` Nomes: tabela oficial DATASUS/CNES · referência cadastral ${manifest.hospital_reference.reference_date
            .split("-")
            .reverse()
            .join("/")}.`}
      </Tip>
      {hospitals.length ? (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Estabelecimento / CNES</th>
                  {(
                    [
                      ["n", "Internações"],
                      ["mortality", "Mortalidade hospitalar"],
                      ["stay", "Permanência média"],
                    ] as const
                  ).map(([key, label]) => (
                    <th
                      key={key}
                      aria-sort={sort === key ? "descending" : "none"}
                    >
                      <button onClick={() => setSort(key)}>
                        {label} {sort === key ? "↓" : "↕"}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hospitals.slice(0, all ? undefined : 10).map((r, index) => (
                  <tr key={r.name}>
                    <td>
                      <span className="rank-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <strong>
                          {manifest.hospitals[r.name] ??
                            (r.name === "unknown"
                              ? "Estabelecimento não identificado"
                              : `Estabelecimento CNES ${r.name}`)}
                        </strong>
                        <small>
                          {r.name === "unknown"
                            ? "Código ausente"
                            : `CNES ${r.name}`}
                        </small>
                      </div>
                    </td>
                    <td>
                      {format(r.n)}
                      <span className="cell-bar" aria-hidden="true">
                        <i style={{ width: `${(r.n / maxN) * 100}%` }} />
                      </span>
                    </td>
                    <td>
                      {format(r.mortality, 1)}
                      {r.mortality === null ? "" : "%"}
                      <span className="cell-bar warm" aria-hidden="true">
                        <i
                          style={{
                            width: `${r.mortality ?? 0}%`,
                          }}
                        />
                      </span>
                    </td>
                    <td>
                      {format(r.stay, 1)}
                      {r.stay === null ? "" : " dias"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hospitals.length > 10 && (
            <button className="show-all" onClick={() => setAll((v) => !v)}>
              {all
                ? "Mostrar 10 primeiros"
                : `Ver todos os ${hospitals.length} estabelecimentos`}{" "}
              ↓
            </button>
          )}
        </>
      ) : (
        <Empty
          message={
            rows.length
              ? "Nenhum estabelecimento corresponde à busca."
              : "Rede hospitalar ainda sem dados."
          }
          detail="Nomes só são exibidos quando vinculados a uma fonte CNES confiável."
        />
      )}
      <div className="panel-foot financial">
        <span>
          Valor médio aprovado por AIH normal:{" "}
          <strong>{currency(m.meanValue)}</strong>
        </span>
        <span>
          Valores nominais · não equivalem ao custo integral da assistência
        </span>
      </div>
    </section>
  );
}
