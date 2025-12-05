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
  
  // Default organization ID (used in single-tenant mode)
  DEFAULT_ORG_ID: '10000000-0000-0000-0000-000000000001',
  
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
 * Get environment-specific configuration
 */
export function getEnvironmentConfig() {
  // Future: Detect environment (dev/staging/prod) and adjust settings
  return APP_CONFIG;
}
