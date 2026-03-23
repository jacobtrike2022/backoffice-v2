-- Add TTS content hash column to tracks table for content change detection
-- This prevents unnecessary TTS regeneration when only metadata (tags, etc.) changes

ALTER TABLE tracks 
ADD COLUMN IF NOT EXISTS tts_content_hash TEXT;

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_tracks_tts_hash ON tracks(tts_content_hash);

COMMENT ON COLUMN tracks.tts_content_hash IS 'SHA-256 hash of article/video content text used to detect changes for TTS regeneration. Only regenerates TTS if content hash changes.';
