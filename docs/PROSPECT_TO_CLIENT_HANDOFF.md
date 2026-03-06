# Prospect to Client — Sprint Handoff Document

**Date:** 2026-03-05
**Sprint Plan:** `.cursor/plans/prospect_portal_sales_event_677c8104.plan.md`
**Event Deadline:** Sales event ~March 12, 2026

---

## 1. Context

Trike is building a "Prospect to Client" portal that automates the sales demo lifecycle for c-store chains. The goal is for the upcoming sales event: every prospect walks away with a personalized, self-guided demo environment, and when they say YES, the system seamlessly transitions them from prospect to client onboarding.

**The lifecycle:**
```
Org Created → Demo (Prospect Experience) → Proposal Signed → Client (New Client Onboarding)
```

**Three user states** drive the frontend experience:
- **Prospect** (org `status = 'prospect'`, demo active): Sees `ProspectJourneyView` with simplified nav
- **Frozen** (org `status = 'prospect'`, `demo_expires_at < now`): Sees `FrozenDemoScreen` — must request meeting or sign proposal + billing
- **Onboarding** (org `status = 'onboarding'`): Sees `ClientOnboardingView` with interactive checklist
- **Live** (org `status = 'live'`) or **Trike Super Admin**: Normal full dashboard

---

## 2. What Was Accomplished

### Phase 0: Terminology + Unified Demo Creation — COMPLETE

| Item | Status | Details |
|------|--------|---------|
| Rename "Sales Pipeline" → "Prospect to Client" | Done | ~10 files: DealDashboard, DealPipelineBoard, DealFormModal, DealCard, DealActivityPanel, PipelineAnalytics, TrikeAdminPage |
| Rename "Deals" → "Demos" | Done | All UI labels, form titles, card text, empty states |
| `POST /demo/create` endpoint | Done | Unified endpoint in `trike-server/index.ts` — enriches from website, creates org + auth user + role + magic link, clones demo content, creates deal record |
| `CreateDemoModal.tsx` | Done | Admin single-create with domain URL, company name, contact email, demo days |
| `BatchDemoCreation.tsx` | Done | Paste domains (one per line), progress bar, results table with copy-able magic links |

### Phase 1: Prospect-Facing Experience — COMPLETE

| Item | Status | Details |
|------|--------|---------|
| Org status detection in `App.tsx` | Done | Fetches `status`, `demo_expires_at` from org; computes `isProspectOrg`, `isDemoExpired`; passes `orgStatusInfo` to `DashboardLayout` |
| `DashboardLayout` simplified nav | Done | Prospect users see only "Dashboard" + "Content Library"; demo expiry badge in sidebar |
| `ProspectJourneyView.tsx` | Done | Left sidebar with 7 journey steps + right content area; Welcome, Explore, ROI, Invite, Proposal, Billing, Go Live |
| `FrozenDemoScreen.tsx` | Done | Full-screen overlay with "Schedule a Call" + "Ready to Get Started?" cards; checks for existing proposals |
| Content Library preview mode | Done | `ContentLibrary` accepts `isProspectOrg` prop; combined with URL `?preview=true` detection |

### Phase 2: Dynamic Checklist — COMPLETE

| Item | Status | Details |
|------|--------|---------|
| `journey_checklist_items` table | Done | Migration applied to production DB; columns: phase, title, description, item_type, sort_order, is_completed, metadata, resource_url, due_date, reviewer_email/name |
| RLS policies | Done | Org members read; Trike admins + org admins manage |
| CRUD module `journeyChecklist.ts` | Done | `getChecklistItems`, `createChecklistItem(s)`, `toggleChecklistItem`, `updateChecklistItem`, `deleteChecklistItem`, `seedDefaultProspectChecklist`, `seedDefaultOnboardingChecklist` |
| `ProspectChecklist.tsx` | Done | Interactive checklist with progress bar, auto-seeds defaults if empty, action buttons navigate to relevant journey steps |

### Phase 3: Proposal View — COMPLETE

| Item | Status | Details |
|------|--------|---------|
| `ProposalView.tsx` | Done | Fetches proposals for current org; shows header, pricing tiers (with "Recommended" highlight), scope, terms sections; Accept/Decline with optional reason; auto-marks as "viewed" on open |
| Integrated into journey | Done | "Review Proposal" step in `ProspectJourneyView` renders `ProposalView` inline |

### Phase 4: Go Live + Client Onboarding — COMPLETE

| Item | Status | Details |
|------|--------|---------|
| Go Live step | Done | Cards pointing prospect to Review Proposal + Set Up Billing |
| `ClientOnboardingView.tsx` | Done | Interactive checklist from `journey_checklist_items` (phase='onboarding'); auto-seeds defaults; toggle completion; celebration state when all complete |

### Phase 5: Fixes — COMPLETE

| Item | Status | Details |
|------|--------|---------|
| TeamInvite org scoping bug | Done | `createUser` now accepts optional `organization_id` override; `TeamInvite` passes `organizationId` prop explicitly |
| TeamInvite wired to journey | Done | "Invite Team" step in `ProspectJourneyView` opens `TeamInvite` dialog with correct org context |

### Prior Work (from earlier agents) — Already in codebase

| Item | Status |
|------|--------|
| `POST /onboarding/enrich-company` endpoint | Working |
| `POST /onboarding/complete` endpoint | Working |
| `POST /demo/provision` endpoint | Working |
| `POST /billing/setup-intent` endpoint | Working |
| `POST /billing/webhook` endpoint | Working |
| `POST /contracts/send` endpoint | Working |
| `POST /contracts/webhook` endpoint | Working |
| `ROICalculator.tsx` (Dialog version) | Working |
| `PaymentSetup.tsx` (Dialog version) | Working |
| `GoLiveChecklist.tsx` (Dialog version) | Working |
| `SendContractDialog.tsx` | Working |
| Health endpoint with dependency checks | Working |
| Rate limiting middleware | Working |
| Brain RAG system templates | Working |
| Notification email trigger (pg_net) | Migration exists |

---

## 3. Files Created in This Sprint

| File | Purpose |
|------|---------|
| `src/components/prospect/ProspectJourneyView.tsx` | Inline stepped journey for prospects |
| `src/components/prospect/FrozenDemoScreen.tsx` | Demo expired full-screen |
| `src/components/prospect/ProposalView.tsx` | Prospect reads + accepts/declines proposal |
| `src/components/prospect/ProspectChecklist.tsx` | Dynamic checklist with auto-seed |
| `src/components/prospect/ClientOnboardingView.tsx` | Post-conversion onboarding checklist |
| `src/components/trike-admin/CreateDemoModal.tsx` | Admin single demo creation |
| `src/components/trike-admin/BatchDemoCreation.tsx` | Admin batch demo creation |
| `src/lib/crud/journeyChecklist.ts` | CRUD for `journey_checklist_items` table |
| `supabase/migrations/20260305200001_journey_checklist.sql` | DB table + RLS (applied) |

## 4. Files Modified in This Sprint

| File | Changes |
|------|---------|
| `src/App.tsx` | Org status detection, conditional routing to Prospect/Frozen/Onboarding views |
| `src/components/DashboardLayout.tsx` | `orgStatusInfo` prop, simplified nav for prospects, demo expiry badge |
| `src/components/ContentLibrary.tsx` | `isProspectOrg` prop for preview mode |
| `src/components/trike-admin/TrikeAdminPage.tsx` | Renamed tabs, added Create Demo + Batch buttons |
| `src/components/trike-admin/DealDashboard.tsx` | Labels: Pipeline → Prospect to Client, Deals → Demos |
| `src/components/trike-admin/DealPipelineBoard.tsx` | Labels: Pipeline Board → Demo Board |
| `src/components/trike-admin/DealFormModal.tsx` | Labels: Deal → Demo |
| `src/components/trike-admin/DealCard.tsx` | Labels: Deal → Demo |
| `src/components/trike-admin/DealActivityPanel.tsx` | Labels: Deal → Demo |
| `src/components/trike-admin/PipelineAnalytics.tsx` | Labels: Deals → Demos |
| `src/components/trike-admin/TeamInvite.tsx` | Passes `organizationId` to `createUser` |
| `src/lib/crud/users.ts` | `CreateUserInput.organization_id` optional override |
| `src/lib/crud/index.ts` | Added `journeyChecklist` export |
| `supabase/functions/trike-server/index.ts` | Added `POST /demo/create` endpoint |

---

## 5. QA Test Flows

### Flow 1: Admin Single Demo Creation
1. Log in as Trike Super Admin
2. Navigate to **Prospect to Client** tab (was "Pipeline")
3. Click **"Create Demo"** button in header
4. Enter a domain URL (e.g., `kwiktrip.com`) and contact email
5. Click Create → should see enriched company data + magic link
6. Copy magic link → open in incognito → should auto-authenticate into prospect experience

**Verify:** Org appears in Organizations list with `status = prospect`, company name populated, logo fetched

### Flow 2: Admin Batch Demo Creation
1. As Trike Super Admin, click **"Batch"** button
2. Paste multiple domains (one per line) with a fallback contact email
3. Click "Create All Demos" → progress bar should advance
4. Each result shows: status (success/error), org name, copyable magic link
5. "Copy All Links" button copies all magic links

**Verify:** All orgs created in Organizations list

### Flow 3: Prospect Journey Experience
1. Log in as a prospect org admin (via magic link from demo creation)
2. Should see **simplified sidebar** (Dashboard + Content Library only)
3. Should see **"Demo expires in X days"** badge in sidebar
4. Dashboard shows `ProspectJourneyView` with left step sidebar
5. **Welcome step:** Company logo, welcome message, demo countdown, 3 quick-action cards, interactive checklist
6. **Explore step:** "Open Content Library" button → navigates to content library in preview mode
7. **ROI step:** Placeholder (ROI calculator exists as Dialog in trike-admin, not yet inlined)
8. **Invite step:** "Invite Team Members" button → opens TeamInvite dialog → invites go to the correct org
9. **Proposal step:** Shows `ProposalView` — if proposal exists, shows details + Accept/Decline; if not, shows "being prepared" message
10. **Billing step:** Placeholder (PaymentSetup exists as Dialog, not yet inlined)
11. **Go Live step:** Summary card with buttons to Review Proposal + Set Up Billing

**Verify:** Checklist auto-seeds 6 default items; items are toggleable; progress bar updates

### Flow 4: Content Library Preview Mode
1. As prospect user, navigate to Content Library
2. Should see published tracks in read-only mode
3. Enroll/Assign/Edit/Delete buttons should be hidden
4. Can browse and view track details

### Flow 5: Demo Expiry / Frozen Screen
1. In Supabase, set a prospect org's `demo_expires_at` to a past date
2. Log in as that org's user
3. Should see `FrozenDemoScreen` with:
   - "Your Demo Has Expired" heading
   - "Schedule a Call" card (with request call / email options)
   - "Ready to Get Started?" card (changes text based on whether proposal exists)

### Flow 6: Proposal Accept Flow
1. As Trike Super Admin, create a proposal for a prospect org via ProposalFormModal
2. Log in as prospect → navigate to "Review Proposal" step
3. Proposal should show with status badge, pricing tiers, total value
4. Click "Accept Proposal" → status changes to "accepted", success toast
5. Journey auto-advances to Billing step

### Flow 7: Proposal Decline Flow
1. On proposal step, click "Decline"
2. Optional reason textarea appears
3. Submit → status changes to "rejected", feedback toast
4. Card shows "Proposal Declined" state with contact CTA

### Flow 8: Client Onboarding Transition
1. Update an org's `status` to `'onboarding'` in Supabase
2. Log in as that org's user
3. Should see `ClientOnboardingView` with progress bar + interactive checklist
4. Default onboarding items should auto-seed (6 items)
5. Toggle items → progress updates; all complete → celebration state

### Flow 9: Trike Super Admin View
1. Log in as Trike Super Admin
2. Should see normal full dashboard with all nav items
3. Prospect to Client tab works with Demo Board, analytics, etc.
4. Can manage any org regardless of status

---

## 6. What Needs to Be Built / Done Next

### High Priority (Before Sales Event)

#### 6.1 Inline Refactoring of Dialog Components
The plan specified refactoring `ROICalculator`, `PaymentSetup`, and `GoLiveChecklist` from Dialog wrappers to inline components within `ProspectJourneyView`. Currently:

- **ROI Calculator:** Exists as `ROICalculator.tsx` (Dialog). The "ROI" step in `ProspectJourneyView` shows a placeholder. **Need:** Extract inner content into a standalone component and render inline in the ROI step.
- **Payment Setup:** Exists as `PaymentSetup.tsx` (Dialog). The "Billing" step shows a placeholder. **Need:** Extract Stripe Elements form into inline component for the billing step.
- **Go Live Checklist:** Exists as `GoLiveChecklist.tsx` (Dialog). The "Go Live" step shows summary cards but not the actual auto-evaluated checklist. **Need:** Render the checklist inline with the Go Live CTA.

#### 6.2 Fix `/onboarding/complete` Status Value
Plan item 5.2: The `/onboarding/complete` endpoint may still set `status: "demo"` instead of `status: "prospect"`. Verify and fix if needed in `trike-server/index.ts`.

#### 6.3 Demo Analytics (Minimal)
Plan item 5.3:
- In `DashboardLayout`: Update `organizations.last_activity_at = NOW()` on page load for prospect orgs (debounced, once per session)
- In `OrganizationsList`: Show `last_activity_at` as "Last active: X days ago"

#### 6.4 Seed Checklist on Demo Create
The `POST /demo/create` endpoint should seed default prospect checklist items automatically when creating a demo org. Currently the checklist auto-seeds on first view via `ProspectChecklist`, but seeding at creation is more reliable.

#### 6.5 Onboarding Transition Automation
When a prospect accepts proposal + sets up billing:
1. Update `organizations.status` to `'onboarding'`
2. Update deal stage to `won`
3. Seed default onboarding checklist items (Phase B)
4. Redirect to `ClientOnboardingView`

This transition logic needs to be wired from the Go Live step or triggered by Stripe webhook confirmation.

### Medium Priority (Post-Event Polish)

#### 6.6 Doc Cleanup
- Rename `docs/SALES_PIPELINE_HANDOFF.md` → `docs/PROSPECT_TO_CLIENT_HANDOFF.md` (if it exists separately from this doc)
- Archive old plan files: `docs/plans/2026-03-04-feature-completeness-*.md` — add "ARCHIVED" header
- Delete duplicate " 2" files in `docs/plans/`
- Write `docs/PROSPECT_TO_CLIENT_ARCHITECTURE.md`

#### 6.7 End-to-End Testing
Full flow testing as described in QA section above. Particular attention to:
- RLS policies working correctly for prospect orgs
- Magic link authentication flow
- Enrichment accuracy (logo detection, state matching, store counts)

### Deferred (Post-Sales Event)
Per the plan's "What to Defer" section:
- Full Phase B automation (HRIS via Merge, content review queue, team onboarding dashboard)
- eSignatures.io signature verification (webhooks work but no sig verify)
- Stripe webhook signature verification
- PostHog analytics integration
- Industry-based track filtering (state-based filtering works)
- DB table rename `deals` → `demos`
- SSO configuration (B2)
- Legacy learner records mapping (B3)
- Post-launch cadence automation: Day 14, 30, 60, 90 check-ins (B8)

---

## 7. Architecture Quick Reference

### Org Status State Machine
```
prospect → onboarding → live
    ↓
  frozen (demo_expires_at < now, same status but different UX)
```

### Key Detection Logic (`App.tsx`)
```typescript
const isTrikeSuperAdmin = currentRole === 'trike-super-admin';
const isProspectOrg = orgStatusInfo.isProspectOrg;    // status = 'prospect'
const isDemoExpired = orgStatusInfo.isDemoExpired;     // demo_expires_at < now

if (isDemoExpired && !isTrikeSuperAdmin) → FrozenDemoScreen
if (isProspectOrg && !isTrikeSuperAdmin) → ProspectJourneyView (on dashboard)
if (status === 'onboarding' && !isTrikeSuperAdmin) → ClientOnboardingView
else → normal dashboard switch/case
```

### Database Tables
- `organizations` — `status`, `demo_expires_at`, `logo_url`, `operating_states`
- `deals` — linked to org, stages: lead/prospect/evaluating/closing/won/lost
- `proposals` — linked to deal + org, statuses: draft/sent/viewed/accepted/rejected
- `journey_checklist_items` — dynamic checklists, phases: prospect/onboarding
- `users` — `organization_id` now passable via `createUser` for cross-org invites

### Edge Function Endpoints
- `POST /demo/create` — unified demo creation (enrich + org + user + content + deal)
- `POST /billing/setup-intent` — Stripe payment method collection
- `POST /contracts/send` — eSignatures.io contract flow
- `POST /onboarding/enrich-company` — website scraping + AI enrichment

### Frontend Component Tree (Prospect)
```
App.tsx
  └── DashboardLayout (simplified nav, orgStatusInfo)
        ├── ProspectJourneyView (when dashboard + prospect)
        │     ├── ProspectChecklist (in Welcome step)
        │     ├── ProposalView (in Proposal step)
        │     └── TeamInvite (in Invite step)
        ├── ContentLibrary (when content + isProspectOrg=true → preview mode)
        ├── FrozenDemoScreen (when demo expired)
        └── ClientOnboardingView (when status=onboarding)
```

---

## 8. Known Issues / Technical Debt

1. **Sonner toast import inconsistency:** Some files use `import { toast } from 'sonner@2.0.3'` and others use `import { toast } from 'sonner'`. Both work but should be standardized.
2. **Lazy loading:** ProspectJourneyView, FrozenDemoScreen, and ClientOnboardingView are lazily imported in `App.tsx` via `React.lazy()`. This is correct for code splitting but means a brief loading spinner on first render.
3. **`isPreviewMode` dual detection:** ContentLibrary checks both `isProspectOrg` prop AND `?preview=true` URL param. The prop-based approach is the intended path; the URL param is a legacy fallback.
4. **Build warning:** Main bundle `index-*.js` is >4MB. Already has code splitting for prospect components but the core bundle could benefit from further lazy loading.
5. **Checklist seeding race condition:** If two users from the same prospect org load the journey simultaneously before any checklist exists, both could trigger `seedDefaultProspectChecklist`. The CRUD handles this gracefully (duplicates just mean extra items) but it's not ideal — seeding at demo creation time is better.
