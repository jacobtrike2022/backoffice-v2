# Feature Completeness Design — Prospect Portal, Notifications, Polish

**Date:** 2026-03-04
**Status:** Approved
**Scope:** Full — all gaps addressed, implemented in 4 phases

---

## Design Decisions

| Decision | Choice |
|----------|--------|
| Scope | Full — all gaps, phased implementation |
| E-signatures | eSignatures.io API (existing account) |
| Payment | Stripe Setup Intent (collect method only; billing engine is separate workstream) |
| Notifications | Wire email delivery via existing Resend infrastructure. No Slack. |
| Build approach | In-house for all components except e-sig and payment processors |
| ROI model | Per-location subscription + per-hire usage, compare vs. incumbent |
| Architecture | Extend existing `trike-server` edge function with `/contracts/*` and `/billing/*` endpoint groups |

---

## Section 1: Prospect Portal — 6 Journey Steps

### 1.1 Explore (Content Library Preview)

Deep-links the prospect into a read-only preview of the org's content library (tracks, playlists, albums). They can browse but not enroll.

**Implementation:**
- `ProspectJourneyPanel` step click navigates to existing content library view with `?preview=true` query param
- Content library component checks for preview mode, hides enroll/assign buttons, shows "upgrade to access" CTAs
- No new components needed — route + conditional rendering in existing views

### 1.2 ROI Calculator

Interactive calculator where prospects input their numbers and see projected savings.

**Inputs:**
- Number of locations
- Average employees per location
- Annual turnover rate (%)
- Average hourly wage
- Current training hours per new hire
- Current annual training platform cost (optional)

**Outputs:**
- Annual new hires (calculated: locations x employees x turnover rate)
- Current training cost (new hires x current hours x hourly wage + platform cost)
- Trike training cost (new hires x 1.5hrs x hourly wage + subscription)
- Annual savings (highlighted)
- Time savings per hire (current hours to 1.5 hours)
- ROI percentage

**Component:** New `ROICalculator.tsx` in `src/components/trike-admin/`. Self-contained, no backend needed — pure client-side math. Pricing constants (per-location rate, per-hire rate) come from the deal/proposal data when available, with sensible defaults.

### 1.3 Team Invite

Prospect can invite their team members to explore the platform during the demo period.

**Implementation:**
- Modal with email input (multi-entry) + role selector (limited to: Viewer, Store Manager)
- Calls existing Supabase auth invite flow + creates user records in `users` table
- Invited users get scoped to the prospect's demo org with limited permissions
- Cap at N invites during demo (configurable per deal)

### 1.4 Sign Agreement (eSignatures.io Integration)

**Flow:**
1. Admin clicks "Send Agreement" from deal dashboard
2. Edge function `POST /contracts/send` calls eSignatures.io API with template ID + signer details from deal record
3. Prospect receives email from eSignatures.io with signing link
4. Prospect signs
5. eSignatures.io sends `signer-signed` webhook to edge function `POST /contracts/webhook`
6. Edge function updates deal record (`contract_signed_at`, `contract_status`)
7. Pipeline notification created, email notification sent via Resend
8. Prospect portal step shows "Signed" with timestamp

**DB additions:**
- `contract_id`, `contract_status`, `contract_signed_at` columns on `deals` table

**Edge function env var:** `ESIGNATURES_API_TOKEN`

**Webhook events handled:**
- `signer-signed` — update deal, create notification
- `signer-declined` — update deal status, alert admin
- `contract-signed` — all signers complete, advance deal stage
- `signer-viewed-the-contract` — update deal activity log

### 1.5 Payment Setup (Stripe Setup Intent)

**Flow:**
1. Prospect portal payment step triggers frontend call to edge function `POST /billing/setup-intent`
2. Edge function creates Stripe Customer (if not exists) + SetupIntent, returns `client_secret`
3. Frontend renders Stripe Elements (PaymentElement) using the client secret
4. Prospect enters payment method, Stripe confirms
5. Stripe webhook `setup_intent.succeeded` hits edge function `POST /billing/webhook`
6. Edge function stores `stripe_customer_id` and `stripe_payment_method_id` on org record
7. Notification created
8. Step shows "Payment method saved" with last 4 digits

**DB additions:**
- `stripe_customer_id`, `stripe_payment_method_id` columns on `organizations` table

**Edge function env vars:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
**Frontend env var:** `VITE_STRIPE_PUBLISHABLE_KEY`

### 1.6 Go-Live Checklist

Checklist of items that must be complete before org transitions from demo to live. Each item is auto-evaluated from existing DB state.

**Checklist items:**
- Proposal accepted (deal.proposal_status)
- Contract signed (deal.contract_status)
- Payment method on file (org.stripe_payment_method_id)
- Content library configured (>= 1 playlist published)
- At least one store set up
- At least one non-admin user created
- Admin reviewed compliance settings

**Implementation:** New `GoLiveChecklist.tsx` component. Each item queries existing DB state — no new tables needed. When all items are green, a "Go Live" button becomes enabled. Clicking it updates org status from demo to live and triggers a `deal_won` notification.

---

## Section 2: Notification Email Delivery

### Current State

All pieces exist but are not wired together:
- `pipeline_notifications` rows created automatically by DB trigger on deal changes
- `notification_preferences` table with per-user channel preferences
- Resend email sending via `POST /email/send` edge function endpoint
- Email templates system with variable substitution

### Design: Postgres Trigger + pg_net

**Trigger mechanism:** Postgres trigger on `pipeline_notifications` INSERT calls a database function `notify_via_email()`. This function invokes the edge function's email endpoint using `pg_net` (Supabase's HTTP extension for async calls from Postgres).

**Flow:**
```
Deal stage changes
  -> existing trigger creates pipeline_notifications row
  -> NEW trigger fires on INSERT
  -> checks notification_preferences for that user + notification type
  -> if email channel enabled: calls edge function /email/send via pg_net
  -> Resend delivers email using matching template
  -> email_logs row created for tracking
```

**Email template mapping:** Each notification type (deal_won, proposal_viewed, contract_signed, etc.) maps to an email template. System-default templates created for each type; orgs can customize.

**Default preferences (when no preference row exists):** Email ON for high and urgent priority, OFF for normal and low.

---

## Section 3: Polish & Operational Quality

### 5a. Health Endpoint — Real Readiness Probe

Replace superficial `/health` with readiness probe checking:
- DB connectivity (`SELECT 1` via Supabase client)
- OpenAI API reachability
- Resend API status

Returns `200` with component statuses when healthy, `503` when any dependency is down.

```json
{
  "status": "healthy",
  "checks": {
    "database": "ok",
    "openai": "ok",
    "resend": "ok"
  },
  "timestamp": "2026-03-04T..."
}
```

### 5b. Brain RAG — Include System Templates

Modify `match_brain_embeddings` RPC to include `is_system_template = true` rows in search results. System template content is curated and belongs in the knowledge base.

### 5c. Email From Address — Environment Variable

New env var `EMAIL_FROM_ADDRESS` with fallback to `noreply@notifications.trike.co`. Read from `Deno.env.get('EMAIL_FROM_ADDRESS')`.

### 5d. Rate Limiting on Edge Function

Lightweight in-memory rate limiter for expensive endpoints:

| Endpoint Group | Limit | Window |
|---------------|-------|--------|
| `/brain/embed`, `/brain/chat` | 30 req | per min per org |
| `/email/send` | 20 req | per min per org |
| `/contracts/send` | 5 req | per min per org |
| `/billing/*` | 10 req | per min per org |

Implementation: Map-based counter keyed by `orgId + endpoint group`, reset every 60s. Returns `429 Too Many Requests` when exceeded. No external dependencies.

### 5e. Recipe Components — Remove Hardcoded IDs

Replace `'demo-org-id'` and `'demo-user-id'` with calls to `getCurrentUserProfile()` and `getCurrentUserOrgId()` from `src/lib/supabase.ts`.

---

## Implementation Phases

| Phase | Items | Effort |
|-------|-------|--------|
| Phase 1: Quick Wins | 5b, 5c, 5e (system templates, email env var, recipe IDs) | ~1 hour |
| Phase 2: Wiring | Notification email delivery, health endpoint, rate limiting | ~3-4 hours |
| Phase 3: Prospect Portal Simple | Explore (deep link), ROI Calculator, Go-Live Checklist | ~4-5 hours |
| Phase 4: Prospect Portal Integrations | eSignatures.io contract flow, Stripe payment setup, Team Invite | ~6-8 hours |

**Total estimated effort: ~15-18 hours across 4 phases**
