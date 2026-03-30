-- Replace auth-session-dependent RLS policies on all form tables with open
-- demo-mode policies that use USING (true). auth.uid() returns NULL in demo
-- mode (no Supabase auth session), which would block every query.
-- Org-scoping is enforced at the application layer via ?demo_org_id= URL param.
-- Idempotent: safe to run multiple times.

-- =====================================================
-- forms table
-- =====================================================

-- Drop all known policy names from initial schema and any subsequent migrations.
DROP POLICY IF EXISTS "Users can view published forms" ON forms;
DROP POLICY IF EXISTS "Admins can manage forms" ON forms;
DROP POLICY IF EXISTS "forms_org_access" ON forms;
DROP POLICY IF EXISTS "Users can view forms in their organization" ON forms;
DROP POLICY IF EXISTS "forms_select_policy" ON forms;
DROP POLICY IF EXISTS "forms_insert_policy" ON forms;
DROP POLICY IF EXISTS "forms_update_policy" ON forms;
DROP POLICY IF EXISTS "forms_delete_policy" ON forms;

DROP POLICY IF EXISTS "forms_open_demo" ON forms;
CREATE POLICY "forms_open_demo" ON forms
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- form_blocks table
-- =====================================================

DROP POLICY IF EXISTS "Users can view form blocks" ON form_blocks;
DROP POLICY IF EXISTS "Admins can manage form blocks" ON form_blocks;
DROP POLICY IF EXISTS "form_blocks_org_access" ON form_blocks;
DROP POLICY IF EXISTS "form_blocks_select_policy" ON form_blocks;
DROP POLICY IF EXISTS "form_blocks_insert_policy" ON form_blocks;
DROP POLICY IF EXISTS "form_blocks_update_policy" ON form_blocks;
DROP POLICY IF EXISTS "form_blocks_delete_policy" ON form_blocks;

DROP POLICY IF EXISTS "form_blocks_open_demo" ON form_blocks;
CREATE POLICY "form_blocks_open_demo" ON form_blocks
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- form_submissions table
-- =====================================================

DROP POLICY IF EXISTS "Users can view their own submissions" ON form_submissions;
DROP POLICY IF EXISTS "Users can submit forms" ON form_submissions;
DROP POLICY IF EXISTS "form_submissions_org_access" ON form_submissions;
DROP POLICY IF EXISTS "Users can view their submissions" ON form_submissions;
DROP POLICY IF EXISTS "form_submissions_select_policy" ON form_submissions;
DROP POLICY IF EXISTS "form_submissions_insert_policy" ON form_submissions;
DROP POLICY IF EXISTS "form_submissions_update_policy" ON form_submissions;
DROP POLICY IF EXISTS "form_submissions_delete_policy" ON form_submissions;

DROP POLICY IF EXISTS "form_submissions_open_demo" ON form_submissions;
CREATE POLICY "form_submissions_open_demo" ON form_submissions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- form_assignments table
-- This table does not exist in the initial schema but may be created by
-- other agents. We enable RLS and set the open-demo policy defensively.
-- The DO block makes this non-fatal if the table does not yet exist.
-- =====================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'form_assignments'
  ) THEN
    EXECUTE 'ALTER TABLE form_assignments ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS "form_assignments_org_access" ON form_assignments';
    EXECUTE 'DROP POLICY IF EXISTS "form_assignments_select_policy" ON form_assignments';
    EXECUTE 'DROP POLICY IF EXISTS "form_assignments_insert_policy" ON form_assignments';
    EXECUTE 'DROP POLICY IF EXISTS "form_assignments_update_policy" ON form_assignments';
    EXECUTE 'DROP POLICY IF EXISTS "form_assignments_delete_policy" ON form_assignments';
    EXECUTE 'DROP POLICY IF EXISTS "form_assignments_open_demo" ON form_assignments';

    EXECUTE $policy$
      CREATE POLICY "form_assignments_open_demo" ON form_assignments
        FOR ALL
        USING (true)
        WITH CHECK (true)
    $policy$;
  END IF;
END;
$$;
