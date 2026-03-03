# FORMS MODULE - ARCHITECTURE DECISIONS

**Date**: February 10, 2026
**Project**: Trike Backoffice 2.0 - Forms Module
**Author**: Senior Technical Project Manager
**Status**: Proposed (Pending User Approval)

---

## DOCUMENT PURPOSE

This document records the key architectural decisions for transforming the Forms module from a prototype to production-ready software. Each decision includes context, options considered, chosen approach, rationale, and trade-offs.

---

## DECISION RECORD FORMAT

Each decision follows this structure:
- **Decision ID**: Unique identifier
- **Title**: Short description
- **Status**: Proposed | Approved | Implemented | Superseded
- **Context**: Why this decision is needed
- **Options Considered**: Alternative approaches evaluated
- **Decision**: What we're doing
- **Rationale**: Why this approach was chosen
- **Consequences**: Trade-offs, risks, benefits
- **Implementation Notes**: How to execute

---

## ADR-001: Database Migration Strategy

**Status**: Proposed
**Date**: 2026-02-10

### Context
The current database schema has critical issues:
- Missing `form_assignments` table (referenced in code but doesn't exist)
- Column name mismatches (`created_by` vs `created_by_id`)
- JSONB antipatterns (`settings` should be explicit columns)
- Missing indexes for performance
- 6 additional tables needed for production features

We need to decide: Big bang migration vs. incremental migrations?

### Options Considered

**Option A: Single Large Migration**
- Pros: All changes in one place, easier to reason about
- Cons: Hard to test, hard to rollback, risky on live data

**Option B: Incremental Migrations (5-6 separate migrations)**
- Pros: Easier to test, safer rollback, matches existing pattern
- Cons: More files to manage, could miss dependencies

**Option C: Hybrid (Critical fixes first, then features)**
- Pros: Unblocks development quickly, reduces risk
- Cons: Need to plan migration order carefully

### Decision

**Choose Option B: Incremental Migrations**

Create 6 separate migration files:
1. `00060_forms_schema_fixes.sql` - Fix critical issues (column renames, indexes)
2. `00061_form_assignments.sql` - Add missing assignments table
3. `00062_form_versioning.sql` - Add versioning tables
4. `00063_form_categories_analytics.sql` - Add categories and analytics tables
5. `00064_form_attachments_signatures.sql` - Add file upload support
6. `00065_form_rls_policies.sql` - Fix and enhance RLS policies

### Rationale
- Matches existing migration pattern in codebase (`00001_initial_schema.sql`, etc.)
- Each migration can be tested independently
- Rollback is safer (can roll back specific migrations)
- Unblocks development incrementally (migration 1+2 allow basic CRUD to work)
- Easier to review (smaller diffs)

### Consequences
**Benefits**:
- Lower risk of data corruption
- Faster feedback loop (test migration 1 while writing migration 2)
- Clear dependency chain

**Risks**:
- Must track migration order carefully
- Could introduce temporary inconsistencies between migrations
- More deployment steps

**Mitigation**:
- Document migration dependencies in each file
- Test migrations on staging database first
- Create rollback scripts for each migration
- Use transaction wrappers where possible

### Implementation Notes
```sql
-- Example migration structure
-- File: 00060_forms_schema_fixes.sql

BEGIN;

-- Fix column naming
ALTER TABLE forms RENAME COLUMN created_by TO created_by_id;
ALTER TABLE form_submissions RENAME COLUMN reviewed_by TO reviewed_by_id;

-- Add missing columns
ALTER TABLE forms ADD COLUMN type TEXT CHECK (type IN ('ojt-checklist', 'inspection', 'audit', 'survey'));
ALTER TABLE forms ADD COLUMN category_id UUID REFERENCES form_categories(id);

-- Add indexes
CREATE INDEX idx_forms_org_status ON forms(organization_id, status);
CREATE INDEX idx_form_blocks_form_order ON form_blocks(form_id, display_order);

COMMIT;
```

---

## ADR-002: API Layer Enhancement Strategy

**Status**: Proposed
**Date**: 2026-02-10

### Context
The current `src/lib/crud/forms.ts` file has:
- 478 lines of CRUD operations
- Missing critical functions (pagination, bulk ops, analytics)
- N+1 query issues
- Type safety issues (`any` for JSONB)

We need to decide: Enhance existing file vs. rewrite from scratch?

### Options Considered

**Option A: Complete Rewrite**
- Pros: Clean slate, perfect architecture
- Cons: High risk, time-consuming, might break existing code

**Option B: Enhance Existing File**
- Pros: Preserves working code, incremental improvement, lower risk
- Cons: Technical debt remains, file becomes larger

**Option C: Hybrid (Extract to Modules)**
- Pros: Better organization, reuse existing patterns
- Cons: More files, need to manage imports

### Decision

**Choose Option B: Enhance Existing File**

Keep `forms.ts` as single file, add missing functions, fix issues incrementally:
1. Fix N+1 queries (use `Promise.all()`)
2. Add missing functions (bulk ops, analytics, export)
3. Add pagination parameters
4. Improve type safety (replace `any` with interfaces)
5. Add org_id filters for RLS compliance

### Rationale
- Existing code follows codebase patterns (`users.ts`, `certifications.ts`)
- Lower risk than rewrite
- Faster to production
- Easier to review (see what changed vs. starting from scratch)
- File size acceptable (~800 lines after additions)

### Consequences
**Benefits**:
- Preserves working code
- Incremental testing possible
- Lower risk of introducing bugs

**Risks**:
- File could become unwieldy (800+ lines)
- Technical debt not fully addressed

**Mitigation**:
- Strict code review for new functions
- Add JSDoc comments for all functions
- Consider refactor to modules in Phase 3 (after production launch)

### Implementation Notes
```typescript
// Add missing functions following existing pattern

export async function bulkAssignForm(input: {
  formId: string;
  targets: Array<{ type: 'user' | 'store' | 'district'; id: string }>;
  dueDate?: string;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly';
}): Promise<{ success: boolean; assignmentIds: string[] }> {
  const userProfile = await getCurrentUserProfile();
  const orgId = await getCurrentUserOrgId();

  // Batch insert
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

  const { data, error } = await supabase
    .from('form_assignments')
    .insert(assignments)
    .select('id');

  if (error) throw new Error(error.message);

  // Batch notifications
  const notifications = data.map(assignment =>
    createNotification({/* ... */}).catch(err => console.error(err))
  );
  await Promise.all(notifications);

  return { success: true, assignmentIds: data.map(a => a.id) };
}
```

---

## ADR-003: Component Refactoring Approach

**Status**: Proposed
**Date**: 2026-02-10

### Context
Current components have issues:
- FormBuilder.tsx is 1235 lines (too large)
- FormAssignments.tsx has 15+ useState variables (state explosion)
- FormSubmissions.tsx has 200+ lines of hardcoded form logic (switch statement)

We need to decide: Refactor now vs. refactor later?

### Options Considered

**Option A: Refactor Before API Integration**
- Pros: Cleaner code, better architecture
- Cons: Delays production, might refactor wrong things

**Option B: Refactor After API Integration**
- Pros: Faster to production, refactor based on real usage
- Cons: Harder to refactor with real data flowing

**Option C: Phased Refactoring**
- Pros: Balance speed and quality
- Cons: Need careful planning

### Decision

**Choose Option C: Phased Refactoring**

**Phase 1** (Weeks 1-3): API Integration ONLY
- Keep existing component structure
- Connect to API
- Add loading/error states
- DO NOT refactor structure yet

**Phase 2** (Weeks 4-6): Targeted Refactoring
- Extract FormBuilder subcomponents
- Replace useState with React Hook Form in FormAssignments
- Build generic FormRenderer for FormSubmissions

**Phase 3** (Weeks 7-8): Polish
- Extract custom hooks
- Add accessibility
- Performance optimization

### Rationale
- Get to production faster (Phase 1 delivers working software)
- Refactor based on real usage patterns
- Smaller PRs, easier to review
- Less risk of breaking working UI

### Consequences
**Benefits**:
- Faster time to market
- Lower risk per phase
- Real user feedback informs refactoring

**Risks**:
- Technical debt accumulates in Phase 1
- Might ship "messy" code initially

**Mitigation**:
- Set clear timeline for Phase 2
- Document "TODO: Refactor" comments in Phase 1
- Ensure Phase 1 code works correctly (even if not elegant)

### Implementation Notes

**Phase 1 Example** (FormLibrary.tsx):
```typescript
// Keep existing structure, just add API
const [forms, setForms] = useState<Form[]>([]);
const [isLoading, setIsLoading] = useState(true);

useEffect(() => {
  async function loadForms() {
    setIsLoading(true);
    try {
      const data = await getForms({ limit: 50, offset: 0 });
      setForms(data);
    } catch (error) {
      toast.error('Failed to load forms');
    } finally {
      setIsLoading(false);
    }
  }
  loadForms();
}, []);
```

**Phase 2 Example** (Extract custom hook):
```typescript
// Extract to hooks/useForms.ts
export function useForms(filters: FormFilters) {
  const [forms, setForms] = useState<Form[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadForms() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getForms(filters);
        if (!cancelled) setForms(data);
      } catch (err) {
        if (!cancelled) setError(err as Error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    loadForms();
    return () => { cancelled = true; };
  }, [filters]);

  return { forms, isLoading, error, refetch: loadForms };
}
```

---

## ADR-004: State Management Strategy

**Status**: Proposed
**Date**: 2026-02-10

### Context
Current state management:
- FormAssignments: 15+ useState variables (fragmented)
- FormBuilder: Complex nested state (form metadata + blocks)
- FormLibrary: Simple state (filters, search)

We need to decide: Global state (Redux/Zustand) vs. React Hook Form vs. useState?

### Options Considered

**Option A: Add Redux/Zustand for Global State**
- Pros: Centralized state, predictable updates
- Cons: Overkill for isolated forms, adds complexity

**Option B: React Hook Form for All Forms**
- Pros: Built for forms, validation, less boilerplate
- Cons: Not needed for simple UI state (filters, modals)

**Option C: Hybrid Approach**
- Pros: Use right tool for each job
- Cons: Multiple patterns to maintain

### Decision

**Choose Option C: Hybrid Approach**

**Use React Hook Form** for:
- FormBuilder metadata editing
- FormAssignments creation form
- Any form with validation requirements

**Use useState** for:
- FormLibrary filters/sorting (simple UI state)
- FormAnalytics date range (simple UI state)
- Modal open/close state

**NO global state manager** (Redux/Zustand):
- Forms module is isolated, no cross-module state sharing
- Each component manages its own data fetching

### Rationale
- React Hook Form is already a project dependency (used elsewhere)
- No need for global state (forms don't share state with other modules)
- Keeps codebase simple
- Matches patterns in other modules

### Consequences
**Benefits**:
- Less boilerplate than Redux
- Built-in validation
- Better form UX (field-level validation, dirty tracking)

**Risks**:
- Developers need to know when to use RHF vs. useState
- Could be inconsistent

**Mitigation**:
- Document pattern in FORMS_ARCHITECTURE.md (this file)
- Code review checklist: "Does this form need validation? → Use RHF"

### Implementation Notes

**React Hook Form Example** (FormAssignments):
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const assignmentSchema = z.object({
  formId: z.string().min(1, 'Form is required'),
  dueDate: z.string().optional(),
  recurrence: z.enum(['none', 'daily', 'weekly', 'monthly']),
  targets: z.array(z.object({
    type: z.enum(['user', 'store', 'district']),
    id: z.string()
  })).min(1, 'At least one target required')
});

type AssignmentForm = z.infer<typeof assignmentSchema>;

export function FormAssignments() {
  const form = useForm<AssignmentForm>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      formId: '',
      recurrence: 'none',
      targets: []
    }
  });

  const onSubmit = form.handleSubmit(async (data) => {
    await bulkAssignForm(data);
    toast.success('Form assigned successfully');
    form.reset();
  });

  return (
    <form onSubmit={onSubmit}>
      <FormField
        control={form.control}
        name="formId"
        render={({ field }) => (
          <Select {...field}>
            {/* ... */}
          </Select>
        )}
      />
      {/* ... more fields */}
      <Button type="submit" disabled={form.formState.isSubmitting}>
        Assign Form
      </Button>
    </form>
  );
}
```

**useState Example** (FormLibrary filters):
```typescript
// Simple UI state, no validation needed
const [searchQuery, setSearchQuery] = useState('');
const [statusFilter, setStatusFilter] = useState('all');
const [typeFilter, setTypeFilter] = useState('all');
```

---

## ADR-005: Form Rendering Architecture

**Status**: Proposed
**Date**: 2026-02-10

### Context
Current FormSubmissions.tsx has 200+ lines of hardcoded form logic:
```typescript
const getFormData = (formName: string) => {
  switch (formName) {
    case 'Store Daily Walk': return [/* 8 hardcoded questions */];
    case 'Days 1-5 OJT Checklist': return [/* 10 hardcoded */];
    // ... 3 more forms
  }
};
```

This is NOT scalable. Adding a new form requires code changes.

We need to decide: Generic renderer vs. form-specific components?

### Options Considered

**Option A: Form-Specific Components**
- Pros: Full control, can optimize per form
- Cons: Not scalable, requires code change per form

**Option B: Generic Form Renderer**
- Pros: Scalable, data-driven, no code change per form
- Cons: Less flexibility, complex block types need custom components

**Option C: Hybrid (Generic + Custom Blocks)**
- Pros: Scalability + flexibility
- Cons: Most complex to build

### Decision

**Choose Option C: Hybrid (Generic Renderer + Custom Block Components)**

Build a generic `FormRenderer` component that:
1. Takes `form_blocks` array + `response_data` as props
2. Maps each block type to a React component dynamically
3. Supports custom block components for complex types
4. Handles validation, conditional logic, file uploads

### Rationale
- Eliminates hardcoded switch statements
- Scalable (works for any form structure)
- Flexible (can add custom block types)
- Reusable across FormBuilder preview, FormSubmissions detail, public form viewer

### Consequences
**Benefits**:
- No code change needed to add new forms
- Consistent rendering across app
- Easier to test (test each block type independently)

**Risks**:
- Complex to build initially
- Need to handle edge cases (conditional logic, file uploads, signatures)

**Mitigation**:
- Start with simple block types (text, number, yes/no, multiple choice)
- Add complex types incrementally
- Extensive testing

### Implementation Notes

**Component Structure**:
```
src/components/forms/shared/
├── FormRenderer.tsx (main component)
├── blocks/
│   ├── TextBlock.tsx
│   ├── NumberBlock.tsx
│   ├── YesNoBlock.tsx
│   ├── MultipleChoiceBlock.tsx
│   ├── DateBlock.tsx
│   ├── FileUploadBlock.tsx
│   ├── SignatureBlock.tsx
│   ├── RatingBlock.tsx
│   └── ... (20+ block types)
└── FormRendererContext.tsx (shared state)
```

**FormRenderer.tsx**:
```typescript
import React from 'react';
import { FormBlock, ResponseData } from '@/lib/types';
import { TextBlock, NumberBlock, YesNoBlock, /* ... */ } from './blocks';

const BLOCK_COMPONENTS = {
  'text': TextBlock,
  'number': NumberBlock,
  'yes-no': YesNoBlock,
  'multiple-choice': MultipleChoiceBlock,
  'date': DateBlock,
  'file-upload': FileUploadBlock,
  'signature': SignatureBlock,
  'rating': RatingBlock,
  // ... more types
};

interface FormRendererProps {
  blocks: FormBlock[];
  responseData?: ResponseData;
  readOnly?: boolean;
  onSubmit?: (data: ResponseData) => void;
}

export function FormRenderer({ blocks, responseData, readOnly, onSubmit }: FormRendererProps) {
  const [formData, setFormData] = useState<ResponseData>(responseData || {});

  const handleBlockChange = (blockId: string, value: any) => {
    setFormData(prev => ({ ...prev, [blockId]: value }));
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
        <Button onClick={() => onSubmit?.(formData)}>
          Submit Form
        </Button>
      )}
    </div>
  );
}
```

**Example Block Component** (TextBlock.tsx):
```typescript
interface TextBlockProps {
  block: FormBlock;
  value?: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export function TextBlock({ block, value, onChange, readOnly }: TextBlockProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {block.label}
        {block.validation_rules?.required && <span className="text-red-500">*</span>}
      </label>
      {block.description && (
        <p className="text-sm text-muted-foreground">{block.description}</p>
      )}
      <Input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={readOnly}
        placeholder={block.settings?.placeholder}
        maxLength={block.validation_rules?.maxLength}
      />
    </div>
  );
}
```

---

## ADR-006: File Organization

**Status**: Proposed
**Date**: 2026-02-10

### Context
Current structure is flat:
```
src/components/forms/
├── Forms.tsx
├── FormAnalytics.tsx
├── FormBuilder.tsx (1235 lines!)
├── FormLibrary.tsx
├── FormAssignments.tsx
├── FormSubmissions.tsx
└── FormDetail.tsx
```

Large files like FormBuilder will benefit from splitting into subdirectories.

### Options Considered

**Option A: Keep Flat Structure**
- Pros: Simple, all files in one place
- Cons: Doesn't scale, FormBuilder subcomponents pollute main folder

**Option B: Subdirectories Per Feature**
- Pros: Better organization, scalable
- Cons: More navigation, need to manage imports

### Decision

**Choose Option B: Subdirectories Per Complex Feature**

**New Structure**:
```
src/components/forms/
├── Forms.tsx (main container)
├── FormAnalytics/
│   ├── FormAnalytics.tsx
│   ├── FormStatsCards.tsx
│   ├── FormCharts.tsx
│   └── hooks/
│       └── useFormAnalytics.ts
├── FormBuilder/
│   ├── FormBuilder.tsx (orchestration)
│   ├── Canvas.tsx (drag-drop canvas)
│   ├── BlockPalette.tsx (block types sidebar)
│   ├── PropertiesPanel.tsx (edit block properties)
│   ├── blocks/ (20+ block components)
│   │   ├── TextBlockEditor.tsx
│   │   ├── NumberBlockEditor.tsx
│   │   └── ...
│   └── hooks/
│       ├── useFormBuilder.ts
│       └── useBlockDragDrop.ts
├── FormLibrary/
│   ├── FormLibrary.tsx
│   └── FormCard.tsx
├── FormAssignments/
│   ├── FormAssignments.tsx
│   └── AssignmentDialog.tsx
├── FormSubmissions/
│   ├── FormSubmissions.tsx
│   └── SubmissionDetailDrawer.tsx
├── FormDetail/
│   ├── FormDetail.tsx
│   └── FormDetailTabs.tsx
├── shared/
│   ├── FormRenderer.tsx (generic form rendering)
│   └── blocks/ (runtime block components)
│       ├── TextBlock.tsx
│       ├── NumberBlock.tsx
│       └── ...
└── hooks/
    ├── useForms.ts
    ├── useFormSubmissions.ts
    └── useFormAssignments.ts
```

### Rationale
- Matches patterns in other large modules (Content Library)
- Improves maintainability
- Clear separation between feature-specific code and shared code
- Easier to find related files

### Consequences
**Benefits**:
- Better code organization
- Easier to navigate
- Clear boundaries between features

**Risks**:
- More directories to manage
- Import paths longer

**Mitigation**:
- Use TypeScript path aliases (`@/components/forms/shared/FormRenderer`)
- Document structure in README
- Consistent naming conventions

---

## ADR-007: Testing Strategy

**Status**: Proposed
**Date**: 2026-02-10

### Context
Current testing: 0% coverage (no tests exist).

We need to decide: Testing priority and approach.

### Options Considered

**Option A: Full Test Coverage Before Launch**
- Pros: High quality, fewer bugs
- Cons: Delays production significantly

**Option B: No Tests (Ship Fast)**
- Pros: Fastest to market
- Cons: High risk, hard to maintain

**Option C: Pragmatic Testing (Critical Paths Only)**
- Pros: Balance speed and quality
- Cons: Some code untested

### Decision

**Choose Option C: Pragmatic Testing**

**Testing Pyramid**:
1. **Unit Tests** (High priority):
   - CRUD functions in `forms.ts`
   - Block validation logic
   - FormRenderer block components

2. **Integration Tests** (Medium priority):
   - API + database interactions
   - Form submission workflow

3. **E2E Tests** (Critical paths only):
   - Create form → assign → submit → approve
   - Form builder drag-drop
   - File upload

4. **Manual Testing** (Before each release):
   - Accessibility audit
   - Cross-browser testing
   - Responsive design

### Rationale
- 100% coverage is unrealistic before MVP
- Focus on high-risk areas (CRUD, workflows)
- E2E tests catch integration issues
- Manual testing covers edge cases

### Consequences
**Benefits**:
- Faster to production than full coverage
- Tests protect critical functionality
- Regression prevention

**Risks**:
- Some bugs will slip through
- Non-tested code harder to refactor

**Mitigation**:
- Expand test coverage post-MVP
- Monitor production errors (Sentry)
- User feedback loop

### Implementation Notes

**Unit Test Example** (forms.ts):
```typescript
// tests/crud/forms.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createForm, updateForm, getFormById } from '@/lib/crud/forms';

describe('forms.ts', () => {
  beforeEach(() => {
    // Setup test database
  });

  describe('createForm', () => {
    it('should create a draft form', async () => {
      const result = await createForm({
        title: 'Test Form',
        description: 'Test description',
        type: 'ojt-checklist'
      });

      expect(result.success).toBe(true);
      expect(result.form.status).toBe('draft');
    });

    it('should validate required fields', async () => {
      await expect(createForm({ title: '' })).rejects.toThrow();
    });
  });
});
```

**E2E Test Example** (Playwright):
```typescript
// tests/e2e/forms-workflow.spec.ts
import { test, expect } from '@playwright/test';

test('complete form workflow', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[name=email]', 'admin@example.com');
  await page.fill('[name=password]', 'password');
  await page.click('button[type=submit]');

  // Create form
  await page.goto('/forms');
  await page.click('text=Create Form');
  await page.fill('[name=title]', 'E2E Test Form');
  await page.click('text=Save Draft');
  await expect(page.locator('text=Form saved')).toBeVisible();

  // Assign form
  await page.click('text=Assignments');
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
});
```

---

## ADR-008: Error Handling & User Feedback

**Status**: Proposed
**Date**: 2026-02-10

### Context
Current error handling: Basic try-catch, no user feedback.

We need consistent error handling across all components.

### Decision

**Standardized Error Handling Pattern**

**For CRUD Operations**:
```typescript
try {
  const result = await createForm(data);
  toast.success('Form created successfully');
  navigate(`/forms/${result.form.id}`);
} catch (error) {
  if (error.message.includes('unique constraint')) {
    toast.error('A form with this name already exists');
  } else if (error.message.includes('permission denied')) {
    toast.error('You do not have permission to create forms');
  } else {
    toast.error('Failed to create form. Please try again.');
    console.error('Create form error:', error);
  }
}
```

**For Data Fetching**:
```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['forms'],
  queryFn: getForms,
  retry: 2,
  onError: (err) => {
    toast.error('Failed to load forms. Please refresh the page.');
  }
});

if (isLoading) return <SkeletonLoader />;
if (error) return <ErrorState retry={refetch} />;
```

**Toast Notification Standards**:
- ✅ Success: Green, auto-dismiss after 3 seconds
- ❌ Error: Red, auto-dismiss after 5 seconds (longer to read)
- ⚠️ Warning: Yellow, auto-dismiss after 4 seconds
- ℹ️ Info: Blue, auto-dismiss after 3 seconds

### Rationale
- Consistent UX across all forms
- User-friendly error messages (no raw error codes)
- Logging for debugging (console.error)
- Retry mechanisms for transient failures

---

## ADR-009: Performance Optimization Strategy

**Status**: Proposed
**Date**: 2026-02-10

### Context
Current performance: Unknown (no load testing done).

Potential issues:
- No pagination (will fail with 1000+ forms)
- N+1 queries in assignForm()
- Large components (1235 lines)

### Decision

**Performance Optimization Plan**

**Phase 1** (During API integration):
- Add pagination to all list endpoints
- Fix N+1 queries (use `Promise.all()`)
- Add database indexes

**Phase 2** (After MVP launch):
- Code splitting (lazy load FormBuilder)
- Virtual scrolling for large lists
- Memoization for expensive computations

**Phase 3** (If needed):
- Server-side rendering (SSR)
- Service worker caching
- CDN for static assets

### Implementation Notes

**Pagination Example**:
```typescript
const [page, setPage] = useState(0);
const PAGE_SIZE = 20;

const { data: forms } = useQuery({
  queryKey: ['forms', page],
  queryFn: () => getForms({ limit: PAGE_SIZE, offset: page * PAGE_SIZE })
});

// Infinite scroll
const handleScroll = () => {
  if (/* reached bottom */) {
    setPage(prev => prev + 1);
  }
};
```

**Code Splitting**:
```typescript
// Lazy load FormBuilder (heavy component)
const FormBuilder = lazy(() => import('./FormBuilder/FormBuilder'));

// Use with Suspense
<Suspense fallback={<SkeletonBuilder />}>
  <FormBuilder />
</Suspense>
```

---

## ADR-010: Accessibility (A11Y) Requirements

**Status**: Proposed
**Date**: 2026-02-10

### Context
Current accessibility: Unknown (no audit done).

Target: WCAG 2.1 AA compliance.

### Decision

**Accessibility Checklist**

1. **Keyboard Navigation**:
   - All interactive elements focusable
   - Tab order logical
   - Focus visible (outline)
   - Escape closes modals/drawers

2. **Screen Reader Support**:
   - ARIA labels on icons
   - ARIA live regions for notifications
   - Semantic HTML (nav, main, section, etc.)

3. **Color Contrast**:
   - Text: 4.5:1 minimum
   - UI components: 3:1 minimum
   - No color-only indicators (add icons)

4. **Forms**:
   - Labels for all inputs
   - Error messages linked (aria-describedby)
   - Required fields marked

5. **Charts**:
   - Table view alternative
   - ARIA labels on data points
   - Keyboard navigation

### Implementation Notes

**Example** (Accessible button):
```tsx
<Button
  onClick={handleDelete}
  aria-label="Delete form"  // For screen readers
  disabled={isDeleting}
>
  <Trash2 className="h-4 w-4" aria-hidden="true" />
  <span className="sr-only">Delete form</span>  {/* Screen reader only */}
</Button>
```

---

## SUMMARY OF DECISIONS

| ID | Decision | Status | Priority |
|----|----------|--------|----------|
| ADR-001 | Incremental database migrations | Proposed | P0 |
| ADR-002 | Enhance existing API layer | Proposed | P0 |
| ADR-003 | Phased component refactoring | Proposed | P1 |
| ADR-004 | Hybrid state management (RHF + useState) | Proposed | P1 |
| ADR-005 | Generic form renderer with custom blocks | Proposed | P0 |
| ADR-006 | Subdirectories for complex features | Proposed | P2 |
| ADR-007 | Pragmatic testing (critical paths) | Proposed | P1 |
| ADR-008 | Standardized error handling | Proposed | P0 |
| ADR-009 | Performance optimization (3 phases) | Proposed | P2 |
| ADR-010 | WCAG 2.1 AA compliance | Proposed | P1 |

---

**End of Architecture Decisions**
