import type { Filters as FilterState, Manifest } from "../types/data";
const monthLabel = (period: string) =>
  new Date(`${period}-15T12:00:00`).toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
  });
function municipalityNames(
  manifest: Manifest,
  codes: string[],
): Record<string, string> {
  return {
    ...manifest.municipalities,
    ...Object.fromEntries(
      codes
        .filter((code) => !manifest.municipalities[code])
        .map((code) => [
          code,
          code === "unknown"
            ? "Município ignorado"
            : `Código DATASUS ${code} (fora da malha RJ)`,
        ]),
    ),
  };
}
export function Filters({
  value,
  onChange,
  manifest,
  onReset,
  municipalityCodes,
}: {
  value: FilterState;
  onChange: (f: FilterState) => void;
  manifest: Manifest;
  onReset: () => void;
  municipalityCodes: string[];
}) {
  function update<K extends keyof FilterState>(key: K, v: FilterState[K]) {
    onChange({ ...value, [key]: v });
  }
  const names = municipalityNames(manifest, municipalityCodes);
  return (
    <section className="filters" aria-label="Filtros globais">
      <div className="filter-caption">
        <div>
          <span className="eyebrow">Passo 1 · Defina o recorte</span>
          <p>
            Os filtros valem para todo o painel: indicadores, mapa, série,
            perfil e rede hospitalar usam o mesmo conjunto de internações.
          </p>
        </div>
        <button className="ghost-button" onClick={onReset}>
          Limpar filtros ↺
        </button>
      </div>
      <div className="filter-groups">
        <fieldset>
          <legend>Quando</legend>
          <div className="filter-row">
            <label>
              De
              <input
                type="month"
                min="2020-01"
                max={value.end}
                value={value.start}
                onChange={(e) => {
                  if (
                    e.target.value >= "2020-01" &&
                    e.target.value <= value.end
                  )
                    update("start", e.target.value);
                }}
              />
            </label>
            <label>
              Até
              <input
                type="month"
                min={value.start}
                max="2025-12"
                value={value.end}
                onChange={(e) => {
                  if (
                    e.target.value >= value.start &&
                    e.target.value <= "2025-12"
                  )
                    update("end", e.target.value);
                }}
              />
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Onde</legend>
          <div className="filter-row">
            <label>
              Território
              <select
                value={value.dimension}
                onChange={(e) =>
                  update(
                    "dimension",
                    e.target.value as FilterState["dimension"],
                  )
                }
              >
                <option value="residence">Município de residência</option>
                <option value="hospital_city">Município de internação</option>
              </select>
            </label>
            <label>
              Município
              <select
                value={value.municipality}
                onChange={(e) => update("municipality", e.target.value)}
              >
                <option value="">Todos os municípios</option>
                {Object.entries(names)
                  .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
                  .map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Quem e qual AVC</legend>
          <div className="filter-row three">
            <label>
              Sexo
              <select
                value={value.sex}
                onChange={(e) => update("sex", e.target.value)}
              >
                <option value="">Todos</option>
                {["Feminino", "Masculino", "Ignorado"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Faixa etária
              <select
                value={value.age}
                onChange={(e) => update("age", e.target.value)}
              >
                <option value="">Todas as idades</option>
                {manifest.ages.map((a) => (
                  <option key={a} value={a}>
                    {a === "Ignorada" ? "Idade ignorada" : `${a} anos`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tipo de AVC
              <select
                value={value.type}
                onChange={(e) => update("type", e.target.value)}
              >
                <option value="">Todos os tipos</option>
                {[...new Set(Object.values(manifest.types))].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>
      </div>
    </section>
  );
}
export function ActiveFilters({
  value,
  onChange,
  manifest,
  municipalityCodes,
  defaults,
  available,
  expected,
}: {
  value: FilterState;
  onChange: (f: FilterState) => void;
  manifest: Manifest;
  municipalityCodes: string[];
  defaults: FilterState;
  available: number;
  expected: number;
}) {
  function update<K extends keyof FilterState>(key: K, v: FilterState[K]) {
    onChange({ ...value, [key]: v });
  }
  const names = municipalityNames(manifest, municipalityCodes);
  const territory =
    value.dimension === "residence" ? "residência" : "internação";
  const chips: [string, string, () => void][] = [];
  if (value.start !== defaults.start || value.end !== defaults.end)
    chips.push([
      "Período",
      `${monthLabel(value.start)} – ${monthLabel(value.end)}`,
      () => onChange({ ...value, start: defaults.start, end: defaults.end }),
    ]);
  if (value.dimension !== defaults.dimension)
    chips.push([
      "Território",
      `por município de ${territory}`,
      () => update("dimension", defaults.dimension),
    ]);
  if (value.municipality)
    chips.push([
      "Município",
      names[value.municipality] ?? value.municipality,
      () => update("municipality", ""),
    ]);
  if (value.sex) chips.push(["Sexo", value.sex, () => update("sex", "")]);
  if (value.age)
    chips.push([
      "Idade",
      value.age === "Ignorada" ? "ignorada" : `${value.age} anos`,
      () => update("age", ""),
    ]);
  if (value.type) chips.push(["Tipo", value.type, () => update("type", "")]);
  return (
    <div className="recorte" role="status" aria-live="polite">
      <div className="recorte-main">
        <span className="recorte-label">Você está vendo</span>
        {chips.length ? (
          <ul className="chips">
            {chips.map(([label, text, clear]) => (
              <li key={label}>
                <span>
                  <small>{label}</small> {text}
                </span>
                <button
                  onClick={clear}
                  aria-label={`Remover filtro ${label}: ${text}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <span className="recorte-default">
            Todas as internações por AVC · Estado do Rio de Janeiro · jan/2020 a
            dez/2025 · por município de {territory}
          </span>
        )}
      </div>
      <span className="recorte-coverage">
        {available} de {expected} competências disponíveis
      </span>
    </div>
  );
}
