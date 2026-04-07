# Scope: Direct HRIS Sync Engine — SAP SuccessFactors

## Context

SAP SuccessFactors is the enterprise-grade HRIS. It's the most complex provider to integrate with — OData v2 APIs, SAML-based OAuth, effective-dated entity model, and SAP's Intelligent Services for event-driven integration. This is for larger enterprise customers. The complexity is significantly higher than Paylocity, UKG Ready, or BambooHR.

---

## SuccessFactors API — Complete Capabilities

### Authentication — Most Complex of All Providers

**OAuth 2.0 with SAML Bearer Assertion** (Basic Auth deprecated as of November 2026):

1. Customer admin registers OAuth client in Admin Center > Manage OAuth2 Client Applications
2. Generate X.509 certificate (private key + cert pair)
3. Map certificate to API user in Admin Center
4. Create SAML assertion offline (signed with private key) — SAP provides an Offline SAML Assertion Generator tool
5. Exchange SAML assertion for OAuth access token at token endpoint
6. Call API with Bearer token + appropriate permissions

**Key complexity:** The API user must hold explicit **Role-Based Permission** grants for each entity. Permissions are granular — read access to `EmpJob` doesn't automatically give you `PerPhone`.

**Data center matters:** API host varies by DC (e.g., `api4.successfactors.com`, `api2.successfactors.eu`, `api15.sapsf.cn`). Customer must tell you which data center they're on.

### Employee Data — OData v2

SuccessFactors uses an **entity-based OData v2 model**. Employee data is spread across multiple entities that must be queried separately or navigated via `$expand`.

**Two tiers of API access:**

**Tier 1 — Standard User entity (all editions):**
- `GET /odata/v2/User` — basic profile: userId, firstName, lastName, email, status, department, manager, hireDate, custom01-custom15
- Sufficient for basic sync if customer doesn't have Employee Central

**Tier 2 — Employee Central entities (EC add-on required):**

| Entity | Description | Effective-Dated |
|---|---|---|
| `PerPerson` | Core person record (DOB) | No |
| `PerPersonal` | Name, gender, marital status | Yes |
| `PerPhone` | Phone numbers | Yes |
| `PerEmail` | Email addresses | Yes |
| `PerAddress` | Physical addresses | Yes |
| `PerNationalId` | SSN, tax IDs | Yes |
| `EmpEmployment` | Employment record (start date, userId) | No |
| `EmpJob` | Job info (dept, location, business unit, position, manager, event, event reason) | Yes |
| `EmpCompensation` | Pay/salary | Yes |
| `EmpEmploymentTermination` | Termination details | No |
| `EmpJobRelationships` | Dotted-line managers | Yes |

**"Effective-dated"** means these entities maintain historical records. Each record has `startDate`, `endDate`, and `sequenceNumber`. The current record is the one where today falls within the date range.

**Foundation Objects** (org structure, available in all editions):
- `FOCompany`, `FOBusinessUnit`, `FODivision`, `FODepartment`
- `FOLocation`, `FOCostCenter`, `FOJobCode`, `FOJobFunction`
- `FOPayGrade`, `FOPayGroup`, `FOEventReason`

### Delta/Change Detection

**Yes, via `lastModifiedDateTime` filtering:**

```
GET /odata/v2/EmpJob?$filter=lastModifiedDateTime gt datetime'2026-04-05T00:00:00'
```

**Caveats:**
- Each entity has independent `lastModifiedDateTime` — must query each entity separately
- Effective-dated entities: a modification to ANY historical slice triggers the record, even if current state didn't change
- `datetime` vs `datetimeoffset` types behave differently — must match types
- Best practice: maintain high-water mark timestamp per entity

**Compound Employee API (SOAP):** Has a dedicated Delta mode that returns only data created/changed/deleted since last replication. More reliable for comprehensive delta sync but uses SOAP/XML (heavier).

### Pagination
- `$top` (page size, max **1000**) + `$skip` (offset)
- Default page size: 20
- Server-side snapshot pagination available via `$skiptoken`
- Auto-pagination kicks in above 1000 records

---

## Event-Driven Integration — Intelligent Services

**SuccessFactors does NOT have traditional webhooks.** It uses the **Intelligent Services Center (ISC)** to publish events.

### How It Works
1. Configure event subscription in the **Integration Center**
2. Select REST destination with JSON format
3. Point to your endpoint URL
4. SuccessFactors sends HTTP POST with event payload when triggered
5. Payloads signed with **HMAC-SHA256** (verify via `x-sf-signature` header)

### Available Standard Events (~25 predelivered)

| Category | Events |
|---|---|
| **Hiring** | Hire, Rehire |
| **Separation** | Termination |
| **Movement** | Transfer, Promotion, Demotion, Job Reclassification, Position Change |
| **Leave** | Leave of Absence, Return to Work, Return from Disability |
| **Compensation** | Pay Rate Change |
| **Status** | Furlough, Suspension, Probation, Completion of Probation |
| **Personal** | Data Change |
| **Assignments** | Add/End Global Assignment, Additional Job, Assignment Completion |

**Cannot create custom events** — only standard predelivered events. But unlimited custom **Event Reasons** per event type.

### SAP Advanced Event Mesh (Optional)
For more sophisticated routing, SuccessFactors can publish events to SAP Event Mesh (BTP service), which distributes to multiple consumers via queues/topics/webhooks. Requires SAP BTP subscription — adds cost and complexity.

---

## Rate Limits

| Limit | Value |
|---|---|
| OData API | Recommended <**40 requests/second** |
| SFAPI (SOAP) | Recommended <**20 requests/second** |
| Max concurrent threads | **10** per client |
| Page size | Max **1000** records |
| Throttle response | HTTP **429** with `Retry-After: 300` (5 minutes) |
| Also possible | HTTP 503 under load |
| Compound Employee delta | Don't call more frequently than **every 15 minutes** |

Tenant-level concurrency limits exist but are not publicly documented and vary by DC and contract.

---

## Employee Status & Lifecycle

### Status Values
- `active`, `inactive`, `suspended` (on User entity)

### Employee Central Events
Hire, Rehire, Termination, Transfer, Promotion, Demotion, Job Reclassification, Leave of Absence, Return to Work, Pay Rate Change, Position Change, Data Change, Furlough, Suspension, Probation, Global Assignment

### Key Fields
- `EmpEmployment.userId` + `EmpEmployment.startDate`
- `EmpJob.event` — the lifecycle event type
- `EmpJob.eventReason` — detailed reason
- `EmpEmploymentTermination` — termination date, reason

### Rehire Handling

**Two approaches in SuccessFactors:**

1. **Rehire with New Employment:** Terminate old, create new `EmpEmployment` with new start date. Fresh employment history. Previous termination data still accessible.

2. **Rehire with Old Employment:** Reactivate using existing records. System clears termination end-date only — other termination fields retain values.

System uses configurable match fields (name, DOB, national ID) to detect potential rehires automatically.

**For Trike:** Check for existing user by userId/employeeId. If found and inactive → reactivate. Fetch `EmpEmploymentTermination` to confirm rehire scenario.

### Org Structure

**3-layer hierarchy (excluding Legal Entity):**
```
Company/Legal Entity
  → Business Unit
    → Division (can belong to multiple BUs)
      → Department (can belong to multiple Divisions)
```

Plus: Location, Cost Center, Position, Job Code, Job Function, Pay Grade/Group/Range.

All maintained as **Foundation Objects** (FO_*) accessible via OData.

For Trike mapping:
- `FOLocation` → `stores`
- `FODepartment` or `FODivision` → `districts`
- `FOJobCode` → `roles`
- `FOCompany` → `organizations`

Each customer's structure varies significantly — per-customer mapping config essential.

---

## SFTP / File-Based Integration (Fallback)

Available via **Integration Center:**
- Export to SFTP in CSV, TXT, XML, EDI formats
- Schedule: minimum 3x/day, maximum 12x/day, max 5 scheduled integrations
- Files pushed to configured SFTP server
- Filter conditions and ordering supported
- Can also do scheduled CSV inbound imports

**Use case:** If a customer cannot enable API access (permissions, security policies), SFTP export is the fallback path.

---

## Access Path — Customer-Controlled, No SAP Approval for API Access

### What the Customer Does

1. **Create dedicated API user** with appropriate Role-Based Permissions
2. **Register OAuth2 client** in Admin Center > Manage OAuth2 Client Applications
3. **Generate X.509 certificate** and map to API user
4. **Grant permissions:** At minimum, read access to User, EmpEmployment, EmpJob, PerPersonal, PerPhone, PerEmail, plus Foundation Objects
5. **Share with Trike:** Company ID, API user credentials, Client ID, certificate/private key, data center API host

**No SAP partner certification required.** The customer's admin controls everything.

### Optional: SAP BTP Route
- Register SuccessFactors instance in BTP System Landscape
- Auto-creates destination for API calls
- Adds BTP licensing cost — only needed for complex scenarios

### Editions Matter
- **Enterprise Edition:** Full API access (OData, SFAPI, SCIM, Intelligent Services, Integration Center)
- **Professional Edition (<250 employees):** API available but some advanced features limited
- **Employee Central add-on required** for PerPerson, EmpJob, etc. entities. Without EC, only basic `/User` entity available.

**Ask the customer:** "Do you have Employee Central enabled?" This determines which entities are available.

---

## Architecture: Event-Driven + Delta Polling

```
REAL-TIME PATH (Intelligent Services events):
  SuccessFactors → HTTP POST → Edge Function /hris/webhook/successfactors
  → Validate HMAC-SHA256 (x-sf-signature) → Parse event (Hire/Term/Transfer/etc.)
  → Fetch full employee data via OData → Apply to users table

DELTA POLLING (every 10-15 min):
  pg_cron → Edge Function /hris/sync
  → OAuth token (SAML assertion exchange)
  → GET /odata/v2/EmpJob?$filter=lastModifiedDateTime gt datetime'{last_sync}'
  → GET /odata/v2/PerPersonal?$filter=lastModifiedDateTime gt datetime'{last_sync}'
  → Process changes → Apply to users table

FULL RECONCILIATION (every 6-12 hours):
  Full User or EmpEmployment pull → Compare against users table

SFTP FALLBACK (if API not feasible):
  Integration Center → scheduled CSV export to SFTP → file parser → diff → sync
```

### Event Flow — Intelligent Services

**Hire Event Received:**
1. Validate HMAC-SHA256 via `x-sf-signature` header
2. Parse event payload — contains userId and event type
3. Fetch employee data: `GET /odata/v2/User('{userId}')?$expand=manager`
4. If EC enabled: `GET /odata/v2/EmpJob?$filter=userId eq '{userId}'` for dept/location
5. Map org structure → Trike stores/districts/roles
6. Create user, log event, notify store manager

**Termination Event Received:**
1. Validate HMAC
2. Fetch `EmpEmploymentTermination` for termination date/reason
3. Deactivate user, set termination_date, revoke auth
4. Log, notify admin

**Transfer/Promotion Event:**
1. Validate HMAC
2. Fetch current `EmpJob` record for new department/location/jobCode
3. Map to new store/role via field mapping
4. Update user, notify relevant managers

---

## SuccessFactors vs Other Providers

| Dimension | SuccessFactors | BambooHR | Paylocity | UKG Ready |
|---|---|---|---|---|
| **Auth complexity** | **Highest** (SAML assertion + X.509 cert + OAuth) | Lowest (API key) | Medium (OAuth CC) | Low (token login + API key) |
| **Data model** | **Most complex** (effective-dated, multi-entity) | Simple (flat + tables) | Flat with cost centers | Flat with cost centers |
| **Event system** | Intelligent Services (~25 events) | Webhooks (3 event types, rich payloads) | Webhooks (5 types) | Uncertain for Ready |
| **Delta endpoint** | Yes (per-entity lastModifiedDateTime) | Yes (/employees/changed) | No | Yes (/employees/changed) |
| **Webhook setup** | Integration Center config (customer) | **Programmatic via API** | Customer emails support | Customer via UI |
| **Custom fields** | MDF framework, `cust_` prefix | `custom` prefix, discoverable | Custom fields per company | HR custom fields |
| **SFTP fallback** | Yes (Integration Center, up to 12x/day) | No (API only) | No (API only) | No (API only) |
| **Target market** | Enterprise (1,000+ employees) | SMB (10-1,000) | Mid-market | SMB |

---

## Pros

| | |
|---|---|
| **Rich event system** | ~25 predelivered events covering every lifecycle scenario (hire, rehire, term, transfer, promotion, demotion, LOA, return to work, etc.) |
| **Delta query per entity** | `lastModifiedDateTime` filter on every entity |
| **SFTP fallback** | Integration Center can export CSV up to 12x/day if API isn't feasible |
| **No SAP approval needed** | Customer's admin configures OAuth credentials and permissions |
| **Comprehensive org structure** | Foundation Objects for company, BU, division, department, location, cost center, job code — covers any org hierarchy |
| **Enterprise-grade** | If a customer uses SuccessFactors, they're serious about HR tech — good fit for Trike's enterprise play |

## Cons / Risks

| | |
|---|---|
| **Most complex authentication** | SAML assertion + X.509 cert + OAuth + Role-Based Permissions. Highest setup friction. |
| **Effective-dated data model** | Must understand temporal queries — "current" record isn't always obvious |
| **Employee Central may not be enabled** | Without EC, only basic User entity is available (limited fields) |
| **Multi-entity queries** | Employee data split across 10+ entities. Must query each and join client-side. |
| **Rate limit: 429 with 5-minute Retry-After** | More aggressive throttling than other providers |
| **No custom events** | Only ~25 predelivered events. Can't subscribe to arbitrary field changes. |
| **Data center-specific URLs** | Must know customer's DC to construct API URL |
| **Integration Center setup** | Customer must configure event subscriptions + REST destination — more complex than BambooHR's programmatic webhook creation |
| **SAP ecosystem complexity** | Documentation spread across help.sap.com, community.sap.com, api.sap.com — harder to navigate than purpose-built dev portals |

---

## Implementation Priority

SuccessFactors should be the **last provider adapter** built, given its complexity:

1. **Paylocity** — first provider (pilot customer)
2. **UKG Ready** — delta endpoint + simpler auth
3. **BambooHR** — most developer-friendly, rich webhooks
4. **ADP WFN** — SFTP-based, different pattern but simple
5. **SAP SuccessFactors** — only when an enterprise customer requires it

Estimated effort: **2-3 weeks** for the SuccessFactors adapter (vs 1-2 weeks for others), primarily due to auth complexity and multi-entity data model.

---

## Verification Plan

1. **SAML assertion flow** — Generate assertion, exchange for token, verify API call succeeds
2. **User entity query** — Fetch all users, verify field mapping
3. **EmpJob delta query** — `lastModifiedDateTime` filter returns correct changed records
4. **Intelligent Services event** — Hire event → HMAC validation → user created
5. **Termination event** → user deactivated
6. **Transfer event** → EmpJob location changed → store_id updated
7. **Rehire** → detect via EmpEmployment reactivation or new employment record
8. **Effective-dated query** — Verify current record retrieval for effective-dated entities
9. **Foundation Objects** — Fetch FOLocation, FODepartment for mapping UI
10. **SFTP fallback** — If API not feasible, verify Integration Center CSV export processing

---

## Immediate Action Items (For a SuccessFactors Customer)

1. **Ask customer:** "Do you have Employee Central enabled?" — determines available entities
2. **Ask customer:** Which data center are they on? (for API host URL)
3. **Customer creates API user** with Role-Based Permissions for relevant entities
4. **Customer registers OAuth2 client** + generates X.509 certificate
5. **Customer shares:** Company ID, API user, Client ID, certificate/private key, DC API host
6. **Customer configures Intelligent Services** subscription for Hire, Termination, Rehire, Transfer events pointing to Trike's endpoint
7. **Get customer's org structure** — How do Company/BU/Division/Department/Location map to Trike's hierarchy?
