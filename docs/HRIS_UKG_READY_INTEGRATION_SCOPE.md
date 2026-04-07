# Scope: Direct HRIS Sync Engine — UKG Ready

## Context

UKG Ready (formerly Kronos Workforce Ready) is UKG's SMB product. This is a **completely different API** from UKG Pro — different auth, different endpoints, different data shapes. This scope covers UKG Ready specifically.

**Key advantage over Paylocity:** UKG Ready has a **`/employees/changed` delta endpoint** that returns only employees modified since a given timestamp. This eliminates the need for full-roster snapshot diffing on every poll.

---

## UKG Ready API — Complete Capabilities

### Authentication

**Token-based login** (simpler than both Paylocity and UKG Pro):

```
POST https://secure{N}.saashr.com/ta/rest/v1/login

Headers:
  Accept: application/json
  Content-Type: application/json
  Api-Key: {api-key}

Body:
{
  "credentials": {
    "username": "ServiceAccountUsername",
    "password": "ServiceAccountPassword",
    "company": "1234567"
  }
}

→ Returns: { "token": "bearer-token-here" }
```

| Detail | Value |
|---|---|
| Token TTL | 1 hour |
| Refresh | `POST /v1/refresh-token` (before expiry) |
| Logout | `POST /v1/logout` (invalidate) |
| API Key | Generated in Company Settings > Global Setup > Login Config > API Keys |
| Base URL | **Varies per customer** — `https://secure{N}.saashr.com/ta/rest/` where N = 3, 4, 7, etc. |
| Company ID | 7-digit "Company Short Name" from login URL (e.g., `1234567`) |

**Critical: Always use a service account.** If a real employee's password changes or they leave, the integration breaks. Setup:
1. Create a "Not in Payroll" employee record as the API user
2. Create a custom Security Profile with REST API resource access
3. Grant "All Company Employees" group access with manager-level view/edit
4. Assign the security profile to the service account

### Employee Data (Read)

**Core Employee Endpoints:**
| Endpoint | Method | Description |
|---|---|---|
| `/v2/companies/{cid}/employees` | GET | List all employees (paginated, filterable by status) |
| `/v2/companies/{cid}/employees/{aid}` | GET | Get specific employee by account ID |
| `/v2/companies/{cid}/employees/changed` | GET | **Delta endpoint — employees modified since a timestamp** |
| `/v2/companies/{cid}/employees/{aid}/demographics` | GET | Citizenship, ethnicity, gender, DOB |
| `/v2/companies/{cid}/employees/{aid}/pay-info` | GET | Compensation, job classification, cost center, payroll status |
| `/v2/companies/{cid}/employees/{aid}/contacts` | GET | Emergency/personal contacts |
| `/v2/companies/{cid}/employees/{aid}/profiles` | GET | Security, benefit, pay period, work schedule profiles |
| `/v2/companies/{cid}/employees/{aid}/skills` | GET | Skills with proficiency levels |
| `/v2/companies/{cid}/employees/{aid}/hr-custom-fields` | GET | Custom HR field values |
| `/v2/companies/{cid}/employees/{aid}/compensation/history` | GET | Compensation history with effective dates |
| `/v2/companies/{cid}/employees/{aid}/loa/cases` | GET | Leave of absence cases |
| `/v2/companies/{cid}/employees/{aid}/credentials` | GET | Certifications/credentials |
| `/v2/companies/{cid}/employees/{aid}/training/certifications` | GET | Training & certifications |

**Employee Record Fields:**
| Category | Fields |
|---|---|
| **Identity** | Account ID (aid), Employee Number, Username, First Name, Middle Name, Last Name, Display Name |
| **Contact** | Work Email, Personal Email, Mobile Phone, Work Phone, Address (line1/2, city, state, zip, country) |
| **Employment** | Hire Date, Original Hire Date, Last Hire Date (rehire), Termination Date, Last Day Worked, Eligible for Rehire, Employment Status |
| **Job** | Job Title, Position, Employee Type, Start Date |
| **Org** | Company ID, Cost Center, Department, Location, Manager/Supervisor reference |
| **Compensation** | Pay Type, Pay Rate, Salary, Pay Period Profile (via pay-info endpoint) |
| **Custom** | HR Custom Fields (indexed array, org-defined) |

**Employee Lookup Methods:** Employee number, SSN, SIN (Canada), email address, or account ID.

**Filtering:** `employment_status` param: `ACTIVE`, `TERMINATED`, etc. Date range filters on many endpoints.

**Pagination:**
- Offset-based: `?page=1&per-page=100`
- Max page size: 200
- Response includes `_total_count` metadata
- Response includes `_links` for navigation

### The Delta Endpoint (Game Changer)

```
GET /v2/companies/{cid}/employees/changed?since={ISO-8601-timestamp}
```

Returns only employees whose records have been modified since the given timestamp. This means:
- **No need for full-roster snapshot diffing** (unlike Paylocity)
- **Dramatically fewer API calls** — only fetch changed records, not all 100
- **Simpler sync logic** — just process the changed records
- **Caveat:** May not capture ALL field-level changes per some integration partner docs. Use periodic full syncs as safety net.

### Configuration/Lookup Endpoints (For Field Mapping)

| Endpoint | Maps To |
|---|---|
| `GET /v2/companies/{cid}/config/cost-centers` | Stores/locations |
| `GET /v2/companies/{cid}/config/cost-centers/lists` | All cost center values |
| `GET /v2/companies/{cid}/config/cost-center-jobs` | Jobs per cost center |
| `GET /v2/companies/{cid}/lookup/jobs` | Job titles/positions → roles |
| `GET /v2/companies/{cid}/lookup/employee-types` | Employee type codes |
| `GET /v2/companies/{cid}/lookup/termination-reason` | Termination reason codes |
| `GET /v2/companies/{cid}/lookup/job-change-reasons` | Transfer/promotion reason codes |
| `GET /v2/companies/{cid}/lookup/loa/reasons` | Leave of absence reasons |
| `GET /v2/companies/{cid}/lookup/groups` | Employee groups |
| `GET /v2/companies/{cid}/lookup/eins` | EIN/legal entities |
| 40+ profile lookup endpoints | Various configuration profiles |

### Data Direction
Trike is **read-only** from UKG Ready. We pull employee data; we never write back.

### Leave of Absence (Full Support)
| Endpoint | Method | Description |
|---|---|---|
| `/v2/companies/{cid}/loa/cases` | GET/POST | List/create LOA cases |
| `/v2/companies/{cid}/loa/cases/{id}` | GET/PUT/DELETE | Manage specific LOA case |
| `/v2/companies/{cid}/loa/cases/{id}/notes` | GET/POST | LOA case notes |
| `/v2/companies/{cid}/loa/requests` | GET/POST | LOA requests |
| `/v2/companies/{cid}/employees/{aid}/loa/cases` | GET | Employee-specific LOA cases |
| `/v2/companies/{cid}/employees/{aid}/loa/counters` | GET/PUT | LOA counters |

### Reporting & Export
| Endpoint | Description |
|---|---|
| `GET /v2/companies/{cid}/data-exports` | List available data exports |
| `POST /v2/companies/{cid}/data-exports/{id}/execute` | Execute a data export |
| `GET /v1/reports` | List available reports |
| `POST /v1/report/global/{id}` | Run a global report |
| Formats: XML, CSV, pipe-delimited | Export formats |

---

## Employee Status & Lifecycle

### Status Values
| Status | Description |
|---|---|
| **Active** | Currently employed |
| **Terminated/Inactive** | Employment ended (termination date set) |
| **On Leave** | Leave of absence (LOA case active) |

### Lifecycle Events & Detection

| Event | How to Detect | Key Fields |
|---|---|---|
| **New Hire** | New employee ID appears in `/employees` or `/employees/changed` | hireDate, firstName, lastName, email, costCenter |
| **Termination** | Status changes to Terminated, terminationDate populated | terminationDate, lastDayWorked, terminationStatus, eligibleForRehire |
| **Rehire** | `lastHireDate` ≠ `originalHireDate`, terminationDate cleared, status back to Active | lastHireDate, originalHireDate (compare to detect) |
| **Transfer** | Cost center or location changes on employee record | costCenter (before vs after via delta endpoint) |
| **Promotion/Demotion** | Job title or position changes | jobTitle, position (before vs after) |
| **Leave of Absence** | LOA case created, status changes to On Leave | LOA case start date, type, expected return |
| **Return from Leave** | LOA case closed, status returns to Active | LOA case return date |
| **Info Update** | Name, phone, email, address changes | Various fields in changed record |

### Rehire Handling (Critical)

| Field | Behavior |
|---|---|
| `originalHireDate` | **Never changes** — first-ever hire date, immutable |
| `lastHireDate` / `hireDate` | Updated to new rehire date |
| `terminationDate` | **Cleared** on rehire |
| `lastDayWorked` | From previous termination record |
| `eligibleForRehire` | Boolean set during termination |

**Detection logic:** If `originalHireDate` ≠ `lastHireDate` AND status is Active AND user was previously inactive in Trike → **REHIRE**. Reactivate existing user, update hire_date, clear termination_date. Do NOT create duplicate.

---

## Webhooks — Status for UKG Ready

### Uncertain Availability

UKG Webhooks is documented as a **UKG Pro Platform** feature. For UKG Ready specifically:
- Some third-party sources claim UKG Ready supports webhooks
- The official UKG Webhooks documentation consistently references "UKG Pro"
- Webhooks may be a premium add-on or still rolling out for Ready customers
- **Must ask each customer:** "Does your UKG Ready plan include UKG Webhooks?"

### If Webhooks ARE Available
Same system as UKG Pro:
- HMAC authentication (24-char minimum secret)
- Event types: employee.created, employee.updated, employee.terminated
- Thin payloads (event type + IDs) — require follow-up API call
- Free tier: 10,000 events/month
- 14-day event retention
- UKG warns about missed events — polling fallback mandatory

### If Webhooks Are NOT Available (More Likely)
The delta endpoint (`/employees/changed`) makes this completely workable:
- Poll every 2-5 minutes using the changed endpoint
- Only fetches modified records (not full roster)
- Efficient at any scale
- Reliable — no dependency on webhook infrastructure

**Bottom line:** Design for polling-first using the delta endpoint. Webhooks are a nice-to-have optimization, not a requirement.

---

## Rate Limits

| Detail | Value |
|---|---|
| Limit | ~1,000 API calls per minute (approximate, varies by tenant) |
| Throttle response | HTTP 503 Service Unavailable |
| Retry header | `X-CallLimit-TimeToWait` (tells you exactly how long to wait) |
| Recommended delay | 250ms between sequential calls |
| Backoff | Exponential on 503 responses |

**For Trike's scale:** Syncing 100 employees with the delta endpoint typically means 1-10 API calls (only changed records). Full roster sync = ~100 calls (well under 1,000/min limit).

---

## API Access — Customer-Owned, No UKG Approval Needed

### What the Customer Does

1. **Create a Service Account:**
   - Create a "Not in Payroll" employee record for API use
   - Navigate to: Company Settings > Global Setup > Login Config > API Keys
   - Click GENERATE to create an API Key
   - Create a custom Security Profile with REST API resource permissions:
     - HR Tab: Employee and Base Compensation (View)
     - Modules Tab: REST API Resources — Employee Demographics, Profiles, Employees
   - Assign the security profile to the service account

2. **Provide to Trike:**
   - Base URL (e.g., `https://secure4.saashr.com/ta/rest/`)
   - Company Short Name (7-digit number)
   - Service account username + password
   - API Key

3. **If Webhooks available:**
   - Customer creates webhook subscription in UKG pointing to Trike's endpoint
   - Configures HMAC secret

**No UKG partner agreement needed. No approval process. Customer controls access entirely.**

### Optional: UKG Ready Partner Network
- Separate from UKG Pro partner program
- Primarily for resellers (private-label model)
- Technology partners get API access through Developer Hub
- Not required for integration — customer-owned path works Day 1

---

## Architecture: Delta Polling + Optional Webhooks

```
PRIMARY PATH (delta polling, every 2-5 min):
  pg_cron → Edge Function /hris/sync
  → Login (token auth) → GET /employees/changed?since={last_sync_time}
  → Process each changed employee → Apply to users table
  → Update last_sync_time

FULL RECONCILIATION (every 4-6 hours):
  pg_cron → Edge Function /hris/sync?full=true
  → GET /employees (full roster, paginated)
  → Compare against users table → Catch anything delta missed

OPTIONAL WEBHOOK PATH (if available):
  UKG Ready → Webhook POST → Edge Function /hris/webhook/ukg-ready
  → Validate HMAC → Follow-up API call for full data → Apply to users table

MANUAL PATH (zero-wait):
  "Sync Now" button → Immediate full roster fetch + diff
  "Quick Add" button → Provisional user, enriched by next sync
```

### Why Delta Polling Is Better Than Paylocity's Architecture

| Aspect | Paylocity | UKG Ready |
|---|---|---|
| Finding changes | Fetch ALL employees every time, snapshot diff locally | `GET /employees/changed` returns only modified records |
| API calls per sync | 1 large paginated call (all employees) | 1 call for changed IDs + N calls for changed details |
| Storage overhead | Must store full snapshot of every employee | Only need last_sync_timestamp |
| Complexity | Snapshot hash + diff engine | Simple: fetch changed, process each |

### Event Flow Detail

**Delta Sync (Every 2-5 Minutes):**
1. `POST /v1/login` → get bearer token (or use cached token if <1 hour old)
2. `GET /v2/companies/{cid}/employees/changed?since={last_sync_timestamp}`
3. For each changed employee:
   a. `GET /v2/companies/{cid}/employees/{aid}` → full current record
   b. Compare against Trike's `users` table record
   c. Classify change:
      - New employee ID not in users → **NEW HIRE** → create user, notify manager
      - Status changed to Terminated → **TERMINATION** → deactivate, set termination_date, revoke auth
      - `lastHireDate` ≠ `originalHireDate` + status Active + was inactive → **REHIRE** → reactivate existing user
      - Cost center changed → **TRANSFER** → update store_id, notify both managers
      - Job title changed → **PROMOTION/DEMOTION** → update role_id if mapped
      - LOA case active → **LEAVE** → set status='on-leave'
      - Contact fields changed → **INFO UPDATE** → update user fields
   d. Log event to `hris_sync_log`
4. Update `last_synced_at` on `hris_connections`

**Full Reconciliation (Every 4-6 Hours):**
1. `GET /v2/companies/{cid}/employees?page=1&per-page=200` (paginate through all)
2. Compare full roster against `users` table
3. Catch: employees added/removed between delta polls, any drift
4. Log results

---

## Database Schema (Extends Shared HRIS Tables)

The `hris_connections`, `hris_sync_log`, and `users` additions from the Paylocity scope apply here too. UKG Ready-specific field_mapping:

```json
{
  "provider": "ukg_ready",
  "auth_type": "token",
  "base_url": "https://secure4.saashr.com/ta/rest/",
  "company_short_name": "1234567",
  "costCenter_to_store": {"CC001 - Downtown": "uuid-of-store", "CC002 - Airport": "uuid-of-store"},
  "job_to_role": {"Store Manager": "uuid-of-role", "Team Member": "uuid-of-role"},
  "status_mapping": {"Active": "active", "Terminated": "inactive", "On Leave": "on-leave"}
}
```

**UKG Ready simplification:** The `hris_sync_snapshots` table is **optional** for UKG Ready. The delta endpoint eliminates the need for full snapshot storage. You only need `last_synced_at` on `hris_connections` to track the delta cursor. Keep the snapshots table for the full reconciliation safety net.

---

## UKG Ready vs Paylocity — Side by Side

| Dimension | Paylocity | UKG Ready |
|---|---|---|
| **Auth** | OAuth 2.0 CC (single header) | Token login (API Key header + Bearer token) |
| **Finding changes** | No delta endpoint — must fetch all + diff | **`/employees/changed` delta endpoint** |
| **Employee fetch** | Single paginated call returns all data | Paginated list + per-employee detail (but delta means fewer calls) |
| **Webhook availability** | Yes (5 event types, Paylocity configures) | **Uncertain for Ready** — may not be available |
| **Webhook payloads** | New Hire: 28 fields (rich) | Thin (if available) — always need follow-up call |
| **Rehire detection** | RehireDate field in change webhook | `originalHireDate` vs `lastHireDate` comparison |
| **Org hierarchy** | 3 cost centers (flexible meaning) | Cost centers + departments + locations (more structured) |
| **Rate limits** | 25 req/s (published) | ~1,000/min (approximate), 503 with `X-CallLimit-TimeToWait` |
| **Base URL** | Fixed per environment | **Varies per customer** (`secure{N}.saashr.com`) |
| **Webhook setup** | Customer emails support@paylocity | Customer self-serves via UI (if available) |
| **API key management** | OAuth client_id/secret, 365-day rotation | API Key generated in admin, no documented rotation policy |
| **Status codes** | A/T/D/R/L/XT + custom | Active/Terminated/On Leave |
| **LOA tracking** | Time Off Approval webhook (limited) | **Full LOA case management endpoints** |

### Architecture Implications

| Component | Paylocity Adapter | UKG Ready Adapter |
|---|---|---|
| Primary sync method | Webhook-first + polling fallback | **Delta polling-first** + optional webhooks |
| Change detection | Full roster fetch → snapshot hash → diff | `GET /employees/changed` → process each |
| Snapshot storage | Required (full employee snapshots) | Optional (only for reconciliation) |
| Follow-up calls per event | Only for Employee Change webhook | For every event (if using webhooks) |
| Rehire detection | Check RehireDate field | Compare originalHireDate vs lastHireDate |
| Token management | OAuth CC (1-hour token, no refresh) | Login token (1-hour, refresh endpoint available) |

---

## Pros

| | |
|---|---|
| **Delta endpoint** | `GET /employees/changed` eliminates full-roster polling — dramatically more efficient than Paylocity |
| **Simpler auth** | Token login with API Key header — no OAuth dance, no client_id/secret rotation |
| **No UKG approval needed** | Customer creates service account + API key in admin panel. Day 1 access. |
| **Full LOA support** | LOA case management endpoints — can track leaves properly (Paylocity only has Time Off Approval) |
| **Rich employee data** | Demographics, pay info, contacts, custom fields, credentials, certifications all accessible |
| **Self-service webhook setup** | If webhooks available, customer configures via UI (no emailing support) |
| **Token refresh** | Refresh endpoint available — don't need to re-login |
| **50+ lookup endpoints** | Extensive reference data for mapping UI — cost centers, jobs, employee types, termination reasons |
| **Manageable rate limits** | ~1,000/min with explicit `X-CallLimit-TimeToWait` header (better than UKG Pro's mystery limits) |
| **Rehire tracking built in** | originalHireDate vs lastHireDate makes rehire detection deterministic |

## Cons / Risks

| | |
|---|---|
| **Webhooks may not be available** | UKG Webhooks is primarily a Pro Platform feature. Ready customers may not have access. Design for polling. |
| **Base URL varies per customer** | Must ask each customer for their specific `secure{N}.saashr.com` instance — can't hardcode |
| **Delta endpoint caveats** | Some integration partners warn it may not capture ALL field-level changes — need periodic full sync as safety net |
| **Service account setup** | Customer must create a specific account with correct Security Profile — more setup steps than Paylocity |
| **API key invalidation** | Generating a new API key invalidates the previous one — potential for accidental breakage |
| **Per-employee detail calls** | Even with delta endpoint, each changed employee needs a follow-up call for full data |
| **Less ecosystem documentation** | UKG Ready API has fewer third-party guides than Paylocity or UKG Pro |
| **No company-specific OpenAPI** | Unlike Paylocity, no endpoint to discover a company's specific field requirements |

---

## Provider Adapter

```typescript
class UKGReadyAdapter implements HRISProvider {
  name = 'ukg_ready';

  async authenticate(credentials: {
    baseUrl: string;
    apiKey: string;
    username: string;
    password: string;
    companyShortName: string;
  }): Promise<string> {
    // POST /v1/login with credentials + Api-Key header
    // Cache token for ~55 minutes, refresh before expiry
  }

  async fetchEmployees(token: string, companyId: string, page: number, pageSize: number) {
    // GET /v2/companies/{cid}/employees?page={page}&per-page={pageSize}
    // Returns full employee records (no two-call problem for list)
  }

  async fetchChangedEmployees(token: string, companyId: string, since: string) {
    // GET /v2/companies/{cid}/employees/changed?since={ISO-timestamp}
    // Returns only modified employee records
  }

  async fetchEmployee(token: string, companyId: string, employeeId: string) {
    // GET /v2/companies/{cid}/employees/{aid}
    // + GET /v2/companies/{cid}/employees/{aid}/pay-info for cost center/job
    // + GET /v2/companies/{cid}/employees/{aid}/demographics if needed
  }

  async fetchLookupValues(token: string, companyId: string) {
    // GET /v2/companies/{cid}/config/cost-centers/lists → stores
    // GET /v2/companies/{cid}/lookup/jobs → roles
    // GET /v2/companies/{cid}/lookup/employee-types
    // GET /v2/companies/{cid}/lookup/termination-reason
  }

  parseWebhookEvent(payload: any) {
    // If webhooks available: thin payload → extract eventType + employeeId
    // If not: this method is unused (delta polling handles everything)
  }

  mapToUser(employee: any, fieldMapping: any): Partial<CreateUserInput> {
    // Map UKG Ready fields → Trike CreateUserInput
    // employee.firstName → first_name
    // employee.lastName → last_name
    // employee.workEmail → email
    // employee.mobilePhone → mobile_phone
    // employee.hireDate → hire_date
    // employee.costCenter → store_id (via fieldMapping lookup)
    // employee.jobTitle → role_id (via fieldMapping lookup)
    // employee.employeeNumber → employee_id
    // employee.employmentStatus → status mapping
  }

  detectRehire(employee: any, existingUser: any): boolean {
    // originalHireDate !== lastHireDate AND status is Active AND existingUser was inactive
    return employee.originalHireDate !== employee.lastHireDate
      && employee.employmentStatus === 'Active'
      && existingUser?.status === 'inactive';
  }
}
```

---

## Implementation (Fits Existing Phased Plan)

### UKG Ready Adapter (1-2 weeks after core sync engine exists)
- Token auth (login + refresh + API key header)
- Delta sync via `/employees/changed` endpoint
- Full roster reconciliation (periodic safety net)
- Cost center + job lookup for mapping UI
- Rehire detection (originalHireDate vs lastHireDate)
- Rate limit handling (503 + X-CallLimit-TimeToWait backoff)
- LOA case tracking (if needed)

### Admin UI Extensions
- Provider selector: Paylocity / UKG Ready
- UKG Ready-specific: base URL input (varies per customer)
- Cost center mapping (from lookup endpoint)
- Job → role mapping (from lookup endpoint)
- Delta sync interval config (default 3 min)
- Full reconciliation interval config (default 4 hours)

---

## Verification Plan

1. **Mock delta endpoint** — Return sample changed employees → verify correct classification (new hire, termination, transfer, rehire)
2. **Token auth flow** — Login → use token → refresh before expiry → verify API calls succeed
3. **New hire detection** — New employee ID in changed endpoint → user created → store manager notified
4. **Termination detection** — Status changed to Terminated in changed endpoint → user deactivated → auth revoked
5. **Rehire detection** — originalHireDate ≠ lastHireDate, status Active, was inactive → user reactivated (NOT duplicated)
6. **Transfer detection** — Cost center changed → store_id updated → both managers notified
7. **Full reconciliation** — Verify periodic full sync catches anything delta missed
8. **Rate limit handling** — Simulate 503 with X-CallLimit-TimeToWait → verify backoff works
9. **Sync Now** — Button click → immediate delta fetch + apply
10. **LOA handling** — LOA case created → user status set to 'on-leave'

---

## Immediate Action Items (For a UKG Ready Customer)

1. **Ask customer: "Do you use UKG Pro or UKG Ready?"** — The APIs are completely different
2. **Get customer's instance URL** — Which `secure{N}.saashr.com` are they on?
3. **Get customer's Company Short Name** — 7-digit number from their login URL
4. **Customer creates Service Account:**
   - "Not in Payroll" employee record
   - Custom Security Profile with REST API resource permissions
   - "All Company Employees" group access
5. **Customer generates API Key** — Company Settings > Global Setup > Login Config > API Keys
6. **Customer provides to Trike:** Base URL, Company Short Name, username, password, API Key
7. **Ask about webhooks:** "Does your UKG Ready plan include UKG Webhooks?" — determines if we can add real-time events on top of delta polling
8. **Get customer's cost center structure** — What cost centers map to which stores? What jobs map to which roles?
