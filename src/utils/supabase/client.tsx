import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

// =============================================================================
// SUPABASE CLIENT SINGLETON
// =============================================================================
// IMPORTANT: This is the ONLY place where a Supabase client should be created.
// All other files should import from lib/supabase.ts which uses this singleton.
//
// WHY THIS MATTERS FOR UPLOADS:
// - Supabase clients cache auth tokens and manage WebSocket connections
// - Creating multiple clients causes "Multiple GoTrueClient instances" warning
// - Multiple instances can have stale/different auth states
// - This causes uploads to fail with ERR_TIMED_OUT even when tests pass
// =============================================================================

// Single Supabase client instance - NEVER recreate this
let supabaseInstance: SupabaseClient | null = null;

/**
 * Get the singleton Supabase client.
 * This is the ONLY way to access the Supabase client throughout the app.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createClient(
      `https://${projectId}.supabase.co`,
      publicAnonKey,
      {
        auth: {
          // Persist session in localStorage for consistent auth state
          persistSession: true,
          // Use localStorage for better persistence across tabs
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
          // Auto-refresh tokens before they expire
          autoRefreshToken: true,
          // Detect session from URL (for OAuth redirects)
          detectSessionInUrl: true,
        },
        global: {
          // Add custom headers for debugging
          headers: {
            'x-client-info': 'trike-backoffice',
          },
        },
      }
    );
  }
  return supabaseInstance;
}

/**
 * @deprecated DO NOT USE - This function breaks the singleton pattern!
 *
 * Previously this would create a NEW client, but all existing imports
 * would still reference the OLD client, causing auth state mismatches
 * and upload failures.
 *
 * Instead of refreshing the client, refresh the auth session:
 *   await supabase.auth.refreshSession();
 *
 * This function now just returns the existing client for backwards compatibility.
 */
export function refreshSupabaseClient(): SupabaseClient {
  console.warn(
    '[Supabase] refreshSupabaseClient() is deprecated. ' +
    'Use supabase.auth.refreshSession() instead to refresh auth tokens.'
  );
  // Return existing instance - DO NOT create a new one
  return getSupabaseClient();
}
