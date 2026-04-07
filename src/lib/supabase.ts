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
import { APP_CONFIG, getDefaultOrgId } from './config';
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

// Session-level org override for Super Admin "preview as org" functionality.
// When set, getCurrentUserOrgId() returns this instead of the user's actual org.
let _viewingOrgOverride: string | null = null;

export function setViewingOrgOverride(orgId: string | null) {
  _viewingOrgOverride = orgId;
}

export function getViewingOrgOverride(): string | null {
  return _viewingOrgOverride;
}

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
  // If a Super Admin has set a viewing override, use that
  if (_viewingOrgOverride) {
    return _viewingOrgOverride;
  }

  // Get authenticated user first
  const { data: { user } } = await supabase.auth.getUser();

  // Check for demo organization override in URL
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const demoOrgId = params.get('demo_org_id');

    if (demoOrgId) {
      if (!user) {
        return demoOrgId;
      }

      const userOrgFromMetadata = user.user_metadata?.organization_id;
      if (userOrgFromMetadata === demoOrgId) {
        return demoOrgId;
      }

      const profile = await getCurrentUserProfile();
      const roleName = profile?.role?.name ?? '';
      const isSuperAdmin = roleName === 'Trike Super Admin';
      const canPreviewDemo =
        isSuperAdmin ||
        roleName === 'Admin' ||
        roleName === 'District Manager' ||
        roleName === 'Store Manager';

      if (canPreviewDemo) {
        return demoOrgId;
      }

      const { data: userRecord } = await supabase
        .from('users')
        .select('organization_id')
        .eq('auth_user_id', user.id)
        .single();

      if (userRecord?.organization_id === demoOrgId) {
        return demoOrgId;
      }

      console.warn('Unauthorized demo_org_id override attempt ignored for non-member user');
    }
  }

  // For authenticated users, always check their actual org first
  if (user) {
    const orgIdFromMetadata = user.user_metadata?.organization_id;
    if (orgIdFromMetadata) return orgIdFromMetadata;

    const { data } = await supabase
      .from('users')
      .select('organization_id')
      .eq('auth_user_id', user.id)
      .single();

    if (data?.organization_id) return data.organization_id;
  }

  // Fallback: use default org (localhost → trike.co)
  if (!APP_CONFIG.ENABLE_MULTI_TENANCY || APP_CONFIG.DEMO_MODE) {
    return getDefaultOrgId();
  }

  return null;
}

/**
 * Get the user's actual/home organization ID (ignores viewing override).
 * Used to know what the Super Admin's "home" org is.
 */
export async function getUserHomeOrgId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return APP_CONFIG.DEMO_MODE ? getDefaultOrgId() : null;
  }

  const orgIdFromMetadata = user.user_metadata?.organization_id;
  if (orgIdFromMetadata) return orgIdFromMetadata;

  const { data } = await supabase
    .from('users')
    .select('organization_id')
    .eq('auth_user_id', user.id)
    .single();

  return data?.organization_id || getDefaultOrgId();
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

// ============================================================================
// ORGANIZATIONS
// ============================================================================

export type EmployeeMatchStrategy = 'auto' | 'external_id' | 'email' | 'mobile_phone';

/**
 * Fetch a single organization by id.
 */
export async function getOrganization(organization_id: string) {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', organization_id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching organization:', error);
    return null;
  }
  return data;
}

/**
 * Update an organization. Accepts partial fields.
 *
 * NOTE: This does NOT enforce the `employee_match_strategy_locked` flag — the
 * caller (UI) is responsible for permission checks before invoking this.
 */
export async function updateOrganization(
  organization_id: string,
  updates: {
    name?: string;
    street_address?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    phone?: string;
    email?: string;
    website?: string;
    logo_dark_url?: string | null;
    logo_light_url?: string | null;
    preferred_language?: string;
    employee_match_strategy?: EmployeeMatchStrategy;
    employee_match_strategy_locked?: boolean;
    [key: string]: any;
  }
) {
  const { data, error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', organization_id)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Error updating organization:', error);
    throw error;
  }
  return data;
}

/**
 * Get the effective employee match strategy for an organization.
 * If strategy is 'auto', resolves it based on the org's HRIS source or defaults to 'external_id'.
 */
export async function getEffectiveMatchStrategy(
  organization_id: string
): Promise<'external_id' | 'email' | 'mobile_phone'> {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('employee_match_strategy')
      .eq('id', organization_id)
      .maybeSingle();

    if (error || !data) {
      return 'external_id';
    }

    const strategy = (data as any).employee_match_strategy as EmployeeMatchStrategy | null | undefined;

    if (strategy && strategy !== 'auto') {
      return strategy;
    }

    // 'auto' or unset → safe default. The import fallback ladder will handle
    // missing fields on individual employee rows.
    return 'external_id';
  } catch (err) {
    console.error('Error resolving effective match strategy:', err);
    return 'external_id';
  }
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