-- Lifecycle tracking columns required by the sync engine in src/lib/crud/users.ts.
-- - last_active_at: read by classifyUserSync to surface "last seen" on missing users
-- - deactivated_at: written by commitUserSync when an employee is soft-deleted via missing_action='deactivate'
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_org_status_deactivated_at
  ON users (organization_id, status, deactivated_at);

COMMENT ON COLUMN users.last_active_at IS 'Last time the user took an action in the app. Used for "last seen" displays and stale-account detection.';
COMMENT ON COLUMN users.deactivated_at IS 'Timestamp when the user was soft-deleted (status set to inactive). NULL for active users. Cleared on reactivation.';
