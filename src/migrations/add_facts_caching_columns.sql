-- Add caching columns to tracks table for Key Facts auto-regeneration
-- This enables hash-based change detection (similar to TTS caching)

ALTER TABLE tracks 
ADD COLUMN IF NOT EXISTS facts_content_hash TEXT,
ADD COLUMN IF NOT EXISTS facts_generated_at TIMESTAMPTZ;

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_tracks_facts_hash ON tracks(facts_content_hash);

COMMENT ON COLUMN tracks.facts_content_hash IS 'SHA-256 hash of article content used to detect changes for auto-regeneration';
COMMENT ON COLUMN tracks.facts_generated_at IS 'Timestamp when Key Facts were last auto-generated';
