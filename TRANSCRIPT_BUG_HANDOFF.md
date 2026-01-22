# Transcript Display Bug - Handoff Document

## Issue Summary

**Problem:** Video track transcripts don't display in the `InteractiveTranscript` component until the user toggles "Show in KB" to true. Key facts (which are generated FROM the transcript) display correctly, proving the transcript exists - but the interactive transcript shows "No transcript available."

**Observed Behavior:**
1. User creates new video track, uploads MP4, saves
2. Transcription runs, key facts are extracted and display correctly
3. User refreshes - still no transcript in InteractiveTranscript
4. User toggles "Show in KB" to true
5. **BOOM** - transcript immediately appears and works perfectly

**The Mystery:** The KB toggle has nothing to do with transcripts. Why does it trigger transcript display?

---

## Technical Background

### Data Flow

1. **Transcription API** (`/supabase/functions/trike-server/index.ts` ~line 4200-4400)
   - Calls AssemblyAI to transcribe audio
   - Saves result to `media_transcripts` table (with columns: `id`, `transcript_text`, `transcript_json`, `transcript_utterances`, etc. - about 23 columns)
   - Returns the full `media_transcripts` row as `transcript` in the API response
   - Also does a fire-and-forget update to the tracks table (line 4331-4344)

2. **Client-side Video Workflow** (`/src/lib/crud/tracks.ts` ~line 370-430)
   - Called by `createTrack` for video tracks (fire-and-forget)
   - Calls the transcribe API
   - Saves `transcript_data` to tracks table
   - Then generates key facts

3. **Track Fetching** (`/src/lib/crud/tracks.ts`)
   - `getTrackById` (line ~905): Fetches track, calls `enrichTracksWithJunctionTags`
   - `getTrackByIdOrLatest` (line ~923): Calls `getTrackById`, handles versioning
   - `getTracks` (line ~956): List query, also calls `enrichTracksWithJunctionTags`

4. **Enrichment Function** (`enrichTracksWithJunctionTags` line ~47-207)
   - Enriches tracks with tags from junction table
   - **ALSO** normalizes `transcript_data`:
     - If it has `transcript_json` nested inside, extract it
     - If `transcript_json` is empty, fall back to `transcript_text`/`transcript_utterances`

5. **InteractiveTranscript Component** (`/src/components/InteractiveTranscript.tsx`)
   - Expects `transcript` prop with shape: `{ text?, words?, utterances? }`
   - Line 188: Shows "No transcript" if `!transcript || (!transcript.text && !transcript.words && !transcript.utterances)`

### The Data Format Problem

**What InteractiveTranscript expects:**
```javascript
{
  text: "Full transcript text...",
  words: [{ text: "word", start: 0, end: 100, confidence: 0.99 }, ...],
  utterances: [{ speaker: "A", text: "...", words: [...] }, ...]
}
```

**What was being saved to tracks.transcript_data:**
```javascript
{
  id: "uuid",
  media_url: "...",
  media_url_hash: "...",
  transcript_text: "Full transcript text...",
  transcript_json: { text: "...", words: [...], utterances: [...] },  // THE ACTUAL DATA IS NESTED HERE
  transcript_utterances: [...],
  duration_seconds: 120,
  // ... 23 total keys from media_transcripts table
}
```

The enrichment function was SUPPOSED to extract `transcript_json` from this structure, but something was failing.

---

## Console Log Evidence

**First load (broken - 23 keys):**
```
ContentLibrary.tsx:522 Loaded fresh track data: {...}
ContentLibrary.tsx:523 Fresh track transcript_data keys: (23) ['id', 'language', 'media_url', ...]
```

**After KB toggle (working - 72 keys):**
```
ContentLibrary.tsx:797 ContentLibrary - updated track transcript_data keys: (72) ['id', 'text', 'words', ...]
```

The 72-key version has `text`, `words`, `utterances` at the top level - this is the properly extracted `transcript_json`.

---

## What I Attempted

### Fix 1: Save normalized data at source (tracks.ts line ~416-419)

**Before:**
```typescript
transcript_data: transcribeData.transcript  // Raw media_transcripts row
```

**After:**
```typescript
transcript_data: transcriptData  // Normalized transcript_json
```

Where `transcriptData` is extracted earlier:
```typescript
let transcriptData = transcribeData.transcript;
if (transcriptData && transcriptData.transcript_json) {
  transcriptData = transcriptData.transcript_json;
}
```

### Fix 2: Save normalized data on server (trike-server/index.ts line ~4335)

**Before:**
```typescript
transcript_data: newTranscript  // Full media_transcripts row
```

**After:**
```typescript
const normalizedTranscriptData = newTranscript?.transcript_json || transcript;
transcript_data: normalizedTranscriptData
```

### Fix 3: Enhanced enrichment function (tracks.ts lines 127-189)

Added:
- Handling for `transcript_json` being a JSON string (not just object)
- Handling for `transcript_utterances` being a JSON string
- Verbose logging to understand what's happening
- Warning log when media_transcripts structure has no usable data

### Fix 4: Debug logging throughout

Added console logs in:
- `enrichTracksWithJunctionTags` - logs raw input, transcript_json type/value, final output
- `ContentLibrary.tsx` - logs transcript_data keys when track is loaded
- `TrackDetailEdit.tsx` - logs transcript sync in view mode

---

## Why These Fixes May Not Have Worked

### Theory 1: Race Condition
The server's fire-and-forget update (line 4309-4385 in trike-server) runs in a `.then()` callback AFTER the API returns. The client's workflow ALSO updates the track. There might be a race where:
1. Client saves (correctly normalized)
2. Server's delayed update overwrites with raw format
3. First fetch gets raw format
4. By KB toggle time, some cache is cleared

### Theory 2: Supabase Caching
There might be caching at the Supabase client level or browser level that returns stale data on first fetch.

### Theory 3: React State Timing
The `selectedTrack` state update might not trigger re-render properly on first load, but does on KB toggle because it goes through a different code path.

### Theory 4: The enrichment IS working, but result isn't being used
The logs show "Extracting nested transcript_json" - so enrichment runs. But somehow the un-enriched data still reaches the component. There might be:
- A different code path that bypasses enrichment
- State being set from cached/stale data somewhere
- The track prop not updating when it should

---

## Key Files to Investigate

1. **`/src/lib/crud/tracks.ts`**
   - `enrichTracksWithJunctionTags` (line 47-207) - normalization logic
   - `automateVideoWorkflow` (line ~320-430) - client-side transcript save
   - `getTrackById` (line ~905) - single track fetch
   - `getTrackByIdOrLatest` (line ~923) - fetch with version redirect

2. **`/supabase/functions/trike-server/index.ts`**
   - `handleTranscribe` function (~line 4150-4400) - server-side transcript save

3. **`/src/components/ContentLibrary.tsx`**
   - `handleViewTrack` (line ~514) - initial track load
   - `handleUpdate` (line ~782) - called after KB toggle
   - Line 1973 - `setSelectedTrack(newTrack)` from tracks array (might bypass enrichment?)

4. **`/src/components/TrackDetailEdit.tsx`**
   - `viewModeTranscriptData` state (line ~131) - view mode transcript state
   - Sync useEffect (line ~183-194) - syncs transcript from track prop
   - Line ~1736-1739 - determines which transcript data to use

5. **`/src/components/InteractiveTranscript.tsx`**
   - Line 188 - condition that determines "no transcript" state

---

## Debugging Suggestions

1. **Add logging to see EXACTLY when enrichment result gets lost:**
   ```typescript
   // In getTrackById after enrichment
   console.log('getTrackById RETURNING:', {
     id: enrichedTracks[0].id,
     transcript_data_keys: Object.keys(enrichedTracks[0].transcript_data || {})
   });
   ```

2. **Check if there's a code path setting selectedTrack without fetching:**
   Search for `setSelectedTrack` calls that don't go through `getTrackById`:
   - Line 537: Fallback to cached `track` on fetch error
   - Line 1973: Sets from `tracks.find()` after variant creation

3. **Verify server's fire-and-forget isn't overwriting:**
   Add timestamp to both saves, check which one "wins" in the database

4. **Check if it's a React re-render issue:**
   Add a `useEffect` that logs whenever `track.transcript_data` changes in TrackDetailEdit

5. **Test with fresh track (no existing data):**
   Create brand new video, don't refresh, just wait - does transcript eventually appear?

---

## Quick Reproduction Steps

1. Go to Content Library
2. Create new Video track
3. Upload an MP4 file with speech
4. Save the track
5. Wait for "Key facts extracted" (proves transcript exists)
6. Note: InteractiveTranscript shows "No transcript available"
7. Toggle "Show in KB" to true
8. Observe: Transcript now displays

---

## Files Modified (may need review/revert)

1. `/src/lib/crud/tracks.ts` - enrichment enhancements, workflow fix
2. `/supabase/functions/trike-server/index.ts` - server-side save fix

---

## Contact

This handoff doc created 2026-01-22. The issue has persisted through multiple fix attempts. The core mystery remains: **why does getTrackById return 23-key (raw) data on first call but 72-key (enriched) data after KB toggle triggers a refetch?**
