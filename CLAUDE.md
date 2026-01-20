# Claude Code Project Rules - Trike Backoffice

This file contains critical project-specific rules and patterns that Claude agents MUST follow when working on this codebase.

---

## Project Overview

This is an enterprise multi-tenant LMS platform for convenience store and foodservice operations. The system manages a hierarchical structure: Organizations → Districts → Stores → Users. Built for practical operational use in real c-store environments.

## Technology Stack
- Frontend: React 18.3.1 with TypeScript, built with Vite 6.3.5
- Backend: Supabase (PostgreSQL with Row Level Security policies)
- Authentication: Supabase Auth with email/password
- Hosting: Vercel (auto-deploys from GitHub main branch)
- Development: Local dev server at localhost:5173

## Architecture Principles
- Database queries use Supabase client from `src/utils/supabase/client.ts`
- All routes require authentication except public KB viewer
- Form components must pre-fill data when opened in edit mode
- Database credentials use environment variables (VITE_SUPABASE_PROJECT_ID, VITE_SUPABASE_ANON_KEY)

## Development Workflow Standards
1. Make surgical, targeted fixes - avoid refactoring working code unless explicitly requested
2. Before creating new components, check if reusable components already exist
3. Always include TypeScript types and interfaces
4. Follow existing component patterns visible in the codebase
5. Test changes locally before committing

## Code Quality Expectations
- No console.log statements in production code (console.error for actual errors is fine)
- Database queries should select only the columns actually needed
- Avoid fetching entire collections when you only need one record
- Forms that edit existing records must fetch and display all current values

---

## CRITICAL: Database Schema Rules

### User table is `users` - NOT `user_profiles` or `profiles`
- Many Supabase tutorials use `user_profiles` or `profiles` tables - WE DO NOT
- Our user data is in the `users` table
- To get current user profile, use `getCurrentUserProfile()` from `src/lib/supabase.ts`
- To get org ID, use `getCurrentUserOrgId()` from `src/lib/supabase.ts`
- NEVER query a table called `user_profiles` - it does not exist!

### Role Names - NEVER use `role_name` on `users` table

The `users` table does NOT have a `role_name` column. Role information is stored in the related `roles` table.

**WRONG - Will cause SQL error:**
```typescript
// This will fail with: "column 'role_name' does not exist"
await supabase
  .from('users')
  .select('*')
  .eq('role_name', 'Admin');

await supabase
  .from('users')
  .select('*')
  .ilike('role_name', '%manager%');
```

**CORRECT - Join with roles table:**
```typescript
// Option 1: Select with join, filter in JavaScript
const { data: users } = await supabase
  .from('users')
  .select('id, first_name, last_name, role:roles(name)')
  .eq('organization_id', orgId);

const admins = users?.filter(user => {
  const roleName = (user.role as any)?.name?.toLowerCase() || '';
  return roleName.includes('admin');
});

// Option 2: In SQL migrations/RLS policies, use JOIN
SELECT u.* FROM users u
JOIN roles r ON u.role_id = r.id
WHERE r.name = 'Admin';
```

### SQL Migrations - RLS Policy Pattern

When writing RLS policies that check role names, ALWAYS join with the roles table:

**WRONG:**
```sql
CREATE POLICY "admins_only" ON some_table FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE auth_user_id = auth.uid()
    AND role_name = 'Admin'  -- FAILS: no role_name column
  )
);
```

**CORRECT:**
```sql
CREATE POLICY "admins_only" ON some_table FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.auth_user_id = auth.uid()
    AND r.name = 'Admin'
  )
);
```

---

## CRITICAL: Radix UI Select Component Rules

### Empty String Values are FORBIDDEN

Radix UI's `<SelectItem>` component does NOT allow empty strings as values. This causes a runtime error:

```
Error: A <Select.Item /> must have a value prop that is not an empty string.
```

**WRONG - Will crash:**
```tsx
const OPTIONS = [
  { value: '', label: 'All Items' },  // FORBIDDEN
  { value: 'option1', label: 'Option 1' },
];

<SelectItem value="">None</SelectItem>  // FORBIDDEN
```

**CORRECT - Use placeholder values:**
```tsx
const OPTIONS = [
  { value: 'all', label: 'All Items' },  // Use 'all' instead of ''
  { value: 'option1', label: 'Option 1' },
];

// For "none/empty" options, use 'none' and convert in handler
<Select
  value={formData.field || 'none'}
  onValueChange={(value) => setFormData({
    ...formData,
    field: value === 'none' ? '' : value
  })}
>
  <SelectItem value="none">None / Not Selected</SelectItem>
  <SelectItem value="option1">Option 1</SelectItem>
</Select>

// When calling API, convert back
const apiValue = stateFilter === 'all' ? undefined : stateFilter;
```

---

## Database Schema Reference

### Users Table Structure
```sql
users (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  auth_user_id UUID,  -- Links to Supabase auth.users
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  role_id UUID REFERENCES roles(id),  -- FK to roles table
  store_id UUID REFERENCES stores(id),
  employee_id TEXT,
  hire_date DATE,
  phone TEXT,
  status TEXT,  -- 'active', 'inactive', 'on-leave'
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

### Roles Table Structure
```sql
roles (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  name TEXT,  -- 'Trike Super Admin', 'Admin', 'District Manager', 'Store Manager', etc.
  description TEXT,
  permissions JSONB,
  created_at TIMESTAMPTZ
)
```

### Common Role Names
- `Trike Super Admin` - Platform-level admin (Trike staff)
- `Admin` - Organization admin
- `District Manager` - Manages multiple stores
- `Store Manager` - Manages single store
- `Team Member` - Regular employee

---

## Supabase Query Patterns

### Joining Related Tables
```typescript
// Get users with their role names
const { data } = await supabase
  .from('users')
  .select(`
    id,
    first_name,
    last_name,
    email,
    role:roles(id, name),
    store:stores(id, name, code)
  `)
  .eq('organization_id', orgId);

// Access joined data
const roleName = (user.role as any)?.name || 'Unknown';
const storeName = (user.store as any)?.name || 'No Store';
```

### Filtering by Role (JavaScript approach)
```typescript
const { data: users } = await supabase
  .from('users')
  .select('id, role:roles(name)')
  .eq('organization_id', orgId)
  .eq('status', 'active');

// Filter admins
const admins = users?.filter(u => {
  const roleName = (u.role as any)?.name?.toLowerCase() || '';
  return roleName.includes('admin') || roleName === 'trike super admin';
});

// Filter managers
const managers = users?.filter(u => {
  const roleName = (u.role as any)?.name?.toLowerCase() || '';
  return roleName.includes('manager');
});
```

---

## Component Patterns

### Select with "All" Option
```tsx
const FILTER_OPTIONS = [
  { value: 'all', label: 'All Items' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const [filter, setFilter] = useState('all');

// In fetch function
const apiFilter = filter === 'all' ? undefined : filter;
const data = await fetchData(apiFilter);

// In JSX
<Select value={filter} onValueChange={setFilter}>
  <SelectTrigger>
    <SelectValue placeholder="Filter..." />
  </SelectTrigger>
  <SelectContent>
    {FILTER_OPTIONS.map((opt) => (
      <SelectItem key={opt.value} value={opt.value}>
        {opt.label}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### Select with Optional/None Option
```tsx
const [selectedId, setSelectedId] = useState<string>('');

<Select
  value={selectedId || 'none'}
  onValueChange={(v) => setSelectedId(v === 'none' ? '' : v)}
>
  <SelectTrigger>
    <SelectValue placeholder="Select..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="none">None / Not Applicable</SelectItem>
    {items.map((item) => (
      <SelectItem key={item.id} value={item.id}>
        {item.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

---

## File Structure Notes

### CRUD Operations
All database operations are in `/src/lib/crud/`:
- `users.ts` - User management
- `certifications.ts` - Certification tracking and external uploads
- `compliance.ts` - Compliance requirements, topics, authorities
- `assignments.ts` - Training assignments
- `tracks.ts` - Content tracks
- etc.

### Migrations
- Main migrations: `/src/migrations/`
- Supabase-specific: `/src/supabase/migrations/`

---

## Common Gotchas Checklist

Before submitting code, verify:

1. [ ] No `role_name` references on `users` table - use JOIN with `roles`
2. [ ] No empty string values in `<SelectItem>` components
3. [ ] RLS policies JOIN with roles table for role checks
4. [ ] Type assertions for joined Supabase data: `(user.role as any)?.name`
5. [ ] Null checks for optional joined relations
6. [ ] No references to `user_profiles` table - use `users` table

---

## Deployment Commands

### Deploy Supabase Edge Functions
After modifying any file in `supabase/functions/trike-server/`, deploy with:
```bash
cd Trikebackofficedashboardapplicationschemasandbox
npx supabase functions deploy trike-server
```

Verify deployment:
```bash
curl https://gscfykjtojbcxxuserhu.supabase.co/functions/v1/trike-server/health
```

### Frontend Deployment
Frontend auto-deploys to Vercel on push to main:
```bash
git add .
git commit -m "description of changes"
git push origin main
```

### Local Development
```bash
cd Trikebackofficedashboardapplicationschemasandbox
npm run dev
```
Access at: http://localhost:5173

---

## Company Brain (RAG) System

### Architecture
- Edge Function: `supabase/functions/trike-server/index.ts` handles `/brain/*` endpoints
- Embeddings: OpenAI `text-embedding-3-small` stored in `brain_embeddings` table with pgvector
- Chat: GPT-4o generates responses with inline citations `[1]`, `[2]`
- Auto-indexing: Published tracks are automatically indexed when status changes to "published"

### Key Endpoints
- `POST /brain/chat` - RAG chat with citations (pass `trackId` for context)
- `POST /brain/embed` - Index content for RAG
- `POST /brain/search` - Semantic search
- `POST /brain/backfill` - Index all unindexed published tracks
- `GET /brain/stats` - Index statistics

### Frontend Component
- `src/components/BrainChat/BrainChatDrawer.tsx` - Chat UI drawer
- Renders inline citations from backend `citations` array
- Pass `track` prop for current track context
