// ============================================================================
// ALBUMS CRUD OPERATIONS
// ============================================================================

import { supabase, getCurrentUserOrgId, getCurrentUserProfile } from '../supabase';
import { logActivity } from './activity';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Album {
  id: string;
  organization_id: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  status: 'draft' | 'published' | 'archived';
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Computed fields
  track_count?: number;
  total_duration_minutes?: number;
  tracks?: AlbumTrack[];
}

export interface AlbumTrack {
  album_id: string;
  track_id: string;
  display_order: number;
  is_required: boolean;
  unlock_previous: boolean;
  // Joined track data
  track?: {
    id: string;
    title: string;
    type: string;
    duration_minutes?: number;
    thumbnail_url?: string;
    status: string;
  };
}

export interface CreateAlbumInput {
  title: string;
  organization_id: string;
  description?: string;
  thumbnail_url?: string;
  status?: 'draft' | 'published' | 'archived';
  created_by?: string;
}

export interface UpdateAlbumInput {
  id: string;
  title?: string;
  description?: string;
  thumbnail_url?: string;
  status?: 'draft' | 'published' | 'archived';
}

// ============================================================================
// ALBUM CRUD OPERATIONS
// ============================================================================

/**
 * Get all albums for organization with filtering options
 * Returns albums with track_count and total_duration_minutes
 */
export async function getAlbums(options: {
  status?: 'draft' | 'published' | 'archived';
  search?: string;
  organizationId?: string;
} = {}) {
  const orgId = options.organizationId || await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  let query = supabase
    .from('albums')
    .select(`
      *,
      album_tracks (
        track_id,
        display_order,
        is_required,
        unlock_previous,
        track:tracks (
          id,
          title,
          type,
          duration_minutes,
          thumbnail_url,
          status
        )
      )
    `)
    .eq('organization_id', orgId);

  if (options.status) {
    query = query.eq('status', options.status);
  }

  if (options.search) {
    query = query.or(`title.ilike.%${options.search}%,description.ilike.%${options.search}%`);
  }

  const { data: albums, error } = await query.order('updated_at', { ascending: false });

  if (error) throw error;

  // Enrich with computed fields and transform album_tracks to tracks
  const enrichedAlbums = (albums || []).map((album: any) => {
    const albumTracks = album.album_tracks || [];
    // Sort tracks by display_order
    const sortedTracks = albumTracks
      .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));
    const trackCount = sortedTracks.length;
    const totalDurationMinutes = sortedTracks.reduce((sum: number, at: any) => 
      sum + (at.track?.duration_minutes || 0), 0
    );

    return {
      ...album,
      tracks: sortedTracks as AlbumTrack[],
      track_count: trackCount,
      total_duration_minutes: totalDurationMinutes,
    };
  });

  return enrichedAlbums as Album[];
}

/**
 * Get a single album by ID with nested tracks
 * Tracks are ordered by display_order
 */
export async function getAlbumById(albumId: string): Promise<Album | null> {
  const { data: album, error } = await supabase
    .from('albums')
    .select(`
      *,
      album_tracks (
        album_id,
        track_id,
        display_order,
        is_required,
        unlock_previous,
        track:tracks (
          id,
          title,
          type,
          duration_minutes,
          thumbnail_url,
          status
        )
      ),
      created_by_user:users!albums_created_by_fkey(id, first_name, last_name, email)
    `)
    .eq('id', albumId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }

  // Sort tracks by display_order
  const sortedTracks = (album.album_tracks || [])
    .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));

  // Calculate total duration
  const totalDurationMinutes = sortedTracks.reduce((sum: number, at: any) => 
    sum + (at.track?.duration_minutes || 0), 0
  );

  const result = {
    ...album,
    tracks: sortedTracks as AlbumTrack[],
    track_count: sortedTracks.length,
    total_duration_minutes: totalDurationMinutes,
  } as Album;

  return result;
}

/**
 * Create a new album
 */
export async function createAlbum(data: CreateAlbumInput): Promise<Album> {
  // Input validation
  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    throw new Error('Invalid title: must be a non-empty string');
  }
  if (!data.organization_id) {
    throw new Error('Invalid organization_id: required field');
  }
  if (data.status && !['draft', 'published', 'archived'].includes(data.status)) {
    throw new Error('Invalid status: must be "draft", "published", or "archived"');
  }

  const userProfile = await getCurrentUserProfile();

  const { data: album, error } = await supabase
    .from('albums')
    .insert({
      organization_id: data.organization_id,
      title: data.title.trim(),
      description: data.description,
      thumbnail_url: data.thumbnail_url,
      status: data.status || 'draft',
      created_by: data.created_by || userProfile?.id,
    })
    .select()
    .single();

  if (error) throw error;

  // Log activity (non-critical)
  if (userProfile) {
    try {
      await logActivity({
        user_id: userProfile.id,
        action: 'create',
        entity_type: 'album',
        entity_id: album.id,
        description: `Created album "${data.title}"`,
      });
    } catch (activityError) {
      console.error('Failed to log album creation activity:', activityError);
    }
  }

  return {
    ...album,
    track_count: 0,
    total_duration_minutes: 0,
    tracks: [],
  } as Album;
}

/**
 * Update an existing album
 */
export async function updateAlbum(data: UpdateAlbumInput): Promise<Album> {
  // Input validation
  if (!data.id || typeof data.id !== 'string') {
    throw new Error('Invalid id: must be a non-empty string');
  }
  if (data.title !== undefined && (typeof data.title !== 'string' || data.title.trim().length === 0)) {
    throw new Error('Invalid title: must be a non-empty string');
  }
  if (data.status && !['draft', 'published', 'archived'].includes(data.status)) {
    throw new Error('Invalid status: must be "draft", "published", or "archived"');
  }

  const userProfile = await getCurrentUserProfile();

  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (data.title !== undefined) updateData.title = data.title.trim();
  if (data.description !== undefined) updateData.description = data.description;
  if (data.thumbnail_url !== undefined) updateData.thumbnail_url = data.thumbnail_url;
  if (data.status !== undefined) updateData.status = data.status;

  const { data: album, error } = await supabase
    .from('albums')
    .update(updateData)
    .eq('id', data.id)
    .select()
    .single();

  if (error) throw error;

  // Log activity (non-critical)
  if (userProfile) {
    try {
      await logActivity({
        user_id: userProfile.id,
        action: 'update',
        entity_type: 'album',
        entity_id: album.id,
        description: `Updated album "${album.title}"`,
      });
    } catch (activityError) {
      console.error('Failed to log album update activity:', activityError);
    }
  }

  // Fetch full album with tracks to return
  return getAlbumById(data.id) as Promise<Album>;
}

/**
 * Delete an album (cascade deletes album_tracks entries via DB constraint)
 */
export async function deleteAlbum(albumId: string): Promise<boolean> {
  if (!albumId || typeof albumId !== 'string') {
    throw new Error('Invalid albumId: must be a non-empty string');
  }

  const userProfile = await getCurrentUserProfile();

  // Get album title for logging before deletion
  const { data: album } = await supabase
    .from('albums')
    .select('title')
    .eq('id', albumId)
    .single();

  const { error } = await supabase
    .from('albums')
    .delete()
    .eq('id', albumId);

  if (error) throw error;

  // Log activity (non-critical)
  if (userProfile && album) {
    try {
      await logActivity({
        user_id: userProfile.id,
        action: 'delete',
        entity_type: 'album',
        entity_id: albumId,
        description: `Deleted album "${album.title}"`,
      });
    } catch (activityError) {
      console.error('Failed to log album deletion activity:', activityError);
    }
  }

  return true;
}

// ============================================================================
// ALBUM TRACKS OPERATIONS
// ============================================================================

/**
 * Add tracks to an album
 * Auto-calculates display_order starting from startOrder or max+1
 * Skips duplicates (tracks already in album)
 */
export async function addTracksToAlbum(
  albumId: string, 
  trackIds: string[], 
  startOrder?: number
): Promise<Album> {
  if (!albumId || typeof albumId !== 'string') {
    throw new Error('Invalid albumId: must be a non-empty string');
  }
  if (!Array.isArray(trackIds) || trackIds.length === 0) {
    throw new Error('Invalid trackIds: must be a non-empty array of strings');
  }

  // Get existing tracks in album to avoid duplicates
  const { data: existingTracks } = await supabase
    .from('album_tracks')
    .select('track_id, display_order')
    .eq('album_id', albumId)
    .order('display_order', { ascending: false });

  const existingTrackIds = new Set((existingTracks || []).map((at: any) => at.track_id));
  const maxOrder = existingTracks?.[0]?.display_order || 0;
  
  // Filter out duplicates
  const newTrackIds = trackIds.filter(id => !existingTrackIds.has(id));
  
  if (newTrackIds.length === 0) {
    // All tracks are duplicates, return current album state
    return getAlbumById(albumId) as Promise<Album>;
  }

  // Calculate starting order
  const orderStart = startOrder ?? maxOrder + 1;

  // Create album_tracks records
  const albumTrackRecords = newTrackIds.map((trackId, index) => ({
    album_id: albumId,
    track_id: trackId,
    display_order: orderStart + index,
    is_required: true,
    unlock_previous: false,
  }));

  const { error } = await supabase
    .from('album_tracks')
    .insert(albumTrackRecords);

  if (error) throw error;

  // Update album's updated_at timestamp
  await supabase
    .from('albums')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', albumId);

  const result = await getAlbumById(albumId) as Promise<Album>;

  return result;
}

/**
 * Remove a single track from an album
 * Reorders remaining tracks to close gaps
 */
export async function removeTrackFromAlbum(
  albumId: string, 
  trackId: string
): Promise<Album> {
  if (!albumId || typeof albumId !== 'string') {
    throw new Error('Invalid albumId: must be a non-empty string');
  }
  if (!trackId || typeof trackId !== 'string') {
    throw new Error('Invalid trackId: must be a non-empty string');
  }

  // Delete the track from album
  const { error } = await supabase
    .from('album_tracks')
    .delete()
    .eq('album_id', albumId)
    .eq('track_id', trackId);

  if (error) throw error;

  // Get remaining tracks and reorder to close gaps
  const { data: remainingTracks } = await supabase
    .from('album_tracks')
    .select('track_id, display_order')
    .eq('album_id', albumId)
    .order('display_order', { ascending: true });

  if (remainingTracks && remainingTracks.length > 0) {
    // Reorder remaining tracks sequentially starting from 1
    for (let i = 0; i < remainingTracks.length; i++) {
      const newOrder = i + 1;
      if (remainingTracks[i].display_order !== newOrder) {
        await supabase
          .from('album_tracks')
          .update({ display_order: newOrder })
          .eq('album_id', albumId)
          .eq('track_id', remainingTracks[i].track_id);
      }
    }
  }

  // Update album's updated_at timestamp
  await supabase
    .from('albums')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', albumId);

  return getAlbumById(albumId) as Promise<Album>;
}

/**
 * Reorder tracks in an album
 * Accepts array of track IDs in desired order
 */
export async function reorderAlbumTracks(
  albumId: string, 
  trackIds: string[]
): Promise<Album> {
  if (!albumId || typeof albumId !== 'string') {
    throw new Error('Invalid albumId: must be a non-empty string');
  }
  if (!Array.isArray(trackIds) || trackIds.length === 0) {
    throw new Error('Invalid trackIds: must be a non-empty array of strings');
  }

  // Update display_order for each track based on position in array
  for (let i = 0; i < trackIds.length; i++) {
    const { error } = await supabase
      .from('album_tracks')
      .update({ display_order: i + 1 })
      .eq('album_id', albumId)
      .eq('track_id', trackIds[i]);

    if (error) throw error;
  }

  // Update album's updated_at timestamp
  await supabase
    .from('albums')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', albumId);

  return getAlbumById(albumId) as Promise<Album>;
}

/**
 * Update track settings in an album (is_required, unlock_previous)
 */
export async function updateAlbumTrack(
  albumId: string,
  trackId: string,
  settings: { is_required?: boolean; unlock_previous?: boolean }
): Promise<AlbumTrack> {
  if (!albumId || !trackId) {
    throw new Error('albumId and trackId are required');
  }

  const { data, error } = await supabase
    .from('album_tracks')
    .update(settings)
    .eq('album_id', albumId)
    .eq('track_id', trackId)
    .select(`
      album_id,
      track_id,
      display_order,
      is_required,
      unlock_previous,
      track:tracks (
        id,
        title,
        type,
        duration_minutes,
        thumbnail_url,
        status
      )
    `)
    .single();

  if (error) throw error;

  return data as AlbumTrack;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get most recently updated albums (for sidebar "Active Albums" section)
 */
export async function getRecentAlbums(limit: number = 4): Promise<Album[]> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const { data: albums, error } = await supabase
    .from('albums')
    .select(`
      *,
      album_tracks (
        track_id,
        track:tracks (
          duration_minutes
        )
      )
    `)
    .eq('organization_id', orgId)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  // Enrich with computed fields
  const enrichedAlbums = (albums || []).map((album: any) => {
    const albumTracks = album.album_tracks || [];
    const trackCount = albumTracks.length;
    const totalDurationMinutes = albumTracks.reduce((sum: number, at: any) => 
      sum + (at.track?.duration_minutes || 0), 0
    );

    return {
      ...album,
      track_count: trackCount,
      total_duration_minutes: totalDurationMinutes,
    };
  });

  return enrichedAlbums as Album[];
}

/**
 * Duplicate an album with all its tracks
 */
export async function duplicateAlbum(albumId: string): Promise<Album> {
  const orgId = await getCurrentUserOrgId();
  const userProfile = await getCurrentUserProfile();
  
  if (!orgId || !userProfile) throw new Error('User not authenticated');

  // Get original album with tracks
  const original = await getAlbumById(albumId);
  if (!original) throw new Error('Album not found');

  // Create new album
  const { data: newAlbum, error: albumError } = await supabase
    .from('albums')
    .insert({
      organization_id: orgId,
      title: `${original.title} (Copy)`,
      description: original.description,
      thumbnail_url: original.thumbnail_url,
      status: 'draft',
      created_by: userProfile.id,
    })
    .select()
    .single();

  if (albumError) throw albumError;

  // Copy album tracks
  if (original.tracks && original.tracks.length > 0) {
    const trackRecords = original.tracks.map((at: AlbumTrack) => ({
      album_id: newAlbum.id,
      track_id: at.track_id,
      display_order: at.display_order,
      is_required: at.is_required,
      unlock_previous: at.unlock_previous,
    }));

    const { error: tracksError } = await supabase
      .from('album_tracks')
      .insert(trackRecords);

    if (tracksError) throw tracksError;
  }

  // Log activity (non-critical)
  try {
    await logActivity({
      user_id: userProfile.id,
      action: 'duplicate',
      entity_type: 'album',
      entity_id: newAlbum.id,
      description: `Duplicated album "${original.title}"`,
    });
  } catch (activityError) {
    console.error('Failed to log album duplication activity:', activityError);
  }

  return getAlbumById(newAlbum.id) as Promise<Album>;
}

/**
 * Archive an album
 */
export async function archiveAlbum(albumId: string): Promise<Album> {
  return updateAlbum({ id: albumId, status: 'archived' });
}

/**
 * Publish an album
 */
export async function publishAlbum(albumId: string): Promise<Album> {
  return updateAlbum({ id: albumId, status: 'published' });
}

/**
 * Unarchive an album (set back to draft)
 */
export async function unarchiveAlbum(albumId: string): Promise<Album> {
  return updateAlbum({ id: albumId, status: 'draft' });
}

