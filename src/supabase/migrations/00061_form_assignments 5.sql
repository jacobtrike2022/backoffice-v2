-- =====================================================
-- FORM ASSIGNMENTS TABLE
-- =====================================================
-- Migration: 00061_form_assignments.sql
-- Purpose: Create the missing form_assignments table
-- Context: This table is referenced in src/lib/crud/forms.ts (line 398)
--          but doesn't exist in the schema, causing all assignment
--          operations to fail.
-- =====================================================

BEGIN;

-- =====================================================
-- CREATE form_assignments TABLE
-- =====================================================

CREATE TABLE form_assignments (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Organization scoping (multi-tenant safety)
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Which form is being assigned
  form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,

  -- Assignment target
  -- Can assign to: user, store, district, role, or group
  assignment_type TEXT NOT NULL CHECK (assignment_type IN (
    'user',      -- Assign to specific user
    'store',     -- Assign to all users in a store
    'district',  -- Assign to all users in a district
    'role',      -- Assign to all users with a specific role
    'group'      -- Assign to a custom group (future feature)
  )),

  -- ID of the target (user_id, store_id, district_id, role_id, or group_id)
  target_id UUID NOT NULL,

  -- Assignment metadata
  assigned_by_id UUID REFERENCES users(id),

  -- Scheduling
  due_date TIMESTAMPTZ,
  recurrence TEXT CHECK (recurrence IN (
    'none',
    'daily',
    'weekly',
    'biweekly',
    'monthly',
    'quarterly',
    'annually'
  )) DEFAULT 'none',

  -- Status tracking
  status TEXT DEFAULT 'active' CHECK (status IN (
    'active',      -- Currently active assignment
    'completed',   -- All recipients have completed
    'expired',     -- Past due date
    'cancelled'    -- Manually cancelled by admin
  )),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate assignments
  -- Same form can't be assigned to same target with same type twice
  UNIQUE(form_id, assignment_type, target_id)
);

-- =====================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Query: "Get all assignments in my org"
CREATE INDEX idx_form_assignments_org
  ON form_assignments(organization_id);

-- Query: "Get all assignments for a form"
-- SELECT * FROM form_assignments WHERE form_id = X
CREATE INDEX idx_form_assignments_form
  ON form_assignments(form_id);

-- Query: "Get assignments for a specific target"
-- SELECT * FROM form_assignments WHERE assignment_type = 'store' AND target_id = X
CREATE INDEX idx_form_assignments_type_target
  ON form_assignments(assignment_type, target_id);

-- Query: "Get assignments due soon"
-- SELECT * FROM form_assignments WHERE due_date < NOW() + INTERVAL '7 days'
CREATE INDEX idx_form_assignments_due_date
  ON form_assignments(due_date)
  WHERE due_date IS NOT NULL;

-- Query: "Get active assignments"
-- SELECT * FROM form_assignments WHERE status = 'active'
CREATE INDEX idx_form_assignments_status
  ON form_assignments(status);

-- Query: "Get assignments created by me"
-- SELECT * FROM form_assignments WHERE assigned_by_id = X
CREATE INDEX idx_form_assignments_assigned_by
  ON form_assignments(assigned_by_id);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE form_assignments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- READ: Users can view assignments in their organization
-- This allows all users to see what forms are assigned
CREATE POLICY "Users can view assignments in their org"
  ON form_assignments FOR SELECT
  USING (organization_id = get_user_organization_id());

-- CREATE: Only managers/admins can create assignments
-- Team members should not be able to assign forms
CREATE POLICY "Managers can create assignments"
  ON form_assignments FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND (r.name ILIKE '%manager%' OR r.name ILIKE '%admin%' OR r.name = 'Trike Super Admin')
    )
  );

-- UPDATE: Assignment creators and admins can update assignments
-- Allows the person who created the assignment to modify it
CREATE POLICY "Creators and admins can update assignments"
  ON form_assignments FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND (
      -- Creator can update their own assignments
      assigned_by_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
      -- OR user is admin
      OR EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.auth_user_id = auth.uid()
        AND (r.name ILIKE '%admin%' OR r.name = 'Trike Super Admin')
      )
    )
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
  );

-- DELETE: Only admins can delete assignments
-- Prevents accidental deletion by managers
CREATE POLICY "Admins can delete assignments"
  ON form_assignments FOR DELETE
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
-- TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp on UPDATE
CREATE TRIGGER set_timestamp_form_assignments
  BEFORE UPDATE ON form_assignments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

COMMIT;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Summary:
-- ✅ Created form_assignments table with proper structure
-- ✅ Added 6 indexes for common query patterns
-- ✅ Enabled Row Level Security
-- ✅ Added 4 RLS policies (SELECT, INSERT, UPDATE, DELETE)
-- ✅ Added trigger for auto-updating updated_at
-- ✅ Prevents duplicate assignments with UNIQUE constraint
--
-- This table enables the assignForm() function in CRUD layer
-- to work correctly (src/lib/crud/forms.ts line 398)
-- =====================================================
