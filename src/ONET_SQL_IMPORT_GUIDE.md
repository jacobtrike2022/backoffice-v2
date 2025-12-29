# O*NET SQL Database Import Guide

## Overview
O*NET provides SQL database exports that are updated twice yearly by the Department of Labor. These are more complete than the API and better suited for our use case.

## File Structure
The O*NET SQL exports use this structure:
- **`knowledge`** table: Occupation → Knowledge mappings with Importance (IM) and Level (LV) scores
- **`skills`** table: Occupation → Skills mappings (similar structure)
- **`tasks`** table: Occupation-specific tasks
- **`content_model_reference`** table: Names and descriptions for knowledge/skills elements
- **`occupation_data`** table: Occupation codes, titles, descriptions
- **`scales_reference`** table: Scale definitions (IM, LV, etc.)

## Key Differences from Our Schema

### O*NET Structure:
```sql
knowledge (
  onetsoc_code,      -- Occupation code
  element_id,        -- Knowledge element ID (e.g., '2.C.1.a')
  scale_id,          -- 'IM' (Importance) or 'LV' (Level)
  data_value,        -- The score
  ...
)
```

### Our Structure:
```sql
onet_occupation_knowledge (
  onet_code,         -- Occupation code
  knowledge_id,      -- Knowledge element ID
  importance,        -- Importance score (0-100)
  level              -- Level score (0-7)
)
```

**Key Transformation**: O*NET has 2 rows per knowledge-occupation pair (one for IM, one for LV). We need to pivot this into 1 row with both columns.

## Import Process

### Step 1: Create Staging Table
Run the migration `00007_import_onet_knowledge.sql` which creates the staging table.

### Step 2: Import O*NET Data
You have two options:

#### Option A: Direct SQL Import (Recommended)
1. Open the `O*NET Knowledge Database.sql` file
2. Find the `CREATE TABLE knowledge` statement and the `INSERT INTO knowledge` statements
3. In Supabase SQL Editor:
   - First, create the staging table (already in migration)
   - Then, copy ALL the `INSERT INTO knowledge` statements
   - Paste and run them (this will insert into `onet_knowledge_staging`)

#### Option B: Use psql or Supabase CLI
```bash
# If you have psql installed
psql -h YOUR_DB_HOST -U postgres -d postgres -f "O*NET Knowledge Database.sql"

# Or use Supabase CLI
supabase db execute -f "O*NET Knowledge Database.sql"
```

### Step 3: Transform and Import
Run the rest of the migration `00007_import_onet_knowledge.sql` which:
1. Extracts unique knowledge elements → `onet_knowledge` master table
2. Pivots IM/LV rows → `onet_occupation_knowledge` mapping table

## Expected Results

After import, you should have:
- **`onet_knowledge`**: ~33 knowledge areas (master list)
- **`onet_occupation_knowledge`**: Thousands of occupation-knowledge mappings with importance/level scores

## Next Steps

1. **Import Knowledge** (this file)
2. **Import Skills** (similar process, different SQL file)
3. **Import Tasks** (different structure - one row per task)
4. **Import Occupations** (if you have occupation_data.sql)
5. **Import Content Model Reference** (for knowledge/skill names)

## Troubleshooting

### Issue: Foreign Key Violations
- Make sure `onet_occupations` table has the occupation codes first
- Or temporarily disable foreign key checks during import

### Issue: Data Type Mismatches
- O*NET uses `CHARACTER(10)` for codes, we use `VARCHAR(10)` - should be compatible
- O*NET uses `DECIMAL(5,2)`, we use `DECIMAL(5,2)` - should match

### Issue: Duplicate Keys
- The migration uses `ON CONFLICT DO UPDATE` to handle duplicates
- If you re-run, it will update existing records

## Verification

After import, run:
```sql
-- Check knowledge master table
SELECT COUNT(*) FROM onet_knowledge; -- Should be ~33

-- Check occupation-knowledge mappings
SELECT COUNT(*) FROM onet_occupation_knowledge; -- Should be thousands

-- Check a specific occupation
SELECT 
  k.name,
  ok.importance,
  ok.level
FROM onet_occupation_knowledge ok
JOIN onet_knowledge k ON ok.knowledge_id = k.knowledge_id
WHERE ok.onet_code = '41-2011.00' -- Cashiers
ORDER BY ok.importance DESC
LIMIT 10;
```

