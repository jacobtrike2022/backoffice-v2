-- Add per-org toggle to enable/disable demo activity tracking.
-- Defaults to true for all orgs; Trike Co is set to false.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS demo_tracking_enabled BOOLEAN NOT NULL DEFAULT true;

-- Trike Co should not be tracked
UPDATE organizations
  SET demo_tracking_enabled = false
  WHERE id = '10000000-0000-0000-0000-000000000001';
