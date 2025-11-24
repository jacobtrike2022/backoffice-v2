// ============================================================================
// SUPABASE CLIENT & CORE UTILITIES
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../utils/supabase/info';

// Supabase configuration
const supabaseUrl = `https://${projectId}.supabase.co`;
const supabaseAnonKey = publicAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get current authenticated user's organization ID
 */
export async function getCurrentUserOrgId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // DEVELOPMENT: Return demo org ID when not authenticated
    // TODO: Remove this in production and require proper auth
    return '10000000-0000-0000-0000-000000000001';
  }

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
    // DEVELOPMENT: Return demo admin user when not authenticated
    // TODO: Remove this in production and require proper auth
    console.log('No authenticated user, fetching demo admin user...');
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        role:roles(*),
        store:stores!users_store_id_fkey(*, district:districts(*))
      `)
      .eq('id', '50000000-0000-0000-0000-000000000001') // Sarah Admin
      .single();
    
    if (error) {
      console.error('Error fetching demo user profile:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return null;
    }
    console.log('Demo user loaded successfully:', data);
    return data;
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