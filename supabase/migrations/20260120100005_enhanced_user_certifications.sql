-- =====================================================
-- ENHANCED USER CERTIFICATIONS
-- =====================================================

-- Add source tracking
ALTER TABLE user_certifications
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'trike'
  CHECK (source_type IN ('trike', 'external_provider', 'legacy_import', 'employee_upload')),
ADD COLUMN IF NOT EXISTS requirement_id UUID REFERENCES compliance_requirements(id),
ADD COLUMN IF NOT EXISTS external_provider_id UUID,  -- Future: FK to external_providers
ADD COLUMN IF NOT EXISTS import_batch_id UUID;       -- Future: FK to certification_imports

CREATE INDEX idx_user_certs_source ON user_certifications(source_type);
CREATE INDEX idx_user_certs_requirement ON user_certifications(requirement_id);

-- Bulk import tracking
CREATE TABLE IF NOT EXISTS certification_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  imported_by UUID NOT NULL REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_storage_path TEXT,
  total_rows INTEGER DEFAULT 0,
  successful_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  error_log JSONB DEFAULT '[]',
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_cert_imports_org ON certification_imports(organization_id);
CREATE INDEX idx_cert_imports_status ON certification_imports(status);

-- RLS
ALTER TABLE certification_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view imports in their org" ON certification_imports FOR SELECT
  USING (organization_id IN (
    SELECT u.organization_id FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.auth_user_id = auth.uid()
    AND r.name IN ('Admin', 'Trike Super Admin')
  ));

CREATE POLICY "Admins can create imports in their org" ON certification_imports FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT u.organization_id FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.auth_user_id = auth.uid()
    AND r.name IN ('Admin', 'Trike Super Admin')
  ));

-- Function: Check if employee has valid cert for a requirement
CREATE OR REPLACE FUNCTION has_valid_certification(
  p_user_id UUID,
  p_requirement_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_has_cert BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_certifications uc
    JOIN certifications c ON uc.certification_id = c.id
    WHERE uc.user_id = p_user_id
    AND (uc.requirement_id = p_requirement_id OR c.requirement_id = p_requirement_id)
    AND uc.status IN ('valid', 'expiring-soon')
    AND (uc.expiration_date IS NULL OR uc.expiration_date > CURRENT_DATE)
  ) INTO v_has_cert;

  RETURN v_has_cert;
END;
$$ LANGUAGE plpgsql STABLE;
