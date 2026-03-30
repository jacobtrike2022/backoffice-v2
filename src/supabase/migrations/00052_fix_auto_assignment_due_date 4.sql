-- =====================================================
-- FIX AUTO-ASSIGNMENT TO INCLUDE DUE_DATE AND NOTIFICATIONS
-- Updates the create_playlist_auto_assignments function to:
-- 1. Calculate due_date from trigger_rules.due_days
-- 2. Account for progressive stage unlock delays (waterfall)
-- 3. Create notifications for auto-assigned users
-- =====================================================

-- Helper function to calculate waterfall due date from stages
CREATE OR REPLACE FUNCTION calculate_waterfall_due_days(
  p_base_due_days INTEGER,
  p_release_schedule JSONB,
  p_release_type TEXT
) RETURNS INTEGER AS $$
DECLARE
  v_stage JSONB;
  v_unlock_type TEXT;
  v_unlock_days INTEGER;
  v_stage_delay_sum INTEGER := 0;
  v_minimum_days_needed INTEGER;
BEGIN
  -- If not progressive or no stages, just use base due_days
  IF p_release_type != 'progressive' OR p_release_schedule IS NULL
     OR p_release_schedule->'stages' IS NULL
     OR jsonb_array_length(p_release_schedule->'stages') = 0 THEN
    RETURN p_base_due_days;
  END IF;

  -- Calculate minimum time needed based on stage unlock delays
  FOR v_stage IN SELECT * FROM jsonb_array_elements(p_release_schedule->'stages') LOOP
    v_unlock_type := COALESCE(v_stage->>'unlockType', 'immediate');
    v_unlock_days := COALESCE((v_stage->>'unlockDays')::integer, 0);

    CASE v_unlock_type
      WHEN 'days-after-trigger' THEN
        -- Stage unlocks X days after assignment
        v_stage_delay_sum := GREATEST(v_stage_delay_sum, v_unlock_days);
      WHEN 'days-after-stage' THEN
        -- Adds to cumulative delay
        v_stage_delay_sum := v_stage_delay_sum + v_unlock_days;
      ELSE
        -- immediate, stage-complete, etc. - no additional time delay
        NULL;
    END CASE;
  END LOOP;

  -- Minimum days needed = stage delays + 7 day buffer for final stage completion
  v_minimum_days_needed := v_stage_delay_sum + 7;

  -- Warn if admin set shorter deadline than stage schedule requires
  IF p_base_due_days < v_minimum_days_needed THEN
    RAISE NOTICE 'Warning: Due date (% days) is shorter than stage unlock schedule (% days + 7 day buffer)',
      p_base_due_days, v_stage_delay_sum;
  END IF;

  -- Return the base due_days (respect admin's setting, even if tight)
  RETURN p_base_due_days;
END;
$$ LANGUAGE plpgsql STABLE;

-- Drop and recreate the main function with due_date and waterfall support
CREATE OR REPLACE FUNCTION create_playlist_auto_assignments(
  p_user_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_org_id UUID;
  v_count INTEGER := 0;
  v_playlist RECORD;
  v_full_playlist RECORD;
  v_base_due_days INTEGER;
  v_effective_due_days INTEGER;
  v_due_date DATE;
  v_assignment_id UUID;
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
      -- Get full playlist data including release_schedule
      SELECT * INTO v_full_playlist
      FROM playlists
      WHERE id = v_playlist.playlist_id;

      -- Calculate waterfall due date from trigger_rules.due_days and stage delays
      v_base_due_days := COALESCE((v_playlist.trigger_rules->>'due_days')::integer, 30);
      v_effective_due_days := calculate_waterfall_due_days(
        v_base_due_days,
        v_full_playlist.release_schedule,
        v_full_playlist.release_type
      );
      v_due_date := CURRENT_DATE + v_effective_due_days;

      -- Create the assignment with due_date
      INSERT INTO assignments (
        organization_id,
        user_id,
        playlist_id,
        status,
        progress_percent,
        assigned_at,
        due_date
      ) VALUES (
        v_org_id,
        p_user_id,
        v_playlist.playlist_id,
        'assigned',
        0,
        NOW(),
        v_due_date
      )
      RETURNING id INTO v_assignment_id;

      -- Create notification for the user
      INSERT INTO notifications (
        organization_id,
        user_id,
        type,
        title,
        message,
        link_type,
        link_id,
        is_read
      ) VALUES (
        v_org_id,
        p_user_id,
        'assignment_new',
        'New Assignment: ' || v_playlist.playlist_title,
        'You have been assigned "' || v_playlist.playlist_title || '". Due in ' || v_effective_due_days || ' days.',
        'assignment',
        v_assignment_id,
        false
      );

      -- Update assignment to mark notification as sent
      UPDATE assignments
      SET notification_sent = true
      WHERE id = v_assignment_id;

      v_count := v_count + 1;

      RAISE NOTICE 'Auto-assigned playlist "%" to user % with due date % (base=% days, effective=% days)',
        v_playlist.playlist_title, p_user_id, v_due_date, v_base_due_days, v_effective_due_days;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON FUNCTION calculate_waterfall_due_days(INTEGER, JSONB, TEXT) IS
'Calculates effective due days considering progressive stage unlock delays.
Returns the base due_days but warns if stages require more time than allotted.';

COMMENT ON FUNCTION create_playlist_auto_assignments(UUID) IS
'Creates auto-assignments for a user based on matching playlist trigger rules.
Includes:
- Waterfall due_date calculation from trigger_rules.due_days + stage unlock delays
- Automatic notification creation
- notification_sent flag update';
