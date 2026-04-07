# Handoff: Employee Sync / CSV Import Build

**Last updated:** 2026-04-07
**Status:** Phase 1 complete, deployed to live Supabase, dry-run ready
**Next likely user:** Jacob will run a real import of Kristen's Paylocity CSV (158 employees, Weigel's prospect → 1st live conversion)

---

## TL;DR for the next agent

The Trike LMS bulk employee import was upgraded from a "create-only" CSV tool into a **full sync engine** that handles initial seed AND ongoing census updates from HRIS exports. Same flow, two modes:

- **Seed mode** (first import): everyone is new, classified as `new`
- **Sync mode** (every import after): rows classified as `new` / `update` / `unchanged` / `reactivate` / `missing` with field-level diffs

The architecture is built so that wiring up a real Paylocity/ADP/Workday API later is just "feed `bulkUpsertUsers` from a different source" — the matching, diffing, and audit log are all source-agnostic.

**The build is on `main` branch**, all 8 migrations applied to production Supabase (`kgzhlvxzdlexsrozbbxs`), TypeScript clean, browser smoke test passed end-to-end with zero console errors and zero leaked test data.

---

## What lives where

### Database (live in Supabase project `kgzhlvxzdlexsrozbbxs`)

Migrations applied via Supabase MCP, all idempotent, all in `supabase/migrations/`:

| File | Adds |
|------|------|
| `20260406000000_add_mobile_phone.sql` | `users.mobile_phone TEXT` |
| `20260407000000_add_unit_number_to_stores.sql` | `stores.unit_number INTEGER` + index + best-effort backfill from `code` |
| `20260407000100_add_employment_type_to_roles.sql` | `roles.employment_type TEXT` (`hourly`/`salaried`/`admin` CHECK) + index |
| `20260408000000_add_external_id_to_users.sql` | `users.external_id TEXT` + `external_id_source` + per-org unique partial index. **313/315 users got backfilled** from existing `employee_id` |
| `20260408000100_add_status_to_stores.sql` | `stores.status TEXT` (`active`/`ignored`/`deactivated` CHECK) + backfill from `is_active`. **304 active, 0 ignored, 0 deactivated** |
| `20260408000200_add_match_strategy_to_orgs.sql` | `organizations.employee_match_strategy` + `_locked BOOLEAN` |
| `20260408000300_create_user_import_history.sql` | `user_import_history` audit table + RLS policies (gated on `Admin` and `Trike Super Admin` roles) |
| `20260408000400_add_user_lifecycle_tracking.sql` | `users.last_active_at TIMESTAMPTZ` + `users.deactivated_at TIMESTAMPTZ` + composite index |

> **Important:** the column `external_id` is the **HRIS-native employee identifier** (Paylocity Employee ID, ADP, Workday, etc). The legacy `employee_id` column still exists for customer-internal numbering / badge numbers, but `external_id` is what the sync engine matches on.

### Backend / CRUD layer

**`src/lib/crud/users.ts`** — heart of the sync engine. Contains:
- New types: `MatchStrategy`, `MatchLevel`, `UserSyncInput`, `UserSyncOptions`, `FieldChange`, `SyncRowClassification`, `SyncClassificationResult`, `SyncCommitResult`
- `classifyUserSync(rows, options)` — pure-ish function that runs the **match ladder** and returns `SyncClassificationResult` (no DB writes other than the pre-fetch SELECT). Match ladder order:
  1. `external_id` exact (confidence 100)
  2. `email` lowercase exact (95)
  3. `mobile_phone` E.164 exact (90)
  4. `first + last + hire_date` exact (85)
  5. `first + last + store_id` exact (70)
  6. None → classified as `new`
- `commitUserSync(classification, options)` — does the actual writes. Inserts in batches of 25, updates per-row with parallel chunks of 10, deactivates only if `missing_action: 'deactivate'`. Writes audit log via `recordImport()`. Wrapped in try/catch so audit failures don't break the import.
- `bulkUpsertUsers(rows, options)` — convenience wrapper that runs classify + commit in one call
- `bulkCreateUsers(input)` — **legacy shim** that translates the old `BulkCreateUsersInput` into the new sync engine. Currently has no remaining callers in `src/`. Safe to delete in cleanup.

**`src/lib/crud/userImportHistory.ts`** (NEW) — single export `recordImport()`. Writes to the `user_import_history` audit table. Truncates `diff_summary` if > 1MB. Catches and logs errors so a failed audit write doesn't break the import.

**`src/lib/crud/stores.ts`** — added:
- `status` field support across `getStores`, `createStore`, `updateStore`, `bulkCreateStores`
- `getStores` filters now accept `status` and `include_ignored`
- New helpers: `getActiveAndIgnoredStores()`, `getIgnoredStoreIds()`
- `bulkCreateStores` is now batched (single insert + per-row fallback on failure)
- Each created store carries `input_index` so callers can map errors back to source rows reliably

**`src/lib/api/roles.ts`** — `bulkCreateRoles` is batched same as stores. `rolesApi.list()` N+1 was fixed (was firing one count query per role). `employment_type` flows through `create`/`update`.

**`src/lib/supabase.ts`** — added:
- `EmployeeMatchStrategy` type
- `getOrganization(organization_id)`
- `updateOrganization(organization_id, updates)`
- `getEffectiveMatchStrategy(organization_id)` — defaults to `'external_id'` if `'auto'`

**`src/lib/importMapping.ts`** — added:
- `external_id` target field with HRIS aliases (priority before `employee_id`)
- `RECOMMENDED_FIELDS` array + `getMissingRecommendedFields()` helper
- `parseImportFile()` — shared CSV/Excel parser used by all 3 bulk import components
- `SKIP_VALUE` constant (replaces all `'__skip__'` literals)
- `parseName()`, `extractNumber()`, `fuzzyMatchValue()` (with `unit_number` matching), `fuzzyMatchRole()`, `validatePhone()` (libphonenumber-js), `cleanPhoneInput()`, `formatPhoneDisplay()`, `normalizeNameCase()`, `normalizeEmploymentType()`

### Components

**`src/components/SyncReviewDiff.tsx`** (NEW, ~760 lines) — reusable 4-tab diff renderer:
- Tabs: All / New / Changes / Unchanged / Missing (5 buttons but 4 conceptual buckets, Missing is the "danger" tab)
- Per-row "Apply" checkboxes for change-tab rows so admins can untick specific updates
- Missing tab forces explicit "Leave as-is" or "Mark as inactive" choice + typed confirmation input
- Uses `cn` from `./ui/utils` (the project's clsx + tailwind-merge helper)
- All props are pure inputs/callbacks — no internal data fetching

**`src/components/EditableImportTable.tsx`** — enhanced with:
- HRIS ID column (read from `external_id` target field)
- Sticky first `#` column
- Single shared `openLookup` state lifted to parent (prevents popover stacking)
- `autoFocus` instead of refs (avoids forwardRef issues with shadcn `<Input>`)

**`src/components/BulkEmployeeImport.tsx`** (~1850 lines) — the main fullscreen import flow:
- 6 steps: `upload` → `mapping` → `review` → `sync_preview` → `importing` → `results`
- Mapping step: column auto-detect, missing-recommended-fields warning, full-name auto-split suggestion, localStorage mapping cache
- Review step: editable table with inline cell editing, lookup popovers for role/store, +Create-new flow, sidebar with active pending creates
- **Sync_preview step (new):** runs `classifyUserSync` (with `previewLoading` state), pending stores/roles are flushed BEFORE classification (no drift), shows `SyncReviewDiff` with sidebar summary
- Apply gates (in `handleImport`):
  - `classification` must be non-null
  - If `missingAction === 'deactivate'`: typed `"deactivate"` must match
  - If deactivating > 50% of active users: extra `window.confirm` hard block
- Uses the **saved classification** from preview directly in commit (no reclassification drift)

**`src/components/BulkUnitImport.tsx`** — fullscreen overlay (matches employee import style):
- Template download (`downloadUnitTemplate`)
- `status` field passthrough (`active`/`ignored`/`deactivated`)
- Uses shared `parseImportFile`, `fuzzyMatchValue`, `getConfidenceColor`, `getConfidenceLabel`
- Uses `useDistricts` hook
- Reset timeout cancellation on rapid close/reopen

**`src/components/BulkRoleImport.tsx`** (NEW, ~720 lines) — bulk role import:
- Mirrors BulkUnitImport pattern
- Pre-fetches existing roles via `rolesApi.list()` to detect duplicates and mark them as struck-through "already exists"
- Template download includes Store Leader (salaried) example
- Wired into `RolesManagement.tsx` next to the "New Role" button

**`src/components/Settings.tsx`** — added employee match strategy dropdown + lock toggle:
- Lives in the Company Information card
- Dropdown disabled unless `currentRole === 'trike-super-admin'` AND `_locked` is false
- Lock toggle (Switch) only renders for super admins
- Persists immediately on change (intentional — sensitive setting)

**`src/components/NewUnit.tsx`** — added "Unit Status" dropdown to the create + edit form

**`src/components/Units.tsx`** — added Status badges (Ignored / Deactivated) next to performance badge in the units list. `useStores` filter now passes `include_ignored: true`.

**`src/components/RolesManagement.tsx`** — Import button next to New Role, dialog wired to `BulkRoleImport`

**`src/components/EmployeeProfile.tsx`** — shows `employmentType` badge from the role relation

---

## What's verified working live

End-to-end smoke test on the deployed schema (no test data committed):

| Test | Status |
|------|--------|
| Upload CSV with HRIS Employee ID column | ✅ auto-maps to `external_id` |
| HRIS ID column visible in editable table | ✅ |
| Mapping → Edit → Sync Preview transition | ✅ |
| `classifyUserSync` runs against live DB without errors | ✅ |
| 2 test rows correctly classified as "New" | ✅ (didn't match any existing user) |
| 10 existing users correctly classified as "Missing from file" | ✅ |
| Missing tab "Mark as inactive" radio reveals confirm input | ✅ |
| Confirm input value bubbles up to parent state (`deactivateConfirmText`) | ✅ |
| Tabs: All (2) / New (2) / Changes (0) / Unchanged (0) / Missing (10) | ✅ |
| Match Strategy badge shows "HRIS Employee ID" | ✅ |
| "Apply 2 changes" button (gated on `syncReadyCount`) | ✅ |
| Back-to-Edit navigation | ✅ |
| Close + reopen with fresh state | ✅ |
| Zero console errors throughout | ✅ |
| Zero test data in DB after smoke (verified via SQL) | ✅ |

---

## Critical things the next agent should know

### 1. The match ladder always runs in fixed order
The `employee_match_strategy` setting in Settings is currently **informational only**. The match ladder in `classifyUserSync` always runs `external_id → email → mobile_phone → name+hire_date → name+store` regardless of what's set. The Settings dropdown is wired to write to the column, but the engine ignores it.

**Decision pending from Jacob:** is this OK (keep ladder always-on for safety) or should explicit settings constrain to only one match level? See QA finding #6 in the original review.

### 2. Pending creates run BEFORE preview classification
This was a critical bug fix. When the admin clicks "+ Create new: Store 47" in the Edit step, that store **does not exist yet**. If we classify employees first, those rows get classified with `store_id: undefined`, then when commit creates the store and tries to apply, the classification might be wrong (rows might match by name+store after store exists).

**Current behavior:** `handleGoToSyncPreview` flushes all pending store/role creates first, then classifies with the resolved IDs. The preview the admin sees == what gets committed.

**Side effect:** if the admin clicks "Preview Sync" then backs out, the new stores/roles are already in the DB. This is acceptable because the admin explicitly opted into creating them. They can clean up via the Units / Roles pages.

### 3. The legacy `is_active` column on `stores` is NOT in sync with `status`
The migration backfilled `status` from `is_active` once, but going forward writes to one don't update the other. Several places in the codebase still query `.eq('is_active', true)` on stores. **This means an `ignored` store could leak into legacy queries** (where `is_active = true` but `status = 'ignored'`).

**Recommended cleanup:** either add a database trigger to keep them in sync, OR migrate all callers to use `status = 'active'` + drop `is_active`. Defer for now — pilot usage won't hit it.

### 4. Audit log RLS depends on exact role names
The `user_import_history` table's RLS policies check `r.name IN ('Admin', 'Trike Super Admin')`. **Verified live** these names exist exactly. If a customer ever creates a role named `'admin'` (lowercase) or `'Organization Admin'`, that user won't be able to read their own audit log. Worth widening to `r.name ILIKE '%admin%'` if it becomes an issue.

### 5. Per-row apply filter is keyed by source_row
The `applyFilter` state in `BulkEmployeeImport` is `Record<sourceRow, { create?: boolean; update?: boolean }>`. Empty filter = everything approved. The admin checks/unchecks rows in the SyncReviewDiff Changes tab. `commitUserSync` honors this — if `apply_filter[12].update === false`, row 12 won't be updated.

### 6. The `bulkCreateUsers` shim has no callers
The legacy shim in `users.ts` translates old API to new sync engine. Grep shows zero callers in `src/`. **Safe to delete** in next cleanup pass. Left in place for backward compat in case any test or external script depends on it.

---

## Known remaining issues (deferred — not blocking dry-run)

| ID | Severity | Description |
|----|----------|-------------|
| QA #6 | MEDIUM | `employee_match_strategy` setting is ignored by the engine. Either honor it or document loudly. |
| QA #5 | LOW | Delete unused `bulkCreateUsers` shim |
| QA #8 | LOW | `is_active` vs `status` drift on stores |
| QA #10 | LOW | Idempotent retry on partial failures (for now: re-running an import that died mid-way is unsafe — manually inspect first) |
| QA #14 | LOW | `reactivate` classification fires even when there are no field changes (intentional but worth documenting) |
| QA #15 | LOW | Settings page persists match-strategy immediately while other fields batch-save (inconsistent UX) |

Full QA report from this session is in conversation history under task `a54d0df071142d3ad`. Frontend tester report is `acff7e3535e3a9862`.

---

## How to verify the build still works (smoke test recipe)

Run this anytime to make sure nothing regressed:

```bash
# 1. Start dev server
cd Trikebackofficedashboardapplicationschemasandbox
npm run dev  # or use the .claude/launch.json preview

# 2. TypeScript check
npx tsc --noEmit 2>&1 | grep -E "BulkEmployeeImport|BulkUnitImport|BulkRoleImport|SyncReviewDiff|crud/users|crud/stores|api/roles|importMapping" | grep -v "sonner@2.0.3" | grep -v "ProgressProps"
# Expected: no output (the 2 grepped-out errors are pre-existing codebase-wide issues unrelated to this build)

# 3. Live schema check via Supabase MCP
# Ensure these columns/tables exist:
#   users.mobile_phone, users.external_id, users.external_id_source,
#   users.last_active_at, users.deactivated_at
#   stores.status, stores.unit_number
#   organizations.employee_match_strategy, organizations.employee_match_strategy_locked
#   roles.employment_type
#   user_import_history (table)
```

Browser smoke test recipe:
1. Navigate to People page → click Import
2. Upload a CSV with at least an Employee ID column → verify it auto-maps to "Employee ID (HRIS)" / `external_id`
3. Click Review & Edit → verify HRIS ID column is the leftmost editable column
4. Click Preview Sync → button should show spinner briefly, then advance to sync_preview step
5. Verify sidebar shows match strategy + tabs work + Missing tab forces a decision
6. Click Back to Edit → should return cleanly
7. Close dialog → no console errors

---

## Pre-flight before processing Kristen's CSV (Weigel onboarding)

1. **Pre-create the 11 stores from Kristen's file** (Cost Center 2 codes: `1018, 1033, 1046, 1050, 1052, 1053, 1057, 1070, 1078, 1092, 1114`). Use the Units page → New Unit OR Units → Import with a tiny CSV. Set proper friendly names. **Critical:** set `unit_number` to match the Cost Center code so the fuzzy matcher resolves automatically.

2. **Pre-create the 8 roles** from Kristen's file (Customer Service Team Member, Store Leader, Stocker, Food Service Team Leader, Foodservice Team Member, Assistant Store Lead, Team Leader, Floating Assistant). Use Roles management → Import. Set Store Leader = `salaried`, everything else = `hourly`.

3. **Verify match strategy** in Settings → Company → Employee Match Strategy. Should default to `auto`. Trike Super Admins can lock it.

4. **Run the employee import** (People → Import). Upload Kristen's CSV. Should auto-resolve all 158 rows via Cost Center 2 → unit_number lookup. Sync preview should show `158 New` (since this is initial seed). Click Apply.

5. **Two weeks later** — test sync mode by re-uploading a fresh Paylocity export. Should mostly show Unchanged + a few Updates for transfers/promotions + Missing for terminations.

---

## File map (everything touched in this build)

**New files (10):**
- `supabase/migrations/20260406000000_add_mobile_phone.sql`
- `supabase/migrations/20260407000000_add_unit_number_to_stores.sql`
- `supabase/migrations/20260407000100_add_employment_type_to_roles.sql`
- `supabase/migrations/20260408000000_add_external_id_to_users.sql`
- `supabase/migrations/20260408000100_add_status_to_stores.sql`
- `supabase/migrations/20260408000200_add_match_strategy_to_orgs.sql`
- `supabase/migrations/20260408000300_create_user_import_history.sql`
- `supabase/migrations/20260408000400_add_user_lifecycle_tracking.sql`
- `src/lib/crud/userImportHistory.ts`
- `src/components/SyncReviewDiff.tsx`
- `src/components/EditableImportTable.tsx`
- `src/components/BulkUnitImport.tsx`
- `src/components/BulkRoleImport.tsx`

**Modified files (12):**
- `src/lib/crud/users.ts` (huge — sync engine)
- `src/lib/crud/stores.ts` (status field, batch insert, getIgnoredStoreIds)
- `src/lib/api/roles.ts` (batch insert, N+1 fix, employment_type)
- `src/lib/supabase.ts` (org match strategy helpers)
- `src/lib/importMapping.ts` (parseName, parseImportFile, RECOMMENDED_FIELDS, SKIP_VALUE, external_id field, etc.)
- `src/types/roles.ts` (employment_type on CreateRoleInput)
- `src/components/BulkEmployeeImport.tsx` (huge — sync mode refactor)
- `src/components/Settings.tsx` (match strategy dropdown + lock toggle)
- `src/components/NewUnit.tsx` (status field on create/edit form)
- `src/components/Units.tsx` (status badges, include_ignored, removed console.log)
- `src/components/RolesManagement.tsx` (Import button + dialog)
- `src/components/People.tsx` (passes employmentType through)
- `src/components/EmployeeProfile.tsx` (employmentType union fix + display)
- `src/components/EditPeopleDialog.tsx` (mobile_phone field — done in earlier session)

---

## Suggested next priorities (in order)

1. **Run Kristen's CSV through dry-run** — validate the entire flow with real data. Jacob will trigger this manually when ready. Watch for: store/role auto-resolution rate, any unexpected classifications, audit log writes.

2. **Decide on match strategy semantics** (QA #6) — either honor the setting strictly OR add a clear "informational only" note to the Settings UI. Currently misleading.

3. **Mass deactivation safety polish** — the current `window.confirm` is functional but ugly. Replace with a styled modal once we have a customer who needs to use it.

4. **Audit log viewer** — the `user_import_history` table is being written to but there's no UI to view it. Build a simple list page in Trike Admin so admins can see "show me what changed in last week's import". Required for enterprise trust within ~3 months.

5. **Real HRIS API integration** — when you wire up Paylocity API sync, it should call `bulkUpsertUsers` with `source: 'paylocity_api'`. Same matching, same diff, same audit log. The CSV flow becomes the manual override / debug tool.

6. **Cleanup pass** — delete the `bulkCreateUsers` shim, sync the `is_active` ↔ `status` drift, document the `reactivate` zero-changes behavior.

---

**End of handoff. Ping Jacob to start the dry run.**
