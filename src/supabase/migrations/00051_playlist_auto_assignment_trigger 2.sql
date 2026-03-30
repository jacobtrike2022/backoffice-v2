-- =====================================================
-- PLAYLIST AUTO-ASSIGNMENT ENGINE
-- Automatically assigns auto-playlists to users when:
-- 1. User is created with matching criteria
-- 2. User's role_id changes to match criteria
-- 3. User's store_id changes to match criteria
-- =====================================================

-- Function to get all auto-playlists that match a user's criteria
CREATE OR REPLACE FUNCTION get_matching_auto_playlists(
  p_user_id UUID
) RETURNS TABLE (
  playlist_id UUID,
  playlist_title TEXT,
  trigger_rules JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH user_context AS (
    SELECT
      u.id AS user_id,
      u.organization_id,
      u.role_id,
      u.store_id,
      u.hire_date,
      r.name AS role_name,
      s.district_id
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN stores s ON u.store_id = s.id
    WHERE u.id = p_user_id
      AND u.status = 'active'
  )
  SELECT
    p.id AS playlist_id,
    p.title AS playlist_title,
    p.trigger_rules
  FROM playlists p
  CROSS JOIN user_context uc
  WHERE p.type = 'auto'
    AND p.is_active = true
    AND p.organization_id = uc.organization_id
    AND p.trigger_rules IS NOT NULL
    -- Check role_ids match (supports both UUID and name matching)
    AND (
      p.trigger_rules->'role_ids' IS NULL
      OR jsonb_array_length(p.trigger_rules->'role_ids') = 0
      OR uc.role_id::text IN (SELECT jsonb_array_elements_text(p.trigger_rules->'role_ids'))
      OR uc.role_name IN (SELECT jsonb_array_elements_text(p.trigger_rules->'role_ids'))
    )
    -- Check store_ids match
    AND (
      p.trigger_rules->'store_ids' IS NULL
      OR jsonb_array_length(p.trigger_rules->'store_ids') = 0
      OR uc.store_id::text IN (SELECT jsonb_array_elements_text(p.trigger_rules->'store_ids'))
    )
    -- Check district_ids match
    AND (
      p.trigger_rules->'district_ids' IS NULL
      OR jsonb_array_length(p.trigger_rules->'district_ids') = 0
      OR uc.district_id::text IN (SELECT jsonb_array_elements_text(p.trigger_rules->'district_ids'))
    )
    -- Check hire_days (user hired within X days)
    AND (
      (p.trigger_rules->>'hire_days') IS NULL
      OR uc.hire_date >= (CURRENT_DATE - ((p.trigger_rules->>'hire_days')::integer))
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to create playlist assignments for a user
CREATE OR REPLACE FUNCTION create_playlist_auto_assignments(
  p_user_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_org_id UUID;
  v_count INTEGER := 0;
  v_playlist RECORD;
BEGIN
  -- Get user's org
  SELECT organization_id INTO v_org_id FROM users WHERE id = p_user_id;

  IF v_org_id IS NULL THEN
    RETURN 0;
  END IF;

  -- For each matching auto-playlist
  FOR v_playlist IN SELECT * FROM get_matching_auto_playlists(p_user_id) LOOP
    -- Check if assignment already exists (prevent duplicates)
    IF NOT EXISTS (
      SELECT 1 FROM assignments
      WHERE user_id = p_user_id
        AND playlist_id = v_playlist.playlist_id
        AND status IN ('assigned', 'in_progress', 'completed')
    ) THEN
      -- Create the assignment
      INSERT INTO assignments (
        organization_id,
        user_id,
        playlist_id,
        status,
        progress_percent,
        assigned_at
      ) VALUES (
        v_org_id,
        p_user_id,
        v_playlist.playlist_id,
        'assigned',
        0,
        NOW()
      );

      v_count := v_count + 1;

      -- Log the auto-assignment (optional - for audit trail)
      -- You could insert into an activity_logs table here
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to handle playlist trigger evaluation on user changes
CREATE OR REPLACE FUNCTION trigger_playlist_auto_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_assignments_created INTEGER;
BEGIN
  -- Only process active users
  IF NEW.status != 'active' THEN
    RETURN NEW;
  END IF;

  -- New user created
  IF TG_OP = 'INSERT' THEN
    v_assignments_created := create_playlist_auto_assignments(NEW.id);
    IF v_assignments_created > 0 THEN
      RAISE NOTICE 'Auto-assigned % playlists to new user %', v_assignments_created, NEW.id;
    END IF;
  END IF;

  -- Role changed
  IF TG_OP = 'UPDATE' AND OLD.role_id IS DISTINCT FROM NEW.role_id THEN
    v_assignments_created := create_playlist_auto_assignments(NEW.id);
    IF v_assignments_created > 0 THEN
      RAISE NOTICE 'Auto-assigned % playlists after role change for user %', v_assignments_created, NEW.id;
    END IF;
  END IF;

  -- Store changed
  IF TG_OP = 'UPDATE' AND OLD.store_id IS DISTINCT FROM NEW.store_id THEN
    v_assignments_created := create_playlist_auto_assignments(NEW.id);
    IF v_assignments_created > 0 THEN
      RAISE NOTICE 'Auto-assigned % playlists after store change for user %', v_assignments_created, NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on users table for playlist auto-assignment
DROP TRIGGER IF EXISTS playlist_auto_assignment_trigger ON users;
CREATE TRIGGER playlist_auto_assignment_trigger
  AFTER INSERT OR UPDATE OF role_id, store_id ON users
  FOR EACH ROW
  EXECUTE FUNCTION trigger_playlist_auto_assignment();

-- =====================================================
-- HELPER FUNCTIONS FOR UI/PREVIEW
-- =====================================================

-- Get users that match a playlist's trigger rules (for preview in wizard)
CREATE OR REPLACE FUNCTION get_users_matching_trigger_rules(
  p_organization_id UUID,
  p_trigger_rules JSONB
) RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  role_name TEXT,
  store_name TEXT,
  hire_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.first_name,
    u.last_name,
    u.email,
    r.name AS role_name,
    s.name AS store_name,
    u.hire_date
  FROM users u
  LEFT JOIN roles r ON u.role_id = r.id
  LEFT JOIN stores s ON u.store_id = s.id
  WHERE u.organization_id = p_organization_id
    AND u.status = 'active'
    -- Check role_ids match (supports both UUID and name matching)
    AND (
      p_trigger_rules->'role_ids' IS NULL
      OR jsonb_array_length(p_trigger_rules->'role_ids') = 0
      OR u.role_id::text IN (SELECT jsonb_array_elements_text(p_trigger_rules->'role_ids'))
      OR r.name IN (SELECT jsonb_array_elements_text(p_trigger_rules->'role_ids'))
    )
    -- Check store_ids match
    AND (
      p_trigger_rules->'store_ids' IS NULL
      OR jsonb_array_length(p_trigger_rules->'store_ids') = 0
      OR u.store_id::text IN (SELECT jsonb_array_elements_text(p_trigger_rules->'store_ids'))
    )
    -- Check district_ids match
    AND (
      p_trigger_rules->'district_ids' IS NULL
      OR jsonb_array_length(p_trigger_rules->'district_ids') = 0
      OR s.district_id::text IN (SELECT jsonb_array_elements_text(p_trigger_rules->'district_ids'))
    )
    -- Check hire_days (user hired within X days)
    AND (
      (p_trigger_rules->>'hire_days') IS NULL
      OR u.hire_date >= (CURRENT_DATE - ((p_trigger_rules->>'hire_days')::integer))
    )
  ORDER BY u.last_name, u.first_name;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get assignment history for a playlist (for activity feed in playlist view)
CREATE OR REPLACE FUNCTION get_playlist_assignment_history(
  p_playlist_id UUID,
  p_limit INTEGER DEFAULT 20
) RETURNS TABLE (
  assignment_id UUID,
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  role_name TEXT,
  store_name TEXT,
  hire_date DATE,
  assigned_at TIMESTAMPTZ,
  progress_percent INTEGER,
  status TEXT,
  completed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id AS assignment_id,
    u.id AS user_id,
    u.first_name,
    u.last_name,
    u.email,
    r.name AS role_name,
    s.name AS store_name,
    u.hire_date,
    a.assigned_at,
    a.progress_percent,
    a.status,
    a.completed_at
  FROM assignments a
  JOIN users u ON a.user_id = u.id
  LEFT JOIN roles r ON u.role_id = r.id
  LEFT JOIN stores s ON u.store_id = s.id
  WHERE a.playlist_id = p_playlist_id
  ORDER BY a.assigned_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get count of users that would be affected by trigger rules
CREATE OR REPLACE FUNCTION count_users_matching_trigger_rules(
  p_organization_id UUID,
  p_trigger_rules JSONB
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM get_users_matching_trigger_rules(p_organization_id, p_trigger_rules);

  RETURN v_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Compare old vs new trigger rules to find affected populations
CREATE OR REPLACE FUNCTION compare_trigger_rules_impact(
  p_playlist_id UUID,
  p_new_trigger_rules JSONB
) RETURNS TABLE (
  population TEXT,
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  role_name TEXT,
  current_status TEXT,
  progress_percent INTEGER
) AS $$
DECLARE
  v_org_id UUID;
  v_old_rules JSONB;
BEGIN
  -- Get playlist's org and current rules
  SELECT organization_id, trigger_rules
  INTO v_org_id, v_old_rules
  FROM playlists
  WHERE id = p_playlist_id;

  -- Population A: "orphaned" - have active assignment but no longer match new rules
  RETURN QUERY
  SELECT
    'orphaned'::TEXT AS population,
    u.id AS user_id,
    u.first_name,
    u.last_name,
    u.email,
    r.name AS role_name,
    a.status AS current_status,
    a.progress_percent
  FROM assignments a
  JOIN users u ON a.user_id = u.id
  LEFT JOIN roles r ON u.role_id = r.id
  WHERE a.playlist_id = p_playlist_id
    AND a.status IN ('assigned', 'in_progress')
    AND u.id NOT IN (
      SELECT gum.user_id
      FROM get_users_matching_trigger_rules(v_org_id, p_new_trigger_rules) gum
    );

  -- Population B: "new_matches" - match new rules but don't have assignment yet
  RETURN QUERY
  SELECT
    'new_match'::TEXT AS population,
    gum.user_id,
    gum.first_name,
    gum.last_name,
    gum.email,
    gum.role_name,
    NULL::TEXT AS current_status,
    NULL::INTEGER AS progress_percent
  FROM get_users_matching_trigger_rules(v_org_id, p_new_trigger_rules) gum
  WHERE gum.user_id NOT IN (
    SELECT a.user_id
    FROM assignments a
    WHERE a.playlist_id = p_playlist_id
      AND a.status IN ('assigned', 'in_progress', 'completed')
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permissions (adjust based on your RLS setup)
-- These functions use SECURITY DEFINER if you need them to bypass RLS
-- For now they're SECURITY INVOKER (default) which respects RLS
