// ============================================================================
// TRACKS CRUD OPERATIONS
// ============================================================================

import { supabase, getCurrentUserOrgId, uploadFile, deleteFile } from '../supabase';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

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
      is_system_content: input.is_system_content || false
    })
    .select()
    .single();

  if (error) throw error;

  return track;
}

/**
 * Update track (autosave)
 */
export async function updateTrack(input: UpdateTrackInput) {
  const { id, ...updateData } = input;

  const { data: track, error } = await supabase
    .from('tracks')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
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
  const { error } = await supabase
    .from('tracks')
    .delete()
    .eq('id', trackId);

  if (error) throw error;
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
 * Get all tracks for organization with filters
 */
export async function getTracks(filters: {
  type?: string;
  status?: string;
  search?: string;
  tags?: string[];
} = {}) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  let query = supabase
    .from('tracks')
    .select('*')
    .eq('organization_id', orgId);

  if (filters.type) {
    query = query.eq('type', filters.type);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;

  // Filter by tags if provided (client-side for now)
  if (filters.tags && filters.tags.length > 0) {
    return data.filter(track => {
      const trackTags = track.track_tags?.map((tt: any) => tt.tags.name) || [];
      return filters.tags!.some(tag => trackTags.includes(tag));
    });
  }

  return data;
}

/**
 * Upload track media (video, thumbnail, etc.)
 */
export async function uploadTrackMedia(
  trackId: string,
  file: File,
  type: 'content' | 'thumbnail'
): Promise<string> {
  const orgId = await getCurrentUserOrgId();
  const bucket = 'track-media';
  const path = `${orgId}/${trackId}/${type}/${file.name}`;

  const { url, error } = await uploadFile(bucket, path, file);
  if (error) throw error;
  if (!url) throw new Error('Failed to upload file');

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