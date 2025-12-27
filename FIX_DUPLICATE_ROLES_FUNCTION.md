# Fix find_duplicate_roles Function Type Mismatch

## Error
```
Returned type real does not match expected type numeric in column 5
```

## Problem
The `find_duplicate_roles` function returns `REAL` type for `similarity_score`, but PostgREST expects `NUMERIC`.

## Solution

### Step 1: Get Current Function Definition

Run this in Supabase SQL Editor to see your current function:

```sql
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'find_duplicate_roles';
```

### Step 2: Update the Function

Modify your function to cast `similarity_score` to `NUMERIC`. Here's the key change:

**In the RETURNS TABLE clause, change:**
```sql
similarity_score REAL
```
**To:**
```sql
similarity_score NUMERIC
```

**In the SELECT statement, cast the similarity calculation:**
```sql
-- If using pg_trgm similarity (returns REAL):
similarity(r1.name, r2.name)::NUMERIC AS similarity_score

-- Or if you have a custom calculation:
CAST(your_calculation AS NUMERIC) AS similarity_score
```

### Step 3: Example Complete Function

Here's a template you can use (adjust based on your actual logic):

```sql
CREATE OR REPLACE FUNCTION find_duplicate_roles(
  p_org_id UUID,
  p_threshold NUMERIC DEFAULT 0.6
)
RETURNS TABLE (
  role_id UUID,
  role_name TEXT,
  potential_match_id UUID,
  potential_match_name TEXT,
  similarity_score NUMERIC  -- ← Changed from REAL to NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r1.id AS role_id,
    r1.name AS role_name,
    r2.id AS potential_match_id,
    r2.name AS potential_match_name,
    -- Cast to NUMERIC (pg_trgm similarity returns REAL)
    similarity(r1.name, r2.name)::NUMERIC AS similarity_score
  FROM roles r1
  CROSS JOIN roles r2
  WHERE r1.organization_id = p_org_id
    AND r2.organization_id = p_org_id
    AND r1.id < r2.id
    AND r1.status != 'archived'
    AND r2.status != 'archived'
    AND similarity(r1.name, r2.name) >= p_threshold
  ORDER BY similarity_score DESC;
END;
$$;
```

### Step 4: Grant Permissions

```sql
GRANT EXECUTE ON FUNCTION find_duplicate_roles(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION find_duplicate_roles(UUID, NUMERIC) TO anon;
```

## Quick Fix (If you just need to cast the return)

If you can't modify the function easily, you can create a wrapper:

```sql
CREATE OR REPLACE FUNCTION find_duplicate_roles_fixed(
  p_org_id UUID,
  p_threshold NUMERIC DEFAULT 0.6
)
RETURNS TABLE (
  role_id UUID,
  role_name TEXT,
  potential_match_id UUID,
  potential_match_name TEXT,
  similarity_score NUMERIC
)
LANGUAGE sql
AS $$
  SELECT 
    role_id,
    role_name,
    potential_match_id,
    potential_match_name,
    similarity_score::NUMERIC  -- Cast here
  FROM find_duplicate_roles(p_org_id, p_threshold::REAL);
$$;
```

Then update the API to call `find_duplicate_roles_fixed` instead.

