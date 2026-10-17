-- Médias e taxas utilizam seus próprios denominadores válidos.
CREATE TABLE mart_indicadores AS
WITH totals AS (SELECT coalesce(sum(n), 0) AS n,
    coalesce(sum(deaths), 0) AS deaths,
    coalesce(sum(death_n), 0) AS death_n,
    coalesce(sum(days), 0) AS days,
    coalesce(sum(days_n), 0) AS days_n,
    coalesce(sum(cents), 0) AS cents,
    coalesce(sum(value_n), 0) AS value_n,
    coalesce(sum(age_sum), 0) AS age_sum,
    coalesce(sum(age_n), 0) AS age_n FROM cohort)
SELECT *,
    100.0 * deaths / nullif(death_n, 0) AS hospital_mortality_pct,
    days / nullif(days_n, 0) AS mean_stay_days,
    cents / (100.0 * nullif(value_n, 0)) AS mean_aih_value_brl,
    age_sum / nullif(age_n, 0) AS mean_age_years FROM totals;
