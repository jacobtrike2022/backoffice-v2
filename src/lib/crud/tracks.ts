// ============================================================================
// TRACKS CRUD OPERATIONS
// ============================================================================

import { projectId, publicAnonKey, getServerUrl } from '../../utils/supabase/info';
import { getHealthStatus } from '../serverHealth';
import { supabase, getCurrentUserOrgId, getCurrentUserProfile } from '../supabase';
import { compressImage } from '../utils/imageCompression';
import { indexTrackToBrain, removeTrackFromBrain, handleTrackStatusChange, getTrackTranscript } from '../utils/brainIndexer';
import { generateKeyFacts } from './facts';
import { calculateTrackDuration } from '../utils/trackDuration';
import { assignTrackTagsByName } from './tags';

export interface CreateTrackInput {
  title: string;
  description?: string;
  type: 'video' | 'story' | 'article' | 'checkpoint';
  content_url?: string;
  thumbnail_url?: string;
  duration_minutes?: number;
  transcript?: string;
  transcript_data?: any; // Structured transcript with word-level timestamps from transcription API
  summary?: string;
  status?: 'draft' | 'published' | 'archived';
  learning_objectives?: string[];
  tags?: string[];
  is_system_content?: boolean; // System tracks from Trike Library (non-editable)
  content_text?: string;
  // Versioning fields
  parent_track_id?: string; // Points to original track (V1) for versions
  version_number?: number; // 1, 2, 3...
  version_notes?: string; // Admin changelog notes
  is_latest_version?: boolean; // True for current version
}

export interface UpdateTrackInput extends Partial<CreateTrackInput> {
  id: string;
}

// Default thumbnail URL (served from public folder) - used only for display when no custom thumbnail
export const DEFAULT_THUMBNAIL_URL = '/default-thumbnail.png';

/**
 * Returns the URL to display for a track thumbnail.
 * Use this everywhere we render a track thumbnail so behavior is consistent:
 * - No thumbnail (null, empty, or the stored default placeholder) → show default Trike image.
 * - Custom thumbnail from media/upload → show that URL.
 */
export function getEffectiveThumbnailUrl(thumbnailUrl: string | null | undefined): string {
  const trimmed = (thumbnailUrl || '').trim();
  if (!trimmed || trimmed === DEFAULT_THUMBNAIL_URL) return DEFAULT_THUMBNAIL_URL;
  return trimmed;
}

// ============================================================================
// PUBLISH VALIDATION
// ============================================================================

/**
 * Validation result for publish readiness
 */
export interface PublishValidationResult {
  canPublish: boolean;
  reason?: string;
  missingContent?: 'transcript' | 'content_text' | 'slides';
}

/**
 * Validate if a track is ready to be published.
 *
 * Rules:
 * - Articles: Must have content_text (body content)
 * - Videos: Must have transcript (transcription must be complete)
 * - Stories: Must have transcript with slides data
 * - Checkpoints: Always allowed (quiz questions don't need transcript)
 *
 * This prevents the race condition where content is indexed before
 * transcription/content is complete, causing Company Brain to miss content.
 */
export async function validateTrackReadyForPublish(
  trackId: string
): Promise<PublishValidationResult> {
  const { data: track, error } = await supabase
    .from('tracks')
    .select('id, type, transcript, content_text, status')
    .eq('id', trackId)
    .single();

  if (error || !track) {
    return { canPublish: false, reason: 'Track not found' };
  }

  return validateTrackContentForPublish(track);
}

/**
 * Validate track content for publishing (synchronous version for when track data is already loaded)
 */
export function validateTrackContentForPublish(track: {
  type?: string;
  transcript?: string | null;
  content_text?: string | null;
}): PublishValidationResult {
  const trackType = track.type || 'article';

  switch (trackType) {
    case 'article':
      // Articles store body in content_text (primary) or transcript (fallback)
      const articleContent = track.content_text || track.transcript;
      if (!articleContent || articleContent.trim().length < 20) {
        return {
          canPublish: false,
          reason: 'Content still processing',
          missingContent: 'content_text'
        };
      }
      break;

    case 'video':
      // Videos need transcript (transcription must be complete)
      if (!track.transcript || track.transcript.trim().length < 20) {
        return {
          canPublish: false,
          reason: 'Content still processing',
          missingContent: 'transcript'
        };
      }
      break;

    case 'story':
      // Stories need slide data in transcript field
      if (!track.transcript) {
        return {
          canPublish: false,
          reason: 'Content still processing',
          missingContent: 'slides'
        };
      }
      // Validate it's actually JSON slide data
      try {
        const storyData = typeof track.transcript === 'string'
          ? JSON.parse(track.transcript)
          : track.transcript;
        if (!storyData.slides || !Array.isArray(storyData.slides) || storyData.slides.length === 0) {
          return {
            canPublish: false,
            reason: 'Content still processing',
            missingContent: 'slides'
          };
        }
      } catch {
        return {
          canPublish: false,
          reason: 'Content still processing',
          missingContent: 'slides'
        };
      }
      break;

    case 'checkpoint':
      // Checkpoints are always allowed - quiz questions don't need transcript
      // (and they're not indexed to Brain anyway)
      break;

    default:
      // Unknown type - allow by default
      break;
  }

  return { canPublish: true };
}

/**
 * Enrich tracks with tags from the track_tags junction table
 * This is the source of truth for tags (replaces deprecated tracks.tags column)
 */
async function enrichTracksWithJunctionTags(tracks: any[]): Promise<any[]> {
  if (!tracks || tracks.length === 0) return tracks;

  const trackIds = tracks.map(t => t.id);

  // Fetch all track-tag relationships for these tracks in one query
  const { data: trackTagRelations, error: relError } = await supabase
    .from('track_tags')
    .select('track_id, tag_id')
    .in('track_id', trackIds);

  if (relError) {
    console.error('[enrichTracksWithJunctionTags] Error fetching track_tags:', relError);
    return tracks; // Return tracks as-is if junction table query fails
  }

  if (!trackTagRelations || trackTagRelations.length === 0) {
    // No tags in junction table, return tracks with empty tags arrays
    return tracks.map(t => ({ ...t, tags: [] }));
  }

  // Get unique tag IDs
  const tagIds = [...new Set(trackTagRelations.map(r => r.tag_id))];

  // Fetch tag details
  const { data: tags, error: tagError } = await supabase
    .from('tags')
    .select('id, name')
    .in('id', tagIds);

  if (tagError) {
    console.error('[enrichTracksWithJunctionTags] Error fetching tags:', tagError);
    return tracks;
  }

  // Create a map of tag_id -> tag_name
  const tagIdToName: Record<string, string> = {};
  tags?.forEach(tag => {
    tagIdToName[tag.id] = tag.name;
  });

  // Create a map of track_id -> tag_names[]
  const trackIdToTagNames: Record<string, string[]> = {};
  trackTagRelations.forEach(rel => {
    if (!trackIdToTagNames[rel.track_id]) {
      trackIdToTagNames[rel.track_id] = [];
    }
    const tagName = tagIdToName[rel.tag_id];
    if (tagName) {
      trackIdToTagNames[rel.track_id].push(tagName);
    }
  });

  // Enrich tracks with their tags and parse/normalize transcript_data
  return tracks.map(track => {
    let parsedTranscriptData = track.transcript_data;

    // Parse if stored as JSON string
    if (typeof track.transcript_data === 'string') {
      try {
        parsedTranscriptData = JSON.parse(track.transcript_data);
      } catch (e) {
        console.warn('[enrichTracksWithJunctionTags] Failed to parse transcript_data for track', track.id, e);
      }
    }

    // Normalize: if transcript_data has nested transcript_json, extract it
    // This happens when transcript comes from media_transcripts table with full metadata
    if (parsedTranscriptData) {
      // Check if this is the media_transcripts structure (has transcript_json key)
      const hasMediaTranscriptStructure = 'transcript_json' in parsedTranscriptData ||
                                          'transcript_text' in parsedTranscriptData ||
                                          'transcription_service' in parsedTranscriptData;

      if (hasMediaTranscriptStructure) {
        // Handle transcript_json - might be object or string (if serialized from JSONB)
        let transcriptJson = parsedTranscriptData.transcript_json;

        // Parse if transcript_json is a string
        if (typeof transcriptJson === 'string' && transcriptJson.length > 0) {
          try {
            transcriptJson = JSON.parse(transcriptJson);
          } catch (e) {
            console.warn(`[enrichTracksWithJunctionTags] Failed to parse transcript_json string for track ${track.id}`, e);
            transcriptJson = null;
          }
        }

        // Prefer transcript_json if it has data
        if (transcriptJson &&
            typeof transcriptJson === 'object' &&
            Object.keys(transcriptJson).length > 0) {
          parsedTranscriptData = transcriptJson;
        }
        // Fallback: construct from transcript_text/utterances
        else if (parsedTranscriptData.transcript_text || parsedTranscriptData.transcript_utterances) {
          // Also try to parse transcript_utterances if it's a string
          let utterances = parsedTranscriptData.transcript_utterances;
          if (typeof utterances === 'string') {
            try {
              utterances = JSON.parse(utterances);
            } catch (e) {
              utterances = [];
            }
          }

          parsedTranscriptData = {
            text: parsedTranscriptData.transcript_text || '',
            utterances: utterances || [],
            words: [] // May not have word-level data
          };
        }
        else {
          console.warn(`[enrichTracksWithJunctionTags] Track ${track.id} has media_transcripts structure but no usable transcript data`);
        }
      }
    }

    return {
      ...track,
      tags: trackIdToTagNames[track.id] || [],
      transcript_data: parsedTranscriptData,
    };
  });
}

/**
 * Enrich tracks with scope from track_scopes (one row per track)
 */
async function enrichTracksWithScope(tracks: any[]): Promise<any[]> {
  if (!tracks || tracks.length === 0) return tracks;
  const trackIds = tracks.map(t => t.id);
  const { data: scopeRows, error } = await supabase
    .from('track_scopes')
    .select('*')
    .in('track_id', trackIds);
  if (error || !scopeRows?.length) {
    return tracks.map(t => ({ ...t, scope: null }));
  }
  const scopeByTrackId: Record<string, any> = {};
  scopeRows.forEach((row: any) => {
    scopeByTrackId[row.track_id] = row;
  });
  return tracks.map(t => ({
    ...t,
    scope: scopeByTrackId[t.id] ?? null,
  }));
}

/**
 * Automate story workflow: transcribe all videos → update story JSON → generate key facts
 * Fire-and-forget: errors are logged but don't throw
 */
async function automateStoryWorkflow(track: { id: string; title?: string; description?: string; transcript?: string; organization_id?: string }): Promise<void> {
  if (!track.transcript) {
    console.log('[Story Workflow] No transcript field (story data), skipping automation');
    return;
  }

  try {
    // Parse story data from transcript field
    let storyData: any;
    try {
      storyData = typeof track.transcript === 'string' ? JSON.parse(track.transcript) : track.transcript;
    } catch (e) {
      console.log('[Story Workflow] Could not parse story data, skipping automation');
      return;
    }

    if (!storyData.slides || !Array.isArray(storyData.slides)) {
      console.log('[Story Workflow] No slides found in story data');
      return;
    }

    // Find all video slides
    const videoSlides = storyData.slides.filter((slide: any) => slide.type === 'video' && slide.url);
    
    if (videoSlides.length === 0) {
      console.log('[Story Workflow] No video slides found, skipping automation');
      return;
    }

    // Skip if track already has facts (prevents duplicate generation)
    const { count: storyFactCount } = await supabase
      .from('fact_usage')
      .select('*', { count: 'exact', head: true })
      .eq('track_id', track.id);
    if (storyFactCount && storyFactCount > 0) {
      console.log(`[Story Workflow] Track ${track.id} already has ${storyFactCount} facts, skipping`);
      return;
    }

    console.log(`[Story Workflow] Starting automation for track ${track.id} with ${videoSlides.length} video slides...`);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || publicAnonKey;
    const allTranscripts: string[] = [];
    let updatedSlides = [...storyData.slides];

    // Step 1: Transcribe each video slide
    for (let i = 0; i < videoSlides.length; i++) {
      const slide = videoSlides[i];
      console.log(`[Story Workflow] Transcribing video ${i + 1}/${videoSlides.length}: ${slide.name || 'Untitled'}`);

      try {
        const transcribeResponse = await fetch(`${getServerUrl()}/transcribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'apikey': publicAnonKey,
          },
          body: JSON.stringify({
            audioUrl: slide.url,
            mediaType: 'video',
            trackId: track.id,
            forceRefresh: false,
          }),
        });

        if (!transcribeResponse.ok) {
          const error = await transcribeResponse.json().catch(() => ({}));
          console.error(`[Story Workflow] Failed to transcribe slide ${i + 1}:`, error);
          continue;
        }

        const transcribeData = await transcribeResponse.json();
        const transcriptText = transcribeData.transcript?.transcript_text || transcribeData.transcript?.text || '';
        
        if (transcriptText) {
          allTranscripts.push(transcriptText);
          
          // Update the slide with transcript
          const slideIndex = updatedSlides.findIndex((s: any) => s.id === slide.id);
          if (slideIndex !== -1) {
            updatedSlides[slideIndex] = {
              ...updatedSlides[slideIndex],
              transcript: {
                text: transcriptText,
                words: transcribeData.transcript?.transcript_json?.words,
                utterances: transcribeData.transcript?.transcript_json?.utterances,
                confidence: transcribeData.transcript?.confidence_score,
                audio_duration: transcribeData.transcript?.duration_seconds,
              }
            };
          }
          
          console.log(`[Story Workflow] ✓ Slide ${i + 1} transcribed (${transcriptText.length} chars)`);
        }
      } catch (error) {
        console.error(`[Story Workflow] Error transcribing slide ${i + 1}:`, error);
        continue;
      }
    }

    if (allTranscripts.length === 0) {
      console.warn('[Story Workflow] No transcripts generated');
      return;
    }

    console.log(`[Story Workflow] ✓ ${allTranscripts.length} videos transcribed`);

    // Step 2: Update story with transcripts embedded in slides
    console.log('[Story Workflow] Step 2: Updating story with transcripts...');
    const updatedStoryData = {
      ...storyData,
      slides: updatedSlides,
    };

    const { error: updateError } = await supabase
      .from('tracks')
      .update({ transcript: JSON.stringify(updatedStoryData) })
      .eq('id', track.id);

    if (updateError) {
      console.error('[Story Workflow] Failed to update story with transcripts:', updateError);
      // Continue anyway - transcripts are cached in media_transcripts
    } else {
      console.log('[Story Workflow] ✓ Story updated with transcripts');

      // Step 2b: Re-index to Brain if track is published
      // This ensures the new slide transcripts are searchable in Company Brain
      const { data: currentTrack } = await supabase
        .from('tracks')
        .select('status, organization_id')
        .eq('id', track.id)
        .single();

      if (currentTrack?.status === 'published') {
        console.log('[Story Workflow] Track is published, re-indexing to Brain...');
        indexTrackToBrain({
          id: track.id,
          title: track.title,
          description: track.description,
          type: 'story',
          status: 'published',
          transcript: JSON.stringify(updatedStoryData),
          organization_id: currentTrack.organization_id,
        }).catch(err => {
          console.error('[Story Workflow] Brain re-index failed:', err);
        });
      }
    }

    // Step 3: Generate key facts from combined transcripts
    console.log('[Story Workflow] Step 3: Generating key facts from all transcripts...');
    const orgId = track.organization_id || await getCurrentUserOrgId();
    const combinedTranscript = allTranscripts.join('\n\n');
    
    await generateKeyFacts({
      title: track.title || 'Untitled Story',
      description: track.description || '',
      transcript: combinedTranscript,
      trackType: 'story',
      trackId: track.id,
      companyId: orgId || undefined,
    });

    console.log(`[Story Workflow] ✓ Key facts generated for track ${track.id}`);
    console.log('[Story Workflow] Automation complete!');

  } catch (error) {
    console.error(`[Story Workflow] ✗ Automation failed for track ${track.id}:`, error);
  }
}

/**
 * Automate video workflow: transcribe → save transcript → generate key facts
 * Fire-and-forget: errors are logged but don't throw
 */
async function automateVideoWorkflow(track: { id: string; title?: string; description?: string; content_url?: string; organization_id?: string }): Promise<void> {
  if (!track.content_url) {
    console.log('[Video Workflow] No content_url, skipping automation');
    return;
  }

  try {
    console.log(`[Video Workflow] Starting automation for track ${track.id}...`);

    // Step 1: Transcribe the video
    console.log('[Video Workflow] Step 1: Transcribing video...');
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || publicAnonKey;

    const transcribeResponse = await fetch(`${getServerUrl()}/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'apikey': publicAnonKey,
      },
      body: JSON.stringify({
        audioUrl: track.content_url,
        mediaType: 'video',
        trackId: track.id,
        forceRefresh: false,
      }),
    });

    if (!transcribeResponse.ok) {
      const error = await transcribeResponse.json().catch(() => ({}));
      throw new Error(error.error || `Transcription failed: ${transcribeResponse.status}`);
    }

    const transcribeData = await transcribeResponse.json();
    const transcriptText = transcribeData.transcript?.transcript_text || transcribeData.transcript?.text || '';

    if (!transcriptText) {
      console.warn('[Video Workflow] No transcript text received');
      return;
    }

    console.log(`[Video Workflow] ✓ Transcript generated (${transcriptText.length} chars)`);

    // Normalize transcript_data - extract transcript_json if nested (from media_transcripts)
    // The API returns media_transcripts row structure, we want just the transcript_json for interactive display
    let transcriptData = transcribeData.transcript;
    if (transcriptData && transcriptData.transcript_json) {
      console.log('[Video Workflow] Extracting transcript_json from media_transcripts structure');
      transcriptData = transcriptData.transcript_json;
    }

    // Step 2: Update track with transcript and transcript_data
    // transcript_data should contain the actual transcript with text/words/utterances for InteractiveTranscript
    console.log('[Video Workflow] Step 2: Saving transcript to track...');
    console.log('[Video Workflow] transcript_data keys:', transcriptData ? Object.keys(transcriptData) : 'null');
    const { error: updateError } = await supabase
      .from('tracks')
      .update({
        transcript: transcriptText,
        transcript_data: transcriptData  // Save the normalized transcript_json, not the full media_transcripts row
      })
      .eq('id', track.id);

    if (updateError) {
      console.error('[Video Workflow] Failed to save transcript:', updateError);
      // Continue anyway - transcript is cached in media_transcripts
    } else {
      console.log('[Video Workflow] ✓ Transcript and transcript_data saved to track');

      // Step 2b: Re-index to Brain if track is published
      // This ensures the new transcript is searchable in Company Brain
      const { data: currentTrack } = await supabase
        .from('tracks')
        .select('status, organization_id')
        .eq('id', track.id)
        .single();

      if (currentTrack?.status === 'published') {
        console.log('[Video Workflow] Track is published, re-indexing to Brain...');
        indexTrackToBrain({
          id: track.id,
          title: track.title,
          description: track.description,
          type: 'video',
          status: 'published',
          organization_id: currentTrack.organization_id,
        }, transcriptText).catch(err => {
          console.error('[Video Workflow] Brain re-index failed:', err);
        });
      }
    }

    // Step 3: Key facts - SKIP here. The /transcribe endpoint handles key fact generation when trackId
    // is provided (it checks fact_usage and only generates if none exist). Calling generateKeyFacts here
    // caused duplicate facts because both this workflow AND the transcribe callback were generating.
    console.log('[Video Workflow] Key facts handled by transcribe endpoint (no duplicate generation)');
    console.log('[Video Workflow] Automation complete!');

  } catch (error) {
    // Log but don't throw - automation failure shouldn't break track creation
    console.error(`[Video Workflow] ✗ Automation failed for track ${track.id}:`, error);
  }
}

/**
 * Automate article workflow: generate key facts from article content
 * Fire-and-forget: errors are logged but don't throw
 */
async function automateArticleWorkflow(track: { id: string; title?: string; description?: string; transcript?: string; organization_id?: string }): Promise<void> {
  // For articles, transcript field stores the article body (HTML content)
  if (!track.transcript || track.transcript.trim().length < 150) {
    console.log('[Article Workflow] Content too short or missing, skipping key facts generation');
    return;
  }

  try {
    // Skip if track already has facts (backend also checks; this avoids unnecessary API call)
    const { count } = await supabase
      .from('fact_usage')
      .select('*', { count: 'exact', head: true })
      .eq('track_id', track.id);
    if (count && count > 0) {
      console.log(`[Article Workflow] Track ${track.id} already has ${count} facts, skipping`);
      return;
    }

    console.log(`[Article Workflow] Starting automation for track ${track.id}...`);

    // Strip HTML to get plain text for word count check
    const plainText = track.transcript
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (plainText.length < 150) {
      console.log('[Article Workflow] Plain text content too short after HTML stripping, skipping');
      return;
    }

    console.log(`[Article Workflow] Generating key facts from ${plainText.length} chars of content...`);
    const orgId = track.organization_id || await getCurrentUserOrgId();

    await generateKeyFacts({
      title: track.title || 'Untitled Article',
      description: track.description || '',
      content: plainText,
      trackType: 'article',
      trackId: track.id,
      companyId: orgId || undefined,
    });

    console.log(`[Article Workflow] ✓ Key facts generated for track ${track.id}`);
    console.log('[Article Workflow] Automation complete!');

  } catch (error) {
    // Log but don't throw - automation failure shouldn't break track creation
    console.error(`[Article Workflow] ✗ Automation failed for track ${track.id}:`, error);
  }
}

/**
 * Create a new track (defaults to draft).
 * Thumbnail: store only when provided (null otherwise). Display layer uses getEffectiveThumbnailUrl() to show default when null.
 */
export async function createTrack(input: CreateTrackInput) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  // Store thumbnail only when a real URL is provided (null = no thumbnail → display shows default)
  const thumbnailUrl = (input.thumbnail_url || '').trim() || null;

  // Auto-calculate duration if not provided
  let calculatedDuration = input.duration_minutes;
  if (calculatedDuration === undefined || calculatedDuration === null) {
    // Parse content based on type
    let storyData: any = undefined;
    let checkpointData: any = undefined;
    
    if (input.type === 'story' && input.transcript) {
      try {
        storyData = typeof input.transcript === 'string' ? JSON.parse(input.transcript) : input.transcript;
      } catch (e) {
        // Not valid JSON, skip
      }
    }
    
    if (input.type === 'checkpoint' && input.transcript) {
      try {
        checkpointData = typeof input.transcript === 'string' ? JSON.parse(input.transcript) : input.transcript;
      } catch (e) {
        // Not valid JSON, skip
      }
    }
    
    const autoCalculated = calculateTrackDuration(input.type, {
      transcript: input.transcript,
      storyData,
      checkpointData,
      duration_minutes: input.duration_minutes
    });
    
    // Only use auto-calculated duration if it's not undefined
    if (autoCalculated !== undefined) {
      calculatedDuration = autoCalculated;
    }
  }

  // NOTE: tags are NOT included in the insert - they go to track_tags junction table only
  const { data: track, error } = await supabase
    .from('tracks')
    .insert({
      organization_id: orgId,
      title: input.title,
      description: input.description,
      type: input.type,
      content_url: input.content_url,
      thumbnail_url: thumbnailUrl,
      duration_minutes: calculatedDuration,
      transcript: input.transcript,
      summary: input.summary,
      status: input.status || 'draft',
      learning_objectives: input.learning_objectives || [],
      // tags column is deprecated - use track_tags junction table
      is_system_content: input.is_system_content || false,
      content_text: input.content_text,
      parent_track_id: input.parent_track_id,
      version_number: input.version_number,
      version_notes: input.version_notes,
      is_latest_version: input.is_latest_version
    })
    .select()
    .single();

  if (error) throw error;

  // Sync tags to junction table (source of truth)
  if (input.tags && input.tags.length > 0) {
    try {
      await assignTrackTagsByName(track.id, input.tags);
      console.log(`🏷️ Synced ${input.tags.length} tags to track_tags junction table for new track ${track.id}`);
    } catch (tagSyncError) {
      console.error('Failed to sync tags to junction table (non-blocking):', tagSyncError);
      // Non-blocking - don't fail the whole create if tag sync fails
    }
  }

  // Automate video workflow: transcribe → save transcript → generate key facts
  if (track.type === 'video' && track.content_url) {
    automateVideoWorkflow(track).catch(() => {});
  }

  // Automate story workflow: transcribe all videos → update story JSON → generate key facts
  if (track.type === 'story' && track.transcript) {
    automateStoryWorkflow(track).catch(() => {});
  }

  // Automate article workflow: generate key facts from article content
  if (track.type === 'article' && track.transcript) {
    automateArticleWorkflow(track).catch(() => {});
  }

  // Index to Brain if published (fire-and-forget)
  if (track.status === 'published') {
    const trackType = track.type || 'article';
    if (trackType === 'video') {
      // Get transcript for videos
      getTrackTranscript(track.id).then(transcript => {
        indexTrackToBrain(track, transcript).catch(() => {});
      }).catch(() => {
        // If transcript fetch fails, index without it
        indexTrackToBrain(track).catch(() => {});
      });
    } else {
      indexTrackToBrain(track).catch(() => {});
    }
  }

  return track;
}

/**
 * Update track (autosave)
 * Automatically triggers key facts regeneration when content changes
 */
export async function updateTrack(input: UpdateTrackInput) {
  const { id, ...updateData } = input;

  // First, check if track exists and user has permission
  // Also get status for brain indexing and check if it's a video
  // NOTE: Include content_text for brain indexing (articles store body in this field)
  const { data: existingTrack, error: checkError } = await supabase
    .from('tracks')
    .select('id, created_by, organization_id, status, type, content_url, transcript, title, description, content_text')
    .eq('id', id)
    .single();

  if (checkError) {
    if (checkError.code === 'PGRST116') {
      // No rows returned - track not found
      throw new Error('Track not found. It may have been deleted or you may not have permission to access it.');
    }
    throw checkError;
  }

  if (!existingTrack) {
    throw new Error('Track not found');
  }

  // PUBLISH VALIDATION: If trying to publish, validate content is ready
  // This prevents the race condition where content is indexed before transcript/content is complete
  const isPublishing = updateData.status === 'published' && existingTrack.status !== 'published';
  if (isPublishing) {
    // Merge existing track data with updates for validation
    const trackToValidate = {
      type: updateData.type || existingTrack.type,
      transcript: updateData.transcript !== undefined ? updateData.transcript : existingTrack.transcript,
      content_text: updateData.content_text !== undefined ? updateData.content_text : existingTrack.content_text,
    };
    const validation = validateTrackContentForPublish(trackToValidate);
    if (!validation.canPublish) {
      throw new Error(validation.reason || 'Track is not ready to publish');
    }
  }

  // Auto-calculate duration if content changed and duration not explicitly provided
  const trackType = existingTrack.type || updateData.type || 'article';
  const contentChanged = updateData.transcript !== undefined || updateData.content_url !== undefined;
  const durationNotProvided = updateData.duration_minutes === undefined;
  
  if (contentChanged && durationNotProvided) {
    // Parse content based on type
    let storyData: any = undefined;
    let checkpointData: any = undefined;
    const newTranscript = updateData.transcript !== undefined ? updateData.transcript : existingTrack.transcript;
    
    if (trackType === 'story' && newTranscript) {
      try {
        storyData = typeof newTranscript === 'string' ? JSON.parse(newTranscript) : newTranscript;
      } catch (e) {
        // Not valid JSON, skip
      }
    }
    
    if (trackType === 'checkpoint' && newTranscript) {
      try {
        checkpointData = typeof newTranscript === 'string' ? JSON.parse(newTranscript) : newTranscript;
      } catch (e) {
        // Not valid JSON, skip
      }
    }
    
    const calculatedDuration = calculateTrackDuration(trackType, {
      transcript: newTranscript,
      storyData,
      checkpointData,
      duration_minutes: updateData.duration_minutes
    });
    
    if (calculatedDuration !== undefined) {
      updateData.duration_minutes = calculatedDuration;
    }
  }

  // Extract tags from updateData - we'll handle them separately via junction table
  const tagsToSync = updateData.tags;
  const { tags: _removedTags, ...updateDataWithoutTags } = updateData as any;

  // Check if we have any non-tag fields to update
  const hasNonTagUpdates = Object.keys(updateDataWithoutTags).length > 0;

  let track = existingTrack;

  // Only update the track if there are non-tag fields to update
  if (hasNonTagUpdates) {
    const { data: updatedTrack, error } = await supabase
      .from('tracks')
      .update(updateDataWithoutTags)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      // Check if it's a permission error (RLS blocked the update)
      if (error.code === 'PGRST116' || error.message?.includes('not found')) {
        throw new Error('Permission denied. You can only update tracks you created. Please contact an administrator if you need to update this track.');
      }
      throw error;
    }
    track = updatedTrack;
  }

  // Sync tags to junction table (source of truth) if tags were provided
  if (tagsToSync !== undefined && Array.isArray(tagsToSync)) {
    try {
      await assignTrackTagsByName(id, tagsToSync);
      console.log(`🏷️ Synced ${tagsToSync.length} tags to track_tags junction table for track ${id}`);
    } catch (tagSyncError) {
      console.error('Failed to sync tags to junction table (non-blocking):', tagSyncError);
      // Non-blocking - don't fail the whole update if tag sync fails
    }
  }

  // Auto-regenerate facts if content changed
  if (updateData.transcript && track.type === 'article') {
    // Dynamic import to avoid circular dependencies
    import('../../utils/hash').then(async ({ sha256, stripMarkdown }) => {
      const plainText = stripMarkdown(updateData.transcript || '');
      const newContentHash = await sha256(plainText);
      
      // Check word count (minimum 150 words)
      const wordCount = plainText.split(/\s+/).filter(w => w.length > 0).length;
      if (wordCount < 150) {
        return;
      }
      
      // Check if content actually changed (compare to stored hash if it exists)
      const storedHash = track.facts_content_hash || null;
      if (storedHash && storedHash === newContentHash) {
        return;
      }
      
      // Call the facts extraction endpoint
      const { publicAnonKey, getServerUrl } = await import('../../utils/supabase/info');
      
      fetch(`${getServerUrl()}/generate-key-facts`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
          trackId: id,
          trackType: track.type,
          title: track.title || '',
          description: updateData.transcript || '',
          content: plainText,
          replaceExisting: true  // Replace facts when article content changes (was adding duplicates)
        })
      })
      .then(async (res) => {
        if (res.ok) {
          const result = await res.json();
          
          // Update hash in database
          const { error: hashError } = await supabase.from('tracks').update({
            facts_content_hash: newContentHash,
            facts_generated_at: new Date().toISOString()
          }).eq('id', id);
          
          if (hashError) {
            console.error('Failed to update facts hash:', hashError.message);
          }
          
          // Trigger UI refresh by dispatching custom event
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('factsRegenerated', { 
              detail: { trackId: id, factCount: result.enriched?.length || 0 }
            }));
          }
        } else {
          const errorData = await res.json().catch(() => ({}));
          console.error('Failed to regenerate facts:', errorData.error || res.statusText);
        }
      })
      .catch(err => console.error('Failed to regenerate facts:', err.message));
    }).catch(err => console.error('Failed to import hash utilities:', err));
  }
  
  // Automate video workflow if:
  // 1. It's a video track
  // 2. Content URL was added or changed
  // 3. Transcript doesn't exist yet (or was cleared)
  const isVideo = (track.type || existingTrack?.type) === 'video';
  const newContentUrl = updateData.content_url || track.content_url;
  const contentUrlChanged = newContentUrl && newContentUrl !== existingTrack?.content_url;
  const hasNoTranscript = !track.transcript && !existingTrack?.transcript;
  
  if (isVideo && newContentUrl && (contentUrlChanged || hasNoTranscript)) {
    // Get full track data for automation
    const fullTrack = {
      id: track.id,
      title: track.title || existingTrack?.title,
      description: track.description || existingTrack?.description,
      content_url: newContentUrl,
      organization_id: track.organization_id || existingTrack?.organization_id,
    };
    automateVideoWorkflow(fullTrack).catch(() => {});
  }

  // Automate story workflow if:
  // 1. It's a story track
  // 2. Transcript (story data) was added or changed
  // 3. Story data contains video slides
  const isStory = (track.type || existingTrack?.type) === 'story';
  const newTranscript = updateData.transcript || track.transcript;
  const transcriptChanged = newTranscript && newTranscript !== existingTrack?.transcript;
  
  if (isStory && newTranscript && transcriptChanged) {
    // Parse to check if there are video slides
    try {
      const storyData = typeof newTranscript === 'string' ? JSON.parse(newTranscript) : newTranscript;
      const hasVideoSlides = storyData.slides?.some((s: any) => s.type === 'video' && s.url);
      
      if (hasVideoSlides) {
        const fullTrack = {
          id: track.id,
          title: track.title || existingTrack?.title,
          description: track.description || existingTrack?.description,
          transcript: newTranscript,
          organization_id: track.organization_id || existingTrack?.organization_id,
        };
        automateStoryWorkflow(fullTrack).catch(() => {});
      }
    } catch (e) {
      // Not valid JSON, skip
    }
  }

  // Handle Brain indexing based on status change
  const previousStatus = existingTrack?.status;
  // Update trackType with the final track data (may have changed during update)
  const finalTrackType = track.type || existingTrack?.type || 'article';
  
  // Get transcript for videos if needed
  if (finalTrackType === 'video' && track.status === 'published') {
    getTrackTranscript(track.id).then(transcript => {
      handleTrackStatusChange(track, previousStatus, transcript).catch(() => {});
    }).catch(() => {
      // If transcript fetch fails, handle without it
      handleTrackStatusChange(track, previousStatus).catch(() => {});
    });
  } else {
    handleTrackStatusChange(track, previousStatus).catch(() => {});
  }
  
  return track;
}

/**
 * Publish a track (change status from draft to published)
 * Note: Brain indexing is handled by updateTrack → handleTrackStatusChange
 * to avoid duplicate indexing
 */
export async function publishTrack(trackId: string) {
  const track = await updateTrack({ id: trackId, status: 'published' });
  // Brain indexing is already triggered by updateTrack via handleTrackStatusChange
  // No need to call indexTrackToBrain again here
  return track;
}

/**
 * Archive a track
 */
export async function archiveTrack(trackId: string) {
  // Remove from Brain index when archiving (fire-and-forget)
  removeTrackFromBrain(trackId).catch(() => {});
  
  return updateTrack({ id: trackId, status: 'archived' });
}

/**
 * Delete a track
 */
export async function deleteTrack(trackId: string) {
  // Remove from Brain index first (fire-and-forget)
  removeTrackFromBrain(trackId).catch(() => {});
  
  // Check if track has playlist history
  const hasHistory = await checkTrackHasPlaylistHistory(trackId);
  
  if (hasHistory) {
    // Soft delete: preserve for audit trail
    await softDeleteTrack(trackId);
  } else {
    // Hard delete: truly remove from database
    // First, delete associated fact_usage entries (since track_id is TEXT, not FK with CASCADE)
    const { error: factUsageError } = await supabase
      .from('fact_usage')
      .delete()
      .eq('track_id', trackId);
    
    // Log but don't fail if fact_usage cleanup fails (non-critical)
    if (factUsageError) {
      console.error('Failed to cleanup fact_usage entries:', factUsageError);
    }
    
    // Then delete the track
    const { error } = await supabase
      .from('tracks')
      .delete()
      .eq('id', trackId);

    if (error) throw error;
  }
}

/**
 * Get track by ID with all relations
 */
export async function getTrackById(trackId: string) {
  const { data, error } = await supabase
    .from('tracks')
    .select('*')
    .eq('id', trackId)
    .single();

  if (error) throw error;

  // Enrich with tags from junction table and scope (so detail view shows "Content scope")
  const withTags = await enrichTracksWithJunctionTags([data]);
  const withScope = await enrichTracksWithScope(withTags);
  return withScope[0];
}

/**
 * Get track by ID, but redirect to latest version if this is an old version
 * Returns: { track, isLatest, latestTrackId }
 */
export async function getTrackByIdOrLatest(trackId: string): Promise<{
  track: any;
  isLatest: boolean;
  latestTrackId: string;
}> {
  const track = await getTrackById(trackId);
  
  // If this track is the latest version or has no parent (V1), return it
  if (track.is_latest_version !== false) {
    return { track, isLatest: true, latestTrackId: trackId };
  }
  
  // This is an old version - find the latest version
  const parentId = track.parent_track_id || trackId;

  // Get the latest version of this track family
  const { data: latestTrack, error } = await supabase
    .from('tracks')
    .select('*')
    .or(`id.eq.${parentId},parent_track_id.eq.${parentId}`)
    .eq('is_latest_version', true)
    .single();

  if (error || !latestTrack) {
    // Fallback: if we can't find the latest, return the requested track
    return { track, isLatest: false, latestTrackId: trackId };
  }

  // Enrich the latest track with tags and scope
  const withTags = await enrichTracksWithJunctionTags([latestTrack]);
  const withScope = await enrichTracksWithScope(withTags);
  return { track: withScope[0], isLatest: false, latestTrackId: latestTrack.id };
}

/**
 * Get all tracks for organization with filters
 */
export interface GetTracksScopeFilters {
  scopeLevel?: string;
  sector?: string;
  industryId?: string;
  stateCode?: string;
  stateId?: string;
  companyId?: string;
  programId?: string;
  unitId?: string;
}

export async function getTracks(filters: {
  type?: string;
  status?: string;
  search?: string;
  tags?: string[];
  ids?: string[]; // Filter by specific IDs
  includeAllVersions?: boolean; // Set to true to include old versions
  organizationId?: string; // Optional: specific org ID (defaults to current user's org)
  isSystemContent?: boolean; // Optional: filter for system content
  /** When true and isSystemContent true, skip org filter so Trike Super Admin sees all published system tracks. Only honored if current user is Trike Super Admin. */
  allSystemTracksForSuperAdmin?: boolean;
  scopeLevel?: string;
  sector?: string;
  industryId?: string;
  stateCode?: string;
  stateId?: string;
  companyId?: string;
  programId?: string;
  unitId?: string;
} = {}) {
  // Use provided organizationId or fall back to current user's org
  let orgId: string | null = filters.organizationId || (await getCurrentUserOrgId());
  const isSuperAdminAllSystem =
    filters.allSystemTracksForSuperAdmin === true &&
    filters.isSystemContent === true;
  // Content Management tab passes this only when UI role is Trike Super Admin (dropdown + password).
  // Trust the caller: that view is route- and password-protected, so skip org filter whenever asked.
  if (isSuperAdminAllSystem) {
    orgId = null; // Show all published system tracks (RLS allows for anon/Super Admin)
  }
  if (!orgId && !filters.isSystemContent) throw new Error('User not authenticated and no organization context provided');

  let query = supabase
    .from('tracks')
    .select('*');

  // Scope filter: resolve track_ids from track_scopes first
  const hasScopeFilter =
    filters.scopeLevel ||
    filters.sector ||
    filters.industryId ||
    filters.stateCode ||
    filters.stateId ||
    filters.companyId ||
    filters.programId ||
    filters.unitId;

  if (hasScopeFilter) {
    let scopeQuery = supabase.from('track_scopes').select('track_id');
    if (filters.scopeLevel) scopeQuery = scopeQuery.eq('scope_level', filters.scopeLevel);
    if (filters.sector) scopeQuery = scopeQuery.eq('sector', filters.sector);
    if (filters.industryId) scopeQuery = scopeQuery.eq('industry_id', filters.industryId);
    if (filters.stateId) scopeQuery = scopeQuery.eq('state_id', filters.stateId);
    if (filters.companyId) scopeQuery = scopeQuery.eq('company_id', filters.companyId);
    if (filters.programId) scopeQuery = scopeQuery.eq('program_id', filters.programId);
    if (filters.unitId) scopeQuery = scopeQuery.eq('unit_id', filters.unitId);
    if (filters.stateCode) {
      const { data: stateRow } = await supabase
        .from('us_states')
        .select('id')
        .eq('code', filters.stateCode.toUpperCase())
        .single();
      if (stateRow) scopeQuery = scopeQuery.eq('state_id', stateRow.id);
      else scopeQuery = scopeQuery.eq('state_id', '00000000-0000-0000-0000-000000000000'); // no match
    }
    const { data: scopeRows, error: scopeError } = await scopeQuery;
    if (scopeError) throw scopeError;
    const scopeTrackIds = [...new Set((scopeRows || []).map((r: { track_id: string }) => r.track_id))];
    if (scopeTrackIds.length === 0) return [];
    query = query.in('id', scopeTrackIds);
  }

  // Apply filters
  if (filters.isSystemContent !== undefined) {
    query = query.eq('is_system_content', filters.isSystemContent);
  }

  if (orgId) {
    query = query.eq('organization_id', orgId);
  }

  if (filters.ids && filters.ids.length > 0) {
    query = query.in('id', filters.ids);
  }

  if (filters.type) {
    query = query.eq('type', filters.type);
  }

  // Handle tag filtering via junction table (source of truth)
  if (filters.tags && filters.tags.length > 0) {
    // First, get tag IDs for the requested tag names
    const { data: matchingTagRecords } = await supabase
      .from('tags')
      .select('id')
      .in('name', filters.tags);

    const tagIds = matchingTagRecords?.map(t => t.id) || [];

    if (tagIds.length === 0) {
      // No tags found with these names, return empty result
      return [];
    }

    // Get track IDs that have any of these tags
    const { data: trackTagRelations } = await supabase
      .from('track_tags')
      .select('track_id')
      .in('tag_id', tagIds);

    const matchingTrackIds = [...new Set(trackTagRelations?.map(r => r.track_id) || [])];

    if (matchingTrackIds.length > 0) {
      query = query.in('id', matchingTrackIds);
    } else {
      // No tracks match the tag filter, return empty result
      return [];
    }
  }

  if (filters.status) {
    if (filters.status === 'archived') {
      // For archived view, just show tracks with status='archived'
      query = query.eq('status', 'archived');
    } else if (filters.status === 'drafts') {
      // For drafts view, show tracks with status='draft'
      query = query.eq('status', 'draft');
    } else if (filters.status === 'in-kb') {
      // For Knowledge Base view, filter at database level
      query = query.eq('status', 'published');

      // Get tracks with show_in_knowledge_base=true
      const { data: kbBooleanTracks } = await supabase
        .from('tracks')
        .select('id')
        .eq('organization_id', orgId)
        .eq('status', 'published')
        .eq('show_in_knowledge_base', true);

      // Get tracks with system:show_in_knowledge_base tag via junction table
      const { data: kbTagRecord } = await supabase
        .from('tags')
        .select('id')
        .eq('name', 'system:show_in_knowledge_base')
        .single();

      let kbTagTrackIds: string[] = [];
      if (kbTagRecord) {
        const { data: kbTagRelations } = await supabase
          .from('track_tags')
          .select('track_id')
          .eq('tag_id', kbTagRecord.id);
        kbTagTrackIds = kbTagRelations?.map(r => r.track_id) || [];
      }

      // Combine all track IDs
      const allKbTrackIds = [
        ...(kbBooleanTracks?.map(t => t.id) || []),
        ...kbTagTrackIds
      ];

      const uniqueKbTrackIds = [...new Set(allKbTrackIds)];

      if (uniqueKbTrackIds.length > 0) {
        query = query.in('id', uniqueKbTrackIds);
      } else {
        // No tracks match KB filter, return empty result
        return [];
      }
    } else {
      // For published/other status, filter by status
      query = query.eq('status', filters.status);
    }
  }

  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  // By default, only show latest versions (gracefully handle missing column)
  if (!filters.includeAllVersions) {
    try {
      query = query.or('is_latest_version.eq.true,is_latest_version.is.null');
    } catch (error: any) {
      // Column doesn't exist yet - migration not run. That's okay, continue without filter
      // Removed console.log per code quality standards
    }
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    // If error is about missing column, just log it and continue
    if (error.code === '42703') {
      // Removed console.warn and console.log per code quality standards

      // Retry query without the problematic filter
      const simpleQuery = supabase
        .from('tracks')
        .select('*');

      if (orgId) {
        simpleQuery.eq('organization_id', orgId);
      }

      if (filters.isSystemContent !== undefined) {
        simpleQuery.eq('is_system_content', filters.isSystemContent);
      }

      if (filters.ids && filters.ids.length > 0) {
        simpleQuery.in('id', filters.ids);
      }

      if (filters.type) {
        simpleQuery.eq('type', filters.type);
      }

      if (filters.status && filters.status !== 'in-kb') {
        simpleQuery.eq('status', filters.status);
      }

      if (filters.search) {
        simpleQuery.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      const { data: retryData, error: retryError } = await simpleQuery.order('created_at', { ascending: false });

      if (retryError) throw retryError;

      // Enrich with tags from junction table and scope
      const tracksWithJunctionTags = await enrichTracksWithJunctionTags(retryData || []);
      const filteredDataWithScope = await enrichTracksWithScope(tracksWithJunctionTags);

      // Apply client-side filtering for tags and in-kb if needed (fallback)
      let filteredData = filteredDataWithScope;

      if (filters.tags && filters.tags.length > 0) {
        filteredData = filteredData.filter(track => {
          const trackTags = track.tags || [];
          return filters.tags!.some(tag => trackTags.includes(tag));
        });
      }

      if (filters.status === 'in-kb') {
        filteredData = filteredData.filter(track => {
          const trackTags = track.tags || [];
          return trackTags.includes('system:show_in_knowledge_base') || track.show_in_knowledge_base === true;
        });
      }

      return filteredData;
    }
    throw error;
  }

  // Enrich tracks with tags from junction table (source of truth)
  const enrichedTracks = await enrichTracksWithJunctionTags(data || []);
  const withScope = await enrichTracksWithScope(enrichedTracks);

  // Post-fetch geographic filtering for system content (skip when Super Admin viewing all system tracks)
  // This ensures demo prospects only see relevant regulatory training for their states
  if (filters.isSystemContent && orgId && !filters.allSystemTracksForSuperAdmin) {
    try {
      const { data: orgData } = await supabase
        .from('organizations')
        .select('operating_states')
        .eq('id', orgId)
        .single();

      const states = orgData?.operating_states || [];
      if (states && states.length > 0) {
        const stateTagPrefix = 'state:';
        const allowedStateTags = states.map((s: string) => `${stateTagPrefix}${s.toUpperCase()}`);

        return withScope.filter(track => {
          const trackTags = track.tags || [];
          const hasStateTags = trackTags.some((tag: string) => tag.startsWith(stateTagPrefix));

          // If track has no state tags, it's national content (allowed for everyone)
          // If it has state tags, at least one must match the organization's operating states
          return !hasStateTags || trackTags.some((tag: string) => allowedStateTags.includes(tag));
        });
      }
    } catch (err) {
      console.warn('Geographic filtering failed (non-critical):', err);
      // Fallback: return all enriched tracks if org fetch fails
    }
  }

  return withScope;
}

/**
 * Content Management tab: all published system tracks via RPC (bypasses RLS).
 * Use this when the UI role is Trike Super Admin so the list is not limited by org.
 */
export async function getAllPublishedSystemTracksForContentManagement(): Promise<any[]> {
  const { data, error } = await supabase.rpc('get_all_published_system_tracks');
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  const withTags = await enrichTracksWithJunctionTags(rows);
  const withScope = await enrichTracksWithScope(withTags);
  return withScope;
}

/**
 * Upload track media (video, thumbnail, etc.)
 */
export async function uploadTrackMedia(
  trackId: string,
  file: File,
  type: 'content' | 'thumbnail'
): Promise<string> {
  try {
    // Validate file type for thumbnails
    if (type === 'thumbnail' && !file.type.startsWith('image/')) {
      throw new Error('Thumbnail must be an image file');
    }

    // Compress images automatically if they're thumbnails
    let fileToUpload = file;
    if (type === 'thumbnail' && file.type.startsWith('image/')) {
      try {
        fileToUpload = await compressImage(file, {
          maxSizeMB: 1, // Target 1MB for thumbnails
          maxWidth: 1920,
          maxHeight: 1920,
          quality: 0.8,
        });
      } catch (compressionError) {
        console.warn('Image compression failed, using original file:', compressionError);
        // Continue with original file if compression fails
      }
    }

    // Validate file size after compression (50MB max for content, 2MB for thumbnails after compression)
    const maxSize = type === 'thumbnail' 
      ? 2 * 1024 * 1024 // 2MB for thumbnails (after compression)
      : 50 * 1024 * 1024; // 50MB for content
    if (fileToUpload.size > maxSize) {
      throw new Error(`File size must be less than ${maxSize / 1024 / 1024}MB after compression`);
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExt = fileToUpload.name.split('.').pop() || 'bin';
    const fileName = type === 'thumbnail' 
      ? `thumbnails/${trackId}-${timestamp}.${fileExt}`
      : `content/${trackId}-${timestamp}.${fileExt}`;

    const BUCKET_NAME = 'make-2858cc8b-track-media';

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, fileToUpload, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Create signed URL (bucket is private, so we need signed URLs)
    // 10 years expiration for long-term access
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(fileName, 315360000); // 10 years in seconds

    if (signedUrlError) {
      throw new Error(`Failed to create URL: ${signedUrlError.message}`);
    }
    
    const url = signedUrlData.signedUrl;

    // Update track with new URL
    const updateData = type === 'content' 
      ? { content_url: url }
      : { thumbnail_url: url };

    await updateTrack({ id: trackId, ...updateData });

    return url;
  } catch (err: any) {
    console.error('Error uploading track media:', err);
    throw err;
  }
}

/**
 * Upload track file (for articles thumbnails, PDFs, etc.)
 */
export async function uploadTrackFile(trackId: string, file: File): Promise<{ url: string; fileName: string }> {
  try {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    // Compress image automatically
    let fileToUpload = file;
    try {
      fileToUpload = await compressImage(file, {
        maxSizeMB: 1, // Target 1MB for thumbnails
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.8,
      });
    } catch (compressionError) {
      console.warn('Image compression failed, using original file:', compressionError);
      // Continue with original file if compression fails
    }

    // Validate file size after compression (2MB max after compression)
    const maxSize = 2 * 1024 * 1024; // 2MB after compression
    if (fileToUpload.size > maxSize) {
      throw new Error('File size must be less than 2MB after compression');
    }

    // Generate unique filename
    const timestamp = Date.now();
    const fileExt = fileToUpload.name.split('.').pop() || 'jpg';
    const fileName = `thumbnails/${trackId}-${timestamp}.${fileExt}`;

    const BUCKET_NAME = 'make-2858cc8b-track-media';

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, fileToUpload, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Create signed URL (bucket is private, so we need signed URLs)
    // 10 years expiration for long-term access
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(fileName, 315360000); // 10 years in seconds

    if (signedUrlError) {
      throw new Error(`Failed to create URL: ${signedUrlError.message}`);
    }
    
    const url = signedUrlData.signedUrl;

    return {
      url: url,
      fileName: fileName
    };
  } catch (err: any) {
    console.error('Error uploading track file:', err);
    throw err;
  }
}

/**
 * Increment track view count
 * Uses RPC function for atomic increment, falls back to manual update if RPC doesn't exist
 * Optionally records activity event if userId is provided
 */
export async function incrementTrackViews(trackId: string, userId?: string | null) {
  if (!trackId) {
    console.error('❌ incrementTrackViews: trackId is required');
    return;
  }

  try {
    console.log('📊 incrementTrackViews: Attempting to increment views for track:', trackId);
    
    // Try RPC function first (most reliable - atomic operation)
    const { error: rpcError } = await supabase.rpc('increment_track_views', {
      track_id: trackId
    });

    if (!rpcError) {
      console.log('✅ incrementTrackViews: Successfully incremented via RPC for track:', trackId);
      
      // Note: Activity events for KB viewer views are now handled by the /kb/page-view edge function
      // which has service role access and can bypass RLS. Client-side activity event recording
      // is kept for Content Library views where the user is authenticated via Supabase Auth.
      if (userId) {
        recordViewActivityEvent(trackId, userId).catch(err => {
          console.warn('⚠️ incrementTrackViews: Failed to record activity event (non-critical):', err);
        });
      }
      
      return;
    }

    // RPC function doesn't exist or failed - log the error
    const isFunctionNotFound = rpcError.code === '42883' || 
                               rpcError.message?.includes('function') || 
                               rpcError.message?.includes('does not exist') ||
                               rpcError.message?.includes('not found');
    
    if (isFunctionNotFound) {
      console.warn('⚠️ incrementTrackViews: RPC function not found, falling back to manual increment. Consider running migration 00003_increment_track_views.sql');
    } else {
      console.error('❌ incrementTrackViews: RPC call failed:', {
        code: rpcError.code,
        message: rpcError.message,
        details: rpcError.details,
        hint: rpcError.hint
      });
    }
    
    // Fall back to manual increment (read-then-update - not atomic but works)
    console.log('📊 incrementTrackViews: Falling back to manual increment for track:', trackId);
    
    const { data: track, error: fetchError } = await supabase
      .from('tracks')
      .select('view_count, id')
      .eq('id', trackId)
      .single();

    if (fetchError) {
      console.error('❌ incrementTrackViews: Failed to fetch track:', {
        trackId,
        error: fetchError.code,
        message: fetchError.message
      });
      return;
    }

    if (!track) {
      console.error('❌ incrementTrackViews: Track not found:', trackId);
      return;
    }

    const currentCount = track.view_count || 0;
    const newCount = currentCount + 1;

    const { error: updateError } = await supabase
      .from('tracks')
      .update({ view_count: newCount })
      .eq('id', trackId);

    if (updateError) {
      console.error('❌ incrementTrackViews: Failed to update view count:', {
        trackId,
        currentCount,
        newCount,
        error: updateError.code,
        message: updateError.message
      });
    } else {
      console.log('✅ incrementTrackViews: Successfully incremented manually:', {
        trackId,
        oldCount: currentCount,
        newCount
      });
      
      // Note: Activity events for KB viewer views are now handled by the /kb/page-view edge function
      // which has service role access and can bypass RLS. Client-side activity event recording
      // is kept for Content Library views where the user is authenticated via Supabase Auth.
      if (userId) {
        recordViewActivityEvent(trackId, userId).catch(err => {
          console.warn('⚠️ incrementTrackViews: Failed to record activity event (non-critical):', err);
        });
      }
    }
  } catch (err: any) {
    // Catch unexpected errors
    console.error('❌ incrementTrackViews: Unexpected error:', {
      trackId,
      error: err?.message || err,
      stack: err?.stack
    });
  }
}

/**
 * Record view activity event in activity_events table
 */
async function recordViewActivityEvent(trackId: string, userId: string) {
  try {
    console.log('📝 recordViewActivityEvent: Starting for trackId:', trackId, 'userId:', userId);
    
    if (!userId) {
      console.warn('⚠️ recordViewActivityEvent: userId is missing, skipping activity event');
      return;
    }

    // Get track info for activity event
    const { data: track, error: trackError } = await supabase
      .from('tracks')
      .select('title, type, version_number, organization_id')
      .eq('id', trackId)
      .single();

    if (trackError || !track) {
      console.warn('⚠️ recordViewActivityEvent: Track not found:', {
        trackId,
        error: trackError?.message
      });
      return;
    }

    console.log('📝 recordViewActivityEvent: Track found, inserting activity event...');

    // Insert activity event with xAPI/Tin Can API standard verb
    const { data: insertedEvent, error: activityError } = await supabase
      .from('activity_events')
      .insert({
        user_id: userId,
        verb: 'Viewed', // xAPI/Tin Can API standard verb (capitalized per https://registry.tincanapi.com/#home/verbs)
        object_type: 'track',
        object_id: trackId,
        object_name: track.title,
        result_completion: false, // Viewing is not completion
        context_platform: 'web',
        timestamp: new Date().toISOString(),
        metadata: {
          track_type: track.type,
          track_version: track.version_number || 1,
          action_type: 'view',
          verb_uri: 'http://activitystrea.ms/schema/1.0/view' // xAPI verb URI for LRS interoperability
        }
      })
      .select()
      .single();

    if (activityError) {
      console.error('❌ recordViewActivityEvent: Failed to insert activity event:', {
        trackId,
        userId,
        error: activityError.message,
        code: activityError.code,
        details: activityError.details,
        hint: activityError.hint
      });
    } else {
      console.log('✅ recordViewActivityEvent: Activity event recorded successfully:', {
        trackId,
        userId,
        eventId: insertedEvent?.id
      });
    }
  } catch (err: any) {
    console.error('❌ recordViewActivityEvent: Unexpected error:', {
      trackId,
      userId,
      error: err?.message || err,
      stack: err?.stack
    });
  }
}

/**
 * Increment track likes count
 * Uses RPC function for atomic increment, falls back to manual update if RPC doesn't exist
 * Optionally records activity event if userId is provided
 */
export async function incrementTrackLikes(trackId: string, userId?: string | null) {
  if (!trackId) {
    console.error('❌ incrementTrackLikes: trackId is required');
    return;
  }

  try {
    console.log('📊 incrementTrackLikes: Attempting to increment likes for track:', trackId);
    
    // Try RPC function first (most reliable - atomic operation)
    const { error: rpcError } = await supabase.rpc('increment_track_likes', {
      track_id: trackId
    });

    if (!rpcError) {
      console.log('✅ incrementTrackLikes: Successfully incremented via RPC for track:', trackId);
      
      // Record activity event if userId is provided
      if (userId) {
        recordLikeActivityEvent(trackId, userId).catch(err => {
          console.warn('⚠️ incrementTrackLikes: Failed to record activity event (non-critical):', err);
        });
      }
      
      return;
    }

    // RPC function doesn't exist or failed - log the error
    const isFunctionNotFound = rpcError.code === '42883' || 
                               rpcError.message?.includes('function') || 
                               rpcError.message?.includes('does not exist') ||
                               rpcError.message?.includes('not found');
    
    if (isFunctionNotFound) {
      console.warn('⚠️ incrementTrackLikes: RPC function not found, falling back to manual increment. Consider running migration 00004_add_likes_count.sql');
    } else {
      console.error('❌ incrementTrackLikes: RPC call failed:', {
        code: rpcError.code,
        message: rpcError.message,
        details: rpcError.details,
        hint: rpcError.hint
      });
    }
    
    // Fall back to manual increment (read-then-update - not atomic but works)
    console.log('📊 incrementTrackLikes: Falling back to manual increment for track:', trackId);
    
    const { data: track, error: fetchError } = await supabase
      .from('tracks')
      .select('likes_count, id')
      .eq('id', trackId)
      .single();

    if (fetchError) {
      console.error('❌ incrementTrackLikes: Failed to fetch track:', {
        trackId,
        error: fetchError.code,
        message: fetchError.message
      });
      return;
    }

    if (!track) {
      console.error('❌ incrementTrackLikes: Track not found:', trackId);
      return;
    }

    const currentCount = track.likes_count || 0;
    const newCount = currentCount + 1;

    const { error: updateError } = await supabase
      .from('tracks')
      .update({ likes_count: newCount })
      .eq('id', trackId);

    if (updateError) {
      console.error('❌ incrementTrackLikes: Failed to update likes count:', {
        trackId,
        currentCount,
        newCount,
        error: updateError.code,
        message: updateError.message
      });
    } else {
      console.log('✅ incrementTrackLikes: Successfully incremented manually:', {
        trackId,
        oldCount: currentCount,
        newCount
      });
      
      // Record activity event if userId is provided
      if (userId) {
        recordLikeActivityEvent(trackId, userId).catch(err => {
          console.warn('⚠️ incrementTrackLikes: Failed to record activity event (non-critical):', err);
        });
      }
    }
  } catch (err: any) {
    // Catch unexpected errors
    console.error('❌ incrementTrackLikes: Unexpected error:', {
      trackId,
      error: err?.message || err,
      stack: err?.stack
    });
  }
}

/**
 * Record like activity event in activity_events table
 */
async function recordLikeActivityEvent(trackId: string, userId: string) {
  try {
    console.log('📝 recordLikeActivityEvent: Starting for trackId:', trackId, 'userId:', userId);
    
    if (!userId) {
      console.warn('⚠️ recordLikeActivityEvent: userId is missing, skipping activity event');
      return;
    }

    // Get track info for activity event
    const { data: track, error: trackError } = await supabase
      .from('tracks')
      .select('title, type, version_number, organization_id')
      .eq('id', trackId)
      .single();

    if (trackError || !track) {
      console.warn('⚠️ recordLikeActivityEvent: Track not found:', {
        trackId,
        error: trackError?.message
      });
      return;
    }

    console.log('📝 recordLikeActivityEvent: Track found, inserting activity event...');

    // Insert activity event with xAPI/Tin Can API standard verb
    const { data: insertedEvent, error: activityError } = await supabase
      .from('activity_events')
      .insert({
        user_id: userId,
        verb: 'Liked', // xAPI/Tin Can API standard verb (capitalized)
        object_type: 'track',
        object_id: trackId,
        object_name: track.title,
        result_completion: false, // Liking is not completion
        context_platform: 'web',
        timestamp: new Date().toISOString(),
        metadata: {
          track_type: track.type,
          track_version: track.version_number || 1,
          action_type: 'like',
          verb_uri: 'http://activitystrea.ms/schema/1.0/like' // xAPI verb URI for interoperability
        }
      })
      .select()
      .single();

    if (activityError) {
      console.error('❌ recordLikeActivityEvent: Failed to insert activity event:', {
        trackId,
        userId,
        error: activityError.message,
        code: activityError.code,
        details: activityError.details,
        hint: activityError.hint
      });
    } else {
      console.log('✅ recordLikeActivityEvent: Activity event recorded successfully:', {
        trackId,
        userId,
        eventId: insertedEvent?.id
      });
    }
  } catch (err: any) {
    console.error('❌ recordLikeActivityEvent: Unexpected error:', {
      trackId,
      userId,
      error: err?.message || err,
      stack: err?.stack
    });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function addLearningObjectives(trackId: string, objectives: string[]) {
  const objectivesToInsert = objectives.map((text, index) => ({
    track_id: trackId,
    objective_text: text,
    display_order: index
  }));

  const { error } = await supabase
    .from('learning_objectives')
    .insert(objectivesToInsert);

  if (error) throw error;
}

// ============================================================================
// VERSIONING OPERATIONS
// ============================================================================

/**
 * Duplicate a track (creates a copy with "(Copy)" suffix)
 */
export async function duplicateTrack(trackId: string) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  // Get original track
  const originalTrack = await getTrackById(trackId);
  if (!originalTrack) throw new Error('Track not found');

  // Create duplicate with "(Copy)" suffix
  const copyNumber = await getNextCopyNumber(originalTrack.title);
  const newTitle = copyNumber === 1 
    ? `${originalTrack.title} (Copy)` 
    : `${originalTrack.title} (Copy ${copyNumber})`;

  const duplicateData: CreateTrackInput = {
    title: newTitle,
    description: originalTrack.description,
    type: originalTrack.type,
    content_url: originalTrack.content_url,
    thumbnail_url: originalTrack.thumbnail_url,
    duration_minutes: originalTrack.duration_minutes,
    transcript: originalTrack.transcript,
    summary: originalTrack.summary,
    content_text: originalTrack.content_text,
    status: 'draft', // Always start as draft
    learning_objectives: originalTrack.learning_objectives,
    tags: originalTrack.tags,
    is_system_content: false, // Copies are never system content
    parent_track_id: null, // Not a version, it's a duplicate
    version_number: 1, // Fresh track
    is_latest_version: true
  };

  const newTrack = await createTrack(duplicateData);
  return newTrack;
}

/**
 * Helper to get next copy number for duplicate naming
 */
async function getNextCopyNumber(originalTitle: string): Promise<number> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) return 1;

  const { data: tracks } = await supabase
    .from('tracks')
    .select('title')
    .eq('organization_id', orgId)
    .or(`title.eq.${originalTitle} (Copy),title.like.${originalTitle} (Copy %)`);

  if (!tracks || tracks.length === 0) return 1;

  // Find highest copy number
  let maxNumber = 0;
  tracks.forEach(track => {
    const match = track.title.match(/\(Copy (\d+)\)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNumber) maxNumber = num;
    } else if (track.title.endsWith('(Copy)')) {
      maxNumber = Math.max(maxNumber, 1);
    }
  });

  return maxNumber + 1;
}

/**
 * Get all versions of a track (including the track itself)
 */
export async function getTrackVersions(trackId: string) {
  try {
    const response = await fetch(`${getServerUrl()}/track-versions/${trackId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || 'trike-server';
        console.error(`❌ Track versions endpoint not found. Check that VITE_SUPABASE_FUNCTION_NAME is set to 'trike-server' (currently: '${functionName}')`);
      }
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Server error');
    }

    const data = await response.json();
    return data.versions || [];
  } catch (error: any) {
    // Return empty array silently - server health check handles the warning
    if (getHealthStatus()) {
      console.error('Failed to fetch track versions despite server being healthy:', error.message);
    }
    return [];
  }
}

/**
 * Create a new version of a track (used when editing published tracks)
 */
export async function createTrackVersion(
  originalTrackId: string, 
  updates: Partial<CreateTrackInput>,
  versionNotes: string
) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const originalTrack = await getTrackById(originalTrackId);
  if (!originalTrack) throw new Error('Track not found');

  // Determine parent and next version number
  const parentId = originalTrack.parent_track_id || originalTrack.id;
  const currentVersion = originalTrack.version_number || 1;
  const nextVersion = currentVersion + 1;

  // SAFETY CHECK: Prevent duplicate versions
  // Check if the next version already exists
  const { data: existingVersion } = await supabase
    .from('videos')
    .select('id, version_number')
    .eq('parent_track_id', parentId)
    .eq('version_number', nextVersion)
    .maybeSingle();

  if (existingVersion) {
    return existingVersion;
  }

  // Create new version
  // Strategy for views/likes:
  // - Views: Carry over (same content, just updated)
  // - Likes: Start fresh (users can re-like the updated version)
  const newVersionData: CreateTrackInput = {
    ...originalTrack,
    ...updates,
    parent_track_id: parentId,
    version_number: nextVersion,
    version_notes: versionNotes,
    is_latest_version: true,
    status: 'published', // New version is published
    // Explicitly handle views/likes:
    // Views carry over from original (preserve popularity)
    // Likes start fresh (measure engagement with new version)
    // Note: view_count and likes_count are not in CreateTrackInput, so we'll set them after creation
  };

  const newVersion = await createTrack(newVersionData);
  
  // Set view_count to carry over from original, but likes_count starts at 0
  if (newVersion && originalTrack.view_count) {
    await supabase
      .from('tracks')
      .update({ 
        view_count: originalTrack.view_count,
        likes_count: 0 // Start fresh for likes
      })
      .eq('id', newVersion.id);
    
    // Update the returned object to reflect the changes
    newVersion.view_count = originalTrack.view_count;
    newVersion.likes_count = 0;
  }

  // Mark old version as no longer latest
  await updateTrack({
    id: originalTrackId,
    is_latest_version: false
  });

  return newVersion;
}

/**
 * Get playlists that use a specific track
 */
export async function getPlaylistsForTrack(trackId: string) {
  const { data, error } = await supabase
    .from('playlist_tracks')
    .select(`
      playlist:playlists (
        id,
        title,
        description
      )
    `)
    .eq('track_id', trackId);

  if (error) throw error;
  
  // Extract unique playlists
  const playlists = data?.map(pt => pt.playlist).filter(Boolean) || [];
  return playlists;
}

/**
 * Get assignment stats for a track (pending and completed)
 */
export async function getTrackAssignmentStats(trackId: string) {
  // Get all playlist assignments for this track
  const { data: playlistTracks, error: playlistError } = await supabase
    .from('playlist_tracks')
    .select('playlist_id')
    .eq('track_id', trackId);

  if (playlistError) {
    console.error('Error fetching playlist tracks:', playlistError);
  }

  if (!playlistTracks || playlistTracks.length === 0) {
    return { 
      pendingCount: 0, 
      completedCount: 0, 
      totalAssignments: 0,
      playlistCount: 0 
    };
  }

  const playlistIds = playlistTracks.map(pt => pt.playlist_id);

  // Query the assignments table using the ACTUAL schema (playlist_id, user_id, status='assigned')
  const { data: assignments, error: assignmentsError } = await supabase
    .from('assignments')
    .select('id, status, playlist_id, user_id, completed_at, progress_percent')
    .in('playlist_id', playlistIds)
    .eq('status', 'assigned');

  if (assignmentsError) {
    console.error('Error fetching assignments:', assignmentsError);
  }

  if (!assignments || assignments.length === 0) {
    return {
      pendingCount: 0,
      completedCount: 0,
      totalAssignments: 0,
      playlistCount: playlistTracks.length
    };
  }

  // Calculate stats directly from assignments (no separate progress table needed)
  const totalAssignments = assignments.length;
  const completedCount = assignments.filter(a => a.completed_at).length;
  const pendingCount = totalAssignments - completedCount;

  return {
    pendingCount,
    completedCount,
    totalAssignments,
    playlistCount: playlistTracks.length
  };
}

/**
 * Replace track in playlists (used when creating new version)
 */
export async function replaceTrackInPlaylists(
  oldTrackId: string,
  newTrackId: string,
  playlistIds?: string[]
) {
  let query = supabase
    .from('playlist_tracks')
    .update({ track_id: newTrackId })
    .eq('track_id', oldTrackId);

  // Optionally filter by specific playlists
  if (playlistIds && playlistIds.length > 0) {
    query = query.in('playlist_id', playlistIds);
  }

  const { error } = await query;
  if (error) throw error;
}

/**
 * Reassign completed users to new track version
 */
export async function reassignCompletedUsers(
  oldTrackId: string,
  newTrackId: string,
  playlistIds?: string[]
) {
  // This function marks completed users as needing to re-do the track
  // Implementation depends on your completion tracking structure
  
  // Get playlist tracks
  let query = supabase
    .from('playlist_tracks')
    .select('playlist_id')
    .eq('track_id', oldTrackId);

  if (playlistIds && playlistIds.length > 0) {
    query = query.in('playlist_id', playlistIds);
  }

  const { data: playlistTracks } = await query;
  if (!playlistTracks) return;

  const affectedPlaylistIds = playlistTracks.map(pt => pt.playlist_id);

  // Get user progress records that completed these playlists
  const { data: completedProgressRecords } = await supabase
    .from('playlist_progress')
    .select('id, user_id, playlist_id')
    .in('playlist_id', affectedPlaylistIds)
    .not('completed_at', 'is', null);

  if (!completedProgressRecords) return;

  // Reset completion status (they need to complete the new version)
  for (const progress of completedProgressRecords) {
    await supabase
      .from('playlist_progress')
      .update({
        completed_at: null,
        progress_percentage: 0
      })
      .eq('id', progress.id);
  }
}

/**
 * Check if track has ever been assigned to a playlist
 */
export async function checkTrackHasPlaylistHistory(trackId: string): Promise<boolean> {
  // Check if track exists in the playlist_tracks junction table
  const { data, error } = await supabase
    .from('playlist_tracks')
    .select('id')
    .eq('track_id', trackId)
    .limit(1);

  if (error) {
    console.error('Error checking playlist history:', error);
    return false; // Default to false if error
  }
  
  return data && data.length > 0;
}

/**
 * Mark track as having playlist history (one-way gate)
 * NOTE: This is now handled automatically by checking the playlist_tracks table
 * Keeping this function for backwards compatibility but it's a no-op
 */
export async function markTrackHasPlaylistHistory(trackId: string) {
  // No longer needed - we check playlist_tracks junction table directly
  // This function is kept for backwards compatibility
  return;
}

/**
 * Get detailed playlist assignments with activity stats for a track
 */
export async function getTrackPlaylistAssignments(trackId: string) {
  // Get all playlists containing this track
  const { data: playlistTracks, error: ptError } = await supabase
    .from('playlist_tracks')
    .select(`
      playlist_id,
      playlists (
        id,
        title,
        description,
        is_active
      )
    `)
    .eq('track_id', trackId);

  if (ptError) throw ptError;
  if (!playlistTracks || playlistTracks.length === 0) return [];

  // Get assignment stats for each playlist
  const results = await Promise.all(
    playlistTracks.map(async (pt: any) => {
      const playlist = pt.playlists;
      if (!playlist) return null;

      // Query assignments using the ACTUAL schema (playlist_id, user_id, status='assigned')
      const { data: assignments } = await supabase
        .from('assignments')
        .select('id, completed_at, progress_percent')
        .eq('playlist_id', playlist.id)
        .eq('status', 'assigned');

      const totalAssignments = assignments?.length || 0;
      const completedCount = assignments?.filter(a => a.completed_at).length || 0;
      const pendingCount = totalAssignments - completedCount;
      const progressPercent = totalAssignments > 0 
        ? Math.round((completedCount / totalAssignments) * 100) 
        : 0;

      return {
        playlistId: playlist.id,
        playlistTitle: playlist.title,
        playlistDescription: playlist.description,
        playlistStatus: playlist.is_active ? 'active' : 'archived',
        pendingCount,
        completedCount,
        totalAssignments,
        progressPercent
      };
    })
  );

  return results.filter(Boolean);
}

/**
 * Soft delete track (for tracks with playlist history)
 */
export async function softDeleteTrack(trackId: string) {
  // Try to set deleted_at if column exists, otherwise just set status to archived
  try {
    const { error } = await supabase
      .from('tracks')
      .update({
        deleted_at: new Date().toISOString(),
        status: 'archived'
      })
      .eq('id', trackId);

    if (error) {
      // If deleted_at column doesn't exist, just set status
      // Check for both PostgreSQL error code and Supabase schema cache error
      const isColumnNotFound = error.code === '42703' ||
        error.message?.includes('Could not find') ||
        error.message?.includes('deleted_at');

      if (isColumnNotFound) {
        console.log('⚠️ deleted_at column not found, using status only');
        const { error: statusError } = await supabase
          .from('tracks')
          .update({ status: 'archived' })
          .eq('id', trackId);

        if (statusError) throw statusError;
      } else {
        throw error;
      }
    }
  } catch (err) {
    console.error('Error in softDeleteTrack:', err);
    throw err;
  }
}

/**
 * Bulk assign tracks to an album. Skips tracks already in the album.
 * Used by Trike Super Admin content management.
 */
export async function bulkAssignTracksToAlbum(
  albumId: string,
  trackIds: string[]
): Promise<{ added: number; skipped: number; errors: string[] }> {
  if (!albumId || !trackIds?.length) {
    return { added: 0, skipped: 0, errors: [] };
  }
  const { data: existing } = await supabase
    .from('album_tracks')
    .select('track_id')
    .eq('album_id', albumId);
  const existingSet = new Set((existing || []).map((r: { track_id: string }) => r.track_id));
  const toAdd = trackIds.filter((id) => !existingSet.has(id));
  if (toAdd.length === 0) {
    return { added: 0, skipped: trackIds.length, errors: [] };
  }
  const maxOrderResult = await supabase
    .from('album_tracks')
    .select('display_order')
    .eq('album_id', albumId)
    .order('display_order', { ascending: false })
    .limit(1);
  const maxOrder = (maxOrderResult.data?.[0] as any)?.display_order ?? 0;
  const records = toAdd.map((track_id, i) => ({
    album_id: albumId,
    track_id,
    display_order: maxOrder + 1 + i,
    is_required: true,
    unlock_previous: false,
  }));
  const { error } = await supabase.from('album_tracks').insert(records);
  if (error) throw error;
  await supabase.from('albums').update({ updated_at: new Date().toISOString() }).eq('id', albumId);
  return {
    added: toAdd.length,
    skipped: trackIds.length - toAdd.length,
    errors: [],
  };
}

/**
 * Bulk set is_system_content (Trike template for new orgs) on tracks.
 * Used by Content Management bulk "Set system content" action.
 */
export async function bulkUpdateTrackSystemContent(
  trackIds: string[],
  isSystemContent: boolean
): Promise<{ updated: number; errors: string[] }> {
  if (!trackIds?.length) return { updated: 0, errors: [] };
  const { error } = await supabase
    .from('tracks')
    .update({ is_system_content: isSystemContent, updated_at: new Date().toISOString() })
    .in('id', trackIds);
  if (error) throw error;
  return { updated: trackIds.length, errors: [] };
}