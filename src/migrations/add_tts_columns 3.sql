-- Add TTS audio URL, voice, and generated timestamp columns to tracks table
-- These columns store the generated TTS audio file URL, voice used, and generation timestamp

ALTER TABLE tracks 
ADD COLUMN IF NOT EXISTS tts_audio_url TEXT,
ADD COLUMN IF NOT EXISTS tts_voice TEXT,
ADD COLUMN IF NOT EXISTS tts_generated_at TIMESTAMPTZ;

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_tracks_tts_audio_url ON tracks(tts_audio_url) WHERE tts_audio_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracks_tts_voice ON tracks(tts_voice) WHERE tts_voice IS NOT NULL;

-- Comments
COMMENT ON COLUMN tracks.tts_audio_url IS 'URL to the generated TTS audio file in storage';
COMMENT ON COLUMN tracks.tts_voice IS 'OpenAI voice used for TTS generation (alloy, echo, onyx, nova, shimmer)';
COMMENT ON COLUMN tracks.tts_generated_at IS 'Timestamp when TTS audio was last generated';
