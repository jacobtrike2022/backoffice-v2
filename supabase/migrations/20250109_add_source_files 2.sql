-- ============================================================================
-- SOURCE FILES TABLE (prerequisite for source_chunks)
-- Must run before 20250110_add_source_chunks.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS source_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,

    source_type TEXT CHECK (source_type IN (
        'handbook', 'policy', 'procedures', 'job_description', 'communications', 'training_docs', 'other'
    )),

    is_processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    processing_error TEXT,

    extracted_text TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,

    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_source_files_org ON source_files(organization_id);
CREATE INDEX IF NOT EXISTS idx_source_files_source_type ON source_files(source_type);
CREATE INDEX IF NOT EXISTS idx_source_files_processed ON source_files(is_processed);

ALTER TABLE source_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View source files" ON source_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert source files" ON source_files FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Update source files" ON source_files FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Delete source files" ON source_files FOR DELETE TO authenticated USING (true);
