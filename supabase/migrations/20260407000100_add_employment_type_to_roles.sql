-- Add employment_type column to roles table
-- Idempotent: safe to run multiple times.

ALTER TABLE roles ADD COLUMN IF NOT EXISTS employment_type TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'roles_employment_type_check'
  ) THEN
    ALTER TABLE roles
      ADD CONSTRAINT roles_employment_type_check
      CHECK (employment_type IS NULL OR employment_type IN ('hourly', 'salaried', 'admin'));
  END IF;
END $$;

COMMENT ON COLUMN roles.employment_type IS 'Employment classification for FLSA guardrails and login restrictions. ''hourly'' = hourly workers (timesheet required), ''salaried'' = exempt salaried, ''admin'' = corporate/admin staff with elevated access.';

CREATE INDEX IF NOT EXISTS idx_roles_employment_type ON roles(employment_type);
