// ============================================================================
// USERS CRUD OPERATIONS
// ============================================================================

import { supabase, getCurrentUserOrgId } from '../supabase';

export interface CreateUserInput {
  email: string;
  name: string;
  role_id: string;
  store_id?: string;
  district_id?: string;
  employee_id?: string;
  hire_date?: string;
  department?: string;
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
      name: input.name,
      role_id: input.role_id,
      store_id: input.store_id,
      district_id: input.district_id,
      employee_id: input.employee_id,
      hire_date: input.hire_date,
      department: input.department,
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
      store:stores(*),
      district:districts(*)
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
  district_id?: string;
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
      store:stores(name, store_number),
      district:districts(name)
    `)
    .eq('organization_id', orgId);

  if (filters.role_id) {
    query = query.eq('role_id', filters.role_id);
  }

  if (filters.store_id) {
    query = query.eq('store_id', filters.store_id);
  }

  if (filters.district_id) {
    query = query.eq('district_id', filters.district_id);
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,employee_id.ilike.%${filters.search}%`);
  }

  const { data, error } = await query.order('name', { ascending: true });

  if (error) throw error;
  return data;
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
