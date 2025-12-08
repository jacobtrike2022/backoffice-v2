// ============================================================================
// AUTHENTICATION & ORGANIZATION HELPERS
// ============================================================================

import { getSupabaseClient } from '../utils/supabase/client';

const supabase = getSupabaseClient();

/**
 * Get the current user's organization ID
 * For single-tenant apps, this returns a default org ID
 * For multi-tenant apps, this would check user metadata or a separate query
 */
export async function getCurrentUserOrgId(): Promise<string> {
  // TODO: If you implement multi-tenancy, get this from user metadata:
  // const { data: { user } } = await supabase.auth.getUser();
  // return user?.user_metadata?.organization_id;
  
  // For now, return a default organization ID for single-tenant usage
  // This matches the organization_id you've been using in your data
  return 'default-org-123';
}

/**
 * Get the current authenticated user
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    return !!user;
  } catch {
    return false;
  }
}