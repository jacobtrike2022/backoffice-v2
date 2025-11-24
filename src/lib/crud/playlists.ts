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

  // Enrich each playlist with stats
  const enrichedPlaylists = await Promise.all(
    (playlists || []).map(async (playlist) => {
      // Get album count
      const { count: albumCount } = await supabase
        .from('playlist_albums')
        .select('id', { count: 'exact', head: true })
        .eq('playlist_id', playlist.id);

      // Get standalone track count
      const { count: trackCount } = await supabase
        .from('playlist_tracks')
        .select('id', { count: 'exact', head: true })
        .eq('playlist_id', playlist.id);

      // Get assignment count
      const { count: assignmentCount } = await supabase
        .from('assignments')
        .select('id', { count: 'exact', head: true })
        .eq('playlist_id', playlist.id)
        .in('status', ['assigned', 'in_progress', 'completed']);

      // Get completion stats
      const { data: assignments } = await supabase
        .from('assignments')
        .select('progress_percent, status')
        .eq('playlist_id', playlist.id)
        .in('status', ['assigned', 'in_progress', 'completed']);

      const completedCount = assignments?.filter(a => a.status === 'completed').length || 0;
      const totalAssignments = assignments?.length || 0;
      const completionRate = totalAssignments > 0 
        ? Math.round((completedCount / totalAssignments) * 100)
        : 0;

      const avgProgress = totalAssignments > 0
        ? Math.round(
            assignments.reduce((sum, a) => sum + (a.progress_percent || 0), 0) / totalAssignments
          )
        : 0;

      return {
        ...playlist,
        album_count: albumCount || 0,
        track_count: trackCount || 0,
        assignment_count: assignmentCount || 0,
        completion_rate: completionRate,
        avg_progress: avgProgress,
      };
    })
  );

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
      album:albums(
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
      track:tracks(
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

  return {
    ...playlist,
    albums: playlistAlbums || [],
    tracks: playlistTracks || [],
    assignment_count: assignmentCount || 0,
  };
}

/**
 * Create a new playlist
 */
export async function createPlaylist(input: CreatePlaylistInput) {
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

  // Log activity
  await logActivity({
    user_id: userProfile.id,
    action: 'create',
    entity_type: 'playlist',
    entity_id: playlist.id,
    description: `Created playlist "${input.title}"`,
  });

  return playlist;
}

/**
 * Update an existing playlist
 */
export async function updatePlaylist(playlistId: string, input: UpdatePlaylistInput) {
  const userProfile = await getCurrentUserProfile();
  if (!userProfile) throw new Error('User not authenticated');

  const { data: playlist, error } = await supabase
    .from('playlists')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', playlistId)
    .select()
    .single();

  if (error) throw error;

  // Log activity
  await logActivity({
    user_id: userProfile.id,
    action: 'update',
    entity_type: 'playlist',
    entity_id: playlistId,
    description: `Updated playlist "${playlist.title}"`,
  });

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

  // Log activity
  if (playlist) {
    await logActivity({
      user_id: userProfile.id,
      action: 'delete',
      entity_type: 'playlist',
      entity_id: playlistId,
      description: `Deleted playlist "${playlist.title}"`,
    });
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

  // Log activity
  await logActivity({
    user_id: userProfile.id,
    action: 'duplicate',
    entity_type: 'playlist',
    entity_id: newPlaylist.id,
    description: `Duplicated playlist "${original.title}"`,
  });

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
