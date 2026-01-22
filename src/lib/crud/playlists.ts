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

  // Batch query 1: Get all album data for all playlists at once
  const { data: allPlaylistAlbums } = await supabase
    .from('playlist_albums')
    .select('playlist_id, album_id')
    .in('playlist_id', playlistIds);

  // Batch query 2: Get all track data for all playlists at once (with track status and duration to filter archived)
  const { data: allPlaylistTracks } = await supabase
    .from('playlist_tracks')
    .select(`
      playlist_id,
      track_id,
      display_order,
      track:tracks (
        status,
        duration_minutes
      )
    `)
    .in('playlist_id', playlistIds)
    .order('display_order', { ascending: true });

  // Batch query 2b: Get all tracks within albums for these playlists
  const allAlbumIds = [...new Set((allPlaylistAlbums || []).map((pa: any) => pa.album_id).filter(Boolean))];
  let albumTracksByAlbum: Record<string, { track_id: string; duration_minutes: number }[]> = {};

  if (allAlbumIds.length > 0) {
    const { data: albumTracks } = await supabase
      .from('album_tracks')
      .select(`
        album_id,
        track_id,
        track:tracks (
          id,
          status,
          duration_minutes
        )
      `)
      .in('album_id', allAlbumIds);

    // Group album tracks by album_id, filtering out archived tracks
    (albumTracks || []).forEach((at: any) => {
      if (at.track?.status !== 'archived') {
        if (!albumTracksByAlbum[at.album_id]) {
          albumTracksByAlbum[at.album_id] = [];
        }
        albumTracksByAlbum[at.album_id].push({
          track_id: at.track_id,
          duration_minutes: at.track?.duration_minutes || 0,
        });
      }
    });
  }

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
  const albumIdsByPlaylist: Record<string, string[]> = {};
  (allPlaylistAlbums as any[])?.forEach((pa: any) => {
    albumCountByPlaylist[pa.playlist_id] = (albumCountByPlaylist[pa.playlist_id] || 0) + 1;
    if (!albumIdsByPlaylist[pa.playlist_id]) {
      albumIdsByPlaylist[pa.playlist_id] = [];
    }
    if (pa.album_id) {
      albumIdsByPlaylist[pa.playlist_id].push(pa.album_id);
    }
  });

  const tracksByPlaylist: Record<string, { track_id: string; display_order: number; duration_minutes: number }[]> = {};
  (allPlaylistTracks as any[])?.forEach((pt: any) => {
    if (!tracksByPlaylist[pt.playlist_id]) {
      tracksByPlaylist[pt.playlist_id] = [];
    }
    // Only include non-archived tracks
    if (pt.track_id && pt.track?.status !== 'archived') {
      tracksByPlaylist[pt.playlist_id].push({
        track_id: pt.track_id,
        display_order: pt.display_order || 0,
        duration_minutes: pt.track?.duration_minutes || 0,
      });
    }
  });

  // Sort tracks by display_order for each playlist
  Object.keys(tracksByPlaylist).forEach(playlistId => {
    tracksByPlaylist[playlistId].sort((a, b) => a.display_order - b.display_order);
  });

  // Calculate total track count (standalone + album tracks) and duration for each playlist
  const trackCountByPlaylist: Record<string, number> = {};
  const totalDurationByPlaylist: Record<string, number> = {};
  const allTrackIdsByPlaylist: Record<string, string[]> = {};

  playlists.forEach((playlist: any) => {
    const standaloneTracks = tracksByPlaylist[playlist.id] || [];
    const standaloneTrackIds = standaloneTracks.map(t => t.track_id);
    const playlistAlbumIds = albumIdsByPlaylist[playlist.id] || [];

    // Calculate standalone track duration
    let standaloneTracksDuration = 0;
    standaloneTracks.forEach(t => {
      standaloneTracksDuration += t.duration_minutes || 0;
    });

    // Get all track IDs from albums
    const albumTrackIds: string[] = [];
    let albumTracksDuration = 0;
    playlistAlbumIds.forEach(albumId => {
      const albumTracks = albumTracksByAlbum[albumId] || [];
      albumTracks.forEach(at => {
        if (!albumTrackIds.includes(at.track_id) && !standaloneTrackIds.includes(at.track_id)) {
          // Only add duration if track is not already counted as standalone
          albumTrackIds.push(at.track_id);
          albumTracksDuration += at.duration_minutes || 0;
        }
      });
    });

    // Combine and dedupe track IDs
    const allTrackIds = [...new Set([...standaloneTrackIds, ...albumTrackIds])];
    allTrackIdsByPlaylist[playlist.id] = allTrackIds;
    trackCountByPlaylist[playlist.id] = allTrackIds.length;
    totalDurationByPlaylist[playlist.id] = standaloneTracksDuration + albumTracksDuration;
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
    // Use the combined track IDs (standalone + album tracks)
    const all_track_ids = allTrackIdsByPlaylist[playlist.id] || [];
    const standaloneTrackIds = (tracksByPlaylist[playlist.id] || []).map((pt: any) => pt.track_id).filter(Boolean);

    const assignments = assignmentsByPlaylist[playlist.id] || [];
    const totalAssignments = assignments.length;

    // Calculate completion rate based on track_completions
    // A user has "completed" the playlist if they've completed all tracks in it
    let completedUsers = 0;
    assignments.forEach((assignment: any) => {
      const userCompletions = completionsByUser[assignment.user_id] || new Set();
      // Check if user has completed all required tracks (including album tracks)
      const hasCompletedAll = all_track_ids.length > 0 &&
        all_track_ids.every(trackId => userCompletions.has(trackId));
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
      total_duration_minutes: totalDurationByPlaylist[playlist.id] || 0,
      assignment_count: assignmentCountByPlaylist[playlist.id] || 0,
      completion_rate: completionRate,
      avg_progress: avgProgress,
      track_ids: all_track_ids, // Now includes album tracks
      standalone_track_ids: standaloneTrackIds,
      album_ids: albumIdsByPlaylist[playlist.id] || [],
    };
  });

  return enrichedPlaylists;
}

/**
 * Get playlist title and track IDs only (lightweight, for filtering)
 * This is optimized for filtering operations where we don't need full playlist data
 * Note: This excludes archived tracks
 */
export async function getPlaylistTrackIds(playlistId: string): Promise<{ title: string; track_ids: string[] } | null> {
  // Run all independent queries in parallel for maximum speed
  const [playlistResult, playlistTracksResult, playlistAlbumsResult] = await Promise.all([
    // Get playlist title
    supabase
      .from('playlists')
      .select('id, title')
      .eq('id', playlistId)
      .single(),
    // Get standalone track IDs with track status to filter archived
    supabase
      .from('playlist_tracks')
      .select(`
        track_id,
        track:tracks (
          status
        )
      `)
      .eq('playlist_id', playlistId),
    // Get album IDs
    supabase
      .from('playlist_albums')
      .select('album_id')
      .eq('playlist_id', playlistId),
  ]);

  if (playlistResult.error || !playlistResult.data) return null;

  const albumIds = (playlistAlbumsResult.data || []).map((pa: any) => pa.album_id).filter(Boolean);

  // Get track IDs from albums (only if there are albums), excluding archived tracks
  let albumTrackIds: string[] = [];
  if (albumIds.length > 0) {
    const { data: albumTracks } = await supabase
      .from('album_tracks')
      .select(`
        track_id,
        track:tracks (
          status
        )
      `)
      .in('album_id', albumIds);

    albumTrackIds = (albumTracks || [])
      .filter((at: any) => at.track?.status !== 'archived')
      .map((at: any) => at.track_id)
      .filter(Boolean);
  }

  // Combine standalone tracks and album tracks, deduplicate (exclude archived)
  const standaloneTrackIds = (playlistTracksResult.data || [])
    .filter((pt: any) => pt.track?.status !== 'archived')
    .map((pt: any) => pt.track_id)
    .filter(Boolean);
  const allTrackIds = [...new Set([...standaloneTrackIds, ...albumTrackIds])];

  return {
    title: playlistResult.data.title,
    track_ids: allTrackIds,
  };
}

/**
 * Get a single playlist by ID with full details
 */
export async function getPlaylistById(playlistId: string) {
  console.log('🔍 getPlaylistById called with:', playlistId);

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
  // Note: Use "album:albums" syntax for the foreign key relationship (album_id -> albums.id)
  const { data: playlistAlbums, error: albumsError } = await supabase
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

  console.log('🔍 getPlaylistById playlistAlbums query result:', { playlistAlbums, albumsError });

  // Get standalone tracks in this playlist
  // Note: Use "track:tracks" syntax for the foreign key relationship (track_id -> tracks.id)
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

  // Normalize response structure - Supabase may return albums/tracks under different keys
  // Normalize to always use 'album' and 'track' keys for consistency
  const albumIds = (playlistAlbums || []).map((pa: any) => (pa.albums || pa.album)?.id).filter(Boolean);

  // Fetch tracks for each album
  let albumTracksMap: Record<string, any[]> = {};
  let totalAlbumTracksDuration = 0;

  if (albumIds.length > 0) {
    const { data: albumTracks } = await supabase
      .from('album_tracks')
      .select(`
        album_id,
        display_order,
        track:tracks (
          id,
          title,
          description,
          duration_minutes,
          type,
          thumbnail_url,
          status
        )
      `)
      .in('album_id', albumIds)
      .order('display_order');

    // Group tracks by album_id
    (albumTracks || []).forEach((at: any) => {
      const track = at.track;
      if (track && track.status !== 'archived') {
        if (!albumTracksMap[at.album_id]) {
          albumTracksMap[at.album_id] = [];
        }
        albumTracksMap[at.album_id].push(track);
        totalAlbumTracksDuration += track.duration_minutes || 0;
      }
    });
  }

  // Normalize albums with their tracks
  const normalizedAlbums = (playlistAlbums || []).map((pa: any) => {
    const album = pa.albums || pa.album;
    const albumTracks = albumTracksMap[album?.id] || [];
    return {
      ...pa,
      album: album ? {
        ...album,
        tracks: albumTracks,
        track_count: albumTracks.length,
      } : null,
    };
  });

  const normalizedTracks = (playlistTracks || []).map((pt: any) => ({
    ...pt,
    track: pt.tracks || pt.track, // Support both structures
  }));

  // Extract album and track IDs for easier access
  const album_ids = normalizedAlbums.map((pa: any) => pa.album?.id).filter(Boolean) || [];
  const standalone_track_ids = normalizedTracks.map((pt: any) => pt.track?.id).filter(Boolean) || [];

  // Get all track IDs (standalone + album tracks)
  const albumTrackIds = Object.values(albumTracksMap).flat().map((t: any) => t.id);
  const all_track_ids = [...new Set([...standalone_track_ids, ...albumTrackIds])];

  // Calculate total duration
  const standaloneDuration = normalizedTracks.reduce((sum: number, pt: any) =>
    sum + (pt.track?.duration_minutes || 0), 0);
  const total_duration_minutes = standaloneDuration + totalAlbumTracksDuration;

  return {
    ...playlist,
    playlist_albums: normalizedAlbums, // Use playlist_albums for view consistency
    albums: normalizedAlbums,
    tracks: normalizedTracks,
    album_ids,
    track_ids: all_track_ids, // All track IDs including album tracks
    standalone_track_ids,
    assignment_count: assignmentCount || 0,
    total_duration_minutes,
    total_track_count: all_track_ids.length,
  };
}

/**
 * Create a new playlist
 */
export async function createPlaylist(input: CreatePlaylistInput) {
  console.log('🔍 CRUD createPlaylist received:', {
    title: input.title,
    album_ids: input.album_ids,
    track_ids: input.track_ids,
    release_schedule: input.release_schedule,
  });

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

  // Build stage-to-content mapping from release_schedule if available
  const stages = input.release_schedule?.stages || [];
  const albumToStage: Record<string, number> = {};
  const trackToStage: Record<string, number> = {};

  stages.forEach((stage: any, index: number) => {
    const stageNum = index + 1;
    (stage.albumIds || []).forEach((albumId: string) => {
      albumToStage[albumId] = stageNum;
    });
    (stage.trackIds || []).forEach((trackId: string) => {
      trackToStage[trackId] = stageNum;
    });
  });

  // Add albums to playlist with correct release_stage
  if (input.album_ids && input.album_ids.length > 0) {
    const albumRecords = input.album_ids.map((albumId, index) => ({
      playlist_id: playlist.id,
      album_id: albumId,
      display_order: index + 1,
      release_stage: albumToStage[albumId] || 1,
    }));

    console.log('🔍 Inserting into playlist_albums:', albumRecords);

    const { error: albumError } = await supabase
      .from('playlist_albums')
      .insert(albumRecords);

    if (albumError) {
      console.error('❌ Error inserting playlist_albums:', albumError);
      throw albumError;
    }
    console.log('✅ Successfully inserted', albumRecords.length, 'albums into playlist_albums');
  } else {
    console.log('⚠️ No album_ids provided to insert into playlist_albums');
  }

  // Add standalone tracks to playlist with correct release_stage
  if (input.track_ids && input.track_ids.length > 0) {
    const trackRecords = input.track_ids.map((trackId, index) => ({
      playlist_id: playlist.id,
      track_id: trackId,
      display_order: (input.album_ids?.length || 0) + index + 1,
      release_stage: trackToStage[trackId] || 1,
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
  console.log('🔍 CRUD updatePlaylist received:', {
    playlistId,
    title: input.title,
    album_ids: input.album_ids,
    track_ids: input.track_ids,
    release_schedule: input.release_schedule,
  });

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

  // Build stage-to-content mapping from release_schedule if available
  const stages = playlistData.release_schedule?.stages || [];
  const albumToStage: Record<string, number> = {};
  const trackToStage: Record<string, number> = {};

  stages.forEach((stage: any, index: number) => {
    const stageNum = index + 1;
    (stage.albumIds || []).forEach((albumId: string) => {
      albumToStage[albumId] = stageNum;
    });
    (stage.trackIds || []).forEach((trackId: string) => {
      trackToStage[trackId] = stageNum;
    });
  });

  // Handle album updates if provided
  if (album_ids !== undefined) {
    console.log('🔍 updatePlaylist: Deleting existing playlist_albums for playlist:', playlistId);
    // Delete existing albums
    await supabase
      .from('playlist_albums')
      .delete()
      .eq('playlist_id', playlistId);

    // Add new albums with correct release_stage
    if (album_ids.length > 0) {
      const albumRecords = album_ids.map((albumId, index) => ({
        playlist_id: playlistId,
        album_id: albumId,
        display_order: index + 1,
        release_stage: albumToStage[albumId] || 1,
      }));

      console.log('🔍 updatePlaylist: Inserting into playlist_albums:', albumRecords);

      const { error: albumError } = await supabase
        .from('playlist_albums')
        .insert(albumRecords);

      if (albumError) {
        console.error('❌ Error inserting playlist_albums in update:', albumError);
        throw albumError;
      }
      console.log('✅ updatePlaylist: Successfully inserted', albumRecords.length, 'albums');
    } else {
      console.log('⚠️ updatePlaylist: album_ids is empty array, no albums to insert');
    }
  } else {
    console.log('⚠️ updatePlaylist: album_ids is undefined, skipping album update');
  }

  // Handle track updates if provided
  if (track_ids !== undefined) {
    // Delete existing tracks
    await supabase
      .from('playlist_tracks')
      .delete()
      .eq('playlist_id', playlistId);

    // Add new tracks with correct release_stage
    if (track_ids.length > 0) {
      const trackRecords = track_ids.map((trackId, index) => ({
        playlist_id: playlistId,
        track_id: trackId,
        display_order: (album_ids?.length || 0) + index + 1,
        release_stage: trackToStage[trackId] || 1,
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
 * Get assignment statistics for a playlist
 */
export async function getPlaylistAssignmentStats(playlistId: string) {
  const { data: assignments, error } = await supabase
    .from('assignments')
    .select('id, status')
    .eq('playlist_id', playlistId)
    .neq('status', 'archived');

  if (error) throw error;

  const totalAssignments = assignments?.length || 0;
  const completedCount = assignments?.filter(a => a.status === 'completed').length || 0;
  const inProgressCount = assignments?.filter(a => a.status === 'in_progress').length || 0;
  const notStartedCount = assignments?.filter(a => a.status === 'assigned' || a.status === 'pending').length || 0;

  return {
    totalAssignments,
    completedCount,
    inProgressCount,
    notStartedCount
  };
}

/**
 * Archive/deactivate a playlist
 * @param archiveAssignments - If true, also archives all active assignments for this playlist
 */
export async function archivePlaylist(playlistId: string, archiveAssignments: boolean = false) {
  // Archive related assignments if requested
  if (archiveAssignments) {
    const { error: assignmentError } = await supabase
      .from('assignments')
      .update({ status: 'archived' })
      .eq('playlist_id', playlistId)
      .neq('status', 'archived')
      .neq('status', 'completed');

    if (assignmentError) throw assignmentError;
  }

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