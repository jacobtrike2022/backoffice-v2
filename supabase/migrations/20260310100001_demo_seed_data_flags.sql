-- =====================================================
-- DEMO SEED DATA FLAGS
-- =====================================================
-- Adds is_seed column to tables that hold demo/seed data.
-- When an org transitions from prospect → onboarding (client),
-- we remove only is_seed=true rows, keeping user-entered data.
--
-- Tables: users, stores, districts, activity_logs, activity_events
-- =====================================================

-- Users: seed people (placeholder employees for demo dashboards)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_seed BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_users_is_seed ON users(organization_id, is_seed) WHERE is_seed = TRUE;

-- Stores (units): seed locations for demo
ALTER TABLE stores ADD COLUMN IF NOT EXISTS is_seed BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_stores_is_seed ON stores(organization_id, is_seed) WHERE is_seed = TRUE;

-- Districts: seed regions for demo (parent of seed stores)
ALTER TABLE districts ADD COLUMN IF NOT EXISTS is_seed BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_districts_is_seed ON districts(organization_id, is_seed) WHERE is_seed = TRUE;

-- Activity logs: seed activity for dashboard charts
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS is_seed BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_activity_logs_is_seed ON activity_logs(organization_id, is_seed) WHERE is_seed = TRUE;

-- Activity events: learning activity (views, completions) for seed users
ALTER TABLE activity_events ADD COLUMN IF NOT EXISTS is_seed BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_activity_events_is_seed ON activity_events(is_seed) WHERE is_seed = TRUE;

COMMENT ON COLUMN users.is_seed IS 'True for demo placeholder people; removed when org transitions prospect→onboarding';
COMMENT ON COLUMN stores.is_seed IS 'True for demo placeholder units; removed when org transitions prospect→onboarding';
COMMENT ON COLUMN districts.is_seed IS 'True for demo placeholder districts; removed when org transitions prospect→onboarding';
COMMENT ON COLUMN activity_logs.is_seed IS 'True for demo placeholder activity; removed when org transitions prospect→onboarding';
COMMENT ON COLUMN activity_events.is_seed IS 'True for demo placeholder learning events; removed when org transitions prospect→onboarding';
