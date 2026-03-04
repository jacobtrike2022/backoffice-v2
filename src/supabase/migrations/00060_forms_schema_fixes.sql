-- =====================================================
-- FORMS SCHEMA FIXES
-- =====================================================
-- Migration: 00060_forms_schema_fixes.sql
-- Purpose: Fix column naming inconsistencies and add missing columns
-- Issues Fixed:
--   1. Rename created_by → created_by_id (consistency with other tables)
--   2. Rename reviewed_by → reviewed_by_id (consistency)
--   3. Extract JSONB fields to typed columns (type, category, requires_approval, allow_anonymous)
--   4. Add composite indexes for performance
--   5. Strengthen RLS policies with role-based access
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: RENAME COLUMNS FOR CONSISTENCY
-- =====================================================

-- forms.created_by → forms.created_by_id
-- This matches the naming convention used in CRUD code (line 50)
ALTER TABLE forms
  RENAME COLUMN created_by TO created_by_id;

-- form_submissions.reviewed_by → form_submissions.reviewed_by_id
-- This maintains consistency across the schema
ALTER TABLE form_submissions
  RENAME COLUMN reviewed_by TO reviewed_by_id;

-- =====================================================
-- STEP 2: ADD MISSING COLUMNS ON forms TABLE
-- =====================================================

-- Add type column (previously in JSONB settings)
-- CRUD code expects this at line 45
ALTER TABLE forms
  ADD COLUMN type TEXT
  CHECK (type IN ('ojt-checklist', 'inspection', 'audit', 'survey', 'other'));

-- Add category column (previously in JSONB settings)
-- CRUD code expects this at line 46
ALTER TABLE forms
  ADD COLUMN category TEXT;

-- Add requires_approval flag (previously in JSONB settings)
-- CRUD code expects this at line 48
ALTER TABLE forms
  ADD COLUMN requires_approval BOOLEAN DEFAULT false;

-- Add allow_anonymous flag (previously in JSONB settings)
-- CRUD code expects this at line 49
ALTER TABLE forms
  ADD COLUMN allow_anonymous BOOLEAN DEFAULT false;

-- =====================================================
-- STEP 3: MIGRATE EXISTING DATA FROM JSONB
-- =====================================================

-- If any forms already exist, migrate their settings from JSONB to typed columns
UPDATE forms SET
  type = COALESCE(settings->>'type', 'other'),
  category = settings->>'category',
  requires_approval = COALESCE((settings->>'requires_approval')::boolean, false),
  allow_anonymous = COALESCE((settings->>'allow_anonymous')::boolean, false)
WHERE settings IS NOT NULL;

-- =====================================================
-- STEP 4: ADD COMPOSITE INDEXES FOR PERFORMANCE
-- =====================================================

-- Common query: "Get all published forms for my org"
-- SELECT * FROM forms WHERE organization_id = X AND status = 'published'
CREATE INDEX IF NOT EXISTS idx_forms_org_status
  ON forms(organization_id, status);

-- Query: "Get forms by type"
-- SELECT * FROM forms WHERE type = 'ojt-checklist'
CREATE INDEX IF NOT EXISTS idx_forms_type
  ON forms(type) WHERE type IS NOT NULL;

-- Common query: "Get submissions for form by status"
-- SELECT * FROM form_submissions WHERE form_id = X AND status = 'submitted'
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_status
  ON form_submissions(form_id, status);

-- =====================================================
-- STEP 5: UPDATE RLS POLICIES
-- =====================================================

-- Drop the overly permissive policy
-- Current policy allows ANY user in org to manage forms (security risk)
DROP POLICY IF EXISTS "Admins can manage forms" ON forms;

-- CREATE: Only managers/admins can create forms
CREATE POLICY "Managers can create forms"
  ON forms FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND (r.name ILIKE '%manager%' OR r.name ILIKE '%admin%' OR r.name = 'Trike Super Admin')
    )
  );

-- READ: Users can see published forms or their own drafts
CREATE POLICY "Users can view published forms or own drafts"
  ON forms FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND (
      status = 'published'
      OR created_by_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

-- UPDATE: Form creators can update their own forms
CREATE POLICY "Form creators can update own forms"
  ON forms FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND created_by_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND created_by_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

-- DELETE: Only admins can delete forms
CREATE POLICY "Admins can delete forms"
  ON forms FOR DELETE
  USING (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND (r.name ILIKE '%admin%' OR r.name = 'Trike Super Admin')
    )
  );

-- =====================================================
-- STEP 6: ADD MISSING RLS POLICIES FOR form_blocks
-- =====================================================

-- Currently form_blocks only has SELECT policy
-- Add policies for INSERT/UPDATE/DELETE

-- Allow form creators to add blocks to their forms
CREATE POLICY "Form creators can add blocks"
  ON form_blocks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM forms
      WHERE forms.id = form_blocks.form_id
      AND forms.created_by_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

-- Allow form creators to update blocks in their forms
CREATE POLICY "Form creators can update blocks"
  ON form_blocks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM forms
      WHERE forms.id = form_blocks.form_id
      AND forms.created_by_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

-- Allow form creators to delete blocks from their forms
CREATE POLICY "Form creators can delete blocks"
  ON form_blocks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM forms
      WHERE forms.id = form_blocks.form_id
      AND forms.created_by_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

-- =====================================================
-- STEP 7: ENHANCE form_submissions RLS POLICIES
-- =====================================================

-- Add policy for managers to view team submissions
CREATE POLICY "Managers can view team submissions"
  ON form_submissions FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND (r.name ILIKE '%manager%' OR r.name ILIKE '%admin%' OR r.name = 'Trike Super Admin')
    )
  );

-- Allow users to update their own draft submissions
CREATE POLICY "Users can update own draft submissions"
  ON form_submissions FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    AND status = 'draft'
  );

COMMIT;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Summary of changes:
-- ✅ Renamed created_by → created_by_id
-- ✅ Renamed reviewed_by → reviewed_by_id
-- ✅ Added type, category, requires_approval, allow_anonymous columns
-- ✅ Migrated existing data from JSONB
-- ✅ Added 3 composite indexes for performance
-- ✅ Replaced overly permissive RLS with role-based policies
-- ✅ Added missing RLS policies for form_blocks
-- ✅ Enhanced form_submissions RLS
-- =====================================================
