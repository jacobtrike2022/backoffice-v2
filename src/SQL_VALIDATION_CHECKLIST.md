# ✅ SQL MIGRATION & SEED VALIDATION CHECKLIST

Use this checklist to validate that your database is set up correctly and matches your code exactly.

---

## 📋 PRE-MIGRATION CHECKLIST

- [ ] Supabase project created
- [ ] Connection string obtained
- [ ] UUID extension available
- [ ] Backup existing data (if applicable)

---

## 🔍 POST-MIGRATION VALIDATION

### 1. Table Count Check
```sql
SELECT COUNT(*) as table_count 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';
```
**Expected Result:** `21 tables`

### 2. All Tables Present
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

**Expected Tables:**
- [ ] activity_logs
- [ ] album_tracks
- [ ] albums
- [ ] assignments
- [ ] certifications
- [ ] districts
- [ ] form_blocks
- [ ] form_submissions
- [ ] forms
- [ ] kb_articles
- [ ] kb_attachments
- [ ] kb_categories
- [ ] notifications
- [ ] organizations
- [ ] playlist_albums
- [ ] playlist_tracks
- [ ] playlists
- [ ] roles
- [ ] stores
- [ ] tracks
- [ ] user_certifications
- [ ] user_progress
- [ ] users

### 3. Column Validation

#### Organizations Table
```sql
\d organizations
```
**Expected columns:**
- [ ] id (UUID, PRIMARY KEY)
- [ ] name (TEXT)
- [ ] subdomain (TEXT)
- [ ] settings (JSONB)
- [ ] created_at (TIMESTAMPTZ)
- [ ] updated_at (TIMESTAMPTZ)

#### Users Table
```sql
\d users
```
**Expected columns:**
- [ ] id (UUID, PRIMARY KEY)
- [ ] organization_id (UUID, FK → organizations)
- [ ] role_id (UUID, FK → roles)
- [ ] store_id (UUID, FK → stores)
- [ ] first_name (TEXT)
- [ ] last_name (TEXT)
- [ ] email (TEXT)
- [ ] phone (TEXT)
- [ ] avatar_url (TEXT)
- [ ] employee_id (TEXT)
- [ ] hire_date (DATE)
- [ ] termination_date (DATE)
- [ ] status (TEXT)
- [ ] auth_user_id (UUID)
- [ ] invite_token (TEXT)
- [ ] invite_expires_at (TIMESTAMPTZ)
- [ ] metadata (JSONB)
- [ ] created_at (TIMESTAMPTZ)
- [ ] updated_at (TIMESTAMPTZ)

#### Tracks Table
```sql
\d tracks
```
**Expected columns:**
- [ ] id (UUID, PRIMARY KEY)
- [ ] organization_id (UUID, FK → organizations)
- [ ] title (TEXT)
- [ ] description (TEXT)
- [ ] type (TEXT: video|article|story|checkpoint)
- [ ] content_url (TEXT)
- [ ] thumbnail_url (TEXT)
- [ ] transcript (TEXT)
- [ ] duration_minutes (INTEGER)
- [ ] version (TEXT)
- [ ] status (TEXT: draft|review|published|archived)
- [ ] learning_objectives (TEXT[])
- [ ] tags (TEXT[])
- [ ] passing_score (INTEGER)
- [ ] max_attempts (INTEGER)
- [ ] published_at (TIMESTAMPTZ)
- [ ] published_by (UUID, FK → users)
- [ ] view_count (INTEGER)
- [ ] created_by (UUID, FK → users)
- [ ] created_at (TIMESTAMPTZ)
- [ ] updated_at (TIMESTAMPTZ)

#### Playlists Table
```sql
\d playlists
```
**Expected columns:**
- [ ] id (UUID, PRIMARY KEY)
- [ ] organization_id (UUID, FK → organizations)
- [ ] title (TEXT)
- [ ] description (TEXT)
- [ ] type (TEXT: auto|manual)
- [ ] trigger_rules (JSONB)
- [ ] release_type (TEXT: immediate|progressive)
- [ ] release_schedule (JSONB)
- [ ] is_active (BOOLEAN)
- [ ] created_by (UUID, FK → users)
- [ ] created_at (TIMESTAMPTZ)
- [ ] updated_at (TIMESTAMPTZ)

#### Assignments Table
```sql
\d assignments
```
**Expected columns:**
- [ ] id (UUID, PRIMARY KEY)
- [ ] organization_id (UUID, FK → organizations)
- [ ] user_id (UUID, FK → users)
- [ ] playlist_id (UUID, FK → playlists)
- [ ] assigned_by (UUID, FK → users)
- [ ] assigned_at (TIMESTAMPTZ)
- [ ] due_date (TIMESTAMPTZ)
- [ ] expires_at (TIMESTAMPTZ)
- [ ] status (TEXT: assigned|in_progress|completed|expired|overdue)
- [ ] progress_percent (INTEGER)
- [ ] started_at (TIMESTAMPTZ)
- [ ] completed_at (TIMESTAMPTZ)
- [ ] notification_sent (BOOLEAN)
- [ ] reminder_sent (BOOLEAN)
- [ ] created_at (TIMESTAMPTZ)
- [ ] updated_at (TIMESTAMPTZ)

### 4. Index Validation
```sql
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

**Key indexes to verify:**
- [ ] idx_users_organization
- [ ] idx_users_email
- [ ] idx_users_auth_user_id
- [ ] idx_tracks_organization
- [ ] idx_tracks_status
- [ ] idx_tracks_type
- [ ] idx_playlists_organization
- [ ] idx_playlists_type
- [ ] idx_assignments_user
- [ ] idx_assignments_status

### 5. Foreign Key Validation
```sql
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
```

**Expected foreign keys (partial list):**
- [ ] users.organization_id → organizations.id
- [ ] users.role_id → roles.id
- [ ] users.store_id → stores.id
- [ ] tracks.organization_id → organizations.id
- [ ] assignments.user_id → users.id
- [ ] assignments.playlist_id → playlists.id
- [ ] user_progress.user_id → users.id
- [ ] user_progress.track_id → tracks.id

### 6. Trigger Validation
```sql
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table;
```

**Expected triggers (one per table with updated_at):**
- [ ] update_organizations_updated_at
- [ ] update_users_updated_at
- [ ] update_tracks_updated_at
- [ ] update_playlists_updated_at
- [ ] update_assignments_updated_at
- [ ] (and ~15 more)

### 7. RLS Validation
```sql
SELECT 
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

**All tables should have RLS enabled:**
- [ ] All 21 tables show `rowsecurity = t`

### 8. RLS Policies Count
```sql
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

**Expected policies (30+):**
- [ ] Organizations: 1 policy
- [ ] Users: 2 policies
- [ ] Tracks: 4 policies
- [ ] Playlists: 2 policies
- [ ] Assignments: 2 policies
- [ ] User Progress: 3 policies
- [ ] Notifications: 2 policies
- [ ] (etc.)

---

## 🌱 POST-SEED VALIDATION

### 1. Record Counts
```sql
-- Organizations
SELECT 'organizations' as table_name, COUNT(*) as count FROM organizations
UNION ALL
-- Districts
SELECT 'districts', COUNT(*) FROM districts
UNION ALL
-- Stores
SELECT 'stores', COUNT(*) FROM stores
UNION ALL
-- Roles
SELECT 'roles', COUNT(*) FROM roles
UNION ALL
-- Users
SELECT 'users', COUNT(*) FROM users
UNION ALL
-- Tracks
SELECT 'tracks', COUNT(*) FROM tracks
UNION ALL
-- Albums
SELECT 'albums', COUNT(*) FROM albums
UNION ALL
-- Album Tracks
SELECT 'album_tracks', COUNT(*) FROM album_tracks
UNION ALL
-- Playlists
SELECT 'playlists', COUNT(*) FROM playlists
UNION ALL
-- Playlist Albums
SELECT 'playlist_albums', COUNT(*) FROM playlist_albums
UNION ALL
-- Assignments
SELECT 'assignments', COUNT(*) FROM assignments
UNION ALL
-- User Progress
SELECT 'user_progress', COUNT(*) FROM user_progress
UNION ALL
-- Certifications
SELECT 'certifications', COUNT(*) FROM certifications
UNION ALL
-- Forms
SELECT 'forms', COUNT(*) FROM forms
UNION ALL
-- Form Blocks
SELECT 'form_blocks', COUNT(*) FROM form_blocks
UNION ALL
-- KB Categories
SELECT 'kb_categories', COUNT(*) FROM kb_categories
UNION ALL
-- KB Articles
SELECT 'kb_articles', COUNT(*) FROM kb_articles
UNION ALL
-- Notifications
SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL
-- Activity Logs
SELECT 'activity_logs', COUNT(*) FROM activity_logs;
```

**Expected Counts:**
- [ ] organizations: 1
- [ ] districts: 4
- [ ] stores: 9
- [ ] roles: 5
- [ ] users: 11
- [ ] tracks: 7
- [ ] albums: 4
- [ ] album_tracks: 7
- [ ] playlists: 3
- [ ] playlist_albums: 6
- [ ] assignments: 3
- [ ] user_progress: 4
- [ ] certifications: 2
- [ ] forms: 2
- [ ] form_blocks: 5
- [ ] kb_categories: 3
- [ ] kb_articles: 3
- [ ] notifications: 3
- [ ] activity_logs: 3

### 2. Organization Validation
```sql
SELECT * FROM organizations;
```
**Expected:**
- [ ] Name: "Trike Convenience Stores"
- [ ] Subdomain: "trike"
- [ ] Settings includes theme, timezone, features

### 3. User Validation
```sql
SELECT 
    first_name,
    last_name,
    email,
    r.name as role,
    s.name as store
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
LEFT JOIN stores s ON u.store_id = s.id
ORDER BY r.level DESC, u.last_name;
```

**Expected users:**
- [ ] Sarah Johnson (Admin)
- [ ] Michael Chen (District Manager)
- [ ] Lisa Rodriguez (District Manager)
- [ ] David Thompson (Store Manager)
- [ ] Emily Martinez (Store Manager)
- [ ] James Wilson (Store Manager)
- [ ] Jessica Davis (CSR)
- [ ] Robert Brown (CSR)
- [ ] Amanda Garcia (Shift Lead)
- [ ] Daniel Lee (CSR)
- [ ] Maria Lopez (CSR)

### 4. Track Types Validation
```sql
SELECT type, COUNT(*) as count
FROM tracks
GROUP BY type
ORDER BY type;
```

**Expected:**
- [ ] article: 1
- [ ] checkpoint: 1
- [ ] story: 1
- [ ] video: 4

### 5. Track Status Validation
```sql
SELECT status, COUNT(*) as count
FROM tracks
GROUP BY status;
```

**Expected:**
- [ ] published: 7

### 6. Playlist Types Validation
```sql
SELECT 
    title,
    type,
    is_active,
    trigger_rules
FROM playlists
ORDER BY title;
```

**Expected:**
- [ ] First Week Orientation (auto, active, has trigger_rules)
- [ ] Food Handler Certification (auto, active, has trigger_rules)
- [ ] Manager Leadership Academy (manual, active, no trigger_rules)

### 7. Assignment Status Validation
```sql
SELECT 
    u.first_name || ' ' || u.last_name as user_name,
    p.title as playlist,
    a.status,
    a.progress_percent,
    a.due_date
FROM assignments a
JOIN users u ON a.user_id = u.id
JOIN playlists p ON a.playlist_id = p.id
ORDER BY u.last_name;
```

**Expected:**
- [ ] Jessica Davis: First Week Orientation, in_progress, 45%
- [ ] Robert Brown: First Week Orientation, assigned, 0%
- [ ] Amanda Garcia: Manager Leadership Academy, in_progress, 25%

### 8. Progress Tracking Validation
```sql
SELECT 
    u.first_name || ' ' || u.last_name as user_name,
    t.title as track_title,
    up.status,
    up.progress_percent,
    up.completed_at
FROM user_progress up
JOIN users u ON up.user_id = u.id
JOIN tracks t ON up.track_id = t.id
ORDER BY u.last_name, up.created_at;
```

**Expected:**
- [ ] Jessica Davis has 3 progress records (2 completed, 1 in progress)
- [ ] Amanda Garcia has 1 completed progress record

### 9. Relationship Integrity
```sql
-- Check playlist → albums → tracks relationships
SELECT 
    p.title as playlist,
    a.title as album,
    COUNT(at.id) as track_count
FROM playlists p
JOIN playlist_albums pa ON p.id = pa.playlist_id
JOIN albums a ON pa.album_id = a.id
JOIN album_tracks at ON a.id = at.album_id
GROUP BY p.id, p.title, a.id, a.title
ORDER BY p.title, a.title;
```

**Expected:**
- [ ] All playlists have albums
- [ ] All albums have tracks
- [ ] No NULL values

### 10. Data Integrity Checks
```sql
-- Check for orphaned records (shouldn't find any)

-- Users without organizations
SELECT COUNT(*) as orphaned_users
FROM users
WHERE organization_id NOT IN (SELECT id FROM organizations);
-- Expected: 0

-- Tracks without organizations
SELECT COUNT(*) as orphaned_tracks
FROM tracks
WHERE organization_id NOT IN (SELECT id FROM organizations);
-- Expected: 0

-- Assignments without users
SELECT COUNT(*) as orphaned_assignments
FROM assignments
WHERE user_id NOT IN (SELECT id FROM users);
-- Expected: 0

-- Progress without tracks
SELECT COUNT(*) as orphaned_progress
FROM user_progress
WHERE track_id NOT IN (SELECT id FROM tracks);
-- Expected: 0
```

**All should return 0**

---

## 🔧 FUNCTIONAL VALIDATION

### 1. Test Organization Scoping
```sql
-- Set a test user context (simulated)
SET LOCAL app.user_org = '11111111-1111-1111-1111-111111111111';

-- Query should only return data from that org
SELECT COUNT(*) FROM tracks WHERE organization_id = current_setting('app.user_org')::uuid;
-- Should equal total tracks (7)
```

### 2. Test Cascade Updates
```sql
-- Update a track and verify updated_at changes
UPDATE tracks 
SET title = 'Food Safety Fundamentals (Updated)'
WHERE id = '66666666-1111-1111-1111-111111111111'
RETURNING updated_at;

-- Verify updated_at is recent
SELECT title, updated_at FROM tracks 
WHERE id = '66666666-1111-1111-1111-111111111111';
-- updated_at should be NOW()
```

### 3. Test Foreign Key Constraints
```sql
-- Try to insert assignment with invalid user_id (should fail)
INSERT INTO assignments (organization_id, user_id, playlist_id)
VALUES ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', '88888888-1111-1111-1111-111111111111');
-- Expected: ERROR: foreign key constraint violation
```

### 4. Test RLS Helper Function
```sql
-- Test get_user_organization_id() function
SELECT get_user_organization_id();
-- Should return NULL (no auth user in this session)
```

---

## ✅ FINAL VERIFICATION

Run this comprehensive check:

```sql
DO $$
DECLARE
    v_tables INT;
    v_indexes INT;
    v_triggers INT;
    v_policies INT;
    v_orgs INT;
    v_users INT;
    v_tracks INT;
    v_playlists INT;
BEGIN
    -- Count tables
    SELECT COUNT(*) INTO v_tables
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    
    -- Count indexes
    SELECT COUNT(*) INTO v_indexes
    FROM pg_indexes
    WHERE schemaname = 'public';
    
    -- Count triggers
    SELECT COUNT(*) INTO v_triggers
    FROM information_schema.triggers
    WHERE trigger_schema = 'public';
    
    -- Count policies
    SELECT COUNT(*) INTO v_policies
    FROM pg_policies
    WHERE schemaname = 'public';
    
    -- Count seed data
    SELECT COUNT(*) INTO v_orgs FROM organizations;
    SELECT COUNT(*) INTO v_users FROM users;
    SELECT COUNT(*) INTO v_tracks FROM tracks;
    SELECT COUNT(*) INTO v_playlists FROM playlists;
    
    -- Report
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'DATABASE VALIDATION REPORT';
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'Tables: % (expected: 21)', v_tables;
    RAISE NOTICE 'Indexes: % (expected: 60+)', v_indexes;
    RAISE NOTICE 'Triggers: % (expected: 16+)', v_triggers;
    RAISE NOTICE 'RLS Policies: % (expected: 30+)', v_policies;
    RAISE NOTICE '';
    RAISE NOTICE 'Organizations: % (expected: 1)', v_orgs;
    RAISE NOTICE 'Users: % (expected: 11)', v_users;
    RAISE NOTICE 'Tracks: % (expected: 7)', v_tracks;
    RAISE NOTICE 'Playlists: % (expected: 3)', v_playlists;
    RAISE NOTICE '';
    
    -- Validate
    IF v_tables = 21 AND v_orgs = 1 AND v_users = 11 AND v_tracks = 7 AND v_playlists = 3 THEN
        RAISE NOTICE '✅ ALL VALIDATIONS PASSED!';
    ELSE
        RAISE NOTICE '❌ VALIDATION FAILED - Check counts above';
    END IF;
    RAISE NOTICE '==========================================';
END $$;
```

---

## 📝 VALIDATION SUMMARY

Once all checks pass:

- [ ] All 21 tables created
- [ ] All columns match schema
- [ ] All indexes created
- [ ] All foreign keys in place
- [ ] All triggers working
- [ ] RLS enabled on all tables
- [ ] RLS policies created
- [ ] Seed data loaded correctly
- [ ] Record counts match expected
- [ ] No orphaned records
- [ ] Relationships intact
- [ ] Cascade updates working

**Status:** ✅ Database Ready for Production

---

## 🚀 NEXT STEPS

After validation passes:

1. [ ] Update `/utils/supabase/info.tsx` with your project credentials
2. [ ] Test CRUD operations from application
3. [ ] Test converted components (ContentLibrary, People, Playlists)
4. [ ] Verify authentication flow
5. [ ] Continue component conversions

---

**Your database is validated and ready! 🎉**
