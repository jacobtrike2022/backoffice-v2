-- =====================================================
-- BACKFILL TRACK_SCOPES: DEFAULT EVERY TRACK TO UNIVERSAL
-- =====================================================
-- UNIVERSAL = content applies to all sectors, industries, states,
-- companies, and units. State-specific (or other scope) tracks can
-- be set later via bulk edit or per-track scope modal.
-- =====================================================

INSERT INTO track_scopes (track_id, organization_id, scope_level, metadata, created_at, updated_at)
SELECT
  t.id,
  t.organization_id,
  'UNIVERSAL',
  '{}'::jsonb,
  NOW(),
  NOW()
FROM tracks t
WHERE NOT EXISTS (SELECT 1 FROM track_scopes ts WHERE ts.track_id = t.id)
ON CONFLICT (track_id) DO NOTHING;
