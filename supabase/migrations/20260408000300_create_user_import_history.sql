-- Audit log for every employee import (CSV or API)
-- Idempotent: safe to run multiple times.

CREATE TABLE IF NOT EXISTS user_import_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  imported_by UUID REFERENCES users(id),
  filename TEXT,
  source TEXT NOT NULL DEFAULT 'csv', -- 'csv' | 'paylocity_api' | 'adp_api' | 'manual'
  match_strategy TEXT, -- snapshot of strategy used at import time
  total_rows INTEGER NOT NULL DEFAULT 0,
  created_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  unchanged_count INTEGER NOT NULL DEFAULT 0,
  reactivated_count INTEGER NOT NULL DEFAULT 0,
  deactivated_count INTEGER NOT NULL DEFAULT 0,
  ignored_count INTEGER NOT NULL DEFAULT 0,   -- rows soft-skipped because their store status = 'ignored'
  skipped_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  diff_summary JSONB,  -- per-row changes (capped to ~1MB; truncated if larger)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_import_history_org_created
  ON user_import_history (organization_id, created_at DESC);

COMMENT ON TABLE user_import_history IS 'Append-only audit log of every employee import (CSV or API). diff_summary stores per-row changes for spot-check + rollback.';

-- RLS: org-scoped read for org admins, full access for service role
ALTER TABLE user_import_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_import_history_select_org_admin" ON user_import_history;
CREATE POLICY "user_import_history_select_org_admin" ON user_import_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
        AND u.organization_id = user_import_history.organization_id
        AND r.name IN ('Admin', 'Trike Super Admin')
    )
  );

DROP POLICY IF EXISTS "user_import_history_insert_org_admin" ON user_import_history;
CREATE POLICY "user_import_history_insert_org_admin" ON user_import_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
        AND u.organization_id = user_import_history.organization_id
        AND r.name IN ('Admin', 'Trike Super Admin')
    )
  );
