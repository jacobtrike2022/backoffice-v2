-- Add external_id (HRIS-native employee ID) and source tracking to users
-- Idempotent: safe to run multiple times.

ALTER TABLE users ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS external_id_source TEXT;

-- Per-org uniqueness — two tenants can both have employee 1018 without collision
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_org_external_id
  ON users (organization_id, external_id)
  WHERE external_id IS NOT NULL;

COMMENT ON COLUMN users.external_id IS 'HRIS-native employee identifier (e.g., Paylocity Employee ID). Stable across rehires. Scoped per organization. Used as primary match key for CSV/API sync.';
COMMENT ON COLUMN users.external_id_source IS 'Which HRIS system the external_id came from: paylocity | adp | workday | gusto | bamboohr | manual';

-- Best-effort backfill: copy existing employee_id values into external_id where empty
UPDATE users SET external_id = employee_id, external_id_source = 'manual'
WHERE external_id IS NULL AND employee_id IS NOT NULL AND employee_id != '';
