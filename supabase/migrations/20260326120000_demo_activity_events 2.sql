-- Demo activity telemetry for prospect-to-client reporting
-- Non-blocking event sink for page/nav/track interactions.

CREATE TABLE IF NOT EXISTS demo_activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  organization_name_snapshot TEXT,
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  path TEXT NOT NULL,
  from_path TEXT,
  referrer TEXT,
  track_id UUID REFERENCES tracks(id) ON DELETE SET NULL,
  track_title TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_activity_events_org_time
  ON demo_activity_events(organization_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_demo_activity_events_visitor_time
  ON demo_activity_events(visitor_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_demo_activity_events_event_time
  ON demo_activity_events(event_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_demo_activity_events_session_time
  ON demo_activity_events(session_id, occurred_at DESC);

ALTER TABLE demo_activity_events ENABLE ROW LEVEL SECURITY;

-- Trike super admins can read all telemetry across organizations.
DROP POLICY IF EXISTS "Trike super admins can view all demo activity events" ON demo_activity_events;
CREATE POLICY "Trike super admins can view all demo activity events"
  ON demo_activity_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
        AND r.name = 'Trike Super Admin'
    )
  );

-- Org members can read telemetry scoped to their own organization.
DROP POLICY IF EXISTS "Org members can view their demo activity events" ON demo_activity_events;
CREATE POLICY "Org members can view their demo activity events"
  ON demo_activity_events
  FOR SELECT
  USING (
    organization_id = (
      SELECT u.organization_id
      FROM users u
      WHERE u.auth_user_id = auth.uid()
      LIMIT 1
    )
  );

