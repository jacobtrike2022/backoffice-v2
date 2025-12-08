// ============================================================================
// TRACKS CRUD OPERATIONS
// ============================================================================

import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { getHealthStatus } from '../serverHealth';
import { supabase, getCurrentUserOrgId } from '../supabase';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-2858cc8b`;

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

/**
 * Create a new track (defaults to draft)
 */
export async function createTrack(input: CreateTrackInput) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const { data: track, error } = await supabase
    .from('tracks')
    .insert({
      organization_id: orgId,
      title: input.title,
      description: input.description,
      type: input.type,
      content_url: input.content_url,
      thumbnail_url: input.thumbnail_url,
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

  return track;
}

/**
 * Update track (autosave)
 * Automatically triggers key facts regeneration when content changes
 */
export async function updateTrack(input: UpdateTrackInput) {
  const { id, ...updateData } = input;

  // Update the track
  const { data: track, error } = await supabase
    .from('tracks')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  
  // Auto-regenerate facts if content changed
  if (updateData.description && track.type === 'article') {
    console.log('🔍 Checking if facts need regeneration...');
    
    // Dynamic import to avoid circular dependencies
    import('../../utils/hash').then(async ({ sha256, stripMarkdown }) => {
      const plainText = stripMarkdown(updateData.description || '');
      const newContentHash = await sha256(plainText);
      
      // Check word count (minimum 150 words)
      const wordCount = plainText.split(/\s+/).filter(w => w.length > 0).length;
      if (wordCount < 150) {
        console.log(`⚠️ Article too short (${wordCount} words), skipping facts regeneration`);
        return;
      }
      
      // Check if content actually changed (compare to stored hash if it exists)
      const storedHash = track.facts_content_hash || null;
      if (storedHash && storedHash === newContentHash) {
        console.log('✓ Content unchanged, skipping facts regeneration');
        return;
      }
      
      console.log('🔄 Content changed, regenerating facts...');
      
      // Call the facts extraction endpoint
      const { projectId, publicAnonKey } = await import('../../utils/supabase/info');
      
      fetch(`https://${projectId}.supabase.co/functions/v1/make-server-2858cc8b/generate-key-facts`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
          trackId: id,
          trackType: 'track',
          title: track.title || '',
          description: updateData.description || '',
          content: plainText
        })
      })
      .then(async (res) => {
        if (res.ok) {
          const result = await res.json();
          console.log(`✅ Facts regenerated: ${result.enriched?.length || 0} facts extracted`);
          
          // Try to update the hash (gracefully handle missing column)
          try {
            await supabase.from('tracks').update({
              facts_content_hash: newContentHash,
              facts_generated_at: new Date().toISOString()
            }).eq('id', id);
          } catch (hashError) {
            console.log('⚠️ Could not update hash (column may not exist)');
          }
        } else {
          const errorData = await res.json().catch(() => ({}));
          console.error('❌ Failed to regenerate facts:', errorData.error || res.statusText);
        }
      })
      .catch(err => console.error('❌ Failed to regenerate facts:', err.message));
    }).catch(err => console.error('❌ Failed to import hash utilities:', err));
  }
  
  return track;
}

/**
 * Publish a track (change status from draft to published)
 */
export async function publishTrack(trackId: string) {
  return updateTrack({ id: trackId, status: 'published' });
}

/**
 * Archive a track
 */
export async function archiveTrack(trackId: string) {
  return updateTrack({ id: trackId, status: 'archived' });
}

/**
 * Delete a track
 */
export async function deleteTrack(trackId: string) {
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
    console.warn('Could not find latest version, returning requested track');
    return { track, isLatest: false, latestTrackId: trackId };
  }
  
  console.log(`🔄 Redirecting from version ${track.version_number} to latest version ${latestTrack.version_number}`);
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

  if (filters.status) {
    if (filters.status === 'archived') {
      // For archived view, just show tracks with status='archived'
      query = query.eq('status', 'archived');
    } else if (filters.status === 'drafts') {
      // For drafts view, show tracks with status='draft'
      query = query.eq('status', 'draft');
    } else if (filters.status === 'in-kb') {
      // For Knowledge Base view, show tracks that have show_in_knowledge_base tag
      // This will be post-filtered after fetching since we need to check tags array
      query = query.eq('status', 'published');
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
      console.log('Versioning columns not yet added. Please run migration.');
    }
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    // If error is about missing column, just log it and continue
    if (error.code === '42703') {
      console.warn('⚠️ Some database columns are missing. Continuing without advanced filters.');
      console.log('💡 To enable all features, run migrations from MIGRATION_INSTRUCTIONS.md');
      
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
      
      if (filters.status) {
        simpleQuery.eq('status', filters.status);
      }
      
      if (filters.search) {
        simpleQuery.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }
      
      const { data: retryData, error: retryError } = await simpleQuery.order('created_at', { ascending: false });
      
      if (retryError) throw retryError;
      
      return retryData || [];
    }
    throw error;
  }

  let filteredData = data || [];

  // Filter by tags if provided (client-side for now)
  if (filters.tags && filters.tags.length > 0) {
    filteredData = filteredData.filter(track => {
      const trackTags = track.track_tags?.map((tt: any) => tt.tags.name) || [];
      const columnTags = track.tags || [];
      const allTags = [...trackTags, ...columnTags];
      return filters.tags!.some(tag => allTags.includes(tag));
    });
  }

  // Filter by Knowledge Base status (client-side)
  if (filters.status === 'in-kb') {
    filteredData = filteredData.filter(track => {
      const columnTags = track.tags || [];
      return columnTags.includes('system:show_in_knowledge_base') || track.show_in_knowledge_base === true;
    });
  }

  return filteredData;
}

/**
 * Upload track media (video, thumbnail, etc.)
 */
export async function uploadTrackMedia(
  trackId: string,
  file: File,
  type: 'content' | 'thumbnail'
): Promise<string> {
  // Upload through server to avoid RLS issues
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${SERVER_URL}/upload-media`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${publicAnonKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload file');
  }

  const data = await response.json();
  const url = data.url;

  // Update track with new URL
  const updateData = type === 'content' 
    ? { content_url: url }
    : { thumbnail_url: url };

  await updateTrack({ id: trackId, ...updateData });

  return url;
}

/**
 * Upload track file using server endpoint (for articles, PDFs, etc.)
 */
export async function uploadTrackFile(trackId: string, file: File): Promise<{ url: string; fileName: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${SERVER_URL}/upload-media`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${publicAnonKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload file');
  }

  const data = await response.json();
  return {
    url: data.url,
    fileName: data.fileName
  };
}

/**
 * Increment track view count
 */
export async function incrementTrackViews(trackId: string) {
  const { error } = await supabase.rpc('increment_track_views', {
    track_id: trackId
  });

  // If RPC doesn't exist, fall back to manual increment
  if (error) {
    const { data: track } = await supabase
      .from('tracks')
      .select('view_count')
      .eq('id', trackId)
      .single();

    if (track) {
      await supabase
        .from('tracks')
        .update({ view_count: (track.view_count || 0) + 1 })
        .eq('id', trackId);
    }
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
// ALBUMS CRUD OPERATIONS
// ============================================================================

/**
 * Get all albums for organization with filters
 */
export async function getAlbums(filters: {
  status?: string;
  search?: string;
  tags?: string[];
  ids?: string[]; // Filter by specific IDs
} = {}) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  let query = supabase
    .from('albums')
    .select(`
      *,
      album_tracks (
        id,
        track:tracks (
          id,
          title,
          type,
          duration_minutes
        )
      )
    `)
    .eq('organization_id', orgId);

  if (filters.ids && filters.ids.length > 0) {
    query = query.in('id', filters.ids);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;

  // Enrich with track counts and duration
  const enrichedAlbums = (data || []).map(album => ({
    ...album,
    trackCount: album.album_tracks?.length || 0,
    duration_minutes: album.album_tracks?.reduce((sum: number, at: any) => 
      sum + (at.track?.duration_minutes || 0), 0
    ) || 0,
  }));

  return enrichedAlbums;
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
    console.log('🔍 getTrackVersions: Fetching versions for track:', trackId);
    const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-2858cc8b/track-versions/${trackId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Server error');
    }

    const data = await response.json();
    console.log('✅ getTrackVersions: Received data:', data);
    console.log('✅ getTrackVersions: Returning versions:', data.versions || []);
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

  console.log(`🔄 Creating version ${nextVersion} from version ${currentVersion} (parent: ${parentId})`);

  // SAFETY CHECK: Prevent duplicate versions
  // Check if the next version already exists
  const { data: existingVersion } = await supabase
    .from('videos')
    .select('id, version_number')
    .eq('parent_track_id', parentId)
    .eq('version_number', nextVersion)
    .maybeSingle();

  if (existingVersion) {
    console.warn(`⚠️ Version ${nextVersion} already exists (ID: ${existingVersion.id}). Returning existing version.`);
    return existingVersion;
  }

  // Create new version
  const newVersionData: CreateTrackInput = {
    ...originalTrack,
    ...updates,
    parent_track_id: parentId,
    version_number: nextVersion,
    version_notes: versionNotes,
    is_latest_version: true,
    status: 'published' // New version is published
  };

  const newVersion = await createTrack(newVersionData);
  console.log(`✅ Created version ${nextVersion} with ID: ${newVersion.id}`);

  // Mark old version as no longer latest
  await updateTrack({
    id: originalTrackId,
    is_latest_version: false
  });
  console.log(`✅ Marked version ${currentVersion} (ID: ${originalTrackId}) as no longer latest`);

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
  console.log('🔍 getTrackAssignmentStats - Checking stats for track:', trackId);
  
  // Get all playlist assignments for this track
  const { data: playlistTracks, error: playlistError } = await supabase
    .from('playlist_tracks')
    .select('playlist_id')
    .eq('track_id', trackId);

  console.log('🔍 Playlist tracks found:', playlistTracks);
  console.log('🔍 Playlist tracks error:', playlistError);

  if (!playlistTracks || playlistTracks.length === 0) {
    console.log('🔍 No playlists found for this track');
    return { 
      pendingCount: 0, 
      completedCount: 0, 
      totalAssignments: 0,
      playlistCount: 0 
    };
  }

  const playlistIds = playlistTracks.map(pt => pt.playlist_id);
  console.log('🔍 Playlist IDs to check:', playlistIds);

  // Query the assignments table using the ACTUAL schema (playlist_id, user_id, status='assigned')
  const { data: assignments, error: assignmentsError } = await supabase
    .from('assignments')
    .select('id, status, playlist_id, user_id, completed_at, progress_percent')
    .in('playlist_id', playlistIds)
    .eq('status', 'assigned');

  console.log('🔍 Full query details:');
  console.log('   - playlist_id IN:', playlistIds);
  console.log('   - status: assigned');
  console.log('🔍 Assignments found:', assignments);
  console.log('🔍 Assignments count:', assignments?.length);
  console.log('🔍 Assignments error:', assignmentsError);

  if (!assignments || assignments.length === 0) {
    console.log('🔍 No assignments found for these playlists - checking if ANY assignments exist');
    
    // Debug query: Check if ANY assignments exist for these playlists (without filters)
    const { data: allAssignments, error: allError } = await supabase
      .from('assignments')
      .select('*')
      .in('playlist_id', playlistIds);
    
    console.log('🔍 ALL assignments (no filter):', allAssignments);
    console.log('🔍 ALL assignments error:', allError);
    
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

  const stats = {
    pendingCount,
    completedCount,
    totalAssignments,
    playlistCount: playlistTracks.length
  };
  
  console.log('🔍 Final stats:', stats);
  
  return stats;
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