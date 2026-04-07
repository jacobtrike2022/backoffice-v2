# Scope: Direct HRIS Sync Engine — ADP Workforce Now (SFTP-First)

## Context

ADP Workforce Now is the most common mid-market HRIS/payroll provider. For Trike, the likely integration path is **SFTP-based** — ADP pushes a daily CSV census file to Trike's SFTP server. This is the most common pattern for LMS integrations with ADP (TalentLMS, Workshop, and others use this approach).

---

## Two Integration Paths

### Path A: SFTP File Transfer (Recommended Starting Point)

ADP WFN has a built-in **Custom Reports** module. Customers build a report selecting employee fields, then ADP delivers that report as a CSV to an SFTP server on a schedule.

**How it works:**
1. Customer creates a custom report in ADP WFN UI (Reports & Analytics > Custom Reports)
2. Customer selects all fields Trike needs (name, email, phone, hire date, status, location, department, job title, etc.)
3. Customer works with ADP to set up automated SFTP delivery (requires a Statement of Work with ADP)
4. ADP pushes CSV file to Trike's SFTP server on schedule
5. Trike parses the CSV, compares to previous file, detects changes

**Costs to customer:**
- One-time setup fee: ~$200-300
- Monthly recurring: ~$30-50/month
- Setup timeline: 3-4 weeks from SOW completion

**Scheduling:** Daily, weekly, bi-weekly, or monthly. Some reports can be hourly with special arrangement. Daily is standard.

**File format:** CSV (UTF-8), up to 250 MB per file. Customer controls which columns are included.

**SFTP connection:**
- Protocol: SFTP (Port 22)
- Auth: SSH key pair (4096-bit RSA recommended)
- PGP encryption supported for additional security
- ADP pushes to YOUR server (you host the SFTP endpoint)

### Path B: REST API (For Real-Time, More Complex)

**Core endpoint:** `GET /hr/v2/workers` — returns all workers, paginated (default 50, OData `$top`/`$skip` params).

**Authentication is complex — TWO layers required:**
1. **OAuth 2.0 Client Credentials** — token endpoint: `https://accounts.adp.com/auth/oauth/v2/token`
2. **Mutual TLS (mTLS)** — you generate a CSR, email to ADP, they return a signed SSL certificate. Every API request requires the certificate + Bearer token.

**Event notifications/webhooks exist** — ADP generates events for hire, termination, rehire, name/address/phone changes, job changes. Available via polling (message queue) or webhook push. But access may require specific API subscriptions.

**No delta endpoint** — no `modifiedSince` or `changedSince` parameter on the workers endpoint. Must use event notifications or full sync + diff.

**Rate limits:**
| Tier | Calls/Min | Concurrent |
|---|---|---|
| Default | 300 | 50 |
| Tier 2 | 480 | 50 |
| Tier 3 | 780 | 50 |

**API access requires one of:**
- **ADP API Central** — customer purchases from ADP, self-service activation. Customer controls access.
- **ADP Marketplace Partnership** — Trike registers at partners.adp.com, signs Developer Participation Agreement, builds SSO integration, gets listed on marketplace. Months-long process.

---

## SFTP Architecture (Primary)

```
DAILY SYNC:
  ADP pushes CSV → Trike SFTP server
  → File watcher detects new file → Parse CSV
  → Compare against previous file snapshot
  → Detect: NEW HIRE (new ID), TERMINATION (status change), TRANSFER (location change),
    PROMOTION (title change), REHIRE (previously terminated, now active), INFO UPDATE
  → Apply changes to users table → Notify managers

MANUAL UPLOAD (fallback):
  Customer downloads CSV from ADP → uploads via BulkEmployeeImport
  → Uses existing importMapping.ts engine

SYNC NOW:
  Trike requests immediate file delivery (or customer triggers manual export)
```

### Change Detection via File Comparison

Since SFTP delivers a **full census snapshot**, detect changes by comparing each file to the previous:

| Change Type | Detection Method |
|---|---|
| **New Hire** | Employee ID in new file but not in previous |
| **Termination** | Status changed to "Terminated" or "Inactive" |
| **Rehire** | Previously terminated employee reappears as Active + Rehire Date populated |
| **Transfer** | Location Code or Department changed between files |
| **Promotion/Demotion** | Job Title or Job Code changed |
| **Info Update** | Name, email, phone, address fields differ |
| **Disappeared** | Employee ID in previous but not in new (could be termination if report filters active-only) |

---

## Employee Data Available via SFTP Export

The customer builds the custom report and selects columns. All standard ADP fields are available:

**Identity/Contact:**
- Employee ID (File Number / Position ID), Associate OID
- First Name, Last Name, Middle Name, Preferred Name
- Work Email, Personal Email
- Work Phone, Personal Mobile, Home Phone
- Address (street, city, state, zip, county, country)

**Employment:**
- Hire Date, Seniority Date, Termination Date, Rehire Date
- Employment Status (Active/Inactive/Terminated/Leave)
- Eligible for Rehire flag
- Worker Category (hourly/salary), FLSA Code, FTE

**Job/Org:**
- Job Title, Job Code, Job Class, Job Function
- Department (code + description)
- Location (code + name + address)
- Business Unit (code + description)
- Cost Center / Cost Number
- Company Code
- Reports To (manager Employee ID or name)

**Compensation (if needed):**
- Base Pay Rate, Pay Rate Type, Annual Salary, Pay Frequency

**Custom Fields:**
- Person Custom Fields and Worker Custom Fields (client-defined)

---

## Employee Status & Lifecycle

### Status Values
- **Active** — Currently employed
- **Terminated** — Employment ended (status flips day AFTER termination date, once payroll closes)
- **Inactive** — On leave or other non-active status
- **Leave of Absence** — Specific leave status
- **Suspended** — Some orgs use this

### Rehire Handling
- **Same Employee ID / Associate OID retained** when rehired within same legal employer
- Rehire Date and Rehire Reason populated
- New Work Assignment may be created (new assignment ID) but worker record is the same
- In SFTP export: rehired employee appears Active with populated Rehire Date field
- **For Trike:** Match by employee_id. If found and inactive → reactivate, update hire_date to rehire date, clear termination_date. Do NOT duplicate.

### Transfers
- **Intra-company (dept/location change):** Existing work assignment updated. In CSV: changed field values.
- **Inter-company (between company codes):** ADP terminates in Company A, creates new hire in Company B. CSV may show two records (one terminated, one new). Match by name/email to avoid duplicate.

### Org Structure
- **Company Code** — Top-level legal entity
- **Location** — Physical work sites (code + name + address) → maps to Trike `stores`
- **Department** — Organizational units → could map to Trike `districts` or informational
- **Business Unit** — Another grouping level
- **Cost Center / Cost Number** — Financial coding
- **Jobs** — Job codes and titles → maps to Trike `roles`

Exact mapping depends on each customer's ADP configuration. Need per-customer mapping config.

---

## Access Path — No ADP Approval Needed for SFTP

### What the Customer Does (SFTP Path)

1. **Create custom report** in ADP WFN (Reports & Analytics > Custom Reports)
   - Select all fields Trike needs
   - Filter for relevant employees (active, or all for full lifecycle tracking)
2. **Contact ADP** to set up automated SFTP delivery
   - Provide Trike's SFTP server hostname, port, username, SSH public key
   - Sign Statement of Work (~$200-300 one-time + ~$30-50/month)
   - ADP sets up automated delivery schedule (daily recommended)
3. **Test file delivery** — ADP sends test file before going live

**No Trike partnership with ADP needed. The customer owns the integration.**

### What Trike Builds

1. **SFTP server** (or managed SFTP service — e.g., AWS Transfer Family, or Supabase Storage with an SFTP proxy)
2. **File watcher** — detects new CSV files
3. **CSV parser** — reuses patterns from existing `importMapping.ts`
4. **Snapshot comparator** — compares new file to previous, generates change events
5. **Event processor** — applies changes to `users` table (create, update, deactivate)
6. **Mapping config** — per-customer column-to-field and value-to-store/role mappings

---

## SFTP vs API Comparison

| Dimension | SFTP | REST API |
|---|---|---|
| **Setup complexity** | Low — customer creates report, ADP delivers CSV | High — mTLS certs + OAuth + ADP API Central purchase |
| **Time to production** | 3-4 weeks | Months (especially Marketplace path) |
| **Cost to customer** | ~$50/month to ADP | API Central pricing (undisclosed, likely higher) |
| **Sync frequency** | Daily (standard), hourly possible | Near-real-time (event notifications) |
| **Change detection** | File diff (compare snapshots) | Event notifications or full sync + diff |
| **Trike approval needed** | No | No (if customer buys API Central) |
| **ADP approval needed** | No (customer controls) | No for API Central; Yes for Marketplace partnership |
| **Reliability** | Very high (file delivery is mature) | Depends on event notification availability |
| **Implementation effort** | Low — parse CSV, diff, sync | High — mTLS, OAuth, event subscription, API pagination |

**Recommendation: SFTP for pilot and early customers. API path is a future optimization if sub-daily sync becomes critical.**

---

## Latency Consideration

With daily SFTP delivery, the worst-case latency for detecting a new hire is ~24 hours. For the "new hire waiting to start training" scenario:

- **Daily SFTP catches most lifecycle events** — new hires entered before end of business appear in next morning's file
- **"Sync Now" / manual upload** — customer can export the report manually and upload to Trike's bulk import for immediate sync
- **Provisional "Quick Add"** — manager creates provisional user immediately, SFTP enriches later
- **Future: API path** — when sub-hour sync becomes business-critical for multiple ADP customers

---

## Database Schema (Extends Shared HRIS Tables)

ADP-specific `field_mapping` in `hris_connections`:

```json
{
  "provider": "adp_wfn",
  "sync_method": "sftp",
  "sftp_path": "/incoming/adp/",
  "file_pattern": "Employee-Census*.csv",
  "schedule": "daily",
  "column_mapping": {
    "File Number": "employee_id",
    "First Name": "first_name",
    "Last Name": "last_name",
    "Work Email": "email",
    "Personal Mobile": "mobile_phone",
    "Hire Date": "hire_date",
    "Termination Date": "termination_date",
    "Rehire Date": "rehire_date",
    "Employment Status": "status",
    "Location Code": "store_lookup",
    "Job Title": "role_lookup"
  },
  "location_to_store": {"LOC001": "uuid-of-store", "LOC002": "uuid-of-store"},
  "jobtitle_to_role": {"Store Manager": "uuid-of-role", "Team Member": "uuid-of-role"},
  "status_mapping": {"Active": "active", "Terminated": "inactive", "Leave of Absence": "on-leave"}
}
```

New table for file tracking:

```sql
CREATE TABLE hris_sftp_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  filename TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'success', 'error'
  row_count INT,
  changes_detected JSONB, -- {new_hires: 2, terminations: 1, transfers: 0, ...}
  errors JSONB DEFAULT '[]',
  file_hash TEXT, -- SHA256 to detect duplicate deliveries
  UNIQUE(organization_id, file_hash)
);
```

---

## Pros

| | |
|---|---|
| **Simplest customer setup** | Customer creates a report in ADP's UI, ADP delivers CSV. No API credentials to manage. |
| **No ADP approval of Trike** | Customer owns the integration entirely |
| **Proven pattern** | TalentLMS, Workshop, Absorb LMS, and many others use SFTP with ADP |
| **Reuses existing code** | `importMapping.ts` fuzzy matching + `bulkCreateUsers` duplicate detection already handle CSV parsing |
| **Full field availability** | Customer selects any ADP field for the export — more flexible than some API scopes |
| **Low cost** | ~$50/month to ADP for automated delivery |
| **Reliable delivery** | SFTP file transfer is mature, battle-tested infrastructure |

## Cons / Risks

| | |
|---|---|
| **Daily latency** | Standard delivery is daily — up to 24 hours before a new hire syncs. Mitigated by manual upload + provisional flow. |
| **No real-time events** | Unlike Paylocity/BambooHR webhooks, SFTP is batch-only |
| **ADP SOW required** | Customer must work with ADP to set up automated delivery (3-4 week lead time) |
| **File comparison complexity** | Must store previous file snapshot to detect changes |
| **Trike must host SFTP server** | Need to provision and maintain SFTP endpoint |
| **Schema changes** | If customer modifies their ADP report columns, Trike's parser must adapt |
| **Inter-company transfers** | May appear as termination + new hire with different IDs — harder to match |

---

## Verification Plan

1. **Sample CSV parsing** — Process a sample ADP census export, verify field mapping
2. **Change detection** — Compare two sample files, verify correct classification of new hires/terms/transfers/rehires
3. **Duplicate file handling** — Same file delivered twice → no duplicate changes (SHA256 hash check)
4. **Rehire detection** — Previously terminated employee appears Active with Rehire Date → reactivate (not duplicate)
5. **Manual upload fallback** — Customer uploads CSV via BulkEmployeeImport → uses existing import flow
6. **Provisional flow** — Quick Add → next SFTP file enriches record
7. **Column mapping resilience** — Handle missing/extra columns gracefully

---

## Immediate Action Items (For an ADP WFN Customer)

1. **Customer creates custom report** in ADP WFN with fields Trike needs
2. **Customer exports sample CSV** manually for Trike to build parser/mapping against
3. **Customer contacts ADP** to set up automated SFTP delivery (SOW, ~3-4 weeks)
4. **Trike provisions SFTP endpoint** and shares connection details with customer
5. **Get customer's org structure** — What do Location Codes, Departments, Business Units mean? Map to Trike stores/districts.
6. **Determine report filter** — Active employees only, or include terminated? (Recommend including all for proper termination detection)
