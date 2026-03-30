# FORMS MODULE - RISK ASSESSMENT

**Date**: February 10, 2026
**Project**: Trike Backoffice 2.0 - Forms Module
**Author**: Senior Technical Project Manager
**Purpose**: Identify, assess, and mitigate risks in Forms module production rollout

---

## RISK ASSESSMENT FRAMEWORK

### Risk Severity Scale
- 🔴 **CRITICAL** - Blocks production launch, causes data loss, security breach
- 🟠 **HIGH** - Major functionality broken, significant user impact
- 🟡 **MEDIUM** - Feature degradation, workaround exists
- 🟢 **LOW** - Minor issue, cosmetic, edge case

### Probability Scale
- **Very Likely** (>75%) - Will almost certainly occur
- **Likely** (50-75%) - Probable without mitigation
- **Possible** (25-50%) - Could happen
- **Unlikely** (<25%) - Low chance

### Impact Scale
- **Catastrophic** - Data loss, security breach, system down
- **Major** - Core features broken, multiple users affected
- **Moderate** - Single feature broken, limited users affected
- **Minor** - Cosmetic, workaround exists

---

## CRITICAL RISKS (P0 - Must Address Before Production)

### RISK-001: Database Schema Migration Failure

**Category**: Technical
**Severity**: 🔴 CRITICAL
**Probability**: Likely (60%)
**Impact**: Catastrophic (system unusable)

**Description**:
Database migrations that rename columns (`created_by` → `created_by_id`) could fail if:
- Active queries are running during migration
- Column references exist in views/functions/triggers
- Data type mismatches occur
- Foreign key constraints are violated

**Specific Scenarios**:
1. Migration runs while user is creating a form → transaction conflict
2. Old CRUD code deployed during migration → column not found errors
3. Rollback fails → database in inconsistent state
4. Migration succeeds but RLS policies reference old column names

**Impact if Occurs**:
- Forms module completely non-functional
- Data corruption possible
- Requires emergency rollback and hotfix
- Potential data loss if not properly backed up

**Mitigation Strategy**:

**BEFORE Migration**:
1. ✅ Full database backup (automated + manual verification)
2. ✅ Test migrations on staging database with production-like data
3. ✅ Identify all column references (grep codebase, check RLS policies)
4. ✅ Schedule migration during low-traffic window (3am-5am)
5. ✅ Notify users of maintenance window

**DURING Migration**:
1. ✅ Run migration in transaction (use BEGIN/COMMIT)
2. ✅ Monitor active connections (kill long-running queries if needed)
3. ✅ Use column aliases temporarily:
   ```sql
   -- Add new column
   ALTER TABLE forms ADD COLUMN created_by_id UUID;
   -- Copy data
   UPDATE forms SET created_by_id = created_by;
   -- Keep old column temporarily for rollback
   ```
4. ✅ Deploy new CRUD code immediately after migration

**AFTER Migration**:
1. ✅ Verify all tables have correct schema
2. ✅ Run smoke tests (create form, assign, submit)
3. ✅ Monitor error logs for 24 hours
4. ✅ Drop old columns only after 1 week of stability

**Rollback Plan**:
```sql
-- If migration fails
BEGIN;
ALTER TABLE forms RENAME COLUMN created_by_id TO created_by;
ALTER TABLE form_submissions RENAME COLUMN reviewed_by_id TO reviewed_by;
COMMIT;
```

**Contingency**:
- If rollback fails, restore from backup (30 min downtime expected)
- Deploy old CRUD code until migration fixed
- Communicate status to users via in-app banner

**Likelihood After Mitigation**: Possible (30%)
**Residual Risk**: 🟡 MEDIUM

---

### RISK-002: Missing form_assignments Table Causes Runtime Errors

**Category**: Technical
**Severity**: 🔴 CRITICAL
**Probability**: Very Likely (90%)
**Impact**: Catastrophic (assignments completely broken)

**Description**:
The `assignForm()` function in `forms.ts` (line 398) attempts to INSERT into `form_assignments` table, but this table **does not exist in the current database schema**. This is a BLOCKING issue.

**Code Reference**:
```typescript
// Line 398 in forms.ts
const { data: assignment, error } = await supabase
  .from('form_assignments')  // ❌ TABLE DOES NOT EXIST!
  .insert({
    organization_id: orgId,
    form_id: input.formId,
    // ...
  });
```

**Impact if Occurs**:
- **100% of assignment attempts will fail** with "relation 'form_assignments' does not exist"
- Users cannot assign forms to stores/users
- Notification creation fails (depends on assignment ID)
- Forms module unusable for core workflow

**Current State**:
- ❌ Table missing from schema
- ❌ RLS policies don't exist for table
- ❌ Indexes don't exist
- ❌ CRUD code will fail on first call

**Mitigation Strategy**:

**Immediate Action** (Before ANY testing):
1. ✅ Create migration `00061_form_assignments.sql`:
   ```sql
   CREATE TABLE form_assignments (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
       form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
       assignment_type TEXT NOT NULL CHECK (assignment_type IN ('user', 'store', 'district', 'role', 'group')),
       target_id UUID NOT NULL,
       assigned_by_id UUID REFERENCES users(id),
       due_date TIMESTAMPTZ,
       recurrence TEXT CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly', 'quarterly')),
       status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       UNIQUE(form_id, assignment_type, target_id)
   );

   CREATE INDEX idx_assignments_form ON form_assignments(form_id);
   CREATE INDEX idx_assignments_target ON form_assignments(target_id);
   CREATE INDEX idx_assignments_org_status ON form_assignments(organization_id, status);
   ```

2. ✅ Add RLS policies:
   ```sql
   ALTER TABLE form_assignments ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Users can view assignments in their org"
       ON form_assignments FOR SELECT
       USING (organization_id = get_user_organization_id());

   CREATE POLICY "Managers can create assignments"
       ON form_assignments FOR INSERT
       WITH CHECK (
           organization_id = get_user_organization_id()
           AND EXISTS (
               SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id
               WHERE u.auth_user_id = auth.uid()
               AND (r.name ILIKE '%manager%' OR r.name ILIKE '%admin%')
           )
       );
   ```

3. ✅ Run migration on staging
4. ✅ Test assignForm() function
5. ✅ Deploy to production

**Testing Checklist**:
- [ ] Assign form to single user
- [ ] Assign form to store (all users in store)
- [ ] Assign form to district (all stores in district)
- [ ] Assign with due date
- [ ] Assign with recurrence (daily, weekly, monthly)
- [ ] Verify notifications created

**Likelihood After Mitigation**: Unlikely (5%)
**Residual Risk**: 🟢 LOW

---

### RISK-003: RLS Policy Overly Permissive (Security Vulnerability)

**Category**: Security
**Severity**: 🔴 CRITICAL
**Probability**: Very Likely (100% - already exists)
**Impact**: Major (unauthorized data access)

**Description**:
Current RLS policy on `forms` table:
```sql
CREATE POLICY "Admins can manage forms" ON forms FOR ALL
USING (organization_id = get_user_organization_id());
```

**Vulnerability**: This policy allows **ANY user in the organization** to manage forms, not just admins. A store manager or even a team member could delete all forms.

**Attack Scenario**:
1. Malicious or disgruntled employee logs in
2. Employee is in same org, so RLS policy passes
3. Employee calls `DELETE FROM forms WHERE organization_id = 'xxx'`
4. All forms in organization deleted

**Proof of Concept**:
```typescript
// Team Member (no admin role) can delete forms!
const { error } = await supabase
  .from('forms')
  .delete()
  .eq('organization_id', userOrgId);
// ❌ Succeeds because policy only checks org_id!
```

**Impact if Exploited**:
- Unauthorized form deletion
- Unauthorized form modification
- Data integrity compromised
- Compliance violations (audit trail broken)

**Mitigation Strategy**:

**Immediate Fix**:
1. ✅ Replace permissive policy with role-based policies:
   ```sql
   -- Drop overly permissive policy
   DROP POLICY "Admins can manage forms" ON forms;

   -- Add role-based policies
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

   CREATE POLICY "All users can view forms in their org"
       ON forms FOR SELECT
       USING (organization_id = get_user_organization_id());
   ```

2. ✅ Add similar policies to `form_blocks`, `form_submissions`, `form_assignments`

**Testing**:
- [ ] Admin can create/update/delete forms
- [ ] Manager can create/update own forms, cannot delete
- [ ] Team member can view forms, cannot create/update/delete
- [ ] User from different org cannot access any forms

**Likelihood After Mitigation**: Unlikely (10%)
**Residual Risk**: 🟢 LOW

---

### RISK-004: N+1 Query Performance Issue in assignForm()

**Category**: Performance
**Severity**: 🟠 HIGH
**Probability**: Very Likely (100% - already exists)
**Impact**: Major (system slowdown, timeout errors)

**Description**:
Current `assignForm()` code (lines 420-430 in forms.ts):
```typescript
// Create notifications sequentially (N+1 problem!)
for (const userId of affectedUsers) {
  await createNotification({
    user_id: userId,
    title: `New form assigned: ${formTitle}`,
    type: 'form-assignment'
  });
}
```

**Problem**: If assigning form to 500 users, this creates 500 sequential database calls (could take 30+ seconds).

**Impact if Occurs**:
- Slow form assignments (30+ seconds for large districts)
- API timeout errors (default 30s timeout)
- Poor user experience (button spinning forever)
- Potential database connection pool exhaustion

**Scaling Analysis**:
| Users | Sequential Time | Parallel Time |
|-------|-----------------|---------------|
| 10 | 1.5s | 0.3s |
| 50 | 7.5s | 0.5s |
| 100 | 15s | 0.8s |
| 500 | 75s (timeout!) | 2s |

**Mitigation Strategy**:

**Code Fix**:
```typescript
// BEFORE (Sequential - BAD)
for (const userId of affectedUsers) {
  await createNotification({...});  // ❌ N+1 problem
}

// AFTER (Parallel - GOOD)
await Promise.all(
  affectedUsers.map(userId =>
    createNotification({...})
      .catch(err => {
        console.error(`Failed to notify user ${userId}:`, err);
        // Don't fail entire assignment if one notification fails
      })
  )
);
```

**Additional Optimizations**:
1. ✅ Batch INSERT notifications (single query instead of N queries)
2. ✅ Move notification creation to background job (queue)
3. ✅ Add database index on `notifications.user_id`

**Testing**:
- [ ] Assign form to 10 users (should complete <2s)
- [ ] Assign form to 100 users (should complete <5s)
- [ ] Assign form to 500 users (should complete <10s)
- [ ] Verify all users receive notifications

**Likelihood After Mitigation**: Unlikely (5%)
**Residual Risk**: 🟢 LOW

---

### RISK-005: Form Builder Doesn't Save to Database

**Category**: Functional
**Severity**: 🔴 CRITICAL
**Probability**: Very Likely (100% - already exists)
**Impact**: Catastrophic (forms cannot be created)

**Description**:
FormBuilder.tsx "Save Draft" button does nothing:
```typescript
// Line 892 in FormBuilder.tsx
<Button onClick={() => {
  console.log('TODO: Save form to database');
  // ❌ No API call!
}}>
  Save Draft
</Button>
```

Users can build forms but cannot save them. All work is lost on page refresh.

**Impact**:
- Forms module completely unusable
- User frustration (loses work)
- No forms can be created

**Mitigation Strategy**:

**Code Fix**:
```typescript
const [formData, setFormData] = useState<FormData>({
  title: '',
  description: '',
  blocks: []
});

const { mutate: saveForm, isLoading } = useMutation({
  mutationFn: async (data: FormData) => {
    if (editMode && formId) {
      return await updateForm({ formId, ...data });
    } else {
      return await createForm(data);
    }
  },
  onSuccess: (result) => {
    toast.success('Form saved successfully');
    if (!formId) {
      navigate(`/forms/builder/${result.form.id}`);
    }
  },
  onError: (error) => {
    toast.error('Failed to save form');
    console.error(error);
  }
});

<Button
  onClick={() => saveForm(formData)}
  disabled={isLoading || !formData.title}
>
  {isLoading ? 'Saving...' : 'Save Draft'}
</Button>
```

**Additional Features**:
1. ✅ Auto-save every 30 seconds
2. ✅ "Unsaved changes" warning before leaving page
3. ✅ Optimistic UI update (instant feedback)

**Testing**:
- [ ] Save new form
- [ ] Edit existing form
- [ ] Auto-save triggers after 30s
- [ ] Warning shows when leaving page with unsaved changes

**Likelihood After Mitigation**: Unlikely (5%)
**Residual Risk**: 🟢 LOW

---

## HIGH RISKS (P1 - Address Before Full Rollout)

### RISK-006: No Pagination Causes Performance Issues

**Category**: Performance
**Severity**: 🟠 HIGH
**Probability**: Likely (70%)
**Impact**: Major (slow page loads, browser crashes)

**Description**:
Current `getForms()` function fetches ALL forms without pagination:
```typescript
const { data } = await supabase
  .from('forms')
  .select('*')
  .eq('organization_id', orgId);
// ❌ No LIMIT! Will fetch 10,000+ forms if they exist
```

**Scaling Problem**:
| Form Count | Data Size | Load Time | Browser Impact |
|------------|-----------|-----------|----------------|
| 100 | 50KB | 0.5s | ✅ OK |
| 1,000 | 500KB | 3s | ⚠️ Slow |
| 10,000 | 5MB | 20s | ❌ Browser freeze |
| 100,000 | 50MB | N/A | ❌ Crash |

**Impact**:
- Slow page loads (users wait 10+ seconds)
- Browser memory exhaustion
- Poor mobile experience
- Wasted bandwidth

**Mitigation Strategy**:

**Code Fix**:
```typescript
export async function getForms(options?: {
  limit?: number;
  offset?: number;
  status?: string;
  search?: string;
}): Promise<{ forms: Form[]; total: number }> {
  const { limit = 20, offset = 0, status, search } = options || {};

  let query = supabase
    .from('forms')
    .select('*, form_blocks(*)', { count: 'exact' })
    .eq('organization_id', orgId)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && status !== 'all') query = query.eq('status', status);
  if (search) query = query.ilike('title', `%${search}%`);

  const { data, error, count } = await query;

  if (error) throw error;
  return { forms: data || [], total: count || 0 };
}
```

**Frontend Implementation**:
- Option A: Infinite scroll (load more on scroll)
- Option B: Traditional pagination (page 1, 2, 3, ...)
- **Recommended**: Infinite scroll (better UX)

**Testing**:
- [ ] Load page with 1,000 forms (should show 20, load more on scroll)
- [ ] Search filters work with pagination
- [ ] Total count displays correctly

**Likelihood After Mitigation**: Unlikely (10%)
**Residual Risk**: 🟢 LOW

---

### RISK-007: File Upload Security Vulnerabilities

**Category**: Security
**Severity**: 🟠 HIGH
**Probability**: Possible (40%)
**Impact**: Major (virus upload, storage exhaustion)

**Description**:
Planned file upload feature could allow:
- Virus/malware uploads
- Executable file uploads (.exe, .bat, .sh)
- Extremely large files (exhaust storage)
- SQL injection via filenames
- Path traversal attacks

**Attack Scenarios**:
1. User uploads virus.exe → other users download and run it
2. User uploads 10GB file → storage quota exhausted
3. User uploads `../../../etc/passwd` → path traversal attempt

**Mitigation Strategy**:

**File Validation**:
```typescript
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/plain'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File too large (max 10MB)' };
  }

  // Check MIME type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'File type not allowed' };
  }

  // Check filename (prevent path traversal)
  if (file.name.includes('..') || file.name.includes('/')) {
    return { valid: false, error: 'Invalid filename' };
  }

  return { valid: true };
}
```

**Virus Scanning**:
- Use ClamAV or cloud service (VirusTotal API)
- Scan files before storing
- Quarantine suspicious files

**Storage Policy**:
```sql
-- Supabase Storage bucket policy
INSERT INTO storage.buckets (id, name, public) VALUES ('form-attachments', 'form-attachments', false);

-- RLS policy
CREATE POLICY "Users can upload to own org"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'form-attachments'
  AND auth.uid() IN (SELECT auth_user_id FROM users WHERE organization_id = (storage.foldername(name))[1]::uuid)
);
```

**Testing**:
- [ ] Upload valid image (JPEG, PNG)
- [ ] Upload valid PDF
- [ ] Reject .exe file
- [ ] Reject 100MB file
- [ ] Reject file with path traversal

**Likelihood After Mitigation**: Unlikely (10%)
**Residual Risk**: 🟡 MEDIUM

---

### RISK-008: Form Versioning Complexity

**Category**: Technical
**Severity**: 🟠 HIGH
**Probability**: Likely (60%)
**Impact**: Moderate (data corruption, broken submissions)

**Description**:
Form versioning is complex:
- What happens when form is edited after submissions exist?
- Should submissions link to specific version?
- Can old versions be restored?
- How to handle breaking changes (delete required field)?

**Data Integrity Risk**:
```
Day 1: Form created with 10 questions (version 1)
Day 2: 50 submissions received referencing version 1
Day 3: Admin edits form, removes question 5 (version 2 created?)
Day 4: View old submission → question 5 missing from form definition!
```

**Mitigation Strategy**:

**Versioning Strategy**:
1. ✅ Every "Publish" creates new version (immutable snapshot)
2. ✅ Submissions always reference `form_version_id`
3. ✅ Old versions preserved forever (cannot delete)
4. ✅ Draft edits don't create version until published

**Database Schema**:
```sql
CREATE TABLE form_versions (
    id UUID PRIMARY KEY,
    form_id UUID REFERENCES forms(id),
    version_number INTEGER NOT NULL,
    blocks_snapshot JSONB NOT NULL,  -- Full snapshot of blocks
    published_at TIMESTAMPTZ NOT NULL,
    published_by_id UUID REFERENCES users(id),
    UNIQUE(form_id, version_number)
);

ALTER TABLE form_submissions ADD COLUMN form_version_id UUID REFERENCES form_versions(id);
```

**Workflow**:
```
1. Admin creates form → status='draft', no version yet
2. Admin publishes form → version 1 created (snapshot of blocks)
3. Submissions reference version 1
4. Admin edits form → status='draft' again
5. Admin publishes changes → version 2 created
6. New submissions reference version 2
7. Old submissions still reference version 1 (data preserved)
```

**Testing**:
- [ ] Create form, publish (version 1 created)
- [ ] Submit form (submission references version 1)
- [ ] Edit form, publish (version 2 created)
- [ ] Submit form (new submission references version 2)
- [ ] View old submission (renders correctly with version 1 blocks)

**Likelihood After Mitigation**: Possible (30%)
**Residual Risk**: 🟡 MEDIUM

---

## MEDIUM RISKS (P2 - Monitor and Address)

### RISK-009: Component State Explosion

**Category**: Technical
**Severity**: 🟡 MEDIUM
**Probability**: Very Likely (100% - already exists)
**Impact**: Moderate (bugs, hard to maintain)

**Description**:
FormAssignments.tsx has 15+ useState variables:
```typescript
const [selectedForm, setSelectedForm] = useState('');
const [dueDate, setDueDate] = useState('');
const [recurrence, setRecurrence] = useState('none');
// ... 12 more!
```

This leads to:
- State synchronization bugs
- Difficult to validate
- Hard to reset form
- Hard to test

**Mitigation**: Use React Hook Form (see ADR-004)

**Likelihood After Mitigation**: Unlikely (10%)
**Residual Risk**: 🟢 LOW

---

### RISK-010: Accessibility Non-Compliance

**Category**: Compliance
**Severity**: 🟡 MEDIUM
**Probability**: Likely (70%)
**Impact**: Moderate (legal risk, poor UX)

**Description**:
Current accessibility issues:
- Charts lack ARIA labels
- Color-only status indicators
- No keyboard navigation for drag-drop
- Missing focus states

**Mitigation**:
- Run axe DevTools audit
- Add ARIA labels
- Add keyboard shortcuts
- Test with screen reader

**Likelihood After Mitigation**: Unlikely (20%)
**Residual Risk**: 🟢 LOW

---

## LOW RISKS (P3 - Accept or Monitor)

### RISK-011: Browser Compatibility Issues

**Category**: Technical
**Severity**: 🟢 LOW
**Probability**: Unlikely (15%)
**Impact**: Minor (some users affected)

**Description**:
Modern browser features (CSS Grid, Flexbox, etc.) may not work in old browsers.

**Mitigation**:
- Test on Chrome, Firefox, Safari, Edge
- Add browser version warning
- Use polyfills if needed

**Likelihood**: Unlikely (15%)
**Residual Risk**: 🟢 LOW

---

### RISK-012: Third-Party Dependency Vulnerabilities

**Category**: Security
**Severity**: 🟢 LOW
**Probability**: Possible (30%)
**Impact**: Minor (patch available)

**Description**:
NPM packages (Recharts, React Hook Form, etc.) may have security vulnerabilities.

**Mitigation**:
- Run `npm audit` regularly
- Update dependencies monthly
- Use Dependabot for automated updates

**Likelihood**: Possible (30%)
**Residual Risk**: 🟢 LOW

---

## RISK SUMMARY MATRIX

| Risk ID | Description | Severity | Probability | Residual Risk After Mitigation |
|---------|-------------|----------|-------------|-------------------------------|
| RISK-001 | Database migration failure | 🔴 CRITICAL | Likely (60%) | 🟡 MEDIUM (30%) |
| RISK-002 | Missing form_assignments table | 🔴 CRITICAL | Very Likely (90%) | 🟢 LOW (5%) |
| RISK-003 | RLS policy overly permissive | 🔴 CRITICAL | Very Likely (100%) | 🟢 LOW (10%) |
| RISK-004 | N+1 query performance | 🟠 HIGH | Very Likely (100%) | 🟢 LOW (5%) |
| RISK-005 | Form builder doesn't save | 🔴 CRITICAL | Very Likely (100%) | 🟢 LOW (5%) |
| RISK-006 | No pagination | 🟠 HIGH | Likely (70%) | 🟢 LOW (10%) |
| RISK-007 | File upload security | 🟠 HIGH | Possible (40%) | 🟡 MEDIUM (10%) |
| RISK-008 | Form versioning complexity | 🟠 HIGH | Likely (60%) | 🟡 MEDIUM (30%) |
| RISK-009 | Component state explosion | 🟡 MEDIUM | Very Likely (100%) | 🟢 LOW (10%) |
| RISK-010 | Accessibility non-compliance | 🟡 MEDIUM | Likely (70%) | 🟢 LOW (20%) |
| RISK-011 | Browser compatibility | 🟢 LOW | Unlikely (15%) | 🟢 LOW (15%) |
| RISK-012 | Dependency vulnerabilities | 🟢 LOW | Possible (30%) | 🟢 LOW (30%) |

---

## MITIGATION TIMELINE

### Week 1-2: Address CRITICAL Risks (P0 Blockers)
- ✅ RISK-002: Create form_assignments table
- ✅ RISK-003: Fix RLS policies
- ✅ RISK-005: Implement FormBuilder save
- ✅ RISK-001: Test database migrations on staging

### Week 3-4: Address HIGH Risks (P1)
- ✅ RISK-004: Fix N+1 queries
- ✅ RISK-006: Add pagination
- ✅ RISK-007: Implement file upload security

### Week 5-6: Address MEDIUM Risks (P2)
- ✅ RISK-008: Implement form versioning
- ✅ RISK-009: Refactor to React Hook Form
- ✅ RISK-010: Accessibility improvements

### Week 7+: Monitor LOW Risks (P3)
- ✅ RISK-011: Cross-browser testing
- ✅ RISK-012: Dependency audits (ongoing)

---

## CONTINGENCY PLANS

### If Database Migration Fails
1. Rollback migration immediately
2. Restore from backup (30 min downtime)
3. Deploy old CRUD code
4. Investigate root cause
5. Fix migration script
6. Retry during next maintenance window

### If RLS Policy Breach Detected
1. Immediately revoke affected permissions
2. Audit access logs for unauthorized activity
3. Notify affected users
4. Deploy fixed policies
5. Conduct security review

### If Performance Issues Occur
1. Enable query logging
2. Identify slow queries
3. Add missing indexes
4. Implement caching
5. Consider read replicas

### If Data Corruption Detected
1. Stop all writes to affected table
2. Restore from last known good backup
3. Re-run transactions from backup point
4. Verify data integrity
5. Resume operations

---

## MONITORING & ALERTING

**Metrics to Monitor Post-Launch**:
- Error rate (target: <1% of requests)
- API response time (target: <500ms p95)
- Database query time (target: <100ms p95)
- Failed form saves (target: 0)
- Failed assignments (target: <0.1%)

**Alerts to Configure**:
- Error rate > 5% → Page on-call engineer
- API response time > 2s → Notify team
- Database query time > 1s → Investigate
- Failed migrations → Immediate rollback

---

**End of Risk Assessment**
