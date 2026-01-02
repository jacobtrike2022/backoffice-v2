-- =====================================================
-- ORGANIZATION ONBOARDING & DEMO SUPPORT
-- =====================================================
-- Adds fields to support:
-- - B2B demo instances
-- - Self-service onboarding
-- - Company profile (industry, services)
-- - Pipeline status tracking
-- =====================================================

-- Add onboarding/pipeline fields to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'
    CHECK (status IN ('lead', 'demo', 'contracting', 'onboarding', 'active', 'churned', 'suspended'));

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS demo_expires_at TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

-- Company profile fields
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS industry TEXT;  -- 'convenience_retail', 'qsr', 'grocery', etc.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS services_offered TEXT[] DEFAULT '{}';  -- ['fuel', 'alcohol', 'tobacco', 'food_service', 'lottery', 'car_wash']
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS operating_states TEXT[] DEFAULT '{}';  -- ['GA', 'FL', 'TX']

-- Brand customization (scraped or manual)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS brand_primary_color TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS brand_secondary_color TEXT;

-- Onboarding metadata
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_source TEXT;  -- 'self_service', 'sales_demo', 'referral', 'inbound'
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS scraped_data JSONB DEFAULT '{}';  -- Raw data from web scraping

-- Billing/contract fields (for future Stripe integration)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_tier TEXT;  -- 'starter', 'professional', 'enterprise'
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contract_signed_at TIMESTAMPTZ;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);
CREATE INDEX IF NOT EXISTS idx_organizations_demo_expires ON organizations(demo_expires_at) WHERE demo_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_industry ON organizations(industry);

-- =====================================================
-- INDUSTRY REFERENCE TABLE (Trike-managed)
-- =====================================================

CREATE TABLE IF NOT EXISTS industries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,            -- 'convenience_retail', 'qsr', 'grocery'
    name TEXT NOT NULL,                   -- 'Convenience Retail'
    description TEXT,

    -- Default services for this industry
    default_services TEXT[] DEFAULT '{}', -- Pre-checked services when industry selected

    -- Typical compliance domains
    compliance_domains TEXT[] DEFAULT '{}',  -- ['alcohol', 'tobacco', 'food_safety']

    -- Display
    icon TEXT,                            -- Icon name for UI
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial industries
INSERT INTO industries (slug, name, description, default_services, compliance_domains, sort_order) VALUES
    ('convenience_retail', 'Convenience Retail', 'Convenience stores, gas stations, travel centers',
     ARRAY['fuel', 'alcohol', 'tobacco', 'food_service', 'lottery'],
     ARRAY['alcohol', 'tobacco', 'food_safety', 'fuel_safety'], 1),
    ('qsr', 'Quick Service Restaurant', 'Fast food, fast casual dining',
     ARRAY['food_service'],
     ARRAY['food_safety'], 2),
    ('grocery', 'Grocery & Supermarket', 'Grocery stores, supermarkets',
     ARRAY['alcohol', 'tobacco', 'food_service', 'pharmacy'],
     ARRAY['alcohol', 'tobacco', 'food_safety'], 3),
    ('fuel_retail', 'Fuel Retail', 'Gas stations, truck stops (no c-store)',
     ARRAY['fuel'],
     ARRAY['fuel_safety', 'environmental'], 4),
    ('hospitality', 'Hospitality', 'Hotels, motels, lodging',
     ARRAY['food_service', 'alcohol'],
     ARRAY['food_safety', 'alcohol'], 5)
ON CONFLICT (slug) DO NOTHING;

-- RLS for industries (read-only for authenticated users)
ALTER TABLE industries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read industries"
    ON industries FOR SELECT
    USING (true);

-- =====================================================
-- SERVICE DEFINITIONS TABLE (Trike-managed)
-- =====================================================

CREATE TABLE IF NOT EXISTS service_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,            -- 'fuel', 'alcohol', 'tobacco'
    name TEXT NOT NULL,                   -- 'Fuel Sales'
    description TEXT,

    -- Compliance implications
    compliance_domains TEXT[] DEFAULT '{}',  -- What compliance this service triggers
    requires_license BOOLEAN DEFAULT FALSE,

    -- Display
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed service definitions
INSERT INTO service_definitions (slug, name, description, compliance_domains, requires_license, sort_order) VALUES
    ('fuel', 'Fuel Sales', 'Gasoline, diesel, and other motor fuels', ARRAY['fuel_safety', 'environmental'], true, 1),
    ('alcohol', 'Alcohol Sales', 'Beer, wine, spirits', ARRAY['alcohol'], true, 2),
    ('tobacco', 'Tobacco Sales', 'Cigarettes, cigars, smokeless tobacco', ARRAY['tobacco'], true, 3),
    ('vape', 'Vape/E-cigarette Sales', 'Vaping products and e-cigarettes', ARRAY['tobacco', 'vape'], true, 4),
    ('lottery', 'Lottery Sales', 'State lottery tickets and games', ARRAY['lottery'], true, 5),
    ('food_service', 'Food Service', 'Prepared food, hot food, food handling', ARRAY['food_safety'], true, 6),
    ('car_wash', 'Car Wash', 'Automated or manual car wash services', ARRAY[], false, 7),
    ('atm', 'ATM Services', 'Cash machines and financial services', ARRAY[], false, 8),
    ('pharmacy', 'Pharmacy', 'Prescription and OTC medications', ARRAY['pharmacy'], true, 9),
    ('money_orders', 'Money Services', 'Money orders, wire transfers, bill pay', ARRAY['financial'], true, 10)
ON CONFLICT (slug) DO NOTHING;

-- RLS for service_definitions
ALTER TABLE service_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read service_definitions"
    ON service_definitions FOR SELECT
    USING (true);

-- =====================================================
-- STORE SERVICES (Override company defaults per location)
-- =====================================================

-- Add services_offered to stores for per-location override
ALTER TABLE stores ADD COLUMN IF NOT EXISTS services_offered TEXT[];  -- NULL = inherit from org
ALTER TABLE stores ADD COLUMN IF NOT EXISTS services_excluded TEXT[] DEFAULT '{}';  -- Explicit exclusions

-- =====================================================
-- ONBOARDING SESSIONS TABLE (Track onboarding progress)
-- =====================================================

CREATE TABLE IF NOT EXISTS onboarding_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Can be linked to org, or standalone for leads
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

    -- Session tracking
    session_token TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'started' CHECK (status IN ('started', 'in_progress', 'completed', 'abandoned')),

    -- Collected data (before org is fully created)
    collected_data JSONB DEFAULT '{}',
    /*
    collected_data structure:
    {
      website: "www.quiktrip.com",
      company_name: "QuikTrip",
      contact_email: "admin@qt.com",
      contact_name: "John Smith",
      industry: "convenience_retail",
      services: ["fuel", "alcohol", "tobacco", "food_service"],
      operating_states: ["OK", "TX", "GA"],
      estimated_locations: 950,
      scraped_stores: [...],
      scraped_logo_url: "...",
      scraped_colors: { primary: "#...", secondary: "#..." }
    }
    */

    -- Conversation history for RAG agent
    conversation_history JSONB DEFAULT '[]',

    -- Progress tracking
    current_step TEXT DEFAULT 'welcome',
    steps_completed TEXT[] DEFAULT '{}',

    -- Metadata
    ip_address TEXT,
    user_agent TEXT,
    referrer TEXT,
    utm_params JSONB DEFAULT '{}',

    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_token ON onboarding_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_status ON onboarding_sessions(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_sessions_org ON onboarding_sessions(organization_id);

-- RLS - onboarding sessions are semi-public (token-based access)
ALTER TABLE onboarding_sessions ENABLE ROW LEVEL SECURITY;

-- Allow creating new sessions without auth
CREATE POLICY "Anyone can create onboarding sessions"
    ON onboarding_sessions FOR INSERT
    WITH CHECK (true);

-- Allow reading/updating own session via token (handled in edge function)
CREATE POLICY "Service role can manage all onboarding sessions"
    ON onboarding_sessions FOR ALL
    USING (auth.role() = 'service_role');

-- =====================================================
-- HELPER FUNCTION: Create demo organization from onboarding
-- =====================================================

CREATE OR REPLACE FUNCTION create_demo_organization(
    p_session_id UUID,
    p_demo_days INTEGER DEFAULT 14
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session onboarding_sessions%ROWTYPE;
    v_org_id UUID;
    v_data JSONB;
BEGIN
    -- Get session data
    SELECT * INTO v_session FROM onboarding_sessions WHERE id = p_session_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session not found';
    END IF;

    v_data := v_session.collected_data;

    -- Create organization
    INSERT INTO organizations (
        name,
        subdomain,
        website,
        status,
        demo_expires_at,
        industry,
        services_offered,
        operating_states,
        brand_primary_color,
        brand_secondary_color,
        onboarding_source,
        scraped_data
    ) VALUES (
        v_data->>'company_name',
        lower(regexp_replace(v_data->>'company_name', '[^a-zA-Z0-9]', '', 'g')),
        v_data->>'website',
        'demo',
        NOW() + (p_demo_days || ' days')::INTERVAL,
        v_data->>'industry',
        ARRAY(SELECT jsonb_array_elements_text(v_data->'services')),
        ARRAY(SELECT jsonb_array_elements_text(v_data->'operating_states')),
        v_data->'scraped_colors'->>'primary',
        v_data->'scraped_colors'->>'secondary',
        'self_service',
        v_data->'scraped_data'
    )
    RETURNING id INTO v_org_id;

    -- Link session to org
    UPDATE onboarding_sessions
    SET organization_id = v_org_id, status = 'completed', completed_at = NOW()
    WHERE id = p_session_id;

    RETURN v_org_id;
END;
$$;
