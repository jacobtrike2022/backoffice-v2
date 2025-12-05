-- =====================================================
-- MIGRATION V2: Add Transcript Caching (Skip existing fact_usage columns)
-- Purpose: Add media_transcripts table and link tracks to transcripts
-- Date: 2025-12-04
-- Note: fact_usage columns already exist from previous migration
-- =====================================================

-- =====================================================
-- 1. CREATE: media_transcripts table
-- =====================================================

CREATE TABLE media_transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Media identification
    media_url TEXT NOT NULL UNIQUE,
    media_url_hash TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('video', 'audio')),
    
    -- Transcript data
    transcript_text TEXT NOT NULL,
    transcript_json JSONB,
    transcript_utterances JSONB,
    
    -- Metadata
    duration_seconds INTEGER,
    word_count INTEGER,
    language TEXT DEFAULT 'en',
    confidence_score DECIMAL(3,2),
    
    -- Caching & Performance
    transcribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    transcription_service TEXT DEFAULT 'assemblyai',
    transcription_model TEXT,
    
    -- Usage tracking
    used_in_tracks TEXT[],
    usage_count INTEGER DEFAULT 1,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Quality
    needs_review BOOLEAN DEFAULT false,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    manual_corrections TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for media_transcripts
CREATE INDEX idx_media_transcripts_url ON media_transcripts(media_url);
CREATE INDEX idx_media_transcripts_url_hash ON media_transcripts(media_url_hash);
CREATE INDEX idx_media_transcripts_used_in ON media_transcripts USING GIN(used_in_tracks);
CREATE INDEX idx_media_transcripts_updated ON media_transcripts(updated_at);

-- =====================================================
-- 2. ALTER: fact_usage - Add ONLY the missing column
-- =====================================================

-- Check if media_transcript_id column already exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fact_usage' 
        AND column_name = 'media_transcript_id'
    ) THEN
        ALTER TABLE fact_usage 
        ADD COLUMN media_transcript_id UUID REFERENCES media_transcripts(id);
        
        CREATE INDEX idx_fact_usage_media_transcript ON fact_usage(media_transcript_id);
    END IF;
END $$;

-- =====================================================
-- 3. ALTER: tracks table - Link to transcripts
-- =====================================================

ALTER TABLE tracks 
ADD COLUMN media_transcript_id UUID REFERENCES media_transcripts(id);

-- Index for tracks transcript link
CREATE INDEX idx_tracks_transcript ON tracks(media_transcript_id);

-- =====================================================
-- COMMENTS: Document the new schema
-- =====================================================

COMMENT ON TABLE media_transcripts IS 'Centralized transcript storage with caching and deduplication';
COMMENT ON COLUMN media_transcripts.media_url IS 'Unique media file URL - primary deduplication key';
COMMENT ON COLUMN media_transcripts.media_url_hash IS 'SHA-256 hash of media_url for faster lookups';
COMMENT ON COLUMN media_transcripts.used_in_tracks IS 'Array of track IDs using this transcript';
COMMENT ON COLUMN media_transcripts.usage_count IS 'Number of times this transcript has been used';

COMMENT ON COLUMN fact_usage.media_transcript_id IS 'Link to transcript used for fact extraction';
COMMENT ON COLUMN tracks.media_transcript_id IS 'For video tracks: link to cached transcript';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Run these after migration to verify:

-- Check media_transcripts table exists
SELECT COUNT(*) FROM media_transcripts;

-- Check all fact_usage columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'fact_usage' 
AND column_name IN ('source_media_id', 'source_media_url', 'source_media_type', 'display_order', 'media_transcript_id')
ORDER BY column_name;

-- Check tracks has transcript link
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tracks' 
AND column_name = 'media_transcript_id';

-- Show media_transcripts table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'media_transcripts'
ORDER BY ordinal_position;
