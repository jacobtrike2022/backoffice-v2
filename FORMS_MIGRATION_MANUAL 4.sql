-- =====================================================
-- FORMS MODULE - MANUAL MIGRATION
-- =====================================================
-- Purpose: Fix schema issues and create missing form_assignments table
-- Run this in Supabase SQL Editor if automatic deployment fails
-- Project: kgzhlvxzdlexsrozbbxs
-- =====================================================

-- =====================================================
-- PART 1: FORMS SCHEMA FIXES
-- =====================================================

BEGIN;

-- Step 1: Rename columns for consistency
ALTER TABLE forms RENAME COLUMN created_by TO created_by_id;
ALTER TABLE form_submissions RENAME COLUMN reviewed_by TO reviewed_by_id;

-- Step 2: Add missing columns on forms table
ALTER TABLE forms ADD COLUMN IF NOT EXISTS type TEXT
  CHECK (type IN ('ojt-checklist', 'inspection', 'audit', 'survey', 'other'));
ALTER TABLE forms ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE forms ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false;
ALTER TABLE forms ADD COLUMN IF NOT EXISTS allow_anonymous BOOLEAN DEFAULT false;

-- Step 3: Migrate existing data from JSONB
UPDATE forms SET
  type = COALESCE(settings->>'type', 'other'),
  category = settings->>'category',
  requires_approval = COALESCE((settings->>'requires_approval')::boolean, false),
  allow_anonymous = COALESCE((settings->>'allow_anonymous')::boolean, false)
WHERE settings IS NOT NULL;

-- Step 4: Add composite indexes
CREATE INDEX IF NOT EXISTS idx_forms_org_status ON forms(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_forms_type ON forms(type) WHERE type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_status ON form_submissions(form_id, status);

-- Step 5: Update RLS policies
DROP POLICY IF EXISTS "Admins can manage forms" ON forms;

CREATE POLICY "Managers can create forms" ON forms FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND (r.name ILIKE '%manager%' OR r.name ILIKE '%admin%' OR r.name = 'Trike Super Admin')
    )
  );

CREATE POLICY "Users can view published forms or own drafts" ON forms FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND (status = 'published' OR created_by_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()))
  );

CREATE POLICY "Form creators can update own forms" ON forms FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND created_by_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND created_by_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Admins can delete forms" ON forms FOR DELETE
  USING (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND (r.name ILIKE '%admin%' OR r.name = 'Trike Super Admin')
    )
  );

-- Step 6: Add missing RLS policies for form_blocks
DROP POLICY IF EXISTS "Form creators can add blocks" ON form_blocks;
DROP POLICY IF EXISTS "Form creators can update blocks" ON form_blocks;
DROP POLICY IF EXISTS "Form creators can delete blocks" ON form_blocks;

CREATE POLICY "Form creators can add blocks" ON form_blocks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM forms
      WHERE forms.id = form_blocks.form_id
      AND forms.created_by_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

CREATE POLICY "Form creators can update blocks" ON form_blocks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM forms
      WHERE forms.id = form_blocks.form_id
      AND forms.created_by_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

CREATE POLICY "Form creators can delete blocks" ON form_blocks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM forms
      WHERE forms.id = form_blocks.form_id
      AND forms.created_by_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    )
  );

-- Step 7: Add form_submissions policies
DROP POLICY IF EXISTS "Managers can view team submissions" ON form_submissions;
DROP POLICY IF EXISTS "Users can update own draft submissions" ON form_submissions;

CREATE POLICY "Managers can view team submissions" ON form_submissions FOR SELECT
  USING (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND (r.name ILIKE '%manager%' OR r.name ILIKE '%admin%' OR r.name = 'Trike Super Admin')
    )
  );

CREATE POLICY "Users can update own draft submissions" ON form_submissions FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    AND status = 'draft'
  );

COMMIT;

-- =====================================================
-- PART 2: CREATE form_assignments TABLE
-- =====================================================

BEGIN;

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS form_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('user', 'store', 'district', 'role', 'group')),
  target_id UUID NOT NULL,
  assigned_by_id UUID REFERENCES users(id),
  due_date TIMESTAMPTZ,
  recurrence TEXT CHECK (recurrence IN ('none', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually')) DEFAULT 'none',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(form_id, assignment_type, target_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_form_assignments_org ON form_assignments(organization_id);
CREATE INDEX IF NOT EXISTS idx_form_assignments_form ON form_assignments(form_id);
CREATE INDEX IF NOT EXISTS idx_form_assignments_type_target ON form_assignments(assignment_type, target_id);
CREATE INDEX IF NOT EXISTS idx_form_assignments_due_date ON form_assignments(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_form_assignments_status ON form_assignments(status);
CREATE INDEX IF NOT EXISTS idx_form_assignments_assigned_by ON form_assignments(assigned_by_id);

-- Enable RLS
ALTER TABLE form_assignments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can view assignments in their org" ON form_assignments;
DROP POLICY IF EXISTS "Managers can create assignments" ON form_assignments;
DROP POLICY IF EXISTS "Creators and admins can update assignments" ON form_assignments;
DROP POLICY IF EXISTS "Admins can delete assignments" ON form_assignments;

CREATE POLICY "Users can view assignments in their org" ON form_assignments FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Managers can create assignments" ON form_assignments FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND (r.name ILIKE '%manager%' OR r.name ILIKE '%admin%' OR r.name = 'Trike Super Admin')
    )
  );

CREATE POLICY "Creators and admins can update assignments" ON form_assignments FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND (
      assigned_by_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.auth_user_id = auth.uid()
        AND (r.name ILIKE '%admin%' OR r.name = 'Trike Super Admin')
      )
    )
  )
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Admins can delete assignments" ON form_assignments FOR DELETE
  USING (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND (r.name ILIKE '%admin%' OR r.name = 'Trike Super Admin')
    )
  );

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS set_timestamp_form_assignments ON form_assignments;
CREATE TRIGGER set_timestamp_form_assignments
  BEFORE UPDATE ON form_assignments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

COMMIT;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these to verify migrations succeeded:

-- 1. Check all form tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'form%'
ORDER BY table_name;
-- Expected: form_assignments, form_blocks, form_submissions, forms

-- 2. Verify new columns on forms table
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'forms'
AND column_name IN ('created_by_id', 'type', 'category', 'requires_approval', 'allow_anonymous');
-- Expected: All 5 columns listed

-- 3. Check RLS policies
SELECT policy_name, table_name, cmd FROM pg_policies
WHERE table_name LIKE 'form%'
ORDER BY table_name, policy_name;
-- Should see multiple policies per table

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
