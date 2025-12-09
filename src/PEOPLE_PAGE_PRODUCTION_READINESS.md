# People Page: Production Readiness Action Plan

## Executive Summary
The People page has a solid foundation with proper Supabase integration for user management, but several critical components are still using wireframe/hardcoded data or placeholder implementations. This document outlines what needs to be migrated to proper database tables and backend implementations for production scalability.

---

## ✅ What's Already Production-Ready

### 1. **Core User Management**
- ✅ `users` table exists in Supabase with proper fields
- ✅ User listing with search and filters
- ✅ User profile data with relations (role, store)
- ✅ Status management (active, inactive, on-leave)
- ✅ Real-time queries using Supabase client

### 2. **Progress Aggregation**
- ✅ Training progress calculated from `user_progress` table
- ✅ Completed tracks counting
- ✅ Compliance score averaging
- ✅ Certifications count

### 3. **Assignment Integration**
- ✅ `assignments` table with proper schema
- ✅ Assignment status tracking
- ✅ Playlist-based assignments

---

## 🔴 CRITICAL: Must Fix for Production

### 1. **Organizational Hierarchy Tables**
**Current State**: Hardcoded dropdown values
**Impact**: Cannot scale to multi-location organizations

#### Action Items:
- [ ] **Create `roles` table**
  - Schema: `id`, `organization_id`, `name`, `description`, `permissions_json`, `level` (1-5)
  - Default roles: Store Manager, Assistant Manager, Sales Associate, Cashier, etc.
  - RLS policies: Users can read roles in their org
  
- [ ] **Create `districts` table**
  - Schema: `id`, `organization_id`, `name`, `code`, `manager_id` (user_id), `created_at`
  - RLS policies: Scoped to organization
  
- [ ] **Create or populate `stores` table**
  - Schema: `id`, `organization_id`, `district_id`, `name`, `code`, `address`, `manager_id`, `status`, `created_at`
  - Needs proper foreign keys to districts and organizations
  - RLS policies: Scoped to organization
  
- [ ] **Update People.tsx dropdowns**
  - Replace hardcoded values in lines 594-611
  - Fetch actual roles and stores from database
  - Use `useRoles()` and `useStores()` hooks

**Files to Update**:
- `/lib/crud/stores.ts` - Add getRoles(), getDistricts(), getStores()
- `/lib/hooks/useSupabase.ts` - Add useRoles(), useStores(), useDistricts()
- `/components/People.tsx` - Lines 594-611 (Add Employee dialog)

---

### 2. **User Invitation System**
**Current State**: Placeholder URL returned
**Impact**: Cannot actually onboard new users

#### Action Items:
- [ ] **Create server-side invite endpoint**
  - Path: `/supabase/functions/server/users-invite.ts`
  - Use Supabase Admin API: `supabase.auth.admin.inviteUserByEmail()`
  - Generate magic link or temporary password
  - Send email with invite link
  
- [ ] **Update `inviteUserViaEmail()` in `/lib/crud/users.ts`**
  - Line 267: Call server endpoint instead of placeholder
  - Return actual invite URL from Supabase
  
- [ ] **Create email template for invites**
  - Branded email with organization name
  - Clear onboarding instructions
  - Link to set password and complete profile

**Files to Create**:
- `/supabase/functions/server/users-invite.ts`
- `/email-templates/user-invite.html` (if needed)

**Files to Update**:
- `/lib/crud/users.ts` - Line 267
- `/supabase/functions/server/index.tsx` - Add invite route

---

### 3. **Activity Tracking System**
**Current State**: Activity feed in EmployeeProfile likely shows mock data
**Impact**: No visibility into user engagement

#### Action Items:
- [ ] **Create `activity_log` table**
  - Schema: `id`, `organization_id`, `user_id`, `action`, `entity_type`, `entity_id`, `description`, `metadata_json`, `created_at`
  - Indexes on: user_id, created_at, entity_type
  - RLS policies: Users can only see their own activity, admins see all in org
  
- [ ] **Implement activity logging across app**
  - Track: login, logout, track completion, certification earned, assignment received
  - Use `logActivity()` from `/lib/crud/activity.ts` (already exists!)
  - Add to: content playback, quiz completion, profile updates
  
- [ ] **Update EmployeeProfile.tsx to fetch real activity**
  - Line 121-127: Replace mock data with actual query
  - Query `activity_log` table filtered by user_id
  - Transform to ActivityItem format

**Files to Create**:
- SQL migration for `activity_log` table

**Files to Update**:
- `/components/EmployeeProfile.tsx` - Lines 121-127, 137-202
- `/lib/crud/activity.ts` - Verify logActivity() works with new table
- Throughout app: Add logActivity() calls to key user actions

---

### 4. **Certifications System**
**Current State**: CRUD operations exist but tables may not
**Impact**: Cannot track compliance certifications

#### Action Items:
- [ ] **Verify/Create `certifications` table**
  - Schema: `id`, `organization_id`, `name`, `description`, `required_tracks` (UUID[]), `validity_period_days`, `badge_url`, `is_active`, `created_at`
  - RLS policies: Users can read active certs, admins can manage
  
- [ ] **Verify/Create `user_certifications` table**
  - Schema: `id`, `user_id`, `certification_id`, `issue_date`, `expiration_date`, `status` (valid/expiring-soon/expired), `score`, `renewed_count`, `renewed_by`, `created_at`
  - Indexes on: user_id, status, expiration_date
  - RLS policies: Users see own certs, admins see all in org
  
- [ ] **Set up automatic certification checking**
  - Create scheduled job to run `updateCertificationStatuses()` daily
  - Create trigger on `track_progress` completion to call `checkAndIssueCertification()`
  
- [ ] **Update EmployeeProfile to show real certifications**
  - Fetch from `user_certifications` table
  - Show expiration warnings
  - Allow renewal for admins

**Files to Create**:
- SQL migrations for certifications tables

**Files to Update**:
- `/components/EmployeeProfile.tsx` - Certifications tab
- `/lib/crud/certifications.ts` - Verify all functions work
- Add database trigger for auto-certification checks

---

### 5. **Progress Tracking Tables**
**Current State**: References both `user_progress` and `track_progress` - unclear which exists
**Impact**: May not accurately track training progress

#### Action Items:
- [ ] **Audit existing progress tables**
  - Check if `user_progress` table exists in Supabase
  - Check if `track_progress` table exists
  - Document actual schema vs. expected schema
  
- [ ] **Standardize on single progress table** (recommend `track_progress`)
  - Schema: `id`, `user_id`, `track_id`, `status` (not-started/in-progress/completed), `progress_percent`, `score`, `started_at`, `completed_at`, `time_spent_seconds`, `last_activity_at`
  - Indexes on: user_id, track_id, status, completed_at
  - RLS policies: Users see own progress, admins see org progress
  
- [ ] **Update all references to use consistent table name**
  - `/lib/crud/users.ts` - Lines 133-138
  - `/lib/crud/progress.ts` - Create if doesn't exist
  - `/lib/crud/certifications.ts` - Line 42 (uses track_progress)

**Files to Audit**:
- Supabase database schema

**Files to Create/Update**:
- `/lib/crud/progress.ts` - Centralize all progress operations
- SQL migration to create/update progress table

---

## 🟡 IMPORTANT: Should Fix for Better UX

### 6. **Messaging & Reminder System**
**Current State**: UI exists but no backend
**Impact**: Cannot send reminders to employees

#### Action Items:
- [ ] **Create `notifications` table** (may already exist)
  - Schema: `id`, `user_id`, `type`, `title`, `message`, `link_url`, `read_at`, `sent_via` (sms/email/push), `created_at`
  - Already referenced in `/lib/crud/notifications.ts`
  
- [ ] **Implement reminder sending endpoint**
  - Path: `/supabase/functions/server/send-reminder.ts`
  - Support SMS (Twilio), Email (SendGrid/Resend), Push (APNS/FCM)
  - Create notification record in database
  
- [ ] **Update EmployeeProfile reminder dialog**
  - Lines 115-118: Connect to real backend
  - Call send-reminder endpoint when submitted
  - Show confirmation toast

**Files to Create**:
- `/supabase/functions/server/send-reminder.ts`

**Files to Update**:
- `/components/EmployeeProfile.tsx` - Reminder dialog handler
- Verify `/lib/crud/notifications.ts` works with table

---

### 7. **Export Functionality**
**Current State**: Button exists, no implementation
**Impact**: Cannot export employee data for reporting

#### Action Items:
- [ ] **Create CSV export endpoint**
  - Path: `/supabase/functions/server/export-users.ts`
  - Generate CSV with user data, progress, certifications
  - Support filtering by same criteria as UI
  
- [ ] **Add export handler to People.tsx**
  - Line 214-217: Connect to endpoint
  - Download generated CSV file
  - Show loading state during generation

**Files to Create**:
- `/supabase/functions/server/export-users.ts`

**Files to Update**:
- `/components/People.tsx` - Line 214-217

---

### 8. **User Analytics & Reporting**
**Current State**: Basic stats shown, no detailed analytics
**Impact**: Limited insights into training effectiveness

#### Action Items:
- [ ] **Create analytics views/materialized views**
  - Weekly active users
  - Training completion rates by role/store/district
  - Average time to completion
  - Certification renewal rates
  
- [ ] **Add analytics endpoint**
  - Path: `/supabase/functions/server/analytics-users.ts`
  - Return aggregated data for dashboards
  
- [ ] **Create People Analytics page/tab**
  - Show trends over time
  - Identify at-risk employees (low progress)
  - Benchmark across stores/districts

**Files to Create**:
- `/supabase/functions/server/analytics-users.ts`
- `/components/PeopleAnalytics.tsx`

---

## 🟢 NICE TO HAVE: Future Enhancements

### 9. **Bulk User Import**
- CSV upload for bulk employee onboarding
- Validation and error reporting
- Background job processing for large imports

### 10. **User Profile Photos**
- Avatar upload to Supabase Storage
- Image cropping/resizing
- CDN integration

### 11. **Performance Reviews**
- `performance_reviews` table
- Scheduled review cycles
- Manager feedback and scoring

### 12. **Training Paths**
- Predefined learning paths by role
- Automatic assignment on hire
- Progress checkpoints

### 13. **Gamification**
- Points system
- Badges and achievements
- Leaderboards

---

## Implementation Priority

### Phase 1: Critical Database Infrastructure (Week 1)
1. Create roles, districts, stores tables
2. Migrate hardcoded dropdowns to real data
3. Audit and standardize progress tracking tables
4. Create activity_log table

### Phase 2: User Onboarding (Week 2)
1. Implement server-side invite system
2. Set up email templates
3. Test invite flow end-to-end

### Phase 3: Certifications & Compliance (Week 3)
1. Verify/create certifications tables
2. Implement auto-certification logic
3. Set up expiration monitoring
4. Add certification display to profiles

### Phase 4: Enhanced Features (Week 4)
1. Messaging/reminder system
2. CSV export
3. Activity feed real data
4. Basic analytics

---

## Database Schema Summary

### New Tables Needed:
```sql
-- 1. ROLES
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  permissions_json JSONB,
  level INTEGER CHECK (level BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. DISTRICTS
CREATE TABLE districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  name TEXT NOT NULL,
  code TEXT,
  manager_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. STORES (if not exists)
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  district_id UUID REFERENCES districts(id),
  name TEXT NOT NULL,
  code TEXT,
  address TEXT,
  manager_id UUID REFERENCES users(id),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ACTIVITY_LOG
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  user_id UUID REFERENCES users(id) NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  description TEXT,
  metadata_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_activity_user_date ON activity_log(user_id, created_at DESC);

-- 5. TRACK_PROGRESS (standardized)
CREATE TABLE track_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  track_id TEXT NOT NULL,
  status TEXT CHECK (status IN ('not-started', 'in-progress', 'completed')),
  progress_percent INTEGER DEFAULT 0,
  score INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  time_spent_seconds INTEGER DEFAULT 0,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, track_id)
);

-- 6. CERTIFICATIONS
CREATE TABLE certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  required_tracks UUID[],
  validity_period_days INTEGER DEFAULT 365,
  badge_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. USER_CERTIFICATIONS
CREATE TABLE user_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  certification_id UUID REFERENCES certifications(id) NOT NULL,
  issue_date DATE NOT NULL,
  expiration_date DATE NOT NULL,
  status TEXT CHECK (status IN ('valid', 'expiring-soon', 'expired')),
  score INTEGER,
  renewed_count INTEGER DEFAULT 0,
  renewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Testing Checklist

Before deploying to production:

- [ ] All database migrations run successfully
- [ ] RLS policies tested and verified
- [ ] User invite flow tested end-to-end
- [ ] Progress tracking accurate across all track types
- [ ] Certifications auto-issue correctly
- [ ] Activity logging works for all actions
- [ ] Export generates valid CSV
- [ ] Filters and search perform well with 1000+ users
- [ ] Role-based permissions enforced correctly
- [ ] Mobile responsive design verified

---

## Performance Considerations

1. **Indexing**: Ensure all foreign keys and frequently queried columns are indexed
2. **Materialized Views**: Consider for complex aggregations (training stats, compliance scores)
3. **Caching**: Use Redis or similar for frequently accessed org-wide data (roles, stores)
4. **Pagination**: Implement for large user lists (100+ employees)
5. **Background Jobs**: Use Supabase Edge Functions with cron for scheduled tasks

---

## Security Considerations

1. **RLS Policies**: Every table must have proper Row Level Security
2. **Admin Actions**: Sensitive operations (delete user, reset password) require admin role
3. **Data Access**: Users can only see data from their organization
4. **PII Protection**: Encrypt sensitive fields (SSN, salary if added)
5. **Audit Trail**: Log all admin actions to activity_log

---

## Conclusion

The People page has a solid foundation but needs critical database infrastructure before production launch. Priority should be:
1. **Organizational hierarchy** (roles, districts, stores)
2. **User onboarding** (invite system)
3. **Progress tracking** (standardize table)
4. **Activity logging** (visibility)

Estimated total effort: **3-4 weeks** for Phases 1-4.
