-- =====================================================
-- PROSPECT-TO-CLIENT PIPELINE STATE MIGRATION
-- =====================================================
-- Extends organizations.status with new pipeline states
-- while reconciling with existing values from migration 00017
--
-- Existing states (00017):
--   lead, demo, contracting, onboarding, active, churned, suspended
--
-- New state mapping:
--   demo → prospect (exploring, in sales room)
--   contracting → closing (proposal sent)
--   active → live (launched and running)
--   NEW: evaluating (engaged, ROI done)
--   NEW: frozen (expired/stale deal)
--   NEW: renewing (renewal in progress)
--
-- SAFE MIGRATION: Does not remove existing values
-- =====================================================

-- Step 1: Drop the existing constraint
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_status_check;

-- Step 2: Add new constraint with expanded values
-- Keeps old values for backwards compatibility + adds new ones
ALTER TABLE organizations ADD CONSTRAINT organizations_status_check
    CHECK (status IN (
        -- Original values (kept for compatibility)
        'lead',
        'demo',           -- Will migrate to 'prospect'
        'contracting',    -- Will migrate to 'closing'
        'onboarding',
        'active',         -- Will migrate to 'live'
        'churned',
        'suspended',
        -- New pipeline states
        'prospect',       -- Exploring, in sales room (replaces 'demo')
        'evaluating',     -- ROI analysis done, actively considering
        'closing',        -- Proposal sent, contract negotiations (replaces 'contracting')
        'live',           -- Launched and running (replaces 'active')
        'frozen',         -- Expired/stale deal
        'renewing'        -- Renewal in progress
    ));

-- Step 3: Migrate existing values to new states
-- This is safe because we kept the old values in the constraint
UPDATE organizations SET status = 'prospect' WHERE status = 'demo';
UPDATE organizations SET status = 'closing' WHERE status = 'contracting';
UPDATE organizations SET status = 'live' WHERE status = 'active';

-- Step 4: Add new pipeline-specific columns to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deal_value DECIMAL(12, 2);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deal_stage TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deal_probability INTEGER DEFAULT 0 CHECK (deal_probability >= 0 AND deal_probability <= 100);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deal_owner_id UUID REFERENCES users(id);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deal_close_date DATE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deal_lost_reason TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS next_action TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS next_action_date DATE;

-- =====================================================
-- DEALS TABLE - Tracks pipeline deals separately from orgs
-- =====================================================
-- While organizations track the account status,
-- deals track individual sales opportunities
-- (an org can have multiple deals over time - initial, upsells, renewals)

CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to organization (required)
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Deal identification
    name TEXT NOT NULL,                    -- "Acme Corp - Initial Contract"
    deal_type TEXT DEFAULT 'new' CHECK (deal_type IN ('new', 'upsell', 'renewal', 'expansion')),

    -- Pipeline stage
    stage TEXT NOT NULL DEFAULT 'prospect' CHECK (stage IN (
        'lead',        -- Just came in, unqualified
        'prospect',    -- Qualified, exploring
        'evaluating',  -- ROI analysis, comparing options
        'closing',     -- Proposal sent, negotiations
        'won',         -- Deal closed successfully
        'lost',        -- Deal lost
        'frozen'       -- Stalled/expired
    )),

    -- Value tracking
    value DECIMAL(12, 2),                  -- Deal value
    mrr DECIMAL(10, 2),                    -- Monthly recurring revenue
    probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),

    -- Ownership
    owner_id UUID REFERENCES users(id),

    -- Key dates
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expected_close_date DATE,
    actual_close_date DATE,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),

    -- Next action tracking
    next_action TEXT,
    next_action_date DATE,

    -- Loss tracking
    lost_reason TEXT,
    lost_competitor TEXT,

    -- Notes and metadata
    notes TEXT,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',

    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_deals_org ON deals(organization_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_owner ON deals(owner_id);
CREATE INDEX IF NOT EXISTS idx_deals_close_date ON deals(expected_close_date);
CREATE INDEX IF NOT EXISTS idx_deals_created ON deals(created_at DESC);

-- =====================================================
-- DEAL ACTIVITIES TABLE - Activity log for deals
-- =====================================================

CREATE TABLE IF NOT EXISTS deal_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,

    -- Activity type
    activity_type TEXT NOT NULL CHECK (activity_type IN (
        'note',           -- Manual note
        'email',          -- Email sent/received
        'call',           -- Phone call
        'meeting',        -- Meeting scheduled/completed
        'proposal_sent',  -- Proposal sent
        'demo',           -- Demo conducted
        'stage_change',   -- Pipeline stage changed
        'value_change',   -- Deal value updated
        'task',           -- Task created/completed
        'system'          -- System-generated event
    )),

    -- Activity details
    title TEXT NOT NULL,
    description TEXT,

    -- For stage changes
    from_stage TEXT,
    to_stage TEXT,

    -- For value changes
    from_value DECIMAL(12, 2),
    to_value DECIMAL(12, 2),

    -- Who did it
    user_id UUID REFERENCES users(id),

    -- When
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Additional data
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_deal_activities_deal ON deal_activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_activities_type ON deal_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_deal_activities_created ON deal_activities(created_at DESC);

-- =====================================================
-- PROPOSALS TABLE - Track sales proposals
-- =====================================================

CREATE TABLE IF NOT EXISTS proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Proposal identification
    name TEXT NOT NULL,
    version INTEGER DEFAULT 1,

    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN (
        'draft',       -- Being created
        'sent',        -- Sent to prospect
        'viewed',      -- Prospect viewed it
        'accepted',    -- Prospect accepted
        'rejected',    -- Prospect rejected
        'expired',     -- Past expiration date
        'superseded'   -- Replaced by newer version
    )),

    -- Content
    content_json JSONB DEFAULT '{}',       -- Structured proposal content
    pdf_url TEXT,                          -- Generated PDF URL

    -- Pricing
    pricing_tiers JSONB DEFAULT '[]',      -- Pricing options
    selected_tier TEXT,                    -- Which tier they selected
    total_value DECIMAL(12, 2),

    -- Dates
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,

    -- Tracking
    view_count INTEGER DEFAULT 0,
    last_viewed_at TIMESTAMPTZ,

    -- Who created it
    created_by UUID REFERENCES users(id),

    -- Notes
    notes TEXT,
    rejection_reason TEXT,

    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposals_deal ON proposals(deal_id);
CREATE INDEX IF NOT EXISTS idx_proposals_org ON proposals(organization_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Deals RLS - Only trike super admins can see all deals
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- Trike super admins see all deals
CREATE POLICY "Trike super admins can manage all deals"
    ON deals FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid()
            AND r.name = 'Trike Super Admin'
        )
    );

-- Service role has full access
CREATE POLICY "Service role has full access to deals"
    ON deals FOR ALL
    USING (auth.role() = 'service_role');

-- Deal activities RLS
ALTER TABLE deal_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trike super admins can manage deal activities"
    ON deal_activities FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid()
            AND r.name = 'Trike Super Admin'
        )
    );

CREATE POLICY "Service role has full access to deal activities"
    ON deal_activities FOR ALL
    USING (auth.role() = 'service_role');

-- Proposals RLS
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trike super admins can manage all proposals"
    ON proposals FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid()
            AND r.name = 'Trike Super Admin'
        )
    );

CREATE POLICY "Service role has full access to proposals"
    ON proposals FOR ALL
    USING (auth.role() = 'service_role');

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to update deal's last_activity_at when activities are added
CREATE OR REPLACE FUNCTION update_deal_last_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE deals
    SET last_activity_at = NOW(), updated_at = NOW()
    WHERE id = NEW.deal_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for deal activity updates
DROP TRIGGER IF EXISTS trg_update_deal_last_activity ON deal_activities;
CREATE TRIGGER trg_update_deal_last_activity
    AFTER INSERT ON deal_activities
    FOR EACH ROW
    EXECUTE FUNCTION update_deal_last_activity();

-- Function to log stage changes automatically
CREATE OR REPLACE FUNCTION log_deal_stage_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.stage IS DISTINCT FROM NEW.stage THEN
        INSERT INTO deal_activities (
            deal_id,
            activity_type,
            title,
            from_stage,
            to_stage
        ) VALUES (
            NEW.id,
            'stage_change',
            'Stage changed from ' || COALESCE(OLD.stage, 'none') || ' to ' || NEW.stage,
            OLD.stage,
            NEW.stage
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_deal_stage_change ON deals;
CREATE TRIGGER trg_log_deal_stage_change
    AFTER UPDATE ON deals
    FOR EACH ROW
    EXECUTE FUNCTION log_deal_stage_change();

-- Function to sync organization status with primary deal stage
CREATE OR REPLACE FUNCTION sync_org_status_from_deal()
RETURNS TRIGGER AS $$
BEGIN
    -- Only sync if this is the primary/latest deal for the org
    IF NEW.stage IN ('won') THEN
        UPDATE organizations SET status = 'live' WHERE id = NEW.organization_id;
    ELSIF NEW.stage IN ('lost') THEN
        -- Don't change org status for lost deals, they might have other active deals
        NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_org_status_from_deal ON deals;
CREATE TRIGGER trg_sync_org_status_from_deal
    AFTER UPDATE ON deals
    FOR EACH ROW
    WHEN (OLD.stage IS DISTINCT FROM NEW.stage)
    EXECUTE FUNCTION sync_org_status_from_deal();

-- =====================================================
-- PIPELINE SUMMARY VIEW
-- =====================================================

CREATE OR REPLACE VIEW pipeline_summary AS
SELECT
    stage,
    COUNT(*) as deal_count,
    SUM(value) as total_value,
    SUM(mrr) as total_mrr,
    AVG(probability) as avg_probability,
    SUM(value * probability / 100.0) as weighted_value
FROM deals
WHERE stage NOT IN ('won', 'lost')
GROUP BY stage
ORDER BY
    CASE stage
        WHEN 'lead' THEN 1
        WHEN 'prospect' THEN 2
        WHEN 'evaluating' THEN 3
        WHEN 'closing' THEN 4
        WHEN 'frozen' THEN 5
    END;

COMMENT ON VIEW pipeline_summary IS 'Summary of active pipeline by stage';
