-- =====================================================
-- FIX find_duplicate_roles FUNCTION TYPE MISMATCH
-- =====================================================
-- This migration fixes the type mismatch error where
-- similarity_score is returned as REAL but PostgREST expects NUMERIC
-- 
-- ERROR: "Returned type real does not match expected type numeric in column 5"
-- 
-- ISSUE: The pg_trgm similarity() function returns REAL type,
-- but the function signature declares NUMERIC. We need to cast it.
-- =====================================================

CREATE OR REPLACE FUNCTION public.find_duplicate_roles(
  p_org_id uuid, 
  p_threshold numeric DEFAULT 0.6
)
RETURNS TABLE(
  role_id uuid, 
  role_name text, 
  potential_match_id uuid, 
  potential_match_name text, 
  similarity_score numeric
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    r1.id as role_id,
    r1.name as role_name,
    r2.id as potential_match_id,
    r2.name as potential_match_name,
    -- FIX: Cast similarity() result from REAL to NUMERIC
    similarity(lower(r1.name), lower(r2.name))::numeric as similarity_score
  FROM roles r1
  JOIN roles r2 ON r1.organization_id = r2.organization_id 
    AND r1.id < r2.id
  WHERE r1.organization_id = p_org_id
    AND r1.status IN ('active', 'pending_review')
    AND r2.status IN ('active', 'pending_review')
    AND similarity(lower(r1.name), lower(r2.name)) > p_threshold
  ORDER BY similarity_score DESC;
END;
$function$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.find_duplicate_roles(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_duplicate_roles(uuid, numeric) TO anon;

