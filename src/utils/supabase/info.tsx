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
 * 
 * See .cursor/docs/ENVIRONMENT_SETUP.mdc for detailed setup instructions.
 */

// Get Supabase project ID from environment variable
// Throws error if not set to ensure proper configuration
export const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
if (!projectId) {
  throw new Error(
    'VITE_SUPABASE_PROJECT_ID is not set. Please create a .env file with your Supabase credentials. ' +
    'See .cursor/docs/ENVIRONMENT_SETUP.mdc for instructions.'
  );
}

// Get Supabase anonymous key from environment variable
// Throws error if not set to ensure proper configuration
export const publicAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!publicAnonKey) {
  throw new Error(
    'VITE_SUPABASE_ANON_KEY is not set. Please create a .env file with your Supabase credentials. ' +
    'See .cursor/docs/ENVIRONMENT_SETUP.mdc for instructions.'
  );
}

/**
 * Get the Supabase Edge Function server URL
 * Uses environment variable VITE_SUPABASE_FUNCTION_NAME if set,
 * otherwise falls back to the default function name
 */
export function getServerUrl(): string {
  const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || 'make-server-2858cc8b';
  return `https://${projectId}.supabase.co/functions/v1/${functionName}`;
}