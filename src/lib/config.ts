// ============================================================================
// APPLICATION CONFIGURATION
// ============================================================================

/**
 * Multi-tenancy configuration
 * 
 * Set ENABLE_MULTI_TENANCY to true when ready to support multiple organizations
 */
export const APP_CONFIG = {
  // Feature flags
  ENABLE_MULTI_TENANCY: false,

  // Default organization ID (used in single-tenant mode and when unauthenticated)
  // Override via VITE_DEFAULT_ORG_ID in .env
  DEFAULT_ORG_ID:
    (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_DEFAULT_ORG_ID as string | undefined)) ||
    '10000000-0000-0000-0000-000000000001',

  // When on localhost, use this org instead of DEFAULT_ORG_ID
  // trike.co org; override via VITE_LOCALHOST_DEFAULT_ORG_ID in .env if needed
  LOCALHOST_DEFAULT_ORG_ID:
    typeof import.meta !== 'undefined'
      ? (import.meta.env?.VITE_LOCALHOST_DEFAULT_ORG_ID as string | undefined)
      : undefined,

  /** trike.co organization ID — used as localhost default when LOCALHOST_DEFAULT_ORG_ID not set */
  TRIKE_CO_ORG_ID: '10000000-0000-0000-0000-000000000001',
  
  // Authentication settings
  REQUIRE_AUTH: false, // Set to true in production
  
  // Demo mode settings (for development)
  DEMO_MODE: true,
  DEMO_USER_ID: '50000000-0000-0000-0000-000000000001', // Sarah Admin
} as const;

/**
 * Future multi-tenancy roadmap:
 * 
 * 1. UPDATE DATABASE:
 *    - Ensure all tables have organization_id column with proper indexes
 *    - Add RLS policies to filter by organization_id
 *    - Create organizations table if not exists
 * 
 * 2. UPDATE AUTHENTICATION:
 *    - Set organization_id in user metadata during signup
 *    - OR: Store in users.organization_id and query on auth
 * 
 * 3. UPDATE THIS CONFIG:
 *    - Set ENABLE_MULTI_TENANCY = true
 *    - Set REQUIRE_AUTH = true
 *    - Set DEMO_MODE = false
 * 
 * 4. UPDATE SUPABASE.TS:
 *    - Uncomment multi-tenant logic in getCurrentUserOrgId()
 *    - Update getCurrentUserProfile() to require auth
 * 
 * 5. ADD ORGANIZATION MANAGEMENT:
 *    - Organization creation/editing UI
 *    - User invitation system
 *    - Organization switching (if users belong to multiple orgs)
 */

/**
 * Get the effective default org ID for the current environment.
 * On localhost, uses trike.co (10000000-0000-0000-0000-000000000001) by default.
 * Override with VITE_LOCALHOST_DEFAULT_ORG_ID in .env if needed.
 */
export function getDefaultOrgId(): string {
  if (typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return APP_CONFIG.LOCALHOST_DEFAULT_ORG_ID || APP_CONFIG.TRIKE_CO_ORG_ID;
  }
  return APP_CONFIG.DEFAULT_ORG_ID;
}

/**
 * Get environment-specific configuration
 */
export function getEnvironmentConfig() {
  // Future: Detect environment (dev/staging/prod) and adjust settings
  return APP_CONFIG;
}
