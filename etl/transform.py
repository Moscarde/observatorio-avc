"""SIH-RD: AIHs normais, por competência de processamento (não pacientes)."""

from decimal import Decimal, InvalidOperation
import re

import pandas as pd

CIDS = {
    "I60": "Hemorragia subaracnóidea",
    "I61": "Hemorragia intracerebral",
    "I62": "Outras hemorragias intracranianas não traumáticas",
    "I63": "Infarto cerebral",
    "I64": "AVC não especificado",
}
TYPES = {
    "I60": "Hemorrágico",
    "I61": "Hemorrágico",
    "I62": "Outras hemorragias (I62)",
    "I63": "Isquêmico",
    "I64": "Não especificado",
}
AGES = ["0–19", "20–39", "40–49", "50–59", "60–69", "70–79", "80+", "Ignorada"]
DIMS = ["period", "residence", "hospital_city", "hospital", "sex", "age", "cid"]
MEASURES = ["n", "deaths", "death_n", "days", "days_n", "cents", "value_n", "age_sum", "age_n"]
REQUIRED = {
    "DIAG_PRINC",
    "IDENT",
    "N_AIH",
    "ANO_CMPT",
    "MES_CMPT",
    "MUNIC_RES",
    "MUNIC_MOV",
    "CNES",
    "SEXO",
    "COD_IDADE",
    "IDADE",
    "MORTE",
    "DIAS_PERM",
    "VAL_TOT",
    "DT_INTER",
    "DT_SAIDA",
}


def clean(value):
    if value is None or pd.isna(value):
        return ""
    text = str(value).strip().replace("\x00", "")
    return re.sub(r"\.0$", "", text)


def code(value, length):
    text = clean(value)
    if not text.isdigit() or set(text) == {"0"}:
        return "unknown"
    return text.zfill(length) if len(text) <= length else "unknown"


def number(value):
    try:
        n = float(clean(value).replace(",", "."))
        return n if pd.notna(n) and n >= 0 and n != float("inf") else None
    except ValueError:
        return None


def age_years(unit, value):
    n = number(value)
    if n is None:
        return None
    # SIH: 1 horas, 2 dias, 3 meses, 4 anos, 5 anos acima de 100.
    unit = clean(unit)
    age = {"1": n / (24 * 365.25), "2": n / 365.25, "3": n / 12, "4": n, "5": n + 100}.get(unit)
    return age if age is not None and age <= 120 else None


def age_band(age):
    if age is None:
        return "Ignorada"
    for bound, label in zip([20, 40, 50, 60, 70, 80, 121], AGES):
        if age < bound:
            return label
    return "Ignorada"


def cents(value):
    try:
        amount = Decimal(clean(value).replace(",", "."))
        return (
            int((amount * 100).quantize(Decimal("1")))
            if amount.is_finite() and amount >= 0
            else None
        )
    except (InvalidOperation, ValueError):
        return None


def transform(frame, year, month):
    missing = REQUIRED - set(frame.columns)
    if missing:
        raise ValueError(f"Colunas obrigatórias ausentes: {', '.join(sorted(missing))}")
    cid = frame.DIAG_PRINC.map(clean).str.upper().str.replace(".", "", regex=False)
    selected = frame.loc[cid.str.fullmatch(r"I6[0-4]\d?") & frame.IDENT.map(clean).eq("1")].copy()
    selected["DIAG_PRINC"] = cid.loc[selected.index]
    audit = {
        "source_rows": len(frame),
        "stroke_normal_rows": len(selected),
        "duplicate_rows": 0,
        "invalid_dates": 0,
        "missing_age": 0,
        "missing_death": 0,
        "missing_days": 0,
        "missing_value": 0,
    }
    rows, seen = [], {}
    for record in selected.to_dict("records"):
        if (
            clean(record["ANO_CMPT"]) != str(year)
            or clean(record["MES_CMPT"]).zfill(2) != f"{month:02}"
        ):
            raise ValueError("Competência interna difere do arquivo solicitado")
        aih = clean(record["N_AIH"])
        if not re.fullmatch(r"\d{13}", aih) or set(aih) == {"0"}:
            raise ValueError("Número de AIH inválido; deduplicação não segura")
        key = aih
        # Remove apenas cópias idênticas; versões conflitantes requerem revisão.
        fingerprint = tuple(clean(record[c]) for c in sorted(REQUIRED))
        if key in seen:
            if seen[key] != fingerprint:
                raise ValueError(
                    f"AIH conflitante na competência {year}-{month:02}; revisar origem"
                )
            audit["duplicate_rows"] += 1
            continue
        seen[key] = fingerprint
        start = pd.to_datetime(clean(record["DT_INTER"]), format="%Y%m%d", errors="coerce")
        end = pd.to_datetime(clean(record["DT_SAIDA"]), format="%Y%m%d", errors="coerce")
        if pd.isna(start) or pd.isna(end) or end < start:
            audit["invalid_dates"] += 1
        age = age_years(record["COD_IDADE"], record["IDADE"])
        death = clean(record["MORTE"])
        days = number(record["DIAS_PERM"])
        value = cents(record["VAL_TOT"])
        for flag, absent in [
            ("age", age is None),
            ("death", death not in {"0", "1"}),
            ("days", days is None),
            ("value", value is None),
        ]:
            audit[f"missing_{flag}"] += int(absent)
        rows.append(
            {
                "period": f"{year}-{month:02}",
                "residence": code(record["MUNIC_RES"], 6),
                "hospital_city": code(record["MUNIC_MOV"], 6),
                "hospital": code(record["CNES"], 7),
                "sex": {"1": "Masculino", "3": "Feminino"}.get(clean(record["SEXO"]), "Ignorado"),
                "age": age_band(age),
                "cid": record["DIAG_PRINC"],
                "n": 1,
                "deaths": int(death == "1"),
                "death_n": int(death in {"0", "1"}),
                "days": days or 0,
                "days_n": int(days is not None),
                "cents": value or 0,
                "value_n": int(value is not None),
                "age_sum": age or 0,
                "age_n": int(age is not None),
            }
        )
    cube = pd.DataFrame(rows, columns=DIMS + MEASURES)
    if not cube.empty:
        cube = cube.groupby(DIMS, as_index=False, sort=True)[MEASURES].sum()
        cube["age_sum"] = cube["age_sum"].round(6)
    validate(cube)
    if int(cube.n.sum()) != len(selected) - audit["duplicate_rows"]:
        raise ValueError("Totais agregados inconsistentes")
    return cube, audit


def validate(cube):
    if cube.empty:
        return
    if cube.duplicated(DIMS).any() or (cube[MEASURES] < 0).any().any():
        raise ValueError("Cubo duplicado ou medidas negativas")
    if not cube.cid.str.fullmatch(r"I6[0-4]\d?").all():
        raise ValueError("CID inválido")
    if not cube.period.str.fullmatch(r"20\d{2}-(0[1-9]|1[0-2])").all():
        raise ValueError("Competência inválida")
    if (cube.deaths > cube.death_n).any() or any(
        (cube[m] > cube.n).any() for m in ["death_n", "days_n", "value_n", "age_n"]
    ):
        raise ValueError("Denominadores inconsistentes")
