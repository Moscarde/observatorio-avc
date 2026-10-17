-- Competências cobertas sem linhas no recorte são zero conhecido, não lacunas.
CREATE TABLE mart_evolucao_mensal AS
WITH totals AS (
    SELECT coverage.period, coalesce(sum(c.n), 0) AS n,
    coalesce(sum(c.deaths), 0) AS deaths,
    coalesce(sum(c.death_n), 0) AS death_n,
    coalesce(sum(c.days), 0) AS days,
    coalesce(sum(c.days_n), 0) AS days_n,
    coalesce(sum(c.cents), 0) AS cents,
    coalesce(sum(c.value_n), 0) AS value_n,
    coalesce(sum(c.age_sum), 0) AS age_sum,
    coalesce(sum(c.age_n), 0) AS age_n 
    FROM coverage LEFT JOIN cohort c USING (period)
    GROUP BY coverage.period
)
SELECT *,
    100.0 * deaths / nullif(death_n, 0) AS hospital_mortality_pct,
    days / nullif(days_n, 0) AS mean_stay_days,
    cents / (100.0 * nullif(value_n, 0)) AS mean_aih_value_brl,
    age_sum / nullif(age_n, 0) AS mean_age_years FROM totals ORDER BY period;
