# 🗄️ DATABASE SETUP INSTRUCTIONS

## Complete SQL Migration & Seed Files for Trike Backoffice

This document provides instructions for running the SQL migration and seed files that match your current CRUD implementation exactly.

---

## 📁 FILES

1. **`/supabase/migrations/00001_initial_schema.sql`** - Complete schema (all tables, indexes, RLS)
2. **`/supabase/seeds/00001_seed_data.sql`** - Sample data for development/testing

---

## 🚀 OPTION 1: Run via Supabase CLI (Recommended)

### Prerequisites
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login
```

### Link to Your Project
```bash
# Link to your Supabase project
supabase link --project-ref YOUR_PROJECT_REF
```

### Run Migration
```bash
# Apply the migration
supabase db push

# Or run migration file directly
psql "postgresql://postgres:[YOUR_PASSWORD]@db.[YOUR_PROJECT_REF].supabase.co:5432/postgres" \
  -f supabase/migrations/00001_initial_schema.sql
```

### Run Seeds
```bash
# Apply seed data
supabase db seed

# Or run seed file directly
psql "postgresql://postgres:[YOUR_PASSWORD]@db.[YOUR_PROJECT_REF].supabase.co:5432/postgres" \
  -f supabase/seeds/00001_seed_data.sql
```

---

## 🌐 OPTION 2: Run via Supabase Dashboard

### Step 1: Open SQL Editor
1. Go to https://app.supabase.com
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar

### Step 2: Run Migration
1. Click **New Query**
2. Copy contents of `/supabase/migrations/00001_initial_schema.sql`
3. Paste into SQL Editor
4. Click **Run** (or press Cmd/Ctrl + Enter)
5. Wait for completion (may take 30-60 seconds)

### Step 3: Run Seeds
1. Click **New Query**
2. Copy contents of `/supabase/seeds/00001_seed_data.sql`
3. Paste into SQL Editor
4. Click **Run**
5. Check the output for success message

---

## 💻 OPTION 3: Run via psql Command Line

### Connect to Database
```bash
# Replace with your actual connection string
psql "postgresql://postgres:[YOUR_PASSWORD]@db.[YOUR_PROJECT_REF].supabase.co:5432/postgres"
```

### Run Migration
```sql
\i supabase/migrations/00001_initial_schema.sql
```

### Run Seeds
```sql
\i supabase/seeds/00001_seed_data.sql
```

---

## ✅ VERIFICATION

After running both files, verify the setup:

### Check Tables Created
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

**Expected tables (21 total):**
- organizations, districts, stores
- roles, users
- tracks, albums, album_tracks
- playlists, playlist_albums, playlist_tracks
- assignments, user_progress
- certifications, user_certifications
- forms, form_blocks, form_submissions
- kb_categories, kb_articles, kb_attachments
- notifications, activity_logs

### Check Seed Data
```sql
-- Should return 1
SELECT COUNT(*) FROM organizations;

-- Should return 11
SELECT COUNT(*) FROM users;

-- Should return 7
SELECT COUNT(*) FROM tracks;

-- Should return 3
SELECT COUNT(*) FROM playlists;

-- Should return 3
SELECT COUNT(*) FROM assignments;
```

### Test RLS Policies
```sql
-- Check that RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
-- All should show 't' (true)

-- Count policies
SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';
-- Should show 30+ policies
```

---

## 🔧 TROUBLESHOOTING

### Issue: "relation already exists"
**Solution:** You're running migration on existing database. Either:
1. Drop all tables first (⚠️ DESTROYS DATA):
   ```sql
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   GRANT ALL ON SCHEMA public TO postgres;
   GRANT ALL ON SCHEMA public TO public;
   ```
2. Or create a fresh Supabase project

### Issue: "uuid-ossp extension not available"
**Solution:** Enable it first:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Issue: Foreign key constraint errors in seed
**Solution:** Make sure migration completed successfully before running seeds. Seeds depend on tables existing.

### Issue: RLS blocking queries
**Solution:** 
1. Temporarily disable RLS for testing:
   ```sql
   ALTER TABLE [table_name] DISABLE ROW LEVEL SECURITY;
   ```
2. Or create a proper auth user and link to users table

---

## 🎯 WHAT'S INCLUDED

### Complete Schema Features:
- ✅ 21 tables with proper relationships
- ✅ All foreign keys and constraints
- ✅ Comprehensive indexes for performance
- ✅ UUID primary keys throughout
- ✅ Automatic updated_at triggers
- ✅ Row Level Security (RLS) policies
- ✅ Organization-scoped data isolation
- ✅ Proper cascade delete rules

### Sample Data Includes:
- ✅ 1 Organization: "Trike Convenience Stores"
- ✅ 4 Districts: Northeast, Southeast, Midwest, Western
- ✅ 9 Stores across all districts
- ✅ 5 Roles: Admin, District Manager, Store Manager, CSR, Shift Lead
- ✅ 11 Users with realistic hierarchy
- ✅ 7 Training Tracks (video, article, story, checkpoint)
- ✅ 4 Albums with track associations
- ✅ 3 Playlists (2 auto, 1 manual)
- ✅ Active assignments and progress records
- ✅ Form templates and KB articles
- ✅ Notifications and activity logs

### Test Users:
| Role | Email | Name |
|------|-------|------|
| Admin | sarah.johnson@trike.com | Sarah Johnson |
| District Manager | michael.chen@trike.com | Michael Chen |
| Store Manager | david.thompson@trike.com | David Thompson |
| CSR | jessica.davis@trike.com | Jessica Davis |

---

## 🔗 MATCHES YOUR CODE

These SQL files match exactly:

### CRUD Functions
- ✅ `/lib/crud/tracks.ts` - tracks table
- ✅ `/lib/crud/albums.ts` - albums, album_tracks tables
- ✅ `/lib/crud/assignments.ts` - assignments table
- ✅ `/lib/crud/progress.ts` - user_progress table
- ✅ `/lib/crud/forms.ts` - forms, form_blocks, form_submissions tables
- ✅ `/lib/crud/certifications.ts` - certifications, user_certifications tables
- ✅ `/lib/crud/users.ts` - users, roles, stores, organizations tables
- ✅ `/lib/crud/knowledgeBase.ts` - kb_articles, kb_attachments, kb_categories tables
- ✅ `/lib/crud/notifications.ts` - notifications table
- ✅ `/lib/crud/activityLog.ts` - activity_logs table

### Hooks
- ✅ `/lib/hooks/useSupabase.ts` - All data fetching hooks
- ✅ `/lib/hooks/useSupabaseData.ts` - Extended hooks

### Converted Components
- ✅ `/components/ContentLibrary.tsx` - Uses tracks table
- ✅ `/components/People.tsx` - Uses users table
- ✅ `/components/Playlists.tsx` - Uses playlists, playlist_albums tables
- ✅ `/components/Dashboard.tsx` - Uses assignments, activity_logs tables

---

## 📊 ENTITY RELATIONSHIPS

```
organizations
  ├── districts
  │     └── stores
  ├── roles
  ├── users (belongs to role, store)
  ├── tracks
  ├── albums
  │     └── album_tracks (links albums → tracks)
  ├── playlists
  │     ├── playlist_albums (links playlists → albums)
  │     └── playlist_tracks (links playlists → tracks)
  ├── assignments (user + playlist)
  │     └── user_progress (assignment + track)
  ├── certifications
  │     └── user_certifications (user + certification)
  ├── forms
  │     ├── form_blocks (form fields)
  │     └── form_submissions (user responses)
  ├── kb_categories
  │     └── kb_articles
  │           └── kb_attachments
  ├── notifications (user notifications)
  └── activity_logs (audit trail)
```

---

## 🎉 SUCCESS CRITERIA

After running both files, you should be able to:

1. ✅ Browse content library with real tracks
2. ✅ View user directory with 11 sample employees
3. ✅ See 3 active playlists with albums/tracks
4. ✅ View assignments for users
5. ✅ Track progress on training
6. ✅ View activity logs and notifications
7. ✅ Access KB articles
8. ✅ All CRUD operations work

---

## 🔐 SECURITY NOTES

### RLS Policies Implemented:
- ✅ Organization-scoped data isolation (users only see their org)
- ✅ Users can view their own data
- ✅ Managers can view their team's data
- ✅ Admins can manage all org data
- ✅ Published content visible to all org users
- ✅ Draft content only visible to creators

### Auth Integration:
The schema includes `auth_user_id` in users table for linking to Supabase Auth.

To link a user after signup:
```sql
UPDATE users 
SET auth_user_id = '[AUTH_USER_ID]'
WHERE email = '[USER_EMAIL]';
```

---

## 📝 NEXT STEPS

After successful migration and seeding:

1. ✅ Verify all tables created
2. ✅ Verify seed data loaded
3. ✅ Test RLS policies
4. ✅ Update `/utils/supabase/info.tsx` with your project details
5. ✅ Test all converted components (ContentLibrary, People, Playlists)
6. ✅ Continue converting remaining components

---

## 🆘 SUPPORT

If you encounter issues:

1. Check Supabase logs in Dashboard → Database → Logs
2. Verify your connection string is correct
3. Ensure you have proper permissions
4. Check that UUID extension is enabled
5. Review the error message carefully

Common fixes:
```sql
-- Reset everything (⚠️ DESTROYS ALL DATA)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Then re-run migration and seeds
```

---

**Your database is now ready for the Trike Backoffice application! 🚀**
