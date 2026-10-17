-- Cada eixo descreve o mesmo universo; não somar eixos entre si.
CREATE TABLE mart_perfil_internacoes AS
WITH expanded AS (
    SELECT 'sex' AS axis, sex AS category, * FROM cohort
    UNION ALL
    SELECT 'age' AS axis, age AS category, * FROM cohort
    UNION ALL
    SELECT 'cid' AS axis, substr(cid, 1, 3) AS category, * FROM cohort
), totals AS (
    SELECT axis, category, coalesce(sum(n), 0) AS n,
    coalesce(sum(deaths), 0) AS deaths,
    coalesce(sum(death_n), 0) AS death_n,
    coalesce(sum(days), 0) AS days,
    coalesce(sum(days_n), 0) AS days_n,
    coalesce(sum(cents), 0) AS cents,
    coalesce(sum(value_n), 0) AS value_n,
    coalesce(sum(age_sum), 0) AS age_sum,
    coalesce(sum(age_n), 0) AS age_n FROM expanded GROUP BY axis, category
)
SELECT *,
    100.0 * deaths / nullif(death_n, 0) AS hospital_mortality_pct,
    days / nullif(days_n, 0) AS mean_stay_days,
    cents / (100.0 * nullif(value_n, 0)) AS mean_aih_value_brl,
    age_sum / nullif(age_n, 0) AS mean_age_years FROM totals ORDER BY axis, category;
