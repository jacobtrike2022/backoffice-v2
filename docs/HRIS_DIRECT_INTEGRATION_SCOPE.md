# Scope: Direct HRIS Sync Engine — Paylocity First, Provider-Extensible

## Context

Replace Merge.dev with a direct, near-real-time HRIS sync engine for 2.0. Employee lifecycle events (new hires, terminations, transfers, promotions) must flow within minutes — a new hire may be physically waiting to start training. Paylocity is the first provider.

---

## Paylocity API — Complete Capabilities (from developer.paylocity.com)

### Authentication
- **OAuth 2.0 Client Credentials** flow
- **Demo endpoint:** `https://dc1demogwext.paylocity.com/public/security/v1/token`
- **Production endpoint:** `https://dc1prodgwext.paylocity.com/public/security/v1/token`
- Token TTL: 1 hour (3600s), no refresh tokens — request new before expiry
- TLS 1.2+ required on all calls
- Secret rotation required every 365 days (email alerts at 10 and 5 days before expiry)
- Rate limit: **25 requests per second**

### Employee Data (Read)
- `GET /api/v2/companies/{companyId}/employees` — Full roster, paginated (default 25/page, configurable via `pagesize` + `pagenumber` params, `includetotalcount` header)
- `GET /api/v2/companies/{companyId}/employees/{employeeId}` — Single employee with full detail (demographics, address, contact, employment, compensation, tax, benefits, direct deposit, emergency contacts, custom fields)
- Employee ID max 10 chars, Company ID max 9 chars

### Data Direction
Trike is **read-only** from Paylocity. We pull employee data; we never write back. Paylocity is the source of truth for all employee data.

Write endpoints exist (`PATCH` employee, `POST` new employee to WebLink staging) but are out of scope — Trike consumes HRIS data, doesn't modify it.

### Company-Level Lookup Data
Available endpoints for mapping configuration:
- **Cost Centers** — `/companies/{companyId}/costcenters` (maps to stores/districts)
- **Work Locations** — `/companies/{companyId}/worklocations`
- **Positions** — `/companies/{companyId}/positions`
- **Job Codes** — `/companies/{companyId}/jobcodes`
- **Deduction/Earning Codes** — `/companies/{companyId}/deductions`, `/earnings`
- **Pay Frequencies** — `/companies/{companyId}/payfrequencies`
- **Rate Codes, Pay Grades, Worker Comp Codes** — all available
- `GET /api/v2/companies/{companyId}/openapi` — **Company-specific OpenAPI spec** with enumerated field values and required fields for that company's config

### Company Sets (Multi-Location)
- **Company Set ID (CSID)** groups multiple Company IDs (COIDs) under one login
- Each COID is a separate payroll entity (may map to store, region, or employee type)
- Franchise clients often use one COID per physical location
- **Transfers** between COIDs within a set: source record gets status `XT` (Transferred), new `A` (Active) record created in target company. Same Employee ID, different Company ID.
- Some APIs require onboarding each COID individually (not CSID)

### Employee Status Codes
| Code | Description | Type |
|---|---|---|
| A | Active | Active |
| T | Terminated | Terminated |
| D | Deceased | Terminated |
| R | Retired | Terminated |
| L | Leave of Absence | Leave |
| XT | Transferred (between COIDs) | Terminated (in source) |

Custom status codes possible per company — must handle dynamically.

**Status Transitions:** A→T (termination), A→L (leave), A→XT (transfer), L→A (return from leave), T→A (rehire), XT→A (re-transfer back). Effective dates matter — chronology determines current state when duplicate records exist.

### Rehire Handling (Critical Edge Case)
Common in c-store/foodservice: an employee is hired, terminated, then rehired months or years later. In Paylocity:
- **Same Employee ID is reused** — the employee doesn't get a new ID
- **`RehireDate` field** is populated (one of the 48 monitored webhook fields)
- **`EmpStatus` changes** from T (Terminated) back to A (Active)
- The Employee Change webhook fires when `RehireDate` and `EmpStatus` change
- **Trike must detect:** RehireDate populated + status A on a previously-inactive user → **REHIRE event** → reactivate user, update `hire_date` to rehire date, clear `termination_date`, reassign store/role per current cost centers, notify store manager
- **Do NOT create a duplicate user** — match by `external_employee_id` and reactivate the existing record

---

## Webhooks — Full Detail

### Available Webhooks (5 types)

**1. New Hire**
- **Payload:** 28 fields — companyId, employeeId, firstName, lastName, middleInitial, hireDate, workEmail, workPhone, costCenter1/2/3, jobTitle, position, eeoClass, supervisor, supervisorId, employeeType, payFrequency, payType, address, gender, maritalStatus, badgeClockNumber, taxForm
- **Trigger:** When new employee is added via HR & Payroll, Web Link imports, or API

**2. Termination**
- **Payload:** companyId, employeeId, firstName, middleInitial, lastName, workEmail, costCenter1/2/3, terminationDate
- **Trigger:** When employee is terminated via HR & Payroll, Web Link imports, or API

**3. Employee Change**
- **Payload:** Just `companyId` + `employeeId` (NO change details)
- **Trigger:** When any of **48 monitored fields** change (see list below)
- **Detection interval:** Changes polled every 1 minute — may fire multiple notifications if several fields change within 60 seconds
- **Requires follow-up API call** to GET the employee and determine what changed

**Monitored fields (48):** LastName, FirstName, MiddleName, Ssn, BirthDate, Sex, Ethnicity, MaritalStatus, PersonalEmail, PersonalMobilePhone, Phone1/Ext, Phone2/Ext, Phone3/Ext, EmailAddress, AddressLine1/2, City, State, Zip, EmpStatus, HireDate, TermDate, TermReason, RehireDate, EmpType, Title, EeoClass, PrimaryPayRate, BaseRate, Salary, PayFrequency, PayType, PayGroup, PrimaryPayRateEffectiveDate, DefaultHours, CostCenter1/2/3, WorkLocation (address1/2, city, state, postalCode, country, county, phone/ext, mobilePhone, email)

**4. Payroll Processed**
- **Payload:** companyId, processId, checkDate, runId, processDate, status
- No employee IDs included — fires once per payroll run

**5. Time Off Approval**
- **Payload:** Employee/supervisor info, start/end dates/times, hours per day, all-day flag
- Only fires for approvals (not cancellations/changes)
- Not reliable for formal LOA detection

### Webhook Infrastructure
- **Setup:** Configured by Paylocity (not self-service). Contact Business Development (partners) or service@paylocity.com (customers)
- **Security:** Basic Auth credentials + IP whitelist (`198.245.157.0/24`, `192.40.49.0/24`)
- **Delivery:** HTTPS POST with JSON payload
- **Retry:** Every 30 minutes for up to 24 hours on failure
- **Retry triggers:** Status <100, >505, 408, 501-504
- **Not retried (treated as delivered):** 400-level errors

### Paylocity's Own Recommendation
> "Set up webhooks for critical, high priority events and run a background polling job on a defined schedule."

They explicitly recommend the **hybrid approach** (webhook + polling fallback).

---

## API Access — Two Paths (Neither Requires Paylocity's Approval)

### Path 1: Customer-Owned Integration (Day 1, No Gatekeeping)
Per Paylocity's own docs: *"All integrations default to customer-specific status. The customer is the integration owner."*

This means:
- **Your customer** (the c-store chain using Paylocity) requests API credentials through their Paylocity account executive
- The customer owns the integration — Trike builds it on their behalf
- No partner agreement, no marketplace listing, no Paylocity review required
- Webhook setup: customer emails `service@paylocity.com` to request webhooks pointing to your endpoint
- **This is how you launch Day 1.** Each new customer simply requests their own API credentials from Paylocity.

**Requirements per customer:**
- Customer contacts their Paylocity AE to request API credentials (client_id + client_secret)
- Customer requests webhook configuration for their company (New Hire, Termination, Employee Change)
- Customer provides their Company ID(s) to Trike
- Trike configures the mapping in the admin UI

### Path 2: Technology Partner (Optional, For Scale)
If/when Trike has 3+ Paylocity customers, it MAY make sense to become a Technology Partner for:
- Marketplace listing (customers discover Trike through Paylocity's marketplace)
- Streamlined onboarding (single set of partner credentials vs per-customer credentials)
- Sandbox access for development/testing
- Paylocity Certified badge (requires 3+ customers, 90+ days, <5% error rate)

**This is a growth optimization, NOT a prerequisite.** The integration works without it.

### Sandbox Access for Development
To get sandbox credentials before first customer goes live:
- Per docs: *"you must be an existing Paylocity customer or have at least one existing Paylocity customer willing to participate"*
- Your pilot customer satisfies this — they request demo environment access for Trike to build against

### Timeline
- **Customer-owned path:** As fast as the customer's AE provisions credentials (days to 1-2 weeks)
- **Average integration build:** 4-16 weeks per Paylocity FAQ
- For Trike's scope (employee sync only, no payroll/deductions): closer to 4-6 weeks including testing

---

## Architecture: Webhook-First + Polling Reconciliation

```
REAL-TIME PATH (webhooks):
  Paylocity → Webhook POST → Edge Function /hris/webhook/paylocity
  → Validate (Basic Auth + IP check) → Parse event type → Apply to users table
  → Notify store manager

RECONCILIATION PATH (polling, every 15 min):
  pg_cron → Edge Function /hris/sync
  → OAuth token → GET all employees → Snapshot diff → Catch missed events

MANUAL PATH (zero-wait):
  "Sync Now" button → Immediate full roster fetch + diff
  "Quick Add" button → Provisional user, enriched by next webhook/sync
```

### Event Flow Detail

**New Hire Webhook Received:**
1. Validate Basic Auth + source IP
2. Parse 28-field payload
3. Look up org by `companyId` in `hris_connections`
4. Map `costCenter1` → `store_id` using org's field mapping config
5. Map `jobTitle`/`position` → `role_id` using org's field mapping config
6. Call `GET /api/v2/companies/{companyId}/employees/{employeeId}` for any additional fields (mobile phone may be in full record but not webhook)
7. Create user in `users` table (reuse `CreateUserInput` pattern)
8. Store snapshot in `hris_sync_snapshots`
9. Log event to `hris_sync_log`
10. Push notification to store manager: "New employee [Name] synced — ready for training assignment"
11. Optionally: auto-assign onboarding training pathway

**Termination Webhook Received:**
1. Validate auth
2. Find user by `employee_id` + org
3. Set `status='inactive'`, `termination_date` from payload
4. Revoke Supabase auth session if exists
5. Log + notify admin
6. Return 200

**Employee Change Webhook Received:**
1. Validate auth
2. `GET /api/v2/companies/{companyId}/employees/{employeeId}` (full record)
3. Load previous snapshot from `hris_sync_snapshots`
4. Field-by-field diff to classify:
   - `RehireDate` populated + `EmpStatus` → A on previously-inactive user → **REHIRE** → reactivate user, update hire_date, clear termination_date, reassign store/role, notify store manager. **Do NOT create duplicate.**
   - `CostCenter1/2/3` or `WorkLocation` changed → **TRANSFER** → update `store_id`, notify both old and new store managers
   - `EmpStatus` changed to T/D/R → **TERMINATION** → deactivate user, set termination_date
   - `EmpStatus` changed to L → **LEAVE** → set status='on-leave'
   - `EmpStatus` changed to A (without RehireDate) → **REACTIVATION** → set status='active'
   - `Title` or `EeoClass` changed → **PROMOTION/DEMOTION** → update `role_id` if mapped
   - `PersonalMobilePhone` or `EmailAddress` changed → **INFO UPDATE** → update user fields
5. Update snapshot, log event

**Polling Reconciliation (every 15 min):**
1. Fetch full employee roster (paginated)
2. Hash each record, compare against stored snapshots
3. Any deltas = missed webhook events → process as above
4. Update all snapshots
5. Log run with counts

**Transfer Between Company IDs (within Company Set):**
- Source company fires Termination webhook (status XT)
- Target company fires New Hire webhook (status A, same employee ID)
- Detect by matching employee ID across COIDs → treat as store transfer, not termination + rehire

---

## Database Schema

### `hris_connections`
```sql
CREATE TABLE hris_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  provider TEXT NOT NULL DEFAULT 'paylocity', -- extensible for adp, gusto, etc.
  company_ids TEXT[] NOT NULL, -- array of COIDs (may be multiple per org in a Company Set)
  company_set_id TEXT, -- CSID if applicable
  client_id TEXT NOT NULL, -- OAuth client_id (encrypted at rest via Vault)
  client_secret TEXT NOT NULL, -- OAuth client_secret (encrypted)
  webhook_username TEXT, -- Basic Auth username for inbound webhooks
  webhook_password TEXT, -- Basic Auth password for inbound webhooks
  sync_interval_minutes INT NOT NULL DEFAULT 15,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  field_mapping JSONB NOT NULL DEFAULT '{}',
  -- field_mapping structure:
  -- {
  --   "costCenter1_to_store": {"11 - Store A": "uuid-of-store-a", ...},
  --   "costCenter2_to_district": {"22 - District X": "uuid-of-district-x", ...},
  --   "position_to_role": {"Store Manager": "uuid-of-role", ...},
  --   "status_mapping": {"A": "active", "T": "inactive", "L": "on-leave", "XT": "inactive"}
  -- }
  last_synced_at TIMESTAMPTZ,
  last_sync_status TEXT,
  secret_expires_at DATE, -- track credential expiry (365-day rotation)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, provider)
);
```

### `hris_sync_snapshots`
```sql
CREATE TABLE hris_sync_snapshots (
  organization_id UUID NOT NULL REFERENCES organizations(id),
  company_id TEXT NOT NULL, -- which COID this employee belongs to
  external_employee_id TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL, -- hash of tracked fields for quick diff
  snapshot_data JSONB NOT NULL, -- full record for field-level diff
  trike_user_id UUID REFERENCES users(id), -- link to our user record
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (organization_id, company_id, external_employee_id)
);
```

### `hris_sync_log`
```sql
CREATE TABLE hris_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  trigger_type TEXT NOT NULL, -- 'webhook_new_hire', 'webhook_termination', 'webhook_change', 'scheduled', 'manual'
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'success', 'partial', 'error'
  employees_found INT DEFAULT 0,
  new_hires INT DEFAULT 0,
  terminations INT DEFAULT 0,
  transfers INT DEFAULT 0,
  status_changes INT DEFAULT 0,
  info_updates INT DEFAULT 0,
  errors JSONB DEFAULT '[]',
  raw_payload JSONB, -- webhook payload or summary for audit
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### `users` table addition
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS hris_provider TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS external_employee_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS hris_last_synced_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_provisional BOOLEAN DEFAULT false;
```

---

## Edge Functions

### 1. `/hris/webhook/paylocity` — Webhook Receiver
- Validates Basic Auth against `hris_connections.webhook_username/password`
- Validates source IP against Paylocity ranges
- Routes by payload shape: 28 fields → new hire, has `terminationDate` → termination, just companyId+employeeId → change
- Processes event, returns 200 immediately (Paylocity treats 400-level as "delivered" and won't retry)
- Idempotent: check `hris_sync_log` for duplicate payloads

### 2. `/hris/sync` — Polling Reconciliation
- Called by pg_cron every 15 minutes
- OAuth token exchange → fetch all employees paginated → snapshot diff → apply changes
- Also callable manually via "Sync Now" button

### 3. `/hris/config` — Admin Endpoints
- `GET /hris/config/:orgId` — current connection + mapping
- `PUT /hris/config/:orgId` — update connection + mapping
- `GET /hris/config/:orgId/lookup-values` — fetch cost centers, positions, work locations from Paylocity for mapping UI
- `GET /hris/config/:orgId/sync-log` — recent sync history

### Provider Adapter Interface
```typescript
interface HRISProvider {
  name: string;
  authenticate(credentials: any): Promise<string>;
  fetchEmployees(token: string, companyId: string, page: number, pageSize: number): Promise<{ employees: HRISEmployee[]; totalCount: number }>;
  fetchEmployee(token: string, companyId: string, employeeId: string): Promise<HRISEmployee>;
  fetchLookupValues(token: string, companyId: string): Promise<{ costCenters: any[]; positions: any[]; workLocations: any[] }>;
  parseWebhookEvent(payload: any): { type: 'new_hire' | 'termination' | 'change'; data: any };
  mapToUser(employee: HRISEmployee, fieldMapping: any): Partial<CreateUserInput>;
}
```

---

## Dashboard UI

### HRIS Connection Settings (Admin → Settings)
1. **Provider selection** (Paylocity first, extensible)
2. **Credentials input** — Company ID(s), OAuth client_id/secret
3. **Webhook endpoint display** — shows the URL + Basic Auth creds to give to Paylocity during setup
4. **Mapping builder:**
   - Fetches live cost center codes from Paylocity → drag/drop map to your stores
   - Fetches position codes → map to your roles
   - Fetches work locations → map to your stores (alternative to cost centers)
   - Custom status code mapping
5. **Credential expiry warning** — shows days until secret rotation required
6. **Test connection button** — validates OAuth + fetches employee count

### People Page Enhancements
1. **"Sync Now" button** — triggers immediate reconciliation, shows real-time progress via Supabase realtime
2. **Sync status indicator** — "Last synced 2 min ago" with green/yellow/red health
3. **HRIS badge on user cards** — shows which users are HRIS-managed vs manually created
4. **"Quick Add" provisional flow** — minimal-field form for when new hire is physically present

### Sync Log Viewer (Admin → HRIS)
- Table of recent sync events with type (webhook/scheduled/manual), timestamp, change counts
- Expandable rows showing what changed per event
- Error details for failed syncs

---

## Provisional User Flow (Zero-Wait Onboarding)

For when a new hire is standing in the store and needs to start training NOW:

1. Store manager clicks "Quick Add Employee"
2. Enters: first name, last name, store, phone or email (minimal fields)
3. User created immediately with `is_provisional = true`
4. Employee starts training within seconds
5. When Paylocity New Hire webhook arrives (or next polling sync):
   - Match by name + store, or by employee_id if provided
   - Enrich provisional record with full HRIS data (employee_id, exact role, cost centers, etc.)
   - Set `is_provisional = false`, `hris_provider = 'paylocity'`, `external_employee_id`
6. If no match found within 48 hours, flag for admin review

---

## Pros

| | |
|---|---|
| **Near real-time** | Webhooks fire within ~1 min of Paylocity changes — new hire can start training almost immediately |
| **All critical events covered** | New hire (28 fields), termination (with date), employee changes (48 monitored fields), rehires via RehireDate |
| **No Paylocity approval needed** | Customer-owned integration path — each customer requests their own API creds from their AE |
| **Paylocity recommends this pattern** | Their own docs say "webhooks for critical events + background polling" |
| **No middleware cost** | Eliminates Merge.dev per-employee fees |
| **Company-specific OpenAPI spec** | Endpoint returns each customer's exact field requirements/enumerations — enables dynamic mapping |
| **Cost center + work location lookups available** | Can fetch valid codes from Paylocity to populate mapping UI — no manual entry |
| **Existing infra reuse** | pg_cron (relay-fallback-cron pattern), Edge Functions (trike-server pattern), realtime subscriptions, `bulkCreateUsers` logic |
| **Provider-extensible** | Adapter interface supports ADP/Gusto/BambooHR (all have webhooks + delta queries) |

## Cons / Risks

| | |
|---|---|
| **Customer must request credentials** | Each new Paylocity customer must contact their AE to get API creds + webhook setup. Trike can provide instructions but can't self-serve this |
| **Webhook setup not self-service** | Customer must email service@paylocity.com to configure webhooks per company — adds onboarding friction |
| **Employee Change webhook is sparse** | Only sends IDs — requires follow-up API call (adds ~100ms latency, counts against rate limit) |
| **Credential rotation** | Annual secret rotation required per customer — need reminder/automation |
| **Company Set complexity** | Multi-COID customers have cross-company transfers (XT status) — need special handling |
| **Rehire edge cases** | Same employee ID reused — must detect RehireDate and reactivate, not create duplicate |
| **Custom status codes** | Some customers create custom statuses beyond A/T/D/R/L/XT — must handle gracefully |
| **Per-provider work** | Each new HRIS provider = new adapter (~1-2 weeks). But the core sync engine is provider-agnostic |

---

## Implementation Phases

### Phase 1: Foundation + Webhook Receiver (Week 1-2)
- DB migration: 3 tables + users columns
- Paylocity OAuth adapter
- Edge Function: `/hris/webhook/paylocity` — New Hire + Termination handlers
- Field mapping engine (costCenter→store, position→role)
- "Sync Now" button on People page
- **Milestone: New hire webhook → user in Trike in seconds**

### Phase 2: Employee Changes + Polling (Week 2-3)
- Employee Change webhook handler (fetch full record, diff, classify, apply)
- Snapshot diff engine for polling reconciliation
- pg_cron job (every 15 min)
- Transfer detection (XT status handling across COIDs)
- Sync log table + basic viewer
- **Milestone: All lifecycle events flow automatically**

### Phase 3: Admin Configuration UI (Week 3-4)
- HRIS connection settings panel
- Live cost center/position/work location fetching from Paylocity
- Visual mapping builder (drag Paylocity codes → your stores/roles)
- Credential management + expiry warnings
- Test connection flow
- **Milestone: New customer can self-configure Paylocity connection**

### Phase 4: Notifications + Provisional Flow (Week 4-5)
- Real-time notifications to store managers (new hires, terminations, transfers)
- Provisional "Quick Add" for zero-wait onboarding
- Auto-reconciliation matcher (provisional → HRIS record)
- Sync log detail viewer
- **Milestone: Complete zero-friction onboarding experience**

---

## Verification Plan

1. **Mock webhooks** — POST sample payloads (new hire, termination, change) to Edge Function, verify user CRUD
2. **Paylocity sandbox** — End-to-end with real API once sandbox credentials received
3. **New hire flow** — Add employee in Paylocity → webhook fires → user appears in Trike → store manager notified
4. **Termination flow** — Terminate in Paylocity → webhook fires → user deactivated → auth revoked
5. **Transfer flow** — Change costCenter in Paylocity → change webhook fires → API follow-up → store_id updated
6. **Rehire flow** — Terminate employee → wait → rehire same employee in Paylocity → change webhook fires with RehireDate → existing user reactivated (NOT duplicated), store/role updated, store manager notified
7. **Multi-COID transfer** — Transfer employee between companies → XT on source, new hire on target → detect as transfer not termination+rehire
8. **Polling reconciliation** — Disable webhooks temporarily → make changes → verify 15-min poll catches them
9. **Sync Now** — Click button → verify immediate fetch + diff + apply
10. **Provisional flow** — Quick Add → webhook arrives → records merge → provisional flag cleared
11. **Rate limit safety** — Verify polling + change follow-ups stay well under 25 req/s

---

## Immediate Action Items

1. **Ask pilot customer to request API credentials from their Paylocity AE** — this is the only blocker. Customer-owned integration, no Paylocity approval of Trike needed.
2. **Ask pilot customer to request sandbox/demo access** — so Trike can build and test against their data shape
3. **Get pilot customer's Company ID(s)** — determine if they use a single COID or a Company Set
4. **Get pilot customer's cost center usage** — what does costCenter1/2/3 mean for their org? Which maps to stores vs districts?
5. **Ask pilot customer to request webhook setup** — email service@paylocity.com for New Hire, Termination, Employee Change webhooks pointing to Trike's Edge Function URL
6. **Optionally: explore Technology Partner path** for marketplace listing once 3+ Paylocity customers exist — this is a growth play, not a prerequisite

Everything else can be built and tested with mock webhook payloads while waiting for credentials.
