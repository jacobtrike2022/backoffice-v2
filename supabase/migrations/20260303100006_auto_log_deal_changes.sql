-- =====================================================
-- AUTO-LOG DEAL VALUE & OWNER CHANGES
-- =====================================================
-- Extends the existing stage-change trigger to also
-- log value changes and owner reassignments into the
-- deal_activities table automatically.
-- =====================================================

-- Replace the existing function with an enhanced version
-- that logs stage, value, AND owner changes
CREATE OR REPLACE FUNCTION log_deal_stage_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Log stage change
    IF OLD.stage IS DISTINCT FROM NEW.stage THEN
        INSERT INTO deal_activities (
            deal_id, activity_type, title, description,
            from_stage, to_stage
        ) VALUES (
            NEW.id,
            'stage_change',
            'Stage changed from ' || COALESCE(OLD.stage, 'none') || ' to ' || NEW.stage,
            CASE
                WHEN NEW.stage = 'won' THEN 'Deal closed successfully'
                WHEN NEW.stage = 'lost' THEN 'Deal lost' || COALESCE(': ' || NEW.lost_reason, '')
                WHEN NEW.stage = 'frozen' THEN 'Deal frozen/stalled'
                ELSE NULL
            END,
            OLD.stage,
            NEW.stage
        );
    END IF;

    -- Log value change
    IF OLD.value IS DISTINCT FROM NEW.value THEN
        INSERT INTO deal_activities (
            deal_id, activity_type, title, description,
            from_value, to_value
        ) VALUES (
            NEW.id,
            'value_change',
            'Deal value updated from $' ||
                COALESCE(OLD.value::TEXT, '0') || ' to $' ||
                COALESCE(NEW.value::TEXT, '0'),
            CASE
                WHEN COALESCE(NEW.value, 0) > COALESCE(OLD.value, 0) THEN 'Value increased'
                WHEN COALESCE(NEW.value, 0) < COALESCE(OLD.value, 0) THEN 'Value decreased'
                ELSE NULL
            END,
            OLD.value,
            NEW.value
        );
    END IF;

    -- Log owner reassignment
    IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
        INSERT INTO deal_activities (
            deal_id, activity_type, title, description,
            metadata
        ) VALUES (
            NEW.id,
            'system',
            'Deal reassigned to new owner',
            NULL,
            jsonb_build_object(
                'event', 'owner_change',
                'from_owner_id', OLD.owner_id,
                'to_owner_id', NEW.owner_id
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- The trigger itself (trg_log_deal_stage_change) is already attached
-- from migration 100001, so the enhanced function takes effect immediately.
-- No need to re-create the trigger.
