-- Add per-org employee match strategy config
-- Idempotent: safe to run multiple times.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS employee_match_strategy TEXT DEFAULT 'auto';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS employee_match_strategy_locked BOOLEAN DEFAULT TRUE;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orgs_match_strategy_check'
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT orgs_match_strategy_check
      CHECK (employee_match_strategy IN ('auto', 'external_id', 'email', 'mobile_phone'));
  END IF;
END $$;

COMMENT ON COLUMN organizations.employee_match_strategy IS 'Primary identifier strategy for matching employees during CSV/API sync. auto = pick best based on org HRIS source. external_id = HRIS Employee ID (recommended for Paylocity/ADP/Workday). email = case-insensitive email match. mobile_phone = E.164 phone match.';
COMMENT ON COLUMN organizations.employee_match_strategy_locked IS 'When TRUE, only Trike Super Admins can change the match strategy. Prevents accidental data corruption from org admins changing the key. Default TRUE — must be unlocked explicitly.';
