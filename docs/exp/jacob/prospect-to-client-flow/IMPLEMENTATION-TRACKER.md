# Trike Unified Revenue Engine
## Implementation Tracker

**Last Updated:** January 25, 2026  
**Current Phase:** Not Started  

---

## Phase 1: Foundation (Weeks 1-2)

### Database
- [ ] Add `status` field to organizations table
- [ ] Add `status_changed_at` field
- [ ] Add `demo_expires_at` field
- [ ] Add `demo_template` field
- [ ] Add `deal_data` JSONB field
- [ ] Add `roi_data` JSONB field
- [ ] Add `onboarding_data` JSONB field
- [ ] Create `engagement_events` table
- [ ] Create `engagement_scores` table
- [ ] Create indexes for engagement queries
- [ ] Migrate existing orgs to `status = 'live'`

### Backend
- [ ] Status transition functions
- [ ] Status validation rules
- [ ] Engagement event logging API
- [ ] Engagement score calculation function
- [ ] Demo creation API endpoint
- [ ] Demo expiration cron job

### Frontend - Super Admin
- [ ] Deal list view
- [ ] Demo creation form
- [ ] Basic deal cards with status

### Frontend - Prospect Portal
- [ ] Status-aware routing
- [ ] Prospect dashboard layout
- [ ] Welcome modal (first login)
- [ ] Demo expiration countdown
- [ ] Next steps checklist UI

### Testing
- [ ] Status transitions work correctly
- [ ] Engagement events capture
- [ ] Demo expiration triggers frozen state
- [ ] Existing orgs unaffected

**Phase 1 Definition of Done:**
- [ ] Jacob can create a demo account in < 5 minutes
- [ ] Prospect can log in and see prospect portal
- [ ] Engagement events being captured
- [ ] Jacob can see list of demos with basic info

---

## Phase 2: Sales Room (Weeks 3-4)

### Backend
- [ ] Sales content type flag
- [ ] Sales content visibility rules
- [ ] ROI calculator save endpoint
- [ ] ROI PDF generation
- [ ] Reviewer invitation API
- [ ] Reviewer permission model

### Frontend - Sales Content
- [ ] Sales content library view
- [ ] Sales content as playlists
- [ ] Video player for sales videos
- [ ] Content completion tracking
- [ ] Platform preview mode

### Frontend - ROI Calculator
- [ ] Location input by state
- [ ] Current solution dropdown
- [ ] Cost inputs
- [ ] Calculation display
- [ ] Savings breakdown
- [ ] PDF download
- [ ] Save/load functionality

### Frontend - Reviewers
- [ ] Invite form with roles
- [ ] Pending invitations list
- [ ] Resend/cancel actions
- [ ] Reviewer dashboard view

### Testing
- [ ] ROI calculations match spec
- [ ] Reviewer permissions correct
- [ ] Demo expiration → frozen state
- [ ] Engagement scoring accurate

**Phase 2 Definition of Done:**
- [ ] Prospect can explore sales content
- [ ] Prospect can complete ROI calculator
- [ ] Prospect can invite reviewers with roles
- [ ] Demo auto-expires and shows frozen state
- [ ] Engagement score calculates correctly

---

## Phase 3: Proposals & Close (Weeks 5-6)

### Database
- [ ] Create `proposals` table
- [ ] Create `agreements` table

### Backend
- [ ] Proposal template system
- [ ] Proposal generation API
- [ ] Proposal auto-populate from ROI
- [ ] PDF generation for proposals
- [ ] E-sign signature capture API
- [ ] Agreement storage
- [ ] Stripe customer creation
- [ ] Stripe subscription creation
- [ ] Close automation trigger

### Frontend - Super Admin
- [ ] Proposal builder UI
- [ ] Template selection
- [ ] Section toggles
- [ ] Pricing configuration
- [ ] Preview mode
- [ ] Send to client action

### Frontend - Prospect
- [ ] Proposal view in library
- [ ] PDF download
- [ ] Agreement review screen
- [ ] Signature capture (draw/type)
- [ ] Payment setup (Stripe Elements)
- [ ] Confirmation screen

### Integrations
- [ ] Stripe Connect setup
- [ ] Stripe subscription sync

### Testing
- [ ] Proposal generates correctly
- [ ] E-sign legally valid
- [ ] Stripe subscription creates
- [ ] Status transitions to onboarding

**Phase 3 Definition of Done:**
- [ ] Jacob can generate proposal in < 15 minutes
- [ ] Prospect can view and sign proposal
- [ ] Prospect can set up payment
- [ ] System transitions to onboarding on close

---

## Phase 4: Deal Intelligence (Weeks 7-8)

### Backend
- [ ] Stakeholder engagement aggregation
- [ ] Deal stage automation rules
- [ ] Alert threshold configuration
- [ ] Suggested actions engine
- [ ] Activity logging API

### Frontend - Super Admin
- [ ] Deal detail view
- [ ] Stakeholder engagement cards
- [ ] Content engagement heatmap
- [ ] Signal indicators
- [ ] Suggested actions panel
- [ ] Activity timeline

### Automation
- [ ] Stage auto-advance triggers
- [ ] Inactivity alerts
- [ ] Low engagement notifications

### Testing
- [ ] Engagement by stakeholder accurate
- [ ] Stages advance correctly
- [ ] Alerts fire appropriately

**Phase 4 Definition of Done:**
- [ ] Jacob can see engagement by stakeholder
- [ ] Deals auto-advance through stages
- [ ] Alerts fire for concerning patterns
- [ ] System suggests specific actions

---

## Phase 5: Onboarding Portal (Weeks 9-11)

### Database
- [ ] Create `onboarding_checklists` table
- [ ] Create `content_reviews` table
- [ ] Create `content_review_responses` table
- [ ] Create `content_review_comments` table

### Backend
- [ ] Checklist template engine
- [ ] Checklist auto-complete triggers
- [ ] Go-live date management
- [ ] Content review workflow API
- [ ] Multi-reviewer logic
- [ ] Comment threading
- [ ] Location import (CSV parser)
- [ ] HRIS connection (Merge.dev)
- [ ] Role mapping API

### Frontend - Onboarding Portal
- [ ] Onboarding dashboard
- [ ] Go-live date picker
- [ ] Checklist display
- [ ] Company profile form
- [ ] Logo upload
- [ ] Location import (CSV + manual)
- [ ] Admin user management

### Frontend - Content Review
- [ ] Album list with status
- [ ] Track review interface
- [ ] Video preview
- [ ] Comment system (with timestamps)
- [ ] Approval/rejection flow
- [ ] Multi-reviewer tracking
- [ ] Bulk approve

### Frontend - Integrations
- [ ] HRIS connection UI
- [ ] System selection
- [ ] OAuth flow
- [ ] Census QA interface
- [ ] Role mapping UI

### Testing
- [ ] Checklist auto-completes
- [ ] Content review workflow complete
- [ ] HRIS sync works
- [ ] Role mapping persists

**Phase 5 Definition of Done:**
- [ ] Portal transforms on status change
- [ ] Client can complete account setup self-serve
- [ ] Client can review and approve content
- [ ] Client can connect HRIS and map roles
- [ ] Checklist tracks progress accurately

---

## Phase 6: Launch & Health (Weeks 12-14)

### Database
- [ ] Create `scheduled_communications` table
- [ ] Add health tracking fields

### Backend
- [ ] Communication template system
- [ ] Communication scheduling
- [ ] Launch readiness validation
- [ ] Launch automation (invitations)
- [ ] Activation tracking
- [ ] Health score calculation
- [ ] Check-in scheduling

### Frontend - Launch Prep
- [ ] Assignment rules setup (from prior spec)
- [ ] Communication templates
- [ ] Communication scheduling UI
- [ ] Readiness checklist
- [ ] Launch button (gated)

### Frontend - Post-Launch
- [ ] Activation tracker
- [ ] Regional breakdown
- [ ] Health score dashboard
- [ ] Milestone tracking
- [ ] Check-in scheduling

### Testing
- [ ] Communications send on schedule
- [ ] Launch blocked until ready
- [ ] Invitations staggered correctly
- [ ] Health score calculates

**Phase 6 Definition of Done:**
- [ ] Client can schedule rollout comms
- [ ] Launch blocked until ready
- [ ] Invitations send on go-live
- [ ] Activation tracks in real-time
- [ ] Health score calculates for live clients

---

## Phase 7: Polish & Automation (Weeks 15-16)

### Automation
- [ ] Prospect inactivity nudges
- [ ] Deal stage automation tuning
- [ ] Onboarding reminder sequences
- [ ] Post-launch check-in triggers

### Polish
- [ ] Email template refinement
- [ ] PDF generation quality
- [ ] Mobile responsiveness
- [ ] Loading states
- [ ] Error handling
- [ ] Edge cases

### Performance
- [ ] Engagement query optimization
- [ ] Dashboard load time
- [ ] PDF generation speed

### Testing
- [ ] End-to-end journey test
- [ ] Load testing
- [ ] Mobile testing

**Phase 7 Definition of Done:**
- [ ] Automated sequences running correctly
- [ ] All user flows smooth and polished
- [ ] System handles edge cases gracefully
- [ ] Performance acceptable at scale

---

## Integration Checklist

### Stripe Connect
- [ ] Stripe account setup
- [ ] API keys configured
- [ ] Customer creation
- [ ] Subscription creation
- [ ] Payment method collection
- [ ] Invoice generation
- [ ] Webhook handling

### Merge.dev (HRIS)
- [ ] Merge account setup
- [ ] API integration
- [ ] Supported HRIS list
- [ ] OAuth flow
- [ ] Employee sync
- [ ] Incremental updates
- [ ] Error handling

### Email (SendGrid/Postmark)
- [ ] Provider setup
- [ ] Template system
- [ ] Transactional emails
- [ ] Delivery tracking
- [ ] Bounce handling

### Calendly/Cal.com (Optional)
- [ ] Embed integration
- [ ] Event types
- [ ] Availability sync

---

## Risk Register

| Risk | Impact | Mitigation | Status |
|------|--------|------------|--------|
| E-sign legal validity | High | Research requirements, consider DocuSign | Not Started |
| Stripe complexity | Medium | Start simple, iterate | Not Started |
| Merge.dev HRIS coverage | Medium | Verify client systems supported | Not Started |
| Performance at scale | Medium | Index optimization, caching | Not Started |
| Existing client impact | High | Status migration careful | Not Started |

---

## Notes & Decisions

### Date | Decision | Rationale
------|----------|----------
(Record decisions here as you make them)

---

## Blockers

(Track any blockers here)

---

## Links

- [PROJECT-CHARTER.md](./PROJECT-CHARTER.md) - Full specification
- [QUICK-REFERENCE.md](./QUICK-REFERENCE.md) - Summary card
- [ARCHITECTURE-ADDENDUM.md](./ARCHITECTURE-ADDENDUM.md) - Build architecture & migration notes
