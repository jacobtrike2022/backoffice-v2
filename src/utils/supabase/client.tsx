import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

// Singleton Supabase client instance
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createClient(
      `https://${projectId}.supabase.co`,
      publicAnonKey
    );
  }
  return supabaseInstance;
}

/**
 * Refresh/reinitialize the Supabase client
 * Useful when experiencing connection issues or after configuration changes
 */
export function refreshSupabaseClient() {
  // Clear the existing instance
  supabaseInstance = null;
  
  // Create a new instance
  supabaseInstance = createClient(
    `https://${projectId}.supabase.co`,
    publicAnonKey
  );
  
  return supabaseInstance;
}
