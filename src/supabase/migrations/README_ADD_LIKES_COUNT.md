# Add Likes Count to Tracks Table Migration

## Overview

This migration adds a `likes_count` column to the `tracks` table and creates a database function `increment_track_likes()` for atomic increment operations. This provides better reliability and consistency compared to storing likes only in KV store.

## How to Run

1. **Open Supabase Dashboard** → Go to your project
2. **Navigate to SQL Editor** (left sidebar)
3. **Create a new query**
4. **Copy and paste the contents of `00004_add_likes_count.sql`**
5. **Click "Run"**

## What It Does

- Adds `likes_count INTEGER DEFAULT 0` column to `tracks` table
- Creates index for sorting/filtering by likes
- Creates `increment_track_likes(UUID)` RPC function for atomic increments
- Uses `SECURITY DEFINER` to allow execution with elevated privileges

## Benefits

1. **Database as Source of Truth**: Likes are now stored in the database, not just KV store
2. **Atomic Operations**: Prevents race conditions when multiple likes happen simultaneously
3. **Better Performance**: Single database call instead of KV store operations
4. **Reliability**: Database-level operation is more reliable and persistent
5. **Queryable**: Can now query and sort tracks by likes count directly in SQL
6. **Backward Compatible**: Edge Function still updates KV store for caching

## Current Behavior

After migration:
- **Edge Function** (`/kb/like`): Updates both database AND KV store
- **Edge Function** (`/kb/likes/:trackId`): Reads from database first, falls back to KV store
- **CRUD Functions**: Can use `incrementTrackLikes()` for direct database updates

## Fallback Behavior

If the RPC function doesn't exist, the Edge Function will automatically fall back to manual increment (read-then-update). However, running this migration is recommended for better reliability.

## Verification

After running the migration, verify:

```sql
-- Check column exists
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'tracks' AND column_name = 'likes_count';

-- Check function exists
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'increment_track_likes';

-- Test the function (replace with actual track ID)
SELECT increment_track_likes('your-track-id-here');
```

## Migration from KV Store

If you have existing likes in KV store, you may want to migrate them to the database. However, the system will work fine with both - the Edge Function reads from database first, then falls back to KV store if needed.

