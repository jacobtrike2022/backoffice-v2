# Trike Unified Revenue Engine
## Quick Reference Card

---

## The Core Concept

**One product, one flow, from prospect to renewal.**

```
PROSPECT → EVALUATING → CLOSING → ONBOARDING → LIVE → RENEWING
```

Each state has its own UI, permissions, and metrics.

---

## What It Replaces

| Before | After |
|--------|-------|
| HubSpot/Pipedrive | Deal Dashboard |
| Google Sheets (ROI) | ROI Calculator |
| Google Docs (proposals) | Proposal Builder |
| DocuSign | Embedded E-Sign |
| Calendly | Embedded Scheduling |
| Notion/Asana | Onboarding Checklist |
| Loom | Sales Content Library |
| Stripe Dashboard | Integrated Billing |

---

## Key Personas

| Persona | What They Need |
|---------|----------------|
| **Jacob** | Pipeline visibility, fast proposal generation, engagement intelligence |
| **Champion** | Self-service evaluation, ROI data for business case, easy team sharing |
| **Decision Maker** | Quick ROI understanding, simple pricing, easy signing |
| **IT Contact** | Security docs upfront, integration clarity |
| **Client Admin** | Clear onboarding checklist, launch confidence |

---

## The Magic: Data Flows Once

```
ROI Calculator (prospect fills out)
       ↓
   Proposal (auto-generated)
       ↓
   Contract (pricing pulled in)
       ↓
   Onboarding (locations pre-filled)
       ↓
   Live Dashboards (baseline for comparison)
       ↓
   QBR Reports (ROI validation)
       ↓
   Renewal Proposals (prove the value)
```

---

## Build Phases

| Phase | Weeks | Goal |
|-------|-------|------|
| 1. Foundation | 1-2 | Account state machine, basic prospect portal |
| 2. Sales Room | 3-4 | Full self-service evaluation |
| 3. Proposals & Close | 5-6 | Proposal generation, e-sign, payment |
| 4. Deal Intelligence | 7-8 | Engagement analytics, alerts |
| 5. Onboarding Portal | 9-11 | Self-service onboarding |
| 6. Launch & Health | 12-14 | Go-live automation, health tracking |
| 7. Polish | 15-16 | Automation, edge cases, performance |

---

## Key Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Demo creation | 2-3 days | < 1 hour |
| Proposal creation | 3-4 hours | < 15 min |
| Sales cycle | 45-60 days | 30 days |
| Onboarding | 45-60 days | 21 days |
| Admin hours/deal | 15-20 | < 5 |

---

## Critical Success Factors

1. **"Eat your own dogfood"** — Sales content IS Trike content
2. **Data persistence** — Enter once, use everywhere
3. **Self-service first** — Client can progress without Jacob
4. **Engagement visibility** — Know who's engaged, who's not
5. **Graceful state transitions** — Portal transforms automatically

---

## First Implementation Prompt

Copy the full PROJECT-CHARTER.md into a new chat, then:

> "I've loaded the Prospect-to-Client Flow PRD. Let's start with Phase 1: Foundation. First, let's design the database migrations needed to add the account state machine to the existing organizations table, along with the engagement_events table. Show me the SQL and explain how it integrates with the existing schema."

---

## File Locations

```
/docs/exp/jacob/prospect-to-client-flow/
├── PROJECT-CHARTER.md         # Full specification
├── QUICK-REFERENCE.md          # This summary
├── IMPLEMENTATION-TRACKER.md   # Progress checklist
└── ARCHITECTURE-ADDENDUM.md    # Build architecture & migration notes
```
