-- =====================================================
-- SMART ASSIGNMENT ENGINE FUNCTIONS
-- =====================================================

-- Get requirements for a user based on store state and role
CREATE OR REPLACE FUNCTION get_applicable_requirements(
  p_user_id UUID
) RETURNS TABLE (
  requirement_id UUID,
  requirement_name TEXT,
  topic_name TEXT,
  state_code CHAR(2),
  days_to_complete INTEGER,
  recertification_years DECIMAL,
  playlist_id UUID,
  has_valid_cert BOOLEAN,
  source TEXT  -- 'state' or 'role'
) AS $$
BEGIN
  RETURN QUERY
  WITH user_context AS (
    SELECT
      u.id AS user_id,
      u.role_id,
      u.store_id,
      s.state,
      r.standard_role_type_id
    FROM users u
    LEFT JOIN stores s ON u.store_id = s.id
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE u.id = p_user_id
  )
  -- State-based requirements
  SELECT DISTINCT
    cr.id AS requirement_id,
    cr.requirement_name,
    ct.name AS topic_name,
    cr.state_code,
    cr.days_to_complete,
    cr.recertification_years,
    a.id AS playlist_id,
    has_valid_certification(p_user_id, cr.id) AS has_valid_cert,
    'state'::TEXT AS source
  FROM user_context uc
  JOIN compliance_requirements cr ON UPPER(uc.state) = cr.state_code
  LEFT JOIN compliance_topics ct ON cr.topic_id = ct.id
  LEFT JOIN albums a ON a.requirement_id = cr.id AND a.is_system_locked = true
  WHERE cr.ee_training_required IN ('required_certified', 'required_program', 'required_no_list')

  UNION

  -- Role-based requirements
  SELECT DISTINCT
    cr.id AS requirement_id,
    cr.requirement_name,
    ct.name AS topic_name,
    cr.state_code,
    cr.days_to_complete,
    cr.recertification_years,
    a.id AS playlist_id,
    has_valid_certification(p_user_id, cr.id) AS has_valid_cert,
    'role'::TEXT AS source
  FROM user_context uc
  JOIN role_compliance_requirements rcr ON uc.role_id = rcr.role_id
  JOIN compliance_requirements cr ON rcr.requirement_id = cr.id
  LEFT JOIN compliance_topics ct ON cr.topic_id = ct.id
  LEFT JOIN albums a ON a.requirement_id = cr.id AND a.is_system_locked = true;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create assignments for a new hire
CREATE OR REPLACE FUNCTION create_onboarding_assignments(
  p_user_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_org_id UUID;
  v_count INTEGER := 0;
  v_req RECORD;
BEGIN
  -- Get user's org
  SELECT organization_id INTO v_org_id FROM users WHERE id = p_user_id;

  -- For each applicable requirement
  FOR v_req IN SELECT * FROM get_applicable_requirements(p_user_id) LOOP
    -- Skip if already has valid cert
    IF v_req.has_valid_cert THEN
      -- Create suppressed assignment for audit trail
      INSERT INTO compliance_assignment_queue (
        organization_id, employee_id, requirement_id, playlist_id,
        triggered_by, status, suppression_reason
      ) VALUES (
        v_org_id, p_user_id, v_req.requirement_id, v_req.playlist_id,
        'onboarding', 'suppressed', 'valid_external_cert'
      ) ON CONFLICT DO NOTHING;
    ELSE
      -- Create pending assignment
      INSERT INTO compliance_assignment_queue (
        organization_id, employee_id, requirement_id, playlist_id,
        triggered_by, status, due_date
      ) VALUES (
        v_org_id, p_user_id, v_req.requirement_id, v_req.playlist_id,
        'onboarding', 'pending',
        CURRENT_DATE + COALESCE(v_req.days_to_complete, 30)
      ) ON CONFLICT DO NOTHING;

      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Handle location transfer
CREATE OR REPLACE FUNCTION handle_location_transfer(
  p_user_id UUID,
  p_old_store_id UUID,
  p_new_store_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_old_state CHAR(2);
  v_new_state CHAR(2);
  v_org_id UUID;
  v_result JSONB;
  v_removed INTEGER := 0;
  v_added INTEGER := 0;
BEGIN
  -- Get states
  SELECT state INTO v_old_state FROM stores WHERE id = p_old_store_id;
  SELECT state INTO v_new_state FROM stores WHERE id = p_new_store_id;
  SELECT organization_id INTO v_org_id FROM users WHERE id = p_user_id;

  -- If same state, no action needed
  IF UPPER(v_old_state) = UPPER(v_new_state) THEN
    RETURN jsonb_build_object('removed', 0, 'added', 0, 'message', 'Same state, no changes');
  END IF;

  -- Cancel pending assignments for old state
  UPDATE compliance_assignment_queue
  SET status = 'cancelled', updated_at = NOW()
  WHERE employee_id = p_user_id
  AND status IN ('pending', 'assigned')
  AND requirement_id IN (
    SELECT id FROM compliance_requirements WHERE state_code = UPPER(v_old_state)
  );
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  -- Create new assignments for new state
  v_added := create_onboarding_assignments(p_user_id);

  RETURN jsonb_build_object(
    'removed', v_removed,
    'added', v_added,
    'old_state', v_old_state,
    'new_state', v_new_state
  );
END;
$$ LANGUAGE plpgsql;

-- Trigger function for user changes
CREATE OR REPLACE FUNCTION trigger_compliance_on_user_change()
RETURNS TRIGGER AS $$
BEGIN
  -- New user created (onboarding)
  IF TG_OP = 'INSERT' AND NEW.store_id IS NOT NULL THEN
    PERFORM create_onboarding_assignments(NEW.id);
  END IF;

  -- Store changed (transfer)
  IF TG_OP = 'UPDATE' AND OLD.store_id IS DISTINCT FROM NEW.store_id AND NEW.store_id IS NOT NULL THEN
    PERFORM handle_location_transfer(NEW.id, OLD.store_id, NEW.store_id);
  END IF;

  -- Role changed (promotion)
  IF TG_OP = 'UPDATE' AND OLD.role_id IS DISTINCT FROM NEW.role_id AND NEW.role_id IS NOT NULL THEN
    -- Re-evaluate assignments
    PERFORM create_onboarding_assignments(NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on users table
DROP TRIGGER IF EXISTS compliance_user_change_trigger ON users;
CREATE TRIGGER compliance_user_change_trigger
  AFTER INSERT OR UPDATE OF store_id, role_id ON users
  FOR EACH ROW
  EXECUTE FUNCTION trigger_compliance_on_user_change();
