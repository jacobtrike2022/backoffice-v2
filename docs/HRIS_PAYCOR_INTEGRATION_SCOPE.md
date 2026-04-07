# Scope: Direct HRIS Sync Engine — Paycor

## Context

Paycor is a major US HCM vendor (~30,000 customers, strong in mid-market and SMB). It exposes a REST/JSON Public API behind Azure API Management, with OAuth 2.0 + a separate APIm subscription key. It is **gated**: you must become an approved Paycor partner before you can get production credentials. There is a sandbox tenant. Webhooks exist for some employee events but coverage is narrower than BambooHR; for guaranteed lifecycle coverage we will combine **webhooks + scheduled API polling** (and offer SFTP report export as a fallback). Paycor also sells its own LMS (Paycor Learning / "Perform Learning"), so we are positioning against an in-suite incumbent — the integration story has to be tight.

> Researched April 2026. Paycor's developer portal is JS-rendered and partner-gated, so some of the granular event payload schemas below are pieced together from Paycor's own portal pages, Microsoft's Azure APIM mirror of the Paycor docs, and partner integrations (Merge, Knit, Bindbee, Celigo, RoboMQ Hire2Retire, Flexspring, Rollout). Confirm exact field/event names against the live developer portal once partner access is granted.

---

## Paycor Public API — Complete Capabilities

### Base URLs

| Environment | Base URL |
|---|---|
| Production REST | `https://api.paycor.com/v1` |
| Production token | `https://api.paycor.com/Accounts/v2/Common/Token` (also `/sts/v1/common/token`) |
| Sandbox REST | `https://apis-sandbox.paycor.com/v1` |
| Sandbox token | `https://apis-sandbox.paycor.com/sts/v1/common/token` |
| Developer portal | `https://developers.paycor.com/` |
| Try / API Explorer | `https://developers.paycor.com/explore`, `https://developers.paycor.com/try` |
| Azure APIM mirror | `https://paycorpublicapimquarterly.developer.azure-api.net/` |
| Marketplace | `https://marketplace.paycor.com/` |

Sandbox uses the **same paths** as production; routing to sandbox is determined by which APIm subscription key you send.

### Authentication

**Two credentials required on every call:**

1. **APIm Subscription Key** — issued by Paycor when your application is approved in the Developer Portal. Sent in the `Ocp-Apim-Subscription-Key` HTTP header.
2. **OAuth 2.0 Bearer Token** — sent as `Authorization: Bearer {access_token}`.

**Supported OAuth grants:**
- `client_credentials` — for server-to-server / automated pulls (preferred for our sync engine).
- `authorization_code` (+ PKCE) — for customer-initiated linking from the Trike UI. The customer logs into Paycor, picks a Legal Entity, and authorizes our app, which redirects to a registered callback.
- Refresh tokens supported.

**Token request (client credentials):**
```
POST https://api.paycor.com/Accounts/v2/Common/Token
Ocp-Apim-Subscription-Key: {apim_key}
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id={client_id}
&client_secret={client_secret}
&scope={scopes}
```

**Token TTL:** access tokens are short-lived (~30 minutes per Merge's writeup). Plan refresh on every sync run; do not cache for hours.

**Required scopes (granted by customer admin during OAuth consent):**
- View Person — name, address, demographics, email, phone
- View Employee — employment dates, manager, position, status, work location
- View Legal Entity
- (Optional) View Pay Rates, View Direct Deposit, View Time Off
- (Optional) Update Employee Contact — only if we want write-back

### Employee Data (Read)

| Endpoint | Purpose | Notes |
|---|---|---|
| `GET /v1/legalEntities/{legalEntityId}/employees` | List all employees in a legal entity | Primary bulk endpoint. Supports `?include=EmploymentDates,Position,Status,WorkLocation` and `?status=Active|Inactive|Terminated|LeaveOfAbsence` |
| `GET /v1/employees/{employeeId}` | Single employee detail | Optional `?include=...` and `?emailType=Work|Personal` |
| `GET /v1/employees/{employeeId}/payrates` | Pay rate, pay period, effective date | Requires pay scopes |
| `GET /v1/employees/{employeeId}/DirectDeposits` | Bank info | Sensitive — only request if needed |
| `GET /v1/employees/{employeeId}/timeoffrequests` | Time off requests | Optional |
| `GET /v1/legalEntities/{legalEntityId}/timeoffrequests` | Bulk time off | |
| `GET /v1/legalEntities/{legalEntityId}/departments` | Department list (parent/child tree) | Use to map Trike "districts/stores" |
| `GET /v1/legalEntities/{legalEntityId}/locations` | Work locations | Maps to Trike stores |
| `GET /v1/legalEntities/{legalEntityId}/jobs` | Job titles / job catalog | |
| `GET /v1/legalEntities/{legalEntityId}/payrolls` | Payroll runs | |
| `POST /v1/employees` (or `/v1/legalEntities/{id}/employees`) | **Create employee** (Hire) | Wait ~60 seconds before hitting `/employees/{id}` for the new ID — Paycor's docs explicitly call this out |
| `PATCH /v1/employees/{employeeId}` | Update contact / limited fields | Requires write scope |

> There is no public "create rehire" endpoint distinct from create employee — rehires either go through the Hire flow (new employeeId) or are flipped from Terminated → Active inside Paycor.

### Employee Fields (commonly returned)

**Person identity:** personId, firstName, middleName, lastName, preferredName, displayName, ssn (masked), dateOfBirth, gender ("Male"/"Female" — Paycor uses descriptions, not codes), maritalStatus, ethnicity

**Contact:** workEmail, personalEmail, workPhone, mobilePhone, homePhone, address (street1, street2, city, state, postalCode, country)

**Employment:** employeeId, employeeNumber, legalEntityId, hireDate, originalHireDate, rehireDate, terminationDate, status (Active / Inactive / Terminated / Leave of Absence), employmentType (FullTime / PartTime / Contractor / Intern / Temporary), jobTitle, position, departmentId, departmentName, locationId, locationName, supervisorId / managerName, payGroup, payrollCode, costCenter (department code typically doubles as cost center)

**Compensation:** payRate, payType (Hourly / Salary), payPeriod, effectiveDate, standardHours

**Custom fields:** Paycor supports customer-defined custom fields which surface on the employee object via the metadata API and field mapping in unified-API platforms (Merge, Knit). They are returned by name and must be discovered per tenant.

### Org Structure Mapping

| Paycor concept | Trike concept |
|---|---|
| Legal Entity | Organization (top of tenancy) |
| Department (with parent) | District (when parent) / Store (when leaf), or operational team |
| Location | Store (physical site) |
| Pay Group / Payroll Code | (informational) |
| Cost Center | Often equal to Department code; surface as metadata |

A multi-EIN customer can have **multiple Legal Entity IDs** in one Paycor account. Our sync must enumerate legal entities and pull employees per entity, not assume one.

### Employee Status Lifecycle

Paycor's official status set:
- **Active** — currently employed, included in payroll
- **Inactive** — on roster but not on payroll (rare in c-store)
- **Leave of Absence** — temporary suspension (FMLA, parental, medical)
- **Terminated** — ended employment; excluded from payroll past Payroll End Date

**Hire:** record created with status Active and a hireDate. `originalHireDate` is preserved.

**Termination:** status set to Terminated with terminationDate. Employee record persists; you can still pull it with `?status=Terminated`.

**Rehire:** Paycor's recommended flow is to flip a Terminated employee back to Active and set a `rehireDate`. The original `hireDate` stays put as `originalHireDate`. **The employeeId/personId is preserved on a true rehire.** If a manager re-creates the person from scratch instead of rehiring properly, you get a new employeeId — our sync needs SSN-based or email-based fallback matching to detect this.

**LOA:** status flips Active → Leave of Absence → Active. Watch for these transitions to pause/resume training reminders.

**Transfer / Promotion:** no separate event. Surfaces as a change in `departmentId`, `locationId`, `jobTitle`, `position`, or `payRate` on the employee record. Detect by diffing snapshots.

### Delta / Changed Employee Detection

**Bad news:** Paycor's Public API does **not** expose a `since=timestamp` "changed employees" endpoint analogous to BambooHR's `/employees/changed`. There is no first-class delta feed in v1.

**Three workable strategies:**

1. **Webhook-driven** (preferred for hires/updates) — see below. Catches `employee.created` and `employee.updated`.
2. **Full-list polling with local diff** — pull `GET /v1/legalEntities/{id}/employees` on a schedule (every 1–6 hours), hash each row, compare against the last snapshot in `hris_employee_snapshots`, emit synthetic events for inserted/updated/deleted/status-changed rows. This is how we'll catch terminations, transfers, promotions, and rehires that webhooks miss.
3. **Customer-defined Report + Reports API / SFTP** — for customers who refuse to enable webhooks or who already have a Paycor report scheduled, ingest the report. Report attributes are configured in Paycor and pushed via SFTP or pulled via the reporting API (Hire2Retire, Flexspring, and Coviant all use this pattern).

For the pilot we will run **webhooks + 1-hour polling diff** in parallel and treat polling as the source of truth.

### Webhooks

**Registration endpoint:** `POST https://api.paycor.com/v1/webhooks`

```json
{
  "url": "https://api.trike.app/hris/paycor/webhook",
  "events": ["employee.created", "employee.updated"]
}
```

**Documented event types** (confirmed across Rollout, RoboMQ, Bindbee writeups):
- `employee.created` — fires on Hire
- `employee.updated` — fires on most field changes (status flips, department, manager, pay, contact)

**Likely additional events** (referenced but not consistently documented; verify in portal):
- `employee.terminated`
- `employee.rehired`
- `payroll.completed`
- `timeoff.requested` / `timeoff.approved`

**Payload shape:**
```json
{
  "event": "employee.updated",
  "data": {
    "employeeId": "abc-123",
    "legalEntityId": "le-456",
    "changedAt": "2026-04-07T14:22:11Z",
    "fields": ["status", "departmentId"]
  }
}
```
The webhook is a **thin notification** — you must call back to `GET /v1/employees/{id}` to fetch full state. Do not trust the payload as the source of truth.

**Signature verification:** every webhook carries `x-paycor-signature`, an HMAC-SHA256 hex digest of the raw JSON body using the per-subscription webhook secret. Reject any request whose computed signature doesn't match. Reject requests older than ~5 minutes (replay protection).

**Delivery semantics:** at-least-once. Implement idempotency on `(eventId, employeeId, changedAt)`. No documented retry schedule from Paycor; assume best-effort and rely on the polling diff to backfill anything dropped.

### Reports API / SFTP

Paycor offers a **Reporting & Analytics API** family alongside the HR Data Analytics APIs. Customers can also schedule **SFTP file extracts** from Paycor Reporting on a recurring cadence (RSA key auth, AES at rest, TLS in transit).

For the Trike sync engine, SFTP is our **plan B** for customers who:
- Don't have, or don't want to pay for, the Public API entitlement
- Already operate a "Paycor extract → S3" pipeline
- Need an audited, file-based handoff for compliance reasons

We will accept the same canonical CSV columns as our generic SFTP ingestor (employee_id, first_name, last_name, email, mobile_phone, hire_date, termination_date, status, department, location, job_title, manager_id, pay_rate, custom_paylocity_id-equivalent custom column).

### Pagination

- Page size: **100 records per response** (hard cap on bulk endpoints).
- Mechanism: response includes a `continuationToken` and an `additionalResultsUrl`. Follow `additionalResultsUrl` until it's null/empty.
- Some older endpoints expose `?page=` + `?pageSize=` instead — handle both shapes.

### Rate Limits

- **1,000 calls per minute** across all Paycor APIs per Merge's writeup. Treat this as a soft global ceiling.
- 429 responses on overrun. Honor `Retry-After` if present.
- Implement exponential backoff (250ms → 500ms → 1s → 2s → 5s, max 5 retries).
- For bulk pulls of large customers (10k+ employees), batch at ~10 req/sec to leave headroom for webhooks and other tenants.

### Error Handling

Standard HTTP status codes. Common ones to handle explicitly:
- `401` — token expired (refresh and retry once)
- `403` — APIm key missing/invalid OR scope not granted by customer (do not retry; alert)
- `404` — employee not in this legal entity (try other LE IDs before marking deleted)
- `409` — Create employee conflict (duplicate SSN/email)
- `429` — rate limited
- `5xx` — Paycor side; backoff + retry

---

## Access Path — How We Actually Get Credentials

This is the part that hurts. Paycor API access is **partner-gated** today.

**Path A — Paycor Marketplace Partner (recommended for scale):**
1. Apply via Paycor's Technology Partner program.
2. Pass technical review (security, data handling, use case fit).
3. Sign partner agreement.
4. Get sandbox credentials immediately on approval.
5. Build + certify the integration against sandbox.
6. Get listed in Paycor Marketplace.
7. Production keys issued. **Total elapsed: weeks to months** (Merge cites this; multiple integration vendors confirm).

**Path B — Customer-owned credentials (faster for the pilot):**
- The customer themselves requests API access from their Paycor rep. Some customers can self-request via the Client API Interest Form on `developers.paycor.com`.
- Customer gets their own APIm Subscription Key + creates an Application in their Developer Portal tenant, generating a Client ID/Secret.
- Customer hands those credentials to us; we store per-tenant in `hris_credentials` (encrypted).
- This avoids the partner queue entirely but does not scale past a few pilot customers and requires the customer to be on a Paycor plan that includes API entitlement.

**API entitlement is not free.** Paycor does not publish a unit price, but multiple sources (Paycor's own articles, partner integrators) note that API access can be a paid add-on / depends on the customer's subscription tier. Pilot customers should confirm with their Paycor account manager that they have API access included before we burn cycles.

**Path C — Developer Services (managed build):**
- Paycor Developer Services will scope, design, build, and support a custom integration ("many built in 10 days or less" per their marketing). Cost-bearing. Probably not relevant for us — we're the integration vendor — but worth knowing exists if a customer pushes for Paycor to own it.

**For the Trike pilot:** start on Path B with the first pilot customer (their credentials, sandbox-first), and submit the Path A partner application in parallel so we have a marketplace listing by the time we want to scale.

---

## How Other LMS / Training Platforms Integrate with Paycor

- **Paycor Learning / Perform Learning** — Paycor's own LMS, sold inside the HCM suite. Direct internal data sharing. This is the incumbent we're displacing on training. Sales positioning: customer-store-specific compliance, faster content authoring, AI assessment, mobile-first, no per-seat penalty for hiring up.
- **Merge.dev** — unified HRIS API. Syncs Employee, Employment, Group (department), Location, Team, BankInfo, TimeOff, TimesheetEntry. Hits the endpoints we listed. Configurable sync cadence from manual → hourly. This is what we're replacing in Trike's stack via the direct integration.
- **Finch** — also offers a Paycor connector (assisted/automated). Same API surface.
- **Knit, Bindbee, Unified.to** — unified HRIS abstractions, similar endpoint set, similar feature gaps (no real delta feed).
- **RoboMQ Hire2Retire** — uses Paycor reports + OAuth flow to provision identities into Active Directory / Entra ID / Google Workspace. Validates the "Paycor → identity provisioning" pattern that Trike training accounts can mirror.
- **Flexspring** — point-to-point custom mappings, 12-16 week build cycles. The slow / expensive end of the market.
- **iCIMS, BuddyPunch, 7shifts, TimePilot, OrgChart** — flat-file / SFTP integrations. Confirms SFTP fallback is industry-standard for Paycor.

The competitive opening: every LMS that integrates with Paycor today is either Paycor's own product (no choice on content) or goes through a unified HRIS layer that adds latency, cost, and a third party. A direct, near-real-time, store-aware sync is differentiating.

---

## Sync Engine Architecture (Paycor-specific)

### Connection setup flow (customer-facing)
1. Trike admin clicks "Connect Paycor" in Integrations.
2. We call `GET /v1/legalEntities` (or have admin paste the legalEntityId) and let them confirm which entity(s) to sync.
3. OAuth authorization code flow (Path B): redirect to Paycor login → admin selects Legal Entity → Paycor redirects back with code → we exchange for tokens → store encrypted in `hris_credentials`.
4. Initial full sync runs immediately (paginated).
5. Schedule recurring polling job + register webhook subscription.

### Recurring sync loop
1. Hourly cron (configurable per tenant: 15min / 1hr / 6hr).
2. For each connected legal entity:
   - Refresh OAuth token if <5 min remaining.
   - `GET /v1/legalEntities/{id}/employees?include=EmploymentDates,Position,Status,WorkLocation` paginated via `continuationToken`.
   - For each row, compute hash. Compare against `hris_employee_snapshots`.
   - Emit one of: `hris.employee.inserted`, `hris.employee.updated`, `hris.employee.terminated`, `hris.employee.rehired`, `hris.employee.transferred`, `hris.employee.loa_started`, `hris.employee.loa_ended`.
   - Pull `/departments` and `/locations` if changed.
3. Reconcile rehire detection: if a new `employeeId` matches an existing record's SSN-hash or work email, fire `rehired` against the original Trike user_id rather than creating a duplicate.
4. Write sync run record to `hris_sync_runs` (start, end, counts, errors).

### Webhook handler
1. Verify `x-paycor-signature` (HMAC-SHA256, constant-time compare).
2. Reject if older than 5 minutes.
3. Idempotency check on `(event_id, employeeId, changedAt)`.
4. Enqueue a "fetch + diff" job for the employeeId — never trust the payload's field list as authoritative.
5. ACK 200 immediately.

### Event emission → Trike side effects
- `inserted` → create user, send Welcome SMS, auto-assign role-based onboarding tracks
- `terminated` → soft-delete, revoke assignments, archive
- `rehired` → reactivate same user_id, re-assign refresher tracks
- `transferred` (department/location change) → reassign store-specific compliance tracks
- `promoted` (jobTitle change) → reassign role-specific tracks
- `loa_started` → pause reminders
- `loa_ended` → resume

---

## Database Tables Touched

(Reuses the existing `hris_*` schema from the BambooHR/Paylocity work; no new tables required.)

- `hris_connections` — provider=`paycor`, oauth tokens, apim_subscription_key, legal_entity_ids[]
- `hris_employee_snapshots` — last-known state per `(connection_id, paycor_employee_id)` with content hash
- `hris_sync_runs` — per-run audit
- `hris_event_log` — emitted events for replay/debugging
- `hris_field_mappings` — Paycor field → Trike user field, including custom fields
- `users.external_ids` — JSONB, e.g. `{ "paycor_employee_id": "...", "paycor_person_id": "...", "paycor_legal_entity_id": "..." }`

---

## Open Questions to Resolve Before Build

1. Does the pilot customer's Paycor plan include Public API access, or do they need to upgrade / pay an add-on? **(Confirm with their Paycor rep before any code is written.)**
2. Does the pilot customer use one Legal Entity or several?
3. Which custom fields on their employee record do we need (Paylocity employee ID equivalent, store code, district code)?
4. Are they willing to enable webhooks, or do we run polling-only?
5. Do they already have a scheduled SFTP report we can piggyback on as a safety net?
6. Do they want us to write contact updates back to Paycor, or read-only?
7. Submit the Paycor Marketplace partner application now to start the clock — what's the current Paycor partner queue length?

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Partner approval takes months | High | Blocks scale | Path B (customer-owned creds) for pilot; submit Path A in parallel |
| No native delta endpoint | Certain | Higher API spend, slower lifecycle detection | Polling diff + webhooks + SFTP fallback |
| Webhook event coverage incomplete | High | Missed terminations | Polling diff is source of truth, webhooks are accelerator only |
| Customer doesn't have API entitlement | Medium | Pilot stalls | Qualify in sales call; offer SFTP path |
| Rehire creates new employeeId instead of flipping status | Medium | Duplicate Trike users | SSN-hash / email fallback matching |
| Token expiration mid-sync (~30min TTL) | Certain | Sync interruption | Refresh on every run + on 401 |
| Rate limit (1000/min) on large tenants | Low | Slower initial sync | Throttle to ~10 req/sec, paginate |
| Paycor's own LMS competitive pushback | High | Sales friction | Lean on store-specific content + AI features |

---

## Sources

- Paycor Developers Portal — https://developers.paycor.com/
- Paycor Public API v1 (API Explorer) — https://developers.paycor.com/explore , https://developers.paycor.com/try
- Paycor Marketplace — https://marketplace.paycor.com/
- Paycor Integration Platform — https://www.paycor.com/integration-platform/
- Paycor Technology Partners — https://www.paycor.com/partners/product-technology-partners/
- Microsoft Azure APIM mirror (Getting Started) — https://paycorpublicapimquarterly.developer.azure-api.net/getting-started
- Merge — A guide to integrating with Paycor's API — https://www.merge.dev/blog/paycor-api
- Merge — Paycor integration page — https://www.merge.dev/integrations/paycor
- Bindbee — Paycor API guide — https://www.bindbee.dev/blog/paycor-api
- Knit — Paycor use cases — https://developers.getknit.dev/docs/paycor-usecases
- Knit — Developer guide to Paycor employee API — https://www.getknit.dev/blog/developer-guide-to-get-employee-data-from-paycor-api
- Rollout — Paycor API essentials — https://rollout.com/integration-guides/paycor/api-essentials
- Rollout — Paycor webhooks guide — https://rollout.com/integration-guides/paycor/quick-guide-to-implementing-webhooks-in-paycor
- Celigo — OAuth 2.0 to Paycor — https://docs.celigo.com/hc/en-us/articles/22465611005083-Set-up-an-OAuth-2-0-HTTP-connection-to-Paycor
- RoboMQ Hire2Retire — Paycor OAuth — https://docs.robomq.io/Application/Paycor_OAuth/
- RoboMQ Hire2Retire — Paycor Report Definition — https://docs.robomq.io/Design/Paycor_Report_Definition/
- Flexspring — Paycor integration — https://www.flexspring.com/paycor-integration
- Coviant — SFTP integration with payroll providers — https://www.coviantsoftware.com/solutions/sftp-integration-with-payroll-providers/
- ApiTracker — Paycor — https://apitracker.io/a/paycor
- Paycor — Learning Management System — https://www.paycor.com/hcm-software/learning-management-system/
- Finch — Paycor integration — https://www.tryfinch.com/integrations/paycor
