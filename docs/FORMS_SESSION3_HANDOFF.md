# Forms System Session 3 Handoff

## What Was Built This Session

### Major Features Shipped
1. **Full-page form builder UI** — sidebar hidden, wider canvas, back button
2. **Properties drawer redesign** — pushes canvas (not overlay), 28vw width, px-6 padding, trash icon, polished tabs
3. **START/END node polish** — green pill, dashed connectors, centered text
4. **Scoring redesign** — killed Scoring tab, added Critical toggle + N/A + equal-weight model to Settings tab
5. **Conditional logic visual flow** — SVG dependency arrows (color-coded), dependency map in Logic tab
6. **Section-level conditional logic** — show/hide entire sections, SectionPropertiesDrawer
7. **Section drag-and-drop** — sections reorderable via dnd-kit grip handles
8. **Form type auto-scaffolding** — 5 types with starter blocks on create
9. **Form type runtime UX** — inspection counters, sign-off banners, OJT trainer fields
10. **AI PDF → Form builder** — Claude parses PDFs, improved prompt (individual items, sections, dual-initial)
11. **PDF import streamlined** — no review modal, straight to builder
12. **Post-submission email** — Resend integration, dynamic role routing, tested live
13. **PDF export** — HTML generator in edge fn + client download button
14. **Forms in playlists** — required_form_id + completion enforcement
15. **Sources → Forms pipeline** — form detection patterns, parse-text endpoint
16. **Start conditions** — submission mode (Individual/Location/Anonymous), submission limit
17. **On-fail actions** — custom fail message, auto-reassign, assign follow-up form, assign training
18. **Per-item fail → assign training** — on-fail action selector per block, edge fn logging
19. **Drag-and-drop reordering** — blocks + sections both sortable
20. **Dependency order warnings** — red arrows + toast + Logic tab error on order violations
21. **Date/time helpers** — "Default to current" toggle + "Use current" button for form fillers

### Bug Fixes
- React Rules of Hooks crash (early returns before hooks)
- FormRenderer infinite loop (unstable default props)
- Edge function BOOT_ERROR (duplicate FORM_PATTERNS)
- Wrong column name in public form endpoint (primary_color → brand_primary_color)
- form_submissions column mismatch (responses → answers)
- forms_type_check constraint missing 'sign-off'
- PDF import sessionStorage key mismatch
- Logic flow arrows clipping (viewport bounds fix)
- Notification dot rendering as rectangle (ring → border fix)

---

## Immediate TODO (Next Session)

### 1. Remove "Allow Multiple Submissions" toggle
**Location:** `src/components/forms/FormBuilder.tsx` → `SubmissionActionsPanel`
**Why:** Redundant with Start Config's "Submission Limit" setting. Remove it to avoid conflicting logic.

### 2. Dynamic Start/End fields based on identity mode
**When "Individual":**
- "Send confirmation to submitter" label stays as-is
- User's home store auto-selected as default location (from users.store_id)

**When "Location-based":**
- Change "Send confirmation to submitter" → "Send confirmation to store"
- Show location selector on form fill

**When "Anonymous":**
- Hide "Send confirmation to submitter" entirely (no email to send to)
- Hide email notification recipient type "submitter" option
- Hide any fields that reference logged-in user data

### 3. PDF Export + Email Submission Polish
**Files:** `supabase/functions/trike-server/index.ts`, `src/components/forms/FormSubmissions.tsx`

**Requirements:**
- Verify PDF export works for ALL block types (yes/no, signature, photo, rating, etc.)
- Email submissions must include:
  - Professional HTML email body with completed form data
  - PDF attachment of the submission
  - Form metadata: date submitted, form name, link to submission
  - All input types rendered properly (signatures as "[Digital signature]", yes/no as checkmarks, etc.)
- Email FROM: "Org Name (Trike Forms)" using Resend's from_name
- Email design must use Trike.co branding (not random AI fonts/colors)
  - Use existing brand colors from the codebase
  - Include org logo in email header (from `organizations.logo_dark_url`)
  - Default to Trike logo if no org logo
- PDF export should also include org logo + branding

**Current state:** `generateSubmissionPdfHtml()` exists in the edge function and `handleDownloadPdf()` exists in FormSubmissions.tsx. Both need visual QA and the email attachment needs to be wired to actually attach the PDF.

### 4. Per-item fail → assign training (re-add to FormBuilder)
**What happened:** The GraduationCap badge and "When answer is incorrect" selector were in FormBuilder.tsx but got overwritten when the fail-start-combined agent merged. The edge function portion (`checkOnFailTrainingAssignments`) is intact.
**Need to re-add:** ~80 lines in FormBuilder.tsx Settings tab — GraduationCap import, `hasOnFailAssign` badge on block cards, "On fail action" section after scoring controls.
**i18n keys to re-add:** `onFailTrainingBadge`, `propOnFailAction`, `propOnFailActionDesc`, `propOnFailNoAction`, `propOnFailAssignPlaylist`, `propOnFailAssignTrack`, `propOnFailTitle`, `propOnFailTitlePlaceholder`, `propOnFailId`, `propOnFailIdPlaceholder`, `propOnFailIdHint`

---

## Architecture Reference

### Key Files
| File | Purpose |
|------|---------|
| `src/components/forms/FormBuilder.tsx` | ~3400 lines — full builder, all panels, all sub-components |
| `src/hooks/useFormBuilder.ts` | Form state, save, publish, sections, blocks, reorder |
| `src/components/forms/shared/FormRenderer.tsx` | Fill-side rendering, scoring, validation, submission |
| `src/components/forms/PublicFormFill.tsx` | Public form fill page (no auth) |
| `src/components/forms/ImportFromPDF.tsx` | PDF import modal (upload → parse → create → builder) |
| `src/components/forms/FormSubmissions.tsx` | Submissions list, detail view, CSV/PDF export |
| `src/components/Forms.tsx` | Tab orchestrator, full-page overlay for builder |
| `src/components/PlaylistFormStep.tsx` | Form step in playlist completion flow |
| `supabase/functions/trike-server/index.ts` | ~24K lines — all edge function endpoints |
| `src/lib/forms/conditionalLogic.ts` | Conditional logic evaluator (show/hide/skip/section) |
| `src/lib/crud/forms.ts` | Form CRUD operations |

### Database Tables
- `forms` — title, type, status, settings (JSONB), submission_config (JSONB)
- `form_blocks` — type, label, options, validation_rules (JSONB), conditional_logic (JSONB)
- `form_sections` — title, description, display_order, settings (JSONB for section conditions)
- `form_submissions` — form_id, answers (JSONB), submitted_by_id, score fields
- `form_assignments` — form_id, user_id, due_date, status

### Key Types (in useFormBuilder.ts)
```typescript
interface SubmissionConfig {
  confirmation_message?: string;
  send_email_to_submitter?: boolean;
  email_notifications?: EmailNotification[];
  score_threshold_action?: { ... };
  allow_multiple_submissions?: boolean; // ← REMOVE THIS
  on_fail?: OnFailConfig;
}

interface StartConfig {
  identity_mode?: 'individual' | 'location' | 'anonymous';
  submission_limit?: 'unlimited' | 'daily' | 'shift' | 'weekly';
  // require_location and require_shift were REMOVED
}

interface OnFailConfig {
  reassign?: { enabled: boolean; delay_hours: number };
  assign_form?: { enabled: boolean; form_id: string; form_title: string };
  assign_training?: { enabled: boolean; playlist_id: string; playlist_title: string };
  fail_message?: string;
}
```

### Edge Function Endpoints
- `POST /forms/on-submit` — process email notifications after submission
- `POST /forms/parse-pdf` — AI PDF → form blocks (Claude Sonnet)
- `POST /forms/parse-text` — AI text → form blocks (for Sources integration)
- `GET /forms/public/:formId` — public form data for fill page
- `POST /forms/public/:formId/submit` — public form submission

### Scoring Model (new)
- All scored questions are **equal weight**
- Score = (correct answers) / (total scored questions - N/A) × 100
- **Critical items**: if ANY critical item fails → entire form fails regardless of %
- Stored in `validation_rules`: `_critical`, `_allow_na`, `_correct_answer`
- `ScoringResult` includes `criticalFail` and `criticalItems[]`

### Demo Mode
- All edge function calls use `session?.access_token || anonKey` fallback
- Org scoping via `demo_org_id` URL param
- RLS policies use `auth.uid() IS NULL` for demo access
- Test org: `46c9096c-3f2d-428c-9e35-c0891bc95cc1` (NACS)
- Test form: `11111111-1111-1111-1111-111111111111` (Daily Store Inspection)

### Git Workflow
- `main` → auto-deploys to Vercel production
- `demo/stable` → demo domain, sync with: `git checkout demo/stable && git merge main --no-edit && git push origin demo/stable && git checkout main`
- Always use `git pull --ff-only origin main` (never bare `git pull`)
- Edge function deploy: `npx supabase functions deploy trike-server`
- Supabase project: `kgzhlvxzdlexsrozbbxs`
