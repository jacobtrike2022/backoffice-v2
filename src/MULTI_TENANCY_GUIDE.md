# Multi-Tenancy Migration Guide

## Current State: Single-Tenant Mode ✅

Your application is currently configured for **single-tenant** operation, but the architecture is **multi-tenant ready**. All data operations use `getCurrentUserOrgId()` which currently returns a fixed organization ID.

### Configuration
- **File**: `/lib/config.ts`
- **Current Settings**:
  - `ENABLE_MULTI_TENANCY`: `false` (single-tenant mode)
  - `DEFAULT_ORG_ID`: `'10000000-0000-0000-0000-000000000001'`
  - `DEMO_MODE`: `true` (allows unauthenticated access)
  - `REQUIRE_AUTH`: `false` (authentication optional)

---

## When You're Ready for Multi-Tenancy

### Step 1: Verify Database Schema

Ensure all content tables have `organization_id` column:

```sql
-- Check which tables need organization_id
SELECT table_name 
FROM information_schema.columns 
WHERE column_name = 'organization_id' 
AND table_schema = 'public';

-- Should include at minimum:
-- - tracks
-- - facts
-- - fact_usage
-- - playlists
-- - assignments
-- - users
```

If any tables are missing the column:

```sql
-- Add organization_id to tables that need it
ALTER TABLE table_name 
ADD COLUMN organization_id UUID REFERENCES organizations(id);

-- Create index for performance
CREATE INDEX idx_table_name_org_id ON table_name(organization_id);
```

### Step 2: Create Organizations Table (if needed)

```sql
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  settings JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true
);

-- Seed your default organization
INSERT INTO organizations (id, name, slug)
VALUES ('10000000-0000-0000-0000-000000000001', 'Default Organization', 'default')
ON CONFLICT (id) DO NOTHING;
```

### Step 3: Set Up Row Level Security (RLS)

Enable RLS on all tables to ensure organization data isolation:

```sql
-- Enable RLS on tracks table (repeat for all tables)
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see tracks from their organization
CREATE POLICY "Users can view own org tracks"
  ON tracks FOR SELECT
  USING (
    organization_id = (
      SELECT organization_id FROM users 
      WHERE auth_user_id = auth.uid()
    )
  );

-- Policy: Service role has full access (for server operations)
CREATE POLICY "Service role has full access"
  ON tracks FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');
```

### Step 4: Update Authentication

Choose one of these methods to associate users with organizations:

#### Option A: User Metadata (Simplest)

```typescript
// During user signup
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password',
  options: {
    data: {
      organization_id: 'org-uuid-here'
    }
  }
});
```

#### Option B: Users Table (Most Flexible)

```sql
-- Ensure users table has organization_id and auth_user_id
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- Create index for lookups
CREATE INDEX idx_users_auth_user_id ON users(auth_user_id);
```

```typescript
// After user signs up, create user record
const { data: authUser } = await supabase.auth.signUp({...});

await supabase.from('users').insert({
  auth_user_id: authUser.user.id,
  organization_id: 'org-uuid-here',
  email: authUser.user.email,
  role_id: 'role-uuid'
});
```

### Step 5: Enable Multi-Tenancy

Update `/lib/config.ts`:

```typescript
export const APP_CONFIG = {
  ENABLE_MULTI_TENANCY: true,  // ← Change this
  DEFAULT_ORG_ID: '10000000-0000-0000-0000-000000000001',
  REQUIRE_AUTH: true,           // ← Change this
  DEMO_MODE: false,             // ← Change this
} as const;
```

### Step 6: Test Organization Isolation

1. Create two test organizations
2. Create users in each organization
3. Create content in each organization
4. Verify users can ONLY see their organization's content
5. Test RLS policies by trying to access other org's data

---

## Migration Checklist

- [ ] Database has `organizations` table
- [ ] All content tables have `organization_id` column with indexes
- [ ] RLS policies are created and tested
- [ ] Authentication flow sets `organization_id` in user metadata or users table
- [ ] Updated `APP_CONFIG.ENABLE_MULTI_TENANCY = true`
- [ ] Updated `APP_CONFIG.REQUIRE_AUTH = true`
- [ ] Updated `APP_CONFIG.DEMO_MODE = false`
- [ ] Tested organization data isolation
- [ ] Created organization management UI (optional)
- [ ] Implemented organization switching (if users can belong to multiple orgs)

---

## Advanced Features (Optional)

### Organization Invitations

```typescript
// Invite user to organization
async function inviteUserToOrganization(email: string, orgId: string, roleId: string) {
  // Send invitation email
  // Create pending invitation record
  // User accepts -> create user record with organization_id
}
```

### Organization Switching

```typescript
// If users can belong to multiple organizations
async function switchOrganization(newOrgId: string) {
  // Verify user has access to this org
  // Update session/context with new org ID
  // Reload data for new organization
}
```

### Organization Settings

```typescript
// Store org-specific settings
interface OrganizationSettings {
  branding: {
    logo_url: string;
    primary_color: string;
  };
  features: {
    ai_facts_enabled: boolean;
    transcription_enabled: boolean;
  };
  limits: {
    max_users: number;
    max_storage_gb: number;
  };
}
```

---

## Current Benefits (Even in Single-Tenant Mode)

✅ **Future-proof architecture**: All queries already filter by `organization_id`  
✅ **Clean codebase**: Consistent data access patterns across all CRUD operations  
✅ **Easy testing**: Can test multi-tenancy locally by changing one config flag  
✅ **No refactoring needed**: When you enable multi-tenancy, your code just works  
✅ **RLS-ready**: Database schema supports Row Level Security policies  

---

## Questions?

- **Q: What happens if I enable multi-tenancy now?**  
  A: The app will work the same way, but will start checking user authentication and reading `organization_id` from user metadata or the users table.

- **Q: Can I test multi-tenancy locally?**  
  A: Yes! Just set `ENABLE_MULTI_TENANCY = true` and create test users with different `organization_id` values in their metadata.

- **Q: What's the performance impact?**  
  A: Minimal. You should add indexes on `organization_id` columns. All queries already include the org filter.

- **Q: Can I have users that access multiple organizations?**  
  A: Yes, but you'll need a join table (`user_organizations`) and additional logic to switch between organizations.
