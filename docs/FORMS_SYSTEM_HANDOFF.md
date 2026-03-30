# Forms Management System — Agent Handoff Document

> **For:** Next Claude Code agent / project manager spinning up a fresh coding team
> **Purpose:** Continue building without missing context, intent, or scope
> **Last updated:** 2026-03-30
> **Status:** Forms system is live on production, actively iterating

---

## 1. Project Context

### What Trike Backoffice 2.0 Is

Enterprise multi-tenant LMS platform for convenience store and foodservice operations. Manages a hierarchical structure: **Organizations → Districts → Stores → Users**. Built for real c-store operational use — training, compliance, knowledge management, and now forms/inspections.

**Stack:**
- Frontend: React 18 + TypeScript, Vite 6, Tailwind CSS, Radix UI, shadcn/ui
- Backend: Supabase (PostgreSQL + RLS + Edge Functions)
- Auth: Supabase Auth (email/password)
- Hosting: Vercel (auto-deploys from GitHub `main` branch — also push to `exp/jacob` and `demo/stable`)
- Demo mode: No auth session; org scoped via `?demo_org_id={uuid}` URL param; uses anon key for all queries

**Key Vercel branches (all must stay in sync):**
```
main → production
exp/jacob → production alias
demo/stable → demo environment
```
Push to all three: `git push origin main:main main:exp/jacob main:demo/stable`

Then trigger deploy: `npx vercel deploy --prod --yes` from project root.

---

## 2. Why Forms Was Rebuilt — The SafetyCulture Migration Context

A key prospect is migrating from **SafetyCulture (iAuditor)** to Trike Backoffice 2.0. SafetyCulture is the dominant inspection/forms platform in the c-store space. The Forms Management tab in Backoffice previously existed as **UI vaporware** — mock data, no database connection, no functional builder, nothing real.

This session was a full ground-up rebuild of the entire forms system from scratch, wired to real Supabase data, designed to credibly match or exceed the SafetyCulture feature set that c-store operators actually use day-to-day.

---

## 3. What Was Built — Forms System Phases 1–5

All five phases were completed in a single extended session using parallel Claude Code agents.

### Phase 1 — Canvas Builder + Real DB Wiring
- `useFormBuilder` hook with 3-second debounce auto-save
- `FormBuilder` rewritten as a full-width canvas (FigJam-style flow: START → blocks → END)
- Block picker popup with Questions / Content / Actions tabs
- 15+ block types: Short Answer, Long Answer, Number, Date, Time, Multiple Choice, Checkboxes, Dropdown, Yes/No, Rating, File Upload, Signature, Slider, Location, Photo
- All CRUD functions extended with `orgId` scoping for demo mode
- Real Supabase persistence — forms and blocks saved to DB on every auto-save

### Phase 2 — Public Form Fill + Submissions
- `PublicFormFill` component (KB viewer pattern, no-auth anon key access)
- trike-server Edge Function endpoints: `GET /forms/public/:formId` and `POST /forms/public/:formId/submit`
- `FormSubmissions` rebuilt with real data, approve/reject workflow, status filtering
- `FormRenderer` extended to support all 15+ block types with validation

### Phase 3 — Assignments + Analytics
- `FormAssignments` rebuilt with real `form_assignments` data
- `FormAnalytics` rebuilt with real aggregate queries (submissions over time, completion rates, block-level response analysis)
- `formAnalytics.ts` with orgId-scoped Supabase queries

### Phase 4 — Conditional Logic Engine
- `conditionalLogic.ts` evaluator (AND/OR multi-condition rules)
- `ConditionBuilder` UI in properties drawer — per-block show/hide rules
- Canvas shows branch indicators on blocks with active logic
- `FormRenderer` wires evaluator for live hide/show during form fill

### Phase 5 — Templates, Versioning, PDF Export
- `is_template` flag + template toggle in builder for `trike-super-admin` role
- `formVersions.ts`: snapshot form+blocks to JSONB at publish time, version history panel in `FormDetail`
- trike-server: `GET /forms/submissions/:id/pdf` — branded print-optimized HTML export
- `forms.current_version` column incremented on every publish

---

## 4. Multi-Agent Architecture Used in This Session

This session used Claude Code's parallel agent capability extensively. Key agent runs:

### Parallel 4-Agent Pass (Post-Phase 5)
After all five phases were wired up, four specialized agents ran simultaneously:
- **Review agent** — code quality, patterns, consistency
- **UI polish agent** — design token compliance, visual improvements
- **QA agent** — bug finding, edge cases, error states
- **Refiner agent** — integrated all findings, made final fixes

**Lesson learned:** Parallel agents can introduce contradictions. In this session, the QA agent and refiner agent contradicted each other on the `created_by` vs `created_by_id` column name — one changed it to `created_by`, the other to `created_by_id`. The safe resolution was to omit the field entirely in demo mode (always null), which works regardless of which column name the DB uses. When running parallel agents on the same files, designate a single "truth source" agent to reconcile conflicts.

### Subsequent Fix Agents
After the main build, individual targeted agents were used for:
- Color system audit (replacing hardcoded hex with design tokens)
- Final UI audit (scroll/overflow/layout bugs across all forms components)

### How to Run Agents on This Codebase
```
Agent tool with subagent_type: "general-purpose"
Always specify: project root, file scope, design system rules, demo mode pattern
Always end agent prompts with: commit + push to all three branches + vercel deploy
```

---

## 5. Critical Architecture Patterns — Do Not Break

### Demo Mode (Most Important)
No Supabase auth session exists in demo. Every query must scope by `orgId` from the URL param.

```typescript
// In Forms.tsx — always read orgId from URL as fallback
const urlDemoOrgId = new URLSearchParams(window.location.search).get('demo_org_id') || '';
const effectiveOrgId = orgId || urlDemoOrgId;

// In Edge Function calls — always fallback to anon key
const authToken = session?.access_token || publicAnonKey;
```

### DB Column Rules (Hard-won, do not regress)
- Users table: `role_name` column does NOT exist — always JOIN with `roles` table
- Forms table: use `created_by_id` — but omit entirely in demo mode (user is null)
- `form_blocks` table: DB column is `type` not `block_type` — `toDbRow()` helper maps these
- `form_blocks` table: no `settings` column — merged into `validation_rules._settings`

### Block Save Logic (Fragile — understand before touching)
`bulkUpsertFormBlocks` in `src/lib/crud/forms.ts` must DELETE before INSERT. Reversing this order causes newly inserted blocks to be immediately deleted (their IDs aren't in the existing ID set fetched for the DELETE query).

After save, `useFormBuilder` always re-fetches from DB to get real IDs for new blocks. It merges carefully: keeps live in-memory state for existing blocks (preserves user's typing), only swaps in DB versions for `_isNew` blocks. Do not revert this to a full `setBlocks(refreshedBlocks)` — that was the original data-loss bug.

### Radix UI Select — No Empty Strings
```typescript
// WRONG — crashes runtime
<SelectItem value="">All</SelectItem>

// CORRECT
<SelectItem value="all">All</SelectItem>
// Then: const apiFilter = filter === 'all' ? undefined : filter;
```

---

## 6. Current State — What Works

| Feature | Status | Notes |
|---|---|---|
| Form Builder canvas | ✅ Working | Auto-save, add/delete/reorder blocks |
| Block types (15+) | ✅ Working | All render in builder and FormRenderer |
| Properties drawer | ✅ Working | Per-block settings, conditional logic |
| Form Library | ✅ Working | Real DB, search/filter, grid/list view |
| Archive form | ✅ Working | Sets status = 'archived', hidden from default view |
| Delete form | ✅ Working | Hard delete from DB |
| Duplicate form | ✅ Working | |
| Templates | ✅ Working | Super admin only, `is_template` flag |
| Version history | ✅ Working | Snapshots at publish, panel in FormDetail |
| Public form fill | ✅ Working | Anon access via slug/id |
| Form submissions | ✅ Working | Real DB, status filter |
| Approve/reject | ✅ Working | Sets `approved_at`, `approved_by_id` |
| Conditional logic | ✅ Working | AND/OR, show/hide blocks |
| Form Analytics | ✅ Working | Submission trends, response breakdowns |
| Form Assignments | ✅ Working | Assign to user/store/district/role |
| PDF export | ✅ Working | Branded HTML via Edge Function |
| Demo mode orgId | ✅ Working | Read from URL immediately, no wait for App.tsx |

---

## 7. SafetyCulture Feature Comparison & Gap Analysis

### What SafetyCulture Does That We Need Next

SafetyCulture is primarily used in c-store for **inspections, opening/closing checklists, temperature logs, and incident reports**. Here's an honest gap analysis of the features operators actually depend on, prioritized by practical value to Trike's prospect base.

#### Priority 1 — High Value, Feasible Now

| SC Feature | Our Status | Gap / Next Step |
|---|---|---|
| **Scoring / pass-fail logic** | Partial | Block-level scoring exists in schema, not wired to UI. Add score weighting per block + overall pass/fail threshold on form settings. |
| **Photo capture on mobile** | Schema only | Photo block type exists, but file upload to Supabase Storage not implemented. Wire `FileUpload` + `Photo` blocks to real Supabase Storage bucket. |
| **Repeat/recurring inspections** | Not started | SC's killer feature for daily logs. Add `recurrence_rule` (cron string) to `form_assignments`. Trigger assignment creation via Edge Function cron. |
| **Bulk submission export (CSV)** | Not started | Ops managers live in Excel. Add CSV export of submission response data from `FormSubmissions` tab. |
| **Submission notifications** | Partial | `createNotification` calls exist but `user_id: ''` in demo mode. Wire real notifications for form submission + approval events. |
| **Form preview as filler** | ✅ Exists | `FormRenderer` in preview mode works. |

#### Priority 2 — Medium Value, Planned Architecture Exists

| SC Feature | Our Status | Gap / Next Step |
|---|---|---|
| **Offline mode** | Not started | SC's biggest enterprise advantage. Complex — requires service worker + local IndexedDB sync. Consider PWA wrapper. |
| **QR code form access** | Not started | Generate QR linking to `/forms/public/:slug`. Simple — just a QR lib + display in `FormDetail`. |
| **Digital signatures** | Schema only | Signature block type exists in builder + renderer UI, but no actual signature capture (canvas drawing). Add `react-signature-canvas` to the signature block. |
| **Action items / corrective actions** | Not started | SC allows flagging a response as requiring a follow-up action with assignee + due date. Maps to a new `form_actions` table. |
| **Template library (global)** | Partial | Template flag + clone-to-org exists. Missing: a global Trike-curated template gallery that orgs can browse and clone. |

#### Priority 3 — Nice to Have, Lower Urgency

| SC Feature | Our Status | Gap / Next Step |
|---|---|---|
| **Logic branching (page-level)** | Not started | We have block-level conditional logic. SC also supports jumping to a different section based on answers. Extend `conditionalLogic.ts` to support `goto_section`. |
| **Geolocation stamping** | Not started | Auto-capture GPS on submission. Location block type exists; add navigator.geolocation on submit. |
| **Multi-language forms** | Not started | Not in SC's free tier either. Low priority for now. |
| **White-label public fill page** | Partial | `PublicFormFill` uses org name + logo. Add custom primary color from org settings. |

#### What We Have That SC Doesn't
- Native LMS integration (forms tied to training tracks, playlists, compliance)
- AI brain / RAG chat on form content
- District/store hierarchy scoping on assignments
- Version history with full JSONB snapshots

---

## 8. Known Issues & Tech Debt

1. **`form_submissions` has no `organization_id` column** — analytics queries must always scope through a `forms!inner` join. Do not add `organization_id` filters directly on `form_submissions`.

2. **`form_blocks.type` vs `block_type`** — The DB column is `type`. The frontend interface uses `block_type`. The `toDbRow()` helper in `bulkUpsertFormBlocks` handles this mapping. If you add new block save paths, use the same helper.

3. **Notification `user_id` is empty string in demo mode** — `createNotification` calls in `forms.ts` pass `user_id: ''` because there's no auth user in demo. These calls are wrapped in try-catch so they fail silently. Before production auth goes live, wire real user IDs.

4. **`form_assignments` has no enforcement layer** — assignments are stored but there's no mechanism that surfaces "you have a form due" to a Team Member on login. This needs a dashboard widget or notification trigger.

5. **The `FormDetail` component is legacy** — Built as a view layer before the full builder existed. Currently used only for version history display. Consider consolidating into `FormBuilder` long-term.

6. **Duplicate numbered `.tsx` files in `/src/components/`** — Throughout the repo there are files named `Component 2.tsx`, `Component 3.tsx` etc. These are cursor/agent artifacts. Do not edit them; they are dead code and should be cleaned up in a dedicated pass.

---

## 9. File Map — Forms System

```
src/
├── components/
│   ├── Forms.tsx                          # Tab shell, orgId plumbing
│   └── forms/
│       ├── FormBuilder.tsx                # Canvas builder, block picker, properties drawer
│       ├── FormLibrary.tsx                # Grid/list view, filters, CRUD actions
│       ├── FormAnalytics.tsx              # Charts, submission stats
│       ├── FormAssignments.tsx            # Assignment management
│       ├── FormSubmissions.tsx            # Submission list + detail + approve/reject
│       ├── FormDetail.tsx                 # Version history, metadata view
│       ├── PublicFormFill.tsx             # Anonymous public fill page
│       └── shared/
│           ├── FormRenderer.tsx           # Block rendering engine (fill mode + preview)
│           └── ConditionBuilder.tsx       # Conditional logic UI
├── hooks/
│   └── useFormBuilder.ts                  # State, auto-save, block management
└── lib/
    └── crud/
        ├── forms.ts                       # All form/block/submission CRUD
        ├── formVersions.ts                # Version snapshot create/read
        └── formAnalytics.ts               # Aggregate query functions

supabase/functions/trike-server/index.ts   # Edge Function — /forms/* endpoints
```

---

## 10. Immediate Next Steps (Prioritized)

These are actionable tasks the next agent team should tackle in order:

1. **Wire file/photo upload to Supabase Storage**
   - `FileUpload` and `Photo` block types render in the builder and renderer but don't actually store files
   - Create a `form-uploads` Supabase Storage bucket (public or signed URL)
   - In `FormRenderer`, handle `type: file` / `type: photo` inputs → upload on submit → store URL in response data

2. **Scoring / pass-fail**
   - Add `score_weight` field to `FormBlockInput` and properties drawer
   - Add `pass_threshold` (0–100) to form settings
   - Compute `score_percentage` on submission, compare to threshold, set `status: 'passed'` / `'failed'`
   - Surface pass/fail badge on submission cards in `FormSubmissions`

3. **QR code for public form access**
   - `npm install qrcode.react`
   - In `FormDetail`, show a QR code linking to `https://[domain]/fill/[formId]`
   - Add a "Copy Link" button next to it

4. **Recurring assignments**
   - Add `recurrence_rule` (cron string or simple enum: daily/weekly/monthly) to `form_assignments`
   - Write a Supabase cron job (pg_cron or Edge Function with schedule) that creates new assignment instances
   - Surface "due today" badge on form cards in Form Library for assigned users

5. **Assignment enforcement UI**
   - Add "My Forms" widget to the main Dashboard for Team Member / Store Manager roles
   - Shows forms assigned to user with due dates, completion status

6. **Digital signature capture**
   - `npm install react-signature-canvas`
   - Wire the `signature` block type in `FormRenderer` to a canvas drawing component
   - On submit, serialize as base64 PNG and store in response data

7. **CSV bulk export of submissions**
   - Add "Export CSV" button to `FormSubmissions` header
   - Flatten `response_data` JSONB into columns, one row per submission

---

## 11. Running This Project Locally

```bash
cd "Trikebackofficedashboardapplicationschemasandbox"
npm run dev
# → http://localhost:5173

# Demo mode (no login required):
# http://localhost:5173/?demo_org_id=<uuid>
# Get a valid org UUID from Supabase → Table Editor → organizations
```

Deploy anytime:
```bash
git add .
git commit -m "your message"
git push origin main:main main:exp/jacob main:demo/stable
npx vercel deploy --prod --yes
```

Edge Function changes:
```bash
npx supabase functions deploy trike-server
```

---

*This document was generated as part of a multi-agent Claude Code session. For full conversation context and code archaeology, see the session transcript referenced in the project memory file.*
