# ⚡ QUICK START - Database Setup in 5 Minutes

## Get Your Trike Backoffice Database Running Now!

---

## 🎯 GOAL
Get from zero to a fully functional database with sample data in under 5 minutes.

---

## 📋 PREREQUISITES

- [ ] Supabase account (free tier works)
- [ ] Supabase project created
- [ ] Connection details handy

---

## 🚀 3-STEP SETUP

### Step 1: Open Supabase SQL Editor (1 min)

1. Go to https://app.supabase.com
2. Select your project
3. Click **"SQL Editor"** in left sidebar
4. Click **"New Query"**

### Step 2: Run Migration (2 min)

1. Open `/supabase/migrations/00001_initial_schema.sql`
2. Copy ALL contents (Ctrl/Cmd + A, then Ctrl/Cmd + C)
3. Paste into SQL Editor
4. Click **"Run"** (or Ctrl/Cmd + Enter)
5. Wait ~30 seconds
6. Look for ✅ "Success. No rows returned"

### Step 3: Run Seeds (2 min)

1. Click **"New Query"** again
2. Open `/supabase/seeds/00001_seed_data.sql`
3. Copy ALL contents
4. Paste into SQL Editor
5. Click **"Run"**
6. Wait ~15 seconds
7. Look for success message with data summary

---

## ✅ VERIFY IT WORKED

Run this query in SQL Editor:

```sql
SELECT 
    'organizations' as table_name, COUNT(*) FROM organizations
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'tracks', COUNT(*) FROM tracks
UNION ALL
SELECT 'playlists', COUNT(*) FROM playlists
UNION ALL
SELECT 'assignments', COUNT(*) FROM assignments;
```

**Expected Results:**
```
organizations | 1
users         | 11
tracks        | 7
playlists     | 3
assignments   | 3
```

✅ If you see these numbers, **YOU'RE DONE!**

---

## 🎉 WHAT YOU NOW HAVE

### ✅ Complete Database
- 21 tables ready to use
- 60+ performance indexes
- Row Level Security configured
- Auto-update triggers active

### ✅ Sample Data
- 1 Organization: "Trike Convenience Stores"
- 11 Users (Admin, Managers, Employees)
- 7 Training Tracks (various types)
- 3 Playlists (auto + manual)
- 3 Active assignments

### ✅ Test Users
| Name | Email | Role |
|------|-------|------|
| Sarah Johnson | sarah.johnson@trike.com | Admin |
| David Thompson | david.thompson@trike.com | Store Manager |
| Jessica Davis | jessica.davis@trike.com | CSR |

---

## 🔧 CONNECT YOUR APP

### Update Supabase Config

1. Open `/utils/supabase/info.tsx`
2. Find your project details:
   - Go to Supabase Dashboard → Settings → API
   - Copy **Project URL** and **anon public key**
3. Update the file:

```typescript
export const projectId = 'your-project-id'; // from Project URL
export const publicAnonKey = 'your-anon-key'; // from API settings
```

### Test Connection

```bash
npm run dev
```

Visit your app - these components should work with REAL data:
- ✅ Content Library
- ✅ People Management
- ✅ Playlists

---

## 🧪 QUICK TESTS

### Test 1: Browse Tracks
```sql
SELECT title, type, status FROM tracks ORDER BY created_at DESC;
```
Should return 7 tracks ✅

### Test 2: View Users
```sql
SELECT first_name, last_name, email FROM users ORDER BY last_name;
```
Should return 11 users ✅

### Test 3: Check Assignments
```sql
SELECT COUNT(*) as active_assignments 
FROM assignments 
WHERE status IN ('assigned', 'in_progress');
```
Should return 3 ✅

---

## 🐛 TROUBLESHOOTING

### Problem: "relation already exists"
**Solution:** Your database already has tables. Either:
- Use a fresh Supabase project, OR
- Drop existing tables first (⚠️ destroys data):
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

### Problem: "permission denied"
**Solution:** You need owner/admin access to the database.

### Problem: "uuid-ossp extension not found"
**Solution:** Enable it first:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Problem: Migration succeeds but seeds fail
**Solution:** Make sure migration completed fully. Check:
```sql
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';
```
Should return 21 tables.

---

## 📚 NEXT STEPS

### 1. Explore Your Data
```sql
-- See all tracks
SELECT * FROM tracks WHERE status = 'published';

-- See user hierarchy
SELECT u.first_name, u.last_name, r.name as role, s.name as store
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
LEFT JOIN stores s ON u.store_id = s.id;

-- See playlist structure
SELECT p.title, p.type, COUNT(pa.id) as album_count
FROM playlists p
LEFT JOIN playlist_albums pa ON p.id = pa.playlist_id
GROUP BY p.id, p.title, p.type;
```

### 2. Test CRUD Operations
```typescript
// In your app
import * as crud from './lib/crud';

// Get all tracks
const tracks = await crud.getTracks({ status: 'published' });
console.log('Tracks:', tracks);

// Get all users
const users = await crud.getUsers({ status: 'active' });
console.log('Users:', users);
```

### 3. Test Components
Visit these routes in your app:
- `/content-library` - Should show 7 tracks
- `/people` - Should show 11 users
- `/playlists` - Should show 3 playlists

### 4. Continue Development
- Convert remaining 30 components
- Follow `/CONVERSION_GUIDE.md`
- Use converted components as examples

---

## 📖 FULL DOCUMENTATION

For detailed information, see:

- **`/DATABASE_SETUP_INSTRUCTIONS.md`** - Complete setup guide
- **`/SQL_VALIDATION_CHECKLIST.md`** - Full validation procedures
- **`/SQL_DELIVERY_SUMMARY.md`** - Comprehensive overview
- **`/CONVERSION_GUIDE.md`** - Component conversion guide

---

## ✨ YOU'RE ALL SET!

Your database is:
- ✅ Fully configured
- ✅ Loaded with sample data
- ✅ Secured with RLS
- ✅ Optimized with indexes
- ✅ Ready for development

**Total setup time: ~5 minutes**
**Components ready to use: 4 (ContentLibrary, People, Playlists, Dashboard)**
**CRUD operations ready: All 10 modules**

---

## 🎊 SUCCESS!

```
 ╔═══════════════════════════════════════╗
 ║                                       ║
 ║   ✅ DATABASE SETUP COMPLETE!         ║
 ║                                       ║
 ║   🚀 Ready to build amazing things    ║
 ║                                       ║
 ╚═══════════════════════════════════════╝
```

**Start coding with confidence!** 💪

---

_Quick Start Guide v1.0 - Get building in 5 minutes!_
