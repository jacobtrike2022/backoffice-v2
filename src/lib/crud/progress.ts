// ============================================================================
// PROGRESS TRACKING CRUD OPERATIONS
// ============================================================================

import { supabase, getCurrentUserProfile } from '../supabase';
import { createNotification } from './notifications';
import { logActivity } from './activity';
import { checkAndCompleteAssignment } from './assignments';
import { checkAndIssueCertification } from './certifications';
import { recordTrackCompletion } from './trackCompletions';

/**
 * Update track progress and cascade to album/playlist
 */
export async function updateTrackProgress(
  userId: string,
  trackId: string,
  updates: {
    status?: 'not-started' | 'in-progress' | 'completed';
    progress_percentage?: number;
    score?: number;
    time_spent_minutes?: number;
  }
) {
  // Input validation
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId: must be a non-empty string');
  }
  if (!trackId || typeof trackId !== 'string') {
    throw new Error('Invalid trackId: must be a non-empty string');
  }
  if (updates.status && !['not-started', 'in-progress', 'completed'].includes(updates.status)) {
    throw new Error('Invalid status: must be one of not-started, in-progress, or completed');
  }
  if (updates.progress_percentage !== undefined && (typeof updates.progress_percentage !== 'number' || updates.progress_percentage < 0 || updates.progress_percentage > 100)) {
    throw new Error('Invalid progress_percentage: must be a number between 0 and 100');
  }
  if (updates.score !== undefined && (typeof updates.score !== 'number' || updates.score < 0 || updates.score > 100)) {
    throw new Error('Invalid score: must be a number between 0 and 100');
  }
  if (updates.time_spent_minutes !== undefined && (typeof updates.time_spent_minutes !== 'number' || updates.time_spent_minutes < 0)) {
    throw new Error('Invalid time_spent_minutes: must be a non-negative number');
  }
  const now = new Date().toISOString();

  // Get existing progress (need assignment_id)
  const { data: existingProgress } = await supabase
    .from('track_progress')
    .select('*, assignment_id')
    .eq('user_id', userId)
    .eq('track_id', trackId)
    .single();

  if (!existingProgress) {
    throw new Error('Progress record not found');
  }

  // ✨ NEW: If completing, use dual-write system
  // TRANSITION: Migrating to recordTrackCompletion() for all completions
  // This writes to track_completions (new) + user_progress (legacy) + activity_events
  if (updates.status === 'completed') {
    try {
      await recordTrackCompletion({
        userId,
        trackId,
        assignmentId: existingProgress.assignment_id,
        status: updates.score && updates.score >= 70 ? 'passed' : 'completed',
        score: updates.score,
        passed: updates.score ? updates.score >= 70 : undefined,
        timeSpentMinutes: updates.time_spent_minutes || 0,
        attempts: 1
      });
      
      // Return - recordTrackCompletion handles everything including track_progress
      return {
        ...existingProgress,
        status: 'completed',
        progress_percentage: 100,
        score: updates.score,
        completed_at: now
      };
    } catch (error) {
      console.error('recordTrackCompletion failed, falling back to legacy:', error);
      // Fall through to old logic if new system fails
    }
  }

  // OLD LOGIC: For in-progress or if recordTrackCompletion failed
  const updateData: any = { ...updates };
  
  if (updates.status === 'in-progress' && !existingProgress.started_at) {
    updateData.started_at = now;
    updateData.last_accessed_at = now;
  } else if (updates.status) {
    updateData.last_accessed_at = now;
  }

  if (updates.status === 'completed') {
    updateData.completed_at = now;
    updateData.progress_percentage = 100;
  }

  // Update track progress
  const { data: updatedProgress, error } = await supabase
    .from('track_progress')
    .update(updateData)
    .eq('user_id', userId)
    .eq('track_id', trackId)
    .select()
    .single();

  if (error) throw error;

  // Keep all the cascade logic for now
  await cascadeToAlbumProgress(userId, trackId);
  await cascadeToPlaylistProgress(userId, trackId);

  if (existingProgress.assignment_id) {
    await checkAndCompleteAssignment(existingProgress.assignment_id);
  }

  if (updates.status === 'completed') {
    await checkAndIssueCertification(userId);
    
    const { data: track } = await supabase
      .from('tracks')
      .select('title')
      .eq('id', trackId)
      .single();

    if (track) {
      try {
        await createNotification({
          user_id: userId,
          type: 'completion',
          title: 'Track Completed!',
          message: `You completed "${track.title}"`,
          link_url: `/content/${trackId}`
        });
      } catch (error) {
        console.error('Failed to create completion notification:', error);
      }

      try {
        await logActivity({
          user_id: userId,
          action: 'completion',
          entity_type: 'track',
          entity_id: trackId,
          description: `Completed "${track.title}" with score ${updates.score || 'N/A'}`
        });
      } catch (error) {
        console.error('Failed to log completion activity:', error);
      }
    }
  }

  return updatedProgress;
}

/**
 * Reset user progress (admin only)
 */
export async function resetTrackProgress(
  userId: string,
  trackId: string,
  requestingUserId: string
) {
  // Verify requesting user is admin
  const { data: requestingUser } = await supabase
    .from('users')
    .select('role:roles(name)')
    .eq('id', requestingUserId)
    .single();

  if (!requestingUser || (requestingUser.role as any)?.name !== 'Administrator') {
    throw new Error('Only administrators can reset progress');
  }

  const { error } = await supabase
    .from('track_progress')
    .update({
      status: 'not-started',
      progress_percentage: 0,
      score: null,
      time_spent_minutes: 0,
      started_at: null,
      completed_at: null,
      last_accessed_at: null
    })
    .eq('user_id', userId)
    .eq('track_id', trackId);

  if (error) throw error;

  // Cascade reset to album and playlist
  await cascadeToAlbumProgress(userId, trackId);
  await cascadeToPlaylistProgress(userId, trackId);
}

/**
 * Get user's progress overview
 */
export async function getUserProgressOverview(userId: string) {
  // Get all track progress
  const { data: trackProgress } = await supabase
    .from('track_progress')
    .select(`
      *,
      track:tracks(title, type, duration_minutes)
    `)
    .eq('user_id', userId)
    .order('last_accessed_at', { ascending: false, nullsFirst: false });

  // Get album progress
  const { data: albumProgress } = await supabase
    .from('album_progress')
    .select(`
      *,
      album:albums(title)
    `)
    .eq('user_id', userId);

  // Get playlist progress
  const { data: playlistProgress } = await supabase
    .from('playlist_progress')
    .select(`
      *,
      playlist:playlists(title)
    `)
    .eq('user_id', userId);

  // Calculate summary stats
  const totalTracks = trackProgress?.length || 0;
  const completedTracks = trackProgress?.filter(p => p.status === 'completed').length || 0;
  const avgProgress = trackProgress && trackProgress.length > 0
    ? trackProgress.reduce((sum, p) => sum + p.progress_percentage, 0) / totalTracks
    : 0;

  return {
    trackProgress,
    albumProgress,
    playlistProgress,
    summary: {
      totalTracks,
      completedTracks,
      avgProgress: Math.round(avgProgress),
      completionRate: totalTracks > 0 ? Math.round((completedTracks / totalTracks) * 100) : 0
    }
  };
}

// ============================================================================
// CASCADE FUNCTIONS
// ============================================================================

/**
 * Cascade track completion to album progress
 */
async function cascadeToAlbumProgress(userId: string, trackId: string) {
  // Find all albums containing this track
  const { data: albumTracks } = await supabase
    .from('album_tracks')
    .select('album_id')
    .eq('track_id', trackId);

  if (!albumTracks || albumTracks.length === 0) return;

  for (const { album_id } of albumTracks) {
    // Get all tracks in album
    const { data: allAlbumTracks } = await supabase
      .from('album_tracks')
      .select('track_id')
      .eq('album_id', album_id);

    const trackIds = allAlbumTracks?.map(at => at.track_id) || [];

    // Get user's progress on all tracks in album
    const { data: trackProgressList } = await supabase
      .from('track_progress')
      .select('status, track_id')
      .eq('user_id', userId)
      .in('track_id', trackIds);

    const tracksCompleted = trackProgressList?.filter(p => p.status === 'completed').length || 0;
    const tracksTotal = trackIds.length;
    const progressPercentage = tracksTotal > 0 ? Math.round((tracksCompleted / tracksTotal) * 100) : 0;

    // Update album progress
    const updateData: any = {
      tracks_completed: tracksCompleted,
      tracks_total: tracksTotal,
      progress_percentage: progressPercentage
    };

    if (progressPercentage === 100) {
      updateData.completed_at = new Date().toISOString();
    }

    await supabase
      .from('album_progress')
      .update(updateData)
      .eq('user_id', userId)
      .eq('album_id', album_id);

    // Send notification if album completed
    if (progressPercentage === 100) {
      const { data: album } = await supabase
        .from('albums')
        .select('title')
        .eq('id', album_id)
        .single();

      if (album) {
        await createNotification({
          user_id: userId,
          type: 'completion',
          title: 'Album Completed!',
          message: `You completed "${album.title}"`,
          link_url: `/content/albums/${album_id}`
        });

        await logActivity({
          user_id: userId,
          action: 'completion',
          entity_type: 'album',
          entity_id: album_id,
          description: `Completed album "${album.title}"`
        });
      }
    }
  }
}

/**
 * Cascade album completion to playlist progress
 */
async function cascadeToPlaylistProgress(userId: string, trackId: string) {
  // Find albums containing this track
  const { data: albumTracks } = await supabase
    .from('album_tracks')
    .select('album_id')
    .eq('track_id', trackId);

  if (!albumTracks || albumTracks.length === 0) return;

  const albumIds = albumTracks.map(at => at.album_id);

  // Find playlists containing these albums
  const { data: playlistAlbums } = await supabase
    .from('playlist_albums')
    .select('playlist_id, album_id')
    .in('album_id', albumIds);

  if (!playlistAlbums || playlistAlbums.length === 0) return;

  const playlistIds = [...new Set(playlistAlbums.map(pa => pa.playlist_id))];

  for (const playlistId of playlistIds) {
    // Get all albums in playlist
    const { data: allPlaylistAlbums } = await supabase
      .from('playlist_albums')
      .select('album_id')
      .eq('playlist_id', playlistId);

    const playlistAlbumIds = allPlaylistAlbums?.map(pa => pa.album_id) || [];

    // Get user's progress on all albums in playlist
    const { data: albumProgressList } = await supabase
      .from('album_progress')
      .select('progress_percentage, album_id')
      .eq('user_id', userId)
      .in('album_id', playlistAlbumIds);

    const albumsCompleted = albumProgressList?.filter(p => p.progress_percentage === 100).length || 0;
    const albumsTotal = playlistAlbumIds.length;
    const progressPercentage = albumsTotal > 0 ? Math.round((albumsCompleted / albumsTotal) * 100) : 0;

    // Update playlist progress
    const updateData: any = {
      albums_completed: albumsCompleted,
      albums_total: albumsTotal,
      progress_percentage: progressPercentage
    };

    if (progressPercentage === 100) {
      updateData.completed_at = new Date().toISOString();
    }

    await supabase
      .from('playlist_progress')
      .update(updateData)
      .eq('user_id', userId)
      .eq('playlist_id', playlistId);

    // Send notification if playlist completed
    if (progressPercentage === 100) {
      const { data: playlist } = await supabase
        .from('playlists')
        .select('title')
        .eq('id', playlistId)
        .single();

      if (playlist) {
        await createNotification({
          user_id: userId,
          type: 'completion',
          title: 'Playlist Completed!',
          message: `You completed "${playlist.title}"`,
          link_url: `/playlists/${playlistId}`
        });

        await logActivity({
          user_id: userId,
          action: 'completion',
          entity_type: 'playlist',
          entity_id: playlistId,
          description: `Completed playlist "${playlist.title}"`
        });
      }
    }
  }
}