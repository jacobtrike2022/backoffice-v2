-- =====================================================
-- ALBUM_SCOPES: Same scope model as track_scopes
-- =====================================================
-- One row per album. When opening an org (including demo), show albums where:
-- UNIVERSAL -> all orgs; STATE -> org's operating_states; COMPANY -> that org only.
-- =====================================================

CREATE TABLE IF NOT EXISTS album_scopes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    scope_level TEXT NOT NULL CHECK (scope_level IN (
        'UNIVERSAL', 'SECTOR', 'INDUSTRY', 'STATE', 'COMPANY', 'PROGRAM', 'UNIT'
    )),

    sector TEXT,
    industry_id UUID REFERENCES industries(id) ON DELETE SET NULL,
    state_id UUID REFERENCES us_states(id) ON DELETE SET NULL,
    company_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES stores(id) ON DELETE SET NULL,

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(album_id)
);

CREATE INDEX IF NOT EXISTS idx_album_scopes_album_id ON album_scopes(album_id);
CREATE INDEX IF NOT EXISTS idx_album_scopes_organization ON album_scopes(organization_id);
CREATE INDEX IF NOT EXISTS idx_album_scopes_scope_level ON album_scopes(scope_level);
CREATE INDEX IF NOT EXISTS idx_album_scopes_state ON album_scopes(state_id) WHERE state_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_album_scopes_company ON album_scopes(company_id) WHERE company_id IS NOT NULL;

DROP TRIGGER IF EXISTS update_album_scopes_updated_at ON album_scopes;
CREATE TRIGGER update_album_scopes_updated_at
    BEFORE UPDATE ON album_scopes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE album_scopes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view album_scopes for albums in their org" ON album_scopes;
CREATE POLICY "Users can view album_scopes for albums in their org"
    ON album_scopes FOR SELECT
    USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Trike super admins can view all album_scopes" ON album_scopes;
CREATE POLICY "Trike super admins can view all album_scopes"
    ON album_scopes FOR SELECT
    USING (is_trike_super_admin());

DROP POLICY IF EXISTS "Users can insert album_scopes for their org albums" ON album_scopes;
CREATE POLICY "Users can insert album_scopes for their org albums"
    ON album_scopes FOR INSERT
    WITH CHECK (
        organization_id = get_user_organization_id()
        OR is_trike_super_admin()
    );

DROP POLICY IF EXISTS "Users can update album_scopes for their org" ON album_scopes;
CREATE POLICY "Users can update album_scopes for their org"
    ON album_scopes FOR UPDATE
    USING (
        organization_id = get_user_organization_id()
        OR is_trike_super_admin()
    )
    WITH CHECK (
        organization_id = get_user_organization_id()
        OR is_trike_super_admin()
    );

DROP POLICY IF EXISTS "Users can delete album_scopes for their org" ON album_scopes;
CREATE POLICY "Users can delete album_scopes for their org"
    ON album_scopes FOR DELETE
    USING (
        organization_id = get_user_organization_id()
        OR is_trike_super_admin()
    );

DROP POLICY IF EXISTS "Demo mode: anon view album_scopes" ON album_scopes;
CREATE POLICY "Demo mode: anon view album_scopes"
    ON album_scopes FOR SELECT
    USING (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Demo mode: anon insert album_scopes" ON album_scopes;
CREATE POLICY "Demo mode: anon insert album_scopes"
    ON album_scopes FOR INSERT
    WITH CHECK (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Demo mode: anon update album_scopes" ON album_scopes;
CREATE POLICY "Demo mode: anon update album_scopes"
    ON album_scopes FOR UPDATE
    USING (auth.uid() IS NULL)
    WITH CHECK (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Demo mode: anon delete album_scopes" ON album_scopes;
CREATE POLICY "Demo mode: anon delete album_scopes"
    ON album_scopes FOR DELETE
    USING (auth.uid() IS NULL);

-- Backfill: existing albums get COMPANY scope (visible only to their owning org); edit to UNIVERSAL/STATE as needed
INSERT INTO album_scopes (album_id, organization_id, scope_level, company_id)
SELECT id, organization_id, 'COMPANY', organization_id
FROM albums
WHERE NOT EXISTS (SELECT 1 FROM album_scopes AS aps WHERE aps.album_id = albums.id)
ON CONFLICT (album_id) DO NOTHING;

-- Default new albums to COMPANY scope (visible only to owning org)
CREATE OR REPLACE FUNCTION album_default_scope_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO album_scopes (album_id, organization_id, scope_level, company_id)
  VALUES (NEW.id, NEW.organization_id, 'COMPANY', NEW.organization_id)
  ON CONFLICT (album_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS album_insert_default_scope ON albums;
CREATE TRIGGER album_insert_default_scope
  AFTER INSERT ON albums
  FOR EACH ROW
  EXECUTE FUNCTION album_default_scope_company();

COMMENT ON TABLE album_scopes IS 'One scope per album: UNIVERSAL | STATE | COMPANY etc. Used to show state/company-specific albums when opening an org.';
