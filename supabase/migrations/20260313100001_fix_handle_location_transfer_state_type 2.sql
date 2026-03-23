-- Fix: handle_location_transfer used CHAR(2) for state, but Relay-scraped stores
-- store full state names (e.g. "Alabama", "Missouri") in stores.state (TEXT).
-- Assigning a long value into CHAR(2) caused "value too long for type character" when
-- assigning an employee to a Relay unit. Use TEXT so the trigger no longer fails.

CREATE OR REPLACE FUNCTION handle_location_transfer(
  p_user_id UUID,
  p_old_store_id UUID,
  p_new_store_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_old_state TEXT := '';
  v_new_state TEXT := '';
  v_org_id UUID;
  v_removed INTEGER := 0;
  v_added INTEGER := 0;
BEGIN
  -- Get states (stores.state is TEXT; Relay data may have full names like "Alabama")
  SELECT COALESCE(state, '') INTO v_old_state FROM stores WHERE id = p_old_store_id;
  SELECT COALESCE(state, '') INTO v_new_state FROM stores WHERE id = p_new_store_id;
  SELECT organization_id INTO v_org_id FROM users WHERE id = p_user_id;

  -- If same state (string comparison; handles both "AL" and "Alabama")
  IF UPPER(TRIM(v_old_state)) = UPPER(TRIM(v_new_state)) THEN
    RETURN jsonb_build_object('removed', 0, 'added', 0, 'message', 'Same state, no changes');
  END IF;

  -- Cancel pending assignments for old state
  -- compliance_requirements.state_code is 2-char; full names won't match (0 cancelled)
  UPDATE compliance_assignment_queue
  SET status = 'cancelled', updated_at = NOW()
  WHERE employee_id = p_user_id
  AND status IN ('pending', 'assigned')
  AND requirement_id IN (
    SELECT id FROM compliance_requirements WHERE state_code = UPPER(TRIM(v_old_state))
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
