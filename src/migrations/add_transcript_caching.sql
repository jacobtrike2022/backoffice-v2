-- =====================================================
-- MIGRATION: Add Transcript Caching & Media Source Tracking
-- Purpose: Enable transcript reuse, media composability, and fact source tracking
-- Date: 2025-12-04
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
-- 2. ALTER: fact_usage table - Add media source tracking
-- =====================================================

ALTER TABLE fact_usage 
ADD COLUMN source_media_id TEXT,
ADD COLUMN source_media_url TEXT,
ADD COLUMN source_media_type TEXT CHECK (source_media_type IN ('image', 'video', 'audio')),
ADD COLUMN display_order INTEGER,
ADD COLUMN media_transcript_id UUID REFERENCES media_transcripts(id);

-- Indexes for fact_usage media tracking
CREATE INDEX idx_fact_usage_media_url ON fact_usage(source_media_url);
CREATE INDEX idx_fact_usage_media_transcript ON fact_usage(media_transcript_id);
CREATE INDEX idx_fact_usage_track_order ON fact_usage(track_id, display_order);

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

COMMENT ON COLUMN fact_usage.source_media_id IS 'Slide ID within story or media identifier';
COMMENT ON COLUMN fact_usage.source_media_url IS 'Direct link to media file (video/image URL)';
COMMENT ON COLUMN fact_usage.source_media_type IS 'Type of source media: image, video, or audio';
COMMENT ON COLUMN fact_usage.display_order IS 'Order of fact within track (matches slide order)';
COMMENT ON COLUMN fact_usage.media_transcript_id IS 'Link to transcript used for fact extraction';

COMMENT ON COLUMN tracks.media_transcript_id IS 'For video tracks: link to cached transcript';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Run these after migration to verify:

-- Check media_transcripts table exists
-- SELECT COUNT(*) FROM media_transcripts;

-- Check fact_usage has new columns
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'fact_usage' 
-- AND column_name IN ('source_media_id', 'source_media_url', 'source_media_type', 'display_order', 'media_transcript_id');

-- Check tracks has new column
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'tracks' 
-- AND column_name = 'media_transcript_id';
