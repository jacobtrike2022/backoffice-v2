-- =====================================================
-- Add FLSA Status classification to roles
-- =====================================================
-- Adds nullable flsa_status column constrained to exempt/non_exempt values.
-- Allows backfill without forcing existing roles to choose a status.
-- =====================================================

-- Add column if it does not already exist
ALTER TABLE roles
ADD COLUMN IF NOT EXISTS flsa_status TEXT;

-- Ensure only allowed values are stored (or NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE c.conname = 'roles_flsa_status_check'
      AND t.relname = 'roles'
  ) THEN
    ALTER TABLE roles
    ADD CONSTRAINT roles_flsa_status_check
    CHECK (flsa_status IN ('exempt', 'non_exempt'));
  END IF;
END $$;

COMMENT ON COLUMN roles.flsa_status IS 'FLSA status for the role: exempt (salary) or non_exempt (hourly). Nullable for roles without a set classification.';

