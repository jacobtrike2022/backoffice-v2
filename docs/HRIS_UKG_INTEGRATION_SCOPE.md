# Scope: Direct HRIS Sync Engine — UKG Integration

## Context

Same architecture as the Paylocity integration scope (see `HRIS_DIRECT_INTEGRATION_SCOPE.md`), applied to UKG. UKG is one of the largest HRIS/payroll providers in the c-store and foodservice space. They have multiple products — understanding which one a customer uses is step one.

---

## UKG Product Lines — Which One Matters?

UKG has **three main products** from their merger of Ultimate Software + Kronos:

| Product | Target Market | Formerly | API Style |
|---|---|---|---|
| **UKG Pro** (HCM + WFM) | Mid-market to enterprise (1,000+ employees) | UltiPro + Dimensions | REST + SOAP |
| **UKG Ready** | SMB (under 1,000 employees) | Kronos Workforce Ready | REST v1/v2 |
| **UKG Pro WFM** | Workforce management add-on | Kronos Dimensions | REST |

**For Trike's c-store customers:** Most likely **UKG Pro** (larger chains) or **UKG Ready** (smaller operators). You'll need to ask each customer which product they use — the APIs are completely different.

---

## UKG Pro HCM API — Complete Capabilities (from developer.ukg.com)

### Authentication — Dual-Header System

UKG Pro uses **two different auth methods** depending on the API generation:

**Legacy REST API (Personnel endpoints):**
- Basic Auth: `Authorization: Basic {base64(username:password)}`
- Plus tenant header: `US-Customer-Api-Key: {customer_api_key}`
- Credentials come from a **Web Service Account** created by the customer's admin
- Each account gets: username, password, and a unique **User API Key**
- Customer also has a tenant-level **Customer API Key**
- Base URL varies by datacenter (e.g., `https://servicet.ultipro.com/services/`)

**Modern Platform API (Webhooks, Developer Console):**
- OAuth 2.0 Client Credentials flow
- Required: Organization ID, Client ID, Client Secret
- Audience: `api.ukg.net`
- Token endpoint via Developer Console
- Headers: `Authorization: Bearer {token}` + `global-tenant-id: {org_id}`

**Key difference from Paylocity:** Every API request needs BOTH an auth token AND a tenant API key header. Miss either and you get 401.

### Employee Data (Read)

**Core Endpoints:**
| Endpoint | Description |
|---|---|
| `GET /personnel/v1/person-details` | All person records |
| `GET /personnel/v1/employee-demographic-details` | Demographics (name, DOB, contact, address) |
| `GET /personnel/v1/companies/{companyId}/employees/{employeeId}/employment-details` | Employment record (hire date, status, job, org levels) |
| `GET /personnel/v1/companies/{companyId}/employment-details` | All employment records for a company |
| `GET /personnel/v1/integration/kronos/employee-profiles` | Employee profiles (filterable by company, employee ID, effective date) |

**Critical Design Difference from Paylocity:**
UKG uses a **two-call architecture** for full employee data:
1. List endpoint returns **only employee IDs**
2. Must call per-employee to get full profile

For 80-100 employees, this means ~100 API calls per sync (vs Paylocity's single paginated call). Rate limiting (per-minute quotas, no published numbers) becomes more relevant.

**Configuration/Lookup Endpoints:**
| Endpoint | Maps To |
|---|---|
| `GET /personnel/v1/org-levels` | Organization hierarchy (districts, stores) |
| `GET /personnel/v1/company-details` | Company info |
| Configuration: CodeTables, Jobs, Locations, Positions, ShiftCodes | Reference data for field mapping |
| 30+ lookup endpoints (EmployeeType, JobFamily, Skills, etc.) | Enumeration values |

**Company-Specific OpenAPI:** Not available (unlike Paylocity). Field discovery requires exploring the configuration endpoints.

### Data Direction
Trike is **read-only** from UKG. We pull employee data; we never write back. Write endpoints exist (onboarding new hires, updating records) but are out of scope.

### Employee Status Codes

| Code | Label | Type |
|---|---|---|
| A | Active | Active |
| T | Terminated | Terminated |
| L | Leave of Absence | Leave |
| D | Deceased | Terminated |
| R | Retired | Terminated |
| S | Suspended | Suspended |

**Status Transitions:**
- **Hire:** → A (Active)
- **Termination:** A → T (with termination date, reason code, voluntary/involuntary flag)
- **Leave:** A → L (with leave type, expected return date)
- **Return from Leave:** L → A
- **Rehire:** T → A (new employment segment, same employee ID, new lastHireDate)
- **Retirement:** A → R
- **Suspension:** A → S

### Org Level Structure (Critical for Store Mapping)

UKG Pro uses a **4-level hierarchy:**
```
Company (Top Level — legal entity)
  └── Org Level 1 (e.g., Region)
      └── Org Level 2 (e.g., District)
          └── Org Level 3 (e.g., Store)
              └── Org Level 4 (e.g., Department within store)
```

**For convenience store chains, typical mapping:**
- Org Level 1 = Region (e.g., "Southeast")
- Org Level 2 = District (e.g., "District 5") → maps to Trike `districts`
- Org Level 3 = Store (e.g., "Store 1042") → maps to Trike `stores`
- Org Level 4 = Department (e.g., "Deli", "Front End", "Fuel") → informational only

Each employee's job record includes org level assignments. When these change, the employee has been transferred.

**Multi-Company:** Large chains may have multiple Company codes (separate legal entities/EINs). Employees can transfer between companies — this creates a termination in source company + new hire in target (same as Paylocity's XT pattern).

### Rehire Handling

- **Same Employee ID retained** — UKG preserves the original employee ID (GUID)
- **New employment segment** — creates a new job record, previous history preserved
- `originalHireDate` stays the same; `lastHireDate`/`rehireDate` is set to new date
- Seniority tracking configurable (original vs most recent hire date)
- Webhook fires as **`employee.rehire`** (distinct from `employee.newhire`) — you MUST handle both
- **For Trike:** Check `users` table by `external_employee_id`. If found and inactive → reactivate, don't duplicate.

### Transfers

**Intra-company (store/location change):**
- Org level assignments updated on employee record
- Fires `employee.jobchange` or `employee.orglevelchange` event
- Same employee ID, same company
- **Trike action:** Update `store_id` based on new org level mapping

**Inter-company (between legal entities):**
- Treated as **termination from Company A + new hire into Company B**
- Two events fire
- Employee MAY get a new employee ID in the new company
- **Trike action:** Match by email or person GUID to avoid duplicate user creation

---

## Webhooks — Full Detail

### Platform & Pricing

| Tier | Limit | Features |
|---|---|---|
| **Free** | 10,000 events/month | UI subscription management, HMAC auth |
| **Premium** | Unlimited | + REST API for subscription management, retry API, audit API |

For Trike's scale (80-100 employees, ~5-10 events/day), the free tier is more than sufficient.

### Regional Endpoints

| Region | URL |
|---|---|
| US | `https://webhooks.ukg.net` |
| Canada | `https://webhooks-ca.ukg.net` |
| EU | `https://webhooks-eu.ukg.net` |
| Australia | `https://webhooks-au.ukg.net` |

### Available HCM Webhook Events

| Event | Fires When | Trike Action |
|---|---|---|
| **New Hire** | New employee record created | Create user, assign store+role, notify manager |
| **Rehire** | Previously terminated employee rehired | Reactivate existing user (NOT duplicate), update dates/store/role |
| **Termination** | Employee terminated | Deactivate user, set termination_date, revoke auth |
| **Job Change** | Title, department, supervisor, location, pay group changed | Update role_id (if title mapped), update store_id (if location changed) |
| **Org Level Change** | Cost center, department, division reassignment | Update store_id/district based on new org levels |
| **Status Change** | Active/Inactive/Leave transitions | Update user status (active/inactive/on-leave) |
| **Personal Change** | Name, address, phone, email change | Update user contact fields |
| **Compensation Change** | Pay rate, salary changes | Log only (not stored in Trike) |
| **Transfer** | Movement between companies/locations | Update store assignment, handle cross-company matching |
| **Person Name Change** | Name updated | Update first_name/last_name |
| **Hire Date Change** | Hire date corrected | Update hire_date |
| **Termination Change** | Termination details modified (date, reason) | Update termination_date |

**Additional events available but lower priority:** Document events, account/org config events, WFM shift/punch events.

### Webhook Payload Structure

UKG webhooks are **"thin" notifications** — they send the event type + employee identifier, NOT the full employee record. You must call back to the API to get current state.

```json
{
  "eventId": "guid",
  "eventType": "employee.newhire",
  "timestamp": "2026-04-06T12:00:00Z",
  "companyId": "ABC01",
  "employee": {
    "employeeId": "12345",
    "firstName": "Jane",
    "lastName": "Doe",
    "emailAddress": "jane.doe@example.com"
  },
  "details": { /* event-specific fields */ }
}
```

**Key difference from Paylocity:** Paylocity's New Hire webhook sends 28 fields (enough to create a user without a follow-up call). UKG's webhooks are thinner — you'll almost always need a follow-up API call.

### Webhook Security
- **HMAC authentication** — minimum 24-character secret
- HMAC secret cannot be viewed after creation (only regenerated)
- Custom headers supported (for additional auth)

### Webhook Reliability

**UKG's own documentation explicitly states:**
> "If you are creating a business critical integration based on a UKG Webhooks notification that has zero tolerance for a missed event, you should consider a secondary polling synchronization or nightly report."

**Events will NOT be delivered when:**
- SQL triggers are disabled/removed by database administrators
- Database restores occur (triggers temporarily disabled)
- Mass database updates happen

**Retry logic:** Not well documented. Event retention: 14 days. Event replay planned but not yet available.

**Bottom line:** Polling fallback is not optional with UKG — it's their own recommendation. Same hybrid architecture as Paylocity.

### Subscription Management
- Created through UKG Webhooks UI (not API, unless Premium)
- RBAC: Admin (full), Editor (create/modify subscriptions), Viewer (read-only)
- Admin access requires "Add/Edit Service Accounts" permission in UKG Pro
- Can test, deactivate/reactivate, and edit subscriptions
- Wildcard subscriptions supported (subscribe to all events in a category)

### Setup Requirements
1. Customer admin enables webhooks in UKG Pro: `Menu > System Configuration > System Settings > Mobile App and Chat Integrations`
2. Customer admin grants webhook permissions to appropriate roles
3. Subscription created via UKG Webhooks UI pointing to Trike's Edge Function URL
4. HMAC secret configured for verification

---

## Rate Limits

| Metric | Detail |
|---|---|
| Window | Per-minute quotas |
| Limit | **Not published** — tenant-specific |
| Throttle response | HTTP 429 |
| Retry-After header | Not currently implemented (planned) |
| Recommended retry | 1-second delay, then exponential backoff |

**Practical impact for Trike:** The two-call architecture (list → per-employee detail) means syncing 100 employees requires ~100+ API calls. At unknown rate limits, you should:
- Batch requests with 50-100ms delays between calls
- Implement exponential backoff on 429s
- Cache OAuth tokens (don't re-auth per call)

---

## API Access — Two Paths (Neither Requires UKG's Approval of Trike)

### Path 1: Customer-Owned Web Service Account (Day 1, No Gatekeeping)

The customer's system administrator creates a Web Service Account:
1. Log into UKG Pro as system admin
2. Navigate to: `System Configuration > Security > Service Account Administration`
3. Create account with username, password
4. Assign permissions to specific API resources (Personnel endpoints)
5. System generates a unique **User API Key**
6. Customer shares credentials with Trike

For webhooks:
1. Customer admin enables webhooks in System Settings
2. Customer creates subscription in UKG Webhooks UI pointing to Trike's endpoint
3. Customer configures HMAC secret

**This is how you launch Day 1.** Each new customer creates their own service account and webhook subscription.

### Path 2: UKG Connect Technology Partner (Optional, For Scale)

Benefits of partnership:
- Sandbox/test tenants for development
- Listing on UKG Marketplace (customer discovery)
- Direct access to UKG engineering for API questions
- Pre-release access to API updates
- Integrated global support process

**Application:** [ukg.com/become-a-ukg-partner](https://www.ukg.com/become-a-ukg-partner)

**This is a growth optimization, NOT a prerequisite.**

---

## UKG vs Paylocity — Key Differences for Implementation

| Dimension | Paylocity | UKG Pro |
|---|---|---|
| **Auth** | OAuth 2.0 CC (single header) | Basic Auth + API Key (dual header) OR OAuth 2.0 + tenant header |
| **Employee list** | Single paginated call returns all data | List returns IDs only → per-employee follow-up calls |
| **Webhook payloads** | New Hire: 28 fields (rich) | Thin notification (event type + ID) → always need follow-up call |
| **Webhook setup** | Paylocity configures (email service@) | Customer self-serves via UKG Webhooks UI |
| **Rehire event** | Detected via RehireDate field in change webhook | Distinct `employee.rehire` event type |
| **Transfer** | costCenter change detected in change webhook | Separate `employee.jobchange` / `employee.orglevelchange` events |
| **Org hierarchy** | 3 cost centers (flexible meaning per customer) | 4 org levels (typically Region→District→Store→Department) |
| **Webhook reliability** | Retry every 30 min for 24 hours | UKG explicitly warns about missed events — polling mandatory |
| **Rate limits** | 25 req/s (published) | Per-minute quotas (unpublished, tenant-specific) |
| **Free webhook tier** | No tier — included | 10,000 events/month free |
| **Company-specific schema** | OpenAPI spec endpoint per company | Not available — discover via config endpoints |

### What This Means for the Provider Adapter

The UKG adapter needs different handling:

```typescript
// Paylocity: New Hire webhook has enough data to create user immediately
// UKG: New Hire webhook is thin — MUST call API to get employee details

class UKGProAdapter implements HRISProvider {
  // authenticate() — dual-header auth (Basic + API Key)
  // fetchEmployees() — two-call: list IDs → fetch each
  // fetchEmployee() — single employee detail
  // parseWebhookEvent() — thin payload → extract employeeId + eventType
  // mapToUser() — map org levels to store/district
}
```

The `parseWebhookEvent` + follow-up `fetchEmployee` pattern is critical. Unlike Paylocity's New Hire webhook (which has 28 fields), UKG's thin webhook means EVERY event type requires a follow-up API call.

---

## UKG Ready (SMB Product) — If Customer Uses This Instead

UKG Ready has a completely separate API:

| Feature | UKG Ready |
|---|---|
| Base URL | `https://secure7.saashr.com/ta/docs/rest/public/` |
| Auth | Token-based (`POST /v1/login`) |
| Employee endpoint | `GET /v2/companies/{cid}/employees` |
| LOA endpoint | `GET /v2/companies/{cid}/loa/` |
| Lookup data | 50+ lookup types via `/v2/companies/{cid}/lookup/` |
| Webhooks | **Not documented** — may not be available |
| Import/Export | `POST /v1/import/`, `GET /v1/export/` |

**If a customer uses UKG Ready instead of UKG Pro:**
- Different adapter needed (different auth, different endpoints, different data shapes)
- Webhooks may not be available — polling-only approach
- Simpler API structure (REST v2 is more modern)
- Employee list returns full records (no two-call problem)

**Ask the customer upfront:** "Do you use UKG Pro or UKG Ready?" The integration is completely different.

---

## Architecture (Same Pattern as Paylocity, Adapted for UKG)

```
REAL-TIME PATH (webhooks — UKG Pro only):
  UKG Pro → Webhook POST → Edge Function /hris/webhook/ukg
  → Validate HMAC → Parse event type → Follow-up API call for full data
  → Apply to users table → Notify store manager

RECONCILIATION PATH (polling, every 15 min):
  pg_cron → Edge Function /hris/sync
  → Auth (Basic + API Key or OAuth) → List employee IDs → Fetch each
  → Snapshot diff → Catch missed events

MANUAL PATH (zero-wait):
  "Sync Now" button → Immediate full roster fetch + diff
  "Quick Add" button → Provisional user, enriched by next webhook/sync
```

### Event Flow — UKG-Specific

**New Hire Webhook Received:**
1. Validate HMAC signature
2. Parse thin payload → extract `companyId` + `employeeId`
3. **Call UKG API** to get full employee record (demographics + employment details — 2 calls)
4. Look up org by companyId in `hris_connections`
5. Map Org Level 3 → `store_id`, Org Level 2 → district
6. Map job title/position → `role_id`
7. Create user in `users` table
8. Store snapshot, log event, notify store manager

**Rehire Webhook Received:**
1. Validate HMAC
2. Parse → extract employeeId
3. **Check `users` table** for existing record with this `external_employee_id`
4. If found (status=inactive): **Reactivate** — update hire_date, clear termination_date, update store/role from current record
5. If NOT found: Treat as new hire (create user)
6. Log as rehire event

**Termination Webhook Received:**
1. Validate HMAC
2. Find user by employee_id + org
3. Call UKG API for termination date + reason (thin webhook doesn't include these)
4. Set status='inactive', termination_date
5. Revoke auth, log, notify admin

**Job Change / Org Level Change Webhook:**
1. Validate HMAC
2. Call UKG API for updated employment details
3. Compare org levels against stored snapshot
4. If Org Level 3 changed → **TRANSFER** → update store_id, notify both managers
5. If job title changed → **PROMOTION/DEMOTION** → update role_id if mapped

**Polling Reconciliation:**
1. List all employee IDs for company
2. Fetch each employee's current record (100 API calls for 100 employees)
3. Hash + compare against snapshots
4. Process any changes found
5. **Rate limit awareness:** Space calls with 50-100ms delays, handle 429s with backoff

---

## Database Schema Additions (Beyond Paylocity Scope)

The `hris_connections` table already supports multiple providers. UKG-specific fields in the `field_mapping` JSONB:

```json
{
  "provider": "ukg_pro",
  "auth_type": "basic_plus_apikey",  // vs "oauth2" for platform API
  "orgLevel1_to_district": {"Region Southeast": "uuid-of-district"},
  "orgLevel2_to_district": {"District 5": "uuid-of-district"},
  "orgLevel3_to_store": {"Store 1042": "uuid-of-store"},
  "jobTitle_to_role": {"Store Manager": "uuid-of-role"},
  "status_mapping": {"A": "active", "T": "inactive", "L": "on-leave", "S": "inactive", "D": "inactive", "R": "inactive"}
}
```

Additional column on `hris_connections`:
```sql
ALTER TABLE hris_connections ADD COLUMN IF NOT EXISTS auth_type TEXT DEFAULT 'oauth2';
-- 'oauth2' for Paylocity, 'basic_plus_apikey' for UKG Pro legacy, 'token' for UKG Ready
```

---

## Pros

| | |
|---|---|
| **Webhooks with distinct event types** | Separate events for new hire, rehire, termination, job change, status change — no need to classify from a generic "change" event |
| **Rehire is a first-class event** | `employee.rehire` fires separately from `employee.newhire` — explicit handling, no guessing |
| **Customer self-serves webhook setup** | UKG Webhooks UI lets the customer create subscriptions without emailing support (unlike Paylocity) |
| **Free webhook tier** | 10,000 events/month covers Trike's scale easily |
| **4-level org hierarchy** | More granular than Paylocity's 3 cost centers — maps cleanly to Region→District→Store→Department |
| **No UKG approval needed** | Customer creates Web Service Account, shares creds. Day 1 access. |
| **Same core sync engine** | Provider adapter pattern means UKG plugs into the same architecture as Paylocity |

## Cons / Risks

| | |
|---|---|
| **Two-call architecture** | List returns IDs only → must fetch each employee individually. 100 employees = 100+ API calls per sync |
| **Thin webhook payloads** | Every webhook event requires a follow-up API call to get actual data (unlike Paylocity's 28-field New Hire payload) |
| **UKG explicitly warns about missed webhooks** | Database restores, mass updates, disabled triggers can silently drop events. Polling fallback is mandatory. |
| **Unpublished rate limits** | Per-minute quotas exist but aren't documented. Must discover through 429 responses. |
| **Dual auth system** | Legacy API uses Basic + API Key; Platform API uses OAuth + tenant header. May need both depending on endpoints used. |
| **UKG Pro vs UKG Ready** | Completely different APIs. Must ask customer which product they use. UKG Ready may not have webhooks at all. |
| **Inter-company transfers** | Termination in source + new hire in target. Employee may get new ID in new company — harder to match than Paylocity. |
| **No Retry-After header** | When rate limited, you must guess retry timing (start at 1s, exponential backoff). |

---

## Implementation (Fits Into Existing Phased Plan)

Since the core sync engine, database schema, and UI are shared across providers, UKG implementation is primarily an **adapter** build:

### UKG Pro Adapter (1-2 weeks after Paylocity adapter exists)
- OAuth/Basic Auth token management (dual-header)
- Employee list → per-employee fetch (handle two-call architecture)
- Org level mapping (4 levels → districts/stores)
- Webhook HMAC validation
- Thin webhook → follow-up API call pattern
- Rehire event handler (distinct from new hire)
- Rate limit handling (429 backoff)

### UKG Ready Adapter (If needed, 1-2 additional weeks)
- Different auth (token-based login)
- Different endpoints (`/v2/companies/{cid}/employees`)
- May be polling-only (no webhooks)
- Simpler data model

### Admin UI Extensions
- Provider selection: Paylocity / UKG Pro / UKG Ready
- UKG-specific: Org Level mapping (4 levels vs Paylocity's 3 cost centers)
- Auth type selection (Basic + API Key vs OAuth)
- UKG Ready: may need polling interval config since no webhooks

---

## Verification Plan (UKG-Specific)

1. **Mock UKG webhooks** — POST sample thin payloads → verify follow-up API call + user CRUD
2. **HMAC validation** — Verify signature checking with test secret
3. **Two-call sync** — Mock list endpoint + per-employee fetches → verify full roster sync
4. **New hire** → thin webhook → follow-up call → user created → store manager notified
5. **Rehire** → `employee.rehire` event → existing user reactivated (NOT duplicated)
6. **Termination** → thin webhook → follow-up call for date/reason → user deactivated
7. **Job change (transfer)** → org level change → store_id updated
8. **Inter-company transfer** → term in Company A + hire in Company B → detect as transfer, no duplicate
9. **Rate limit handling** — Simulate 429 responses → verify exponential backoff
10. **Polling reconciliation** — Verify snapshot diff catches missed webhooks
11. **UKG Ready fallback** — If customer uses Ready, verify polling-only sync works

---

## Immediate Action Items (For a UKG Customer)

1. **Ask customer: "Do you use UKG Pro or UKG Ready?"** — The integration is completely different.
2. **Customer creates Web Service Account** — `System Configuration > Security > Service Account Administration`
3. **Customer provides:** Username, Password, User API Key, Customer API Key, Company Code(s), and datacenter URL
4. **Customer enables webhooks** — `System Configuration > System Settings > Mobile App and Chat Integrations`
5. **Customer creates webhook subscriptions** — via UKG Webhooks UI, pointing to Trike's endpoint, with HMAC secret
6. **Get customer's org level mapping** — What do Org Levels 1-4 mean for their business? Which maps to stores vs districts?
7. **Determine if multi-company** — Does the customer have multiple Company codes? Are there inter-company transfers?
