// ============================================================================
// TRACKS CRUD OPERATIONS
// ============================================================================

import { supabase, getCurrentUserOrgId, uploadFile, deleteFile } from '../supabase';

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

  const { data: user } = await supabase.auth.getUser();
  
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
      author_id: user.data.user?.id
    })
    .select()
    .single();

  if (error) throw error;

  // Add learning objectives if provided
  if (input.learning_objectives && input.learning_objectives.length > 0) {
    await addLearningObjectives(track.id, input.learning_objectives);
  }

  // Add tags if provided
  if (input.tags && input.tags.length > 0) {
    await addTrackTags(track.id, input.tags);
  }

  return track;
}

/**
 * Update track (autosave)
 */
export async function updateTrack(input: UpdateTrackInput) {
  const { id, learning_objectives, tags, ...updateData } = input;

  const { data: track, error } = await supabase
    .from('tracks')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Update learning objectives if provided
  if (learning_objectives !== undefined) {
    // Remove existing
    await supabase.from('learning_objectives').delete().eq('track_id', id);
    // Add new
    if (learning_objectives.length > 0) {
      await addLearningObjectives(id, learning_objectives);
    }
  }

  // Update tags if provided
  if (tags !== undefined) {
    await supabase.from('track_tags').delete().eq('track_id', id);
    if (tags.length > 0) {
      await addTrackTags(id, tags);
    }
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
    .select(`
      *,
      author:users(id, name, email),
      learning_objectives(*),
      track_tags(tags(*))
    `)
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
    .select(`
      *,
      author:users(id, name),
      learning_objectives(*),
      track_tags(tags(name))
    `)
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
