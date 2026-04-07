-- Add unit_number column to stores table
-- Idempotent: safe to run multiple times.

ALTER TABLE stores ADD COLUMN IF NOT EXISTS unit_number INTEGER;

COMMENT ON COLUMN stores.unit_number IS 'Numeric unit identifier for clean sorting and fuzzy matching during imports. Separate from ''code'' which is for display.';

CREATE INDEX IF NOT EXISTS idx_stores_org_unit_number ON stores(organization_id, unit_number);

-- Best-effort backfill: extract first sequence of digits from `code`.
-- The length check prevents integer overflow on absurdly long digit strings.
UPDATE stores
SET unit_number = CAST(substring(code from '\d+') AS INTEGER)
WHERE unit_number IS NULL
  AND code ~ '\d+'
  AND substring(code from '\d+') ~ '^\d{1,9}$';
