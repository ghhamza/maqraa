-- Soft demographics for signup / profile / admin dashboards.
-- `gender` already exists (020_user_profiling). Add birth_year + country_code.

ALTER TABLE users
  ADD COLUMN birth_year SMALLINT CHECK (birth_year BETWEEN 1920 AND 2030),
  ADD COLUMN country_code CHAR(2);

-- Backfill from existing profiling fields when present.
UPDATE users
SET birth_year = EXTRACT(YEAR FROM date_of_birth)::SMALLINT
WHERE date_of_birth IS NOT NULL
  AND birth_year IS NULL
  AND EXTRACT(YEAR FROM date_of_birth) BETWEEN 1920 AND 2030;

UPDATE users
SET country_code = upper(trim(country))
WHERE country IS NOT NULL
  AND country_code IS NULL
  AND length(trim(country)) = 2
  AND trim(country) ~ '^[A-Za-z]{2}$';
