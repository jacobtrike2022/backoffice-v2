# Scope: Direct HRIS Sync Engine — Paycom

## Context

Paycom is the most hostile HRIS on our list to integrate with. Unlike BambooHR, ADP WFN, UKG, or SAP SuccessFactors, Paycom **does not offer a public developer API**, does not publish SDK docs, and has no self-service key generation. Their competitive positioning is "single database, do it all in Paycom" and they actively discourage third-party integrations as a moat.

Every unified-API vendor (Merge, Finch, Knit, Bindbee, Unified.to) lists Paycom, but each reaches it by the same small set of back doors the customer must open for us. There is no "just call the API" path.

This scope documents **every theoretically viable path** to get employee lifecycle events (new hire, termination, rehire, transfer, promotion) out of Paycom and into Trike, ranked by feasibility.

---

## The hard truth about Paycom's "API"

- Paycom has a private/partner REST API (internal name has appeared as "Paycom API" and under the "paycombeta" readme subdomain). It uses **SID + Token** or OAuth 2.0 credentials that are **only issued by Paycom support**, typically after a commercial partnership agreement and (reportedly) thousands of dollars per year in fees.
- Webhook setup is **not self-service**: the customer lists the endpoints they want hooked and emails Paycom support, and Paycom manually provisions a webhook URL. Supported events anecdotally include `employee.updated` and `payroll.processed`, but the event catalog is not publicly documented.
- Paycom has explicitly told G2/Outsail-style reviewers that their strategy is "single database, no third-party integrations" and customers routinely cite the lack of integrations as a top frustration.
- Net: we should **assume no API** for planning purposes and treat any API access as a lucky upside, not a dependency.

---

## Ranked strategy: paths to get Paycom employee data into Trike

### Tier 1 — Recommended primary path

#### 1. Customer-provisioned SFTP export of a scheduled "Employee Roster" report (BEST PATH)

This is how most real integrations with Paycom actually work. It combines two Paycom features the customer can turn on from inside their admin account:

**(a) Paycom Report Center + Push Reporting (custom report builder)**
- Customers with any Paycom plan can use Report Center to build a custom report (aka Push Report) with any fields they want: employee ID, first/last name, email, mobile phone, hire date, termination date, rehire date, status, job title, department, location/store, manager, pay type, etc.
- Push Reporting supports schedules: **daily, weekly, monthly, quarterly, annually**. Daily is sufficient for training workflows.
- Output formats supported: **CSV, Excel (.xlsx), PDF, HTML, .TXT, Word**. We want CSV.
- Scheduled reports land in the user's Push Reporting Inbox inside Paycom and trigger an email notification. Critically, when combined with SFTP Export, they can be auto-delivered to a file drop.

**(b) Paycom SFTP Export**
- Customer must request "SFTP Export" from their Paycom Specialist / Client Relations Rep; the Paycom Automation team activates the feature and creates a user profile. The customer gets a username and sets a 16–20 char password.
- Host: `sftp.paycomonline.net`, port 22, standard SSH/SFTP. Password only (no SSH key auth that we've seen documented). Password does not expire.
- Folders: `Outbound/` (files Paycom pushes out) and `Inbound/` (files the customer pushes in). We only care about `Outbound/`.
- Lockout policy: 5 failed attempts in 6 minutes → 15 min auto-lock. 15 invalid attempts in 5 minutes → IP blacklist (must call Paycom specialist to unblock). This matters for our code: implement exponential backoff, alert on lockout.
- Scheduled custom reports can be set to drop into the customer's SFTP Outbound folder automatically when they run.

**How Trike consumes it:**
- Customer provides us their SFTP credentials (or we stand up our own SFTP endpoint and ask Paycom to push there — Paycom allows either direction but customer-hosted is the more common pattern).
- A Supabase edge function or cron worker polls the SFTP Outbound folder on a schedule (e.g. every hour), picks up new CSVs matching a known filename prefix, parses them, and diffs against our `users` table.
- Diff logic:
  - New employee ID not in Trike → new hire → create user row, enroll in onboarding track.
  - Employee ID missing from today's roster that was present yesterday → termination → deactivate user.
  - Previously-terminated employee ID reappears → rehire → reactivate user.
  - Store/location field changed → transfer.
  - Job title / role field changed → promotion.
- Full-roster snapshot CSV is actually easier and more reliable than change-log CSV for this use case, because it self-heals if we miss a drop.

**Why this wins:**
- Uses only features the customer can turn on themselves (no Paycom partnership needed).
- No API fees, no OAuth, no email scraping.
- Daily cadence meets the stated SLA for new-hire onboarding (new hires don't need to start training in the first 60 seconds; same-day is fine).
- Standard, auditable protocol. Passes IT / security review.
- The same pattern is how Restaurant365, iCIMS, Coviant, eID Dynamics, and others integrate with Paycom today — meaning the customer's Paycom rep already knows how to turn it on.

**Risks:**
- Requires the customer to submit a request to their Paycom rep and may take days/weeks for Paycom to provision (Paycom is slow here; this is the biggest schedule risk).
- If the customer is on the cheapest plan and Report Center scheduling is locked, we fall back to Tier 2.
- Password-only SFTP is weaker than SSH key auth; we must store it in Supabase Vault / encrypted secrets, never in plaintext.
- Customer must define and save the custom report in Paycom exactly once; we should ship a **step-by-step PDF** and **CSV template** they hand to their Paycom rep.

---

### Tier 2 — Good fallback paths

#### 2. Email-ingestion pipeline for Push Reports

If the customer's Paycom rep refuses or delays SFTP Export but Push Reporting is available:

- Customer schedules the same custom CSV report but emails it to a dedicated address we own, e.g. `paycom+<org_id>@inbound.trike.app`.
- Paycom's Push Reporting emails a notification with a link to the Paycom Report Inbox, **not always the attachment itself**. This is the critical gotcha: historically Push Reporting does not attach CSV to the notification email; the customer (or we, via scraping their Paycom session) would still have to log in to download.
- Workaround: some customers can configure Report Center to email the actual file (formats other than CSV sometimes travel as attachments more reliably). Customer confirms per-account behavior.
- If the file does attach: we use an inbound email provider (Postmark, SendGrid Inbound Parse, or Cloudflare Email Workers) pointed at an MX record, parse the attachment, route by `+<org_id>` alias, and run the same diff logic as Tier 1.

**Risks:**
- Email attachment size limits (Paycom side unclear; assume 10–25 MB max).
- Email is not a secure channel for PII by default — we must enforce TLS-only delivery and document this in the customer security review.
- If Paycom only sends a link-to-inbox notification (not the attachment), this path collapses into Tier 4 (manual / scraping).

#### 3. Finch "Assisted" integration (credential-vaulting middleware)

Finch explicitly labels Paycom as an **Assisted** integration, not an Automated one. This is how they actually do it, per their own docs:
- The customer's Paycom admin sets up Finch as a new third-party admin user inside Paycom.
- The customer authorizes via Finch Connect (OAuth-style UI).
- Finch's **product ops team** does a one-time manual configuration, then Finch runs a weekly sync (yes — 7-day cadence, not real-time) by logging in as the provisioned admin and pulling data.
- Data endpoints return HTTP 202 until Finch ops finishes setup, then 200.
- Once live, Finch exposes clean `/directory`, `/individual`, `/employment`, `/payment` endpoints that Trike can call.

**Tradeoffs:**
- Pros: we don't touch Paycom at all; Finch absorbs the hostility. Same integration shape as Gusto/Rippling in Finch-land, so our code is reusable.
- Cons: weekly refresh is too slow for new-hire training. Per-employer pricing ($$). Added vendor dependency, which is exactly what our HRIS 2.0 direction is trying to exit. And Finch can drop Paycom at any time.
- Recommendation: only use Finch if (a) SFTP is blocked and (b) the customer already has Finch for something else. Do not build Finch dependency for Paycom alone.

#### 4. Merge.dev Paycom integration

- Merge lists Paycom and claims API-based access, currently marked **Beta**. They don't publicly explain whether they use the gated Paycom partner API or a Finch-style assisted flow; based on the sync-frequency language ("hourly / 6-hour / daily") it is likely a real API connection behind a Merge-Paycom partnership.
- Merge syncs: employees, employments, bank info, company, locations, timesheets, groups/departments, custom field mapping.
- Per-employer pricing, OAuth Magic Link auth flow for the customer.
- Same tradeoff as Finch: buys time, creates vendor dependency, exactly what we're trying to exit.

---

### Tier 3 — Ride existing "official" integrations

#### 5. Paycom SAML SSO → mine the SAML assertion
- Paycom supports SAML 2.0 as an **IdP**, meaning Paycom can assert identity into Okta / Azure AD / Google Workspace or vice versa.
- If the customer uses Paycom as their IdP for Trike SSO, then every time an employee logs into Trike we get a SAML assertion containing employee ID, email, name, and (via custom SAML attributes) store, role, department.
- This won't give us terminations or "employee exists but hasn't logged in yet," but it is a zero-cost way to populate `users` rows for active employees the moment they first click the Trike link.
- **Pair this with Tier 1 SFTP**: SFTP for authoritative roster state; SAML JIT for fresh profile data on login.

#### 6. SCIM — NOT AVAILABLE
- Confirmed: **Paycom does not offer native SCIM provisioning on any plan**. This is widely complained about by IT teams and is one of Paycom's biggest identity gaps.
- Third-party "SCIM bridge" vendors (Stitchflow, RoboMQ Hire2Retire, Aquera Sync Bridge) exist specifically to fake SCIM for Paycom by screen-scraping or by using the partner API. Same vendor-dependency tradeoff as Finch/Merge.
- Do not design around SCIM for Paycom. Do not promise it to customers.

#### 7. Ride a Paycom → Active Directory / Entra ID bridge the customer already owns
- Many Paycom customers use RoboMQ Hire2Retire or similar to mirror Paycom employee records into Azure AD / Google Workspace.
- If the customer already runs this, Trike can ignore Paycom entirely and sync from Entra ID via standard Microsoft Graph / Google Directory APIs — both of which have real, public, well-documented APIs.
- This is the cleanest path **if the customer already has the bridge**, and is worth asking about in the HRIS intake form before we spec an SFTP flow.

#### 8. Paycom Learning
- Paycom's internal LMS is the system Trike is replacing. It has no documented data export to third parties. Not a viable data source. (It's also our competition — we don't want to depend on it.)

---

### Tier 4 — Last-resort manual and gray-area paths

#### 9. Weekly / daily manual CSV upload in Trike UI
- We already have bulk employee import in Trike (recent commits confirm this). Document a Paycom-to-Trike CSV template with exact column names and a one-pager for the customer's HR admin: "In Paycom → Report Center → New Report → add these fields → export as CSV → upload here."
- This is the **guaranteed-to-work fallback** for every Paycom customer, regardless of plan or cooperation from Paycom. Must be the "day one" path even if we later upgrade them to SFTP.
- Ship a "last uploaded: 3 days ago" warning banner so HR admins don't forget.

#### 10. New-hire email notification parsing
- Paycom can email managers when a new hire is onboarded. The content and structure of these emails is not standardized and customer-configurable, so parsing is brittle. Feasible but not recommended as primary path. Could be a nice-to-have "instant new hire" signal layered on top of SFTP.

#### 11. Zapier / Make / Workato
- **Zapier:** no native Paycom app. Third-party "Apiway" style middleware exists but is not production-grade. Not viable.
- **Make.com:** same — no native Paycom module.
- **Workato:** no dedicated Paycom connector as of Apr 2026; there is an open customer feature request on the Workato community. Customers can build a custom HTTP connector against the gated Paycom API, but that reintroduces the partnership-fee problem.
- Net: iPaaS platforms are not a shortcut here.

#### 12. Browser automation / headless scraping of Paycom admin UI
- Technically feasible: customer provides a dedicated Paycom admin user, we run Playwright in a worker, navigate Report Center, trigger + download the CSV, parse it.
- **Legal / ToS:** Paycom's master services agreement almost certainly prohibits automated access not authorized by Paycom. Doing this on behalf of the customer is the customer authorizing their own admin session, which is a grayer area but still a real contractual risk for the customer (not for Trike directly — we never touched Paycom's site).
- **Operational:** Paycom's UI changes without notice, MFA/captcha can break flows, and customer MFA policy may force a human in the loop.
- **Recommendation:** do not productize. Keep in mind only as a "customer demanded it, they accept the risk, short bridge while SFTP is being provisioned" manual-ops workaround, and only via a Playwright script the customer runs themselves, not hosted by us.

#### 13. Paycom Direct Data Exchange (DDX)
- Paycom markets "Direct Data Exchange" as an HR analytics product, not a data pipe. It surfaces analytics inside Paycom; it does not push data outbound to third parties. Not usable for our purpose.

---

## Feasibility ranking summary

| Rank | Path | Cost | Speed to ship | Ongoing reliability | Customer lift |
|------|------|------|---------------|---------------------|---------------|
| 1 | SFTP Export of scheduled Report Center CSV | Free | Medium (Paycom provisions in days–weeks) | High | Medium (one-time ask to Paycom rep) |
| 2 | Manual CSV upload in Trike | Free | Instant | Medium (depends on HR discipline) | Low-Medium |
| 3 | Ride customer's existing Entra ID / Google Directory mirror of Paycom | Free (uses MS/Google APIs) | Fast if bridge exists | High | Zero if bridge exists |
| 4 | SAML JIT profile provisioning on first Trike login | Free | Fast | Medium (no termination signal) | Low |
| 5 | Email-attachment ingestion of Push Report | Free | Medium | Medium (format uncertainty) | Medium |
| 6 | Finch Assisted API | $$ per employer | Fast to integrate | Low (weekly sync) | Low |
| 7 | Merge.dev Paycom (Beta) | $$ per employer | Fast to integrate | Medium | Low |
| 8 | Paycom gated partner API (SID+Token, OAuth, webhooks) | $$$ + contract | Slow (commercial agreement) | High if granted | High (customer champions the ask) |
| 9 | Browser automation / scraping | Free to build, high ongoing | Fast to prototype | Low | Medium (credential handling) |
| 10 | Zapier / Make / Workato | $ | Slow (no native) | Low | High |
| 11 | Paycom Learning export | — | — | — | Not viable |
| 12 | Paycom SCIM | — | — | — | Does not exist |

---

## Recommended Trike strategy for Paycom customers

1. **Day 1 — Launch:** Manual CSV upload (Tier 4 #9). Works on day one for every customer regardless of Paycom plan. Ship the one-page Paycom Report Center cheat sheet alongside the existing bulk import UI.
2. **Day 7–30 — Automate:** Help the customer submit an SFTP Export + Push Report request to their Paycom rep (Tier 1). Provide a pre-written email template and exact field list. Once provisioned, switch that customer to auto-ingest.
3. **SSO layer:** If the customer wants SSO, configure Paycom as SAML IdP and use JIT provisioning to keep profile data fresh between roster drops.
4. **Do NOT build on:** SCIM, Zapier, the Paycom partner API, Finch, or Merge. Each of these either does not exist for Paycom, costs per-employer fees, or reintroduces exactly the middleware dependency HRIS 2.0 is exiting.
5. **Document in customer onboarding intake:** ask whether the customer already has a Paycom → Entra ID / Google Workspace bridge (e.g. Hire2Retire). If yes, skip Paycom entirely and sync from the identity provider.

---

## Paycom Report Center — exact fields to request in the custom report

Minimum viable columns for Trike sync (send this list to the customer's Paycom rep):

```
Employee Code (unique ID)
Status (Active / Terminated / Leave)
Hire Date
Termination Date (if any)
Rehire Date (if any)
First Name
Last Name
Preferred Name
Work Email
Personal Email
Mobile Phone
Job Title
Department
Location / Store Code
Manager Employee Code
Pay Type (Hourly / Salary)
```

Schedule: Daily, 3:00 AM local time, delivered to SFTP Outbound as `trike_roster_YYYYMMDD.csv`.

---

## Open questions to confirm with a real Paycom customer

- Does their plan tier include Push Reporting scheduling, or is it locked behind an add-on?
- Does their Paycom rep allow customer-initiated SFTP Export, or do they require a Paycom Automation team ticket?
- Can Push Reporting deliver the CSV as an email attachment, or only as a link to the Paycom inbox?
- Do they already run a Paycom → Entra ID / Google Workspace bridge?
- Are they willing to provision a dedicated Paycom "integration admin" user for Trike?
- What is their Paycom contract renewal date? (Leverage moment to push Paycom for real API access.)

---

## Sources

- [Paycom Beta Readme — How to Setup Webhooks](https://paycombeta.readme.io/reference/how-to-setup-webhooks)
- [Paycom Report Center product page](https://www.paycom.com/software/report-center/)
- [Paycom Push Reporting announcement](https://www.paycom.com/about/press-room/paycom-redefines-reporting-process-human-capital-management/)
- [Paycom SFTP Client Instructions (FlipHTML5)](https://fliphtml5.com/tlsdh/ezjt/Paycom_SFTP_Client_Instructions/)
- [RoboMQ — Configuration of Paycom SFTP Password](https://docs.robomq.io/Application/Paycom_SFTP_Password/)
- [Coviant — How to Automate SFTP Integration With Payroll Providers](https://www.coviantsoftware.com/solutions/sftp-integration-with-payroll-providers/)
- [Restaurant365 — Paycom Payroll Integration Instructions](https://help.restaurant365.net/support/solutions/articles/12000039225-paycom-payroll-integration-instructions)
- [Merge.dev — Paycom API Integration](https://www.merge.dev/integrations/paycom)
- [Merge Docs — Paycom sync frequencies](https://docs.merge.dev/integrations/hris/paycom/sync-frequencies/)
- [Finch — Paycom Integration](https://www.tryfinch.com/integrations/paycom)
- [Finch — How Finch Uses Assisted Integrations](https://www.tryfinch.com/blog/how-finch-uses-assisted-integrations-to-expand-data-coverage)
- [Finch Developer — Integration Types](https://developer.tryfinch.com/integrations/integration-types)
- [Knit — Paycom API Integration Guide](https://www.getknit.dev/blog/paycom-api-integration-guide-in-depth)
- [Bindbee — Paycom API guide](https://www.bindbee.dev/blog/paycom-api)
- [Stitchflow — Paycom SCIM Provisioning: Pricing & Limitations](https://www.stitchflow.com/scim/paycom)
- [RoboMQ — Integrate Paycom to AD, Entra ID, and Google Workspace](https://www.robomq.io/blog/integrate-paycom-to-ad-entraid-googleworkspace/)
- [Rollout — Paycom webhooks quick guide](https://rollout.com/integration-guides/paycom/quick-guide-to-implementing-webhooks-in-paycom)
- [Paycom Direct Data Exchange](https://www.paycom.com/software/direct-data-exchange/)
- [Paycom Learning LMS](https://www.paycom.com/software/paycom-learning/)
- [Outsail — Paycom Reviews, Pricing, Pros & Cons](https://www.outsail.co/post/paycom-reviews-pricing-pros-cons-user-reviews)
- [Workato Support — Paycom connector feature request](https://support.workato.com/en/support/discussions/topics/1000094196)
