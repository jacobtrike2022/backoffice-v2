-- Add status column to stores table with three lifecycle states
-- Idempotent: safe to run multiple times.

ALTER TABLE stores ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stores_status_check'
  ) THEN
    ALTER TABLE stores
      ADD CONSTRAINT stores_status_check
      CHECK (status IN ('active', 'ignored', 'deactivated'));
  END IF;
END $$;

COMMENT ON COLUMN stores.status IS 'Lifecycle state: active = visible and importable, ignored = exists but excluded from imports (.gitignore-style for HRIS sync), deactivated = soft-deleted.';

CREATE INDEX IF NOT EXISTS idx_stores_org_status ON stores (organization_id, status);

-- Backfill: any store currently is_active = true → status = 'active'; is_active = false → status = 'deactivated'
UPDATE stores SET status = 'active' WHERE status IS NULL AND is_active = true;
UPDATE stores SET status = 'deactivated' WHERE status IS NULL AND is_active = false;
