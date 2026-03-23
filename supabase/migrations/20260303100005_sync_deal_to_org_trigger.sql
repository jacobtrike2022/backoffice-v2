-- =====================================================
-- SYNC DEAL DATA → ORGANIZATION COLUMNS
-- =====================================================
-- The organizations table has denormalized deal columns
-- (deal_value, deal_stage, deal_probability, etc.) for
-- quick-glance display on the Organizations list.
--
-- This trigger keeps them in sync automatically whenever
-- a deal is inserted, updated, or deleted.
--
-- Logic: The "primary" deal for an org is the most
-- recently updated non-terminal deal. If none exist,
-- the columns are cleared.
-- =====================================================

-- Drop the old trigger that only handled won→live
DROP TRIGGER IF EXISTS trg_sync_org_status_from_deal ON deals;
-- Keep the function for now, we'll replace it

-- =====================================================
-- Comprehensive sync function
-- =====================================================
CREATE OR REPLACE FUNCTION sync_deal_to_org()
RETURNS TRIGGER AS $$
DECLARE
    target_org_id UUID;
    primary_deal RECORD;
BEGIN
    -- Determine the organization to update
    IF TG_OP = 'DELETE' THEN
        target_org_id := OLD.organization_id;
    ELSE
        target_org_id := NEW.organization_id;
    END IF;

    -- Find the "primary" deal for this org:
    -- Most recently updated non-terminal deal
    SELECT id, value, stage, probability, owner_id,
           expected_close_date, lost_reason, next_action, next_action_date
    INTO primary_deal
    FROM deals
    WHERE organization_id = target_org_id
      AND stage NOT IN ('won', 'lost')
    ORDER BY updated_at DESC NULLS LAST, created_at DESC
    LIMIT 1;

    IF primary_deal IS NOT NULL THEN
        -- Sync primary deal data to the org
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
        -- No active deals — clear org-level deal columns
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

    -- Handle terminal state: deal won → org status = 'live'
    IF TG_OP != 'DELETE' AND NEW.stage = 'won' THEN
        UPDATE organizations
        SET status = 'live'
        WHERE id = target_org_id
          AND status NOT IN ('live', 'churned', 'suspended');
    END IF;

    -- Return appropriate row
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Attach triggers for INSERT, UPDATE, DELETE
-- =====================================================

DROP TRIGGER IF EXISTS trg_sync_deal_to_org_insert ON deals;
CREATE TRIGGER trg_sync_deal_to_org_insert
    AFTER INSERT ON deals
    FOR EACH ROW
    EXECUTE FUNCTION sync_deal_to_org();

DROP TRIGGER IF EXISTS trg_sync_deal_to_org_update ON deals;
CREATE TRIGGER trg_sync_deal_to_org_update
    AFTER UPDATE ON deals
    FOR EACH ROW
    EXECUTE FUNCTION sync_deal_to_org();

DROP TRIGGER IF EXISTS trg_sync_deal_to_org_delete ON deals;
CREATE TRIGGER trg_sync_deal_to_org_delete
    AFTER DELETE ON deals
    FOR EACH ROW
    EXECUTE FUNCTION sync_deal_to_org();
