// ============================================================================
// SUPABASE CLIENT & CORE UTILITIES
// ============================================================================

import { getSupabaseClient } from '../utils/supabase/client';
import { APP_CONFIG } from './config';

// Use singleton Supabase client to avoid multiple GoTrueClient instances
export const supabase = getSupabaseClient();

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
  // Check if multi-tenancy is enabled
  if (!APP_CONFIG.ENABLE_MULTI_TENANCY) {
    // SINGLE-TENANT MODE: All users belong to the same organization
    return APP_CONFIG.DEFAULT_ORG_ID;
  }
  
  // MULTI-TENANT MODE: Get organization from authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    // No authenticated user
    if (APP_CONFIG.DEMO_MODE) {
      // Demo mode: return default org
      return APP_CONFIG.DEFAULT_ORG_ID;
    }
    // Production: require authentication
    return null;
  }

  // Option 1: Get from user metadata (set during signup)
  const orgIdFromMetadata = user.user_metadata?.organization_id;
  if (orgIdFromMetadata) return orgIdFromMetadata;

  // Option 2: Query users table for organization_id
  const { data } = await supabase
    .from('users')
    .select('organization_id')
    .eq('auth_user_id', user.id)
    .single();

  return data?.organization_id || null;
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
          role:roles(*),
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
      role:roles(*),
      store:stores!users_store_id_fkey(*, district:districts(*))
    `)
    .eq('auth_user_id', user.id)
    .single();

  if (error) {
    console.error('Error fetching user profile:', error);
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