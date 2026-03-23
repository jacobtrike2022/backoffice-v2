-- =====================================================
-- US_STATES: Canonical reference for state-level scope
-- =====================================================

CREATE TABLE IF NOT EXISTS us_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,   -- 'AL', 'AK', ... 'WY', 'DC'
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_us_states_code ON us_states(code);
CREATE INDEX IF NOT EXISTS idx_us_states_active ON us_states(is_active) WHERE is_active = true;

-- Seed all 50 states + DC (sort_order by alpha code)
INSERT INTO us_states (code, name, sort_order) VALUES
    ('AL', 'Alabama', 1),
    ('AK', 'Alaska', 2),
    ('AZ', 'Arizona', 3),
    ('AR', 'Arkansas', 4),
    ('CA', 'California', 5),
    ('CO', 'Colorado', 6),
    ('CT', 'Connecticut', 7),
    ('DE', 'Delaware', 8),
    ('DC', 'District of Columbia', 9),
    ('FL', 'Florida', 10),
    ('GA', 'Georgia', 11),
    ('HI', 'Hawaii', 12),
    ('ID', 'Idaho', 13),
    ('IL', 'Illinois', 14),
    ('IN', 'Indiana', 15),
    ('IA', 'Iowa', 16),
    ('KS', 'Kansas', 17),
    ('KY', 'Kentucky', 18),
    ('LA', 'Louisiana', 19),
    ('ME', 'Maine', 20),
    ('MD', 'Maryland', 21),
    ('MA', 'Massachusetts', 22),
    ('MI', 'Michigan', 23),
    ('MN', 'Minnesota', 24),
    ('MS', 'Mississippi', 25),
    ('MO', 'Missouri', 26),
    ('MT', 'Montana', 27),
    ('NE', 'Nebraska', 28),
    ('NV', 'Nevada', 29),
    ('NH', 'New Hampshire', 30),
    ('NJ', 'New Jersey', 31),
    ('NM', 'New Mexico', 32),
    ('NY', 'New York', 33),
    ('NC', 'North Carolina', 34),
    ('ND', 'North Dakota', 35),
    ('OH', 'Ohio', 36),
    ('OK', 'Oklahoma', 37),
    ('OR', 'Oregon', 38),
    ('PA', 'Pennsylvania', 39),
    ('RI', 'Rhode Island', 40),
    ('SC', 'South Carolina', 41),
    ('SD', 'South Dakota', 42),
    ('TN', 'Tennessee', 43),
    ('TX', 'Texas', 44),
    ('UT', 'Utah', 45),
    ('VT', 'Vermont', 46),
    ('VA', 'Virginia', 47),
    ('WA', 'Washington', 48),
    ('WV', 'West Virginia', 49),
    ('WI', 'Wisconsin', 50),
    ('WY', 'Wyoming', 51)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE us_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read us_states" ON us_states;
CREATE POLICY "Anyone can read us_states"
    ON us_states FOR SELECT
    USING (true);

-- =====================================================
-- TRACK_SCOPES: Normalized scope per track (one row per track)
-- =====================================================

CREATE TABLE IF NOT EXISTS track_scopes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    scope_level TEXT NOT NULL CHECK (scope_level IN (
        'UNIVERSAL', 'SECTOR', 'INDUSTRY', 'STATE', 'COMPANY', 'PROGRAM', 'UNIT'
    )),

    -- Sub-scope FKs (nullable; required by level enforced in app/trigger if desired)
    sector TEXT,                    -- SECTOR: 'RETAIL' | 'RESTAURANT' | 'HOSPITALITY' | 'DISTRIBUTION'
    industry_id UUID REFERENCES industries(id) ON DELETE SET NULL,
    state_id UUID REFERENCES us_states(id) ON DELETE SET NULL,
    company_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES stores(id) ON DELETE SET NULL,

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(track_id)
);

CREATE INDEX IF NOT EXISTS idx_track_scopes_track_id ON track_scopes(track_id);
CREATE INDEX IF NOT EXISTS idx_track_scopes_organization ON track_scopes(organization_id);
CREATE INDEX IF NOT EXISTS idx_track_scopes_scope_level ON track_scopes(scope_level);
CREATE INDEX IF NOT EXISTS idx_track_scopes_sector ON track_scopes(sector) WHERE sector IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_track_scopes_industry ON track_scopes(industry_id) WHERE industry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_track_scopes_state ON track_scopes(state_id) WHERE state_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_track_scopes_company ON track_scopes(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_track_scopes_program ON track_scopes(program_id) WHERE program_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_track_scopes_unit ON track_scopes(unit_id) WHERE unit_id IS NOT NULL;

-- Keep updated_at in sync
DROP TRIGGER IF EXISTS update_track_scopes_updated_at ON track_scopes;
CREATE TRIGGER update_track_scopes_updated_at
    BEFORE UPDATE ON track_scopes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE track_scopes ENABLE ROW LEVEL SECURITY;

-- SELECT: same visibility as tracks (org-scoped or Trike Super Admin)
DROP POLICY IF EXISTS "Users can view track_scopes for tracks in their org" ON track_scopes;
CREATE POLICY "Users can view track_scopes for tracks in their org"
    ON track_scopes FOR SELECT
    USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Trike super admins can view all track_scopes" ON track_scopes;
CREATE POLICY "Trike super admins can view all track_scopes"
    ON track_scopes FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.auth_user_id = auth.uid() AND r.name = 'Trike Super Admin'
    ));

-- INSERT: can create scope for track in org (content creator pattern) or Trike Super Admin
DROP POLICY IF EXISTS "Users can insert track_scopes for their org tracks" ON track_scopes;
CREATE POLICY "Users can insert track_scopes for their org tracks"
    ON track_scopes FOR INSERT
    WITH CHECK (
        organization_id = get_user_organization_id()
        OR EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid() AND r.name = 'Trike Super Admin'
        )
    );

-- UPDATE: same as insert
DROP POLICY IF EXISTS "Users can update track_scopes for their org" ON track_scopes;
CREATE POLICY "Users can update track_scopes for their org"
    ON track_scopes FOR UPDATE
    USING (
        organization_id = get_user_organization_id()
        OR EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid() AND r.name = 'Trike Super Admin'
        )
    )
    WITH CHECK (
        organization_id = get_user_organization_id()
        OR EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid() AND r.name = 'Trike Super Admin'
        )
    );

-- DELETE: same
DROP POLICY IF EXISTS "Users can delete track_scopes for their org" ON track_scopes;
CREATE POLICY "Users can delete track_scopes for their org"
    ON track_scopes FOR DELETE
    USING (
        organization_id = get_user_organization_id()
        OR EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid() AND r.name = 'Trike Super Admin'
        )
    );

-- Demo mode: anon can read track_scopes (for demo content visibility)
DROP POLICY IF EXISTS "Demo mode: anon view track_scopes" ON track_scopes;
CREATE POLICY "Demo mode: anon view track_scopes"
    ON track_scopes FOR SELECT
    USING (auth.uid() IS NULL);

COMMENT ON TABLE us_states IS 'Canonical US state reference for track scope, org operating states, and compliance.';
COMMENT ON TABLE track_scopes IS 'One scope definition per track: UNIVERSAL | SECTOR | INDUSTRY | STATE | COMPANY | PROGRAM | UNIT.';
