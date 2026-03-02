# Trike Unified Revenue Engine
## Architecture Addendum

**Added:** January 25, 2026  
**Related:** PROJECT-CHARTER.md

---

## Build Architecture: Standalone + Drawer Pattern

### Why This Approach

To avoid breaking the existing Trike Backoffice while building this major feature set, we'll use the **standalone page + floating drawer** pattern (same as the onboarding agent).

**Benefits:**
- Completely isolated from main dashboard routing
- Same database, same auth, same components
- Can build and test without touching existing code
- Easy to toggle on/off during development
- When ready, promote to proper navigation

### File Structure

```
/app/
├── (existing routes)/
│
└── trike-admin/                    ← NEW: Isolated Trike Super Admin module
    ├── page.tsx                    ← Main entry (deal dashboard)
    ├── layout.tsx                  ← Layout with nav for this module
    │
    ├── deals/
    │   ├── page.tsx                ← Pipeline view
    │   └── [dealId]/
    │       └── page.tsx            ← Deal detail with engagement
    │
    ├── create-demo/
    │   └── page.tsx                ← Demo creation wizard
    │
    ├── proposals/
    │   ├── page.tsx                ← Proposal list
    │   └── [proposalId]/
    │       ├── page.tsx            ← Proposal builder
    │       └── preview/
    │           └── page.tsx        ← Proposal preview
    │
    ├── onboarding-tracker/
    │   └── page.tsx                ← All active onboardings
    │
    ├── client-health/
    │   └── page.tsx                ← Health scores, renewals
    │
    └── components/
        ├── TrikeAdminDrawer.tsx    ← Floating trigger + drawer
        ├── DealCard.tsx
        ├── EngagementScore.tsx
        ├── ProposalBuilder.tsx
        └── ...
```

### Drawer Trigger

Add to main layout (only visible to Trike Super Admins):

```tsx
// In main layout.tsx or a global component
{isTrikeSuperAdmin && (
  <TrikeAdminDrawerTrigger />
)}
```

The trigger is a floating button (bottom-right, like onboarding agent) that opens the `/trike-admin` content in a slide-over drawer or full-screen modal.

### Access Control (Pre-RLS)

Until RLS is implemented, use the existing role dropdown for testing:

```typescript
// utils/permissions.ts
export function isTrikeSuperAdmin(user: User, selectedRole: string): boolean {
  // During development, respect the role dropdown
  if (selectedRole === 'trike_super_admin') return true;
  
  // Also check actual user attributes
  if (user.email?.endsWith('@triketraining.com')) return true;
  if (user.app_metadata?.is_trike_admin) return true;
  
  return false;
}
```

Route protection:

```typescript
// app/trike-admin/layout.tsx
export default function TrikeAdminLayout({ children }) {
  const { user, selectedRole } = useAuth();
  
  if (!isTrikeSuperAdmin(user, selectedRole)) {
    redirect('/dashboard'); // Or show unauthorized message
  }
  
  return <>{children}</>;
}
```

---

## Relationship to Existing Onboarding Agent

### What Already Exists

The current onboarding agent (`/src/components/Onboarding/`) is a **prospect demo creation wizard**:

```
CURRENT FLOW:
website → scrape → confirm → industry → services → locations → employees → contact → review → create demo
```

**Existing Components:**
- `OnboardingChat.tsx` - Step-by-step wizard UI (~900 lines)
- `OnboardingPage.tsx` - Standalone page wrapper
- `lib/api/onboarding.ts` - API client

**Existing API Endpoints:**
- `POST /onboarding/start` - Start session
- `POST /onboarding/enrich-company` - Scrape website
- `POST /onboarding/update` - Update session data
- `POST /onboarding/complete` - Create demo org
- `GET /onboarding/options` - Get industries/services/states

**Existing Database (Migration 00017):**
- `organizations.status` already exists with values: `lead`, `demo`, `contracting`, `onboarding`, `active`, `churned`, `suspended`
- `organizations.demo_expires_at`, `industry`, `services_offered`, `operating_states` already exist
- `industries` table with seeded data (convenience_retail, qsr, grocery, etc.)
- `service_definitions` table with seeded data (fuel, alcohol, tobacco, etc.)
- `onboarding_sessions` table for tracking wizard progress
- `create_demo_organization()` function

### Status Value Reconciliation

**IMPORTANT:** The existing migration has different status values than the PRD proposed. We need to reconcile:

```sql
-- EXISTING (Migration 00017):
status IN ('lead', 'demo', 'contracting', 'onboarding', 'active', 'churned', 'suspended')

-- PRD PROPOSED:
status IN ('prospect', 'evaluating', 'closing', 'onboarding', 'live', 'frozen', 'churned', 'renewing')

-- RECONCILED (use this):
status IN (
  'lead',        -- Inbound interest, no demo yet
  'prospect',    -- Demo created, exploring (replaces 'demo')
  'evaluating',  -- Actively comparing, ROI engaged, stakeholders invited
  'closing',     -- Proposal sent, negotiating (replaces 'contracting')
  'onboarding',  -- Signed, setting up (keep as-is)
  'live',        -- Fully launched (replaces 'active')
  'frozen',      -- Demo expired or account paused
  'churned',     -- Left (keep as-is)
  'suspended',   -- Admin action (keep as-is)
  'renewing'     -- Annual renewal period
)
```

**Migration Strategy:**
```sql
-- Update existing status values
UPDATE organizations SET status = 'prospect' WHERE status = 'demo';
UPDATE organizations SET status = 'closing' WHERE status = 'contracting';
UPDATE organizations SET status = 'live' WHERE status = 'active';

-- Update the check constraint
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_status_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_status_check 
  CHECK (status IN ('lead', 'prospect', 'evaluating', 'closing', 'onboarding', 'live', 'frozen', 'churned', 'suspended', 'renewing'));
```

### Evolution Path

The onboarding agent **becomes** the onboarding state in the larger lifecycle:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  PROSPECT STATE                     (NEW)                       │
│  └── Prospect Portal                                            │
│      └── Sales Room, ROI Calculator, Proposals                  │
│                                                                 │
│              ↓ (agreement signed)                               │
│                                                                 │
│  ONBOARDING STATE                   (EVOLVED AGENT)             │
│  └── Onboarding Portal                                          │
│      └── Current agent features +                               │
│          Content review, HRIS setup, Launch prep                │
│                                                                 │
│              ↓ (launch confirmed)                               │
│                                                                 │
│  LIVE STATE                         (EXISTING PRODUCT)          │
│  └── Full Trike Dashboard                                       │
│      └── Content library, Assignments, Compliance, Analytics    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Migration Path

1. **Phase 1-4:** Build prospect/deal management in `/trike-admin`
2. **Phase 5:** Evolve onboarding agent into onboarding portal
   - Keep existing agent functionality
   - Add content review workflow
   - Add HRIS connection flow
   - Add launch prep features
3. **Phase 6:** Connect everything with state transitions
4. **Final:** Move from drawer to proper navigation

---

## Permission Model

### Roles

| Role | Scope | Access |
|------|-------|--------|
| `trike_super_admin` | Global | All orgs, all deals, pipeline, proposals, health |
| `client_super_admin` | Single org | Full admin for their organization |
| `client_admin` | Single org | Limited admin (assigned regions/locations) |
| `client_manager` | Single location | Manager dashboard for their store |
| `learner` | Single user | Their assignments only |

### New Roles for Prospects

| Role | Scope | Access |
|------|-------|--------|
| `prospect_champion` | Demo org | Full sales room, can invite reviewers |
| `prospect_reviewer` | Demo org | View sales content, ROI, proposal (based on invite permissions) |

### Role Dropdown (Development)

The existing role dropdown should include:
- `trike_super_admin` ← New, for testing this feature
- `client_super_admin`
- `client_admin`
- `client_manager`
- `learner`
- `prospect_champion` ← New, for testing prospect experience
- `prospect_reviewer` ← New, for testing reviewer experience

---

## Database Strategy

### Extend, Don't Replace

All changes extend existing tables or create new ones. No modifications to existing columns that would break current functionality.

```sql
-- SAFE: Adding new columns with defaults
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'live';

-- SAFE: New tables
CREATE TABLE engagement_events (...);
CREATE TABLE proposals (...);

-- DANGEROUS: Avoid this
ALTER TABLE organizations 
ALTER COLUMN some_existing_column TYPE new_type; -- DON'T DO THIS
```

### Migration Safety

```sql
-- Migration: 001_add_organization_status.sql

-- Add status field (defaults to 'live' so existing clients unaffected)
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'live'
CHECK (status IN ('prospect', 'evaluating', 'closing', 'onboarding', 'live', 'frozen', 'renewing', 'churned'));

-- Add timestamp for status changes
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill: All existing orgs are 'live'
UPDATE organizations 
SET status = 'live', status_changed_at = NOW() 
WHERE status IS NULL;
```

---

## Starter Prompt (Updated)

Use this when starting a new chat session to implement:

---

**COPY BELOW THIS LINE**

---

I've loaded the Trike Prospect-to-Client Flow PRD. Before we start building, here's the critical context:

**Build Strategy:**
- We're building this as a **standalone module** in `/app/trike-admin/` 
- It will be accessed via a **floating drawer trigger** (like our onboarding agent)
- Same database, same auth, same component library — just isolated routing
- This way we don't break anything in the main product while building

**Permission Model:**
- "Trike Super Admin" = Jacob/Trike team (sees all orgs, all deals, pipeline)
- "Client Admin" = Customer admins (see only their org)
- We have a role dropdown selector for testing different roles (pre-RLS)
- Gate the `/trike-admin` routes to only show for `trike_super_admin` role

**EXISTING ONBOARDING AGENT (Critical - Don't Break This):**

There's already an onboarding agent at `/src/components/Onboarding/` that creates demo orgs:
- `OnboardingChat.tsx` (~900 lines) - Step wizard: website → scrape → industry → services → states → contact → create demo
- `OnboardingPage.tsx` - Standalone wrapper
- `lib/api/onboarding.ts` - API client for /onboarding/* endpoints
- Migration 00017 already created: `industries`, `service_definitions`, `onboarding_sessions` tables

**EXISTING DATABASE STATUS VALUES:**
```sql
-- Migration 00017 has these status values:
status IN ('lead', 'demo', 'contracting', 'onboarding', 'active', 'churned', 'suspended')
```

We need to RECONCILE these with our new states. Use this mapping:
- `demo` → `prospect` (exploring, in sales room)
- `contracting` → `closing` (proposal sent)
- `active` → `live` (launched)
- ADD: `evaluating` (engaged, ROI done), `frozen` (expired), `renewing`

**Evolution Plan:**
1. Phase 1-4: Build Trike Admin module (deals, proposals) — DON'T touch existing agent
2. Phase 5: Evolve the existing onboarding agent into the onboarding portal
3. Phase 6: Connect everything with state transitions

**Database Rules:**
- Extend existing tables with new columns (with safe defaults)
- Create new tables for new features
- DON'T change existing column types or remove columns
- Migration should update status CHECK constraint and migrate existing values

**Let's start with Phase 1: Foundation.**

First, let's:
1. Review the existing `/app` structure to understand routing
2. Set up `/app/trike-admin/` with layout + route protection
3. Create the floating drawer trigger component
4. Create a placeholder deal dashboard page
5. Write the migration to extend `organizations.status` with new values (reconciling with existing)

Start by showing me the current app structure, then show me the code for these pieces.

---

**COPY ABOVE THIS LINE**

---
