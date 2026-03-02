# Trike Unified Revenue Engine
## Project Charter & Product Requirements Document

**Version:** 1.0  
**Date:** January 25, 2026  
**Product Owner:** Jacob Forehand  
**Status:** Planning  

---

# Part 1: Executive Overview

## Vision Statement

Transform Trike from a training platform into a **unified revenue engine** where the product IS the sales tool IS the onboarding tool IS the retention tool. Prospects experience Trike BY experiencing Trike — eliminating the friction of 10+ disconnected tools while creating a seamless journey from first demo to loyal customer to renewal.

## The Problem

Jacob currently orchestrates enterprise sales through a fragmented ecosystem:

| Task | Current Tool | Pain |
|------|--------------|------|
| Demo account creation | Manual setup | 2-3 days, high-touch |
| ROI calculations | Google Sheets | Recreated for every prospect |
| Proposals | Google Docs | 3-4 hours per proposal |
| E-signatures | DocuSign | Separate login, separate tracking |
| Onboarding PM | Notion/Asana | Client doesn't see it |
| Client communication | Email/Slack/Phone | Scattered, no history |
| Billing setup | Stripe Dashboard | Manual, error-prone |
| Content customization | Email threads | No structured workflow |
| Engagement tracking | Gut feel | No data on prospect behavior |

**Result:** 15-20 admin hours per deal, 45-60 day sales cycles, lost deals due to friction, inconsistent client experiences.

## The Solution

Build an **account state machine** where the Trike platform evolves based on customer lifecycle stage:

```
PROSPECT → EVALUATING → CLOSING → ONBOARDING → LIVE → RENEWING
```

Each state presents:
- Different dashboard/UI
- Different permissions
- Different actions available
- Different metrics that matter

**The magic:** Data entered once (during ROI calculation) flows through the entire lifecycle — into proposals, contracts, onboarding, QBRs, and renewals.

## What This Replaces

| Current Tool | Replaced By |
|--------------|-------------|
| HubSpot/Pipedrive | Deal dashboard in super admin |
| Google Sheets (ROI) | Built-in ROI calculator |
| Google Docs (proposals) | Proposal builder + templates |
| DocuSign | Embedded e-sign |
| Calendly | Embedded scheduling |
| Notion/Asana (onboarding) | Onboarding checklist engine |
| Loom (sales videos) | Sales content as playlists |
| Stripe Dashboard | Integrated billing |
| Email for updates | In-app messaging + notifications |

## Success Metrics

| Metric | Current | Target | How Measured |
|--------|---------|--------|--------------|
| Demo creation time | 2-3 days | < 1 hour | Timestamp: request → live |
| Proposal creation time | 3-4 hours | < 15 minutes | Timestamp in system |
| Sales cycle length | 45-60 days | 30 days | First login → signature |
| Onboarding time | 45-60 days | 21 days | Signature → go-live |
| Admin hours per deal | 15-20 | < 5 | Self-reported + tracking |
| Tools required | 10+ | 1 | Count |
| Prospect engagement visibility | None | Full | Engagement score exists |

---

# Part 2: User Personas

## Persona 1: Jacob (Trike Founder / Seller / Super Admin)

**Role:** Founder & CEO handling enterprise sales personally

**Goals:**
- Close deals faster with less manual work
- See pipeline health at a glance
- Know exactly which deals need attention and why
- Generate proposals in minutes, not hours
- Track prospect engagement to time follow-ups perfectly
- Onboard clients without constant hand-holding
- Prove ROI to clients for renewals

**Current Pain Points:**
- Too much time on repetitive administrative tasks
- No visibility into whether prospects are actually engaging
- Manual proposal writing for every single deal
- Data scattered across 10+ tools
- No way to know if a deal is going cold until it's too late
- Onboarding feels like starting from scratch every time

**Success Looks Like:**
- Create a personalized demo in 15 minutes
- See a dashboard that tells me exactly what needs my attention
- Generate a proposal with 3 clicks
- Know that FiveStar's decision maker hasn't looked at the proposal in 5 days
- Have clients self-serve through onboarding with guided checklists
- Pull up any client's ROI data instantly for a QBR

---

## Persona 2: The Champion (Prospect - Primary Contact)

**Example:** Meredith Goodin, Training Manager at FiveStar Food Mart

**Role:** Internal advocate for Trike, responsible for evaluation and implementation

**Goals:**
- Find a training solution that actually works
- Build a business case for leadership
- Get buy-in from decision makers, IT, and finance
- Not look bad if implementation fails
- Reduce her own administrative burden

**Current Pain Points:**
- Hard to explain Trike to others without scheduling more calls
- Needs ROI data and case studies to get budget approval
- Worried about change management and employee adoption
- Current training system is painful but "the devil you know"
- Implementation of new systems always takes longer than promised

**What She Needs from Trike:**
- Self-service exploration (not dependent on Jacob's availability)
- Easy way to share with colleagues
- ROI calculator she can use to build her case
- Clear implementation timeline
- Confidence that Trike will make her look good

**Success Looks Like:**
- Can explore Trike on her own time
- Can invite Glenn (her boss) and IT to review
- Can download an ROI analysis to present at leadership meeting
- Feels confident about the implementation plan
- Launches successfully and gets promoted

---

## Persona 3: The Decision Maker (Prospect - Economic Buyer)

**Example:** Glenn Higdon, VP Operations at FiveStar Food Mart

**Role:** Controls budget, makes final purchase decision

**Goals:**
- Understand ROI quickly (minutes, not hours)
- Minimize risk to the organization
- Trust the vendor to deliver
- Not waste time on detailed evaluation

**Current Pain Points:**
- Vendors send 40-page proposals he doesn't read
- Can't get a straight answer on pricing
- Previous software implementations have failed
- Doesn't have time to sit through demos

**What He Needs from Trike:**
- Executive summary (1 page max)
- Clear ROI with his company's actual numbers
- Simple pricing (not 47 line items)
- Confidence that Meredith can handle implementation
- Easy signature process

**Success Looks Like:**
- Reviews proposal in < 10 minutes
- Sees clear savings number
- Signs without scheduling another call
- Forgets about it until Meredith reports success

---

## Persona 4: The IT Contact (Prospect - Technical Evaluator)

**Example:** IT Director at FiveStar

**Role:** Evaluates security, compliance, and integration requirements

**Goals:**
- Ensure platform meets security standards
- Understand integration effort
- Avoid creating more work for IT team
- Cover their ass on compliance

**Current Pain Points:**
- Vendors hide security information
- Integration documentation is always lacking
- Gets blamed when implementations fail
- SaaS sprawl is already out of control

**What They Need from Trike:**
- Security documentation upfront (SOC 2, data handling)
- Clear HRIS integration requirements
- SSO support information
- Realistic IT effort estimate

**Success Looks Like:**
- Reviews security docs without scheduling a call
- Confirms HRIS integration is straightforward
- Signs off without becoming a blocker

---

## Persona 5: The Client Admin (Post-Sale)

**Example:** Meredith, now implementing Trike

**Role:** Responsible for successful launch and ongoing administration

**Goals:**
- Launch on time without major issues
- Get employees to actually complete training
- Look good to leadership
- Minimize ongoing administrative burden

**Current Pain Points:**
- Overwhelmed by implementation tasks
- Unclear on what to do next
- Worried about employee adoption
- Previous system changes were painful

**What She Needs from Trike:**
- Clear checklist of what to do and when
- Self-service for routine tasks
- Visibility into launch progress
- Easy way to get help when stuck

**Success Looks Like:**
- Follows checklist and launches on time
- 80%+ employee activation in first week
- Leadership congratulates her on smooth rollout
- Ongoing admin takes < 2 hours/week

---

# Part 3: The Account State Machine

## States Overview

| State | Description | Duration | Portal Mode |
|-------|-------------|----------|-------------|
| `prospect` | Demo account, exploring | 14 days default | Sales Room |
| `evaluating` | Multiple stakeholders engaged | Until proposal | Sales Room + Full Preview |
| `closing` | Proposal sent, negotiating | Until signed | Sales Room + Proposal |
| `onboarding` | Signed, implementing | 21-45 days | Onboarding Portal |
| `live` | Fully operational | Ongoing | Full Product |
| `frozen` | Demo expired, not closed | Until re-engaged | Limited Sales Room |
| `renewing` | Approaching renewal date | 60 days before | Full Product + Renewal |
| `churned` | Cancelled | Permanent | Read-only Archive |

## State Transitions

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│    ┌──────────┐                                                 │
│    │ (create) │                                                 │
│    └────┬─────┘                                                 │
│         │                                                       │
│         ▼                                                       │
│    ┌──────────┐    auto: reviewer    ┌────────────┐            │
│    │ prospect │───────added OR───────▶│ evaluating │            │
│    │          │    ROI completed      │            │            │
│    └────┬─────┘                       └─────┬──────┘            │
│         │                                   │                   │
│         │ auto: demo                        │ manual:           │
│         │ expired                           │ proposal sent     │
│         ▼                                   ▼                   │
│    ┌──────────┐                       ┌──────────┐             │
│    │  frozen  │◀──────────────────────│ closing  │             │
│    │          │    (can re-engage)    │          │             │
│    └────┬─────┘                       └────┬─────┘             │
│         │                                  │                    │
│         │ manual:                          │ auto:              │
│         │ extension                        │ agreement signed   │
│         │                                  ▼                    │
│         │                            ┌────────────┐            │
│         └───────────────────────────▶│ onboarding │            │
│                                      │            │            │
│                                      └─────┬──────┘            │
│                                            │                    │
│                                            │ manual:            │
│                                            │ launch confirmed   │
│                                            ▼                    │
│                                      ┌──────────┐              │
│                                      │   live   │◀─────┐       │
│                                      │          │      │       │
│                                      └────┬─────┘      │       │
│                                           │            │       │
│         ┌─────────────────────────────────┼────────────┘       │
│         │                                 │                     │
│         │ auto: 60 days                   │ manual:             │
│         │ before renewal                  │ cancellation        │
│         ▼                                 ▼                     │
│    ┌──────────┐                     ┌──────────┐               │
│    │ renewing │                     │ churned  │               │
│    │          │                     │          │               │
│    └──────────┘                     └──────────┘               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Transition Triggers

| From | To | Trigger | Type |
|------|-----|---------|------|
| (new) | prospect | Jacob creates demo | Manual |
| prospect | evaluating | Reviewer invited OR ROI completed | Auto |
| prospect | frozen | Demo expiration date reached | Auto |
| evaluating | closing | Jacob sends proposal | Manual |
| closing | onboarding | Agreement signed + payment | Auto |
| frozen | prospect | Jacob grants extension | Manual |
| onboarding | live | Jacob confirms launch | Manual |
| live | renewing | 60 days before renewal date | Auto |
| renewing | live | Renewal completed | Auto |
| live | churned | Cancellation processed | Manual |
| any | churned | Organization deleted | Manual |

## UI by State

### Prospect / Evaluating / Closing States → Sales Room Portal

```
┌─────────────────────────────────────────────────────────────────┐
│ 🟠 TRIKE                                    [FiveStar Food Mart]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Welcome, Meredith 👋                                           │
│                                                                 │
│  Your demo expires in 12 days                                   │
│  ━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░░░                              │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  YOUR NEXT STEPS                                                │
│                                                                 │
│  ☑ Watch platform overview (3 min)                              │
│  ☑ Explore your sample content library                          │
│  ☐ Build your ROI comparison                                    │
│  ☐ Invite your team to review                                   │
│  ☐ Schedule follow-up call                                      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  QUICK ACTIONS                                                  │
│                                                                 │
│  [📊 ROI Calculator]  [👥 Invite Team]  [📅 Schedule Call]      │
│  [📋 View Proposal]   [❓ Resources]    [💬 Message Trike]      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  EXPLORE THE PLATFORM                                           │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ 📚 Content   │  │ ✅ Compliance │  │ 📈 Analytics │          │
│  │ Library      │  │ Dashboard    │  │ Preview      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Onboarding State → Onboarding Portal

```
┌─────────────────────────────────────────────────────────────────┐
│ 🟠 TRIKE                                    [FiveStar Food Mart]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Welcome to Trike! Let's get you launched. 🚀                   │
│                                                                 │
│  GO-LIVE DATE: February 28, 2026 (36 days)                      │
│  ━━━━━━━━━━━━━━━━━━━░░░░░░░░░░░░░░░░░░░░░                       │
│  8 of 12 tasks complete                                         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  THIS WEEK'S PRIORITIES                                         │
│                                                                 │
│  ☐ Review and approve content library (4 of 12 albums)          │
│  ☐ Connect HRIS (Paylocity)                                     │
│  ☐ Add district managers as reviewers                           │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  FULL CHECKLIST                                                 │
│                                                                 │
│  ACCOUNT SETUP                                                  │
│  ☑ Company profile completed                                    │
│  ☑ Logo uploaded                                                │
│  ☑ Locations imported (95 stores)                               │
│                                                                 │
│  CONTENT                                                        │
│  ◐ Review template content (4/12)                               │
│  ☐ Upload existing materials                                    │
│                                                                 │
│  INTEGRATIONS                                                   │
│  ☐ Connect HRIS                                                 │
│  ☐ Import employee census                                       │
│                                                                 │
│  LAUNCH PREP                                                    │
│  ☐ Configure assignment rules                                   │
│  ☐ Schedule rollout comms                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Live State → Full Product

Standard Trike Backoffice dashboard with all features enabled.

### Frozen State → Limited Access

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Your demo access has expired.                                  │
│                                                                 │
│  You can still:                                                 │
│  • View your saved ROI analysis                                 │
│  • Review and sign your proposal                                │
│  • Access sales resources                                       │
│                                                                 │
│  Ready to continue?                                             │
│                                                                 │
│  [ Request Extension ]    [ Schedule Call with Jacob ]          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# Part 4: User Journeys

## Journey 1: Prospect Experience (Demo → Close)

### Stage 1A: Demo Request (Pre-System)

**Trigger:** Prospect requests demo via website, trade show, referral, etc.

**Jacob's Actions:**
1. Qualifies prospect (size, industry, timing)
2. Gathers basic info (company name, contact, locations, current solution)
3. Creates demo account in Trike Super Admin

---

### Stage 1B: Demo Creation (Jacob's Flow)

**Location:** Trike Super Admin → Deals → Create Demo

**UI:**
```
┌─────────────────────────────────────────────────────────────────┐
│ CREATE DEMO ACCOUNT                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  COMPANY INFO                                                   │
│  Company Name:        [ FiveStar Food Mart              ]       │
│  Industry:            [ Convenience Store            ▼ ]        │
│  Website:             [ www.fivestarfoodmart.com        ]       │
│                                                                 │
│  PRIMARY CONTACT                                                │
│  Name:                [ Meredith Goodin                 ]       │
│  Email:               [ meredith@fivestar.com           ]       │
│  Title:               [ Training Manager                ]       │
│                                                                 │
│  DEAL INFO                                                      │
│  Estimated Locations: [ 95         ]                            │
│  Estimated ARR:       [ $96,000    ] (auto-calculated)          │
│  Current Solution:    [ PlayerLync                   ▼ ]        │
│  Source:              [ Trade Show - NACS 2025       ▼ ]        │
│                                                                 │
│  DEMO SETTINGS                                                  │
│  Template:            [ C-Store Standard             ▼ ]        │
│  Expiration:          [ 14 ] days                               │
│  ☑ Include sample locations (5 stores)                          │
│  ☑ Include sample employees (50)                                │
│  ☑ Auto-detect compliance by state                              │
│  ☐ Pre-populate logo from website                               │
│                                                                 │
│  [ Create Demo Account ]                                        │
│                                                                 │
│  ⏱ Estimated setup time: < 2 minutes                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**System Actions:**
1. Create organization record with `status = 'prospect'`
2. Apply industry template (pre-configured content, sample data)
3. Create primary user account
4. Set `demo_expires_at` timestamp
5. Initialize engagement tracking
6. Send welcome email with login credentials
7. Add to Jacob's deal dashboard

**Definition of Done - Stage 1B:**
- [ ] Demo creation form validates all required fields
- [ ] Organization created with correct status and metadata
- [ ] Template content applied based on industry
- [ ] Sample data (locations, employees) created if selected
- [ ] Primary user created and can log in
- [ ] Welcome email sends with correct credentials
- [ ] Deal appears in Jacob's dashboard
- [ ] Engagement tracking initialized
- [ ] Total time from form submit to login-ready < 2 minutes

---

### Stage 2: First Login & Exploration (Days 1-7)

**Trigger:** Prospect clicks link in welcome email

**User Experience:**

1. **Welcome Modal (first login only)**
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Welcome to Trike, Meredith! 👋                                 │
│                                                                 │
│  This is your personalized demo of Trike Training Platform.     │
│                                                                 │
│  Over the next 14 days, you can:                                │
│  • Explore our content library                                  │
│  • Build an ROI analysis for FiveStar                           │
│  • Invite your team to review                                   │
│  • See how compliance tracking works                            │
│                                                                 │
│  Ready to get started?                                          │
│                                                                 │
│  [ Take a Quick Tour (3 min) ]    [ Explore on My Own ]         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

2. **Sales Room Dashboard** (as shown above in UI by State)

3. **Sales Content Library**

The "eat your own dogfood" principle: Sales materials ARE Trike content. Prospects experience the product BY consuming sales content.

```
SALES CONTENT LIBRARY

├── 📁 Getting Started
│   ├── 🎬 Platform Overview (3 min video)
│   ├── 🎬 Quick Feature Tour (5 min video)
│   └── 📄 How Trike is Different
│
├── 📁 For Your Team
│   ├── 📄 Executive Summary (1-pager for decision makers)
│   ├── 📄 IT & Security Overview
│   ├── 📄 Implementation Timeline
│   └── 📄 FAQ Document
│
├── 📁 ROI & Business Case
│   ├── 🔧 ROI Calculator (interactive)
│   ├── 📄 Cost Comparison Guide
│   ├── 📄 Training Time Analysis
│   └── 📄 Industry Case Studies
│
├── 📁 Product Deep Dives
│   ├── 🎬 Compliance Tracking Demo
│   ├── 🎬 Content Library Tour
│   ├── 🎬 Analytics & Reporting
│   └── 🎬 Mobile Experience
│
└── 📁 Your Proposal (appears when generated)
    ├── 📄 Custom Proposal
    ├── 📄 Pricing Breakdown
    └── ✍️ Agreement (e-sign)
```

**Key Feature: Platform Preview**

Prospects can explore a sandboxed version of the actual product:
- Content Library (with sample c-store training)
- Compliance Dashboard (with sample data)
- Analytics (with sample metrics)
- Employee view (experience as a learner)

Everything is clearly marked as "Sample Data" but functions like the real product.

**Engagement Events Tracked:**
- Login (timestamp, duration)
- Page views (which pages, time on page)
- Content started/completed
- Feature exploration (which features, time spent)
- ROI calculator interactions
- Downloads

**Definition of Done - Stage 2:**
- [ ] Welcome modal displays on first login only
- [ ] Quick tour video plays correctly
- [ ] Sales content library displays all items
- [ ] Sales content tracks completion
- [ ] Platform preview areas accessible
- [ ] Sample data clearly labeled
- [ ] All engagement events captured
- [ ] Demo expiration countdown accurate

---

### Stage 3: ROI Calculator

**Location:** Sales Room → ROI Calculator (or direct link)

**Purpose:** Capture prospect data while helping them build their business case

**UI - Input Phase:**
```
┌─────────────────────────────────────────────────────────────────┐
│ BUILD YOUR ROI COMPARISON                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ YOUR ORGANIZATION                                               │
│                                                                 │
│ Locations by State:                                             │
│ ┌─────────────┬─────────┬───────────┬────────────┐             │
│ │ State       │ Stores  │ Employees │ Avg Wage   │             │
│ ├─────────────┼─────────┼───────────┼────────────┤             │
│ │ Texas    ▼  │ 72      │ 610       │ $14.50     │             │
│ │ Louisiana▼  │ 15      │ 125       │ $13.75     │             │
│ │ Alabama  ▼  │ 8       │ 65        │ $12.50     │             │
│ │ + Add State │         │           │            │             │
│ └─────────────┴─────────┴───────────┴────────────┘             │
│                                                                 │
│ Total: 95 locations, ~800 employees                             │
│                                                                 │
│ Annual Turnover Rate:     [  85  ] %                            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ YOUR CURRENT SOLUTION                                           │
│                                                                 │
│ Current LMS/Training:     [ PlayerLync              ▼ ]         │
│                           ○ 360Training/RTO                     │
│                           ○ Schoox                              │
│                           ○ PlayerLync                          │
│                           ○ In-house/Manual                     │
│                           ○ None                                │
│                           ○ Other: ___________                  │
│                                                                 │
│ Annual Platform Cost:     $ [ 48,000  ]                         │
│ Avg Training Time/Hire:   [ 4.5 ] hours                         │
│ Admin Hours/Week:         [ 8   ] hours                         │
│                                                                 │
│ [ Calculate My ROI → ]                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**UI - Results Phase:**
```
┌─────────────────────────────────────────────────────────────────┐
│ YOUR PROJECTED SAVINGS                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │   ANNUAL SAVINGS WITH TRIKE                             │   │
│  │                                                         │   │
│  │   $92,900                                               │   │
│  │                                                         │   │
│  │   ROI: 258%                                             │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  BREAKDOWN                                                      │
│                                                                 │
│                        Current       Trike        Savings       │
│  ─────────────────────────────────────────────────────────      │
│  Platform Cost         $48,000      $36,000      $12,000        │
│  Training Labor        $156,000     $98,000      $58,000        │
│  Admin Labor           $19,200      $4,800       $14,400        │
│  Est. Compliance Risk  $8,500       $0           $8,500         │
│  ─────────────────────────────────────────────────────────      │
│  TOTAL                 $231,700     $138,800     $92,900        │
│                                                                 │
│  HOW WE CALCULATED THIS                                         │
│  [▼ Show calculation details]                                   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [ Download PDF ]  [ Share with Team ]  [ Edit Inputs ]         │
│                                                                 │
│  Ready to see this in a formal proposal?                        │
│  [ Request Proposal ]                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Calculation Logic:**

```javascript
// INPUTS
const locations = input.locations_by_state; // Array of {state, stores, employees, avg_wage}
const turnover = input.turnover_rate / 100;
const currentSolution = input.current_solution;
const currentCost = input.current_solution_cost;
const trainingHours = input.training_hours_per_hire || 4;
const adminHours = input.admin_hours_per_week || 6;

// DERIVED VALUES
const totalLocations = sum(locations.map(l => l.stores));
const totalEmployees = sum(locations.map(l => l.employees));
const avgWage = weightedAverage(locations, 'employees', 'avg_wage');
const annualNewHires = totalEmployees * turnover;
const adminHourlyRate = 25; // Assumed

// TRIKE PRICING
const trikePricePerLocation = 72; // Professional plan
const trikeAnnualCost = totalLocations * trikePricePerLocation * 12;

// PLATFORM SAVINGS
const platformSavings = currentCost - trikeAnnualCost;

// TRAINING TIME SAVINGS
// Assumption: Trike reduces training time by 40%
const currentTrainingCost = annualNewHires * trainingHours * avgWage;
const trikeTrainingCost = annualNewHires * (trainingHours * 0.6) * avgWage;
const trainingSavings = currentTrainingCost - trikeTrainingCost;

// ADMIN TIME SAVINGS
// Assumption: Trike reduces admin time by 75%
const currentAdminCost = adminHours * 52 * adminHourlyRate;
const trikeAdminCost = currentAdminCost * 0.25;
const adminSavings = currentAdminCost - trikeAdminCost;

// COMPLIANCE RISK REDUCTION
// Estimated based on industry data and state requirements
const complianceRisk = estimateComplianceRisk(locations, currentSolution);
const complianceSavings = complianceRisk; // Assume Trike = 0 risk

// TOTALS
const totalCurrentCost = currentCost + currentTrainingCost + currentAdminCost + complianceRisk;
const totalTrikeCost = trikeAnnualCost + trikeTrainingCost + trikeAdminCost;
const totalSavings = totalCurrentCost - totalTrikeCost;
const roi = (totalSavings / trikeAnnualCost) * 100;
```

**Data Persistence:**

All ROI inputs and outputs saved to `organization.roi_data`:

```json
{
  "inputs": {
    "locations_by_state": [...],
    "turnover_rate": 85,
    "current_solution": "PlayerLync",
    "current_solution_cost": 48000,
    "training_hours_per_hire": 4.5,
    "admin_hours_per_week": 8
  },
  "outputs": {
    "total_savings": 92900,
    "roi_percentage": 258,
    "platform_savings": 12000,
    "training_savings": 58000,
    "admin_savings": 14400,
    "compliance_savings": 8500,
    "trike_cost": 36000
  },
  "calculated_at": "2026-01-23T14:30:00Z",
  "version": 1
}
```

This data flows to:
- Proposal (auto-populated executive summary)
- Post-sale QBR dashboards (baseline for comparison)
- Renewal conversations (ROI validation)

**Definition of Done - ROI Calculator:**
- [ ] All input fields capture and validate
- [ ] State dropdown includes all US states with relevant compliance
- [ ] Competitor dropdown includes known solutions
- [ ] Calculations match approved formulas (verified by Jacob)
- [ ] Results display clearly with breakdown
- [ ] "Show calculation details" expands methodology
- [ ] PDF export generates clean, branded document
- [ ] "Share with Team" creates shareable link
- [ ] Data saves to organization record
- [ ] Changes tracked with version history
- [ ] "Request Proposal" action notifies Jacob

---

### Stage 4: Invite Reviewers

**Purpose:** Enable multi-stakeholder evaluation; track engagement by role

**UI:**
```
┌─────────────────────────────────────────────────────────────────┐
│ INVITE YOUR TEAM                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Add colleagues to review Trike with you.                        │
│                                                                 │
│ CURRENT TEAM                                                    │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 👤 Meredith Goodin (you)                        Champion    │ │
│ │    meredith@fivestar.com                                    │ │
│ │    Last active: Just now                                    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ INVITE NEW REVIEWER                                             │
│                                                                 │
│ Email:          [ glenn@fivestar.com                  ]         │
│ Name:           [ Glenn Higdon                        ]         │
│ Role:           [ Decision Maker                   ▼ ]          │
│                 ○ Decision Maker (signs contracts)              │
│                 ○ IT / Security (reviews tech requirements)     │
│                 ○ Finance (reviews pricing)                     │
│                 ○ Operations (reviews implementation)           │
│                 ○ Other Reviewer                                │
│                                                                 │
│ What can they access?                                           │
│ ☑ All sales content                                             │
│ ☑ ROI calculator results                                        │
│ ☐ Edit ROI inputs                                               │
│ ☑ Platform preview                                              │
│ ☑ Proposal (when available)                                     │
│                                                                 │
│ [ Send Invitation ]                                             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ PENDING INVITATIONS                                             │
│                                                                 │
│ glenn@fivestar.com (Decision Maker)          Sent 2 days ago    │
│ [ Resend ]  [ Cancel ]                                          │
│                                                                 │
│ it-contact@fivestar.com (IT / Security)      Sent 5 days ago    │
│ [ Resend ]  [ Cancel ]                       ⚠️ Not yet joined  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**System Actions on Invite:**
1. Create user record with role and permissions
2. Send invitation email with personalized message
3. Update deal stage if first reviewer (prospect → evaluating)
4. Add to engagement tracking

**Invitation Email Template:**
```
Subject: Meredith invited you to review Trike Training

Hi Glenn,

Meredith Goodin invited you to review Trike Training Platform 
for FiveStar Food Mart.

As the Decision Maker, you'll be able to:
• Review our ROI analysis showing $92,900 in projected savings
• Explore the platform features
• View and approve the proposal when ready

[Access Your Review Portal →]

Questions? Reply to this email or message us directly in the platform.

— The Trike Team
```

**Definition of Done - Invite Reviewers:**
- [ ] Invite form validates email format
- [ ] Role selection captures correctly
- [ ] Permissions matrix enforces access
- [ ] Invitation email sends with correct content
- [ ] Pending invitations display with status
- [ ] Resend and cancel actions work
- [ ] Reviewer login creates engagement events
- [ ] Reviewer role visible in Jacob's deal analytics

---

### Stage 5: Proposal Request & Generation

**Trigger:** Prospect clicks "Request Proposal" OR Jacob initiates

**Jacob's Notification:**
```
🔔 New Proposal Request

FiveStar Food Mart requested a proposal

Engagement Score: 72/100
Champion: Meredith Goodin (very active)
Decision Maker: Glenn Higdon (2 logins, viewed ROI)
ROI Completed: Yes ($92,900 savings)

[Generate Proposal →]  [View Deal →]
```

**Jacob's Proposal Builder:**
```
┌─────────────────────────────────────────────────────────────────┐
│ CREATE PROPOSAL: FiveStar Food Mart                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ TEMPLATE: [ Enterprise - Convenience Store          ▼ ]         │
│                                                                 │
│ AUTO-POPULATED FROM ROI CALCULATOR                              │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Company: FiveStar Food Mart                                 │ │
│ │ Locations: 95 (TX: 72, LA: 15, AL: 8)                       │ │
│ │ Employees: ~800                                             │ │
│ │ Turnover: 85%                                               │ │
│ │ Current Solution: PlayerLync @ $48K/year                    │ │
│ │ Projected Savings: $92,900/year                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ PROPOSAL SECTIONS                           ☑ = Include         │
│ ─────────────────────────────────────────────────────────────── │
│ ☑ Executive Summary (auto-generated)                            │
│ ☑ Platform Overview                                             │
│ ☑ Content Library (their industry)                              │
│ ☑ Compliance Coverage by State                                  │
│   └ TX: TABC, Food Handler, UST                                 │
│   └ LA: ATC, Food Handler                                       │
│   └ AL: ABC, Food Handler                                       │
│ ☑ Implementation Timeline                                       │
│ ☑ ROI Summary (from calculator)                                 │
│ ☑ Pricing                                                       │
│ ☐ Case Studies (optional)                                       │
│ ☑ Terms & Agreement                                             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ PRICING CONFIGURATION                                           │
│                                                                 │
│ Base Plan: [ Professional          ▼ ]     $72/location/mo      │
│                                                                 │
│ Add-Ons:                                                        │
│ ☑ Compliance Automation      +$15/loc/mo         +$17,100/yr    │
│ ☐ Custom Content Creation    +$500/mo            +$6,000/yr     │
│ ☑ HRIS Integration           +$200/mo            +$2,400/yr     │
│ ☐ Dedicated Success Manager  +$500/mo            +$6,000/yr     │
│                                                                 │
│ Term: [ 3 years ▼ ]                                             │
│ Discount: [ 10 ]% (3-year term discount)                        │
│                                                                 │
│ ───────────────────────────────────────────────────────────     │
│ Subtotal:         $101,580/year                                 │
│ Discount:         -$10,158                                      │
│ TOTAL:            $91,422/year ($7,619/month)                   │
│ ───────────────────────────────────────────────────────────     │
│                                                                 │
│ [ Preview Proposal ]  [ Save Draft ]  [ Send to Client ]        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Proposal Document Structure:**

```markdown
# FiveStar Food Mart + Trike Training
## Partnership Proposal

Prepared: January 23, 2026
Valid Until: February 23, 2026

---

## Executive Summary

Based on your 95 locations across Texas, Louisiana, and Alabama, 
with approximately 800 employees and 85% annual turnover, 
Trike Training will deliver:

• **$92,900 in annual savings** vs. your current solution
• **100% compliance coverage** for TABC, ATC, ABC, and Food Handler
• **45% reduction** in training time per new hire
• **75% reduction** in administrative overhead

---

## Platform Overview
[Standard content about Trike features]

---

## Your Content Library
[List of included content for c-store industry]

---

## Compliance Coverage

| State | Employees | Required Certifications | Included |
|-------|-----------|------------------------|----------|
| Texas | 610 | TABC, Food Handler, UST | ✓ |
| Louisiana | 125 | ATC, Food Handler | ✓ |
| Alabama | 65 | ABC, Food Handler | ✓ |

---

## Implementation Timeline

| Week | Milestone |
|------|-----------|
| 1-2 | Account setup, branding, location import |
| 2-3 | Content review and approval |
| 3-4 | HRIS integration, employee import |
| 4 | Assignment rules, rollout planning |
| 5 | Go-live, employee invitations |

---

## Your ROI

[Auto-populated from ROI calculator with charts]

---

## Investment

**Professional Plan with Compliance & HRIS Integration**

| Item | Monthly | Annual |
|------|---------|--------|
| Professional Plan (95 locations) | $6,840 | $82,080 |
| Compliance Automation | $1,425 | $17,100 |
| HRIS Integration | $200 | $2,400 |
| **Subtotal** | $8,465 | $101,580 |
| 3-Year Term Discount (10%) | -$847 | -$10,158 |
| **Total** | **$7,619** | **$91,422** |

---

## Terms & Agreement

[Standard terms]

[SIGNATURE BLOCK]
```

**What Prospect Sees:**

Proposal appears in their Sales Content Library under "Your Proposal":

```
┌─────────────────────────────────────────────────────────────────┐
│ YOUR PROPOSAL                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ FiveStar Food Mart + Trike Training                             │
│ Prepared January 23, 2026                                       │
│                                                                 │
│ QUICK SUMMARY                                                   │
│ ─────────────────────────────────────────────────────────────── │
│ Annual Investment: $91,422                                      │
│ Projected Savings: $92,900                                      │
│ ROI: 258%                                                       │
│ Term: 3 years                                                   │
│                                                                 │
│ [ View Full Proposal ]                                          │
│ [ Download PDF ]                                                │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ READY TO MOVE FORWARD?                                          │
│                                                                 │
│ [ Review & Sign Agreement ]                                     │
│                                                                 │
│ Questions?                                                      │
│ [ Schedule a Call ]  [ Message Jacob ]                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Definition of Done - Proposal Builder:**
- [ ] Template selection works with multiple templates
- [ ] Auto-population from ROI data accurate
- [ ] Section toggles include/exclude correctly
- [ ] Pricing calculator accurate with add-ons
- [ ] Discount calculation correct
- [ ] Preview shows formatted proposal
- [ ] PDF generation clean and branded
- [ ] "Send to Client" notifies prospect and updates deal stage
- [ ] Proposal appears in prospect's Sales Content Library
- [ ] Proposal views tracked in engagement

---

### Stage 6: Agreement & Close

**E-Sign Flow:**

```
┌─────────────────────────────────────────────────────────────────┐
│ REVIEW & SIGN AGREEMENT                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ AGREEMENT SUMMARY                                               │
│                                                                 │
│ Parties: FiveStar Food Mart and Trike Training, Inc.            │
│ Term: 3 years (February 1, 2026 - January 31, 2029)             │
│ Annual Investment: $91,422                                      │
│ Billing: Monthly ($7,619/month)                                 │
│                                                                 │
│ [ View Full Agreement (PDF) ]                                   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ SIGN BELOW                                                      │
│                                                                 │
│ By signing, you agree to the terms and conditions of the        │
│ Trike Training Master Service Agreement.                        │
│                                                                 │
│ Signature:  ┌─────────────────────────────────────────────────┐ │
│             │                                                 │ │
│             │  [Draw or type your signature]                  │ │
│             │                                                 │ │
│             └─────────────────────────────────────────────────┘ │
│                                                                 │
│ Full Name: [ Glenn Higdon                         ]             │
│ Title:     [ VP Operations                        ]             │
│ Date:      January 23, 2026                                     │
│                                                                 │
│ ☑ I have read and agree to the Master Service Agreement         │
│ ☑ I am authorized to sign on behalf of FiveStar Food Mart       │
│                                                                 │
│ [ Complete Signature ]                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Payment Setup (follows signature):**

```
┌─────────────────────────────────────────────────────────────────┐
│ SET UP PAYMENT                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 🎉 Agreement signed! One more step to get started.              │
│                                                                 │
│ BILLING DETAILS                                                 │
│                                                                 │
│ Amount: $7,619/month                                            │
│ First charge: February 1, 2026                                  │
│ Billing cycle: Monthly on the 1st                               │
│                                                                 │
│ PAYMENT METHOD                                                  │
│                                                                 │
│ [ Credit Card ]  [ ACH / Bank Transfer ]  [ Invoice Me ]        │
│                                                                 │
│ [Stripe Payment Element Embed]                                  │
│                                                                 │
│ OR                                                              │
│                                                                 │
│ Need to involve your finance team?                              │
│ [ Send Payment Link to Finance → ]                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**System Actions on Close:**

1. Generate executed agreement PDF (with signatures, timestamps)
2. Store agreement in document repository
3. Create Stripe subscription
4. Update organization: `status = 'onboarding'`
5. Transform portal to onboarding mode
6. Initialize onboarding checklist
7. Send welcome email sequence
8. Notify Jacob
9. Populate onboarding calendar based on go-live estimate

**Definition of Done - Agreement & Close:**
- [ ] Agreement displays correctly with all terms
- [ ] Signature capture works (draw or type)
- [ ] Name and title fields required
- [ ] Checkboxes required before submit
- [ ] Executed agreement PDF generated
- [ ] Stripe subscription created correctly
- [ ] Organization status transitions to 'onboarding'
- [ ] Portal transforms to onboarding mode
- [ ] Welcome emails send
- [ ] Jacob notified of close

---

## Journey 2: Onboarding Experience (Close → Live)

### Stage 1: Kickoff (Days 0-3)

**Trigger:** Agreement signed, payment set up

**System Actions:**
1. Update status: closing → onboarding
2. Generate onboarding checklist based on plan/add-ons
3. Calculate default go-live date (30 days out)
4. Create onboarding calendar events
5. Send kickoff email sequence
6. Initialize onboarding health tracking

**Prospect Experience:**

Portal transforms. Sales Room becomes Onboarding Hub.

```
┌─────────────────────────────────────────────────────────────────┐
│ 🟠 TRIKE                                    [FiveStar Food Mart]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🎉 Welcome to Trike!                                           │
│                                                                 │
│  Let's get you set up for success. Here's your onboarding       │
│  roadmap. Most clients launch within 3-4 weeks.                 │
│                                                                 │
│  PICK YOUR GO-LIVE DATE                                         │
│                                                                 │
│  When do you want to launch Trike to your team?                 │
│                                                                 │
│  [ February 28, 2026          📅 ]                              │
│                                                                 │
│  ⏱ This gives you 36 days to prepare.                           │
│    Recommended: At least 21 days for smooth implementation.     │
│                                                                 │
│  [ Set Go-Live Date ]                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Definition of Done - Kickoff:**
- [ ] Portal transforms correctly on status change
- [ ] Go-live date picker works with validation
- [ ] Checklist generates based on plan/add-ons
- [ ] Calendar events created
- [ ] Welcome emails send
- [ ] Onboarding health tracking initialized

---

### Stage 2: Account Setup (Days 3-7)

**Tasks:**
- Complete company profile
- Upload logo
- Import locations
- Add admin users

**Company Profile:**
```
┌─────────────────────────────────────────────────────────────────┐
│ COMPLETE YOUR COMPANY PROFILE                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ BASIC INFO (pre-populated from sales)                           │
│                                                                 │
│ Company Name:    [ FiveStar Food Mart               ]           │
│ Industry:        [ Convenience Store             ▼ ]            │
│ Website:         [ www.fivestarfoodmart.com         ]           │
│                                                                 │
│ BRANDING                                                        │
│                                                                 │
│ Logo:            [ Upload Logo ]                                │
│                  Recommended: 200x50px, PNG or SVG              │
│                                                                 │
│ Primary Color:   [ #FF6B00 ] 🟠                                 │
│                                                                 │
│ CONTACT INFO                                                    │
│                                                                 │
│ Primary Contact: [ Meredith Goodin                  ]           │
│ Email:           [ meredith@fivestar.com            ]           │
│ Phone:           [ (555) 123-4567                   ]           │
│                                                                 │
│ [ Save Profile ]                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Location Import:**
```
┌─────────────────────────────────────────────────────────────────┐
│ IMPORT YOUR LOCATIONS                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ We found 95 locations in your ROI analysis.                     │
│ Let's get the details for each one.                             │
│                                                                 │
│ OPTION 1: Upload CSV                                            │
│                                                                 │
│ [ Download Template ]  [ Upload CSV ]                           │
│                                                                 │
│ Your CSV should include:                                        │
│ • Store ID/Number                                               │
│ • Store Name                                                    │
│ • Address, City, State, ZIP                                     │
│ • Manager Name (optional)                                       │
│ • Manager Email (optional)                                      │
│                                                                 │
│ ───────────────────────────────────────────────────────────     │
│                                                                 │
│ OPTION 2: Manual Entry                                          │
│                                                                 │
│ Store #  │ Name           │ State │ City      │ Manager         │
│ ─────────┼────────────────┼───────┼───────────┼──────────────── │
│ 001      │ Downtown       │ TX    │ Dallas    │ Sarah Johnson   │
│ 002      │ Oak Street     │ TX    │ Dallas    │ Mike Chen       │
│ 003      │ Highway 75     │ TX    │ Plano     │ Lisa Rodriguez  │
│ + Add Location                                                  │
│                                                                 │
│ Imported: 3 of 95 locations                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Admin User Setup:**
```
┌─────────────────────────────────────────────────────────────────┐
│ ADD YOUR ADMIN TEAM                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Who will manage Trike day-to-day?                               │
│                                                                 │
│ CURRENT ADMINS                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 👤 Meredith Goodin              Super Admin                 │ │
│ │    meredith@fivestar.com                                    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ADD NEW ADMIN                                                   │
│                                                                 │
│ Name:     [ John Smith                        ]                 │
│ Email:    [ john.smith@fivestar.com           ]                 │
│ Role:     [ Regional Admin               ▼ ]                    │
│                                                                 │
│           ○ Super Admin - Full access to everything             │
│           ○ Regional Admin - Manage assigned regions            │
│           ○ Store Manager - Single location access              │
│           ○ Content Admin - Manage content library              │
│           ○ Reports Only - View-only access to reports          │
│                                                                 │
│ Locations: [ All Texas Locations          ▼ ]                   │
│                                                                 │
│ [ Send Invitation ]                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Definition of Done - Account Setup:**
- [ ] Company profile saves all fields
- [ ] Logo upload works (validates size/format)
- [ ] Branding colors apply across platform
- [ ] CSV template downloads correctly
- [ ] CSV import parses and validates
- [ ] Manual location entry works
- [ ] Admin roles apply correct permissions
- [ ] Admin invitations send correctly
- [ ] Checklist items auto-complete on task completion

---

### Stage 3: Content Review (Days 7-14)

**Purpose:** Client reviews and approves training content before launch

**Frame.io-Style Review Interface:**

```
┌─────────────────────────────────────────────────────────────────┐
│ CONTENT REVIEW                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Review and approve the training content for your team.          │
│ You can request changes or add custom content later.            │
│                                                                 │
│ PROGRESS: 4 of 12 albums reviewed                               │
│ ━━━━━━━━━━━━━━━━░░░░░░░░░░░░░░░░░░░░░░░░░                       │
│                                                                 │
│ CONTENT LIBRARY                                                 │
│                                                                 │
│ COMPLIANCE TRAINING (Required)                                  │
│ ├── ✅ TABC Certification (TX)                    Approved      │
│ ├── ✅ Food Handler Safety                        Approved      │
│ ├── ⏳ Louisiana ATC (LA)                         In Review     │
│ └── ☐ Alabama ABC (AL)                            Not Started   │
│                                                                 │
│ OPERATIONS TRAINING                                             │
│ ├── ✅ New Hire Onboarding                        Approved      │
│ ├── ✅ Customer Service Excellence                Approved      │
│ ├── ⏳ Cash Handling & Register                   In Review     │
│ └── ☐ Fuel Safety Procedures                      Not Started   │
│                                                                 │
│ SAFETY TRAINING                                                 │
│ ├── ☐ Emergency Procedures                        Not Started   │
│ ├── ☐ Workplace Safety                            Not Started   │
│ └── ☐ Robbery Prevention                          Not Started   │
│                                                                 │
│ [ Continue Review → ]                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Individual Content Review:**

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back to Library          Louisiana ATC Certification          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌───────────────────────────────────────┐  REVIEW STATUS        │
│ │                                       │                       │
│ │                                       │  Reviewers:           │
│ │         [Video Player]                │  ☑ Meredith - Done    │
│ │         Module 1: Introduction        │  ⏳ John - In Progress│
│ │                                       │                       │
│ │     advancement  ▶  02:34 / 08:15     │  Need 2 approvals     │
│ │                                       │  to publish           │
│ └───────────────────────────────────────┘                       │
│                                                                 │
│ MODULES IN THIS COURSE                   COMMENTS               │
│                                          ─────────────────────  │
│ ☑ 1. Introduction           3:15        Meredith (Jan 22):     │
│ ☑ 2. Louisiana Alcohol Laws 8:15        "This looks great!     │
│ ◐ 3. Checking IDs           6:30 ◀      Can we add our company │
│ ☐ 4. Refusing Sales         4:45        policy about refusing  │
│ ☐ 5. Documentation          3:00        sales?"                │
│ ☐ 6. Final Assessment       10 Q                               │
│                                          [ Reply ]              │
│                                                                 │
│                                          + Add Comment          │
│                                          (click video to add    │
│                                          timestamp)             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ [ ← Previous ]  [ Approve Course ]  [ Request Changes ]  [ Next → ]
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Multi-Reviewer Workflow:**

```yaml
content_review:
  album_id: "louisiana-atc"
  required_approvals: 2
  
  reviewers:
    - user: meredith@fivestar.com
      role: champion
      status: approved
      approved_at: "2026-01-22T14:30:00Z"
      
    - user: john@fivestar.com
      role: regional_admin
      status: in_progress
      modules_reviewed: 2
      modules_total: 6
      
  comments:
    - id: "cmt_001"
      user: meredith@fivestar.com
      module: "3. Checking IDs"
      timestamp_seconds: 145
      text: "Can we add our company policy about refusing sales?"
      status: open
      created_at: "2026-01-22T14:35:00Z"
```

**Definition of Done - Content Review:**
- [ ] Review list shows all assigned content
- [ ] Progress calculates correctly
- [ ] Video player works in review interface
- [ ] Comments save with optional timestamps
- [ ] Comments support replies and resolution
- [ ] Multi-reviewer tracking accurate
- [ ] Approval gates enforce requirements
- [ ] "Request Changes" creates notification to Trike
- [ ] Bulk approve option works
- [ ] Checklist updates on all content approved

---

### Stage 4: Integration Setup (Days 7-14, parallel)

**HRIS Connection (via Merge.dev):**

```
┌─────────────────────────────────────────────────────────────────┐
│ CONNECT YOUR HR SYSTEM                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Connect your HRIS to automatically sync employee data.          │
│                                                                 │
│ SELECT YOUR SYSTEM                                              │
│                                                                 │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐    │
│ │            │ │            │ │            │ │            │    │
│ │ Paylocity  │ │    UKG     │ │    ADP     │ │  BambooHR  │    │
│ │            │ │            │ │            │ │            │    │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘    │
│                                                                 │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐    │
│ │            │ │            │ │            │ │            │    │
│ │   Gusto    │ │  Paychex   │ │  Paycom    │ │   Other    │    │
│ │            │ │            │ │            │ │            │    │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘    │
│                                                                 │
│ [ Connect Paylocity → ]                                         │
│                                                                 │
│ This will sync:                                                 │
│ ☑ Employee roster (name, email, hire date)                      │
│ ☑ Locations/departments                                         │
│ ☑ Job titles and roles                                          │
│ ☐ Terminations (enable after go-live)                           │
│                                                                 │
│ Data syncs automatically every 24 hours.                        │
│ First sync usually takes 5-10 minutes.                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Employee Census QA:**

```
┌─────────────────────────────────────────────────────────────────┐
│ REVIEW EMPLOYEE IMPORT                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ✅ Sync complete! 847 employees imported from Paylocity.        │
│                                                                 │
│ DATA QUALITY CHECK                                              │
│                                                                 │
│ ⚠ 12 issues found (resolve before launch)                       │
│                                                                 │
│ MISSING EMAIL (8 employees)                                     │
│ These employees won't receive login invitations:                │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ John Doe        Store #045    Sales Associate               │ │
│ │ Jane Smith      Store #012    Cashier                       │ │
│ │ ... and 6 more                                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ [ Add Missing Emails ]  [ Exclude from Launch ]                 │
│                                                                 │
│ INVALID LOCATION (3 employees)                                  │
│ These employees are assigned to locations not in Trike:         │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Mike Johnson    Store #099    (not found)                   │ │
│ │ Sarah Lee       Store #100    (not found)                   │ │
│ │ Tom Brown       Store #101    (not found)                   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ [ Add Missing Locations ]  [ Reassign Employees ]               │
│                                                                 │
│ DUPLICATE RECORDS (1 employee)                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Chris Williams appears twice with different emails          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ [ Resolve Duplicate ]                                           │
│                                                                 │
│ [ Accept and Continue (12 issues) ]                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Role Mapping:**

```
┌─────────────────────────────────────────────────────────────────┐
│ MAP ROLES TO TRAINING PATHS                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Tell us which training each job role should receive.            │
│                                                                 │
│ YOUR HRIS ROLES              TRIKE TRAINING PATH                │
│ ─────────────────────────────────────────────────────────────── │
│ Sales Associate (412)    →   [ Hourly Onboarding        ▼ ]     │
│ Cashier (215)            →   [ Hourly Onboarding        ▼ ]     │
│ Shift Lead (89)          →   [ Shift Lead Training      ▼ ]     │
│ Assistant Manager (45)   →   [ Manager Onboarding       ▼ ]     │
│ Store Manager (67)       →   [ Manager Onboarding       ▼ ]     │
│ District Manager (12)    →   [ Leadership Development   ▼ ]     │
│ Regional VP (4)          →   [ Executive Overview       ▼ ]     │
│ Corporate (3)            →   [ No Training Required     ▼ ]     │
│                                                                 │
│ TRAINING PATHS                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Hourly Onboarding                                           │ │
│ │ • Food Safety, Alcohol Sales (state-specific)               │ │
│ │ • Customer Service, Cash Handling                           │ │
│ │ • ~8 hours total, due in 30 days                            │ │
│ │                                                             │ │
│ │ Manager Onboarding                                          │ │
│ │ • Everything in Hourly +                                    │ │
│ │ • Leadership basics, Compliance management                  │ │
│ │ • ~12 hours total, due in 45 days                           │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ [ Auto-Map by Role Name ]  [ Save Mapping ]                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Definition of Done - Integration Setup:**
- [ ] Merge.dev OAuth flow completes for supported HRIS
- [ ] Initial sync imports employee data
- [ ] Data quality issues surface clearly
- [ ] Issue resolution workflows work
- [ ] Role mapping saves and displays employee counts
- [ ] Auto-map attempts matching by role name
- [ ] Checklist updates on integration complete

---

### Stage 5: Launch Preparation (Days 14-21)

**Assignment Rules Setup:**

(Uses the Rules engine from the prior playlist automation spec)

```
┌─────────────────────────────────────────────────────────────────┐
│ CONFIGURE TRAINING AUTOMATIONS                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Set up rules for automatic training assignments.                │
│                                                                 │
│ RECOMMENDED RULES (based on your setup)                         │
│                                                                 │
│ ☑ New Hire Onboarding                                           │
│   When: Employee created in HRIS                                │
│   Assign: Hourly Onboarding playlist                            │
│   Due: 30 days after hire date                                  │
│   [ Edit Rule ]                                                 │
│                                                                 │
│ ☑ Annual Compliance Recertification                             │
│   When: 11 months after last completion                         │
│   Assign: State-specific compliance refresher                   │
│   Due: 30 days                                                  │
│   [ Edit Rule ]                                                 │
│                                                                 │
│ ☑ Promotion Training                                            │
│   When: Role changes to Manager                                 │
│   Assign: Manager Onboarding playlist                           │
│   Due: 45 days                                                  │
│   [ Edit Rule ]                                                 │
│                                                                 │
│ [ + Create Custom Rule ]                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Rollout Communications:**

```
┌─────────────────────────────────────────────────────────────────┐
│ PLAN YOUR ROLLOUT COMMUNICATIONS                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ GO-LIVE: February 28, 2026                                      │
│                                                                 │
│ We recommend a communication sequence to prepare your team.     │
│ Customize and schedule each message.                            │
│                                                                 │
│ SCHEDULED COMMUNICATIONS                                        │
│                                                                 │
│ Feb 14 │ 📧 Leadership Announcement                             │
│ -14d   │    From: CEO → All Managers                            │
│        │    "Introducing our new training platform"             │
│        │    [ Preview ] [ Edit ] [ Schedule ✓ ]                 │
│        │                                                        │
│ Feb 21 │ 📧 Manager Preview & Training                          │
│ -7d    │    From: HR → All Managers                             │
│        │    "Get familiar before your team does"                │
│        │    [ Preview ] [ Edit ] [ Schedule ]                   │
│        │                                                        │
│ Feb 26 │ 📧 All-Hands Heads Up                                  │
│ -2d    │    From: HR → All Employees                            │
│        │    "New training system launching Monday"              │
│        │    [ Preview ] [ Edit ] [ Schedule ]                   │
│        │                                                        │
│ Feb 28 │ 🚀 LAUNCH DAY                                          │
│  Day 0 │    System sends individual login invitations           │
│        │    [ Preview Invitation Template ]                     │
│        │                                                        │
│ Mar 1  │ 📧 Reminder to Non-Activated                           │
│ +1d    │    Auto-sent to those who haven't logged in            │
│        │    [ Preview ] [ Edit ]                                │
│        │                                                        │
│ Mar 7  │ 📧 Manager Nudge                                       │
│ +7d    │    From: System → Managers with low activation         │
│        │    "Your team's activation status"                     │
│        │    [ Preview ] [ Edit ]                                │
│                                                                 │
│ [ + Add Custom Communication ]                                  │
│                                                                 │
│ TEMPLATES AVAILABLE                                             │
│ • Leadership announcement (email)                               │
│ • Manager talking points (PDF)                                  │
│ • Employee FAQ (PDF)                                            │
│ • Poster for break rooms (PDF)                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Launch Readiness Gate:**

```
┌─────────────────────────────────────────────────────────────────┐
│ LAUNCH READINESS CHECK                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ GO-LIVE: February 28, 2026 (7 days away)                        │
│                                                                 │
│ REQUIRED (must complete before launch)                          │
│                                                                 │
│ ☑ Company profile complete                                      │
│ ☑ Locations imported (95 locations)                             │
│ ☑ Admin team added (4 admins)                                   │
│ ☑ HRIS connected and synced (847 employees)                     │
│ ☑ All content reviewed and approved (12 albums)                 │
│ ☑ Role mapping configured                                       │
│ ☑ Assignment rules active                                       │
│ ☐ Rollout communications scheduled          ← BLOCKING          │
│                                                                 │
│ RECOMMENDED (can complete after launch)                         │
│                                                                 │
│ ☐ Custom branding finalized                                     │
│ ☐ Legacy training records imported                              │
│ ☐ SCORM content migrated                                        │
│                                                                 │
│ [ Launch Now ] (disabled - 1 blocking item)                     │
│                                                                 │
│ Need to delay your launch?                                      │
│ [ Change Go-Live Date ]                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Definition of Done - Launch Prep:**
- [ ] Recommended rules auto-generate based on setup
- [ ] Custom rule creation works
- [ ] Communication templates are editable
- [ ] Communication scheduling works
- [ ] Readiness gate enforces requirements
- [ ] Launch button disabled until all required complete
- [ ] Date change updates all scheduled items

---

### Stage 6: Go-Live (Day 0)

**Trigger:** Go-live date reached AND readiness confirmed

**System Actions:**
1. Send all employee invitations (staggered to avoid email overload)
2. Activate all assignment rules
3. Create initial assignments for current employees
4. Enable learner dashboards
5. Transform admin portal to "live" mode
6. Initialize activation tracking
7. Start Day 1 reminder queue

**Admin Experience:**

```
┌─────────────────────────────────────────────────────────────────┐
│ 🎉 YOU'RE LIVE!                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Trike is now live for your team!                                │
│                                                                 │
│ Invitations sent to 847 employees.                              │
│ First assignments created.                                      │
│                                                                 │
│ ACTIVATION TRACKER (updates live)                               │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│ Invited     │ ████████████████████████████████████████ 847      │
│ Opened      │ ████████████████████░░░░░░░░░░░░░░░░░░░░ 412 49%  │
│ Activated   │ ██████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 234 28%  │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ 📈 You're tracking ahead of typical launches!                   │
│    Average activation at this point: 22%                        │
│                                                                 │
│ BY REGION                                                       │
│                                                                 │
│ Central TX (32 stores)  │ █████████████████████░░░ 78%          │
│ East TX (40 stores)     │ █████████████████░░░░░░░ 65%          │
│ Louisiana (15 stores)   │ ███████████░░░░░░░░░░░░░ 42%          │
│ Alabama (8 stores)      │ ██████░░░░░░░░░░░░░░░░░░ 23%  ⚠ LOW   │
│                                                                 │
│ [ View by Location ]  [ Download Report ]                       │
│                                                                 │
│ QUICK ACTIONS                                                   │
│                                                                 │
│ [ Send Reminder to Non-Activated ]                              │
│ [ Message Alabama Managers ]                                    │
│ [ View Activation Details ]                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Definition of Done - Go-Live:**
- [ ] Invitations send correctly (staggered)
- [ ] Assignment rules execute
- [ ] Initial assignments created
- [ ] Activation tracking real-time
- [ ] Regional breakdown accurate
- [ ] Reminder actions work
- [ ] Portal transforms to live mode
- [ ] Onboarding checklist shows "Complete"

---

### Stage 7: Post-Launch Support (Days 1-14)

**Health Score Dashboard:**

```
┌─────────────────────────────────────────────────────────────────┐
│ LAUNCH HEALTH                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Day 7 of Launch                           Health Score: 82/100  │
│                                                                 │
│ METRICS                                                         │
│                                                                 │
│ Activation Rate (7-day)    82%    🟢 Target: 70%                │
│ Manager Logins             92%    🟢 Target: 80%                │
│ First Completions          18%    🟢 On track for 30-day target │
│ Support Tickets            3      🟢 Low (typical: 5-10)        │
│ HRIS Sync                  ✓      🟢 Last sync: 2 hours ago     │
│                                                                 │
│ UPCOMING MILESTONES                                             │
│                                                                 │
│ ☑ Day 1: 25% activation                    ✓ Achieved (28%)     │
│ ☑ Day 7: 70% activation                    ✓ Achieved (82%)     │
│ ☐ Day 14: 50% first completion             On track             │
│ ☐ Day 30: 80% compliance complete          On track             │
│                                                                 │
│ YOUR 14-DAY CHECK-IN                                            │
│                                                                 │
│ Scheduled: March 14, 2026 at 2:00 PM CT with Jacob              │
│ [ Reschedule ]  [ Add to Calendar ]                             │
│                                                                 │
│ Topics:                                                         │
│ • Review activation and completion metrics                      │
│ • Address any issues or questions                               │
│ • Plan for ongoing success                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Definition of Done - Post-Launch:**
- [ ] Health score calculates from multiple factors
- [ ] Milestones track automatically
- [ ] Check-in scheduling works
- [ ] Onboarding complete when health score stable for 7 days

---

# Part 5: Jacob's Super Admin Experience

## Deal Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│ DEALS                                                   Q1 2026 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ PIPELINE SUMMARY                                                │
│                                                                 │
│ Total ARR: $412K                                                │
│                                                                 │
│ Demo      ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░  $68K  (2 deals)     │
│ Evaluating██████████░░░░░░░░░░░░░░░░░░░░░  $143K (3 deals)     │
│ Closing   ██████████████████░░░░░░░░░░░░░  $201K (2 deals)     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 🔥 NEEDS ATTENTION                                              │
│                                                                 │
│ • FiveStar - Decision maker inactive 5 days (Evaluating, $96K)  │
│   └ [ Send Glenn the ROI summary ]  [ Schedule call ]           │
│                                                                 │
│ • Herdich - Demo expires tomorrow (Demo, $27K)                  │
│   └ [ Extend demo ]  [ Send proposal ]  [ Mark lost ]           │
│                                                                 │
│ • Eagle Stop - IT blocker hasn't engaged (Closing, $143K)       │
│   └ [ Resend IT invite ]  [ Send security docs ]                │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ALL DEALS                                                       │
│                                                                 │
│ Company              ARR      Stage        Score    Activity    │
│ ───────────────────────────────────────────────────────────     │
│ Kent Companies       $143K    Closing      92 🟢   2 hours      │
│   └ Proposal signed, awaiting payment                           │
│                                                                 │
│ Murphy USA           $850K    Evaluating   67 🟡   3 days       │
│   └ 5 reviewers, strong engagement, need proposal               │
│                                                                 │
│ FiveStar             $96K     Evaluating   45 🟡   5 days       │
│   └ Champion active, DM going cold                              │
│                                                                 │
│ Eagle Stop           $58K     Closing      78 🟢   1 day        │
│   └ Proposal sent, IT review pending                            │
│                                                                 │
│ SWGA Oil             $52K     Evaluating   71 🟢   1 day        │
│   └ ROI completed, requesting proposal                          │
│                                                                 │
│ Herdich              $27K     Demo         23 🔴   8 days       │
│   └ Only 1 login, demo expires tomorrow                         │
│                                                                 │
│ Gier Oil             $41K     Demo         34 🔴   4 days       │
│   └ Viewed overview, hasn't explored further                    │
│                                                                 │
│ [ + Create Demo ]                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Deal Detail View

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Deals                              FiveStar Food Mart         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Stage: Evaluating          ARR: $96,000         Score: 45/100   │
│ Demo expires: 8 days                                            │
│                                                                 │
│ [ Send Proposal ]  [ Extend Demo ]  [ Log Activity ]            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ STAKEHOLDER ENGAGEMENT                                          │
│                                                                 │
│ 👤 Meredith Goodin                            CHAMPION          │
│    meredith@fivestar.com                                        │
│    ──────────────────────────────────────────────────────       │
│    Logins: 12          Time: 47 min        Last: 5 days ago     │
│    ──────────────────────────────────────────────────────       │
│    ☑ Viewed overview    ☑ Completed ROI    ☑ Explored content   │
│    ☑ Viewed proposal    ☐ Signed                                │
│                                                                 │
│ 👤 Glenn Higdon                               DECISION MAKER    │
│    glenn@fivestar.com                         ⚠️ LOW ENGAGEMENT │
│    ──────────────────────────────────────────────────────       │
│    Logins: 2           Time: 8 min         Last: 8 days ago     │
│    ──────────────────────────────────────────────────────       │
│    ☑ Viewed overview    ☐ Viewed ROI       ☐ Viewed proposal    │
│                                                                 │
│ 👤 IT Contact                                 IT / SECURITY     │
│    (invited, never joined)                    ⚠️ BLOCKER        │
│    ──────────────────────────────────────────────────────       │
│    Invited 10 days ago, 0 logins                                │
│    [ Resend Invite ]  [ Remove ]                                │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ CONTENT ENGAGEMENT                                              │
│                                                                 │
│ Platform Overview     ████████████████████░░░░ 85%  ✓ Both      │
│ ROI Calculator        ████████████████░░░░░░░░ 65%  Meredith    │
│ Content Library       ████████░░░░░░░░░░░░░░░░ 35%  Meredith    │
│ Proposal              ██████░░░░░░░░░░░░░░░░░░ 25%  Meredith    │
│ IT/Security Docs      ░░░░░░░░░░░░░░░░░░░░░░░░ 0%   No one      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ROI DATA                                                        │
│                                                                 │
│ Locations: 95 (TX: 72, LA: 15, AL: 8)                           │
│ Employees: ~800                                                 │
│ Turnover: 85%                                                   │
│ Current Solution: PlayerLync @ $48K/year                        │
│ Projected Savings: $92,900/year                                 │
│ ROI: 258%                                                       │
│                                                                 │
│ [ View Full ROI ]  [ Edit ]                                     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ SIGNALS & RECOMMENDATIONS                                       │
│                                                                 │
│ 🟢 Champion is engaged and has viewed proposal                  │
│ 🔴 Decision maker going cold - hasn't seen ROI                  │
│ 🔴 IT blocker never joined - may be internal friction           │
│ 🟡 No activity in 5 days - momentum stalling                    │
│                                                                 │
│ SUGGESTED ACTIONS:                                              │
│ 1. Send Glenn a direct link to the 1-page ROI summary           │
│ 2. Ask Meredith about IT contact - is this the right person?    │
│ 3. Schedule a check-in call with Meredith                       │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ACTIVITY LOG                                                    │
│                                                                 │
│ Jan 20  Meredith viewed proposal (3rd time)                     │
│ Jan 18  Glenn logged in, viewed overview only                   │
│ Jan 15  Meredith completed ROI calculator                       │
│ Jan 15  Meredith invited Glenn and IT contact                   │
│ Jan 12  Meredith first login                                    │
│ Jan 12  Demo created                                            │
│                                                                 │
│ [ Show All Activity ]                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Onboarding Tracker

```
┌─────────────────────────────────────────────────────────────────┐
│ ONBOARDING                                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ACTIVE ONBOARDINGS                                              │
│                                                                 │
│ Company              Go-Live     Progress   Health    Status    │
│ ───────────────────────────────────────────────────────────     │
│ Kent Companies       Feb 15      85%        92 🟢    On Track   │
│   └ Final review, comms scheduled                               │
│                                                                 │
│ Eagle Stop           Feb 28      45%        67 🟡    At Risk    │
│   └ HRIS connection pending - IT unresponsive                   │
│                                                                 │
│ Murphy USA           Mar 15      20%        82 🟢    On Track   │
│   └ Account setup complete, starting content review             │
│                                                                 │
│ RECENTLY LAUNCHED                                               │
│                                                                 │
│ Company              Launched    Activation  Health              │
│ ───────────────────────────────────────────────────────────     │
│ Newcomb Oil          Jan 15      89%         94 🟢               │
│ Terceira (Bermuda)   Jan 8       76%         88 🟢               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Client Health Dashboard (Post-Launch)

```
┌─────────────────────────────────────────────────────────────────┐
│ CLIENT HEALTH                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ PORTFOLIO OVERVIEW                                              │
│                                                                 │
│ Total Clients: 12       Total ARR: $847K      Avg Health: 84    │
│                                                                 │
│ Health Distribution:                                            │
│ 🟢 Healthy (80+):     8 clients    $623K ARR                    │
│ 🟡 At Risk (60-79):   3 clients    $187K ARR                    │
│ 🔴 Critical (<60):    1 client     $37K ARR                     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ NEEDS ATTENTION                                                 │
│                                                                 │
│ 🔴 Weigels - Health: 52                            ARR: $37K    │
│    └ Admin logins down 80%, completion stalled                  │
│    └ Last QBR: Overdue (was Nov 2025)                           │
│    └ [ Schedule QBR ]  [ View Details ]                         │
│                                                                 │
│ 🟡 QuikTrip Regional - Health: 68                  ARR: $89K    │
│    └ New admin, may need retraining                             │
│    └ [ Send training resources ]  [ View Details ]              │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ UPCOMING RENEWALS (Next 90 Days)                                │
│                                                                 │
│ Company              Renewal     ARR      Health   Risk         │
│ ───────────────────────────────────────────────────────────     │
│ Newcomb Oil          Apr 15      $67K     88 🟢    Low          │
│ Kent Companies       May 1       $143K    92 🟢    Low          │
│ Weigels              May 15      $37K     52 🔴    High         │
│                                                                 │
│ [ Create Renewal Proposal ]                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# Part 6: Data Model

## Core Tables

### organizations (extend existing)

```sql
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS
  -- Lifecycle state
  status TEXT DEFAULT 'live' CHECK (status IN (
    'prospect', 'evaluating', 'closing', 'onboarding', 
    'live', 'frozen', 'renewing', 'churned'
  )),
  status_changed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Demo management
  demo_created_at TIMESTAMPTZ,
  demo_expires_at TIMESTAMPTZ,
  demo_template TEXT,
  
  -- Sales data
  deal_data JSONB DEFAULT '{}',
  -- {
  --   estimated_arr: number,
  --   current_solution: string,
  --   source: string,
  --   industry: string,
  --   notes: string
  -- }
  
  -- ROI data (captured in calculator, used everywhere)
  roi_data JSONB DEFAULT '{}',
  -- {
  --   inputs: {...},
  --   outputs: {...},
  --   calculated_at: timestamp,
  --   version: number
  -- }
  
  -- Onboarding data
  onboarding_data JSONB DEFAULT '{}',
  -- {
  --   go_live_date: date,
  --   kickoff_date: date,
  --   checklist_status: {...},
  --   health_score: number
  -- }
  
  -- Billing (Stripe)
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  billing_email TEXT,
  
  -- Renewal tracking
  contract_start_date DATE,
  contract_end_date DATE,
  contract_term_months INTEGER,
  
  -- Health tracking
  health_score INTEGER,
  health_updated_at TIMESTAMPTZ;
```

### engagement_events (new)

```sql
CREATE TABLE engagement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),
  
  -- Event details
  event_type TEXT NOT NULL,
  -- 'login', 'page_view', 'content_start', 'content_complete',
  -- 'roi_start', 'roi_complete', 'proposal_view', 'agreement_view',
  -- 'reviewer_invite', 'download', etc.
  
  event_data JSONB DEFAULT '{}',
  -- Flexible storage for event-specific data
  -- e.g., { page: '/content-library', duration_seconds: 45 }
  
  session_id TEXT,
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_engagement_org_created (organization_id, created_at DESC),
  INDEX idx_engagement_user (user_id, created_at DESC),
  INDEX idx_engagement_type (event_type, created_at DESC)
);
```

### engagement_scores (new - materialized/cached)

```sql
CREATE TABLE engagement_scores (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id),
  
  -- Current score
  score INTEGER NOT NULL DEFAULT 0,
  
  -- Component scores
  login_score INTEGER DEFAULT 0,
  content_score INTEGER DEFAULT 0,
  roi_score INTEGER DEFAULT 0,
  stakeholder_score INTEGER DEFAULT 0,
  recency_multiplier DECIMAL(3,2) DEFAULT 1.0,
  
  -- Metadata
  last_activity_at TIMESTAMPTZ,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recalculate periodically or on significant events
CREATE OR REPLACE FUNCTION recalculate_engagement_score(org_id UUID)
RETURNS INTEGER AS $$
  -- Implementation of scoring algorithm
$$ LANGUAGE plpgsql;
```

### proposals (new)

```sql
CREATE TABLE proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  -- Proposal content
  template_id TEXT NOT NULL,
  sections JSONB NOT NULL, -- Which sections included
  pricing JSONB NOT NULL,  -- Pricing configuration
  -- {
  --   base_plan: 'professional',
  --   base_price_per_location: 72,
  --   addons: [...],
  --   discount_percent: 10,
  --   term_months: 36,
  --   total_annual: 91422
  -- }
  
  -- Generated content
  content_html TEXT,
  content_pdf_url TEXT,
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'sent', 'viewed', 'signed', 'expired', 'declined'
  )),
  
  -- Tracking
  sent_at TIMESTAMPTZ,
  first_viewed_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  
  -- Validity
  valid_until DATE,
  
  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### agreements (new)

```sql
CREATE TABLE agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  proposal_id UUID REFERENCES proposals(id),
  
  -- Agreement content
  agreement_type TEXT DEFAULT 'msa', -- 'msa', 'addendum', 'renewal'
  content_html TEXT NOT NULL,
  content_pdf_url TEXT,
  
  -- Signature
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'signed', 'countersigned', 'executed', 'voided'
  )),
  
  -- Signer info
  signer_name TEXT,
  signer_title TEXT,
  signer_email TEXT,
  signature_data TEXT, -- Base64 of signature image
  signed_at TIMESTAMPTZ,
  signer_ip_address INET,
  
  -- Countersignature (Trike side)
  countersigner_name TEXT,
  countersigner_title TEXT,
  countersigned_at TIMESTAMPTZ,
  
  -- Executed document
  executed_pdf_url TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### onboarding_checklists (new)

```sql
CREATE TABLE onboarding_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  -- Checklist definition
  template_id TEXT NOT NULL, -- Which checklist template
  
  -- Task statuses
  tasks JSONB NOT NULL,
  -- {
  --   "company_profile": { status: "complete", completed_at: "..." },
  --   "logo_upload": { status: "complete", completed_at: "..." },
  --   "location_import": { status: "in_progress", progress: 45 },
  --   "content_review": { status: "not_started" },
  --   ...
  -- }
  
  -- Progress
  total_tasks INTEGER NOT NULL,
  completed_tasks INTEGER DEFAULT 0,
  progress_percent INTEGER DEFAULT 0,
  
  -- Blocking items
  blocking_tasks TEXT[], -- Array of task IDs blocking launch
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### content_reviews (new)

```sql
CREATE TABLE content_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  -- What's being reviewed
  content_type TEXT NOT NULL, -- 'album', 'track', 'playlist'
  content_id UUID NOT NULL,
  
  -- Review requirements
  required_approvals INTEGER DEFAULT 1,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_progress', 'approved', 'changes_requested'
  )),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE content_review_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES content_reviews(id),
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Response
  response TEXT NOT NULL CHECK (response IN (
    'approved', 'changes_requested'
  )),
  
  -- For partial reviews (e.g., specific modules)
  reviewed_items JSONB, -- Array of item IDs reviewed
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE content_review_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES content_reviews(id),
  user_id UUID NOT NULL REFERENCES users(id),
  
  -- Comment details
  content_item_id UUID, -- Specific track/module
  timestamp_seconds INTEGER, -- For video comments
  comment_text TEXT NOT NULL,
  
  -- Threading
  parent_comment_id UUID REFERENCES content_review_comments(id),
  
  -- Resolution
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### scheduled_communications (new)

```sql
CREATE TABLE scheduled_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  
  -- Communication details
  communication_type TEXT NOT NULL, -- 'email', 'sms', 'in_app'
  template_id TEXT NOT NULL,
  
  -- Recipients
  recipient_type TEXT NOT NULL, -- 'all_employees', 'managers', 'specific'
  recipient_ids UUID[], -- If specific
  
  -- Content (can override template)
  subject TEXT,
  body_html TEXT,
  
  -- Scheduling
  scheduled_for TIMESTAMPTZ NOT NULL,
  timezone TEXT DEFAULT 'America/Chicago',
  
  -- Status
  status TEXT DEFAULT 'scheduled' CHECK (status IN (
    'draft', 'scheduled', 'sent', 'failed', 'cancelled'
  )),
  sent_at TIMESTAMPTZ,
  
  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

# Part 7: Integration Points

## With Existing Trike Features

| Feature | Integration | Risk | Mitigation |
|---------|-------------|------|------------|
| **User Auth** | Add user types (prospect, reviewer) | Medium | New user types, same auth system |
| **Content Library** | Add sales content visibility rules | Low | New content type flag |
| **Assignments** | Only active for 'live' orgs | Low | Status check in assignment creation |
| **Compliance Tracking** | Only active for 'live' orgs | Low | Status check in compliance functions |
| **HRIS (Merge.dev)** | Reuse existing integration | Low | Already wireframed |
| **Billing (Stripe)** | Implement existing wireframe | Medium | New implementation |
| **Rules Engine** | Use for assignment automation | Low | From prior spec |

## New External Integrations

| Service | Purpose | Priority |
|---------|---------|----------|
| **Stripe Connect** | Subscriptions, payments, invoicing | P0 |
| **Merge.dev** | HRIS data sync (existing) | P0 |
| **Email (SendGrid/Postmark)** | Transactional emails | P0 |
| **Calendly or Cal.com** | Embedded scheduling | P1 |
| **DocuSign** (optional) | Enterprise e-sign | P2 |

---

# Part 8: Build Phases

## Phase 1: Foundation (Weeks 1-2)

**Goal:** Account state machine, basic prospect portal

**Deliverables:**
- [ ] Organization status field and transitions
- [ ] Status-aware routing (which dashboard to show)
- [ ] Demo creation flow (super admin)
- [ ] Basic prospect portal dashboard
- [ ] Sales content library structure
- [ ] Login/page view engagement tracking
- [ ] Deal list view (super admin)

**Definition of Done:**
- Jacob can create a demo account in < 5 minutes
- Prospect can log in and see prospect portal
- Engagement events being captured
- Jacob can see list of demos with basic info

---

## Phase 2: Sales Room (Weeks 3-4)

**Goal:** Full prospect self-service evaluation

**Deliverables:**
- [ ] Sales content as playlists (eat your own dogfood)
- [ ] Platform preview mode (sandboxed exploration)
- [ ] ROI calculator (full implementation)
- [ ] Invite reviewers flow
- [ ] Demo expiration and frozen state
- [ ] Engagement scoring (complete algorithm)

**Definition of Done:**
- Prospect can explore sales content
- Prospect can complete ROI calculator
- Prospect can invite reviewers with roles
- Demo auto-expires and shows frozen state
- Engagement score calculates correctly

---

## Phase 3: Proposals & Close (Weeks 5-6)

**Goal:** Proposal generation, e-sign, payment

**Deliverables:**
- [ ] Proposal template system
- [ ] Proposal builder (super admin)
- [ ] Proposal auto-population from ROI
- [ ] Proposal viewing (prospect)
- [ ] Native e-sign implementation
- [ ] Stripe subscription creation
- [ ] Close automation (status transition)

**Definition of Done:**
- Jacob can generate proposal in < 15 minutes
- Prospect can view and sign proposal
- Prospect can set up payment
- System transitions to onboarding on close

---

## Phase 4: Deal Intelligence (Weeks 7-8)

**Goal:** Full visibility into deal health

**Deliverables:**
- [ ] Deal detail view with stakeholder tracking
- [ ] Per-stakeholder engagement breakdown
- [ ] Deal stage automation
- [ ] Needs attention alerts
- [ ] Suggested actions based on signals
- [ ] Activity logging

**Definition of Done:**
- Jacob can see engagement by stakeholder
- Deals auto-advance through stages
- Alerts fire for concerning patterns
- System suggests specific actions

---

## Phase 5: Onboarding Portal (Weeks 9-11)

**Goal:** Self-service client onboarding

**Deliverables:**
- [ ] Onboarding portal dashboard
- [ ] Go-live date management
- [ ] Checklist engine with auto-complete
- [ ] Company profile & branding
- [ ] Location import (CSV + manual)
- [ ] Admin user management
- [ ] Content review workflow (Frame.io style)
- [ ] HRIS connection (Merge.dev)
- [ ] Role mapping

**Definition of Done:**
- Portal transforms on status change
- Client can complete account setup self-serve
- Client can review and approve content
- Client can connect HRIS and map roles
- Checklist tracks progress accurately

---

## Phase 6: Launch & Health (Weeks 12-14)

**Goal:** Smooth launches, ongoing health tracking

**Deliverables:**
- [ ] Assignment rules setup (from prior spec)
- [ ] Rollout communications scheduling
- [ ] Launch readiness gate
- [ ] Go-live automation (invitations, etc.)
- [ ] Activation tracking dashboard
- [ ] Post-launch health scoring
- [ ] Check-in scheduling
- [ ] QBR data integration (ROI actuals vs projected)

**Definition of Done:**
- Client can schedule rollout comms
- Launch blocked until ready
- Invitations send on go-live
- Activation tracks in real-time
- Health score calculates for live clients

---

## Phase 7: Polish & Automation (Weeks 15-16)

**Goal:** Refinement, automation, edge cases

**Deliverables:**
- [ ] Automated nudges (prospect inactivity, etc.)
- [ ] Deal stage automation refinement
- [ ] Email templates polish
- [ ] PDF generation polish
- [ ] Mobile responsiveness
- [ ] Error handling and edge cases
- [ ] Performance optimization

**Definition of Done:**
- Automated sequences running correctly
- All user flows smooth and polished
- System handles edge cases gracefully
- Performance acceptable at scale

---

# Part 9: Future Roadmap

## Post-MVP Enhancements

### Client Success Story Automation
- Trigger: Client hits health milestones
- Action: Prompt for testimonial/feedback
- Collect: Structured data (metrics, quotes)
- Generate: AI-drafted case study
- Review: Jacob approves/edits
- Publish: Add to sales content library

### In-App Messaging
- Real-time chat between prospect/client and Trike
- Conversation history preserved
- Async-friendly (not requiring real-time presence)
- Notifications and digest emails

### AI Sales Assistant
- Analyze engagement patterns across deals
- Draft personalized follow-up emails
- Suggest optimal contact timing
- Predict deal outcomes
- Meeting notes integration (Fathom, Grain, Fireflies)

### Full CRM Integration
- Activity logging from email, calendar, calls
- Task management for deals
- Pipeline forecasting
- Contact relationship mapping
- Merge into Trike admin completely

### Advanced Content Customization
- Client self-service video editing (add logo, etc.)
- Template tracks with variable content
- AI-powered content personalization
- Multi-language support

---

# Part 10: Open Questions

1. **E-sign legal sufficiency:** Is native implementation legally valid for enterprise contracts, or do we need DocuSign for audit trails?

2. **Billing complexity:** How do we handle mid-term upgrades, add-ons, and prorations in Stripe?

3. **Demo data realism:** How much fake data should demos include? Full sample content? Sample employees that "complete" training?

4. **Reviewer permissions:** Should reviewers be able to see each other? What about competitive situations?

5. **Content review scope:** Do clients review individual tracks or just albums? What's the right granularity?

6. **HRIS sync timing:** Real-time webhooks or daily batch? What happens when employee terminated in HRIS?

7. **Multi-proposal scenarios:** Can we have multiple active proposals for negotiation, or one at a time?

8. **Onboarding SLAs:** Are there contractual commitments for go-live timing we need to track?

---

# Part 11: Appendices

## A: Engagement Score Weights

| Event | Points | Cap | Notes |
|-------|--------|-----|-------|
| Login | 5 | 1/day | Prevent gaming |
| Page view (unique) | 1 | 50 total | Encourage exploration |
| Sales video started | 3 | per video | |
| Sales video completed | 10 | per video | |
| Platform preview explored | 2 | 20 areas | |
| ROI calculator opened | 5 | 1 total | |
| ROI calculator saved | 20 | 1 total | |
| ROI PDF downloaded | 10 | 3 total | |
| Reviewer invited | 15 | 5 reviewers | |
| Reviewer logged in | 10 | per reviewer | |
| Plan/pricing viewed | 10 | 3 total | |
| Proposal viewed | 10 | 3 total | |
| Proposal downloaded | 15 | 3 total | |
| Agreement opened | 15 | 3 total | |
| Call scheduled | 20 | 3 total | |

**Modifiers:**

```javascript
// Recency multiplier
function getRecencyMultiplier(daysSinceActivity) {
  if (daysSinceActivity < 1) return 1.0;
  if (daysSinceActivity <= 3) return 0.9;
  if (daysSinceActivity <= 7) return 0.7;
  if (daysSinceActivity <= 14) return 0.5;
  return 0.3;
}

// Stakeholder multiplier
function getStakeholderMultiplier(stakeholders) {
  let multiplier = 0.7; // Champion only
  
  if (stakeholders.length >= 2) multiplier = 0.85;
  if (stakeholders.length >= 3) multiplier = 1.0;
  
  if (stakeholders.some(s => s.role === 'decision_maker' && s.engaged)) {
    multiplier += 0.2;
  }
  
  if (stakeholders.some(s => s.role === 'it_security' && s.engaged)) {
    multiplier += 0.1;
  }
  
  return Math.min(multiplier, 1.5);
}
```

## B: Proposal Template Variables

```javascript
// Available in proposal templates
const variables = {
  // Company
  '{{company.name}}': 'FiveStar Food Mart',
  '{{company.industry}}': 'Convenience Store',
  
  // Locations
  '{{locations.count}}': 95,
  '{{locations.by_state}}': [
    { state: 'TX', count: 72, employees: 610 },
    { state: 'LA', count: 15, employees: 125 },
    { state: 'AL', count: 8, employees: 65 }
  ],
  '{{locations.states_list}}': 'Texas, Louisiana, Alabama',
  
  // Employees
  '{{employees.count}}': 800,
  '{{employees.turnover}}': '85%',
  
  // ROI
  '{{roi.current_solution}}': 'PlayerLync',
  '{{roi.current_cost}}': '$48,000',
  '{{roi.total_savings}}': '$92,900',
  '{{roi.roi_percentage}}': '258%',
  '{{roi.platform_savings}}': '$12,000',
  '{{roi.training_savings}}': '$58,000',
  '{{roi.admin_savings}}': '$14,400',
  '{{roi.compliance_savings}}': '$8,500',
  
  // Pricing
  '{{pricing.plan}}': 'Professional',
  '{{pricing.base_annual}}': '$82,080',
  '{{pricing.addons}}': [
    { name: 'Compliance Automation', annual: '$17,100' },
    { name: 'HRIS Integration', annual: '$2,400' }
  ],
  '{{pricing.subtotal}}': '$101,580',
  '{{pricing.discount}}': '$10,158',
  '{{pricing.discount_percent}}': '10%',
  '{{pricing.total_annual}}': '$91,422',
  '{{pricing.total_monthly}}': '$7,619',
  '{{pricing.term}}': '3 years',
  
  // Compliance
  '{{compliance.states}}': [
    { state: 'TX', certs: ['TABC', 'Food Handler', 'UST'] },
    { state: 'LA', certs: ['ATC', 'Food Handler'] },
    { state: 'AL', certs: ['ABC', 'Food Handler'] }
  ],
  
  // Dates
  '{{dates.proposal_date}}': 'January 23, 2026',
  '{{dates.valid_until}}': 'February 23, 2026',
  '{{dates.projected_golive}}': 'March 1, 2026'
};
```

## C: Health Score Calculation

```javascript
function calculateClientHealth(org) {
  const weights = {
    admin_activity: 0.20,      // Are admins logging in?
    content_completion: 0.25,  // Are employees completing training?
    compliance_rate: 0.25,     // Are compliance certs current?
    support_tickets: 0.10,     // Low tickets = healthy
    feature_adoption: 0.10,    // Using platform features?
    nps_score: 0.10            // If available
  };
  
  const scores = {
    admin_activity: calculateAdminActivity(org),      // 0-100
    content_completion: calculateCompletion(org),     // 0-100
    compliance_rate: calculateCompliance(org),        // 0-100
    support_tickets: calculateTicketScore(org),       // 0-100 (inverse)
    feature_adoption: calculateFeatureAdoption(org),  // 0-100
    nps_score: org.nps_score || 70                    // Default if not collected
  };
  
  let healthScore = 0;
  for (const [factor, weight] of Object.entries(weights)) {
    healthScore += scores[factor] * weight;
  }
  
  return Math.round(healthScore);
}
```

---

*End of Document*

---

## How to Use This Document

1. **Load into new chat:** Copy this entire document into a new Claude conversation
2. **Reference specific sections:** Ask about specific phases, features, or journeys
3. **Generate implementation details:** Request code, schemas, or UI specs for any component
4. **Track progress:** Use the Definition of Done checklists to track completion

**First prompt for implementation:**

> "I've loaded the Prospect-to-Client Flow PRD. Let's start with Phase 1: Foundation. First, let's design the database migrations needed to add the account state machine to the existing organizations table, along with the engagement_events table. Show me the SQL and explain how it integrates with the existing schema."
