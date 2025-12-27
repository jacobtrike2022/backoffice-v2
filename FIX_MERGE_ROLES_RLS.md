# Fix merge_roles RLS Error

## Error
```
new row violates row-level security policy for table "role_merge_history"
```

## Problem
The `merge_roles` function is trying to insert into `role_merge_history` table, but RLS is blocking it.

## Solution Options

### Option 1: Update Function to Use SECURITY DEFINER (Recommended)

Run this in Supabase SQL Editor to check and update the function:

```sql
-- First, get the current function definition
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'merge_roles';

-- Then recreate it with SECURITY DEFINER
-- Replace the function definition with SECURITY DEFINER added
-- Example:
CREATE OR REPLACE FUNCTION merge_roles(
  p_source_role_id UUID,
  p_target_role_id UUID,
  p_merged_by UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  users_migrated INTEGER,
  source_archived BOOLEAN,
  source_role_id UUID,
  target_role_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER  -- ← Add this line
SET search_path = public
AS $$
BEGIN
  -- Your existing function logic here
  -- The SECURITY DEFINER will bypass RLS
END;
$$;
```

### Option 2: Fix RLS Policy (If function can't use SECURITY DEFINER)

Run the migration file: `src/migrations/fix_role_merge_history_rls.sql`

This creates an INSERT policy that allows authenticated users to insert merge history records.

### Option 3: Temporarily Disable RLS in Function

If you can modify the function, add this before the INSERT:

```sql
SET LOCAL row_security = off;
INSERT INTO role_merge_history (...);
SET LOCAL row_security = on;
```

## Quick Fix

Run this SQL to add the INSERT policy:

```sql
-- Enable RLS
ALTER TABLE role_merge_history ENABLE ROW LEVEL SECURITY;

-- Create INSERT policy
CREATE POLICY "Users can insert merge history in their organization"
  ON role_merge_history FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE auth_user_id = auth.uid()
    )
  );
```

This should allow the merge_roles function to insert records when called by authenticated users.

