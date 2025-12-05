# Media Source Tracking for Facts

## Overview
This document describes the architecture for tying facts to their source media files, enabling composability, automatic cleanup, and intelligent reuse across tracks.

## Database Schema Changes Required

### fact_usage Table Updates
The `fact_usage` table needs the following new columns:

```sql
ALTER TABLE fact_usage 
ADD COLUMN source_media_id TEXT,           -- The slide/video ID within the story/track
ADD COLUMN source_media_url TEXT,          -- The actual media file URL (for cross-track reusability)
ADD COLUMN source_media_type TEXT,         -- 'image' | 'video'
ADD COLUMN display_order INTEGER;          -- Order within the track (for auto-sorting)
```

**Note:** These columns should be added via the Supabase UI dashboard, not through code, as Make doesn't support running migrations directly.

## Architecture Benefits

### 1. **Automatic Cleanup**
When a video slide is removed from a story, facts linked to that slide can be:
- Automatically removed from the track
- Flagged for review
- Archived for potential reuse

### 2. **Intelligent Ordering**
Facts automatically sort based on the source media's `display_order`, ensuring they appear in the same sequence as the videos in the story.

### 3. **Composability & Reuse**
When the same video is used in multiple stories:
- Facts are linked to the media URL, not just the track
- Query by `source_media_url` to find all facts ever extracted from that video
- Reuse facts across tracks without re-extraction

### 4. **Media Portability**
If a video is moved to a different track:
- Facts can follow the video (based on `source_media_url`)
- Preserves context and avoids duplicate extraction
- Maintains fact quality and consistency

## API Endpoints

### Generate Story Facts with Media Tracking
**POST** `/make-server-2858cc8b/generate-story-facts`

**Request Body:**
```json
{
  "title": "Story Title",
  "description": "Story description",
  "transcripts": [
    {
      "slideId": "slide_123",
      "slideName": "Introduction",
      "slideOrder": 0,
      "slideUrl": "https://...",
      "slideType": "video",
      "transcript": { "text": "...", ... }
    }
  ],
  "trackId": "track_abc",
  "companyId": "company_xyz"
}
```

**Response:**
```json
{
  "success": true,
  "enriched": [
    {
      "title": "Key Fact Title",
      "fact": "The actual fact content",
      "type": "Fact",
      "slideId": "slide_123",
      "slideName": "Introduction",
      "slideIndex": 0,
      "factId": "fact_db_id"
    }
  ],
  "factIds": ["fact_db_id_1", "fact_db_id_2"]
}
```

### Get Facts for Track (with Media Sources)
**GET** `/make-server-2858cc8b/facts/track/:trackId`

Returns facts with their `usedIn` array populated with media source metadata.

## Current Implementation Status

### ✅ Completed
- [x] Updated `FactUsage` TypeScript interface with media source fields
- [x] Updated `trackFactUsage()` to save media source metadata
- [x] Updated `mapDbToFact()` to return media source data
- [x] Created new `/generate-story-facts` endpoint with media tracking
- [x] Server-side infrastructure for media source tracking

### ⚠️ Pending (Requires Manual Database Update)
- [ ] Add columns to `fact_usage` table via Supabase UI
- [ ] Update client to use new `/generate-story-facts` endpoint
- [ ] Implement slide-to-fact matching algorithm (currently uses simple distribution)
- [ ] Add fact cleanup when slides are removed
- [ ] Add fact reordering when slides are reordered

## Usage Recommendations

### For Story Editors
When generating facts for stories, use the new endpoint:

```typescript
const response = await fetch(
  `https://${projectId}.supabase.co/functions/v1/make-server-2858cc8b/generate-story-facts`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${publicAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: storyTitle,
      description: storyDescription,
      transcripts: transcriptsWithMetadata, // Include slideId, slideUrl, etc.
      trackId: currentTrackId,
      companyId: companyId,
    }),
  }
);
```

### For Media Reuse Detection
Query facts by media URL to find if facts already exist for a video:

```typescript
// This would require a new endpoint:
GET /make-server-2858cc8b/facts/by-media/:mediaUrl
```

### For Slide Removal
When a slide is deleted, clean up associated facts:

```typescript
// This would require a new endpoint:
DELETE /make-server-2858cc8b/facts/by-media/:slideId?trackId=:trackId
```

## Future Enhancements

### 1. Smart Fact-to-Slide Matching
Instead of round-robin distribution, use NLP to match facts to the specific slide they came from:
- Extract keywords from each slide's transcript
- Match fact content to slide content using semantic similarity
- Assign facts to the most relevant slide

### 2. Fact Deduplication Across Tracks
When the same video appears in multiple tracks:
- Detect duplicate facts by content similarity
- Link to the same fact record instead of creating duplicates
- Update `usedIn` array to include all tracks using this fact

### 3. Automatic Fact Updates
When a video is updated (new version uploaded):
- Flag existing facts for review
- Optionally re-extract facts and compare with existing
- Suggest updates or mark outdated facts

### 4. Media Library Integration
Create a centralized media library where:
- Videos are stored once and reused across tracks
- Facts are extracted once per video
- Tracks reference media library items
- Facts automatically available when video is added to any track

## Migration Guide

To enable media source tracking on an existing system:

1. **Update Database** (via Supabase UI):
   ```sql
   ALTER TABLE fact_usage 
   ADD COLUMN source_media_id TEXT,
   ADD COLUMN source_media_url TEXT,
   ADD COLUMN source_media_type TEXT,
   ADD COLUMN display_order INTEGER;
   ```

2. **Backfill Existing Facts** (optional):
   - Existing facts won't have media source info
   - Can be left as-is (will work normally, just without media tracking)
   - Or can be manually linked if story transcript data is still available

3. **Update Clients**:
   - Story Editor: Use new `/generate-story-facts` endpoint
   - Other editors: Continue using `/generate-key-facts` (backward compatible)

## Questions Addressed

> "Do we have something in the database table for facts that ties the corresponding facts to their associated video source?"

**Answer:** Now yes! The `fact_usage` table will have:
- `source_media_id` - ties fact to specific slide within the track
- `source_media_url` - ties fact to the actual media file URL
- `source_media_type` - identifies whether it's from image or video
- `display_order` - enables automatic ordering based on source

> "What if we created composability with media files or variants in the future?"

**Answer:** The `source_media_url` field enables this! Facts are tied to the actual media file URL, so:
- Same video in different tracks = same facts can be reused
- Moving a video = facts can move with it
- Media variants (different quality, language, etc.) can reference the same base facts

> "If we moved that media file - we'd want those facts to move with it instead of accepting the variability of redoing the extract facts again for the same video in a different track. Right?"

**Answer:** Exactly! With `source_media_url`, you can:
1. Query all facts for a specific media URL before re-extracting
2. Reuse existing facts when adding the same video to a new track
3. Update all usages when a fact is improved (central fact record)
4. Avoid redundant AI extraction costs and maintain consistency
