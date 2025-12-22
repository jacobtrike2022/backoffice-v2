// ============================================================================
// BRAIN INDEXER - Smart auto-indexing for Company Brain RAG system
// ============================================================================
// 
// INDEXING RULES:
// - Only index PUBLISHED tracks (video, article, story)
// - NEVER index checkpoints (quiz content should not leak into search)
// - NEVER index draft/archived content
// - Handle system templates with is_system_template flag
// - Re-index on updates, remove on unpublish/delete
// - Store metadata for future contextual filtering (roles, equipment, etc.)
//
// ============================================================================

import { supabase } from '../supabase';
import { getServerUrl, publicAnonKey } from '../../utils/supabase/info';

// Content types that can be indexed
type IndexableContentType = 'track' | 'kb_article' | 'transcript';

// Track types we index vs skip
const INDEXABLE_TRACK_TYPES = ['video', 'article', 'story'];
const SKIP_TRACK_TYPES = ['checkpoint']; // Never index checkpoints

interface IndexableTrack {
  id: string;
  title?: string;
  description?: string;
  content?: string; // For articles
  content_text?: string; // Alternative content field
  slides?: Array<{ content?: string; title?: string }>; // For stories
  track_type?: string;
  type?: string; // Some places use 'type' instead of 'track_type'
  status?: string;
  organization_id?: string;
  is_system_content?: boolean; // Trike template flag
}

interface IndexMetadata {
  trackType?: string;
  isSystemTemplate?: boolean;
  tags?: string[];
  kbCategoryId?: string;
  // Future contextual filtering:
  roles?: string[];
  equipment?: string[];
  locations?: string[];
}

// ============================================================================
// MAIN INDEXING FUNCTIONS
// ============================================================================

/**
 * Index a track into Company Brain
 * Handles all track types appropriately
 */
export async function indexTrackToBrain(
  track: IndexableTrack,
  transcript?: string,
  additionalMetadata?: Partial<IndexMetadata>
): Promise<void> {
  const trackType = track.track_type || track.type || 'article';
  
  // RULE: Never index checkpoints
  if (SKIP_TRACK_TYPES.includes(trackType)) {
    console.log(`[Brain] Skipping checkpoint: ${track.id}`);
    return;
  }

  // RULE: Only index published content
  if (track.status !== 'published') {
    console.log(`[Brain] Skipping non-published track: ${track.id} (status: ${track.status})`);
    return;
  }

  // Build text based on track type
  const text = buildTrackText(track, trackType, transcript);
  
  if (!text || text.trim().length < 20) {
    console.log(`[Brain] Skipping track with insufficient content: ${track.id}`);
    return;
  }

  const metadata: IndexMetadata = {
    trackType,
    isSystemTemplate: track.is_system_content || false,
    ...additionalMetadata,
  };

  await indexToBrain({
    contentType: 'track',
    contentId: track.id,
    text,
    metadata,
    isSystemTemplate: metadata.isSystemTemplate,
  });
}

/**
 * Remove a track from Company Brain index
 * Call on delete, unpublish, or status change to draft/archived
 */
export async function removeTrackFromBrain(trackId: string): Promise<void> {
  await removeFromBrain({
    contentType: 'track',
    contentId: trackId,
  });
}

/**
 * Handle track status change
 * - Published: index or re-index
 * - Draft/Archived: remove from index
 */
export async function handleTrackStatusChange(
  track: IndexableTrack,
  previousStatus?: string,
  transcript?: string
): Promise<void> {
  const trackType = track.track_type || track.type || 'article';
  
  // Skip checkpoints always
  if (SKIP_TRACK_TYPES.includes(trackType)) {
    return;
  }

  if (track.status === 'published') {
    // Index or re-index
    await indexTrackToBrain(track, transcript);
  } else if (previousStatus === 'published') {
    // Was published, now isn't - remove from index
    await removeTrackFromBrain(track.id);
  }
}

// ============================================================================
// TEXT BUILDERS - Type-specific content extraction
// ============================================================================

/**
 * Build indexable text based on track type
 */
function buildTrackText(
  track: IndexableTrack,
  trackType: string,
  transcript?: string
): string {
  const parts: string[] = [];

  // Always include title and description
  if (track.title) {
    parts.push(`Title: ${track.title}`);
  }
  if (track.description) {
    parts.push(`Description: ${track.description}`);
  }

  // Type-specific content
  switch (trackType) {
    case 'video':
      // Videos rely on transcript for searchable content
      if (transcript) {
        parts.push(`Content: ${transcript}`);
      }
      break;

    case 'article':
      // Articles have direct content (may be HTML - strip tags)
      const articleContent = track.content || track.content_text;
      if (articleContent) {
        const cleanContent = stripHtmlTags(articleContent);
        parts.push(`Content: ${cleanContent}`);
      }
      break;

    case 'story':
      // Stories have slides stored in transcript field as JSON, or in slides array
      let storySlides: Array<{ content?: string; title?: string; name?: string; transcript?: { text?: string } }> = [];
      
      // Try to get slides from transcript field (JSON format)
      if (track.content_text) {
        try {
          const storyData = JSON.parse(track.content_text);
          if (storyData.slides && Array.isArray(storyData.slides)) {
            storySlides = storyData.slides;
          }
        } catch {
          // Not JSON, ignore
        }
      }
      
      // Fallback to slides array if available
      if (storySlides.length === 0 && track.slides && Array.isArray(track.slides)) {
        storySlides = track.slides;
      }
      
      if (storySlides.length > 0) {
        const slideContent = storySlides
          .map((slide, index) => {
            const slideTitle = slide.title || slide.name || '';
            // Stories may have transcript.text in slide.transcript
            const slideText = slide.transcript?.text || slide.content || '';
            const cleanText = slideText ? stripHtmlTags(slideText) : '';
            return cleanText ? `Slide ${index + 1}: ${slideTitle ? slideTitle + ': ' : ''}${cleanText}` : '';
          })
          .filter(Boolean)
          .join('\n\n');
        
        if (slideContent) {
          parts.push(slideContent);
        }
      }
      break;

    default:
      // Fallback: use content if available
      const fallbackContent = track.content || track.content_text;
      if (fallbackContent) {
        parts.push(`Content: ${stripHtmlTags(fallbackContent)}`);
      }
  }

  return parts.join('\n\n');
}

/**
 * Strip HTML tags from content
 */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
    .replace(/&nbsp;/g, ' ')    // Replace HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')       // Normalize whitespace
    .trim();
}

// ============================================================================
// CORE API FUNCTIONS
// ============================================================================

/**
 * Index content to Company Brain (calls Edge Function)
 * Fire-and-forget: errors are logged but don't throw
 */
async function indexToBrain(params: {
  contentType: IndexableContentType;
  contentId: string;
  text: string;
  metadata?: IndexMetadata;
  isSystemTemplate?: boolean;
}): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || publicAnonKey;

    const response = await fetch(`${getServerUrl()}/brain/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': publicAnonKey,
      },
      body: JSON.stringify({
        contentType: params.contentType,
        contentId: params.contentId,
        text: params.text,
        metadata: {
          ...params.metadata,
          isSystemTemplate: params.isSystemTemplate || false,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log(`[Brain] ✓ Indexed ${params.contentType}:${params.contentId} (${result.chunksIndexed} chunks)`);
  } catch (error) {
    // Log but don't throw - indexing failure shouldn't break content operations
    console.error(`[Brain] ✗ Failed to index ${params.contentType}:${params.contentId}:`, error);
  }
}

/**
 * Remove content from Company Brain index
 * Fire-and-forget: errors are logged but don't throw
 */
async function removeFromBrain(params: {
  contentType: IndexableContentType;
  contentId: string;
}): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || publicAnonKey;

    const response = await fetch(`${getServerUrl()}/brain/remove`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': publicAnonKey,
      },
      body: JSON.stringify({
        contentType: params.contentType,
        contentId: params.contentId,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    console.log(`[Brain] ✓ Removed ${params.contentType}:${params.contentId} from index`);
  } catch (error) {
    console.error(`[Brain] ✗ Failed to remove ${params.contentType}:${params.contentId}:`, error);
  }
}

// ============================================================================
// UTILITY: Fetch transcript for video tracks
// ============================================================================

/**
 * Get transcript for a video track if available
 */
export async function getTrackTranscript(trackId: string): Promise<string | undefined> {
  try {
    // First check if track has transcript field directly
    const { data: track } = await supabase
      .from('tracks')
      .select('transcript')
      .eq('id', trackId)
      .single();

    if (track?.transcript) {
      return track.transcript;
    }

    // Check media_transcripts table for cached transcript
    const { data } = await supabase
      .from('media_transcripts')
      .select('transcript_text')
      .contains('used_in_tracks', [trackId])
      .maybeSingle();

    return data?.transcript_text || undefined;
  } catch {
    return undefined;
  }
}

// ============================================================================
// BATCH INDEXING - For initial migration or bulk operations
// ============================================================================

/**
 * Index all published tracks for an organization
 * Use for initial setup or re-indexing
 */
export async function indexAllPublishedTracks(organizationId: string): Promise<{
  indexed: number;
  skipped: number;
  errors: number;
}> {
  const stats = { indexed: 0, skipped: 0, errors: 0 };

  try {
    // Fetch all published, non-checkpoint tracks
    // Note: For stories, slides are in content_text as JSON
    const { data: tracks, error } = await supabase
      .from('tracks')
      .select('id, title, description, content, content_text, transcript, track_type, type, status, organization_id, is_system_content')
      .eq('organization_id', organizationId)
      .eq('status', 'published')
      .not('type', 'eq', 'checkpoint');

    if (error) throw error;
    if (!tracks || tracks.length === 0) {
      console.log('[Brain] No published tracks to index');
      return stats;
    }

    console.log(`[Brain] Indexing ${tracks.length} published tracks...`);

    for (const track of tracks) {
      try {
        const trackType = track.track_type || track.type || 'article';
        
        // Skip checkpoints (double-check)
        if (SKIP_TRACK_TYPES.includes(trackType)) {
          stats.skipped++;
          continue;
        }
        
        // Get transcript for videos
        let transcript: string | undefined;
        if (trackType === 'video') {
          transcript = await getTrackTranscript(track.id);
        }

        await indexTrackToBrain(track, transcript);
        stats.indexed++;
      } catch (err) {
        console.error(`[Brain] Error indexing track ${track.id}:`, err);
        stats.errors++;
      }
    }

    console.log(`[Brain] Batch indexing complete: ${stats.indexed} indexed, ${stats.skipped} skipped, ${stats.errors} errors`);
  } catch (error) {
    console.error('[Brain] Batch indexing failed:', error);
  }

  return stats;
}

