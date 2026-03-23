# Scripts

## One-off SQL: Fix "value too long" when assigning employees to stores

**When:** You get "value too long for type character" (or 400) when assigning an employee to a Relay-scraped store in Edit People, or when "Fix store assignments" fails.

**Fix:** Run `scripts/apply_handle_location_transfer_fix.sql` in **Supabase Dashboard → SQL Editor**:

1. Open https://supabase.com/dashboard/project/kgzhlvxzdlexsrozbbxs/sql
2. Paste the contents of `scripts/apply_handle_location_transfer_fix.sql`
3. Click Run

---

## Track thumbnail recovery (list / restore from storage)

**When:** Track thumbnails were overwritten with the default image in the DB, but the original thumbnail files may still exist in Supabase Storage.

**What it does:** Lists all files in the track-media bucket under `thumbnails/` (path pattern: `thumbnails/{trackId}-{timestamp}.ext`). You can then optionally restore `thumbnail_url` for tracks that currently have no custom thumbnail.

**Usage:**

```bash
# List thumbnail files and see which tracks would be updated (dry run)
npx tsx scripts/list-and-recover-track-thumbnails.ts

# Apply updates: set thumbnail_url to a new signed URL for each track that has a file in storage
npx tsx scripts/list-and-recover-track-thumbnails.ts --recover
```

**Requires:** `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_TOKEN` in `.env` or `.cursor/credentials/SUPABASE_TOKEN.md`, and `VITE_SUPABASE_PROJECT_ID` or `SUPABASE_URL` if not using the default project.

---

# O*NET Data Import Scripts

## Overview

This directory contains scripts for importing O*NET SQL Server database exports into Supabase.

## Files

- **`import-onet-data.ts`** - Main import script that transforms and loads O*NET data
- **`verify-onet-import.ts`** - Verification script to check import results

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set environment variables (in `.env` or export):
   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

3. Place O*NET SQL files in `/Onet Data/` directory:
   - `000 Content Model Reference O*NET 21.3.sql`
   - `001 Knowledge.sql`
   - `002 Skills.sql`
   - `003 Abilities.sql`
   - `006 Task Statements.sql`
   - `010 Technology Skills.sql`
   - `013 Detailed Work Activities.sql`
   - `017 Occupation Data.sql`
   - `018 Alternate Titles.sql`

## Usage

### Import Data
```bash
npm run import:onet
```

### Verify Import
```bash
npm run verify:onet
```

## What the Script Does

1. **Parses MS SQL Server INSERT statements** - Handles GO statements, quoted strings, NULL values
2. **Loads Content Model Reference** - Maps element IDs to names (in memory)
3. **Transforms data** - Pivots IM/LV rows into importance/level columns
4. **Batch upserts** - Inserts 500 records at a time with conflict handling
5. **Respects dependencies** - Imports in correct order for foreign keys

## Expected Duration

- Full import: ~5-10 minutes
- Verification: ~10 seconds

## Troubleshooting

See `/src/ONET_SQL_IMPORT_GUIDE.md` for detailed troubleshooting guide.

