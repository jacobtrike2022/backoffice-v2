# Demo Experience - Effective Org ID Audit

Audit of `useEffectiveOrgId` / `getCurrentUserOrgId()` usage across the demo experience. Ensures demo users and Super Admin preview see the correct org's data.

## Summary

| Area | Status | Notes |
|------|--------|-------|
| **Units** | ✅ Fixed | `getStores` now always filters by org (was returning all stores) |
| **Content Library** | ✅ OK | `getTracks` uses `getCurrentUserOrgId()` when no org passed |
| **People** | ✅ OK | Uses `useEffectiveOrgId` for roles, stores, createUser |
| **Activity** | ✅ OK | Uses `useEffectiveOrgId` |
| **Dashboard** | ✅ OK | Uses `useEffectiveOrgId` |
| **Forms** | ✅ OK | `getForms`, `createForm` use `getCurrentUserOrgId()` |
| **KB (Knowledge Base)** | ✅ OK | `KnowledgeBaseRevamp` uses `getCurrentUserOrgId()` |
| **Playlists** | ✅ OK | Uses `useEffectiveOrgId`; CRUD uses `getCurrentUserOrgId()` |
| **Assignments** | ✅ OK | Uses `getCurrentUserOrgId()` |
| **Organization** | ✅ OK | Uses `getCurrentUserOrgId()` |
| **Settings** | ✅ OK | Uses `getCurrentUserOrgId()` |
| **Analytics** | ✅ OK | Uses `useEffectiveOrgId` |
| **Compliance** | ✅ OK | Uses `useEffectiveOrgId` |
| **Certifications** | ✅ OK | CRUD uses `getCurrentUserOrgId()` |
| **Brain (RAG)** | ✅ OK | Uses `getCurrentUserOrgId()` |
| **Tags** | ✅ OK | Uses `getCurrentUserOrgId()` |
| **Sources** | ✅ OK | Uses `getCurrentUserOrgId()` |
| **Roles** | ✅ OK | Uses `getCurrentUserOrgId()` |

---

## Components Using `useEffectiveOrgId` (refetch on org change)

- **People** – roles, stores, createUser
- **EditPeopleDialog** – roles, stores
- **NewUnit** – districts, handleSave
- **Dashboard** – activity analytics, top units, org metrics
- **Analytics** – active learners
- **ActivityFeed** – recent activity
- **PlaylistWizard** – roles, employees, content, assignments
- **Playlists** – fetch, createAlbum
- **DistrictSummary** – districts, stores
- **HeroMetrics** – org stats, trends
- **UnitPerformanceTable** – store performance
- **ComplianceDashboard** – compliance data
- **Units** – stores (via `useStores` with `effectiveOrgId`)

---

## CRUD Layer – Uses `getCurrentUserOrgId()` (correct)

All org-scoped CRUD uses `getCurrentUserOrgId()` which respects:
- Super Admin `setViewingOrgOverride`
- `demo_org_id` URL param
- User's `organization_id`

| CRUD Module | Status |
|-------------|--------|
| stores.ts | ✅ Fixed – `getStores` now always filters by org |
| tracks.ts | ✅ |
| playlists.ts | ✅ |
| albums.ts | ✅ |
| forms.ts | ✅ |
| users.ts | ✅ |
| assignments.ts | ✅ |
| activity.ts | ✅ |
| compliance.ts | ✅ |
| complianceAssignments.ts | ✅ |
| certifications.ts | ✅ |
| knowledge-base.ts | ✅ |
| brain.ts | ✅ |
| tags.ts | ✅ |
| reports.ts | ✅ |

---

## Components Using `getCurrentUserOrgId()` Directly

These call `getCurrentUserOrgId()` at fetch time. Works for demo users; Super Admin preview may need a tab switch or navigation to refetch when org changes.

- **Organization** – districts, unassigned stores
- **Settings** – org settings
- **Assignments** – assignment list, recalculate
- **KnowledgeBaseRevamp** – search, suggested prompts
- **TagsManagement** – tags
- **SourcesManagement** – sources
- **KBSettings** – KB config
- **EmailSettings** – email config
- **RoleDetailPage** – role data
- **RoleModal** – roles
- **PinManagementDialog** – org for PIN
- **BrainChat** – organizationId
- **ExtractedEntityProcessor** – organization

---

## Out of Scope (Trike Admin / Prospect)

- **TrikeAdminPage**, **OrganizationsList**, **DealPipelineBoard** – Super Admin context
- **TeamInvite**, **GoLiveChecklist**, **PaymentSetup** – receive `organizationId` from parent
- **PublicKBViewer** – public KB (org from track slug)
- **KBPublicView** – legacy, unused

---

## Forms Components

- **FormLibrary**, **FormAssignments**, **FormSubmissions**, **FormDetail** – mock data
- **FormBuilder** – `createForm` uses `getCurrentUserOrgId()` when saving
- **FormAnalytics** – mock data

---

## Recommendation

For Super Admin preview switching orgs, components using `getCurrentUserOrgId()` directly may not refetch until navigation. To improve that, add `useEffectiveOrgId` and include `effectiveOrgId` in `useEffect` dependencies where org switching is important.
