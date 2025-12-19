// ============================================================================
// TRACK COMPLETIONS - NEW PROGRESS TRACKING SYSTEM
// ============================================================================
// This is the SOURCE OF TRUTH for "has user completed this track?"
// Dual-writes to user_progress for backwards compatibility

import { supabase } from '../supabase';
import { createNotification } from './notifications';
import { logActivity } from './activity';
import { updateAssignmentProgress } from './progressCalculations';

// ============================================================================
// TYPES
// ============================================================================

export interface TrackCompletionInput {
  userId: string;
  trackId: string;
  assignmentId?: string;
  albumId?: string;
  playlistId?: string;
  status: 'completed' | 'passed' | 'failed';
  score?: number;
  passed?: boolean;
  attempts?: number;
  timeSpentMinutes: number;
  metadata?: Record<string, any>;
}

export interface TrackCompletion {
  id: string;
  user_id: string;
  track_id: string;
  track_version_number: number;
  status: 'completed' | 'passed' | 'failed';
  score: number | null;
  passed: boolean | null;
  attempts: number;
  time_spent_minutes: number;
  completed_via_assignment_id: string | null;
  completed_via_album_id: string | null;
  completed_via_playlist_id: string | null;
  completed_at: string;
  metadata: Record<string, any>;
  created_at: string;
}

/**
 * Record a track completion (dual-writes to new and legacy systems)
 * 
 * @example
 * await recordTrackCompletion({
 *   userId: 'user-id',
 *   trackId: 'track-id',
 *   status: 'completed',
 *   timeSpentMinutes: 15
 * });
 */
export async function recordTrackCompletion(input: TrackCompletionInput): Promise<TrackCompletion> {
  const {
    userId,
    trackId,
    assignmentId,
    albumId,
    playlistId,
    status,
    score,
    passed,
    attempts = 1,
    timeSpentMinutes,
    metadata = {}
  } = input;

  // Input validation
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId: must be a non-empty string');
  }
  if (!trackId || typeof trackId !== 'string') {
    throw new Error('Invalid trackId: must be a non-empty string');
  }
  if (!['completed', 'passed', 'failed'].includes(status)) {
    throw new Error('Invalid status: must be one of completed, passed, or failed');
  }
  if (score !== undefined && (typeof score !== 'number' || score < 0 || score > 100)) {
    throw new Error('Invalid score: must be a number between 0 and 100');
  }
  if (timeSpentMinutes < 0) {
    throw new Error('Invalid timeSpentMinutes: must be non-negative');
  }

  const completedAt = new Date().toISOString();

  // 1. Get track details (need version number and type)
  const { data: track, error: trackError } = await supabase
    .from('tracks')
    .select('version_number, title, type, organization_id')
    .eq('id', trackId)
    .single();

  if (trackError || !track) {
    throw new Error(`Track not found: ${trackId}`);
  }

  // 2. Write to NEW SYSTEM (track_completions) - SOURCE OF TRUTH
  const { data: completion, error: completionError } = await supabase
    .from('track_completions')
    .insert({
      user_id: userId,
      track_id: trackId,
      track_version_number: track.version_number || 1,
      status,
      score,
      passed: passed ?? (status === 'passed' ? true : status === 'failed' ? false : null),
      attempts,
      time_spent_minutes: timeSpentMinutes,
      completed_via_assignment_id: assignmentId || null,
      completed_via_album_id: albumId || null,
      completed_via_playlist_id: playlistId || null,
      completed_at: completedAt,
      metadata: {
        ...metadata,
        track_type: track.type,
        track_version: track.version_number || 1
      }
    })
    .select()
    .single();

  if (completionError) {
    console.error('Failed to record track completion:', completionError);
    throw new Error(`Failed to record completion: ${completionError.message}`);
  }

  // 3. Write to LEGACY SYSTEM (user_progress) - BACKWARDS COMPATIBILITY
  try {
    await supabase
      .from('user_progress')
      .upsert({
        organization_id: track.organization_id,
        user_id: userId,
        track_id: trackId,
        assignment_id: assignmentId || null,
        status,
        progress_percent: status === 'failed' ? 0 : 100,
        attempts,
        score,
        passed: passed !== undefined ? passed : (status === 'passed' ? true : status === 'failed' ? false : null),
        time_spent_minutes: timeSpentMinutes,
        completed_at: completedAt,
        updated_at: completedAt,
        started_at: completedAt,
      }, {
        onConflict: 'user_id,track_id,assignment_id',
        ignoreDuplicates: false
      });
  } catch (legacyError) {
    console.error('Failed to write to legacy user_progress:', legacyError);
  }

  // 4. Write to activity_events (granular xAPI-style tracking)
  try {
    await supabase
      .from('activity_events')
      .insert({
        user_id: userId,
        verb: status,
        object_type: 'track',
        object_id: trackId,
        object_name: track.title,
        result_success: status !== 'failed',
        result_score_raw: score || null,
        result_score_scaled: score ? score / 100 : null,
        result_completion: true,
        context_registration: assignmentId || null,
        context_parent_type: albumId ? 'album' : playlistId ? 'playlist' : null,
        context_parent_id: albumId || playlistId || null,
        context_platform: 'web',
        timestamp: completedAt,
        metadata: {
          track_type: track.type,
          track_version: track.version_number || 1,
          attempts
        }
      });
  } catch (activityError) {
    console.error('Failed to write activity event:', activityError);
  }

  // 5. Update assignment progress & check certifications
  if (assignmentId) {
    // Use the new progress calculation system
    updateAssignmentProgress(assignmentId).catch(error => {
      console.error('Failed to update assignment progress:', error);
    });
  } else {
    // If no assignmentId, check all assignments for this user that include this track
    updateAllRelevantAssignmentsAsync(userId, trackId);
  }

  if (status === 'passed' || status === 'completed') {
    checkCertificationEligibilityAsync(userId);
    sendCompletionNotificationAsync(userId, track.title, trackId, score);
  }

  return completion;
}

// Async helper: Update all assignments for a user that include this track
async function updateAllRelevantAssignmentsAsync(userId: string, trackId: string) {
  try {
    // Find assignments for this user that include this track
    const { data: userAssignments } = await supabase
      .from('assignments')
      .select('id, playlist_id')
      .eq('user_id', userId);

    if (!userAssignments) return;

    for (const assignment of userAssignments) {
      // Check if this track is in the assignment's playlist
      const { data: playlistTrack } = await supabase
        .from('playlist_tracks')
        .select('id')
        .eq('playlist_id', assignment.playlist_id)
        .eq('track_id', trackId)
        .maybeSingle();

      if (playlistTrack) {
        // This track is part of this assignment - update progress
        await updateAssignmentProgress(assignment.id);
        console.log(`✅ Updated progress for assignment ${assignment.id}`);
      }
    }
  } catch (error) {
    console.error('Error updating relevant assignments:', error);
    // Don't throw - completion was successful, progress update is secondary
  }
}

async function checkCertificationEligibilityAsync(userId: string) {
  try {
    const { data: certifications } = await supabase
      .from('certifications')
      .select('*')
      .eq('is_active', true);

    if (!certifications) return;

    for (const cert of certifications) {
      if (!cert.required_track_ids || cert.required_track_ids.length === 0) continue;

      const { data: completions } = await supabase
        .from('track_completions')
        .select('track_id, score')
        .eq('user_id', userId)
        .in('track_id', cert.required_track_ids);

      if (!completions) continue;

      const completedTrackIds = completions.map(c => c.track_id);
      const allComplete = cert.required_track_ids.every((id: string) => completedTrackIds.includes(id));
      
      if (!allComplete) continue;
      if (cert.minimum_score) {
        const minScore = Math.min(...completions.map(c => c.score).filter(s => s !== null) as number[]);
        if (minScore < cert.minimum_score) continue;
      }

      // Issue certificate
      const expiresAt = cert.expires_after_days
        ? new Date(Date.now() + cert.expires_after_days * 24 * 60 * 60 * 1000).toISOString()
        : null;

      await supabase.from('user_certifications').insert({
        organization_id: (completions[0] as any).organization_id,
        user_id: userId,
        certification_id: cert.id,
        issued_at: new Date().toISOString(),
        expires_at: expiresAt,
        status: 'active',
        certificate_number: `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      });

      await createNotification({
        user_id: userId,
        type: 'certification_issued',
        title: 'Certification Earned!',
        message: `You've earned the "${cert.name}" certification`,
        link_url: `/certifications`
      });
    }
  } catch (error) {
    console.error('Failed to check certifications:', error);
  }
}

async function sendCompletionNotificationAsync(userId: string, trackTitle: string, trackId: string, score?: number) {
  try {
    await createNotification({
      user_id: userId,
      type: 'completion',
      title: 'Track Completed!',
      message: `You completed "${trackTitle}"${score ? ` with ${score}%` : ''}`,
      link_url: `/content/${trackId}`
    });

    await logActivity({
      user_id: userId,
      action: 'completion',
      entity_type: 'track',
      entity_id: trackId,
      description: `Completed "${trackTitle}"${score ? ` with ${score}%` : ''}`
    });
  } catch (error) {
    console.error('Failed to send notifications:', error);
  }
}

// Query functions
export async function hasUserCompletedTrack(userId: string, trackId: string): Promise<boolean> {
  const { data } = await supabase
    .from('track_completions')
    .select('id')
    .eq('user_id', userId)
    .eq('track_id', trackId)
    .limit(1)
    .single();
  return !!data;
}

export async function getUserTrackCompletions(userId: string) {
  const { data } = await supabase
    .from('track_completions')
    .select('*, track:tracks(title, type)')
    .eq('user_id', userId)
    .order('completed_at', { ascending: false });
  return data || [];
}

export async function getSkippableTracksInPlaylist(userId: string, playlistId: string): Promise<string[]> {
  const { data: playlistTracks } = await supabase
    .from('playlist_tracks')
    .select('track_id')
    .eq('playlist_id', playlistId);

  if (!playlistTracks || playlistTracks.length === 0) return [];

  const trackIds = playlistTracks.map(pt => pt.track_id);
  const { data: completions } = await supabase
    .from('track_completions')
    .select('track_id')
    .eq('user_id', userId)
    .in('track_id', trackIds);

  return completions?.map(c => c.track_id) || [];
}
