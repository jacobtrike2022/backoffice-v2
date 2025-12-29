# O*NET SQL Database Import Guide

## Overview
O*NET provides SQL database exports that are updated twice yearly by the Department of Labor. These are more complete than the API and better suited for our use case.

This guide covers importing O*NET SQL Server database exports into Supabase using our automated import script.

## Prerequisites

1. **O*NET SQL Files**: Download from O*NET and place in `/Onet Data/` directory:
   - `000 Content Model Reference O*NET 21.3.sql` (CRITICAL - element ID to name mappings)
   - `001 Knowledge.sql`
   - `002 Skills.sql`
   - `003 Abilities.sql`
   - `006 Task Statements.sql`
   - `010 Technology Skills.sql`
   - `013 Detailed Work Activities.sql`
   - `017 Occupation Data.sql`
   - `018 Alternate Titles.sql`

2. **Environment Variables**: Set in `.env` or export:
   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

3. **Dependencies**: Install required packages:
   ```bash
   npm install tsx @supabase/supabase-js
   ```

## Quick Start

### Step 1: Prepare Data Files
```bash
# Create directory and place SQL files
mkdir -p "Onet Data"
# Copy your O*NET SQL files into this directory
```

### Step 2: Run Import Script
```bash
npm run import:onet
```

The script will:
1. Load Content Model Reference into memory
2. Import occupations first (required for foreign keys)
3. Import all other data in dependency order
4. Transform and pivot IM/LV scales into importance/level columns
5. Batch upsert into Supabase (500 records at a time)

### Step 3: Verify Import
```bash
npm run verify:onet
```

## How It Works

### Data Transformation

O*NET SQL exports use a **row-based format** where each rating has two rows:
```sql
('11-1011.00', '2.C.1.a', 'IM', 4.25, ...)  -- Importance score
('11-1011.00', '2.C.1.a', 'LV', 5.12, ...)  -- Level score
```

Our schema uses a **column-based format** with both values in one row:
```sql
(onet_code, knowledge_id, importance, level)
```

The script automatically:
- Parses MS SQL Server INSERT statements
- Groups records by `(onetsoc_code, element_id)`
- Pivots IM/LV rows into importance/level columns
- Joins with Content Model Reference for element names
- Batch upserts into Supabase

### Import Order (Respecting Foreign Keys)

1. **Content Model Reference** → Loaded into memory (not stored)
2. **Occupations** → `onet_occupations` (required for foreign keys)
3. **Alternate Titles** → Updates `onet_occupations.also_called`
4. **Tasks** → `onet_tasks`
5. **Technology Skills** → `onet_technology_skills`
6. **Detailed Activities** → `onet_detailed_activities` (master table)
7. **Knowledge** → `onet_knowledge` (master) + `onet_occupation_knowledge` (mappings)
8. **Skills** → `onet_skills` (master) + `onet_occupation_skills` (mappings)
9. **Abilities** → `onet_abilities` (master) + `onet_occupation_abilities` (mappings)

## Expected Results

After successful import:

| Table | Expected Count | Description |
|-------|---------------|-------------|
| `onet_occupations` | ~1,000 | All O*NET occupations |
| `onet_knowledge` | ~33 | Master list of knowledge areas |
| `onet_occupation_knowledge` | ~33,000 | Occupation-knowledge mappings |
| `onet_skills` | ~35 | Master list of skills |
| `onet_occupation_skills` | ~35,000 | Occupation-skills mappings |
| `onet_abilities` | ~52 | Master list of abilities |
| `onet_occupation_abilities` | ~52,000 | Occupation-abilities mappings |
| `onet_tasks` | ~28,000 | All occupation tasks |
| `onet_technology_skills` | ~10,000+ | Technology tools per occupation |
| `onet_detailed_activities` | ~400 | Master list of work activities |

## Troubleshooting

### Issue: "Data directory not found"
**Solution**: Create `/Onet Data/` directory in project root and place SQL files there.

### Issue: "Missing required environment variables"
**Solution**: Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env` or export them.

### Issue: Foreign Key Violations
**Solution**: The script imports in dependency order. If you see FK errors, check that:
- Occupations were imported first
- All required tables exist (run migration `00006_create_onet_tables.sql`)

### Issue: SQL Parsing Errors
**Solution**: The script handles MS SQL Server syntax, but if you see parsing errors:
- Check that SQL files are in correct format
- Ensure files are not corrupted
- Verify file encoding is UTF-8

### Issue: Low Record Counts
**Solution**: 
- Check that all SQL files are present
- Verify file names match expected patterns
- Run verification script to see which tables are missing data

### Issue: Duplicate Key Errors
**Solution**: The script uses `upsert` with `ON CONFLICT`, so duplicates are handled automatically. If you see errors:
- Check that unique constraints match (e.g., `onet_code, knowledge_id`)
- Verify table schema matches migration

## Manual Verification Queries

After import, you can also verify manually in Supabase SQL Editor:

```sql
-- Count all tables
SELECT 'onet_occupations' as table_name, COUNT(*) as count FROM onet_occupations
UNION ALL SELECT 'onet_knowledge', COUNT(*) FROM onet_knowledge
UNION ALL SELECT 'onet_occupation_knowledge', COUNT(*) FROM onet_occupation_knowledge
UNION ALL SELECT 'onet_skills', COUNT(*) FROM onet_skills
UNION ALL SELECT 'onet_occupation_skills', COUNT(*) FROM onet_occupation_skills
UNION ALL SELECT 'onet_abilities', COUNT(*) FROM onet_abilities
UNION ALL SELECT 'onet_occupation_abilities', COUNT(*) FROM onet_occupation_abilities
UNION ALL SELECT 'onet_tasks', COUNT(*) FROM onet_tasks
UNION ALL SELECT 'onet_technology_skills', COUNT(*) FROM onet_technology_skills
UNION ALL SELECT 'onet_detailed_activities', COUNT(*) FROM onet_detailed_activities;

-- Spot check: Cashiers
SELECT 
  k.name,
  ok.importance,
  ok.level
FROM onet_occupation_knowledge ok
JOIN onet_knowledge k ON ok.knowledge_id = k.knowledge_id
WHERE ok.onet_code = '41-2011.00'
ORDER BY ok.importance DESC
LIMIT 10;
```

## Re-running the Import

The script is **idempotent** - safe to run multiple times:
- Uses `upsert` with `ON CONFLICT` to update existing records
- Skips suppressed/not-relevant records
- Handles duplicates gracefully

To re-import after O*NET updates (twice yearly):
```bash
# Just run the import again - it will update existing data
npm run import:onet
```

## Performance Notes

- **Batch Size**: 500 records per batch (configurable in script)
- **Duration**: ~5-10 minutes for full import
- **Memory**: Content Model Reference loaded into memory (~few MB)
- **Network**: All operations use Supabase client with connection pooling

## Next Steps

After successful import:
1. ✅ Verify data with `npm run verify:onet`
2. ✅ Build frontend components to use O*NET data
3. ✅ Create O*NET matching UI for role creation
4. ✅ Tag content with O*NET skills/knowledge

