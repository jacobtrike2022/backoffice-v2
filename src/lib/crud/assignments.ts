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
      type: 'assignment_new',
      title: 'New Assignment',
      message: `You have been assigned: ${input.title}`,
      link_type: 'assignment',
      link_id: assignment.id
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

  // Get existing assignments for this playlist to prevent duplicates
  const { data: existingAssignments } = await supabase
    .from('assignments')
    .select('user_id')
    .eq('playlist_id', playlistId)
    .in('status', ['assigned', 'in_progress', 'completed']);

  const existingUserIds = new Set(existingAssignments?.map(a => a.user_id) || []);

  // Filter out users who already have this assignment
  const newUsers = matchingUsers.filter(userId => !existingUserIds.has(userId));

  console.log(`🎯 Trigger: ${matchingUsers.length} users match criteria, ${newUsers.length} new assignments needed`);

  // Create assignments for new users only
  const assignments = [];
  for (const userId of newUsers) {
    try {
      const assignment = await createAssignment({
        title: playlist.title,
        playlist_id: playlistId,
        user_id: userId,
      });
      assignments.push(assignment);
    } catch (err) {
      // Log individual failures but continue with other users
      console.error(`Failed to create assignment for user ${userId}:`, err);
    }
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
 * Uses database function for consistent matching logic
 */
async function getMatchingUsers(
  triggerRules: any,
  orgId: string
): Promise<string[]> {
  // Try to use the database function first (more reliable, handles both UUID and name matching)
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('get_users_matching_trigger_rules', {
      p_organization_id: orgId,
      p_trigger_rules: triggerRules
    });

  if (!rpcError && rpcData) {
    return rpcData.map((u: any) => u.user_id);
  }

  // Fallback to direct query if function doesn't exist yet
  console.warn('Database function not available, using fallback query');

  // Check if role_ids are UUIDs or role names
  const roleIds = triggerRules.role_ids || [];
  const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  const hasRoleNames = roleIds.length > 0 && !isUUID(roleIds[0]);

  // If we have role names instead of UUIDs, we need to look up the role IDs first
  let resolvedRoleIds = roleIds;
  if (hasRoleNames && roleIds.length > 0) {
    const { data: roles } = await supabase
      .from('roles')
      .select('id, name')
      .eq('organization_id', orgId)
      .in('name', roleIds);

    resolvedRoleIds = roles?.map(r => r.id) || [];
    console.log(`Resolved ${roleIds.length} role names to ${resolvedRoleIds.length} role IDs`);
  }

  let query = supabase
    .from('users')
    .select('id')
    .eq('organization_id', orgId)
    .eq('status', 'active');

  // Apply trigger rules
  if (resolvedRoleIds.length > 0) {
    query = query.in('role_id', resolvedRoleIds);
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

// ============================================================================
// PREVIEW & ACTIVITY FUNCTIONS (for UI)
// ============================================================================

export interface MatchingUser {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role_name: string | null;
  store_name: string | null;
  hire_date: string | null;
}

export interface AssignmentHistoryEntry {
  assignment_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role_name: string | null;
  store_name: string | null;
  hire_date: string | null;
  assigned_at: string;
  progress_percent: number;
  status: string;
  completed_at: string | null;
}

export interface TriggerRulesImpact {
  population: 'orphaned' | 'new_match';
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role_name: string | null;
  current_status: string | null;
  progress_percent: number | null;
}

/**
 * Get users that match trigger rules (for preview in wizard)
 * Returns first 20 by default, with total count
 */
export async function getMatchingUsersPreview(
  triggerRules: any,
  limit: number = 20
): Promise<{ users: MatchingUser[]; totalCount: number }> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  console.log('🔍 getMatchingUsersPreview called with:', { triggerRules, orgId });

  // Try database function first
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('get_users_matching_trigger_rules', {
      p_organization_id: orgId,
      p_trigger_rules: triggerRules
    });

  if (!rpcError && rpcData) {
    console.log('✅ RPC function returned', rpcData.length, 'users');
    const totalCount = rpcData.length;
    const users = rpcData.slice(0, limit) as MatchingUser[];
    return { users, totalCount };
  }

  console.log('⚠️ RPC failed or unavailable, using fallback. Error:', rpcError?.message);

  // Fallback: direct query with user details
  // First, check if role_ids are UUIDs or role names and resolve if needed
  const roleIds = triggerRules.role_ids || [];
  console.log('📋 Role IDs from trigger rules:', roleIds);

  const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  const hasRoleNames = roleIds.length > 0 && !isUUID(roleIds[0]);
  console.log('📋 Are these role names (not UUIDs)?', hasRoleNames);

  let resolvedRoleIds = roleIds;
  if (hasRoleNames && roleIds.length > 0) {
    // Look up roles by name
    const { data: roles, error: rolesError } = await supabase
      .from('roles')
      .select('id, name')
      .eq('organization_id', orgId)
      .in('name', roleIds);

    console.log('🎭 Role lookup result:', { roles, rolesError });

    if (roles && roles.length > 0) {
      resolvedRoleIds = roles.map(r => r.id);
      console.log(`✅ Resolved ${roleIds.length} role names to ${resolvedRoleIds.length} role IDs:`, resolvedRoleIds);
    } else {
      console.log('❌ No roles found matching names:', roleIds);
      // If no role IDs resolved, return empty - no point querying users
      return { users: [], totalCount: 0 };
    }
  }

  let query = supabase
    .from('users')
    .select(`
      id,
      first_name,
      last_name,
      email,
      hire_date,
      role_id,
      store_id
    `)
    .eq('organization_id', orgId)
    .eq('status', 'active');

  if (resolvedRoleIds.length > 0) {
    query = query.in('role_id', resolvedRoleIds);
  }

  if (triggerRules.store_ids && triggerRules.store_ids.length > 0) {
    query = query.in('store_id', triggerRules.store_ids);
  }

  if (triggerRules.hire_days) {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - triggerRules.hire_days);
    query = query.gte('hire_date', daysAgo.toISOString().split('T')[0]);
  }

  const { data, error } = await query.order('last_name').order('first_name');

  console.log('👥 User query result:', { count: data?.length || 0, error: error?.message });

  if (error) {
    console.error('❌ User query error:', error);
    throw error;
  }

  // Get role names for the users we found
  const userRoleIds = [...new Set((data || []).map((u: any) => u.role_id).filter(Boolean))];
  let roleNameMap: Record<string, string> = {};
  if (userRoleIds.length > 0) {
    const { data: roles } = await supabase
      .from('roles')
      .select('id, name')
      .in('id', userRoleIds);
    roleNameMap = Object.fromEntries((roles || []).map(r => [r.id, r.name]));
  }

  // Get store names for the users we found
  const userStoreIds = [...new Set((data || []).map((u: any) => u.store_id).filter(Boolean))];
  let storeNameMap: Record<string, string> = {};
  if (userStoreIds.length > 0) {
    const { data: stores } = await supabase
      .from('stores')
      .select('id, name')
      .in('id', userStoreIds);
    storeNameMap = Object.fromEntries((stores || []).map(s => [s.id, s.name]));
  }

  const totalCount = data?.length || 0;
  const users: MatchingUser[] = (data || []).slice(0, limit).map((u: any) => ({
    user_id: u.id,
    first_name: u.first_name,
    last_name: u.last_name,
    email: u.email,
    role_name: u.role_id ? roleNameMap[u.role_id] || null : null,
    store_name: u.store_id ? storeNameMap[u.store_id] || null : null,
    hire_date: u.hire_date
  }));

  console.log('✅ Returning', totalCount, 'matching users');
  return { users, totalCount };
}

/**
 * Get assignment history for a playlist (for activity feed)
 */
export async function getPlaylistAssignmentHistory(
  playlistId: string,
  limit: number = 20
): Promise<AssignmentHistoryEntry[]> {
  // Try database function first
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('get_playlist_assignment_history', {
      p_playlist_id: playlistId,
      p_limit: limit
    });

  if (!rpcError && rpcData) {
    return rpcData as AssignmentHistoryEntry[];
  }

  // Fallback: direct query - specify the foreign key to use
  const { data, error } = await supabase
    .from('assignments')
    .select(`
      id,
      user_id,
      assigned_at,
      progress_percent,
      status,
      completed_at,
      user:users!assignments_user_id_fkey(
        first_name,
        last_name,
        email,
        hire_date,
        role_id,
        store_id
      )
    `)
    .eq('playlist_id', playlistId)
    .order('assigned_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  // Get unique role_ids to look up role names
  const roleIds = [...new Set((data || []).map((a: any) => a.user?.role_id).filter(Boolean))];
  let roleNameMap: Record<string, string> = {};
  if (roleIds.length > 0) {
    const { data: roles } = await supabase
      .from('roles')
      .select('id, name')
      .in('id', roleIds);
    roleNameMap = Object.fromEntries((roles || []).map(r => [r.id, r.name]));
  }

  // Get unique store_ids to look up store names
  const storeIds = [...new Set((data || []).map((a: any) => a.user?.store_id).filter(Boolean))];
  let storeNameMap: Record<string, string> = {};
  if (storeIds.length > 0) {
    const { data: stores } = await supabase
      .from('stores')
      .select('id, name')
      .in('id', storeIds);
    storeNameMap = Object.fromEntries((stores || []).map(s => [s.id, s.name]));
  }

  return (data || []).map((a: any) => ({
    assignment_id: a.id,
    user_id: a.user_id,
    first_name: a.user?.first_name || '',
    last_name: a.user?.last_name || '',
    email: a.user?.email || '',
    role_name: a.user?.role_id ? roleNameMap[a.user.role_id] || null : null,
    store_name: a.user?.store_id ? storeNameMap[a.user.store_id] || null : null,
    hire_date: a.user?.hire_date || null,
    assigned_at: a.assigned_at,
    progress_percent: a.progress_percent || 0,
    status: a.status,
    completed_at: a.completed_at
  }));
}

/**
 * Get ALL assignment history for CSV export (no limit)
 */
export async function getPlaylistAssignmentHistoryForExport(
  playlistId: string
): Promise<AssignmentHistoryEntry[]> {
  const { data, error } = await supabase
    .from('assignments')
    .select(`
      id,
      user_id,
      assigned_at,
      progress_percent,
      status,
      completed_at,
      user:users!assignments_user_id_fkey(
        first_name,
        last_name,
        email,
        hire_date,
        role_id,
        store_id
      )
    `)
    .eq('playlist_id', playlistId)
    .order('assigned_at', { ascending: false });

  if (error) throw error;

  // Get unique role_ids to look up role names
  const roleIds = [...new Set((data || []).map((a: any) => a.user?.role_id).filter(Boolean))];
  let roleNameMap: Record<string, string> = {};
  if (roleIds.length > 0) {
    const { data: roles } = await supabase
      .from('roles')
      .select('id, name')
      .in('id', roleIds);
    roleNameMap = Object.fromEntries((roles || []).map(r => [r.id, r.name]));
  }

  // Get unique store_ids to look up store names
  const storeIds = [...new Set((data || []).map((a: any) => a.user?.store_id).filter(Boolean))];
  let storeNameMap: Record<string, string> = {};
  if (storeIds.length > 0) {
    const { data: stores } = await supabase
      .from('stores')
      .select('id, name')
      .in('id', storeIds);
    storeNameMap = Object.fromEntries((stores || []).map(s => [s.id, s.name]));
  }

  return (data || []).map((a: any) => ({
    assignment_id: a.id,
    user_id: a.user_id,
    first_name: a.user?.first_name || '',
    last_name: a.user?.last_name || '',
    email: a.user?.email || '',
    role_name: a.user?.role_id ? roleNameMap[a.user.role_id] || null : null,
    store_name: a.user?.store_id ? storeNameMap[a.user.store_id] || null : null,
    hire_date: a.user?.hire_date || null,
    assigned_at: a.assigned_at,
    progress_percent: a.progress_percent || 0,
    status: a.status,
    completed_at: a.completed_at
  }));
}

/**
 * Get ALL matching users for CSV export (no limit)
 */
export async function getMatchingUsersForExport(
  triggerRules: any
): Promise<MatchingUser[]> {
  const result = await getMatchingUsersPreview(triggerRules, 10000); // Large limit for export
  return result.users;
}

/**
 * Compare old vs new trigger rules to see impact of edit
 * Returns orphaned assignments and new matches
 */
export async function compareTriggerRulesImpact(
  playlistId: string,
  newTriggerRules: any
): Promise<{ orphaned: TriggerRulesImpact[]; newMatches: TriggerRulesImpact[] }> {
  // Try database function first
  const { data: rpcData, error: rpcError } = await supabase
    .rpc('compare_trigger_rules_impact', {
      p_playlist_id: playlistId,
      p_new_trigger_rules: newTriggerRules
    });

  if (!rpcError && rpcData) {
    const orphaned = rpcData.filter((r: any) => r.population === 'orphaned');
    const newMatches = rpcData.filter((r: any) => r.population === 'new_match');
    return { orphaned, newMatches };
  }

  // Fallback: compute in JS
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  // Get current active assignments - specify the foreign key to use
  const { data: currentAssignments } = await supabase
    .from('assignments')
    .select(`
      user_id,
      status,
      progress_percent,
      user:users!assignments_user_id_fkey(first_name, last_name, email, role_id)
    `)
    .eq('playlist_id', playlistId)
    .in('status', ['assigned', 'in_progress']);

  // Get role names for the users
  const roleIds = [...new Set((currentAssignments || []).map((a: any) => a.user?.role_id).filter(Boolean))];
  let roleNameMap: Record<string, string> = {};
  if (roleIds.length > 0) {
    const { data: roles } = await supabase
      .from('roles')
      .select('id, name')
      .in('id', roleIds);
    roleNameMap = Object.fromEntries((roles || []).map(r => [r.id, r.name]));
  }

  // Get users matching new rules
  const newMatchingUsers = await getMatchingUsers(newTriggerRules, orgId);
  const newMatchingSet = new Set(newMatchingUsers);

  // Find orphaned (have assignment but don't match new rules)
  const orphaned: TriggerRulesImpact[] = (currentAssignments || [])
    .filter((a: any) => !newMatchingSet.has(a.user_id))
    .map((a: any) => ({
      population: 'orphaned' as const,
      user_id: a.user_id,
      first_name: a.user?.first_name || '',
      last_name: a.user?.last_name || '',
      email: a.user?.email || '',
      role_name: a.user?.role_id ? roleNameMap[a.user.role_id] || null : null,
      current_status: a.status,
      progress_percent: a.progress_percent
    }));

  // Find new matches (match new rules but don't have assignment)
  const existingUserIds = new Set((currentAssignments || []).map((a: any) => a.user_id));

  // Also exclude users who already completed
  const { data: completedAssignments } = await supabase
    .from('assignments')
    .select('user_id')
    .eq('playlist_id', playlistId)
    .eq('status', 'completed');

  const completedUserIds = new Set((completedAssignments || []).map((a: any) => a.user_id));

  const { users: allNewMatching } = await getMatchingUsersPreview(newTriggerRules, 1000);
  const newMatches: TriggerRulesImpact[] = allNewMatching
    .filter(u => !existingUserIds.has(u.user_id) && !completedUserIds.has(u.user_id))
    .map(u => ({
      population: 'new_match' as const,
      user_id: u.user_id,
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      role_name: u.role_name,
      current_status: null,
      progress_percent: null
    }));

  return { orphaned, newMatches };
}

/**
 * Archive orphaned assignments when trigger rules change
 */
export async function archiveOrphanedAssignments(
  playlistId: string,
  userIds: string[]
): Promise<number> {
  if (userIds.length === 0) return 0;

  const { data, error } = await supabase
    .from('assignments')
    .update({ status: 'expired' })
    .eq('playlist_id', playlistId)
    .in('user_id', userIds)
    .in('status', ['assigned', 'in_progress'])
    .select();

  if (error) throw error;
  return data?.length || 0;
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