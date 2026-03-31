// ============================================================================
// PROGRESS CALCULATION FUNCTIONS
// ============================================================================
// Real-time progress calculation for assignments based on track_completions
// Source of truth: track_completions table (per ACTIVITY_TRACKING_SYSTEM.md)

import { supabase } from '../supabase';
import { checkPlaylistFormCompletion } from './playlists';

/**
 * Check if a playlist has a required form that blocks completion.
 * Returns true if no form is required OR the form has been completed.
 */
async function isPlaylistFormFulfilled(playlistId: string, userId: string): Promise<boolean> {
  const { data: playlist } = await supabase
    .from('playlists')
    .select('required_form_id, form_completion_mode')
    .eq('id', playlistId)
    .single();

  if (!playlist?.required_form_id) return true;

  const mode = playlist.form_completion_mode || 'optional';
  if (mode === 'optional') return true;

  // For 'required' and 'required_before_completion', check if form has been submitted
  const submission = await checkPlaylistFormCompletion(playlistId, userId);
  return !!submission;
}

/**
 * Calculate progress for a single assignment based on track completions
 * Uses track_completions table as source of truth
 */
export async function calculateAssignmentProgress(assignmentId: string): Promise<number> {
  try {
    // Get assignment details
    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select('playlist_id, user_id')
      .eq('id', assignmentId)
      .single();

    if (assignmentError) throw assignmentError;
    if (!assignment?.playlist_id) return 0;

    // Get all tracks in the playlist
    const { data: playlistTracks, error: tracksError } = await supabase
      .from('playlist_tracks')
      .select('track_id')
      .eq('playlist_id', assignment.playlist_id);

    if (tracksError) throw tracksError;
    if (!playlistTracks || playlistTracks.length === 0) return 0;

    const totalTracks = playlistTracks.length;
    const trackIds = playlistTracks.map(pt => pt.track_id);

    // Get completed tracks from track_completions (source of truth)
    const { data: completedTracks, error: completionsError } = await supabase
      .from('track_completions')
      .select('track_id')
      .eq('user_id', assignment.user_id)
      .in('track_id', trackIds);

    if (completionsError) throw completionsError;

    const completedCount = completedTracks?.length || 0;
    const progressPercent = Math.round((completedCount / totalTracks) * 100);

    return progressPercent;
  } catch (error) {
    console.error('Error calculating assignment progress:', error);
    return 0;
  }
}

/**
 * Update assignment progress_percent in database
 * Also updates status based on progress
 */
export async function updateAssignmentProgress(assignmentId: string): Promise<void> {
  try {
    const progressPercent = await calculateAssignmentProgress(assignmentId);

    // Get assignment details for form completion check
    const { data: assignment } = await supabase
      .from('assignments')
      .select('playlist_id, user_id')
      .eq('id', assignmentId)
      .single();

    // Determine status based on progress
    // If tracks are 100% complete but required form is not fulfilled, stay at in_progress
    let status = 'assigned';
    let isFullyComplete = progressPercent === 100;

    if (isFullyComplete && assignment?.playlist_id && assignment?.user_id) {
      const formFulfilled = await isPlaylistFormFulfilled(assignment.playlist_id, assignment.user_id);
      if (!formFulfilled) {
        // All tracks done but form not yet submitted — keep as in_progress
        isFullyComplete = false;
      }
    }

    if (isFullyComplete) {
      status = 'completed';
    } else if (progressPercent > 0) {
      status = 'in_progress';
    }

    const { error } = await supabase
      .from('assignments')
      .update({
        progress_percent: progressPercent,
        status: status,
        updated_at: new Date().toISOString(),
        completed_at: isFullyComplete ? new Date().toISOString() : null
      })
      .eq('id', assignmentId);

    if (error) throw error;

    console.log(`✅ Assignment ${assignmentId} progress updated: ${progressPercent}%`);
  } catch (error) {
    console.error('Error updating assignment progress:', error);
    throw error;
  }
}

/**
 * Calculate overall progress for a user across all their assignments
 */
export async function calculateUserOverallProgress(userId: string): Promise<number> {
  try {
    const { data: assignments, error } = await supabase
      .from('assignments')
      .select('progress_percent')
      .eq('user_id', userId);

    if (error) throw error;
    if (!assignments || assignments.length === 0) return 0;

    const totalProgress = assignments.reduce((sum, a) => sum + (a.progress_percent || 0), 0);
    const averageProgress = Math.round(totalProgress / assignments.length);

    return averageProgress;
  } catch (error) {
    console.error('Error calculating user overall progress:', error);
    return 0;
  }
}

/**
 * Calculate organization-wide completion metrics
 */
export async function calculateOrgMetrics(organizationId: string): Promise<{
  totalAssignments: number;
  completedAssignments: number;
  inProgressAssignments: number;
  averageCompletion: number;
}> {
  try {
    const { data: assignments, error } = await supabase
      .from('assignments')
      .select('status, progress_percent')
      .eq('organization_id', organizationId);

    if (error) throw error;

    const totalAssignments = assignments?.length || 0;
    const completedAssignments = assignments?.filter(a => a.status === 'completed').length || 0;
    const inProgressAssignments = assignments?.filter(a => a.status === 'in_progress').length || 0;
    
    const totalProgress = assignments?.reduce((sum, a) => sum + (a.progress_percent || 0), 0) || 0;
    const averageCompletion = totalAssignments > 0 ? Math.round(totalProgress / totalAssignments) : 0;

    return {
      totalAssignments,
      completedAssignments,
      inProgressAssignments,
      averageCompletion
    };
  } catch (error) {
    console.error('Error calculating org metrics:', error);
    return {
      totalAssignments: 0,
      completedAssignments: 0,
      inProgressAssignments: 0,
      averageCompletion: 0
    };
  }
}

/**
 * Recalculate progress for all assignments in an organization
 * Useful for data migration or fixing stale progress values
 */
export async function recalculateAllProgress(organizationId: string): Promise<{
  success: boolean;
  processed: number;
  errors: number;
}> {
  try {
    const { data: assignments, error } = await supabase
      .from('assignments')
      .select('id')
      .eq('organization_id', organizationId);

    if (error) throw error;
    if (!assignments) return { success: true, processed: 0, errors: 0 };

    console.log(`🔄 Recalculating progress for ${assignments.length} assignments...`);

    let processed = 0;
    let errors = 0;

    // Process in batches to avoid timeout
    const batchSize = 10;
    for (let i = 0; i < assignments.length; i += batchSize) {
      const batch = assignments.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(a => updateAssignmentProgress(a.id))
      );

      results.forEach(result => {
        if (result.status === 'fulfilled') {
          processed++;
        } else {
          errors++;
          console.error('Batch error:', result.reason);
        }
      });

      console.log(`Progress: ${Math.min(i + batchSize, assignments.length)}/${assignments.length}`);
    }

    console.log(`✅ Recalculation complete: ${processed} succeeded, ${errors} failed`);
    return { success: true, processed, errors };
  } catch (error) {
    console.error('Error recalculating all progress:', error);
    return { success: false, processed: 0, errors: 0 };
  }
}

/**
 * Get detailed assignment progress breakdown
 * Shows which tracks are completed vs remaining
 */
export async function getAssignmentProgressDetails(assignmentId: string): Promise<{
  totalTracks: number;
  completedTracks: number;
  remainingTracks: number;
  progressPercent: number;
  tracks: Array<{
    trackId: string;
    trackTitle: string;
    isCompleted: boolean;
    completedAt?: string;
  }>;
}> {
  try {
    // Get assignment
    const { data: assignment, error: assignmentError } = await supabase
      .from('assignments')
      .select('playlist_id, user_id')
      .eq('id', assignmentId)
      .single();

    if (assignmentError) throw assignmentError;

    // Get all tracks in playlist
    const { data: playlistTracks, error: tracksError } = await supabase
      .from('playlist_tracks')
      .select(`
        track_id,
        tracks:tracks(id, title)
      `)
      .eq('playlist_id', assignment.playlist_id)
      .order('display_order', { ascending: true });

    if (tracksError) throw tracksError;

    // Get user's completions
    const trackIds = playlistTracks?.map(pt => pt.track_id) || [];
    const { data: completions, error: completionsError } = await supabase
      .from('track_completions')
      .select('track_id, completed_at')
      .eq('user_id', assignment.user_id)
      .in('track_id', trackIds);

    if (completionsError) throw completionsError;

    const completionMap = new Map(
      completions?.map(c => [c.track_id, c.completed_at]) || []
    );

    const tracks = playlistTracks?.map(pt => ({
      trackId: pt.track_id,
      trackTitle: (pt.tracks as any)?.title || 'Unknown Track',
      isCompleted: completionMap.has(pt.track_id),
      completedAt: completionMap.get(pt.track_id)
    })) || [];

    const totalTracks = tracks.length;
    const completedTracks = tracks.filter(t => t.isCompleted).length;
    const remainingTracks = totalTracks - completedTracks;
    const progressPercent = totalTracks > 0 ? Math.round((completedTracks / totalTracks) * 100) : 0;

    return {
      totalTracks,
      completedTracks,
      remainingTracks,
      progressPercent,
      tracks
    };
  } catch (error) {
    console.error('Error getting assignment progress details:', error);
    return {
      totalTracks: 0,
      completedTracks: 0,
      remainingTracks: 0,
      progressPercent: 0,
      tracks: []
    };
  }
}
