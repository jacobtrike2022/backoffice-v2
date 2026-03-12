-- =====================================================
-- SIMPLIFY ORGANIZATION STATUS TO DEMO AND LIVE ONLY
-- =====================================================
-- Reduces org status to two values:
--   demo = prospect portal + timer (demo_expires_at)
--   live = full org until deactivated
--
-- Migration maps all existing statuses to demo or live.
-- =====================================================

-- Step 1: Migrate existing values to demo or live
-- demo/prospect/evaluating/closing/lead/frozen → demo (prospect portal)
-- onboarding/live/churned/suspended/renewing/contracting/active → live (full org)
UPDATE organizations SET status = 'demo'
WHERE status IN ('demo', 'lead', 'prospect', 'evaluating', 'closing', 'frozen');

UPDATE organizations SET status = 'live'
WHERE status IN ('onboarding', 'churned', 'suspended', 'renewing', 'contracting', 'active');

-- Step 2: Drop the existing constraint
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_status_check;

-- Step 3: Add new constraint with only demo and live
ALTER TABLE organizations ADD CONSTRAINT organizations_status_check
    CHECK (status IN ('demo', 'live'));

-- Step 4: Update sync_deal_to_org to use simplified status (deal won → org live)
CREATE OR REPLACE FUNCTION sync_deal_to_org()
RETURNS TRIGGER AS $$
DECLARE
    target_org_id UUID;
    primary_deal RECORD;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_org_id := OLD.organization_id;
    ELSE
        target_org_id := NEW.organization_id;
    END IF;

    SELECT id, value, stage, probability, owner_id,
           expected_close_date, lost_reason, next_action, next_action_date
    INTO primary_deal
    FROM deals
    WHERE organization_id = target_org_id
      AND stage NOT IN ('won', 'lost')
    ORDER BY updated_at DESC NULLS LAST, created_at DESC
    LIMIT 1;

    IF primary_deal IS NOT NULL THEN
        UPDATE organizations SET
            deal_value       = primary_deal.value,
            deal_stage       = primary_deal.stage,
            deal_probability = primary_deal.probability,
            deal_owner_id    = primary_deal.owner_id,
            deal_close_date  = primary_deal.expected_close_date,
            deal_lost_reason = NULL,
            last_activity_at = NOW(),
            next_action      = primary_deal.next_action,
            next_action_date = primary_deal.next_action_date
        WHERE id = target_org_id;
    ELSE
        UPDATE organizations SET
            deal_value       = NULL,
            deal_stage       = NULL,
            deal_probability = 0,
            deal_owner_id    = NULL,
            deal_close_date  = NULL,
            deal_lost_reason = NULL,
            last_activity_at = NOW(),
            next_action      = NULL,
            next_action_date = NULL
        WHERE id = target_org_id;
    END IF;

    -- Deal won → org status = 'live' (only from demo)
    IF TG_OP != 'DELETE' AND NEW.stage = 'won' THEN
        UPDATE organizations
        SET status = 'live'
        WHERE id = target_org_id
          AND status = 'demo';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;
