-- =====================================================
-- Remove "Trike Templates" org and its empty template tracks
-- =====================================================
-- Org 00000000-0000-0000-0000-000000000001 was created in
-- 20260303100007_seed_demo_template_content.sql as a placeholder
-- for demo provisioning. Provisioning does not filter by this org;
-- template/system content is determined by is_system_content on tracks.
-- Deleting the org CASCADE deletes its tracks (tracks.organization_id
-- REFERENCES organizations(id) ON DELETE CASCADE).
-- =====================================================

DELETE FROM organizations
WHERE id = '00000000-0000-0000-0000-000000000001';
