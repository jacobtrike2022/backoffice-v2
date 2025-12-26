// ============================================================================
// PLAYLISTS CRUD OPERATIONS
// ============================================================================

import { supabase, getCurrentUserOrgId, getCurrentUserProfile } from '../supabase';
import { logActivity } from './activity';

export interface CreatePlaylistInput {
  title: string;
  description?: string;
  type: 'manual' | 'auto';
  trigger_rules?: any;
  release_type: 'immediate' | 'progressive';
  release_schedule?: any;
  album_ids?: string[];
  track_ids?: string[];
}

export interface UpdatePlaylistInput {
  title?: string;
  description?: string;
  type?: 'manual' | 'auto';
  trigger_rules?: any;
  release_type?: 'immediate' | 'progressive';
  release_schedule?: any;
  is_active?: boolean;
  album_ids?: string[];
  track_ids?: string[];
}

/**
 * Get all playlists with enriched data
 */
export async function getPlaylists(filters: {
  type?: 'manual' | 'auto';
  is_active?: boolean;
  search?: string;
} = {}) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  let query = supabase
    .from('playlists')
    .select(`
      *,
      created_by_user:users!playlists_created_by_fkey(id, first_name, last_name)
    `)
    .eq('organization_id', orgId);

  if (filters.type) {
    query = query.eq('type', filters.type);
  }

  if (filters.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }

  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  const { data: playlists, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;

  // Early return if no playlists
  if (!playlists || playlists.length === 0) {
    return [];
  }

  // Extract all playlist IDs for batched queries
  const playlistIds = playlists.map((p: any) => p.id);

  // Batch query 1: Get all album counts for all playlists at once
  const { data: allPlaylistAlbums } = await supabase
    .from('playlist_albums')
    .select('playlist_id')
    .in('playlist_id', playlistIds);

  // Batch query 2: Get all track data for all playlists at once
  const { data: allPlaylistTracks } = await supabase
    .from('playlist_tracks')
    .select('playlist_id, track_id, display_order')
    .in('playlist_id', playlistIds)
    .order('display_order', { ascending: true });

  // Batch query 3: Get all assignments for all playlists at once
  const { data: allAssignments } = await supabase
    .from('assignments')
    .select('id, playlist_id, user_id, progress_percent, status')
    .in('playlist_id', playlistIds)
    .in('status', ['assigned', 'in_progress', 'completed']);

  // Batch query 4: Get all track completions for users with assignments
  const userIds = [...new Set((allAssignments || []).map((a: any) => a.user_id).filter(Boolean))];
  const { data: allCompletions } = await supabase
    .from('track_completions')
    .select('track_id, user_id, status')
    .in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

  // Build lookup maps
  const albumCountByPlaylist: Record<string, number> = {};
  (allPlaylistAlbums as any[])?.forEach((pa: any) => {
    albumCountByPlaylist[pa.playlist_id] = (albumCountByPlaylist[pa.playlist_id] || 0) + 1;
  });

  const tracksByPlaylist: Record<string, { track_id: string; display_order: number }[]> = {};
  (allPlaylistTracks as any[])?.forEach((pt: any) => {
    if (!tracksByPlaylist[pt.playlist_id]) {
      tracksByPlaylist[pt.playlist_id] = [];
    }
    if (pt.track_id) {
      tracksByPlaylist[pt.playlist_id].push({
        track_id: pt.track_id,
        display_order: pt.display_order || 0,
      });
    }
  });

  // Sort tracks by display_order for each playlist
  Object.keys(tracksByPlaylist).forEach(playlistId => {
    tracksByPlaylist[playlistId].sort((a, b) => a.display_order - b.display_order);
  });

  const trackCountByPlaylist: Record<string, number> = {};
  Object.keys(tracksByPlaylist).forEach(playlistId => {
    trackCountByPlaylist[playlistId] = tracksByPlaylist[playlistId].length;
  });

  const assignmentsByPlaylist: Record<string, { user_id: string; progress_percent: number; status: string }[]> = {};
  (allAssignments as any[])?.forEach((a: any) => {
    if (!assignmentsByPlaylist[a.playlist_id]) {
      assignmentsByPlaylist[a.playlist_id] = [];
    }
    assignmentsByPlaylist[a.playlist_id].push({
      user_id: a.user_id,
      progress_percent: a.progress_percent || 0,
      status: a.status,
    });
  });

  const assignmentCountByPlaylist: Record<string, number> = {};
  Object.keys(assignmentsByPlaylist).forEach(playlistId => {
    assignmentCountByPlaylist[playlistId] = assignmentsByPlaylist[playlistId].length;
  });

  // Build completion map: user_id -> set of completed track_ids
  const completionsByUser: Record<string, Set<string>> = {};
  (allCompletions || []).forEach((c: any) => {
    if (!completionsByUser[c.user_id]) {
      completionsByUser[c.user_id] = new Set();
    }
    if (c.status === 'completed' || c.status === 'passed') {
      completionsByUser[c.user_id].add(c.track_id);
    }
  });

  // Enrich each playlist with data from lookup maps
  const enrichedPlaylists = playlists.map((playlist: any) => {
    const playlistTracks = tracksByPlaylist[playlist.id] || [];
    const track_ids = playlistTracks.map((pt: any) => pt.track_id).filter(Boolean);
    const requiredTrackIds = new Set(track_ids);
    
    const assignments = assignmentsByPlaylist[playlist.id] || [];
    const totalAssignments = assignments.length;
    
    // Calculate completion rate based on track_completions
    // A user has "completed" the playlist if they've completed all tracks in it
    let completedUsers = 0;
    assignments.forEach((assignment: any) => {
      const userCompletions = completionsByUser[assignment.user_id] || new Set();
      // Check if user has completed all required tracks
      const hasCompletedAll = track_ids.length > 0 && 
        track_ids.every(trackId => userCompletions.has(trackId));
      if (hasCompletedAll) {
        completedUsers++;
      }
    });
    
    const completionRate = totalAssignments > 0 
      ? Math.round((completedUsers / totalAssignments) * 100)
      : 0;

    const avgProgress = totalAssignments > 0
      ? Math.round(
          assignments.reduce((sum: number, a: any) => sum + (a.progress_percent || 0), 0) / totalAssignments
        )
      : 0;

    return {
      ...playlist,
      album_count: albumCountByPlaylist[playlist.id] || 0,
      track_count: trackCountByPlaylist[playlist.id] || 0,
      assignment_count: assignmentCountByPlaylist[playlist.id] || 0,
      completion_rate: completionRate,
      avg_progress: avgProgress,
      track_ids,
    };
  });

  return enrichedPlaylists;
}

/**
 * Get a single playlist by ID with full details
 */
export async function getPlaylistById(playlistId: string) {
  const { data: playlist, error } = await supabase
    .from('playlists')
    .select(`
      *,
      created_by_user:users!playlists_created_by_fkey(id, first_name, last_name, email)
    `)
    .eq('id', playlistId)
    .single();

  if (error) throw error;

  // Get albums in this playlist
  const { data: playlistAlbums } = await supabase
    .from('playlist_albums')
    .select(`
      id,
      display_order,
      release_stage,
      albums(
        id,
        title,
        description,
        thumbnail_url,
        duration_minutes
      )
    `)
    .eq('playlist_id', playlistId)
    .order('display_order');

  // Get standalone tracks in this playlist
  const { data: playlistTracks } = await supabase
    .from('playlist_tracks')
    .select(`
      id,
      display_order,
      release_stage,
      tracks(
        id,
        title,
        description,
        duration_minutes,
        type
      )
    `)
    .eq('playlist_id', playlistId)
    .order('display_order');

  // Get assignments stats
  const { count: assignmentCount } = await supabase
    .from('assignments')
    .select('id', { count: 'exact', head: true })
    .eq('playlist_id', playlistId)
    .in('status', ['assigned', 'in_progress', 'completed']);

  // Normalize response structure - Supabase may return albums/tracks under different keys
  // Normalize to always use 'album' and 'track' keys for consistency
  const normalizedAlbums = (playlistAlbums || []).map((pa: any) => ({
    ...pa,
    album: pa.albums || pa.album, // Support both structures
  }));
  
  const normalizedTracks = (playlistTracks || []).map((pt: any) => ({
    ...pt,
    track: pt.tracks || pt.track, // Support both structures
  }));

  // Extract album and track IDs for easier access
  const album_ids = normalizedAlbums.map((pa: any) => pa.album?.id).filter(Boolean) || [];
  const track_ids = normalizedTracks.map((pt: any) => pt.track?.id).filter(Boolean) || [];

  return {
    ...playlist,
    albums: normalizedAlbums,
    tracks: normalizedTracks,
    album_ids,
    track_ids,
    assignment_count: assignmentCount || 0,
  };
}

/**
 * Create a new playlist
 */
export async function createPlaylist(input: CreatePlaylistInput) {
  // Input validation
  if (!input.title || typeof input.title !== 'string' || input.title.trim().length === 0) {
    throw new Error('Invalid title: must be a non-empty string');
  }
  if (input.type && !['manual', 'auto'].includes(input.type)) {
    throw new Error('Invalid type: must be "manual" or "auto"');
  }
  if (input.release_type && !['immediate', 'progressive'].includes(input.release_type)) {
    throw new Error('Invalid release_type: must be "immediate" or "progressive"');
  }
  if (input.album_ids && (!Array.isArray(input.album_ids) || !input.album_ids.every(id => typeof id === 'string'))) {
    throw new Error('Invalid album_ids: must be an array of strings');
  }
  if (input.track_ids && (!Array.isArray(input.track_ids) || !input.track_ids.every(id => typeof id === 'string'))) {
    throw new Error('Invalid track_ids: must be an array of strings');
  }

  const orgId = await getCurrentUserOrgId();
  const userProfile = await getCurrentUserProfile();
  
  if (!orgId || !userProfile) throw new Error('User not authenticated');

  // Create the playlist
  const { data: playlist, error: playlistError } = await supabase
    .from('playlists')
    .insert({
      organization_id: orgId,
      title: input.title,
      description: input.description,
      type: input.type,
      trigger_rules: input.trigger_rules,
      release_type: input.release_type,
      release_schedule: input.release_schedule,
      is_active: true,
      created_by: userProfile.id,
    })
    .select()
    .single();

  if (playlistError) throw playlistError;

  // Add albums to playlist
  if (input.album_ids && input.album_ids.length > 0) {
    const albumRecords = input.album_ids.map((albumId, index) => ({
      playlist_id: playlist.id,
      album_id: albumId,
      display_order: index + 1,
      release_stage: 1,
    }));

    const { error: albumError } = await supabase
      .from('playlist_albums')
      .insert(albumRecords);

    if (albumError) throw albumError;
  }

  // Add standalone tracks to playlist
  if (input.track_ids && input.track_ids.length > 0) {
    const trackRecords = input.track_ids.map((trackId, index) => ({
      playlist_id: playlist.id,
      track_id: trackId,
      display_order: (input.album_ids?.length || 0) + index + 1,
      release_stage: 1,
    }));

    const { error: trackError } = await supabase
      .from('playlist_tracks')
      .insert(trackRecords);

    if (trackError) throw trackError;
  }

  // Log activity (non-critical - wrap in try-catch)
  try {
    await logActivity({
      user_id: userProfile.id,
      action: 'create',
      entity_type: 'playlist',
      entity_id: playlist.id,
      description: `Created playlist "${input.title}"`,
    });
  } catch (error) {
    // Log error but don't fail the playlist creation
    console.error('Failed to log playlist creation activity:', error);
  }

  return playlist;
}

/**
 * Update an existing playlist
 */
export async function updatePlaylist(playlistId: string, input: UpdatePlaylistInput) {
  // Input validation
  if (!playlistId || typeof playlistId !== 'string') {
    throw new Error('Invalid playlistId: must be a non-empty string');
  }
  if (input.title !== undefined && (typeof input.title !== 'string' || input.title.trim().length === 0)) {
    throw new Error('Invalid title: must be a non-empty string');
  }
  if (input.type && !['manual', 'auto'].includes(input.type)) {
    throw new Error('Invalid type: must be "manual" or "auto"');
  }
  if (input.release_type && !['immediate', 'progressive'].includes(input.release_type)) {
    throw new Error('Invalid release_type: must be "immediate" or "progressive"');
  }
  if (input.album_ids && (!Array.isArray(input.album_ids) || !input.album_ids.every(id => typeof id === 'string'))) {
    throw new Error('Invalid album_ids: must be an array of strings');
  }
  if (input.track_ids && (!Array.isArray(input.track_ids) || !input.track_ids.every(id => typeof id === 'string'))) {
    throw new Error('Invalid track_ids: must be an array of strings');
  }

  const userProfile = await getCurrentUserProfile();
  if (!userProfile) throw new Error('User not authenticated');

  // Extract album_ids and track_ids from input (they're not columns)
  const { album_ids, track_ids, ...playlistData } = input;

  // Update the playlist basic data
  const { data: playlist, error } = await supabase
    .from('playlists')
    .update({
      ...playlistData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', playlistId)
    .select()
    .single();

  if (error) throw error;

  // Handle album updates if provided
  if (album_ids !== undefined) {
    // Delete existing albums
    await supabase
      .from('playlist_albums')
      .delete()
      .eq('playlist_id', playlistId);

    // Add new albums
    if (album_ids.length > 0) {
      const albumRecords = album_ids.map((albumId, index) => ({
        playlist_id: playlistId,
        album_id: albumId,
        display_order: index + 1,
        release_stage: 1,
      }));

      const { error: albumError } = await supabase
        .from('playlist_albums')
        .insert(albumRecords);

      if (albumError) throw albumError;
    }
  }

  // Handle track updates if provided
  if (track_ids !== undefined) {
    // Delete existing tracks
    await supabase
      .from('playlist_tracks')
      .delete()
      .eq('playlist_id', playlistId);

    // Add new tracks
    if (track_ids.length > 0) {
      const trackRecords = track_ids.map((trackId, index) => ({
        playlist_id: playlistId,
        track_id: trackId,
        display_order: (album_ids?.length || 0) + index + 1,
        release_stage: 1,
      }));

      const { error: trackError } = await supabase
        .from('playlist_tracks')
        .insert(trackRecords);

      if (trackError) throw trackError;
    }
  }

  // Log activity (non-critical - wrap in try-catch)
  try {
    await logActivity({
      user_id: userProfile.id,
      action: 'update',
      entity_type: 'playlist',
      entity_id: playlistId,
      description: `Updated playlist "${playlist.title}"`,
    });
  } catch (error) {
    // Log error but don't fail the playlist update
    console.error('Failed to log playlist update activity:', error);
  }

  return playlist;
}

/**
 * Delete a playlist (hard delete)
 */
export async function deletePlaylist(playlistId: string) {
  const userProfile = await getCurrentUserProfile();
  if (!userProfile) throw new Error('User not authenticated');

  // Get playlist title for logging
  const { data: playlist } = await supabase
    .from('playlists')
    .select('title')
    .eq('id', playlistId)
    .single();

  // Delete playlist (cascade will handle playlist_albums and playlist_tracks)
  const { error } = await supabase
    .from('playlists')
    .delete()
    .eq('id', playlistId);

  if (error) throw error;

  // Log activity (non-critical - wrap in try-catch)
  if (playlist) {
    try {
      await logActivity({
        user_id: userProfile.id,
        action: 'delete',
        entity_type: 'playlist',
        entity_id: playlistId,
        description: `Deleted playlist "${playlist.title}"`,
      });
    } catch (error) {
      // Log error but don't fail the playlist deletion
      console.error('Failed to log playlist deletion activity:', error);
    }
  }

  return true;
}

/**
 * Archive/deactivate a playlist
 */
export async function archivePlaylist(playlistId: string) {
  return updatePlaylist(playlistId, { is_active: false });
}

/**
 * Unarchive/reactivate a playlist
 */
export async function unarchivePlaylist(playlistId: string) {
  return updatePlaylist(playlistId, { is_active: true });
}

/**
 * Duplicate a playlist
 */
export async function duplicatePlaylist(playlistId: string) {
  const orgId = await getCurrentUserOrgId();
  const userProfile = await getCurrentUserProfile();
  
  if (!orgId || !userProfile) throw new Error('User not authenticated');

  // Get original playlist with all content
  const original = await getPlaylistById(playlistId);

  // Create new playlist
  const { data: newPlaylist, error: playlistError } = await supabase
    .from('playlists')
    .insert({
      organization_id: orgId,
      title: `${original.title} (Copy)`,
      description: original.description,
      type: original.type,
      trigger_rules: original.trigger_rules,
      release_type: original.release_type,
      release_schedule: original.release_schedule,
      is_active: true,
      created_by: userProfile.id,
    })
    .select()
    .single();

  if (playlistError) throw playlistError;

  // Copy albums
  if (original.albums && original.albums.length > 0) {
    const albumRecords = original.albums.map((pa: any) => ({
      playlist_id: newPlaylist.id,
      album_id: pa.album.id,
      display_order: pa.display_order,
      release_stage: pa.release_stage,
    }));

    await supabase.from('playlist_albums').insert(albumRecords);
  }

  // Copy tracks
  if (original.tracks && original.tracks.length > 0) {
    const trackRecords = original.tracks.map((pt: any) => ({
      playlist_id: newPlaylist.id,
      track_id: pt.track.id,
      display_order: pt.display_order,
      release_stage: pt.release_stage,
    }));

    await supabase.from('playlist_tracks').insert(trackRecords);
  }

  // Log activity (non-critical - wrap in try-catch)
  try {
    await logActivity({
      user_id: userProfile.id,
      action: 'duplicate',
      entity_type: 'playlist',
      entity_id: newPlaylist.id,
      description: `Duplicated playlist "${original.title}"`,
    });
  } catch (error) {
    // Log error but don't fail the playlist duplication
    console.error('Failed to log playlist duplication activity:', error);
  }

  return newPlaylist;
}

/**
 * Add albums to a playlist
 */
export async function addAlbumsToPlaylist(playlistId: string, albumIds: string[]) {
  // Get current max display order
  const { data: existing } = await supabase
    .from('playlist_albums')
    .select('display_order')
    .eq('playlist_id', playlistId)
    .order('display_order', { ascending: false })
    .limit(1);

  const startOrder = (existing?.[0]?.display_order || 0) + 1;

  const albumRecords = albumIds.map((albumId, index) => ({
    playlist_id: playlistId,
    album_id: albumId,
    display_order: startOrder + index,
    release_stage: 1,
  }));

  const { error } = await supabase
    .from('playlist_albums')
    .insert(albumRecords);

  if (error) throw error;
  return true;
}

/**
 * Remove album from playlist
 */
export async function removeAlbumFromPlaylist(playlistId: string, albumId: string) {
  const { error } = await supabase
    .from('playlist_albums')
    .delete()
    .eq('playlist_id', playlistId)
    .eq('album_id', albumId);

  if (error) throw error;
  return true;
}

/**
 * Reorder albums in a playlist
 */
export async function reorderPlaylistAlbums(
  playlistId: string,
  albumOrders: { album_id: string; display_order: number }[]
) {
  for (const item of albumOrders) {
    await supabase
      .from('playlist_albums')
      .update({ display_order: item.display_order })
      .eq('playlist_id', playlistId)
      .eq('album_id', item.album_id);
  }

  return true;
}