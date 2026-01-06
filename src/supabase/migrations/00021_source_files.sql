-- =====================================================
-- SOURCE FILES SYSTEM
-- =====================================================
-- Provides:
-- - Source file uploads (PDF, Word, Excel, PowerPoint)
-- - Source type classification
-- - Processing status tracking
-- - RLS for org-scoped access
-- =====================================================

-- SOURCE FILES TABLE
CREATE TABLE IF NOT EXISTS source_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,  -- Path in Supabase storage bucket
    file_url TEXT NOT NULL,      -- Public URL for accessing the file
    file_type TEXT NOT NULL,     -- MIME type
    file_size INTEGER NOT NULL,  -- File size in bytes

    source_type TEXT CHECK (source_type IN (
        'handbook', 'policy', 'procedures', 'communications', 'training_docs', 'other'
    )),

    is_processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    processing_error TEXT,

    -- Metadata from document parsing
    extracted_text TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,

    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_source_files_org ON source_files(organization_id);
CREATE INDEX IF NOT EXISTS idx_source_files_source_type ON source_files(source_type);
CREATE INDEX IF NOT EXISTS idx_source_files_processed ON source_files(is_processed);
CREATE INDEX IF NOT EXISTS idx_source_files_created ON source_files(created_at DESC);

-- RLS
ALTER TABLE source_files ENABLE ROW LEVEL SECURITY;

-- For single-tenant mode: Allow all authenticated users
-- For multi-tenant: Replace 'true' with 'organization_id = get_user_organization_id()'

-- View source files (authenticated users)
CREATE POLICY "View source files" ON source_files FOR SELECT
TO authenticated
USING (true);

-- Insert source files (authenticated users)
CREATE POLICY "Insert source files" ON source_files FOR INSERT
TO authenticated
WITH CHECK (true);

-- Update source files (authenticated users)
CREATE POLICY "Update source files" ON source_files FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Delete source files (authenticated users)
CREATE POLICY "Delete source files" ON source_files FOR DELETE
TO authenticated
USING (true);

-- =====================================================
-- TRIGGER: Update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_source_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_source_files_updated_at
    BEFORE UPDATE ON source_files
    FOR EACH ROW
    EXECUTE FUNCTION update_source_files_updated_at();

-- =====================================================
-- STORAGE BUCKET FOR SOURCE FILES
-- =====================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'source-files',
    'source-files',
    false,
    52428800, -- 50MB
    ARRAY[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv'
    ]
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for source-files bucket
CREATE POLICY "Authenticated users can upload source files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'source-files');

CREATE POLICY "Authenticated users can read source files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'source-files');

CREATE POLICY "Authenticated users can update source files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'source-files');

CREATE POLICY "Authenticated users can delete source files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'source-files');
