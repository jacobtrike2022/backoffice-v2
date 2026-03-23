// ============================================================================
// USERS CRUD OPERATIONS
// ============================================================================

import { supabase, getCurrentUserOrgId } from '../supabase';

export interface CreateUserInput {
  email: string;
  first_name: string;
  last_name: string;
  role_id: string;
  store_id?: string;
  employee_id?: string;
  hire_date?: string;
  phone?: string;
  organization_id?: string;
}

/**
 * Create a new user and send invite email
 */
export async function createUser(input: CreateUserInput) {
  // Input validation
  if (!input.email || typeof input.email !== 'string' || !input.email.includes('@')) {
    throw new Error('Invalid email: must be a valid email address');
  }
  if (!input.first_name || typeof input.first_name !== 'string' || input.first_name.trim().length === 0) {
    throw new Error('Invalid first_name: must be a non-empty string');
  }
  if (!input.last_name || typeof input.last_name !== 'string' || input.last_name.trim().length === 0) {
    throw new Error('Invalid last_name: must be a non-empty string');
  }
  if (!input.role_id || typeof input.role_id !== 'string') {
    throw new Error('Invalid role_id: must be a non-empty string');
  }
  if (input.store_id && typeof input.store_id !== 'string') {
    throw new Error('Invalid store_id: must be a string if provided');
  }
  if (input.phone && typeof input.phone !== 'string') {
    throw new Error('Invalid phone: must be a string if provided');
  }
  if (input.hire_date && !/^\d{4}-\d{2}-\d{2}$/.test(input.hire_date)) {
    throw new Error('Invalid hire_date: must be in YYYY-MM-DD format');
  }

  const orgId = input.organization_id || await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated or no organization specified');

  const inviteUrl = await inviteUserViaEmail(input.email);

  // Create user record
  const { data: user, error } = await supabase
    .from('users')
    .insert({
      organization_id: orgId,
      email: input.email,
      first_name: input.first_name,
      last_name: input.last_name,
      role_id: input.role_id,
      store_id: input.store_id,
      employee_id: input.employee_id,
      hire_date: input.hire_date,
      phone: input.phone,
      status: 'active'
    })
    .select()
    .single();

  if (error) throw error;

  return { user, inviteUrl };
}

/**
 * Update user profile
 */
export async function updateUser(
  userId: string,
  updates: Partial<CreateUserInput> & { status?: 'active' | 'inactive' | 'on-leave' }
) {
  // Input validation
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId: must be a non-empty string');
  }
  if (updates.email && (!updates.email.includes('@') || typeof updates.email !== 'string')) {
    throw new Error('Invalid email: must be a valid email address');
  }
  if (updates.first_name && (typeof updates.first_name !== 'string' || updates.first_name.trim().length === 0)) {
    throw new Error('Invalid first_name: must be a non-empty string');
  }
  if (updates.last_name && (typeof updates.last_name !== 'string' || updates.last_name.trim().length === 0)) {
    throw new Error('Invalid last_name: must be a non-empty string');
  }
  if (updates.status && !['active', 'inactive', 'on-leave'].includes(updates.status)) {
    throw new Error('Invalid status: must be one of active, inactive, or on-leave');
  }
  if (updates.hire_date && !/^\d{4}-\d{2}-\d{2}$/.test(updates.hire_date)) {
    throw new Error('Invalid hire_date: must be in YYYY-MM-DD format');
  }

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get user by ID with relations
 */
export async function getUserById(userId: string) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId: must be a non-empty string');
  }

  const { data, error } = await supabase
    .from('users')
    .select(`
      *,
      role:roles(*),
      store:stores!store_id(*)
    `)
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get all users with filters
 */
export async function getUsers(filters: {
  role_id?: string;
  store_id?: string;
  status?: string;
  search?: string;
} = {}) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  let query = supabase
    .from('users')
    .select(`
      *,
      role:roles!users_role_id_fkey(name),
      store:stores!store_id(name, code, district:districts(name))
    `)
    .eq('organization_id', orgId);

  if (filters.role_id) {
    query = query.eq('role_id', filters.role_id);
  }

  if (filters.store_id) {
    query = query.eq('store_id', filters.store_id);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.search) {
    query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,employee_id.ilike.%${filters.search}%`);
  }

  const { data: users, error } = await query.order('first_name', { ascending: true });

  if (error) throw error;

  if (!users || users.length === 0) {
    return [];
  }

  const userIds = users.map(u => u.id);

  // Use database aggregations instead of fetching all records
  // Get progress stats from track_completions (source of truth)
  // Get all assignments to know which tracks are assigned
  const { data: assignments } = await supabase
    .from('assignments')
    .select('id, user_id, playlist_id')
    .in('user_id', userIds);

  // Get all track completions
  const { data: trackCompletions } = await supabase
    .from('track_completions')
    .select('track_id, user_id, score, passed')
    .in('user_id', userIds);

  // Build track assignment map: user_id -> set of track_ids from their assignments
  const tracksByUser: Record<string, Set<string>> = {};
  if (assignments) {
    const playlistIds = [...new Set(assignments.map(a => a.playlist_id).filter(Boolean))];
    if (playlistIds.length > 0) {
      const { data: playlistTracks } = await supabase
        .from('playlist_tracks')
        .select('track_id, playlist_id')
        .in('playlist_id', playlistIds);

      assignments.forEach(assignment => {
        if (!tracksByUser[assignment.user_id]) {
          tracksByUser[assignment.user_id] = new Set();
        }
        playlistTracks?.forEach(pt => {
          if (pt.playlist_id === assignment.playlist_id) {
            tracksByUser[assignment.user_id].add(pt.track_id);
          }
        });
      });
    }
  }

  // Calculate progress for each user: completed tracks / assigned tracks
  const progressByUser: Record<string, { completed: number; total: number; scores: number[] }> = {};
  
  userIds.forEach(userId => {
    const assignedTracks = tracksByUser[userId] || new Set();
    const userCompletions = trackCompletions?.filter(tc => tc.user_id === userId) || [];
    const completedTracks = userCompletions.filter(tc => assignedTracks.has(tc.track_id));
    
    // Calculate average score from completed tracks
    const scores = completedTracks
      .map(tc => tc.score)
      .filter((score): score is number => score !== null && score !== undefined);
    
    progressByUser[userId] = {
      completed: completedTracks.length,
      total: assignedTracks.size,
      scores
    };
  });

  // Get assignment counts aggregated by user
  const { data: assignmentStats } = await supabase
    .from('assignments')
    .select('user_id, status, progress_percent')
    .in('user_id', userIds);

  // Get certification counts aggregated by user
  const { data: certificationStats } = await supabase
    .from('user_certifications')
    .select('user_id')
    .in('user_id', userIds)
    .eq('status', 'active');

  const assignmentsByUser: Record<string, number> = {};
  assignmentStats?.forEach(a => {
    assignmentsByUser[a.user_id] = (assignmentsByUser[a.user_id] || 0) + 1;
  });

  const certsByUser: Record<string, number> = {};
  certificationStats?.forEach(c => {
    certsByUser[c.user_id] = (certsByUser[c.user_id] || 0) + 1;
  });

  // Enrich each user with calculated data
  return users.map(user => {
    const userProgress = progressByUser[user.id] || { completed: 0, total: 0, scores: [] };
    const userAssignments = assignmentsByUser[user.id] || 0;
    const userCerts = certsByUser[user.id] || 0;

    const trainingProgress = userProgress.total > 0 
      ? Math.round((userProgress.completed / userProgress.total) * 100) 
      : 0;

    const complianceScore = userProgress.scores.length > 0
      ? Math.round(userProgress.scores.reduce((sum, score) => sum + score, 0) / userProgress.scores.length)
      : 0;

    return {
      ...user,
      training_progress: trainingProgress,
      completed_tracks: userProgress.completed,
      total_tracks: userProgress.total,
      certifications_count: userCerts,
      compliance_score: complianceScore
    };
  });
}

/**
 * Deactivate user (soft delete)
 */
export async function deactivateUser(userId: string) {
  return updateUser(userId, { status: 'inactive' });
}

/**
 * Reactivate user
 */
export async function reactivateUser(userId: string) {
  return updateUser(userId, { status: 'active' });
}

/**
 * Update user's last active timestamp
 */
export async function updateUserLastActive(userId: string) {
  const { error } = await supabase
    .from('users')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) console.error('Error updating last active:', error);
}

/**
 * Link auth user to internal user record (on first login)
 */
export async function linkAuthUserToInternalUser(
  authUserId: string,
  email: string
) {
  // Find user by email
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (!user) {
    throw new Error('User not found in organization');
  }

  // Link auth_user_id
  const { error } = await supabase
    .from('users')
    .update({ auth_user_id: authUserId })
    .eq('id', user.id);

  if (error) throw error;

  return user;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Invite user via email (generates magic link)
 * This should be called from a server-side function with admin privileges
 */
async function inviteUserViaEmail(email: string): Promise<string> {
  // This would typically use supabase.auth.admin.inviteUserByEmail()
  // but that requires server-side admin key
  // For now, return placeholder URL
  return `/auth/invite?email=${encodeURIComponent(email)}`;
}