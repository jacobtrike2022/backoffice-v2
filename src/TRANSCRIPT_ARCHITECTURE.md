# Transcript & Media Architecture

## Overview
This document describes the architecture for storing transcripts separately from tracks, enabling deduplication, caching, and composability across all content types.

## Current Problems

### Stories
- ❌ Transcripts generated on-demand every time
- ❌ Same video transcribed multiple times (expensive)
- ❌ No persistent transcript storage per-slide
- ❌ Facts regenerated = videos re-transcribed
- ❌ No transcript history or versioning

### Videos (Single-Video Tracks)
- ❌ No transcription support at all
- ❌ No AI fact extraction from video content
- ❌ No transcript field usage
- ❌ Missing parity with story features

### Both
- ❌ Transcripts not tied to media URLs (no portability)
- ❌ No cross-track transcript reuse
- ❌ No transcript caching layer

## Proposed Architecture

### Database Schema

#### New Table: `media_transcripts`
```sql
CREATE TABLE media_transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Media identification
    media_url TEXT NOT NULL UNIQUE,  -- The actual video/audio file URL
    media_url_hash TEXT NOT NULL,    -- Hash for faster lookups
    media_type TEXT NOT NULL CHECK (media_type IN ('video', 'audio')),
    
    -- Transcript data
    transcript_text TEXT NOT NULL,                -- Plain text transcript
    transcript_json JSONB,                        -- Full structured data with timestamps
    transcript_utterances JSONB,                  -- Speaker-separated segments (if available)
    
    -- Metadata
    duration_seconds INTEGER,
    word_count INTEGER,
    language TEXT DEFAULT 'en',
    confidence_score DECIMAL(3,2),                -- Average confidence from transcription service
    
    -- Caching & Performance
    transcribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    transcription_service TEXT DEFAULT 'assemblyai',
    transcription_model TEXT,                      -- Model version used
    
    -- Usage tracking
    used_in_tracks TEXT[],                         -- Array of track IDs using this transcript
    usage_count INTEGER DEFAULT 1,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Quality
    needs_review BOOLEAN DEFAULT false,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    manual_corrections TEXT,                       -- Track human edits
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_media_transcripts_url ON media_transcripts(media_url);
CREATE INDEX idx_media_transcripts_url_hash ON media_transcripts(media_url_hash);
CREATE INDEX idx_media_transcripts_used_in ON media_transcripts USING GIN(used_in_tracks);
CREATE INDEX idx_media_transcripts_updated ON media_transcripts(updated_at);
```

#### Updates to `tracks` table
```sql
-- For video tracks: link to their transcript
ALTER TABLE tracks ADD COLUMN media_transcript_id UUID REFERENCES media_transcripts(id);

-- For stories: transcript field continues to store JSON with slides + objectives + transcript refs
-- Format: { slides: [...], objectives: [...], transcriptIds: [...] }
```

#### Updates to `fact_usage` table (from previous work)
```sql
ALTER TABLE fact_usage 
ADD COLUMN source_media_id TEXT,           -- Slide ID within story
ADD COLUMN source_media_url TEXT,          -- Actual media URL
ADD COLUMN source_media_type TEXT,         -- 'image' | 'video'
ADD COLUMN display_order INTEGER,          -- Order within track
ADD COLUMN media_transcript_id UUID REFERENCES media_transcripts(id);  -- Link to transcript
```

### API Endpoints

#### 1. Transcribe with Caching
**POST** `/make-server-2858cc8b/transcribe-cached`

**Request:**
```json
{
  "mediaUrl": "https://...",
  "mediaType": "video",
  "trackId": "track_abc",
  "forceRefresh": false  // Optional: force re-transcription
}
```

**Response:**
```json
{
  "success": true,
  "transcript": {
    "id": "transcript_123",
    "text": "...",
    "json": { /* full data */ },
    "cached": true,
    "transcribedAt": "2025-01-01T00:00:00Z"
  }
}
```

**Logic:**
1. Hash the media URL
2. Check if transcript exists in `media_transcripts`
3. If exists and not `forceRefresh`: return cached transcript, increment `usage_count`
4. If not exists or `forceRefresh`: transcribe, save to DB, return new transcript

#### 2. Batch Transcribe Story (with caching)
**POST** `/make-server-2858cc8b/transcribe-story-cached`

**Request:**
```json
{
  "trackId": "story_abc",
  "slides": [
    { "id": "slide_1", "url": "https://...", "type": "video", "name": "Introduction" }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "transcripts": [
    {
      "slideId": "slide_1",
      "slideName": "Introduction",
      "transcriptId": "transcript_123",
      "transcript": { "text": "...", "json": {...} },
      "cached": true
    }
  ],
  "stats": {
    "total": 5,
    "cached": 3,
    "newlyTranscribed": 2,
    "failed": 0
  }
}
```

#### 3. Get Transcript by Media URL
**GET** `/make-server-2858cc8b/transcript/by-url?url=:encodedUrl`

Returns cached transcript if available, null otherwise.

#### 4. Update Transcript (manual corrections)
**PATCH** `/make-server-2858cc8b/transcript/:transcriptId`

**Request:**
```json
{
  "transcriptText": "Corrected text...",
  "manualCorrections": "Fixed speaker names and technical terms"
}
```

### Client-Side Changes

#### Story Editor
```typescript
// 1. When generating facts, use cached transcription
const transcriptResponse = await fetch(
  `${serverUrl}/transcribe-story-cached`,
  {
    method: 'POST',
    body: JSON.stringify({
      trackId: currentTrackId,
      slides: slides.filter(s => s.type === 'video')
    })
  }
);

const { transcripts, stats } = await transcriptResponse.json();
console.log(`Using ${stats.cached} cached transcripts, ${stats.newlyTranscribed} newly transcribed`);

// 2. Store transcript IDs in track data
const storyData = {
  slides: slides,
  objectives: objectives,
  transcriptIds: transcripts.map(t => t.transcriptId)  // NEW: persist references
};

// 3. When reopening story, fetch transcripts from DB instead of re-transcribing
const cachedTranscripts = await Promise.all(
  storyData.transcriptIds.map(id => 
    fetch(`${serverUrl}/transcript/${id}`).then(r => r.json())
  )
);
```

#### Video Editor
```typescript
// NEW: Add transcription support for single videos
const handleTranscribeVideo = async () => {
  setIsTranscribing(true);
  
  try {
    const response = await fetch(`${serverUrl}/transcribe-cached`, {
      method: 'POST',
      body: JSON.stringify({
        mediaUrl: videoUrl,
        mediaType: 'video',
        trackId: currentTrackId
      })
    });
    
    const { transcript, cached } = await response.json();
    
    if (cached) {
      toast.success('Used cached transcript');
    } else {
      toast.success('Video transcribed successfully');
    }
    
    setTranscript(transcript.text);
    setMediaTranscriptId(transcript.id);
    
  } finally {
    setIsTranscribing(false);
  }
};

// NEW: Generate key facts from video transcript
const handleGenerateKeyFacts = async () => {
  if (!transcript) {
    toast.error('Please transcribe the video first');
    return;
  }
  
  const response = await fetch(`${serverUrl}/generate-key-facts`, {
    method: 'POST',
    body: JSON.stringify({
      title,
      description,
      transcript,
      trackType: 'video',
      trackId: currentTrackId,
      companyId,
      // Include media source tracking
      sourceMediaUrl: videoUrl,
      sourceMediaType: 'video',
      mediaTranscriptId
    })
  });
  
  const { enriched, factIds } = await response.json();
  setObjectives(enriched);
};
```

### Server-Side Implementation

#### Transcript Service (`/supabase/functions/server/TranscriptService.ts`)

```typescript
export async function getOrCreateTranscript(
  mediaUrl: string,
  mediaType: 'video' | 'audio',
  trackId: string,
  forceRefresh: boolean = false
): Promise<MediaTranscript> {
  const urlHash = hashMediaUrl(mediaUrl);
  
  // Check cache
  if (!forceRefresh) {
    const { data: existing } = await supabase
      .from('media_transcripts')
      .select('*')
      .eq('media_url_hash', urlHash)
      .single();
    
    if (existing) {
      // Update usage tracking
      await supabase
        .from('media_transcripts')
        .update({
          usage_count: existing.usage_count + 1,
          last_used_at: new Date().toISOString(),
          used_in_tracks: [...(existing.used_in_tracks || []), trackId]
        })
        .eq('id', existing.id);
      
      return {
        ...existing,
        cached: true
      };
    }
  }
  
  // Transcribe
  const transcriptData = await transcribeVideo(mediaUrl);
  
  // Save to database
  const { data: newTranscript } = await supabase
    .from('media_transcripts')
    .insert({
      media_url: mediaUrl,
      media_url_hash: urlHash,
      media_type: mediaType,
      transcript_text: transcriptData.text,
      transcript_json: transcriptData,
      duration_seconds: transcriptData.duration,
      word_count: transcriptData.words?.length || 0,
      confidence_score: transcriptData.confidence,
      used_in_tracks: [trackId]
    })
    .select()
    .single();
  
  return {
    ...newTranscript,
    cached: false
  };
}

function hashMediaUrl(url: string): string {
  // Use crypto hash for consistent URL identification
  return createHash('sha256').update(url).digest('hex');
}
```

## Benefits Summary

### Cost Savings
- ✅ Same video transcribed once across all tracks
- ✅ Regenerating facts doesn't re-transcribe
- ✅ Estimated 70-90% reduction in transcription costs for reused content

### Performance
- ✅ Instant transcript retrieval from cache
- ✅ Faster fact generation (no transcription wait)
- ✅ Better user experience

### Data Integrity
- ✅ Consistent transcripts for same media
- ✅ Transcript history and versioning
- ✅ Manual correction tracking
- ✅ Quality review workflow

### Composability
- ✅ Transcripts follow media across tracks
- ✅ Facts AND transcripts are portable
- ✅ Media library ready (future)
- ✅ Multi-language support ready (future)

### Feature Parity
- ✅ Videos get same AI features as stories
- ✅ Unified transcript architecture
- ✅ Consistent UX across content types

## Migration Strategy

### Phase 1: Database Setup (Manual)
1. Create `media_transcripts` table via Supabase UI
2. Add `media_transcript_id` to `tracks` table
3. Add media source fields to `fact_usage` table

### Phase 2: Server Implementation
1. Create `TranscriptService.ts`
2. Add `/transcribe-cached` endpoint
3. Add `/transcribe-story-cached` endpoint
4. Update fact generation to use cached transcripts

### Phase 3: Client Updates
1. Update StoryEditor to use cached transcription
2. Update VideoEditor to support transcription
3. Add transcript viewer/editor component (optional)

### Phase 4: Backfill (Optional)
- Parse existing story tracks to extract video URLs
- Generate transcripts for frequently-used videos
- Link existing facts to transcripts (best effort)

## Future Enhancements

### 1. Transcript Editing
- Manual correction UI
- Speaker identification
- Timestamp editing
- Export to SRT/VTT for captions

### 2. Advanced Analytics
- Most transcribed content
- Transcript quality metrics
- Cost savings dashboard
- Usage patterns

### 3. Multi-Language Support
- Store multiple language versions per media
- Automatic translation
- Language-specific fact extraction

### 4. Media Library
- Centralized media asset management
- Transcript preview before adding to track
- Search transcripts across all media
- Content recommendation based on transcript similarity

## Questions Answered

> "Are we attaching the transcript via relation to the slide/media?"

**Current State:** No - transcripts are generated on-demand and discarded.

**Proposed State:** Yes - transcripts stored in `media_transcripts` table, linked to tracks via `media_transcript_id`, and facts link to both media URL and transcript ID.

> "For videos - we probably need to address whatever we did for story videos to the video videos as well, right?"

**Absolutely!** The new architecture provides:
- Video transcription support
- AI fact extraction from videos
- Media source tracking for video facts
- Same composability benefits as stories
- Unified architecture for all media types

The Video track should have feature parity with Story videos: transcription → fact extraction → media source tracking.
