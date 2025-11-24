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
}

/**
 * Create a new user and send invite email
 */
export async function createUser(input: CreateUserInput) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  // Create auth user via Supabase Admin API (server-side only)
  // This should be called from a server-side function
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
      role:roles(name),
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

  // Enrich users with progress data
  if (users && users.length > 0) {
    const userIds = users.map(u => u.id);

    // Fetch progress data for all users
    const { data: progressData } = await supabase
      .from('user_progress')
      .select('user_id, status, score')
      .in('user_id', userIds);

    // Fetch assignments data for all users
    const { data: assignmentsData } = await supabase
      .from('assignments')
      .select('user_id, status, progress_percent')
      .in('user_id', userIds);

    // Fetch certifications count for all users
    const { data: certificationsData } = await supabase
      .from('user_certifications')
      .select('user_id, status')
      .in('user_id', userIds)
      .eq('status', 'active');

    // Build lookup maps
    const progressByUser: Record<string, any[]> = {};
    progressData?.forEach(p => {
      if (!progressByUser[p.user_id]) progressByUser[p.user_id] = [];
      progressByUser[p.user_id].push(p);
    });

    const assignmentsByUser: Record<string, any[]> = {};
    assignmentsData?.forEach(a => {
      if (!assignmentsByUser[a.user_id]) assignmentsByUser[a.user_id] = [];
      assignmentsByUser[a.user_id].push(a);
    });

    const certsByUser: Record<string, number> = {};
    certificationsData?.forEach(c => {
      certsByUser[c.user_id] = (certsByUser[c.user_id] || 0) + 1;
    });

    // Enrich each user with calculated data
    return users.map(user => {
      const userProgress = progressByUser[user.id] || [];
      const userAssignments = assignmentsByUser[user.id] || [];
      const userCerts = certsByUser[user.id] || 0;

      const completedTracks = userProgress.filter(p => p.status === 'completed').length;
      const totalTracks = userProgress.length;
      const trainingProgress = totalTracks > 0 
        ? Math.round((completedTracks / totalTracks) * 100) 
        : 0;

      // Calculate average score from completed tracks
      const scoresArray = userProgress
        .filter(p => p.score !== null && p.score !== undefined)
        .map(p => p.score);
      const complianceScore = scoresArray.length > 0
        ? Math.round(scoresArray.reduce((sum, score) => sum + score, 0) / scoresArray.length)
        : 0;

      return {
        ...user,
        training_progress: trainingProgress,
        completed_tracks: completedTracks,
        total_tracks: totalTracks,
        certifications_count: userCerts,
        compliance_score: complianceScore
      };
    });
  }

  return users || [];
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