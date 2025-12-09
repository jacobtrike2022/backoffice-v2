# Phase 1 Database Migration Guide

## ✅ What Was Fixed

The migration error has been resolved! The issue was that:
- The existing `stores` table uses `status` column (not `is_active`)
- The migration now properly handles existing tables
- All CRUD operations updated to use `status` instead of `is_active`

## 🚀 How to Run the Migration

### Step 1: Get Your Organization ID

First, find your organization ID by running this query in Supabase SQL Editor:

```sql
SELECT id, name FROM organizations LIMIT 5;
```

Copy the UUID for your organization.

### Step 2: Run the Migration

1. Open Supabase Dashboard → SQL Editor
2. Copy the contents of `/migrations/organizational_hierarchy.sql`
3. Paste into SQL Editor
4. **IMPORTANT:** Scroll to line ~237 and uncomment the INSERT statement
5. Replace `'YOUR_ORG_ID'` with your actual organization UUID
6. Click "Run" to execute

### Step 3: Verify Tables Created

Run these verification queries:

```sql
-- Check roles table
SELECT * FROM roles;

-- Check districts table  
SELECT * FROM districts;

-- Check stores table (should already exist, but now enhanced)
SELECT * FROM stores;
```

### Step 4: Test in the UI

1. Navigate to the People page in your app
2. Click "Add Employee"
3. The Role and Store dropdowns should now populate with real data from your database

## 📋 What the Migration Does

### Creates 3 Tables:

1. **`roles`** - Job roles (Admin, Store Manager, etc.)
   - Includes permission levels (1-5)
   - Stores permissions as JSONB
   - Uses `status` column ('active'/'inactive')

2. **`districts`** - Regional groupings of stores
   - Links to a district manager (users table)
   - Uses `status` column ('active'/'inactive')

3. **`stores`** - Already exists, but adds:
   - `district_id` foreign key
   - `manager_id` foreign key
   - `timezone` field

### Adds Row Level Security (RLS)

- Users can only see data from their organization
- Admins can manage everything
- District Managers can manage their district
- Store Managers can update their own store

### Seed Data

The migration includes default roles:
- Trike Super Admin (level 5)
- Admin (level 5)
- District Manager (level 4)
- Store Manager (level 3)
- Assistant Manager (level 2)
- Sales Associate (level 1)
- Cashier (level 1)

## ⚠️ Common Issues

### Issue: "relation already exists"
**Solution:** This is fine! The migration uses `CREATE TABLE IF NOT EXISTS`, so it won't fail if tables exist.

### Issue: "column already exists"
**Solution:** The migration checks for existing columns before adding them. No action needed.

### Issue: Dropdowns are empty
**Solution:** Make sure you:
1. Ran the seed data INSERT statement
2. Replaced 'YOUR_ORG_ID' with your actual organization ID
3. Have stores in your database

## 🎯 Next Steps

After this migration completes:
- ✅ Role and Store dropdowns will be dynamic
- ✅ You can add/edit roles via Supabase UI
- ✅ You can add/edit districts via Supabase UI
- ✅ Ready for Phase 2: User Invitation System

## 🔧 Manual Data Entry (Optional)

If you want to add roles/districts/stores manually:

### Add a Role:
```sql
INSERT INTO roles (organization_id, name, description, level)
VALUES ('YOUR_ORG_ID', 'Custom Role', 'Description here', 3);
```

### Add a District:
```sql
INSERT INTO districts (organization_id, name, code)
VALUES ('YOUR_ORG_ID', 'West District', 'WEST');
```

### Add a Store:
```sql
INSERT INTO stores (organization_id, name, code, city, state)
VALUES ('YOUR_ORG_ID', 'Downtown Store', 'DT001', 'San Francisco', 'CA');
```

## 📞 Support

If you encounter issues:
1. Check the browser console for errors
2. Check Supabase logs for SQL errors
3. Verify your organization_id is correct
4. Make sure RLS policies don't block your user
