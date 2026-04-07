# Scope: Direct HRIS Sync Engine — BambooHR

## Context

BambooHR is the most developer-friendly HRIS on this list. It has **real-time webhooks**, a **delta endpoint**, a **reports API**, **self-service API key generation**, and comprehensive documentation. This is the easiest provider to integrate with.

---

## BambooHR API — Complete Capabilities

### Authentication

**Two options:**

**API Key (quickest for pilot):**
- Customer generates key in BambooHR: click their name > API Keys
- 160-bit hex value
- Used as HTTP Basic Auth username with `x` as password
- Key inherits the creating user's permissions (must be admin for full access)
- Repeated invalid key attempts trigger temporary lockout (403)

**OAuth 2.0 (required for scale/marketplace):**
- Register at `developers.bamboohr.com` (self-registration since April 2025)
- Authorization code flow
- Access tokens expire in 3600 seconds
- Refresh tokens require `offline_access` scope
- Required for multi-customer integrations

**Base URL:** `https://api.bamboohr.com/api/gateway.php/{companyDomain}/v1/`

### Employee Data (Read)

| Endpoint | Description | Notes |
|---|---|---|
| `GET /employees/directory` | Full company directory | Active employees only, no pagination, returns all at once |
| `GET /employees/{id}?fields=...` | Single employee with specified fields | Max 400 fields per request |
| `GET /employees` | Paginated employee list (NEW Oct 2025) | Cursor-based, filtering, sorting |
| `GET /employees/changed?since={timestamp}` | **Delta endpoint** — changed employee IDs since timestamp | Returns map of IDs + change types |
| `GET /employees/changed/tables/{table}?since={timestamp}` | Changed table data since timestamp | Returns complete table rows for changed employees |
| `GET /employees/{id}/tables/{table}` | Historical table data for an employee | jobInfo, employmentStatus, compensation, etc. |
| `POST /reports/custom` | Run custom report with specified fields/filters | JSON, CSV, XLS, PDF output. Max 400 fields. |
| `GET /meta/fields` | All available fields (standard + custom) | IDs, types, aliases — essential for mapping UI |
| `GET /meta/tables` | All table definitions | Structure of historical tables |
| `GET /meta/lists/{listFieldId}` | List field options | Department, location, division values |

### Employee Fields

**Identity/Contact:** id, employeeNumber, firstName, lastName, preferredName, displayName, workEmail, homeEmail, mobilePhone, workPhone, address (street, city, state, zip, country)

**Employment:** hireDate, originalHireDate, status (Active/Inactive), employmentHistoryStatus (Full-Time/Part-Time/Contractor/Terminated/etc.), terminationDate, department, division, location, jobTitle, reportsTo, supervisor, supervisorEId

**Compensation:** payType, payRate, exempt, standardHoursPerWeek

**Custom fields:** Discovered via `/meta/fields`, referenced by alias (e.g., `customPaylocityId`). Admin-created.

### Delta Endpoint (Critical)

```
GET /api/v1/employees/changed?since=2026-04-05T00:00:00Z&type=all
```

Returns a map of employee IDs that changed since the timestamp:
```json
{
  "employees": {
    "123": { "action": "Updated", "lastChanged": "2026-04-06T10:30:00+00:00" },
    "456": { "action": "Inserted", "lastChanged": "2026-04-06T09:15:00+00:00" },
    "789": { "action": "Deleted", "lastChanged": "2026-04-06T08:00:00+00:00" }
  },
  "latest": "2026-04-06T10:30:00+00:00"
}
```

- `type` param: `inserted`, `updated`, `deleted`, or `all`
- `latest` timestamp: use for next poll
- History available since June 5, 2011
- ANY field change on the employee triggers inclusion

### Table Change Detection

```
GET /api/v1/employees/changed/tables/jobInfo?since=2026-04-05T00:00:00Z
```

Returns complete table rows for changed employees. A change in ANY field causes ALL rows for that employee to be returned — you get complete state, not just the changed field.

**Key tables:**
- `jobInfo` — date, location, department, division, jobTitle, reportsTo (historical)
- `employmentStatus` — date, employmentStatus, terminationReasonId, terminationTypeId, terminationRehireId
- `compensation` — date, rate, type, reason, comment

---

## Webhooks — Real-Time Events

BambooHR webhooks were **upgraded to real-time event-driven in August 2025** (previously cron-based).

### Available Events
| Event | Fires When |
|---|---|
| `employee_with_fields.created` | New employee record added |
| `employee_with_fields.updated` | Employee data changed |
| `employee_with_fields.deleted` | Employee removed |

### Webhook Payload (Rich — Includes Changed Fields)

```json
{
  "employees": [
    {
      "id": "123",
      "changedFields": ["firstName", "department"],
      "fields": {
        "firstName": "John",
        "department": "Operations"
      }
    }
  ]
}
```

**Key advantage:** The payload includes **both what changed AND the new values**. Unlike Paylocity's Employee Change webhook (just IDs) or UKG's thin notifications, BambooHR tells you exactly what changed without a follow-up API call.

### Monitorable Fields
Standard fields: firstName, lastName, hireDate, terminationDate, status, employmentHistoryStatus, department, division, location, jobTitle, reportsTo, workEmail, mobilePhone, payRate, payType, address, employeeNumber, and more. **Custom fields supported** (since September 2025). Custom table fields are NOT supported.

### Webhook Security
- HTTPS-only delivery URLs
- **HMAC-SHA256** signature in `X-BambooHR-Signature` header
- Timestamp in `X-BambooHR-Timestamp` header
- Private key returned **only at webhook creation time** — must store immediately

### Retry Policy
Up to 5 retries: immediately, 5 min, 10 min, 20 min, 40 min (with 0-30s jitter). Retries on network errors or 5xx only.

### Batching
Multiple employee changes in a short period may be batched into a single POST.

### Creating a Webhook (Self-Service via API)

```json
POST /api/v1/webhooks
{
  "name": "Trike Employee Sync",
  "url": "https://your-edge-function.supabase.co/hris/webhook/bamboohr",
  "format": "json",
  "monitorFields": [
    "firstName", "lastName", "hireDate", "originalHireDate", "status",
    "employmentHistoryStatus", "terminationDate", "department", "division",
    "location", "jobTitle", "reportsTo", "workEmail", "mobilePhone",
    "employeeNumber"
  ],
  "postFields": {
    "firstName": "firstName",
    "lastName": "lastName",
    "hireDate": "hireDate",
    "status": "status",
    "department": "department",
    "location": "location",
    "jobTitle": "jobTitle",
    "workEmail": "workEmail",
    "mobilePhone": "mobilePhone",
    "employeeNumber": "employeeNumber"
  },
  "events": [
    "employee_with_fields.created",
    "employee_with_fields.updated",
    "employee_with_fields.deleted"
  ],
  "includeCompanyDomain": true
}
```

**Trike creates the webhook programmatically via API** — no customer action needed beyond providing the API key.

---

## Employee Status & Lifecycle

### Status Field
- `Active` — Currently employed
- `Inactive` — Terminated/separated

### Employment Status (Historical Table)
- Full-Time, Part-Time, Contractor, Furloughed, Terminated
- Custom values possible (organization-defined)

### Termination Details
| Field | Description |
|---|---|
| `terminationDate` | Last day of employment |
| `terminationTypeId` | Death, Resignation (Voluntary), Termination (Involuntary) |
| `terminationReasonId` | Attendance, End of Season, Performance, Relocation, etc. |
| `terminationRehireId` | Yes, No, Upon review |
| `terminationRegrettableId` | Regrettable, Non-Regrettable |

### Rehire Handling

**Same immutable employee ID.** BambooHR assigns each employee a permanent, company-unique ID. On rehire:
- Same ID persists
- New row added to `employmentStatus` table with rehire date
- `status` flips from `Inactive` to `Active`
- `originalHireDate` stays the same
- Can detect by: `originalHireDate` ≠ `hireDate`, or status change Inactive → Active, or new employmentStatus table entry

**For Trike:** Match by BambooHR employee ID. If found and inactive → reactivate. Do NOT create duplicate.

### Org Structure

| BambooHR Field | Type | Maps To (Trike) |
|---|---|---|
| `location` | List field | `stores` |
| `department` | List field | `districts` or functional area (per customer) |
| `division` | List field | `organizations` or `districts` (per customer) |
| `jobTitle` | Text field | `roles` (via mapping table) |
| `reportsTo` | Employee reference | Manager hierarchy |

All tracked historically in `jobInfo` table with effective dates.

### Custom Fields
- Admin-created in BambooHR UI
- Auto-generated alias: `customFieldName` (e.g., `customFavoriteFood`)
- Discovered via `GET /meta/fields` — returns all fields with IDs, types, aliases
- Custom fields can be monitored by webhooks
- Custom table fields NOT supported by webhooks

---

## Rate Limits

BambooHR **intentionally does not publish exact limits.**
- Community estimate: ~100 requests/minute per API key
- HTTP 429 when throttled
- HTTP 503 when gateway overwhelmed
- `Retry-After` header may or may not be present
- Must implement exponential backoff with jitter
- Sending credentials preemptively (not waiting for 401) saves rate budget

For Trike's scale (80-100 employees): webhooks handle real-time, delta endpoint handles fallback polling. Rarely will you hit rate limits.

---

## Access Path — Simplest of All Providers

### What the Customer Does

1. Log into BambooHR
2. Click their name (lower left) > API Keys
3. Generate an API key
4. Give the key to Trike

**That's it.** No partner program, no ADP-style SOW, no Paylocity email to support, no UKG admin panel configuration. Just generate a key and share it.

### What Trike Does Programmatically

1. Use the API key to create a webhook subscription (via API — no customer action needed)
2. Start receiving real-time events
3. Set up delta polling as fallback
4. Fetch `GET /meta/fields` to discover all available fields (including custom)
5. Fetch `GET /meta/lists/{id}` to get department/location/division values for mapping UI

### Optional: OAuth 2.0 for Scale
- Register at `developers.bamboohr.com`
- Create application with scopes and redirect URI
- Customer authorizes via OAuth flow
- Required for marketplace listing, not for single-customer pilot

---

## Architecture: Webhook-First + Delta Polling

```
REAL-TIME PATH (webhooks):
  BambooHR → Webhook POST → Edge Function /hris/webhook/bamboohr
  → Validate HMAC-SHA256 → Parse rich payload (includes changed fields + values)
  → Apply to users table → Notify store manager
  (NO follow-up API call needed — payload has the data)

DELTA POLLING FALLBACK (every 5-10 min):
  pg_cron → Edge Function /hris/sync
  → GET /employees/changed?since={last_timestamp}
  → For each changed ID: GET /employees/{id}?fields=... for full record
  → Apply changes → Update timestamp

FULL RECONCILIATION (every 4-6 hours):
  pg_cron → GET /employees (cursor-paginated) or POST /reports/custom
  → Compare against users table → Catch anything missed

MANUAL PATH:
  "Sync Now" → Immediate delta fetch + apply
```

### Event Flow

**Webhook Received (employee_with_fields.created):**
1. Validate HMAC-SHA256 signature
2. Parse payload — already contains new employee's fields (name, email, department, location, etc.)
3. Look up org by companyDomain in `hris_connections`
4. Map `location` → `store_id`, `jobTitle` → `role_id`
5. Create user in `users` table
6. Log event, notify store manager
7. **No follow-up API call needed** (payload is rich enough)

**Webhook Received (employee_with_fields.updated):**
1. Validate HMAC
2. Check `changedFields` array to classify:
   - `status` changed to Inactive → **TERMINATION** → deactivate user
   - `status` changed to Active + was previously inactive → **REHIRE** → reactivate user
   - `location` changed → **TRANSFER** → update store_id
   - `department` changed → **TRANSFER** → update district if mapped
   - `jobTitle` changed → **PROMOTION/DEMOTION** → update role_id
   - `employmentHistoryStatus` changed → **STATUS CHANGE** (furlough, LOA, etc.)
   - Contact fields changed → **INFO UPDATE**
3. Apply changes, log, notify relevant managers

**Delta Polling Fallback:**
1. `GET /employees/changed?since={last_timestamp}`
2. For each changed employee ID:
   - `GET /employees/{id}?fields=firstName,lastName,status,hireDate,terminationDate,department,location,jobTitle,workEmail,mobilePhone,employeeNumber`
   - Optionally: `GET /employees/{id}/tables/employmentStatus` for termination/rehire details
   - `GET /employees/{id}/tables/jobInfo` for transfer/promotion history
3. Compare against Trike's current record, classify and apply changes

---

## BambooHR vs Other Providers

| Dimension | BambooHR | Paylocity | UKG Ready | ADP WFN |
|---|---|---|---|---|
| **Webhook payloads** | **Rich** (changed fields + values) | New Hire: 28 fields; Change: IDs only | Thin (if available) | SFTP only (no webhooks for standard) |
| **Follow-up call needed** | **Usually no** | Yes (for change events) | Yes (always) | N/A (file-based) |
| **Delta endpoint** | **Yes** (`/employees/changed`) | No | Yes (`/employees/changed`) | No |
| **Webhook setup** | **Programmatic via API** | Customer emails support | Customer via UI (if available) | N/A |
| **API key generation** | **Customer self-service, instant** | OAuth via partner program | Service account + admin config | mTLS certs + OAuth or SFTP SOW |
| **Rehire detection** | Same ID, status flip + employmentStatus table | RehireDate field | originalHireDate vs lastHireDate | Rehire Date in CSV |
| **Rate limits** | ~100/min (unpublished) | 25/sec | ~1,000/min | 300/min (default tier) |
| **Custom fields in webhooks** | **Yes** (since Sept 2025) | No | Unknown | N/A |
| **Documentation quality** | **Excellent** (public, comprehensive) | Good (some JS-rendered pages) | Mixed (some gated) | Complex (mTLS adds friction) |

---

## Pros

| | |
|---|---|
| **Most developer-friendly** | Best docs, simplest auth, richest webhooks, programmatic webhook setup |
| **Rich webhook payloads** | Changed fields + new values included — usually no follow-up API call needed |
| **Delta endpoint** | `/employees/changed` for efficient polling fallback |
| **Instant API access** | Customer generates API key in 30 seconds. No partner program, no SOW, no approval. |
| **Programmatic webhook creation** | Trike creates webhooks via API — zero customer action for event subscription |
| **Custom fields in webhooks** | Can monitor and receive custom field changes (since Sept 2025) |
| **Field discovery API** | `GET /meta/fields` returns all fields (including custom) for dynamic mapping UI |
| **Same employee ID on rehire** | Immutable IDs make rehire detection trivial |

## Cons / Risks

| | |
|---|---|
| **SMB-focused** | BambooHR targets small-mid companies. Larger enterprises less likely to use it. |
| **Rate limits unpublished** | Must discover through throttling. ~100/min estimated. |
| **Custom TABLE fields not in webhooks** | Only standard table fields and custom employee fields. Historical table changes need polling. |
| **API key = user permissions** | Key inherits the creating user's access. If that user's permissions change, integration breaks. |
| **Webhook private key** | Only shown at creation time — if lost, must delete and recreate webhook |
| **Max 400 fields per request** | If you need more, multiple requests required |
| **5 retry maximum** | Less aggressive than Paylocity's 24-hour retry window |

---

## Provider Adapter

```typescript
class BambooHRAdapter implements HRISProvider {
  name = 'bamboohr';

  async authenticate(credentials: { apiKey: string; companyDomain: string }) {
    // Basic Auth: apiKey as username, 'x' as password
    // No token exchange needed — key is used directly
  }

  async fetchEmployees(token: string, companyId: string, page: number, pageSize: number) {
    // GET /employees with cursor pagination (new endpoint)
    // OR POST /reports/custom for specific field sets
  }

  async fetchChangedEmployees(token: string, companyId: string, since: string) {
    // GET /employees/changed?since={timestamp}
    // Returns map of changed employee IDs + types
  }

  async fetchEmployee(token: string, companyId: string, employeeId: string) {
    // GET /employees/{id}?fields=firstName,lastName,...
    // Optionally: GET /employees/{id}/tables/jobInfo
    // Optionally: GET /employees/{id}/tables/employmentStatus
  }

  async fetchLookupValues(token: string, companyId: string) {
    // GET /meta/fields — all fields including custom
    // GET /meta/lists/{id} — department, location, division values
  }

  async createWebhook(token: string, companyDomain: string, endpointUrl: string) {
    // POST /webhooks — creates subscription, returns private key for HMAC
    // Store private key securely — only shown once
  }

  parseWebhookEvent(payload: any) {
    // Rich payload — extract event type, changedFields, and field values
    // Usually no follow-up call needed
  }

  mapToUser(employee: any, fieldMapping: any): Partial<CreateUserInput> {
    // Map BambooHR fields → Trike CreateUserInput
    // location → store_id (via mapping)
    // jobTitle → role_id (via mapping)
    // employeeNumber → employee_id
  }
}
```

---

## Verification Plan

1. **Webhook creation** — Programmatically create webhook, verify HMAC secret returned
2. **New hire webhook** — employee_with_fields.created → verify user created from payload (no follow-up call)
3. **Termination webhook** — status changed to Inactive → user deactivated
4. **Rehire detection** — status Inactive → Active on existing employee → reactivate (not duplicate)
5. **Transfer webhook** — location/department changed → store_id/district updated
6. **Delta polling** — `/employees/changed` returns correct IDs, detail fetch works
7. **Full reconciliation** — Paginated employee list catches missed changes
8. **HMAC validation** — Verify signature checking with stored private key
9. **Custom field monitoring** — Add custom field to webhook, verify it appears in payload

---

## Immediate Action Items (For a BambooHR Customer)

1. **Customer generates API key** — Click their name > API Keys. Takes 30 seconds.
2. **Customer provides:** API key + company domain (subdomain before `.bamboohr.com`)
3. **Trike creates webhook** programmatically via API — customer doesn't need to do anything
4. **Get customer's org structure** — What do location/department/division mean for their business?
5. **Fetch field metadata** — `GET /meta/fields` to discover custom fields for mapping UI
