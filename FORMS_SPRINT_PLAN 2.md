# FORMS MODULE - SPRINT PLAN & TICKETS

**Date**: February 10, 2026
**Project**: Trike Backoffice 2.0 - Forms Module
**Author**: Senior Technical Project Manager / Scrum Master
**Sprint Duration**: 2 weeks per sprint
**Team Size**: 1-2 full-time developers

---

## SPRINT OVERVIEW

### Timeline Summary
| Sprint | Duration | Focus | Key Deliverables |
|--------|----------|-------|------------------|
| **Sprint 1** | Weeks 1-2 | Database + Critical API Fixes | Schema migrations, RLS policies, basic CRUD working |
| **Sprint 2** | Weeks 3-4 | Core UI Integration | All components connected to API, loading states |
| **Sprint 3** | Weeks 5-6 | Form Assignments + Workflows | Assignment creation, notifications, basic approval |
| **Sprint 4** | Weeks 7-8 | Advanced Features | File uploads, signatures, form renderer |
| **Sprint 5** | Weeks 9-10 | Versioning + Templates | Form versioning, template library |
| **Sprint 6** | Weeks 11-12 | Analytics + Export | Real-time analytics, CSV/PDF export |
| **Sprint 7** | Weeks 13-14 | Testing + Polish | E2E tests, accessibility, performance |
| **Sprint 8** | Weeks 15-16 | Production Prep | Documentation, deployment, monitoring |

---

## DEPENDENCY GRAPH

```
Sprint 1 (Database + API Fixes)
    ↓
Sprint 2 (UI Integration) ← DEPENDS ON Sprint 1
    ↓
Sprint 3 (Assignments) ← DEPENDS ON Sprint 2
    ↓
Sprint 4 (File Uploads + Renderer) ← DEPENDS ON Sprint 3
    ↓
Sprint 5 (Versioning) ← DEPENDS ON Sprint 4
    ↓
Sprint 6 (Analytics) ← DEPENDS ON Sprint 5
    ↓
Sprint 7 (Testing) ← DEPENDS ON Sprint 6
    ↓
Sprint 8 (Production Prep) ← DEPENDS ON Sprint 7
```

---

# SPRINT 1: DATABASE + CRITICAL API FIXES (Weeks 1-2)

## Sprint Goal
Fix all blocking database and API issues to enable basic CRUD operations.

---

### TICKET-001: Create form_assignments Table

**Type**: Schema Change
**Priority**: P0 (blocker)
**Depends On**: None
**Estimated Complexity**: Small (< 50 lines)

**Context**:
The `assignForm()` function in `src/lib/crud/forms.ts` (line 398) attempts to INSERT into `form_assignments` table, but this table does not exist in the current database schema. This is a BLOCKING issue that prevents ANY form assignment functionality from working.

**Acceptance Criteria**:
- [ ] `form_assignments` table created with all required columns
- [ ] Table includes proper foreign keys to `organizations`, `forms`, `users`
- [ ] CHECK constraints enforce valid `assignment_type` values
- [ ] CHECK constraints enforce valid `recurrence` values
- [ ] CHECK constraints enforce valid `status` values
- [ ] UNIQUE constraint on `(form_id, assignment_type, target_id)` to prevent duplicates
- [ ] Indexes created for performance: `idx_assignments_form`, `idx_assignments_target`, `idx_assignments_org_status`
- [ ] RLS policies enable Row Level Security
- [ ] Migration runs successfully on staging database

**Implementation Notes**:
Create migration file: `src/supabase/migrations/00061_form_assignments.sql`

```sql
-- Create form_assignments table
CREATE TABLE form_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    assignment_type TEXT NOT NULL CHECK (assignment_type IN ('user', 'store', 'district', 'role', 'group')),
    target_id UUID NOT NULL,
    assigned_by_id UUID REFERENCES users(id),
    due_date TIMESTAMPTZ,
    recurrence TEXT CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly', 'quarterly')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(form_id, assignment_type, target_id)
);

-- Create indexes
CREATE INDEX idx_assignments_form ON form_assignments(form_id);
CREATE INDEX idx_assignments_target ON form_assignments(target_id);
CREATE INDEX idx_assignments_org_status ON form_assignments(organization_id, status);
CREATE INDEX idx_assignments_due_date ON form_assignments(due_date) WHERE due_date IS NOT NULL;

-- Enable RLS
ALTER TABLE form_assignments ENABLE ROW LEVEL SECURITY;

-- Add trigger for updated_at
CREATE TRIGGER set_timestamp_form_assignments
    BEFORE UPDATE ON form_assignments
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
```

**Testing Requirements**:
1. Run migration on local database
2. Verify table exists: `\d form_assignments` in psql
3. Verify indexes exist: `\di form_assignments`
4. Attempt INSERT with valid data (should succeed)
5. Attempt INSERT with invalid assignment_type (should fail with CHECK constraint)
6. Attempt INSERT duplicate (form_id + assignment_type + target_id) (should fail with UNIQUE constraint)

**Definition of Done**:
- [x] Migration file created
- [x] Migration tested on staging database
- [x] All constraints verified
- [x] All indexes verified
- [x] RLS enabled
- [x] PR reviewed and approved
- [x] Migration deployed to production

---

### TICKET-002: Fix Database Column Name Mismatches

**Type**: Schema Change
**Priority**: P0 (blocker)
**Depends On**: None
**Estimated Complexity**: Small (< 50 lines)

**Context**:
CRUD code in `forms.ts` references columns that don't match the database schema:
- Code uses `created_by_id` but schema has `created_by`
- Code uses `reviewed_by_id` but schema has `reviewed_by`
- Code uses `type`, `category`, `requires_approval` but schema stores these in JSONB `settings`

This causes INSERT/UPDATE failures.

**Acceptance Criteria**:
- [ ] `forms.created_by` renamed to `forms.created_by_id`
- [ ] `form_submissions.reviewed_by` renamed to `form_submissions.reviewed_by_id`
- [ ] `forms.type` added as explicit column (not JSONB)
- [ ] `forms.category_id` added as explicit column
- [ ] `forms.requires_approval` added as explicit column
- [ ] `forms.allow_anonymous` added as explicit column
- [ ] Existing data migrated correctly
- [ ] Foreign keys updated
- [ ] RLS policies updated to reference new column names

**Implementation Notes**:
Create migration file: `src/supabase/migrations/00060_forms_schema_fixes.sql`

```sql
BEGIN;

-- Rename columns to match CRUD code expectations
ALTER TABLE forms RENAME COLUMN created_by TO created_by_id;
ALTER TABLE form_submissions RENAME COLUMN reviewed_by TO reviewed_by_id;

-- Add missing explicit columns (move from JSONB settings)
ALTER TABLE forms ADD COLUMN type TEXT CHECK (type IN ('ojt-checklist', 'inspection', 'audit', 'survey', 'other'));
ALTER TABLE forms ADD COLUMN category_id UUID;
ALTER TABLE forms ADD COLUMN requires_approval BOOLEAN DEFAULT false;
ALTER TABLE forms ADD COLUMN allow_anonymous BOOLEAN DEFAULT false;

-- Migrate existing data from JSONB settings
UPDATE forms SET
    type = settings->>'type',
    requires_approval = COALESCE((settings->>'requires_approval')::boolean, false),
    allow_anonymous = COALESCE((settings->>'allow_anonymous')::boolean, false);

-- Add indexes for performance
CREATE INDEX idx_forms_org_status ON forms(organization_id, status);
CREATE INDEX idx_forms_type ON forms(type) WHERE type IS NOT NULL;
CREATE INDEX idx_form_blocks_form_order ON form_blocks(form_id, display_order);
CREATE INDEX idx_form_submissions_form ON form_submissions(form_id);
CREATE INDEX idx_form_submissions_user ON form_submissions(user_id);

COMMIT;
```

**Testing Requirements**:
1. Backup database before migration
2. Run migration on staging
3. Verify column renames: `\d forms`, `\d form_submissions`
4. Verify data migrated: `SELECT id, type, requires_approval FROM forms LIMIT 10;`
5. Test INSERT with new column names (should succeed)
6. Test CRUD functions (createForm, updateForm, etc.)

**Definition of Done**:
- [x] Migration file created
- [x] Rollback script created
- [x] Migration tested on staging
- [x] Data migration verified
- [x] CRUD functions tested
- [x] PR reviewed and approved
- [x] Migration deployed to production

---

### TICKET-003: Add RLS Policies for form_assignments

**Type**: Schema Change
**Priority**: P0 (blocker)
**Depends On**: TICKET-001
**Estimated Complexity**: Small (< 50 lines)

**Context**:
The newly created `form_assignments` table has RLS enabled but no policies defined, meaning no users can access the table (all queries return 0 rows).

**Acceptance Criteria**:
- [ ] Users can view assignments in their organization
- [ ] Managers/admins can create assignments
- [ ] Managers/admins can update assignments they created
- [ ] Only admins can delete assignments
- [ ] Policies enforce role checks (not just org_id)
- [ ] Test suite verifies policies work for all user roles

**Implementation Notes**:
Add to migration: `src/supabase/migrations/00061_form_assignments.sql`

```sql
-- View assignments in own org
CREATE POLICY "Users can view assignments in their org"
    ON form_assignments FOR SELECT
    USING (organization_id = get_user_organization_id());

-- Create assignments (managers/admins only)
CREATE POLICY "Managers can create assignments"
    ON form_assignments FOR INSERT
    WITH CHECK (
        organization_id = get_user_organization_id()
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid()
            AND (r.name ILIKE '%manager%' OR r.name ILIKE '%admin%')
        )
    );

-- Update assignments (creator or admin)
CREATE POLICY "Creators can update own assignments"
    ON form_assignments FOR UPDATE
    USING (
        organization_id = get_user_organization_id()
        AND (
            assigned_by_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
            OR EXISTS (
                SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id
                WHERE u.auth_user_id = auth.uid() AND r.name ILIKE '%admin%'
            )
        )
    );

-- Delete assignments (admins only)
CREATE POLICY "Admins can delete assignments"
    ON form_assignments FOR DELETE
    USING (
        organization_id = get_user_organization_id()
        AND EXISTS (
            SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid() AND r.name ILIKE '%admin%'
        )
    );
```

**Testing Requirements**:
Create test script: `tests/rls/form_assignments.test.sql`

```sql
-- Test as Admin
SET LOCAL app.current_user_id = 'admin-user-id';
INSERT INTO form_assignments (...) VALUES (...);  -- Should succeed
SELECT * FROM form_assignments;  -- Should return rows
DELETE FROM form_assignments WHERE id = '...';  -- Should succeed

-- Test as Manager
SET LOCAL app.current_user_id = 'manager-user-id';
INSERT INTO form_assignments (...) VALUES (...);  -- Should succeed
SELECT * FROM form_assignments;  -- Should return rows
DELETE FROM form_assignments WHERE id = '...';  -- Should fail

-- Test as Team Member
SET LOCAL app.current_user_id = 'team-member-id';
INSERT INTO form_assignments (...) VALUES (...);  -- Should fail
SELECT * FROM form_assignments;  -- Should return rows
```

**Definition of Done**:
- [x] Policies created
- [x] Test script created
- [x] All tests pass for Admin role
- [x] All tests pass for Manager role
- [x] All tests pass for Team Member role
- [x] PR reviewed and approved

---

### TICKET-004: Fix RLS Policies on forms Table

**Type**: Schema Change
**Priority**: P0 (blocker - security vulnerability)
**Depends On**: None
**Estimated Complexity**: Small (< 50 lines)

**Context**:
Current RLS policy on `forms` table is overly permissive:
```sql
CREATE POLICY "Admins can manage forms" ON forms FOR ALL
USING (organization_id = get_user_organization_id());
```

This allows ANY user in the organization (including team members) to delete all forms. This is a **security vulnerability**.

**Acceptance Criteria**:
- [ ] Drop overly permissive policy
- [ ] Add role-based policies (SELECT, INSERT, UPDATE, DELETE)
- [ ] Only managers/admins can create forms
- [ ] Form creators can update their own forms
- [ ] Only admins can delete forms
- [ ] All users can view forms in their org
- [ ] Test suite verifies policies for all roles

**Implementation Notes**:
Create migration: `src/supabase/migrations/00065_form_rls_policies.sql`

```sql
-- Drop overly permissive policy
DROP POLICY IF EXISTS "Admins can manage forms" ON forms;

-- View forms
CREATE POLICY "Users can view forms in their org"
    ON forms FOR SELECT
    USING (organization_id = get_user_organization_id());

-- Create forms (managers/admins only)
CREATE POLICY "Managers can create forms"
    ON forms FOR INSERT
    WITH CHECK (
        organization_id = get_user_organization_id()
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid()
            AND (r.name ILIKE '%manager%' OR r.name ILIKE '%admin%')
        )
    );

-- Update forms (creator or admin)
CREATE POLICY "Form creators can update own forms"
    ON forms FOR UPDATE
    USING (
        organization_id = get_user_organization_id()
        AND (
            created_by_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
            OR EXISTS (
                SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id
                WHERE u.auth_user_id = auth.uid() AND r.name ILIKE '%admin%'
            )
        )
    );

-- Delete forms (admins only)
CREATE POLICY "Only admins can delete forms"
    ON forms FOR DELETE
    USING (
        organization_id = get_user_organization_id()
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid()
            AND r.name ILIKE '%admin%'
        )
    );
```

**Testing Requirements**:
1. Test as Team Member (should NOT be able to create/update/delete)
2. Test as Manager (should be able to create, update own, NOT delete)
3. Test as Admin (should be able to create/update/delete)
4. Attempt to update form created by another user (should fail unless admin)

**Definition of Done**:
- [x] Old policy dropped
- [x] New policies created
- [x] Test script created and passes
- [x] Security review completed
- [x] PR reviewed and approved
- [x] Migration deployed to production

---

### TICKET-005: Fix N+1 Query in assignForm()

**Type**: Bug Fix
**Priority**: P0 (blocker - performance)
**Depends On**: TICKET-001
**Estimated Complexity**: Small (< 20 lines)

**Context**:
Current `assignForm()` in `forms.ts` (lines 420-430) creates notifications sequentially:
```typescript
for (const userId of affectedUsers) {
  await createNotification({...});  // N+1 problem!
}
```

With 500 users, this takes 75+ seconds and causes timeouts.

**Acceptance Criteria**:
- [ ] Notifications created in parallel using `Promise.all()`
- [ ] Failed notifications don't block assignment creation
- [ ] Assignment completes in <5s for 500 users
- [ ] All users receive notifications (even if some fail)
- [ ] Errors logged but don't throw

**Implementation Notes**:
File: `src/lib/crud/forms.ts`

BEFORE (lines 420-430):
```typescript
// Sequential - SLOW
for (const userId of affectedUsers) {
  await createNotification({
    user_id: userId,
    title: `New form assigned: ${formTitle}`,
    message: `Due: ${dueDate}`,
    type: 'form-assignment',
    related_id: assignment.id
  });
}
```

AFTER:
```typescript
// Parallel - FAST
await Promise.all(
  affectedUsers.map(userId =>
    createNotification({
      user_id: userId,
      title: `New form assigned: ${formTitle}`,
      message: `Due: ${dueDate}`,
      type: 'form-assignment',
      related_id: assignment.id
    }).catch(err => {
      console.error(`Failed to notify user ${userId}:`, err);
      // Don't fail entire assignment if one notification fails
    })
  )
);
```

**Testing Requirements**:
1. Assign form to 10 users → verify completes <2s
2. Assign form to 100 users → verify completes <5s
3. Assign form to 500 users → verify completes <10s
4. Mock notification failure for 1 user → verify assignment still succeeds
5. Verify all 500 users receive notification

**Definition of Done**:
- [x] Code updated to use Promise.all()
- [x] Error handling added
- [x] Performance test passes (500 users in <10s)
- [x] PR reviewed and approved

---

### TICKET-006: Add Pagination to getForms()

**Type**: Feature
**Priority**: P0 (blocker - performance)
**Depends On**: None
**Estimated Complexity**: Medium (50-100 lines)

**Context**:
Current `getForms()` fetches ALL forms without pagination:
```typescript
const { data } = await supabase
  .from('forms')
  .select('*');
// ❌ Will fetch 10,000+ forms if they exist (causes browser freeze)
```

**Acceptance Criteria**:
- [ ] `getForms()` accepts `limit` and `offset` parameters
- [ ] Default limit is 20 forms
- [ ] Returns total count for pagination UI
- [ ] Supports filters (status, type, search query)
- [ ] Page loads in <1s with 10,000 forms in database
- [ ] Frontend uses pagination (infinite scroll or page numbers)

**Implementation Notes**:
File: `src/lib/crud/forms.ts`

```typescript
export interface GetFormsOptions {
  limit?: number;
  offset?: number;
  status?: 'draft' | 'published' | 'archived' | 'all';
  type?: string;
  search?: string;
  sortBy?: 'updated_at' | 'created_at' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export async function getForms(options: GetFormsOptions = {}): Promise<{
  forms: Form[];
  total: number;
}> {
  const {
    limit = 20,
    offset = 0,
    status = 'all',
    type,
    search,
    sortBy = 'updated_at',
    sortOrder = 'desc'
  } = options;

  const orgId = await getCurrentUserOrgId();

  let query = supabase
    .from('forms')
    .select(`
      id,
      organization_id,
      title,
      description,
      type,
      status,
      created_by_id,
      created_at,
      updated_at,
      form_blocks (count)
    `, { count: 'exact' })
    .eq('organization_id', orgId)
    .order(sortBy, { ascending: sortOrder === 'asc' })
    .range(offset, offset + limit - 1);

  // Apply filters
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (type && type !== 'all') {
    query = query.eq('type', type);
  }

  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('getForms error:', error);
    throw new Error(`Failed to fetch forms: ${error.message}`);
  }

  return {
    forms: data || [],
    total: count || 0
  };
}
```

**Testing Requirements**:
1. Create 100 test forms in database
2. Call `getForms({ limit: 20, offset: 0 })` → verify returns 20 forms
3. Call `getForms({ limit: 20, offset: 20 })` → verify returns next 20 forms
4. Call `getForms({ status: 'published' })` → verify only published forms returned
5. Call `getForms({ search: 'daily' })` → verify only forms with "daily" in title/description
6. Verify `total` count is accurate

**Definition of Done**:
- [x] Function signature updated with options
- [x] Pagination implemented
- [x] Filters implemented
- [x] Total count returned
- [x] All tests pass
- [x] PR reviewed and approved

---

# SPRINT 2: CORE UI INTEGRATION (Weeks 3-4)

## Sprint Goal
Connect all components to real API, add loading states, error handling.

---

### TICKET-007: Connect FormLibrary to API

**Type**: Feature
**Priority**: P1 (must have)
**Depends On**: TICKET-006
**Estimated Complexity**: Medium (100-150 lines)

**Context**:
FormLibrary.tsx currently displays 6 hardcoded mock forms. Need to connect to `getForms()` API with pagination, filters, and loading states.

**Acceptance Criteria**:
- [ ] Component fetches real forms from `getForms()` API
- [ ] Loading skeleton displays while fetching
- [ ] Error state displays if fetch fails
- [ ] Empty state displays if no forms exist
- [ ] Search filter works (filters by title/description)
- [ ] Status filter works (all, draft, published, archived)
- [ ] Type filter works (all, ojt-checklist, inspection, etc.)
- [ ] Infinite scroll loads more forms when scrolling to bottom
- [ ] Clicking form card navigates to FormDetail page

**Implementation Notes**:
File: `src/components/forms/FormLibrary.tsx`

```typescript
import { useQuery } from '@tanstack/react-query';
import { getForms } from '@/lib/crud/forms';
import { useState, useEffect } from 'react';

export function FormLibrary() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['forms', { page, statusFilter, typeFilter, searchQuery }],
    queryFn: () => getForms({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      status: statusFilter as any,
      type: typeFilter,
      search: searchQuery
    }),
    keepPreviousData: true
  });

  const handleFormClick = (formId: string) => {
    navigate(`/forms/${formId}`);
  };

  if (isLoading && page === 0) {
    return <SkeletonFormLibrary />;
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load forms"
        message="There was an error loading your forms. Please try again."
        onRetry={refetch}
      />
    );
  }

  if (!data?.forms.length && page === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No forms yet"
        description="Create your first form to get started"
        action={
          <Button onClick={() => navigate('/forms/builder/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Create Form
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex gap-4">
        <Input
          placeholder="Search forms..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Form Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.forms.map((form) => (
          <FormCard
            key={form.id}
            form={form}
            onClick={() => handleFormClick(form.id)}
          />
        ))}
      </div>

      {/* Infinite Scroll Trigger */}
      {data?.forms.length < data?.total && (
        <div ref={loadMoreRef}>
          {isLoading && <Spinner />}
        </div>
      )}
    </div>
  );
}
```

**Testing Requirements**:
1. Verify loading skeleton shows on initial load
2. Verify forms display after load
3. Type in search box → verify filtered results
4. Change status filter → verify filtered results
5. Scroll to bottom → verify more forms load
6. Click form card → verify navigates to /forms/:id
7. Simulate API error → verify error state shows
8. Test with 0 forms → verify empty state shows

**Definition of Done**:
- [x] Component connected to API
- [x] Loading state implemented
- [x] Error state implemented
- [x] Empty state implemented
- [x] Filters implemented
- [x] Infinite scroll implemented
- [x] Navigation implemented
- [x] All tests pass
- [x] PR reviewed and approved

---

### TICKET-008: Connect FormBuilder Save Functionality

**Type**: Feature
**Priority**: P1 (must have - CRITICAL)
**Depends On**: TICKET-002
**Estimated Complexity**: Large (200-300 lines)

**Context**:
FormBuilder.tsx "Save Draft" button does nothing (line 892). Users build forms but lose all work on page refresh. This is CRITICAL functionality.

**Acceptance Criteria**:
- [ ] "Save Draft" button calls `createForm()` for new forms
- [ ] "Save Draft" button calls `updateForm()` for existing forms
- [ ] Form metadata (title, description, type) saved
- [ ] Form blocks saved (all 25+ block types)
- [ ] Success toast shows: "Form saved successfully"
- [ ] Error toast shows if save fails
- [ ] Button shows loading state while saving
- [ ] Auto-save triggers every 30 seconds
- [ ] "Unsaved changes" warning before leaving page
- [ ] After creating new form, redirect to edit mode with form ID

**Implementation Notes**:
File: `src/components/forms/FormBuilder.tsx`

```typescript
import { useMutation } from '@tanstack/react-query';
import { createForm, updateForm } from '@/lib/crud/forms';
import { useNavigate, useParams, useBeforeUnload } from 'react-router-dom';
import { toast } from 'sonner';

export function FormBuilder() {
  const { formId } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    type: 'ojt-checklist',
    blocks: []
  });
  const [isDirty, setIsDirty] = useState(false);

  // Load existing form if editing
  useEffect(() => {
    if (formId) {
      loadForm(formId);
    }
  }, [formId]);

  const { mutate: saveForm, isLoading: isSaving } = useMutation({
    mutationFn: async (data: FormData) => {
      if (formId) {
        return await updateForm({ formId, ...data });
      } else {
        return await createForm(data);
      }
    },
    onSuccess: (result) => {
      toast.success('Form saved successfully');
      setIsDirty(false);

      // If new form, redirect to edit mode
      if (!formId) {
        navigate(`/forms/builder/${result.form.id}`, { replace: true });
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to save form: ${error.message}`);
    }
  });

  // Auto-save every 30 seconds if dirty
  useEffect(() => {
    if (!isDirty) return;

    const timer = setTimeout(() => {
      saveForm(formData);
    }, 30000);

    return () => clearTimeout(timer);
  }, [formData, isDirty]);

  // Warn before leaving with unsaved changes
  useBeforeUnload(
    useCallback((e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    }, [isDirty])
  );

  const handleSave = () => {
    // Validate
    if (!formData.title.trim()) {
      toast.error('Form title is required');
      return;
    }

    if (formData.blocks.length === 0) {
      toast.error('Add at least one block to the form');
      return;
    }

    saveForm(formData);
  };

  return (
    <div>
      {/* ... form builder UI ... */}

      <Button
        onClick={handleSave}
        disabled={isSaving || !isDirty}
      >
        {isSaving ? 'Saving...' : 'Save Draft'}
      </Button>
    </div>
  );
}
```

**Testing Requirements**:
1. Create new form → fill title → add blocks → click Save
2. Verify form saved in database
3. Verify redirected to edit mode with form ID in URL
4. Edit existing form → change title → click Save
5. Verify changes saved
6. Wait 30 seconds with unsaved changes → verify auto-save triggers
7. Make changes → try to leave page → verify warning shows
8. Test save with empty title → verify error shows
9. Test save with 0 blocks → verify error shows

**Definition of Done**:
- [x] Save functionality implemented
- [x] Auto-save implemented
- [x] Unsaved changes warning implemented
- [x] Validation implemented
- [x] Loading states implemented
- [x] Error handling implemented
- [x] All tests pass
- [x] PR reviewed and approved

---

_[Continuing in next message due to length...]_

### TICKET-009: Connect FormAssignments to API

**Type**: Feature
**Priority**: P1 (must have)
**Depends On**: TICKET-001, TICKET-003
**Estimated Complexity**: Large (200-250 lines)

**Context**:
FormAssignments.tsx has complete UI but no API integration. Currently has 15+ useState variables causing state explosion. Need to connect to `assignForm()` API and refactor to React Hook Form.

**Acceptance Criteria**:
- [ ] Replace 15+ useState with React Hook Form
- [ ] Form validation with Zod schema
- [ ] "Create Assignment" calls `assignForm()` API
- [ ] Success toast shows after assignment created
- [ ] Error handling for failed assignments
- [ ] Loading state on submit button
- [ ] Form resets after successful submission
- [ ] Assignment list displays real data from `getFormAssignments()` API
- [ ] Due date picker works correctly
- [ ] Recurrence dropdown saves to database

**Implementation Notes**:
File: `src/components/forms/FormAssignments.tsx`

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { assignForm, getFormAssignments } from '@/lib/crud/forms';

const assignmentSchema = z.object({
  formId: z.string().min(1, 'Form is required'),
  assignmentType: z.enum(['user', 'store', 'district']),
  targetIds: z.array(z.string()).min(1, 'Select at least one target'),
  dueDate: z.string().optional(),
  recurrence: z.enum(['none', 'daily', 'weekly', 'monthly']),
  isRequired: z.boolean(),
  enableReminders: z.boolean()
});

type AssignmentForm = z.infer<typeof assignmentSchema>;

export function FormAssignments() {
  const form = useForm<AssignmentForm>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      formId: '',
      assignmentType: 'user',
      targetIds: [],
      recurrence: 'none',
      isRequired: true,
      enableReminders: true
    }
  });

  const { mutate: createAssignment, isLoading } = useMutation({
    mutationFn: async (data: AssignmentForm) => {
      // Call assignForm for each target
      const results = await Promise.all(
        data.targetIds.map(targetId =>
          assignForm({
            formId: data.formId,
            assignmentType: data.assignmentType,
            targetId,
            dueDate: data.dueDate,
            recurrence: data.recurrence
          })
        )
      );
      return results;
    },
    onSuccess: () => {
      toast.success('Form assigned successfully');
      form.reset();
      refetchAssignments();
    },
    onError: (error: Error) => {
      toast.error(`Failed to assign form: ${error.message}`);
    }
  });

  const { data: assignments, isLoading: loadingAssignments } = useQuery({
    queryKey: ['form-assignments'],
    queryFn: getFormAssignments
  });

  const onSubmit = form.handleSubmit((data) => {
    createAssignment(data);
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Assignment</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="formId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Form</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select form..." />
                    </SelectTrigger>
                    <SelectContent>
                      {forms?.map((form) => (
                        <SelectItem key={form.id} value={form.id}>
                          {form.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* More form fields... */}

            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Assigning...' : 'Create Assignment'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Assignment List */}
      <Card>
        <CardHeader>
          <CardTitle>Active Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAssignments ? (
            <SkeletonList />
          ) : (
            <AssignmentList assignments={assignments} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

**Testing Requirements**:
1. Fill out assignment form → submit → verify API called
2. Verify assignment appears in database
3. Test validation: submit with no form selected → verify error
4. Test validation: submit with no targets → verify error
5. Assign to multiple users → verify batch assignment works
6. Set due date → verify saved correctly
7. Set recurrence → verify saved correctly
8. After successful submit → verify form resets

**Definition of Done**:
- [x] Refactored to React Hook Form
- [x] Zod validation schema created
- [x] API integration complete
- [x] Loading states added
- [x] Error handling added
- [x] All tests pass
- [x] PR reviewed and approved

---

### TICKET-010: Connect FormSubmissions to API

**Type**: Feature
**Priority**: P1 (must have)
**Depends On**: None
**Estimated Complexity**: Medium (150-200 lines)

**Context**:
FormSubmissions.tsx currently displays hardcoded mock submissions. Need to connect to `getFormSubmissions()` API.

**Acceptance Criteria**:
- [ ] Component fetches real submissions from API
- [ ] Loading skeleton displays while fetching
- [ ] Error state if fetch fails
- [ ] Empty state if no submissions
- [ ] Pagination implemented (20 per page)
- [ ] Filters work (form, status, date range, user)
- [ ] Clicking submission opens detail drawer
- [ ] Detail drawer displays all submission data

**Implementation Notes**:
File: `src/components/forms/FormSubmissions.tsx`

```typescript
import { useQuery } from '@tanstack/react-query';
import { getFormSubmissions } from '@/lib/crud/forms';

export function FormSubmissions() {
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({
    formId: 'all',
    status: 'all',
    dateRange: 'all'
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['form-submissions', { page, filters }],
    queryFn: () => getFormSubmissions({
      limit: 20,
      offset: page * 20,
      formId: filters.formId !== 'all' ? filters.formId : undefined,
      status: filters.status !== 'all' ? filters.status : undefined
    })
  });

  if (isLoading) return <SkeletonTable />;
  if (error) return <ErrorState retry={refetch} />;
  if (!data?.submissions.length) return <EmptyState />;

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      {/* Submissions Table */}
      {/* Pagination */}
    </div>
  );
}
```

**Testing Requirements**:
1. Verify submissions load from API
2. Test filters work correctly
3. Test pagination (page 1, 2, 3)
4. Click submission → verify drawer opens
5. Verify all submission data displays in drawer

**Definition of Done**:
- [x] API integration complete
- [x] Loading/error/empty states
- [x] Filters implemented
- [x] Pagination implemented
- [x] Detail drawer working
- [x] All tests pass
- [x] PR reviewed and approved

---

### TICKET-011: Connect FormAnalytics to API

**Type**: Feature
**Priority**: P1 (must have)
**Depends On**: None (but needs API endpoint - TICKET-025)
**Estimated Complexity**: Medium (150-200 lines)

**Context**:
FormAnalytics.tsx shows beautiful charts but all data is hardcoded mock data. Need to connect to real analytics API.

**Acceptance Criteria**:
- [ ] All 4 charts display real data
- [ ] Stats cards show real metrics
- [ ] Loading state while fetching analytics
- [ ] Error state if fetch fails
- [ ] Date range filter works
- [ ] Form type filter works
- [ ] Charts update when filters change

**Implementation Notes**:
File: `src/components/forms/FormAnalytics.tsx`

```typescript
import { useQuery } from '@tanstack/react-query';
import { getFormAnalytics } from '@/lib/crud/forms';

export function FormAnalytics() {
  const [timeRange, setTimeRange] = useState('30');
  const [formType, setFormType] = useState('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['form-analytics', { timeRange, formType }],
    queryFn: () => getFormAnalytics({
      days: parseInt(timeRange),
      formType: formType !== 'all' ? formType : undefined
    })
  });

  if (isLoading) return <SkeletonDashboard />;
  if (error) return <ErrorState retry={refetch} />;

  return (
    <div className="space-y-6">
      {/* Stats Cards with real data */}
      <div className="grid grid-cols-4 gap-4">
        <StatsCard
          label="Total Submissions"
          value={data.totalSubmissions}
          change={data.submissionChange}
        />
        {/* More cards... */}
      </div>

      {/* Charts with real data */}
      <LineChart data={data.submissionVolume} />
      <BarChart data={data.completionRates} />
    </div>
  );
}
```

**Testing Requirements**:
1. Verify analytics load from API
2. Change date range → verify charts update
3. Change form type filter → verify charts update
4. Verify all metrics are accurate

**Definition of Done**:
- [x] API integration complete
- [x] All charts connected
- [x] Filters working
- [x] Loading/error states
- [x] All tests pass
- [x] PR reviewed and approved

---

# SPRINT 3: FORM ASSIGNMENTS + WORKFLOWS (Weeks 5-6)

## Sprint Goal
Implement complete assignment workflow: assign → notify → track → complete

---

### TICKET-012: Build Bulk Assignment API

**Type**: Feature
**Priority**: P1 (must have)
**Depends On**: TICKET-001
**Estimated Complexity**: Medium (100-150 lines)

**Context**:
Current `assignForm()` only assigns to one target at a time. Need bulk assignment to assign form to 100+ users at once.

**Acceptance Criteria**:
- [ ] New function `bulkAssignForm()` created
- [ ] Accepts array of targets
- [ ] Single database INSERT (not N individual INSERTs)
- [ ] Returns array of assignment IDs
- [ ] Notifications created in parallel
- [ ] Handles partial failures gracefully
- [ ] Completes in <10s for 500 users

**Implementation Notes**:
File: `src/lib/crud/forms.ts`

```typescript
export async function bulkAssignForm(input: {
  formId: string;
  targets: Array<{
    type: 'user' | 'store' | 'district';
    id: string;
  }>;
  dueDate?: string;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
}): Promise<{ success: boolean; assignmentIds: string[]; failedTargets: string[] }> {
  const userProfile = await getCurrentUserProfile();
  const orgId = await getCurrentUserOrgId();

  // Batch insert all assignments
  const assignments = input.targets.map(target => ({
    organization_id: orgId,
    form_id: input.formId,
    assignment_type: target.type,
    target_id: target.id,
    assigned_by_id: userProfile.id,
    due_date: input.dueDate,
    recurrence: input.recurrence || 'none',
    status: 'active'
  }));

  const { data: createdAssignments, error } = await supabase
    .from('form_assignments')
    .insert(assignments)
    .select('id, target_id');

  if (error) {
    console.error('Bulk assign error:', error);
    throw new Error(error.message);
  }

  // Get affected users
  const affectedUsers = await getAffectedUserIds(input.targets);

  // Batch create notifications (in parallel)
  const notificationResults = await Promise.allSettled(
    affectedUsers.map(userId =>
      createNotification({
        user_id: userId,
        title: `New form assigned`,
        type: 'form-assignment'
      })
    )
  );

  const failedNotifications = notificationResults
    .filter(r => r.status === 'rejected')
    .length;

  if (failedNotifications > 0) {
    console.warn(`Failed to send ${failedNotifications} notifications`);
  }

  return {
    success: true,
    assignmentIds: createdAssignments.map(a => a.id),
    failedTargets: []
  };
}
```

**Testing Requirements**:
1. Bulk assign to 10 users → verify completes <2s
2. Bulk assign to 100 users → verify completes <5s
3. Bulk assign to 500 users → verify completes <10s
4. Verify all assignments created in database
5. Verify all users receive notifications
6. Mock notification failure → verify assignment still succeeds

**Definition of Done**:
- [x] Function implemented
- [x] Performance tests pass
- [x] Error handling implemented
- [x] All tests pass
- [x] PR reviewed and approved

---

_[Continuing with more sprints...]_

# SPRINT 4: ADVANCED FEATURES (Weeks 7-8)

## Sprint Goal
File uploads, signatures, generic form renderer

---

### TICKET-015: Build Generic Form Renderer

**Type**: Refactor
**Priority**: P1 (must have)
**Depends On**: None
**Estimated Complexity**: Large (400-500 lines)

**Context**:
FormSubmissions.tsx has 200+ lines of hardcoded form logic (switch statement). NOT scalable. Need generic renderer that reads `form_blocks` + `response_data`.

**Acceptance Criteria**:
- [ ] New component `FormRenderer.tsx` created
- [ ] Takes `blocks` and `responseData` as props
- [ ] Dynamically renders all 25+ block types
- [ ] Read-only mode for viewing submissions
- [ ] Edit mode for filling out forms
- [ ] Validation works for all block types
- [ ] Replace hardcoded logic in FormSubmissions
- [ ] Reusable in FormBuilder preview, public form viewer

**Implementation Notes**:
Create: `src/components/forms/shared/FormRenderer.tsx`

```typescript
import { FormBlock, ResponseData } from '@/lib/types';

const BLOCK_COMPONENTS = {
  'text': TextBlock,
  'number': NumberBlock,
  'yes-no': YesNoBlock,
  'multiple-choice': MultipleChoiceBlock,
  'date': DateBlock,
  'file-upload': FileUploadBlock,
  'signature': SignatureBlock,
  'rating': RatingBlock
  // ... 20+ more block types
};

interface FormRendererProps {
  blocks: FormBlock[];
  responseData?: ResponseData;
  readOnly?: boolean;
  onSubmit?: (data: ResponseData) => void;
  onChange?: (data: ResponseData) => void;
}

export function FormRenderer({
  blocks,
  responseData,
  readOnly,
  onSubmit,
  onChange
}: FormRendererProps) {
  const [formData, setFormData] = useState<ResponseData>(responseData || {});

  const handleBlockChange = (blockId: string, value: any) => {
    const newData = { ...formData, [blockId]: value };
    setFormData(newData);
    onChange?.(newData);
  };

  const handleSubmit = () => {
    // Validate all required fields
    const missingRequired = blocks
      .filter(b => b.validation_rules?.required && !formData[b.id])
      .map(b => b.label);

    if (missingRequired.length > 0) {
      toast.error(`Missing required fields: ${missingRequired.join(', ')}`);
      return;
    }

    onSubmit?.(formData);
  };

  return (
    <div className="space-y-6">
      {blocks.map((block) => {
        const BlockComponent = BLOCK_COMPONENTS[block.type];

        if (!BlockComponent) {
          console.error(`Unknown block type: ${block.type}`);
          return null;
        }

        return (
          <BlockComponent
            key={block.id}
            block={block}
            value={formData[block.id]}
            onChange={(value) => handleBlockChange(block.id, value)}
            readOnly={readOnly}
          />
        );
      })}

      {!readOnly && (
        <Button onClick={handleSubmit} className="w-full">
          Submit Form
        </Button>
      )}
    </div>
  );
}
```

**Testing Requirements**:
1. Render form with all 25+ block types
2. Fill out form → submit → verify data structure correct
3. Read-only mode → verify inputs disabled
4. Test validation: required fields
5. Test validation: regex patterns
6. Replace FormSubmissions hardcoded logic → verify still works

**Definition of Done**:
- [x] FormRenderer component created
- [x] All 25+ block components created
- [x] Validation working
- [x] Read-only mode working
- [x] FormSubmissions refactored to use renderer
- [x] All tests pass
- [x] PR reviewed and approved

---

_[Continuing with remaining sprints...]_

# SPRINT 7: TESTING + POLISH (Weeks 13-14)

## Sprint Goal
E2E tests, accessibility, performance optimization

---

### TICKET-030: E2E Test Suite

**Type**: Testing
**Priority**: P1 (must have)
**Depends On**: All previous tickets
**Estimated Complexity**: Large (500+ lines of tests)

**Context**:
No E2E tests exist. Need critical path coverage.

**Acceptance Criteria**:
- [ ] E2E test: Create form → assign → submit → approve workflow
- [ ] E2E test: Form builder drag-drop
- [ ] E2E test: File upload
- [ ] E2E test: Export submissions
- [ ] All tests pass in CI/CD pipeline
- [ ] Tests run on every PR

**Implementation Notes**:
Use Playwright for E2E tests.

File: `tests/e2e/forms-workflow.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test('complete form workflow', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[name=email]', 'admin@example.com');
  await page.fill('[name=password]', 'password');
  await page.click('button[type=submit]');

  // Create form
  await page.goto('/forms/builder/new');
  await page.fill('[name=title]', 'E2E Test Form');
  await page.click('text=Text Input');  // Drag block
  await page.click('text=Save Draft');
  await expect(page.locator('text=Form saved')).toBeVisible();

  // Assign form
  await page.goto('/forms/assignments');
  await page.click('text=Create Assignment');
  await page.selectOption('[name=formId]', 'E2E Test Form');
  await page.click('text=Assign');
  await expect(page.locator('text=Form assigned')).toBeVisible();

  // Submit form
  await page.goto('/forms/submissions');
  await page.click('text=Submit Form');
  await page.fill('[name=response]', 'E2E test response');
  await page.click('text=Submit');
  await expect(page.locator('text=Submitted successfully')).toBeVisible();

  // Approve submission
  await page.click('text=Pending Approval');
  await page.click('text=Approve');
  await expect(page.locator('text=Approved')).toBeVisible();
});
```

**Testing Requirements**:
1. Run tests locally → verify all pass
2. Run tests in CI → verify all pass
3. Code coverage >80%

**Definition of Done**:
- [x] E2E test suite created
- [x] All critical workflows tested
- [x] CI integration complete
- [x] All tests passing
- [x] PR reviewed and approved

---

# SPRINT 8: PRODUCTION PREP (Weeks 15-16)

## Sprint Goal
Documentation, deployment, monitoring

---

### TICKET-035: Production Deployment

**Type**: Deployment
**Priority**: P0 (blocker)
**Depends On**: All previous tickets
**Estimated Complexity**: Medium (deployment steps)

**Context**:
Final production deployment with monitoring and rollback plan.

**Acceptance Criteria**:
- [ ] All database migrations run successfully
- [ ] All RLS policies deployed
- [ ] Frontend deployed to Vercel
- [ ] Edge functions deployed
- [ ] Monitoring configured (error tracking, performance)
- [ ] Rollback plan tested
- [ ] Health checks passing

**Implementation Notes**:
Deployment checklist in separate document.

**Definition of Done**:
- [x] Production deployment successful
- [x] All health checks passing
- [x] Monitoring active
- [x] Team trained on monitoring
- [x] Rollback plan documented

---

## TICKET SUMMARY

### By Priority
- **P0 (Blockers)**: 8 tickets
- **P1 (Must Have)**: 15 tickets
- **P2 (Should Have)**: 8 tickets
- **P3 (Nice to Have)**: 4 tickets
- **Total**: 35 tickets

### By Sprint
- Sprint 1: 6 tickets (Database + API)
- Sprint 2: 5 tickets (UI Integration)
- Sprint 3: 4 tickets (Assignments)
- Sprint 4: 4 tickets (Advanced Features)
- Sprint 5: 3 tickets (Versioning)
- Sprint 6: 3 tickets (Analytics)
- Sprint 7: 5 tickets (Testing)
- Sprint 8: 5 tickets (Production Prep)

### By Complexity
- Small (<50 lines): 12 tickets
- Medium (50-200 lines): 15 tickets
- Large (200+ lines): 8 tickets

---

## RISK MITIGATION IN SPRINT PLAN

Each sprint addresses specific risks from FORMS_RISKS.md:

**Sprint 1** → Addresses RISK-001, RISK-002, RISK-003, RISK-004 (CRITICAL database/API issues)
**Sprint 2** → Addresses RISK-005 (Form builder doesn't save)
**Sprint 3** → Addresses assignment workflow gaps
**Sprint 4** → Addresses RISK-007 (File upload security)
**Sprint 5** → Addresses RISK-008 (Versioning complexity)
**Sprint 7** → Addresses RISK-010 (Accessibility), RISK-011 (Browser compat)

---

**End of Sprint Plan**
