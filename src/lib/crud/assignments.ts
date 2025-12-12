// ============================================================================
// ASSIGNMENTS CRUD OPERATIONS
// ============================================================================

import { supabase, getCurrentUserOrgId, getCurrentUserProfile } from '../supabase';
import { createNotification } from './notifications';
import { logActivity } from './activity';

export interface CreateAssignmentInput {
  title: string;
  playlist_id: string; // Changed from assignable_type/assignable_id to direct playlist_id
  user_id: string; // Changed from assignment_type/target_id to direct user_id
  due_date?: string;
}

/**
 * Create assignment for a single user to a playlist
 */
export async function createAssignment(input: CreateAssignmentInput) {
  // Input validation
  if (!input.user_id || typeof input.user_id !== 'string') {
    throw new Error('Invalid user_id: must be a non-empty string');
  }
  if (!input.playlist_id || typeof input.playlist_id !== 'string') {
    throw new Error('Invalid playlist_id: must be a non-empty string');
  }
  if (!input.title || typeof input.title !== 'string' || input.title.trim().length === 0) {
    throw new Error('Invalid title: must be a non-empty string');
  }
  if (input.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(input.due_date)) {
    throw new Error('Invalid due_date: must be in YYYY-MM-DD format');
  }

  const orgId = await getCurrentUserOrgId();
  const userProfile = await getCurrentUserProfile();
  
  if (!orgId || !userProfile) throw new Error('User not authenticated');

  // Create the assignment using the ACTUAL database schema
  const { data: assignment, error } = await supabase
    .from('assignments')
    .insert({
      organization_id: orgId,
      user_id: input.user_id,
      playlist_id: input.playlist_id,
      status: 'assigned',
      progress_percent: 0,
      due_date: input.due_date,
    })
    .select()
    .single();

  if (error) throw error;

  // Create notification for the user (non-critical - wrap in try-catch)
  try {
    await createNotification({
      user_id: input.user_id,
      type: 'assignment',
      title: 'New Assignment',
      message: `You have been assigned: ${input.title}`,
      link_url: `/assignments/${assignment.id}`
    });
  } catch (error) {
    // Log error but don't fail the assignment creation
    console.error('Failed to create assignment notification:', error);
  }

  // Log activity (non-critical - wrap in try-catch)
  try {
    await logActivity({
      user_id: userProfile.id,
      action: 'assignment',
      entity_type: 'playlist',
      entity_id: input.playlist_id,
      description: `Assigned "${input.title}" to user`
    });
  } catch (error) {
    // Log error but don't fail the assignment creation
    console.error('Failed to log assignment activity:', error);
  }

  return assignment;
}

/**
 * Update assignment (change due date or target)
 */
export async function updateAssignment(
  assignmentId: string,
  updates: {
    title?: string;
    due_date?: string;
    target_id?: string;
    assignment_type?: string;
  }
) {
  // Input validation
  if (!assignmentId || typeof assignmentId !== 'string') {
    throw new Error('Invalid assignmentId: must be a non-empty string');
  }
  if (updates.title !== undefined && (typeof updates.title !== 'string' || updates.title.trim().length === 0)) {
    throw new Error('Invalid title: must be a non-empty string');
  }
  if (updates.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(updates.due_date)) {
    throw new Error('Invalid due_date: must be in YYYY-MM-DD format');
  }
  if (updates.target_id && typeof updates.target_id !== 'string') {
    throw new Error('Invalid target_id: must be a string if provided');
  }
  if (updates.assignment_type && !['user', 'store', 'district', 'role'].includes(updates.assignment_type)) {
    throw new Error('Invalid assignment_type: must be one of user, store, district, or role');
  }
  const { data, error } = await supabase
    .from('assignments')
    .update(updates)
    .eq('id', assignmentId)
    .select()
    .single();

  if (error) throw error;

  // If target changed, need to update progress records
  if (updates.target_id || updates.assignment_type) {
    await recalculateProgressRecords(assignmentId);
  }

  return data;
}

/**
 * Mark assignment as expired (soft delete)
 */
export async function expireAssignment(assignmentId: string) {
  const { data, error } = await supabase
    .from('assignments')
    .update({ status: 'expired' })
    .eq('id', assignmentId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Auto-complete assignment when all content is finished
 */
export async function checkAndCompleteAssignment(assignmentId: string) {
  const { data: assignment } = await supabase
    .from('assignments')
    .select('*')
    .eq('id', assignmentId)
    .single();

  if (!assignment) return;

  // Check if all progress is completed
  let allCompleted = false;

  if (assignment.assignable_type === 'track') {
    const { data: progress } = await supabase
      .from('track_progress')
      .select('status')
      .eq('assignment_id', assignmentId);

    allCompleted = progress?.every(p => p.status === 'completed') || false;
  } else if (assignment.assignable_type === 'album') {
    const { data: progress } = await supabase
      .from('album_progress')
      .select('progress_percentage')
      .eq('assignment_id', assignmentId);

    allCompleted = progress?.every(p => p.progress_percentage === 100) || false;
  } else if (assignment.assignable_type === 'playlist') {
    const { data: progress } = await supabase
      .from('playlist_progress')
      .select('progress_percentage')
      .eq('assignment_id', assignmentId);

    allCompleted = progress?.every(p => p.progress_percentage === 100) || false;
  }

  // Update assignment status if all completed
  if (allCompleted) {
    await supabase
      .from('assignments')
      .update({ status: 'completed' })
      .eq('id', assignmentId);
  }
}

/**
 * Get assignments with filters
 */
export async function getAssignments(filters: {
  status?: string;
  assignable_type?: string;
  assignment_type?: string;
  search?: string;
} = {}) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  let query = supabase
    .from('assignments')
    .select(`
      *,
      assigned_by:users!assignments_assigned_by_fkey(id, first_name, last_name, email),
      playlist:playlists(id, title, description)
    `)
    .eq('organization_id', orgId);

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.assignable_type) {
    query = query.eq('assignable_type', filters.assignable_type);
  }

  if (filters.assignment_type) {
    query = query.eq('assignment_type', filters.assignment_type);
  }

  if (filters.search) {
    query = query.ilike('title', `%${filters.search}%`);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  
  if (!data || data.length === 0) {
    return [];
  }
  
  // Batch query all affected users to avoid N+1 problem
  // Group assignments by assignment_type and target_id
  const userQueries = new Map<string, Promise<string[]>>();
  const assignmentKeys: Array<{ assignment: any; key: string }> = [];
  
  for (const assignment of data) {
    const key = `${assignment.assignment_type}:${assignment.target_id}`;
    assignmentKeys.push({ assignment, key });
    
    // Only create query if we haven't seen this key before
    if (!userQueries.has(key)) {
      userQueries.set(key, getAffectedUsers(
        assignment.assignment_type,
        assignment.target_id,
        orgId
      ));
    }
  }
  
  // Execute all queries in parallel
  const userQueryResults = await Promise.all(
    Array.from(userQueries.entries()).map(async ([key, promise]) => {
      const users = await promise;
      return [key, users] as [string, string[]];
    })
  );
  
  // Create lookup map
  const usersByKey = new Map(userQueryResults);
  
  // Enrich assignments with learner counts
  const enrichedData = assignmentKeys.map(({ assignment, key }) => {
    const affectedUsers = usersByKey.get(key) || [];
    return {
      ...assignment,
      learner_count: affectedUsers.length
    };
  });
  
  return enrichedData;
}

/**
 * Get assignments for a specific user
 */
export async function getAssignmentsForUser(userId: string) {
  const { data, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('target_id', userId)
    .eq('assignment_type', 'user')
    .eq('status', 'active')
    .order('due_date', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Run auto-playlist trigger manually
 */
export async function runPlaylistTrigger(playlistId: string) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  // Get playlist with trigger rules
  const { data: playlist } = await supabase
    .from('playlists')
    .select('*, trigger_rules')
    .eq('id', playlistId)
    .single();

  if (!playlist || playlist.type !== 'auto' || !playlist.trigger_rules) {
    throw new Error('Invalid auto-playlist');
  }

  // Get matching users based on trigger rules
  const matchingUsers = await getMatchingUsers(playlist.trigger_rules, orgId);

  // Create assignments for all matching users using the correct schema
  const assignments = [];
  for (const userId of matchingUsers) {
    const assignment = await createAssignment({
      title: playlist.title,
      playlist_id: playlistId,
      user_id: userId,
    });
    assignments.push(assignment);
  }

  return assignments;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get all affected users based on assignment type and target
 */
export async function getAffectedUsers(
  assignmentType: string,
  targetId: string,
  orgId: string
): Promise<string[]> {
  if (assignmentType === 'user') {
    return [targetId];
  }

  if (assignmentType === 'store') {
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('store_id', targetId)
      .eq('status', 'active');

    return users?.map(u => u.id) || [];
  }

  if (assignmentType === 'district') {
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('district_id', targetId)
      .eq('status', 'active');

    return users?.map(u => u.id) || [];
  }

  if (assignmentType === 'role') {
    const { data: users } = await supabase
      .from('users')
      .select('id')
      .eq('role_id', targetId)
      .eq('status', 'active');

    return users?.map(u => u.id) || [];
  }

  return [];
}

/**
 * Create progress records for all users based on assignable type
 */
async function createProgressRecords(
  assignmentId: string,
  assignableType: string,
  assignableId: string,
  userIds: string[]
) {
  if (assignableType === 'track') {
    // Create track_progress for each user
    const records = userIds.map(userId => ({
      user_id: userId,
      track_id: assignableId,
      assignment_id: assignmentId,
      status: 'not-started',
      progress_percentage: 0
    }));

    await supabase.from('track_progress').insert(records);
  } else if (assignableType === 'album') {
    // Get all tracks in album
    const { data: albumTracks } = await supabase
      .from('album_tracks')
      .select('track_id, album_id')
      .eq('album_id', assignableId);

    const trackCount = albumTracks?.length || 0;

    // Create album_progress
    const albumRecords = userIds.map(userId => ({
      user_id: userId,
      album_id: assignableId,
      assignment_id: assignmentId,
      tracks_total: trackCount,
      tracks_completed: 0,
      progress_percentage: 0
    }));

    await supabase.from('album_progress').insert(albumRecords);

    // Create track_progress for each track in album
    const trackRecords = userIds.flatMap(userId =>
      (albumTracks || []).map(at => ({
        user_id: userId,
        track_id: at.track_id,
        assignment_id: assignmentId,
        status: 'not-started',
        progress_percentage: 0
      }))
    );

    if (trackRecords.length > 0) {
      await supabase.from('track_progress').insert(trackRecords);
    }
  } else if (assignableType === 'playlist') {
    // Get all albums in playlist
    const { data: playlistAlbums } = await supabase
      .from('playlist_albums')
      .select('album_id, playlist_id')
      .eq('playlist_id', assignableId);

    const albumCount = playlistAlbums?.length || 0;

    // Create playlist_progress
    const playlistRecords = userIds.map(userId => ({
      user_id: userId,
      playlist_id: assignableId,
      assignment_id: assignmentId,
      albums_total: albumCount,
      albums_completed: 0,
      progress_percentage: 0
    }));

    await supabase.from('playlist_progress').insert(playlistRecords);

    // Create album and track progress for each album in playlist
    for (const playlistAlbum of playlistAlbums || []) {
      const { data: albumTracks } = await supabase
        .from('album_tracks')
        .select('track_id')
        .eq('album_id', playlistAlbum.album_id);

      const trackCount = albumTracks?.length || 0;

      // Album progress
      const albumRecords = userIds.map(userId => ({
        user_id: userId,
        album_id: playlistAlbum.album_id,
        assignment_id: assignmentId,
        tracks_total: trackCount,
        tracks_completed: 0,
        progress_percentage: 0
      }));

      await supabase.from('album_progress').insert(albumRecords);

      // Track progress
      const trackRecords = userIds.flatMap(userId =>
        (albumTracks || []).map(at => ({
          user_id: userId,
          track_id: at.track_id,
          assignment_id: assignmentId,
          status: 'not-started',
          progress_percentage: 0
        }))
      );

      if (trackRecords.length > 0) {
        await supabase.from('track_progress').insert(trackRecords);
      }
    }
  }
}

/**
 * Get users matching auto-playlist trigger rules
 */
async function getMatchingUsers(
  triggerRules: any,
  orgId: string
): Promise<string[]> {
  let query = supabase
    .from('users')
    .select('id')
    .eq('organization_id', orgId)
    .eq('status', 'active');

  // Apply trigger rules
  if (triggerRules.role_ids && triggerRules.role_ids.length > 0) {
    query = query.in('role_id', triggerRules.role_ids);
  }

  if (triggerRules.hire_days) {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - triggerRules.hire_days);
    query = query.gte('hire_date', daysAgo.toISOString().split('T')[0]);
  }

  if (triggerRules.store_ids && triggerRules.store_ids.length > 0) {
    query = query.in('store_id', triggerRules.store_ids);
  }

  if (triggerRules.district_ids && triggerRules.district_ids.length > 0) {
    query = query.in('district_id', triggerRules.district_ids);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data?.map(u => u.id) || [];
}

/**
 * Recalculate progress records when assignment target changes
 */
async function recalculateProgressRecords(assignmentId: string) {
  // Get current assignment
  const { data: assignment } = await supabase
    .from('assignments')
    .select('*')
    .eq('id', assignmentId)
    .single();

  if (!assignment) return;

  const orgId = assignment.organization_id;

  // Delete old progress records
  await supabase.from('track_progress').delete().eq('assignment_id', assignmentId);
  await supabase.from('album_progress').delete().eq('assignment_id', assignmentId);
  await supabase.from('playlist_progress').delete().eq('assignment_id', assignmentId);

  // Get new affected users
  const affectedUsers = await getAffectedUsers(
    assignment.assignment_type,
    assignment.target_id,
    orgId
  );

  // Create new progress records
  await createProgressRecords(
    assignmentId,
    assignment.assignable_type,
    assignment.assignable_id,
    affectedUsers
  );
}