// ============================================================================
// SUPABASE CLIENT & CORE UTILITIES
// ============================================================================
// IMPORTANT: All Supabase access should go through this module.
// This ensures a single client instance throughout the entire application.
//
// DO NOT:
// - Import createClient from @supabase/supabase-js directly
// - Create new Supabase clients anywhere else
// - Call refreshSupabase() - it's deprecated and does nothing
//
// DO:
// - Import { supabase } from this module
// - Use supabase.auth.refreshSession() if you need to refresh tokens
// ============================================================================

import { getSupabaseClient } from '../utils/supabase/client';
import { APP_CONFIG } from './config';
import { projectId, publicAnonKey } from '../utils/supabase/info';

// Use singleton Supabase client to avoid multiple GoTrueClient instances
export const supabase = getSupabaseClient();

/**
 * @deprecated DO NOT USE - This function does nothing!
 *
 * Previously attempted to recreate the Supabase client, but this breaks
 * the singleton pattern and causes upload failures because:
 * 1. All existing imports still reference the OLD client
 * 2. The new client has different auth state
 * 3. This causes ERR_TIMED_OUT errors during uploads
 *
 * USE INSTEAD:
 *   await supabase.auth.refreshSession(); // To refresh auth tokens
 *   // or
 *   await refreshAuthSession(); // Convenience wrapper
 */
export function refreshSupabase() {
  console.warn(
    '[Supabase] refreshSupabase() is deprecated and does nothing. ' +
    'Use refreshAuthSession() to refresh auth tokens instead.'
  );
  return supabase;
}

/**
 * Refresh the auth session
 * Call this when you need to ensure fresh auth tokens (e.g., before uploads)
 *
 * This is the CORRECT way to handle auth refresh - it updates the tokens
 * on the existing client instance, ensuring all code uses the same auth state.
 */
export async function refreshAuthSession() {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) {
    console.error('Error refreshing session:', error);
    return null;
  }
  return data.session;
}

// Export Supabase URL for server function calls
export const supabaseUrl = `https://${projectId}.supabase.co`;
export const supabaseAnonKey = publicAnonKey;

/**
 * Get current authenticated user's organization ID
 * 
 * CURRENT: Returns fixed organization ID for single-tenant prototype
 * FUTURE: When implementing multi-tenancy, set APP_CONFIG.ENABLE_MULTI_TENANCY = true
 * 
 * Multi-tenant implementation options:
 * 1. Store org_id in user metadata during signup
 * 2. Query users table for organization_id via auth_user_id
 * 3. Use JWT claims to embed org_id in auth token
 */
export async function getCurrentUserOrgId(): Promise<string | null> {
  // Get authenticated user first
  const { data: { user } } = await supabase.auth.getUser();

  // Check for demo organization override in URL
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const demoOrgId = params.get('demo_org_id');

    if (demoOrgId) {
      // Allow override if:
      // 1. User is not logged in (prospect viewing a demo)
      // 2. User is a Super Admin (admin testing the demo)
      // 3. User actually belongs to this demo org (logged in via magic link)

      if (!user) {
        return demoOrgId;
      }

      // Check if user belongs to the requested demo org
      const userOrgFromMetadata = user.user_metadata?.organization_id;
      if (userOrgFromMetadata === demoOrgId) {
        return demoOrgId;
      }

      // Check if user is a Super Admin
      const profile = await getCurrentUserProfile();
      const isSuperAdmin = profile?.role?.name === 'Trike Super Admin';

      if (isSuperAdmin) {
        return demoOrgId;
      }

      // Also check the users table for org membership
      const { data: userRecord } = await supabase
        .from('users')
        .select('organization_id')
        .eq('auth_user_id', user.id)
        .single();

      if (userRecord?.organization_id === demoOrgId) {
        return demoOrgId;
      }

      // If they don't belong to this org, ignore the override for security
      console.warn('Unauthorized demo_org_id override attempt ignored for non-member user');
    }
  }

  // For authenticated users, always check their actual org first
  // (even in single-tenant mode, demo users need their own org)
  if (user) {
    // Option 1: Get from user metadata (set during onboarding)
    const orgIdFromMetadata = user.user_metadata?.organization_id;
    if (orgIdFromMetadata) return orgIdFromMetadata;

    // Option 2: Query users table for organization_id
    const { data } = await supabase
      .from('users')
      .select('organization_id')
      .eq('auth_user_id', user.id)
      .single();

    if (data?.organization_id) return data.organization_id;
  }

  // Fallback: use default org
  if (!APP_CONFIG.ENABLE_MULTI_TENANCY) {
    return APP_CONFIG.DEFAULT_ORG_ID;
  }

  // MULTI-TENANT MODE with no authenticated user
  if (APP_CONFIG.DEMO_MODE) {
    return APP_CONFIG.DEFAULT_ORG_ID;
  }

  return null;
}

/**
 * Get current user's full profile
 */
export async function getCurrentUserProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    // Check if demo mode is enabled
    if (APP_CONFIG.DEMO_MODE) {
      // DEMO MODE: Return demo admin user when not authenticated
      console.log('No authenticated user, fetching demo admin user...');
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          role:roles!users_role_id_fkey(*),
          store:stores!users_store_id_fkey(*, district:districts(*))
        `)
        .eq('id', APP_CONFIG.DEMO_USER_ID) // Sarah Admin
        .single();
      
      if (error) {
        console.error('Error fetching demo user profile:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        return null;
      }
      console.log('Demo user loaded successfully:', data);
      return data;
    }
    
    // Production mode: require authentication
    if (APP_CONFIG.REQUIRE_AUTH) {
      console.warn('Authentication required but no user found');
      return null;
    }
  }

  const { data, error } = await supabase
    .from('users')
    .select(`
      *,
      role:roles!users_role_id_fkey(*),
      store:stores!users_store_id_fkey(*, district:districts(*))
    `)
    .eq('auth_user_id', user.id)
    .maybeSingle(); // Use maybeSingle() instead of single() to handle 0 rows gracefully

  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }

  // If no profile exists yet (new user), return null
  if (!data) {
    console.log('No user profile found for auth user:', user.id);
    return null;
  }

  return data;
}

/**
 * Upload file to Supabase Storage
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: File
): Promise<{ url: string | null; error: Error | null }> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    return { url: null, error };
  }

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return { url: publicUrl, error: null };
}

/**
 * Delete file from Supabase Storage
 */
export async function deleteFile(bucket: string, path: string) {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  return { error };
}

/**
 * Generate unique filename with timestamp
 */
export function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split('.').pop();
  const nameWithoutExt = originalName.replace(`.${extension}`, '');
  return `${nameWithoutExt}-${timestamp}-${randomStr}.${extension}`;
}