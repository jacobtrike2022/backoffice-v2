-- =====================================================
-- FORM_SCOPES: Normalized scope per form (one row per form)
-- Mirrors track_scopes for consistent visibility across content types.
-- =====================================================

CREATE TABLE IF NOT EXISTS form_scopes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    scope_level TEXT NOT NULL CHECK (scope_level IN (
        'UNIVERSAL', 'SECTOR', 'INDUSTRY', 'STATE', 'COMPANY', 'PROGRAM', 'UNIT'
    )),

    -- Sub-scope FKs (nullable; required by level enforced in app)
    sector TEXT,
    industry_id UUID REFERENCES industries(id) ON DELETE SET NULL,
    state_id UUID REFERENCES us_states(id) ON DELETE SET NULL,
    company_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES stores(id) ON DELETE SET NULL,

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(form_id)
);

CREATE INDEX IF NOT EXISTS idx_form_scopes_form_id ON form_scopes(form_id);
CREATE INDEX IF NOT EXISTS idx_form_scopes_organization ON form_scopes(organization_id);
CREATE INDEX IF NOT EXISTS idx_form_scopes_scope_level ON form_scopes(scope_level);
CREATE INDEX IF NOT EXISTS idx_form_scopes_sector ON form_scopes(sector) WHERE sector IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_form_scopes_industry ON form_scopes(industry_id) WHERE industry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_form_scopes_state ON form_scopes(state_id) WHERE state_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_form_scopes_company ON form_scopes(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_form_scopes_program ON form_scopes(program_id) WHERE program_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_form_scopes_unit ON form_scopes(unit_id) WHERE unit_id IS NOT NULL;

-- Keep updated_at in sync
DROP TRIGGER IF EXISTS update_form_scopes_updated_at ON form_scopes;
CREATE TRIGGER update_form_scopes_updated_at
    BEFORE UPDATE ON form_scopes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE form_scopes ENABLE ROW LEVEL SECURITY;

-- SELECT: org-scoped or Trike Super Admin
DROP POLICY IF EXISTS "Users can view form_scopes for their org" ON form_scopes;
CREATE POLICY "Users can view form_scopes for their org"
    ON form_scopes FOR SELECT
    USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Trike super admins can view all form_scopes" ON form_scopes;
CREATE POLICY "Trike super admins can view all form_scopes"
    ON form_scopes FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.auth_user_id = auth.uid() AND r.name = 'Trike Super Admin'
    ));

-- INSERT
DROP POLICY IF EXISTS "Users can insert form_scopes for their org" ON form_scopes;
CREATE POLICY "Users can insert form_scopes for their org"
    ON form_scopes FOR INSERT
    WITH CHECK (
        organization_id = get_user_organization_id()
        OR EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid() AND r.name = 'Trike Super Admin'
        )
    );

-- UPDATE
DROP POLICY IF EXISTS "Users can update form_scopes for their org" ON form_scopes;
CREATE POLICY "Users can update form_scopes for their org"
    ON form_scopes FOR UPDATE
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

-- DELETE
DROP POLICY IF EXISTS "Users can delete form_scopes for their org" ON form_scopes;
CREATE POLICY "Users can delete form_scopes for their org"
    ON form_scopes FOR DELETE
    USING (
        organization_id = get_user_organization_id()
        OR EXISTS (
            SELECT 1 FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.auth_user_id = auth.uid() AND r.name = 'Trike Super Admin'
        )
    );

-- Demo mode: anon access
DROP POLICY IF EXISTS "Demo mode: anon view form_scopes" ON form_scopes;
CREATE POLICY "Demo mode: anon view form_scopes"
    ON form_scopes FOR SELECT
    USING (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Demo mode: anon insert form_scopes" ON form_scopes;
CREATE POLICY "Demo mode: anon insert form_scopes"
    ON form_scopes FOR INSERT
    WITH CHECK (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Demo mode: anon update form_scopes" ON form_scopes;
CREATE POLICY "Demo mode: anon update form_scopes"
    ON form_scopes FOR UPDATE
    USING (auth.uid() IS NULL)
    WITH CHECK (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Demo mode: anon delete form_scopes" ON form_scopes;
CREATE POLICY "Demo mode: anon delete form_scopes"
    ON form_scopes FOR DELETE
    USING (auth.uid() IS NULL);

-- Backfill: give all existing forms a COMPANY scope defaulting to their org
INSERT INTO form_scopes (form_id, organization_id, scope_level, company_id)
SELECT f.id, f.organization_id, 'COMPANY', f.organization_id
FROM forms f
WHERE NOT EXISTS (
    SELECT 1 FROM form_scopes fs WHERE fs.form_id = f.id
)
ON CONFLICT (form_id) DO NOTHING;
