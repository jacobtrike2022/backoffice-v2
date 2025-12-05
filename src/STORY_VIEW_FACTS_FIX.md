# Story View Mode - Key Facts Display Fix

## Problem
Key facts were not being displayed in Story track VIEW mode (read-only preview). The facts section existed in the UI but wasn't showing data because:

1. Facts were being loaded from the database
2. But media source metadata (slideId, slideName, slideIndex) was being stripped during API response
3. The UI tried to group facts by slide, but no slide metadata was available

## Root Cause
The `/facts/track/:trackId` API endpoint was returning facts WITHOUT their usage metadata, which contains the critical media source information needed for grouping.

## Solution

### 1. Backend Fix - FactService.ts
Updated `getFactsForTrack()` to include usage metadata in the response:

```typescript
export async function getFactsForTrack(trackType: TrackType, trackId: string): Promise<KeyFact[]> {
  // Get fact usages WITH media source metadata
  const { data: usages } = await supabase
    .from('fact_usage')
    .select('fact_id, source_media_id, source_media_url, source_media_type, display_order')
    .eq('track_type', trackType)
    .eq('track_id', trackId);

  // ... get facts ...

  // Map facts and attach usage metadata
  return (facts || []).map(f => {
    const usage = usages.find(u => u.fact_id === f.id);
    const mappedFact = mapDbToFact(f, [], []);
    
    // Attach usage metadata for client-side grouping
    return {
      ...mappedFact,
      usage: usage ? [usage] : []
    };
  });
}
```

**Key Changes:**
- ✅ Select media source fields from `fact_usage`
- ✅ Attach usage array to each fact
- ✅ Preserve slideId, slideIndex, slideUrl for grouping

### 2. Frontend Fix - StoryEditor.tsx
Updated view mode fact loading to preserve and enrich metadata:

```typescript
const factsFromDB = (data.facts || []).map((f: any) => {
  // If fact has usage metadata with media source, preserve it
  if (f.usage && f.usage.length > 0) {
    const usage = f.usage[0]; // First usage record
    
    // Try to find the slide by media ID
    let slideName = null;
    let slideIndex = usage.display_order || 0;
    
    if (usage.source_media_id) {
      const slide = existingTrack?.story_data?.find((s: any) => 
        s.id === usage.source_media_id
      );
      if (slide) {
        slideName = slide.name || `Slide ${slideIndex + 1}`;
      }
    }
    
    // If we have media source info, return enriched fact
    if (slideName || usage.source_media_id) {
      return {
        fact: f.content || f.title,
        title: f.title,
        type: f.type,
        slideId: usage.source_media_id,
        slideName: slideName || 'Unknown Slide',
        slideIndex: slideIndex
      };
    }
  }
  // Fallback to simple text
  return f.content || f.fact || f.title;
});
```

**Key Changes:**
- ✅ Check for `f.usage` array from API
- ✅ Extract media source metadata
- ✅ Match slideId with slides in story_data
- ✅ Preserve slideId, slideName, slideIndex for grouping
- ✅ Graceful fallback for facts without media sources

### 3. UI Display
The existing UI code already handles grouped facts properly (lines 1253-1335 in StoryEditor.tsx):

```typescript
// Group facts by slide
const factsBySlide: Record<string, { slideName: string; facts: any[] }> = {};
const ungroupedFacts: any[] = [];

validObjectives.forEach((objective: any) => {
  if (typeof objective === 'object' && objective?.slideId) {
    const slideId = objective.slideId;
    if (!factsBySlide[slideId]) {
      factsBySlide[slideId] = {
        slideName: objective.slideName || `Slide ${objective.slideIndex + 1}`,
        facts: []
      };
    }
    factsBySlide[slideId].facts.push(objective);
  } else {
    ungroupedFacts.push(objective);
  }
});
```

**Display Features:**
- ✅ Groups facts by source slide
- ✅ Shows slide name as section header
- ✅ Displays video icon next to slide name
- ✅ Falls back to "Other Facts" for ungrouped facts

## Expected Behavior After Fix

### In Story View Mode:
1. Open a story track in VIEW mode (not edit)
2. Scroll down to "Key Facts" section
3. You should see facts grouped by slide:

```
Key Facts
─────────────────────────────

🎥 Introduction Video
  1. First fact from intro
  2. Second fact from intro

🎥 Product Demo
  1. Fact about the product
  2. Another product fact

Other Facts (if any ungrouped facts exist)
  1. Fact without slide association
```

### Database Requirements:
For this to work, facts must have been saved with media source tracking:

```sql
-- Check if your facts have media sources
SELECT 
  f.title,
  fu.source_media_id,
  fu.source_media_url,
  fu.display_order
FROM facts f
JOIN fact_usage fu ON f.id = fu.fact_id
WHERE fu.track_id = 'your-story-track-id';
```

If `source_media_id` is NULL, facts were created before media tracking was implemented. They will appear in "Other Facts" section.

## Backward Compatibility

✅ **Old facts without media sources:** Display in "Other Facts" section  
✅ **New facts with media sources:** Display grouped by slide  
✅ **Edit mode:** Unchanged, still works as before  
✅ **Other track types:** Not affected by this change  

## Testing Checklist

- [ ] Open existing story in VIEW mode
- [ ] Verify "Key Facts" section is visible
- [ ] Facts should be grouped by slide name
- [ ] Each group should have a video icon 🎥
- [ ] Facts without slides should appear in "Other Facts"
- [ ] Edit mode should still work normally
- [ ] Creating new facts should preserve slide grouping

## Known Limitations

1. **Only first usage is shown:** If a fact is used in multiple slides, only the first usage determines its grouping
2. **Slide name lookup:** Requires `story_data` to be available on `existingTrack`
3. **No slide preview:** Just shows slide name, not a thumbnail
4. **Static grouping:** Can't reorder or reorganize groups in view mode

## Future Enhancements

- [ ] Show all usages if fact appears in multiple slides
- [ ] Add slide thumbnails to group headers
- [ ] Click slide name to jump to that slide in preview
- [ ] Filter facts by slide
- [ ] Expand/collapse slide groups
- [ ] Export facts grouped by slide as PDF

## Files Modified

1. `/supabase/functions/server/FactService.ts` - Return usage metadata
2. `/components/content-authoring/StoryEditor.tsx` - Preserve metadata in view mode

## Related Documentation

- `/MEDIA_SOURCE_TRACKING.md` - Architecture overview
- `/TRANSCRIPT_ARCHITECTURE.md` - Transcript caching system
- `/IMPLEMENTATION_STATUS.md` - Full implementation status
