# Sales Pipeline — Handoff & Go-Live Checklist

**Branch:** `exp/jacob`
**Date:** 2026-03-03
**Status:** Feature-complete (all 14 sprint tasks done), verified in demo mode, ready for production deployment

---

## What Was Built

A full sales pipeline system for Trike's internal team to manage prospect organizations from initial lead through close. This lives under **Trike Admin → Sales Pipeline** and is only accessible to Trike Super Admins.

### Components

| Component | File | Purpose |
|-----------|------|---------|
| `TrikeAdminPage` | `src/components/trike-admin/TrikeAdminPage.tsx` | Tab container (Dashboard, Pipeline, Orgs, Proposals, Analytics, Prospect Portal) |
| `DealPipelineBoard` | `DealPipelineBoard.tsx` | Kanban board with drag-and-drop stage columns: Lead → Prospect → Evaluating → Closing → Won/Lost |
| `DealCard` | `DealCard.tsx` | Individual deal card with value, probability, dropdown actions, bulk select |
| `DealFormModal` | `DealFormModal.tsx` | Create/edit deal form (org, stage, value, MRR, dates, notes) |
| `DealActivityPanel` | `DealActivityPanel.tsx` | Slide-out sheet with activity timeline (notes, calls, emails, stage changes, value changes) |
| `DealDashboard` | `DealDashboard.tsx` | KPI summary cards + pipeline overview |
| `OrganizationsList` | `OrganizationsList.tsx` | Table of all orgs with status badges, search, provision action |
| `ProposalsList` | `ProposalsList.tsx` | Proposals tab with editor, status tracking, version management |
| `PipelineAnalytics` | `PipelineAnalytics.tsx` | Revenue forecast, conversion funnel, MRR/ARR tracking, weighted forecasting |
| `DemoProvisioningModal` | `DemoProvisioningModal.tsx` | Provisions a demo environment for a prospect org |
| `ProspectJourneyPanel` | `ProspectJourneyPanel.tsx` | Visual journey timeline for prospect orgs |
| `PipelineNotificationsBell` | `PipelineNotifications.tsx` | Bell icon with dropdown, 30s polling, mark read/delete |
| `ProspectPortal` | `ProspectPortal.tsx` | Prospect-facing portal with proposal view, demo access, onboarding tracker |

### Database Schema

5 new tables + 1 view + 6 triggers + RLS policies across 8 migrations:

- **`deals`** — Pipeline deals with stage, value, MRR, probability, close dates
- **`deal_activities`** — Activity log (notes, calls, emails, stage changes, value changes, owner changes)
- **`proposals`** — Sales proposals linked to deals with version tracking
- **`pipeline_notifications`** — In-app notification system with auto-generation from deal changes
- **`notification_preferences`** — Per-user notification channel/event preferences (future email/Slack)
- **`organization_compliance_topics`** — Junction table for demo provisioning content
- **`pipeline_summary`** — Materialized view for stage-level aggregates
- **Triggers**: Auto-log stage changes, auto-log value/owner changes, auto-update `last_activity_at`, sync org status on deal won, generate deal notifications

### Edge Function

`POST /demo/provision` on `trike-server`:
- Sets org status to `prospect`, sets `demo_expires_at`
- Clones global compliance topics into the org
- Clones sample published tracks
- Updates linked deal stage to `evaluating`

---

## What Was Verified (End-to-End)

All verified via browser automation against live Supabase backend:

| Feature | Result | Evidence |
|---------|--------|----------|
| Deal creation | **PASS** | Form submits, deal appears in pipeline board |
| Deal editing | **PASS** | Edit dialog pre-fills all fields, saves correctly |
| Activity panel | **PASS** | Sheet opens, activity timeline renders |
| Pipeline search | **PASS** | Filters deals by name in real-time |
| Organizations tab | **PASS** | 9 orgs loaded (8 Prospect, 1 Live) |
| Proposals tab | **PASS** | Empty state renders correctly |
| Analytics tab | **PASS** | 4 KPI cards, charts, revenue forecast, stage breakdown — all real data |
| Demo provisioning | **PASS** | Edge function 200, modal shows "Environment Ready", toast confirms |

### Bugs Found & Fixed During Verification

1. **`display_name`/`avatar_url` query errors** — Removed references to non-existent columns (PGRST201/PGRST205)
2. **RLS 42501 errors in demo mode** — Added `anon` role RLS policies for deals, deal_activities, proposals
3. **`WITH CHECK` missing on `FOR ALL` policies** — PostgreSQL requires explicit `WITH CHECK` for INSERT/UPDATE operations
4. **Dual-dialog event propagation** — Dropdown clicks were bubbling to the deal card's edit dialog; fixed with `e.stopPropagation()`

---

## Production Deployment Guide

### Step 1: Run Migrations (in order)

All 8 migration files must be applied sequentially to the production database. They are idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`) and safe to re-run.

```
supabase/migrations/20260303100001_prospect_pipeline_states.sql
  └─ Core tables: deals, deal_activities, proposals, pipeline_summary view
  └─ Org status remapping: demo→prospect, contracting→closing, active→live
  └─ Triggers: auto-log stage changes, auto-update last_activity_at, sync org status on won

supabase/migrations/20260303100002_fix_deals_rls_with_check.sql
  └─ Adds WITH CHECK clauses to FOR ALL RLS policies (required by PostgreSQL)

supabase/migrations/20260303100003_deals_demo_mode_rls.sql
  └─ GUC-guarded anon policies: only active when current_setting('app.demo_mode') = 'true'

supabase/migrations/20260303100004_rls_hardening.sql
  └─ Authenticated user RLS: deal owners can view/edit their own deals
  └─ Org member read access to deals/activities/proposals
  └─ Trike admin full access via roles JOIN

supabase/migrations/20260303100005_deal_org_linking.sql
  └─ Trigger: auto-update org columns (deal_value, deal_stage) when deal changes
  └─ Trigger: provisioning auto-finds matching deal by organization_id

supabase/migrations/20260303100006_auto_log_deal_changes.sql
  └─ Enhanced trigger: auto-logs value changes and owner reassignments to deal_activities

supabase/migrations/20260303100007_seed_demo_template_content.sql
  └─ organization_compliance_topics junction table
  └─ Template org (Trike Templates) + 8 published template tracks for demo provisioning

supabase/migrations/20260303100008_pipeline_notifications.sql
  └─ pipeline_notifications + notification_preferences tables
  └─ Auto-generate notifications trigger on deal stage/value/owner changes
  └─ Sends to deal owner + all Trike Super Admins
```

**Apply via:**
```bash
# Option A: Supabase CLI (recommended)
cd Trikebackofficedashboardapplicationschemasandbox
npx supabase db push

# Option B: Manual — paste each file into Supabase Dashboard → SQL Editor
# Apply in order: 100001 → 100002 → 100003 → 100004 → 100005 → 100006 → 100007 → 100008
```

> **Important:** Migration `100001` modifies the `organizations` table CHECK constraint and remaps existing status values (`demo` → `prospect`, `contracting` → `closing`, `active` → `live`). The codebase has already been updated to use the new values.

### Step 2: Deploy Edge Function

The `trike-server` edge function has the `/demo/provision` endpoint for demo provisioning.

```bash
cd Trikebackofficedashboardapplicationschemasandbox
npx supabase functions deploy trike-server
```

**Required environment variables** (set in Supabase Dashboard → Edge Functions → trike-server → Settings):

| Variable | Required | Purpose |
|----------|----------|---------|
| `SUPABASE_URL` | Auto-set | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-set | Bypasses RLS for provisioning |
| `OPENAI_API_KEY` | Yes | Brain/RAG embeddings + chat |
| `ASSEMBLYAI_API_KEY` | Optional | Audio transcription |
| `ANTHROPIC_API_KEY` | Optional | Checkpoint AI features |
| `RESEND_API_KEY` | Optional | Email delivery |

### Step 3: Verify Deployment

```bash
# 1. Health check
curl https://gscfykjtojbcxxuserhu.supabase.co/functions/v1/trike-server/health

# 2. Test provisioning (replace ORG_ID with a real prospect org UUID)
curl -X POST https://gscfykjtojbcxxuserhu.supabase.co/functions/v1/trike-server/demo/provision \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"organization_id": "ORG_ID", "demo_days": 14}'

# 3. Verify notifications trigger — update a deal stage via SQL:
# UPDATE deals SET stage = 'closing' WHERE id = 'DEAL_ID';
# Then check: SELECT * FROM pipeline_notifications ORDER BY created_at DESC LIMIT 5;
```

### Step 4: Frontend Deployment

Frontend auto-deploys to Vercel on push to main:

```bash
git checkout main
git merge exp/jacob
git push origin main
```

### Step 5: Demo Mode Anon Policies (Optional Cleanup)

All demo mode anon policies are GUC-guarded: they only activate when `current_setting('app.demo_mode', true) = 'true'`. This setting is **not enabled by default**, so the policies are inert in production. No cleanup is necessary unless you want to remove the dead policies for tidiness.

---

## Sprint Completion Summary

All 14 tasks from the original sprint are complete:

| # | Task | Status | Migration/File |
|---|------|--------|----------------|
| 1 | Fix stale org status refs | Done | Codebase updated to prospect/closing/live |
| 2 | Guard anon RLS + add auth RLS | Done | `100004_rls_hardening.sql` |
| 3 | Fix deal↔org linking | Done | `100005_deal_org_linking.sql` |
| 4 | Auto-log value/owner changes | Done | `100006_auto_log_deal_changes.sql` |
| 5 | Proposal editor UI | Done | `ProposalsList.tsx` updated |
| 6 | Drag-and-drop pipeline board | Done | `DealPipelineBoard.tsx` with dnd |
| 7 | Seed template content | Done | `100007_seed_demo_template_content.sql` |
| 8 | MRR/ARR tracking | Done | `PipelineAnalytics.tsx` enhanced |
| 9 | Weighted pipeline forecasting | Done | `PipelineAnalytics.tsx` enhanced |
| 10 | Bulk operations | Done | Multi-select, CSV export in pipeline board |
| 11 | Pipeline notifications | Done | `100008_pipeline_notifications.sql` + UI |
| 12 | Prospect portal | Done | `ProspectPortal.tsx` new tab |
| 13 | Verify all migrations | Done | All 8 verified correct |
| 14 | Document deploy steps | Done | This section |

### Future Enhancements (Not in Sprint)

- **Email/Slack notification delivery** — `notification_preferences` table is ready; add delivery logic to edge function
- **PDF proposal export** — `proposals.pdf_url` column exists; add PDF generation endpoint
- **Historical conversion analytics** — Time-in-stage metrics, win rate trends
- **Prospect portal authentication** — Public token-based access for prospects to view their portal

---

## Architecture Notes for Future Developers

### Data Flow
```
TrikeAdminPage (tab state)
  → DealPipelineBoard (fetches deals via crud/deals.ts)
    → DealCard × N (display + dropdown actions)
      → DealFormModal (create/edit)
      → DealActivityPanel (activity log)
  → OrganizationsList (fetches orgs, triggers provisioning)
    → DemoProvisioningModal → Edge Function /demo/provision
  → ProposalsList (fetches proposals via crud/proposals.ts)
  → PipelineAnalytics (aggregate queries)
```

### Key Patterns
- **CRUD layer**: `src/lib/crud/deals.ts`, `proposals.ts`, and `pipeline-notifications.ts` handle all Supabase queries
- **Type definitions**: `src/components/trike-admin/types.ts` — all Deal, Activity, Proposal interfaces
- **RLS (3 tiers)**: Trike Super Admin (full access via roles JOIN) → Authenticated users (own deals/org deals) → Anon (GUC-guarded demo mode only)
- **Triggers (6 total on deals)**: Auto-log stage changes, auto-log value/owner changes, auto-update `last_activity_at`, sync org status on won, auto-update org columns, auto-generate notifications
- **Trigger cascade safety**: Triggers terminate at recursion depth 2 to prevent infinite loops

### Demo Mode Considerations
When `DEMO_MODE=true`:
- No Supabase Auth session exists (`auth.uid()` returns NULL)
- `auth.role()` returns `'anon'`
- Anon RLS policies grant full CRUD access
- The password gate (`SuperAdminPasswordDialog`) still protects the Trike Admin section

---

## Files Changed (Sales Pipeline Specific)

```
src/components/trike-admin/          ← 15 files (UI components + notifications + prospect portal)
src/lib/crud/deals.ts                ← Deal CRUD operations
src/lib/crud/proposals.ts            ← Proposal CRUD operations
src/lib/crud/pipeline-notifications.ts ← Notification CRUD operations
src/components/trike-admin/types.ts  ← TypeScript interfaces
supabase/migrations/20260303100001-08 ← 8 migration files
supabase/functions/trike-server/index.ts ← /demo/provision endpoint
docs/SALES_PIPELINE_HANDOFF.md       ← This document
```

**Total:** ~8,000+ lines of new code across 18+ files + 8 migrations + 1 edge function endpoint.
