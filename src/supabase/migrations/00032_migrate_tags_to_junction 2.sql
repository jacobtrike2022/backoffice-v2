-- Migration: Populate track_tags junction table from tracks.tags column
-- This migration ensures all existing track tags are properly stored in the junction table
-- Part of Phase B: Migrating from tracks.tags (text[]) to track_tags (junction table)

-- Step 1: Create track_tags table if it doesn't exist
CREATE TABLE IF NOT EXISTS track_tags (
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (track_id, tag_id)
);

-- Step 2: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_track_tags_track_id ON track_tags(track_id);
CREATE INDEX IF NOT EXISTS idx_track_tags_tag_id ON track_tags(tag_id);

-- Step 3: Enable RLS
ALTER TABLE track_tags ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies if they don't exist
DO $$
BEGIN
  -- Policy for viewing track_tags (same org or public tracks)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'track_tags' AND policyname = 'track_tags_select_policy'
  ) THEN
    CREATE POLICY track_tags_select_policy ON track_tags FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM tracks t
          WHERE t.id = track_tags.track_id
          AND (
            t.organization_id IN (SELECT organization_id FROM users WHERE auth_user_id = auth.uid())
            OR t.organization_id IS NULL
          )
        )
      );
  END IF;

  -- Policy for inserting track_tags (own org tracks only)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'track_tags' AND policyname = 'track_tags_insert_policy'
  ) THEN
    CREATE POLICY track_tags_insert_policy ON track_tags FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM tracks t
          WHERE t.id = track_tags.track_id
          AND t.organization_id IN (SELECT organization_id FROM users WHERE auth_user_id = auth.uid())
        )
      );
  END IF;

  -- Policy for deleting track_tags (own org tracks only)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'track_tags' AND policyname = 'track_tags_delete_policy'
  ) THEN
    CREATE POLICY track_tags_delete_policy ON track_tags FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM tracks t
          WHERE t.id = track_tags.track_id
          AND t.organization_id IN (SELECT organization_id FROM users WHERE auth_user_id = auth.uid())
        )
      );
  END IF;
END $$;

-- Step 5: Migrate existing tags from tracks.tags column to track_tags junction table
-- This inserts records for any track that has tags in the legacy column but not in junction table
INSERT INTO track_tags (track_id, tag_id)
SELECT DISTINCT
  t.id as track_id,
  tg.id as tag_id
FROM tracks t
CROSS JOIN LATERAL unnest(t.tags) as tag_name
JOIN tags tg ON tg.name = tag_name
WHERE t.tags IS NOT NULL
  AND array_length(t.tags, 1) > 0
  AND NOT EXISTS (
    SELECT 1 FROM track_tags tt
    WHERE tt.track_id = t.id AND tt.tag_id = tg.id
  )
ON CONFLICT (track_id, tag_id) DO NOTHING;

-- Step 6: Log migration results
DO $$
DECLARE
  migrated_count INTEGER;
  total_tracks_with_tags INTEGER;
BEGIN
  SELECT COUNT(DISTINCT track_id) INTO migrated_count FROM track_tags;
  SELECT COUNT(*) INTO total_tracks_with_tags FROM tracks WHERE tags IS NOT NULL AND array_length(tags, 1) > 0;

  RAISE NOTICE 'Migration complete: % tracks with tags in junction table, % tracks had tags in legacy column',
    migrated_count, total_tracks_with_tags;
END $$;

-- Note: The tracks.tags column is kept for backward compatibility during the transition period
-- Once all code is updated to use track_tags junction table, a future migration can drop the column:
-- ALTER TABLE tracks DROP COLUMN tags;
