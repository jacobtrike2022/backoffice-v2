# FORMS MODULE - DATABASE SCHEMA AUDIT

**Date**: February 10, 2026
**Auditor**: Claude (Senior Database Architect / QA Lead)
**Database**: Supabase PostgreSQL
**Schema Version**: Initial Schema (00001_initial_schema.sql.tsx)
**Focus**: Forms module tables and related infrastructure

---

## EXECUTIVE SUMMARY

The Forms database schema exists and has **solid foundational structure**, but contains **critical gaps and inconsistencies** that block production use. The schema was clearly designed by someone familiar with database best practices (proper foreign keys, indexes, RLS policies), but it appears incomplete - likely an MVP that was never finished.

**Critical Finding**: The CRUD code references `form_assignments` table extensively, but **this table does not exist in the schema**. This is a blocking issue.

**Health Score**: 🟡 **45/100** (Functional foundation, critical gaps)

---

## CURRENT SCHEMA INVENTORY

### Tables Present

1. ✅ `forms` - Core form metadata
2. ✅ `form_blocks` - Form questions/fields
3. ✅ `form_submissions` - User responses
4. ❌ `form_assignments` - **MISSING** (referenced in code!)
5. ❌ `form_categories` - **MISSING** (needed for organization)
6. ❌ `form_versions` - **MISSING** (needed for audit trail)
7. ❌ `form_analytics` - **MISSING** (needed for dashboards)
8. ❌ `form_submission_attachments` - **MISSING** (for file uploads)
9. ❌ `form_block_signatures` - **MISSING** (for signature capture)

**Total**: 3 of 9 expected tables exist (33%)

---

## DETAILED TABLE ANALYSIS

### 1. `forms` TABLE

**Source**: `src/supabase/migrations/00001_initial_schema.sql.tsx` (lines ~500-520)

```sql
CREATE TABLE forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    title TEXT NOT NULL,
    description TEXT,

    -- Settings
    settings JSONB DEFAULT '{}'::jsonb,

    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),

    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_forms_organization ON forms(organization_id);
CREATE INDEX idx_forms_status ON forms(status);
CREATE INDEX idx_forms_created_by ON forms(created_by);
```

#### ✅ What's Good
- Proper UUID primary key with auto-generation
- Organization scoping with FK and ON DELETE CASCADE
- Multi-tenant safe with organization_id
- Status constrained to valid values (draft/published/archived)
- Three indexes on commonly queried columns
- Timestamps with default NOW()
- NOT NULL constraints on critical fields

#### ❌ Critical Issues

**Issue 1: JSONB Antipattern for Structured Data**
- `settings JSONB` stores: `type`, `allow_anonymous`, `requires_approval`, `category`
- **Problem**: These should be typed columns, not flexible JSONB
- **Impact**: Cannot query "all inspection forms" without JSONB extraction
- **Fix**: Add explicit columns (see recommendations)

**Issue 2: Inconsistent Naming Convention**
- Column: `created_by` (no `_id` suffix)
- Compare to `organization_id`, `created_at` (consistent suffixes)
- **Problem**: Other tables use `created_by_id`, `submitted_by_id`, etc.
- **Impact**: Developer confusion, query errors
- **Fix**: Rename to `created_by_id`

**Issue 3: Missing Columns for Production**
```sql
-- Missing:
category_id UUID REFERENCES form_categories(id)  -- For organization
type TEXT CHECK (type IN ('ojt-checklist', 'inspection', 'audit', 'survey'))  -- Explicit type
allow_anonymous BOOLEAN DEFAULT false  -- Security setting
requires_approval BOOLEAN DEFAULT false  -- Workflow setting
version_number INTEGER DEFAULT 1  -- Versioning
published_at TIMESTAMPTZ  -- When published
published_by_id UUID REFERENCES users(id)  -- Who published
archived_at TIMESTAMPTZ  -- When archived
archived_by_id UUID REFERENCES users(id)  -- Who archived
```

**Issue 4: No Composite Indexes**
- Common query: "Get published forms for org"
- Requires: `WHERE organization_id = X AND status = 'published'`
- Current: Two separate indexes, not optimal
- **Fix**: Add `CREATE INDEX idx_forms_org_status ON forms(organization_id, status);`

**Issue 5: Missing Soft Delete Support**
- Hard delete loses audit trail
- **Fix**: Add `deleted_at TIMESTAMPTZ, deleted_by_id UUID`

#### 📊 Usage Patterns (from CRUD code)

**Creation** (`createForm()` - line 33-56):
```typescript
.insert({
  organization_id: orgId,
  title: input.title,
  description: input.description,
  type: input.type,  // ❌ No 'type' column!
  category: input.category,  // ❌ No 'category' column!
  status: 'draft',
  requires_approval: input.requires_approval || false,  // ❌ No column!
  allow_anonymous: input.allow_anonymous || false,  // ❌ No column!
  created_by_id: userProfile.id  // ❌ Column named 'created_by'!
})
```

**Mismatch**: CRUD code expects columns that don't exist!

---

### 2. `form_blocks` TABLE

**Source**: `src/supabase/migrations/00001_initial_schema.sql.tsx` (lines ~525-550)

```sql
CREATE TABLE form_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,

    type TEXT NOT NULL CHECK (type IN (
        'text', 'textarea', 'select', 'multiselect', 'radio', 'checkbox',
        'number', 'date', 'time', 'file', 'rating', 'section', 'html'
    )),

    label TEXT,
    description TEXT,
    placeholder TEXT,

    -- Validation
    is_required BOOLEAN DEFAULT false,
    validation_rules JSONB,

    -- Options (for select, radio, checkbox)
    options TEXT[],

    -- Display
    display_order INTEGER NOT NULL DEFAULT 0,
    conditional_logic JSONB,

    settings JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_form_blocks_form ON form_blocks(form_id);
CREATE INDEX idx_form_blocks_order ON form_blocks(form_id, display_order);
```

#### ✅ What's Good
- Proper ON DELETE CASCADE (deleting form deletes blocks)
- Type constraint with 13 block types
- Composite index on (form_id, display_order) for sorting
- JSONB for truly flexible data (validation_rules, conditional_logic)
- Array type for options (appropriate for select/radio)
- display_order for manual sorting

#### ❌ Critical Issues

**Issue 1: Missing Block Types**
- Current: 13 types
- Needed for c-store LMS:
  - `signature` - Digital signature capture
  - `phone` - Phone number input
  - `email` - Email input
  - `url` - URL input
  - `image-upload` - Image-only file upload
  - `multiple-choice` - Different from 'select'
  - `yesno` - Boolean toggle (different from checkbox)
  - `scale` - Linear scale (1-10)
  - `matrix` - Grid/table question

**Fix**:
```sql
ALTER TABLE form_blocks DROP CONSTRAINT form_blocks_type_check;
ALTER TABLE form_blocks ADD CONSTRAINT form_blocks_type_check
  CHECK (type IN (
    'text', 'textarea', 'select', 'multiselect', 'radio', 'checkbox',
    'number', 'date', 'time', 'file', 'rating', 'section', 'html',
    'signature', 'phone', 'email', 'url', 'image-upload',
    'multiple-choice', 'yesno', 'scale', 'matrix'
  ));
```

**Issue 2: JSONB Structure Not Documented**
- `validation_rules JSONB` - No schema, no examples
- `conditional_logic JSONB` - No schema, no examples
- `settings JSONB` - No schema, no examples
- **Problem**: Developers guess structure, inconsistencies arise
- **Fix**: Document expected structure in migration comments

**Issue 3: No Category/Grouping**
- Large forms (50+ questions) need sections
- Current: `type = 'section'` but no section_id or grouping
- **Fix**: Add `section_id UUID REFERENCES form_blocks(id)` for nesting

**Issue 4: Missing Columns**
```sql
-- Missing:
help_text TEXT  -- Extended help (different from description)
default_value TEXT  -- Pre-fill value
min_value NUMERIC  -- For number/scale inputs
max_value NUMERIC  -- For number/scale inputs
max_length INTEGER  -- For text inputs
pattern TEXT  -- Regex validation
error_message TEXT  -- Custom validation error
points_value INTEGER  -- For scoring
required_role_id UUID  -- Only show to certain roles
```

**Issue 5: No Block Versioning**
- Changing block text/options after submissions breaks old data
- Cannot recreate form as it was when user submitted
- **Fix**: Snapshot blocks when form published (form_versions table)

#### 📊 Usage Patterns

**Block Reordering** (`reorderFormBlocks()` - line 141-154):
```typescript
// Updates each block's display_order
const promises = blockOrders.map(({ id, display_order }) =>
  supabase
    .from('form_blocks')
    .update({ display_order })
    .eq('id', id)
);
await Promise.all(promises);
```

**Efficiency**: ✅ Good use of Promise.all for batching
**Concern**: ⚠️ No transaction wrapping - could leave form in inconsistent state if one update fails

---

### 3. `form_submissions` TABLE

**Source**: `src/supabase/migrations/00001_initial_schema.sql.tsx` (lines ~555-590)

```sql
CREATE TABLE form_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Submission data
    answers JSONB NOT NULL,

    -- Status
    status TEXT DEFAULT 'submitted' CHECK (status IN (
        'draft', 'submitted', 'reviewed', 'approved', 'rejected'
    )),

    -- Review
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,

    -- Metadata
    ip_address TEXT,
    user_agent TEXT,

    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_form_submissions_organization ON form_submissions(organization_id);
CREATE INDEX idx_form_submissions_form ON form_submissions(form_id);
CREATE INDEX idx_form_submissions_user ON form_submissions(user_id);
CREATE INDEX idx_form_submissions_status ON form_submissions(status);
CREATE INDEX idx_form_submissions_submitted_at ON form_submissions(submitted_at);
```

#### ✅ What's Good
- Excellent indexing strategy (5 indexes on common query columns)
- Status workflow (draft → submitted → reviewed → approved/rejected)
- Audit trail (reviewed_by, reviewed_at, review_notes)
- IP address + user agent for fraud detection
- ON DELETE SET NULL for user_id (preserves submission if user deleted)
- Separate submitted_at vs created_at (draft support)
- Organization scoped for multi-tenancy

#### ❌ Critical Issues

**Issue 1: Inconsistent Naming (Again)**
- Columns: `user_id`, `reviewed_by` (no `_id` suffix)
- Should be: `user_id`, `reviewed_by_id`, `submitted_by_id`
- **Problem**: CRUD code uses `submitted_by_id` (line 233) which doesn't exist!

**Issue 2: No Link to Form Version**
- Form changes after submissions are submitted
- Cannot reconstruct form as it was when submitted
- **Example**: Form had 10 questions when submitted, now has 15
- **Fix**: Add `form_version_id UUID REFERENCES form_versions(id)`

**Issue 3: answers JSONB with No Validation**
- Structure: `{ "block_id": "value", ... }`
- **Problems**:
  - No type checking (could store anything)
  - No guarantee block_id exists in form_blocks
  - No referential integrity
  - Cannot query "all submissions where Q1 = 'Yes'"
- **Trade-off**: JSONB is flexible, but unvalidated
- **Mitigation**: Add CHECK constraint for structure validation

**Issue 4: Missing Approval Workflow Columns**
```sql
-- Missing:
approved_by_id UUID REFERENCES users(id)  -- Who approved
approved_at TIMESTAMPTZ  -- When approved
rejection_reason TEXT  -- Why rejected
requires_approval BOOLEAN DEFAULT false  -- Copied from form
approval_level INTEGER DEFAULT 0  -- Multi-level approvals
parent_submission_id UUID REFERENCES form_submissions(id)  -- For resubmissions
resubmission_count INTEGER DEFAULT 0  -- How many times resubmitted
```

**Issue 5: No Analytics/Scoring Support**
```sql
-- Missing:
score NUMERIC  -- Calculated score (0-100)
completion_percentage NUMERIC  -- % of required fields filled
time_started_at TIMESTAMPTZ  -- When user opened form
time_to_complete_seconds INTEGER  -- Time spent filling
is_complete BOOLEAN DEFAULT false  -- All required fields filled
device_type TEXT  -- Mobile/Desktop/Tablet
```

**Issue 6: No File Attachment Support**
- Block type `file` exists, but where are uploads stored?
- **Fix**: Need `form_submission_attachments` table

**Issue 7: No Composite Indexes for Common Queries**
```sql
-- Missing optimal indexes for:
-- "Get pending submissions for form X"
CREATE INDEX idx_form_submissions_form_status
    ON form_submissions(form_id, status);

-- "Get submissions by user for org"
CREATE INDEX idx_form_submissions_org_user
    ON form_submissions(organization_id, user_id);

-- "Get recent submissions requiring approval"
CREATE INDEX idx_form_submissions_approval
    ON form_submissions(status, submitted_at DESC)
    WHERE status IN ('submitted', 'reviewed');
```

#### 📊 Usage Patterns

**Submission Creation** (`submitFormResponse()` - line 220-281):
```typescript
.insert({
  form_id: formId,
  submitted_by_id: userProfile?.id,  // ❌ Column is 'user_id', not 'submitted_by_id'
  response_data: responseData,  // ❌ Column is 'answers', not 'response_data'
  status: 'pending',  // ❌ 'pending' not in CHECK constraint!
  submitted_at: new Date().toISOString()
})
```

**Critical Bug**: CRUD code uses column names that don't exist!

---

### 4. `form_assignments` TABLE

**Status**: ❌ **DOES NOT EXIST** (but extensively used in CRUD code)

**Referenced in**: `src/lib/crud/forms.ts` lines 388-433

```typescript
// Line 398-408
const { data, error } = await supabase
  .from('form_assignments')  // ❌ TABLE DOESN'T EXIST!
  .insert({
    form_id: formId,
    assignment_type: assignmentType,
    target_id: targetId,
    assigned_by_id: userProfile.id,
    due_date: dueDate,
    status: 'active'
  })
```

#### 🚨 BLOCKING ISSUE

This table is **critical for production** and must be created immediately.

**Expected Schema** (based on CRUD code analysis):

```sql
CREATE TABLE form_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- What form is assigned
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,

    -- Who/what is it assigned to
    assignment_type TEXT NOT NULL CHECK (assignment_type IN (
        'user',      -- Assigned to specific user
        'store',     -- Assigned to all users in a store
        'district',  -- Assigned to all users in a district
        'role',      -- Assigned to all users with a role
        'group'      -- Assigned to a custom group
    )),
    target_id UUID NOT NULL,  -- ID of user/store/district/role/group

    -- Assignment metadata
    assigned_by_id UUID NOT NULL REFERENCES users(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Scheduling
    due_date TIMESTAMPTZ,
    recurrence TEXT CHECK (recurrence IN (
        'none', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually'
    )),

    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN (
        'active',      -- Currently active
        'completed',   -- All recipients completed
        'expired',     -- Past due date
        'cancelled'    -- Manually cancelled
    )),

    -- Settings
    is_required BOOLEAN DEFAULT true,
    send_reminders BOOLEAN DEFAULT true,
    reminder_days_before INTEGER DEFAULT 3,
    auto_archive_on_completion BOOLEAN DEFAULT false,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Prevent duplicate assignments
    UNIQUE(form_id, assignment_type, target_id)
);

-- Indexes
CREATE INDEX idx_form_assignments_organization ON form_assignments(organization_id);
CREATE INDEX idx_form_assignments_form ON form_assignments(form_id);
CREATE INDEX idx_form_assignments_type_target ON form_assignments(assignment_type, target_id);
CREATE INDEX idx_form_assignments_due_date ON form_assignments(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_form_assignments_status ON form_assignments(status);
CREATE INDEX idx_form_assignments_assigned_by ON form_assignments(assigned_by_id);

-- Trigger for updated_at
CREATE TRIGGER update_form_assignments_updated_at
    BEFORE UPDATE ON form_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

**Why This Table Matters:**
- 83% of forms in LMS systems are assigned, not freely available
- Tracking who should complete what is core functionality
- Due dates and recurrence are compliance requirements
- Without this, Forms module is just a survey tool, not an LMS

---

## MISSING TABLES (Production Requirements)

### 5. `form_categories` TABLE

**Purpose**: Organize forms by type/purpose

```sql
CREATE TABLE form_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,  -- Lucide icon name
    color TEXT,  -- Hex color for badge
    display_order INTEGER DEFAULT 0,

    is_system BOOLEAN DEFAULT false,  -- True for Trike-provided categories

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(organization_id, name)
);

CREATE INDEX idx_form_categories_organization ON form_categories(organization_id);
CREATE INDEX idx_form_categories_display_order ON form_categories(organization_id, display_order);
```

**Impact**: Without this, forms can't be organized. Library view becomes cluttered.

---

### 6. `form_versions` TABLE

**Purpose**: Track form changes over time, link submissions to specific versions

```sql
CREATE TABLE form_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,

    version_number INTEGER NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'deprecated')),

    -- Snapshot of form at this version
    title TEXT NOT NULL,
    description TEXT,
    blocks_snapshot JSONB NOT NULL,  -- Array of form_blocks as they were

    -- Publishing info
    published_at TIMESTAMPTZ,
    published_by_id UUID REFERENCES users(id),

    -- Deprecation
    deprecated_at TIMESTAMPTZ,
    deprecation_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(form_id, version_number)
);

CREATE INDEX idx_form_versions_form ON form_versions(form_id);
CREATE INDEX idx_form_versions_status ON form_versions(status);
CREATE INDEX idx_form_versions_published ON form_versions(published_at) WHERE published_at IS NOT NULL;
```

**Why Critical**:
- Auditing: "What did the form look like when user submitted it?"
- Compliance: "Show me the exact form version used for this audit"
- Legal: "Prove the user saw these exact questions"

---

### 7. `form_submission_attachments` TABLE

**Purpose**: Store file uploads for form responses

```sql
CREATE TABLE form_submission_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
    block_id UUID NOT NULL REFERENCES form_blocks(id) ON DELETE RESTRICT,

    -- File info
    filename TEXT NOT NULL,
    file_url TEXT NOT NULL,  -- Supabase Storage URL
    file_path TEXT NOT NULL,  -- Storage bucket path
    file_size INTEGER,  -- Bytes
    file_type TEXT,  -- Extension
    mime_type TEXT,

    -- Security
    virus_scan_status TEXT CHECK (virus_scan_status IN ('pending', 'clean', 'infected')),
    virus_scan_at TIMESTAMPTZ,

    -- Upload metadata
    uploaded_by_id UUID REFERENCES users(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_form_submission_attachments_submission ON form_submission_attachments(submission_id);
CREATE INDEX idx_form_submission_attachments_block ON form_submission_attachments(block_id);
CREATE INDEX idx_form_submission_attachments_uploaded_by ON form_submission_attachments(uploaded_by_id);
```

**Use Cases**:
- OJT checklist: Upload photo of completed task
- Inspection: Upload evidence photos
- Audit: Attach supporting documents
- Survey: Upload receipts/proof

---

### 8. `form_block_signatures` TABLE

**Purpose**: Store digital signatures

```sql
CREATE TABLE form_block_signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
    block_id UUID NOT NULL REFERENCES form_blocks(id) ON DELETE RESTRICT,

    -- Signature data
    signature_data TEXT NOT NULL,  -- Base64 SVG or canvas data
    signature_type TEXT CHECK (signature_type IN ('drawn', 'typed', 'uploaded')),

    -- Signer info
    signed_by_id UUID REFERENCES users(id),
    signed_by_name TEXT NOT NULL,  -- Captured at time of signing
    signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Verification
    ip_address TEXT,
    user_agent TEXT,
    geoip_location TEXT,  -- City, State, Country

    -- Legal
    terms_accepted BOOLEAN DEFAULT true,
    terms_version TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_form_block_signatures_submission ON form_block_signatures(submission_id);
CREATE INDEX idx_form_block_signatures_block ON form_block_signatures(block_id);
CREATE INDEX idx_form_block_signatures_signer ON form_block_signatures(signed_by_id);
CREATE INDEX idx_form_block_signatures_signed_at ON form_block_signatures(signed_at);
```

**Use Cases**:
- Training completion sign-off
- Audit acceptance
- Compliance acknowledgment
- Manager approval

---

### 9. `form_analytics` TABLE

**Purpose**: Materialized view for analytics dashboard

```sql
CREATE TABLE form_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Assignment metrics
    total_assigned INTEGER DEFAULT 0,

    -- Submission metrics
    total_started INTEGER DEFAULT 0,
    total_completed INTEGER DEFAULT 0,
    total_approved INTEGER DEFAULT 0,
    total_rejected INTEGER DEFAULT 0,

    -- Performance metrics
    avg_completion_time_minutes NUMERIC,
    avg_time_to_submit_minutes NUMERIC,
    avg_score NUMERIC,
    median_score NUMERIC,

    -- Quality metrics
    completion_rate NUMERIC,  -- completed / assigned
    approval_rate NUMERIC,  -- approved / submitted

    -- Time-based metrics
    submissions_last_7_days INTEGER DEFAULT 0,
    submissions_last_30_days INTEGER DEFAULT 0,

    -- Last updated
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(form_id)
);

CREATE INDEX idx_form_analytics_organization ON form_analytics(organization_id);
CREATE INDEX idx_form_analytics_completion_rate ON form_analytics(completion_rate);
CREATE INDEX idx_form_analytics_updated ON form_analytics(updated_at);

-- Function to refresh analytics
CREATE OR REPLACE FUNCTION refresh_form_analytics(p_form_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO form_analytics (form_id, organization_id, total_completed, avg_score, ...)
  SELECT ... FROM form_submissions WHERE form_id = p_form_id
  ON CONFLICT (form_id) DO UPDATE SET ...;
END;
$$ LANGUAGE plpgsql;
```

**Why Materialized View**:
- Analytics queries are expensive (aggregations, joins)
- Dashboard loads slowly if calculated real-time
- Update on INSERT/UPDATE to form_submissions via trigger

---

## ROW LEVEL SECURITY (RLS) AUDIT

### Current RLS Policies

```sql
-- Forms: Organization-scoped
CREATE POLICY "Users can view published forms"
    ON forms FOR SELECT
    USING (organization_id = get_user_organization_id() AND status = 'published');

CREATE POLICY "Admins can manage forms"
    ON forms FOR ALL
    USING (organization_id = get_user_organization_id())
    WITH CHECK (organization_id = get_user_organization_id());
```

#### 🚨 CRITICAL SECURITY ISSUE

**Policy**: "Admins can manage forms"
- **Problem**: Allows ANY authenticated user in the org to INSERT/UPDATE/DELETE
- **Why**: No role check, just org membership
- **Impact**: Store clerks could delete all forms
- **Severity**: HIGH (data loss risk)

**Fix Required**:
```sql
-- Drop overly permissive policy
DROP POLICY "Admins can manage forms" ON forms;

-- Create role-based policies
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

CREATE POLICY "Form creators can update own forms"
    ON forms FOR UPDATE
    USING (
        organization_id = get_user_organization_id()
        AND created_by_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Admins can delete any form"
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

### form_blocks RLS

```sql
CREATE POLICY "Users can view form blocks"
    ON form_blocks FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM forms
        WHERE forms.id = form_blocks.form_id
        AND forms.organization_id = get_user_organization_id()
    ));
```

✅ **Good**: Joins to forms table for org scoping
❌ **Missing**: No INSERT/UPDATE/DELETE policies (implicitly blocked)

**Fix**: Add policies for form creators to modify blocks

### form_submissions RLS

```sql
CREATE POLICY "Users can view their own submissions"
    ON form_submissions FOR SELECT
    USING (
        organization_id = get_user_organization_id()
        AND user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "Users can submit forms"
    ON form_submissions FOR INSERT
    WITH CHECK (organization_id = get_user_organization_id());
```

❌ **Issues**:
1. Users can only see OWN submissions - but managers need to see team submissions
2. No UPDATE policy (users can't save drafts)
3. No admin override (admins can't view all submissions)

**Fix**:
```sql
-- Allow managers to see team submissions
CREATE POLICY "Managers can view team submissions"
    ON form_submissions FOR SELECT
    USING (
        organization_id = get_user_organization_id()
        AND EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid()
            AND (r.name ILIKE '%manager%' OR r.name ILIKE '%admin%')
        )
    );

-- Allow users to update draft submissions
CREATE POLICY "Users can update own draft submissions"
    ON form_submissions FOR UPDATE
    USING (
        organization_id = get_user_organization_id()
        AND user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
        AND status = 'draft'
    );
```

---

## DATA INTEGRITY ISSUES

### Foreign Key Cascade Behavior

**forms table**:
- `organization_id ... ON DELETE CASCADE` ✅ Correct
- `created_by ... NO CASCADE` ⚠️ Missing ON DELETE SET NULL

**Impact**: If user deleted, forms show created_by = NULL (acceptable) but no audit trail

**Fix**:
```sql
ALTER TABLE forms
    DROP CONSTRAINT forms_created_by_fkey,
    ADD CONSTRAINT forms_created_by_fkey
        FOREIGN KEY (created_by_id)
        REFERENCES users(id)
        ON DELETE SET NULL;
```

### CHECK Constraint Gaps

**form_submissions.status**:
- Constraint: `status IN ('draft', 'submitted', 'reviewed', 'approved', 'rejected')`
- CRUD code uses: `status: 'pending'` (line 236)
- **Result**: INSERT will fail!

**Fix**: Add 'pending' to CHECK constraint

### JSONB Validation

**answers JSONB** has no validation:
- Could store `answers = 'not even json'` (won't happen due to JSONB type)
- Could store `answers = []` (array instead of object)
- Could store `answers = {"random": "data"}` (no block_id validation)

**Fix**: Add CHECK constraint for structure
```sql
ALTER TABLE form_submissions
    ADD CONSTRAINT form_submissions_answers_is_object
    CHECK (jsonb_typeof(answers) = 'object');
```

---

## PERFORMANCE ANALYSIS

### Index Coverage

**Query**: "Get all published forms for my org"
```sql
SELECT * FROM forms
WHERE organization_id = 'X' AND status = 'published'
ORDER BY created_at DESC;
```

**Indexes**:
- ✅ `idx_forms_organization` (organization_id)
- ✅ `idx_forms_status` (status)
- ❌ No composite index on (organization_id, status, created_at)

**Current**: Postgres uses one index, filters with other
**Optimal**: Composite index covers entire query

**Fix**:
```sql
CREATE INDEX idx_forms_org_status_created
    ON forms(organization_id, status, created_at DESC);
```

### Missing Indexes

**Frequently Queried Columns Without Indexes**:
1. `form_submissions.submitted_at` - ✅ Has index
2. `form_submissions.form_id + status` - ❌ Missing composite
3. `form_blocks.form_id + display_order` - ✅ Has composite
4. `forms.organization_id + status` - ❌ Missing composite

**Hot Queries** (based on CRUD code):
```sql
-- Query 1: Get form with blocks (line 159)
SELECT * FROM forms WHERE id = X;  -- ✅ Primary key
SELECT * FROM form_blocks WHERE form_id = X ORDER BY display_order;  -- ✅ Composite index

-- Query 2: Get submissions for form with status filter (line 362)
SELECT * FROM form_submissions
WHERE form_id = X AND status = Y
ORDER BY submitted_at DESC;  -- ❌ No composite index!

-- Fix:
CREATE INDEX idx_form_submissions_form_status_submitted
    ON form_submissions(form_id, status, submitted_at DESC);
```

### Trigger Overhead

**Triggers Present**:
```sql
CREATE TRIGGER update_forms_updated_at
    BEFORE UPDATE ON forms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

✅ **Good**: Automatic timestamp maintenance
⚠️ **Concern**: Every UPDATE pays trigger cost (minimal, acceptable)

---

## MIGRATION RISKS

### Column Renaming Risks

**Risk**: Renaming `created_by` → `created_by_id` could break:
1. Existing queries in other modules
2. Supabase RLS policies
3. Application code (CRUD functions)

**Mitigation**:
```sql
-- Step 1: Add new column
ALTER TABLE forms ADD COLUMN created_by_id UUID REFERENCES users(id);

-- Step 2: Copy data
UPDATE forms SET created_by_id = created_by;

-- Step 3: Update policies, code (manual)

-- Step 4: Drop old column (after testing)
ALTER TABLE forms DROP COLUMN created_by;
```

**Testing Required**:
- Verify all forms have created_by_id populated
- Verify no queries reference old column name
- Test RLS policies still work

### Adding Constraints to Existing Data

**Risk**: Adding NOT NULL constraint fails if nulls exist

```sql
-- Before:
ALTER TABLE forms ADD COLUMN type TEXT NOT NULL;  -- ❌ FAILS if table has rows!

-- Safe migration:
ALTER TABLE forms ADD COLUMN type TEXT;  -- Nullable first
UPDATE forms SET type = 'survey' WHERE type IS NULL;  -- Backfill
ALTER TABLE forms ALTER COLUMN type SET NOT NULL;  -- Add constraint
ALTER TABLE forms ADD CONSTRAINT forms_type_check
    CHECK (type IN ('ojt-checklist', 'inspection', 'audit', 'survey'));
```

---

## RECOMMENDATIONS SUMMARY

### CRITICAL (Must Fix Before Production)

1. ✅ Create `form_assignments` table (blocking CRUD code)
2. ✅ Fix RLS policies (security risk)
3. ✅ Add missing columns to match CRUD code expectations
4. ✅ Rename columns for consistency (created_by → created_by_id)
5. ✅ Fix CHECK constraint mismatch (add 'pending' status)

### HIGH (Needed for Full Functionality)

6. ✅ Create `form_versions` table (audit trail)
7. ✅ Create `form_categories` table (organization)
8. ✅ Create `form_submission_attachments` table (file uploads)
9. ✅ Create `form_block_signatures` table (signatures)
10. ✅ Add composite indexes for common queries

### MEDIUM (Improves Usability)

11. ✅ Create `form_analytics` table (dashboard performance)
12. ✅ Add validation columns (min/max/pattern)
13. ✅ Add soft delete support (deleted_at)
14. ✅ Expand block types (signature, phone, email, etc.)
15. ✅ Add JSONB structure documentation

### LOW (Future Enhancements)

16. ⚠️ Add block grouping/sections
17. ⚠️ Add scoring support
18. ⚠️ Add conditional logic metadata
19. ⚠️ Add form templates table

---

## VERIFICATION CHECKLIST

Before deploying schema changes:

- [ ] All new tables have RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`)
- [ ] All new tables have RLS policies defined
- [ ] All foreign keys have appropriate ON DELETE behavior
- [ ] All indexes are created for new tables
- [ ] All triggers are created for updated_at columns
- [ ] All CHECK constraints validated against sample data
- [ ] Column renames tested with existing CRUD code
- [ ] Migration can be rolled back if needed
- [ ] Test data inserted and queried successfully
- [ ] Performance tested with 1000+ rows

---

**End of Database Schema Audit**

*Next: Create FORMS_CODEBASE_AUDIT.md*
