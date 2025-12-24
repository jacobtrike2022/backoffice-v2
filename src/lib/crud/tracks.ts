// ============================================================================
// TRACKS CRUD OPERATIONS
// ============================================================================

import { projectId, publicAnonKey, getServerUrl } from '../../utils/supabase/info';
import { getHealthStatus } from '../serverHealth';
import { supabase, getCurrentUserOrgId } from '../supabase';
import { compressImage } from '../utils/imageCompression';
import { indexTrackToBrain, removeTrackFromBrain, handleTrackStatusChange, getTrackTranscript } from '../utils/brainIndexer';
import { generateKeyFacts } from './facts';

export interface CreateTrackInput {
  title: string;
  description?: string;
  type: 'video' | 'story' | 'article' | 'checkpoint';
  content_url?: string;
  thumbnail_url?: string;
  duration_minutes?: number;
  transcript?: string;
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

// Default thumbnail URL (served from public folder)
const DEFAULT_THUMBNAIL_URL = '/default-thumbnail.png';

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

    // Step 2: Update track with transcript
    console.log('[Video Workflow] Step 2: Saving transcript to track...');
    const { error: updateError } = await supabase
      .from('tracks')
      .update({ transcript: transcriptText })
      .eq('id', track.id);

    if (updateError) {
      console.error('[Video Workflow] Failed to save transcript:', updateError);
      // Continue anyway - transcript is cached in media_transcripts
    } else {
      console.log('[Video Workflow] ✓ Transcript saved to track');
    }

    // Step 3: Generate key facts
    console.log('[Video Workflow] Step 3: Generating key facts...');
    const orgId = track.organization_id || await getCurrentUserOrgId();
    
    await generateKeyFacts({
      title: track.title || 'Untitled Video',
      description: track.description || '',
      transcript: transcriptText,
      trackType: 'video',
      trackId: track.id,
      companyId: orgId || undefined,
    });

    console.log(`[Video Workflow] ✓ Key facts generated for track ${track.id}`);
    console.log('[Video Workflow] Automation complete!');

  } catch (error) {
    // Log but don't throw - automation failure shouldn't break track creation
    console.error(`[Video Workflow] ✗ Automation failed for track ${track.id}:`, error);
  }
}

/**
 * Create a new track (defaults to draft)
 * Automatically assigns default thumbnail if none provided
 */
export async function createTrack(input: CreateTrackInput) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  // Set default thumbnail if none provided
  const thumbnailUrl = input.thumbnail_url || DEFAULT_THUMBNAIL_URL;

  const { data: track, error } = await supabase
    .from('tracks')
    .insert({
      organization_id: orgId,
      title: input.title,
      description: input.description,
      type: input.type,
      content_url: input.content_url,
      thumbnail_url: thumbnailUrl,
      duration_minutes: input.duration_minutes,
      transcript: input.transcript,
      summary: input.summary,
      status: input.status || 'draft',
      learning_objectives: input.learning_objectives || [],
      tags: input.tags || [],
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

  // Automate video workflow: transcribe → save transcript → generate key facts
  if (track.type === 'video' && track.content_url) {
    automateVideoWorkflow(track).catch(() => {});
  }

  // Automate story workflow: transcribe all videos → update story JSON → generate key facts
  if (track.type === 'story' && track.transcript) {
    automateStoryWorkflow(track).catch(() => {});
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
  const { data: existingTrack, error: checkError } = await supabase
    .from('tracks')
    .select('id, created_by, organization_id, status, type, content_url, transcript, title, description')
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

  // Update the track
  const { data: track, error } = await supabase
    .from('tracks')
    .update(updateData)
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
          content: plainText
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
  const trackType = track.type || existingTrack?.type || 'article';
  
  // Get transcript for videos if needed
  if (trackType === 'video' && track.status === 'published') {
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
 */
export async function publishTrack(trackId: string) {
  const track = await updateTrack({ id: trackId, status: 'published' });
  
  // Index to Brain after publishing (fire-and-forget)
  const trackType = track.type || track.track_type || 'article';
  if (trackType === 'video') {
    getTrackTranscript(track.id).then(transcript => {
      indexTrackToBrain(track, transcript).catch(() => {});
    }).catch(() => {
      indexTrackToBrain(track).catch(() => {});
    });
  } else {
    indexTrackToBrain(track).catch(() => {});
  }
  
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
  return data;
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
  
  return { track: latestTrack, isLatest: false, latestTrackId: latestTrack.id };
}

/**
 * Get all tracks for organization with filters
 */
export async function getTracks(filters: {
  type?: string;
  status?: string;
  search?: string;
  tags?: string[];
  ids?: string[]; // Filter by specific IDs
  includeAllVersions?: boolean; // Set to true to include old versions
} = {}) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  let query = supabase
    .from('tracks')
    .select(`
      *,
      track_tags(tags(id, name, color, parent_id))
    `)
    .eq('organization_id', orgId);

  if (filters.ids && filters.ids.length > 0) {
    query = query.in('id', filters.ids);
  }

  if (filters.type) {
    query = query.eq('type', filters.type);
  }

  // Handle tag filtering at database level if tags are provided
  let trackIdsWithTags: string[] | null = null;
  if (filters.tags && filters.tags.length > 0) {
    // First, get tag IDs from tag names
    const { data: matchingTags } = await supabase
      .from('tags')
      .select('id, name')
      .in('name', filters.tags)
      .or(`organization_id.eq.${orgId},organization_id.is.null`);
    
    const tagIds = matchingTags?.map(t => t.id) || [];
    
    // Get track IDs that have these tags via junction table
    if (tagIds.length > 0) {
      const { data: trackTagMatches } = await supabase
        .from('track_tags')
        .select('track_id')
        .in('tag_id', tagIds);
      
      trackIdsWithTags = trackTagMatches?.map(tt => tt.track_id) || [];
    }
    
    // Also get track IDs from legacy tags column (array contains)
    const { data: legacyTracks } = await supabase
      .from('tracks')
      .select('id')
      .eq('organization_id', orgId)
      .contains('tags', filters.tags);
    
    const legacyTrackIds = legacyTracks?.map(t => t.id) || [];
    
    // Combine both sets of track IDs
    const allMatchingTrackIds = [...new Set([...(trackIdsWithTags || []), ...legacyTrackIds])];
    
    if (allMatchingTrackIds.length > 0) {
      query = query.in('id', allMatchingTrackIds);
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
      
      // Get the system:show_in_knowledge_base tag ID if it exists
      const { data: kbTag } = await supabase
        .from('tags')
        .select('id')
        .eq('name', 'system:show_in_knowledge_base')
        .maybeSingle();
      
      let kbTrackIds: string[] = [];
      
      if (kbTag) {
        // Get track IDs that have this tag via junction table
        const { data: kbTrackTags } = await supabase
          .from('track_tags')
          .select('track_id')
          .eq('tag_id', kbTag.id);
        
        kbTrackIds = kbTrackTags?.map(tt => tt.track_id) || [];
      }
      
      // Get tracks with show_in_knowledge_base=true
      const { data: kbBooleanTracks } = await supabase
        .from('tracks')
        .select('id')
        .eq('organization_id', orgId)
        .eq('status', 'published')
        .eq('show_in_knowledge_base', true);
      
      // Get tracks with legacy tags array containing the tag
      const { data: kbLegacyTracks } = await supabase
        .from('tracks')
        .select('id')
        .eq('organization_id', orgId)
        .eq('status', 'published')
        .contains('tags', ['system:show_in_knowledge_base']);
      
      // Combine all track IDs
      const allKbTrackIds = [
        ...kbTrackIds,
        ...(kbBooleanTracks?.map(t => t.id) || []),
        ...(kbLegacyTracks?.map(t => t.id) || [])
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
        .select(`
          *,
          track_tags(tags(id, name, color, parent_id))
        `)
        .eq('organization_id', orgId);
      
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
      
      // Apply client-side filtering for tags and in-kb if needed (fallback)
      let filteredData = retryData || [];
      
      if (filters.tags && filters.tags.length > 0) {
        filteredData = filteredData.filter(track => {
          const trackTags = track.track_tags?.map((tt: any) => tt.tags.name) || [];
          const columnTags = track.tags || [];
          const allTags = [...trackTags, ...columnTags];
          return filters.tags!.some(tag => allTags.includes(tag));
        });
      }
      
      if (filters.status === 'in-kb') {
        filteredData = filteredData.filter(track => {
          const columnTags = track.tags || [];
          return columnTags.includes('system:show_in_knowledge_base') || track.show_in_knowledge_base === true;
        });
      }
      
      return filteredData;
    }
    throw error;
  }

  return data || [];
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

async function addTrackTags(trackId: string, tagNames: string[]) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) return;

  // Get or create tags
  const tagIds: string[] = [];
  for (const tagName of tagNames) {
    const { data: existingTag } = await supabase
      .from('tags')
      .select('id')
      .eq('organization_id', orgId)
      .eq('name', tagName)
      .single();

    if (existingTag) {
      tagIds.push(existingTag.id);
    } else {
      const { data: newTag } = await supabase
        .from('tags')
        .insert({
          organization_id: orgId,
          name: tagName,
          type: 'content'
        })
        .select('id')
        .single();

      if (newTag) tagIds.push(newTag.id);
    }
  }

  // Link tags to track
  const trackTagsToInsert = tagIds.map(tagId => ({
    track_id: trackId,
    tag_id: tagId
  }));

  await supabase.from('track_tags').insert(trackTagsToInsert);
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
        const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || 'make-server-2858cc8b';
        console.error(`❌ Track versions endpoint not found. Check that VITE_SUPABASE_FUNCTION_NAME is set to 'make-server-2858cc8b' (currently: '${functionName}')`);
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
      if (error.code === '42703') {
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