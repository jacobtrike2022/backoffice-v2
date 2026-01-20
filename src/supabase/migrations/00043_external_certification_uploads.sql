-- =====================================================
-- EXTERNAL CERTIFICATION UPLOADS MIGRATION
-- Allows employees to upload external certifications
-- (TABC, ServSafe, etc.) for admin approval
-- =====================================================

-- =====================================================
-- 1. EXTERNAL CERTIFICATION UPLOADS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS external_certification_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Certificate details (fields per plan)
  certificate_type TEXT NOT NULL,  -- 'TABC', 'ServSafe', 'Food Handler', etc.
  certificate_number TEXT,
  name_on_certificate TEXT NOT NULL,
  issuing_authority TEXT NOT NULL,
  training_provider TEXT,
  state_issued CHAR(2),
  issue_date DATE NOT NULL,
  expiry_date DATE,

  -- Document storage
  document_url TEXT NOT NULL,
  document_storage_path TEXT NOT NULL,

  -- Approval workflow
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Link to user_certifications (created on approval)
  user_certification_id UUID REFERENCES user_certifications(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_ext_cert_org ON external_certification_uploads(organization_id);
CREATE INDEX idx_ext_cert_user ON external_certification_uploads(user_id);
CREATE INDEX idx_ext_cert_status ON external_certification_uploads(status);
CREATE INDEX idx_ext_cert_type ON external_certification_uploads(certificate_type);
CREATE INDEX idx_ext_cert_created ON external_certification_uploads(created_at DESC);

-- =====================================================
-- 2. RLS POLICIES
-- =====================================================

ALTER TABLE external_certification_uploads ENABLE ROW LEVEL SECURITY;

-- Users can view their own uploads
CREATE POLICY "Users can view own certification uploads"
  ON external_certification_uploads FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Users can create uploads for themselves
CREATE POLICY "Users can create certification uploads"
  ON external_certification_uploads FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Admins can view all uploads in their org
CREATE POLICY "Admins can view org certification uploads"
  ON external_certification_uploads FOR SELECT
  USING (
    organization_id IN (
      SELECT u.organization_id FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND r.name IN ('Admin', 'Trike Super Admin')
    )
  );

-- District Managers can view uploads (read-only)
CREATE POLICY "DMs can view org certification uploads"
  ON external_certification_uploads FOR SELECT
  USING (
    organization_id IN (
      SELECT u.organization_id FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND r.name = 'District Manager'
    )
  );

-- Only Admins and Trike Super Admins can approve/reject (update)
CREATE POLICY "Admins can update certification uploads"
  ON external_certification_uploads FOR UPDATE
  USING (
    organization_id IN (
      SELECT u.organization_id FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND r.name IN ('Admin', 'Trike Super Admin')
    )
  );

-- Users can delete their own pending uploads
CREATE POLICY "Users can delete own pending uploads"
  ON external_certification_uploads FOR DELETE
  USING (
    user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
    AND status = 'pending'
  );

-- =====================================================
-- 3. STORAGE BUCKET FOR CERTIFICATION DOCUMENTS
-- =====================================================

-- Note: Run this in the Supabase Dashboard SQL editor or via the Supabase CLI
-- as bucket creation may require different permissions

-- Insert bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'certification-documents',
  'certification-documents',
  false,  -- Private bucket
  10485760,  -- 10MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for certification-documents bucket

-- Users can upload to their own folder: {org_id}/{user_id}/
CREATE POLICY "Users can upload certification docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'certification-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT organization_id::text FROM users WHERE auth_user_id = auth.uid()
    )
    AND (storage.foldername(name))[2] IN (
      SELECT id::text FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Users can view their own documents
CREATE POLICY "Users can view own certification docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'certification-documents'
    AND (storage.foldername(name))[2] IN (
      SELECT id::text FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- Admins can view all documents in their org
CREATE POLICY "Admins can view org certification docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'certification-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT u.organization_id::text FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.auth_user_id = auth.uid()
      AND r.name IN ('Admin', 'Trike Super Admin', 'District Manager')
    )
  );

-- =====================================================
-- 4. UPDATE TRIGGER
-- =====================================================

DROP TRIGGER IF EXISTS update_external_cert_uploads_updated_at ON external_certification_uploads;
CREATE TRIGGER update_external_cert_uploads_updated_at
    BEFORE UPDATE ON external_certification_uploads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 5. HELPER FUNCTION: Get Pending Uploads Count
-- =====================================================

CREATE OR REPLACE FUNCTION get_pending_certification_uploads_count(p_org_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM external_certification_uploads
    WHERE organization_id = p_org_id
    AND status = 'pending'
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- SELECT * FROM external_certification_uploads WHERE status = 'pending';
-- SELECT get_pending_certification_uploads_count('your-org-id');
-- =====================================================
