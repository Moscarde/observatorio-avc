-- Não somar as duas bases territoriais: são duas visões do mesmo universo.
CREATE TABLE mart_distribuicao_territorial AS
WITH expanded AS (
    SELECT 'residence' AS basis, residence AS municipality, * FROM cohort
    UNION ALL
    SELECT 'hospital_city' AS basis, hospital_city AS municipality, * FROM cohort
), totals AS (
    SELECT basis, municipality, coalesce(sum(n), 0) AS n,
    coalesce(sum(deaths), 0) AS deaths,
    coalesce(sum(death_n), 0) AS death_n,
    coalesce(sum(days), 0) AS days,
    coalesce(sum(days_n), 0) AS days_n,
    coalesce(sum(cents), 0) AS cents,
    coalesce(sum(value_n), 0) AS value_n,
    coalesce(sum(age_sum), 0) AS age_sum,
    coalesce(sum(age_n), 0) AS age_n FROM expanded GROUP BY basis, municipality
)
SELECT *,
    100.0 * deaths / nullif(death_n, 0) AS hospital_mortality_pct,
    days / nullif(days_n, 0) AS mean_stay_days,
    cents / (100.0 * nullif(value_n, 0)) AS mean_aih_value_brl,
    age_sum / nullif(age_n, 0) AS mean_age_years FROM totals ORDER BY basis, municipality;
