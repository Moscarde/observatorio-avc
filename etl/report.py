"""Renderização de relatório portátil a partir dos resultados SQL reconciliados."""

from collections import Counter
from html import escape
import json
from string import Template

from etl.validate import ROOT


def number(value, decimals=0):
    if value is None:
        return "—"
    text = f"{value:,.{decimals}f}"
    return text.replace(",", "_").replace(".", ",").replace("_", ".")


def table(headers, rows, caption):
    head = "".join(f'<th scope="col">{escape(h)}</th>' for h in headers)
    body = "".join(
        "<tr>" + "".join(f"<td>{escape(str(c))}</td>" for c in row) + "</tr>" for row in rows
    )
    if not rows:
        body = f'<tr><td colspan="{len(headers)}">Nenhuma internação neste recorte.</td></tr>'
    return f"<table><caption>{escape(caption)}</caption><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>"


def annual_chart(rows):
    if not rows or not any(r["n"] for r in rows):
        return '<p class="empty">Nenhuma internação neste recorte.</p>'
    maximum = max(r["n"] for r in rows)
    width, left, bottom, height = 540, 62, 220, 170
    step = (width - left - 20) / len(rows)
    parts = [
        '<svg class="chart" viewBox="0 0 540 265" role="img" '
        'aria-labelledby="chart-title chart-desc"><title id="chart-title">'
        'Internações por ano</title><desc id="chart-desc">Barras com eixo iniciado em zero. '
        "Valores exatos disponíveis na tabela de indicadores por ano.</desc>"
    ]
    for fraction in (0, 0.5, 1):
        y = bottom - height * fraction
        parts.append(
            f'<line x1="{left}" y1="{y}" x2="530" y2="{y}" stroke="#dce5eb"/>'
            f'<text x="{left - 8}" y="{y + 4}" text-anchor="end">'
            f"{number(maximum * fraction)}</text>"
        )
    for index, row in enumerate(rows):
        x = left + step * index + step * 0.2
        bar = height * row["n"] / maximum
        parts.append(
            f'<rect x="{x:.2f}" y="{bottom - bar:.2f}" width="{step * 0.6:.2f}" '
            f'height="{bar:.2f}" rx="4" fill="#087f8c"><title>'
            f"{escape(row['year'])}: {number(row['n'])} internações</title></rect>"
            f'<text x="{x + step * 0.3:.2f}" y="245" text-anchor="middle">'
            f"{escape(row['year'])}</text>"
        )
    return "".join(parts) + "</svg>"


def render_report(manifest, marts, run, reconciliation):
    totals = marts["mart_indicadores"][0]
    coverage = run["coverage"]
    years = Counter(p[:4] for p in coverage)
    annual = marts["mart_evolucao_anual"]
    annual_rows = [
        {**r, "year": str(r["year"]) + ("*" if years[str(r["year"])] < 12 else "")} for r in annual
    ]
    cards = []
    for label, value, suffix, note in (
        ("Internações", totals["n"], "", "Registros de AIH normal"),
        ("Óbitos hospitalares", totals["deaths"], "", "Desfecho registrado no SIH/SUS"),
        (
            "Mortalidade hospitalar",
            totals["hospital_mortality_pct"],
            "%",
            "Óbitos / desfechos conhecidos",
        ),
        (
            "Permanência média",
            totals["mean_stay_days"],
            " dias",
            "Dias / internações com permanência válida",
        ),
    ):
        display = number(value if coverage else None, 1 if suffix else 0)
        if value is not None and coverage:
            display += suffix
        cards.append(
            f'<article class="metric"><span>{escape(label)}</span>'
            f"<strong>{display}</strong><span>{escape(note)}</span></article>"
        )
    cid_labels = manifest["cid_labels"]
    diagnoses = table(
        ["Diagnóstico", "Internações"],
        [
            (f"{r['category']} · {cid_labels.get(r['category'], r['category'])}", number(r["n"]))
            for r in marts["mart_perfil_internacoes"]
            if r["axis"] == "cid"
        ],
        "Distribuição das internações do mesmo recorte por CID.",
    )
    annual_table = table(
        ["Ano", "Internações", "Óbitos", "Mort. hospitalar", "Permanência"],
        [
            (
                r["year"],
                number(r["n"]),
                number(r["deaths"]),
                number(r["hospital_mortality_pct"], 1)
                + ("%" if r["hospital_mortality_pct"] is not None else ""),
                number(r["mean_stay_days"], 1),
            )
            for r in annual_rows
        ],
        "Mesma coorte dos indicadores gerais. * Ano com menos de 12 competências cobertas no recorte. Permanência em dias.",
    )
    hospitals = table(
        ["Estabelecimento / CNES", "Internações", "Óbitos"],
        [
            (
                f"{manifest['hospitals'].get(r['hospital'], 'Nome indisponível')} / {r['hospital']}",
                number(r["n"]),
                number(r["deaths"]),
            )
            for r in marts["mart_rede_hospitalar"][:10]
        ],
        "Dez maiores contagens, considerando todos os filtros aplicados.",
    )
    other = table(
        ["Medida", "Valor"],
        [
            ("Valor médio de AIH (R$)", number(totals["mean_aih_value_brl"], 2)),
            ("Idade média (anos)", number(totals["mean_age_years"], 1)),
            ("Desfechos conhecidos", number(totals["death_n"])),
            ("Idades válidas", number(totals["age_n"])),
        ],
        "Denominadores específicos preservados.",
    )
    territory = marts["mart_distribuicao_territorial"]
    filters = json.dumps(run["filters"], ensure_ascii=False, sort_keys=True)
    cohort = (
        "Todos os registros disponíveis no período coberto."
        if not run["filters"]
        else "Filtros aplicados a todos os indicadores, gráficos e tabelas: " + filters
    )
    if not coverage:
        cohort = "Sem competências cobertas no período selecionado. Não há base para indicadores."
    substitutions = {
        "period": f"{min(coverage)} a {max(coverage)}" if coverage else "Período sem cobertura",
        "coverage": len(coverage),
        "source_coverage": len(manifest["coverage"]),
        "cohort": cohort,
        "aggregate_rows": number(run["aggregate_rows"]),
        "cohort_rows": number(run["cohort_rows"]),
        "evidence": run["evidence"],
        "source_generated": manifest["generated_at"],
        "generated": run["created_at"],
        "run_id": run["id"],
        "commit": (run["git"]["commit"] or "indisponível")
        + (" (com alterações locais)" if run["git"]["dirty"] else ""),
        "manifest_hash": run["input_sha256"]["manifest.json"],
        "filters": filters,
        "groups": reconciliation["groups_checked"],
        "residences": sum(
            r["basis"] == "residence" and r["municipality"] != "unknown" for r in territory
        ),
        "hospital_cities": sum(
            r["basis"] == "hospital_city" and r["municipality"] != "unknown" for r in territory
        ),
    }
    substitutions = {k: escape(str(v)) for k, v in substitutions.items()}
    substitutions.update(
        cards="".join(cards),
        chart=annual_chart(annual_rows),
        diagnoses=diagnoses,
        annual=annual_table,
        hospitals=hospitals,
        other_metrics=other,
    )
    return Template((ROOT / "templates/report.html").read_text()).substitute(substitutions)
