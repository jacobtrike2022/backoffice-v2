/**
 * Supabase Configuration
 * 
 * Uses environment variables for security. Create a .env file in the project root
 * with the following variables:
 * 
 * VITE_SUPABASE_PROJECT_ID=your-project-id
 * VITE_SUPABASE_ANON_KEY=your-anon-key
 * VITE_SUPABASE_FUNCTION_NAME=your-function-name (optional)
 * 
 * The .env file is gitignored and will not be committed to the repository.
 */

// Get Supabase project ID from environment variable
// Falls back to hardcoded value for backward compatibility (should be removed in production)
export const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "kgzhlvxzdlexsrozbbxs";

// Get Supabase anonymous key from environment variable
// Falls back to hardcoded value for backward compatibility (should be removed in production)
export const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtnemhsdnh6ZGxleHNyb3piYnhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1MTMxNTYsImV4cCI6MjA3OTA4OTE1Nn0.V8c1z6KO7Q3fmFgKpYkedlJOUuV-cm8Y1F123H-8hxU";

/**
 * Get the Supabase Edge Function server URL
 * Uses environment variable VITE_SUPABASE_FUNCTION_NAME if set,
 * otherwise falls back to the default function name
 */
export function getServerUrl(): string {
  const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || 'make-server-2858cc8b';
  return `https://${projectId}.supabase.co/functions/v1/${functionName}`;
}