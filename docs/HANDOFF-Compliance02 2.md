# HANDOFF: Trike Compliance Engine - Phase 2

**Date:** January 22, 2026
**Status:** Prompts 1-6 Complete, Ready for Testing & Prompts 7-10
**Previous Session:** Context compacted - full transcript at `.claude/projects/` if needed

---

## 1. WHAT WE'RE BUILDING

The **Trike Compliance Engine** automates compliance training assignments based on:
- **Role** (Store Manager, Cashier, etc.)
- **Location/State** (TX, GA, FL, etc.)
- **Certification Requirements** (TABC, Food Handler, CFPM, etc.)

### The "Mad Libs" Approach
Instead of creating 50 variants of a role for each state, we configure from the **Requirement side**:

> "People with **[these ROLES]** in **[these STATES]** need **[this CERTIFICATION]**"

Example:
- TX Store Managers need TABC
- GA Store Managers need CFPM
- All states: Food Handlers need Food Handler Card

---

## 2. DATABASE SCHEMA (Prompt 1 - COMPLETE)

### Migrations Applied (via Supabase SQL Editor)
Located in `/supabase/migrations/`:

| Migration | Purpose |
|-----------|---------|
| `20260120100001_compliance_industries.sql` | Industry taxonomy (NAICS-based) |
| `20260120100002_standard_role_types.sql` | Standard role types (may be deprecated) |
| `20260120100003_system_locked_playlists.sql` | Playlist versioning for compliance |
| `20260120100004_compliance_assignment_queue.sql` | Assignment queue with triggers |
| `20260120100005_enhanced_user_certifications.sql` | Enhanced cert tracking |
| `20260120100006_assignment_engine_functions.sql` | RPC functions for assignment logic |

### Pre-existing Core Schema
Located in `/src/migrations/00009_create_compliance_requirements.sql`:
- `compliance_topics` - Categories (Alcohol, Food Handler, Tobacco, etc.)
- `compliance_authorities` - Regulatory bodies (TABC, DBPR, etc.)
- `compliance_requirements` - State-specific requirements with rules
- `role_compliance_requirements` - Join table linking roles ↔ requirements

### Key Tables

```sql
-- Assignment Queue (new)
compliance_assignment_queue (
  id, organization_id, employee_id, requirement_id,
  status: 'pending' | 'assigned' | 'completed' | 'suppressed' | 'expired' | 'cancelled',
  triggered_by: 'onboarding' | 'transfer' | 'promotion' | 'expiration' | 'manual',
  due_date, assigned_at, completed_at, suppressed_reason
)

-- Playlist Versioning (new)
album_versions (
  id, album_id, version, track_snapshot (JSONB),
  total_duration_minutes, change_notes, locked_at, locked_by
)

-- Albums Extended (new columns)
albums (
  ... existing columns ...,
  is_system_locked BOOLEAN,
  requirement_id UUID FK,
  version INTEGER,
  locked_at, locked_by
)
```

---

## 3. TYPESCRIPT CRUD LAYER (Prompt 2 - COMPLETE)

### New Files Created

**`/src/lib/crud/complianceAssignments.ts`** (~536 lines)
```typescript
// Types
export type AssignmentStatus = 'pending' | 'assigned' | 'completed' | 'suppressed' | 'expired' | 'cancelled';
export type AssignmentTrigger = 'onboarding' | 'transfer' | 'promotion' | 'expiration' | 'manual';
export interface ComplianceAssignment { ... }
export interface ComplianceAssignmentStats { ... }

// Functions
getComplianceAssignmentQueue(filters?)     // Get queue with employee/requirement joins
getComplianceAssignmentStats()             // Get counts by status
assignCompliancePlaylist(id, playlistId)   // Assign a playlist to fulfill requirement
suppressComplianceAssignment(id, reason)   // Suppress (external cert exists)
triggerOnboardingAssignments(employeeId)   // Called on new hire
getComplianceAssignmentStats()             // Dashboard stats
suppressAssignmentsForCertification(...)   // Bulk suppress when cert uploaded
```

**`/src/lib/crud/industries.ts`** (~266 lines)
```typescript
getIndustries()                   // Get industry taxonomy
getIndustryRequirements(id)       // Requirements for an industry
setOrganizationIndustry(orgId, industryId)
getOrganizationIndustry(orgId)
```

### Modified Files

**`/src/lib/crud/albums.ts`** (added ~230 lines)
```typescript
// New Types
export interface AlbumVersion { ... }
export interface SystemLockedAlbum { ... }

// New Functions
lockPlaylist(albumId, requirementId, changeNotes?)  // Lock + create version
unlockPlaylist(albumId)                              // Remove compliance lock
getPlaylistVersions(albumId)                         // Version history
getPlaylistVersion(albumId, version)                 // Specific version
getSystemLockedPlaylists()                           // All locked playlists
getPlaylistsForRequirement(requirementId)            // Playlists for a requirement
```

**`/src/lib/crud/compliance.ts`** (added ~290 lines)
```typescript
// New Types
export interface RequirementRole { ... }

// New Functions
getRequirementRoles(requirementId)           // Roles linked to requirement
setRequirementRoles(requirementId, roleIds[]) // Set role links (replaces all)
addRoleToRequirement(requirementId, roleId)
removeRoleFromRequirement(requirementId, roleId)
getRequirementsWithRoles(filters?)           // Requirements with roles joined
getOrgRolesForPicker()                       // Roles for multi-select UI
getOrgStates()                               // States where org has locations
getSuggestedRequirements()                   // AI-suggested requirements
```

**`/src/lib/crud/index.ts`** - Added exports for new modules

---

## 4. REACT COMPONENTS (Prompts 3-6 - COMPLETE)

All components in `/src/components/compliance/`:

### AssignmentQueue.tsx (Prompt 3)
The main queue for managing pending compliance assignments.

**Features:**
- Stats cards: Pending, Assigned, Completed, Suppressed, Overdue
- Filter tabs: Pending | Assigned | All
- Search by employee name or requirement
- Filter by trigger type (Onboarding, Transfer, etc.)
- Table with: Employee, Requirement, Trigger, Due Date, Status, Actions
- "Assign" button → opens playlist picker dialog
- "Suppress" button → captures reason (external cert)
- Color-coded status/trigger badges

### RequirementRulesModal.tsx (Prompt 4)
"Mad libs" style configuration for requirement-to-role mapping.

**Features:**
- Sentence display: "People with [X roles] in [Y states] need [Requirement]"
- Multi-select role picker with quick filters (All, None, Managers, Frontline)
- Multi-select state picker with "Our Locations" quick filter
- Summary showing affected employees
- Change tracking (Save only enabled when changed)

### PlaylistLockingPanel.tsx (Prompt 5)
Manage system-locked compliance playlists.

**Features:**
- Stats: Locked count, Total tracks, Total duration
- Table: Playlist, Linked Requirement, Version, Locked Date, Actions
- Lock dialog: Select playlist → Select requirement → Add notes
- Unlock confirmation with warning
- Version history dialog showing all snapshots

### ComplianceDashboard.tsx (Prompt 6)
Main entry point tying everything together.

**Tabs:**
1. **Overview** - Stats cards, Needs Attention alerts, Quick links
2. **Queue** - AssignmentQueue component
3. **Requirements** - RequirementsManager component
4. **Playlists** - PlaylistLockingPanel component
5. **Settings** - TopicsManager + AuthoritiesManager

**Features:**
- Clickable stat cards navigate to relevant tabs
- Badge on Queue tab showing pending count
- Responsive (icons-only on mobile)

### Pre-existing Components (not modified)
- `ComplianceManagement.tsx` - Old tabbed interface
- `RequirementsManager.tsx` - CRUD for requirements
- `TopicsManager.tsx` - CRUD for topics
- `AuthoritiesManager.tsx` - CRUD for authorities
- `CertificationApprovalQueue.tsx` - External cert approvals
- `ExternalCertificationUpload.tsx` - Upload external certs

---

## 5. WHAT'S NOT WIRED UP YET

### Critical: New Dashboard Not Connected to App.tsx

The **new** `ComplianceDashboard` at `src/components/compliance/ComplianceDashboard.tsx` is **NOT** being used.

The app currently uses:
- **"Compliance"** sidebar → `src/components/ComplianceDashboard.tsx` (old, different file)
- **"Compliance Management"** sidebar → `src/components/compliance/ComplianceManagement.tsx`

**To test the new dashboard**, update `App.tsx`:

```typescript
// Change this import:
import { ComplianceManagement } from "./components/compliance/ComplianceManagement";

// To use our new dashboard:
import { ComplianceDashboard as NewComplianceDashboard } from "./components/compliance/ComplianceDashboard";

// Then in the switch case for 'compliance-management':
case "compliance-management":
  return <NewComplianceDashboard />;
```

Or add a new route entirely.

---

## 6. REMAINING PROMPTS (7-10)

### Prompt 7: Onboarding Integration
Hook the assignment engine into the employee onboarding flow.
- Call `triggerOnboardingAssignments(employeeId)` when new employee created
- Show compliance requirements during onboarding wizard
- Auto-assign based on role + location

### Prompt 8: External Certification Recognition
When employee uploads external cert:
- Auto-suppress matching queue items
- Call `suppressAssignmentsForCertification()`
- Update certification records

### Prompt 9: Recertification Alerts
- Cron job or edge function to check expiring certs
- Create new queue items for expiring certifications
- Send notifications

### Prompt 10: Reporting & Analytics
- Compliance rate by location/role
- Overdue assignments report
- Certification expiration calendar
- Export capabilities

---

## 7. KEY DESIGN DECISIONS

### Why NOT "role variants per state"?
Originally considered: `QT Store Manager TX`, `QT Store Manager GA`, etc.
**Problem:** 50 states × N roles = overwhelming for admins

**Solution:** Configure from Requirement side with multi-select.

### Why separate `complianceAssignments.ts`?
Existing `assignments.ts` handles regular content assignments.
Compliance assignments have different:
- Status workflow (pending → assigned → completed)
- Trigger types (onboarding, transfer, expiration)
- Suppression capability (external certs)

### Why `standard_role_types` might be deprecated?
We discovered the `roles` table already has:
- `is_manager` boolean
- `is_frontline` boolean
- Job family/department fields

The new table may be redundant. Consider dropping if not needed.

---

## 8. FILE REFERENCE

### New Files (This Session)
```
src/lib/crud/complianceAssignments.ts      # Assignment queue CRUD
src/lib/crud/industries.ts                  # Industry taxonomy CRUD
src/components/compliance/AssignmentQueue.tsx
src/components/compliance/RequirementRulesModal.tsx
src/components/compliance/PlaylistLockingPanel.tsx
src/components/compliance/ComplianceDashboard.tsx  # NEW main dashboard
```

### Modified Files (This Session)
```
src/lib/crud/albums.ts                      # Added lock/version functions
src/lib/crud/compliance.ts                  # Added requirement-roles functions
src/lib/crud/index.ts                       # Added new exports
src/components/compliance/index.ts          # Added new exports
```

### Key Existing Files
```
src/App.tsx                                 # Main app routing
src/components/DashboardLayout.tsx          # Sidebar navigation
src/components/ComplianceDashboard.tsx      # OLD compliance dashboard (different!)
src/migrations/00009_create_compliance_requirements.sql  # Core schema
```

---

## 9. TESTING CHECKLIST

### Database
- [ ] All 6 migrations applied in Supabase
- [ ] `compliance_assignment_queue` table exists
- [ ] `album_versions` table exists
- [ ] `albums` has new columns (is_system_locked, requirement_id, version)
- [ ] RPC functions exist (check_employee_compliance, process_assignment_queue)

### CRUD Layer
- [ ] `getComplianceAssignmentQueue()` returns data
- [ ] `getComplianceAssignmentStats()` returns counts
- [ ] `getSystemLockedPlaylists()` works
- [ ] `getOrgRolesForPicker()` returns roles

### UI Components
- [ ] AssignmentQueue renders without errors
- [ ] PlaylistLockingPanel renders without errors
- [ ] RequirementRulesModal opens and loads data
- [ ] ComplianceDashboard tabs work

### Integration
- [ ] Wire new ComplianceDashboard into App.tsx
- [ ] Test navigation from sidebar
- [ ] Test tab switching within dashboard

---

## 10. CONTEXT FOR NEXT AGENT

**You are continuing work on the Trike Compliance Engine.**

The frontend components are built but not yet wired into the app. The immediate next steps are:

1. **Wire up the new dashboard** - Update App.tsx to use `ComplianceDashboard` from `./components/compliance/ComplianceDashboard`

2. **Test the UI** - Make sure components render and data flows correctly

3. **Continue to Prompt 7** - Onboarding integration

The user (Jacob) is the founder of Trike and is building an LMS for frontline workers. He prefers practical solutions over over-engineering and wants to see things working before moving to the next phase.

Key files to read first:
- This handoff doc
- `/src/components/compliance/ComplianceDashboard.tsx`
- `/src/components/compliance/AssignmentQueue.tsx`
- `/src/lib/crud/complianceAssignments.ts`
- `/src/App.tsx` (to understand routing)
