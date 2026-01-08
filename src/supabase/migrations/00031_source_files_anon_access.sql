-- =====================================================
-- SOURCE FILES STORAGE - ANONYMOUS ACCESS FOR DEMO MODE
-- =====================================================
-- Adds anonymous (anon) policies to allow file uploads
-- when the app is running without authentication.
--
-- WARNING: These policies should be removed or restricted
-- before deploying to production.
-- =====================================================

-- Add anon policies for source-files bucket
-- (The existing authenticated policies remain for when auth is enabled)

-- Anonymous users can upload source files
CREATE POLICY "Anonymous users can upload source files"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'source-files');

-- Anonymous users can read source files
CREATE POLICY "Anonymous users can read source files"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'source-files');

-- Anonymous users can update source files
CREATE POLICY "Anonymous users can update source files"
ON storage.objects FOR UPDATE
TO anon
USING (bucket_id = 'source-files');

-- Anonymous users can delete source files
CREATE POLICY "Anonymous users can delete source files"
ON storage.objects FOR DELETE
TO anon
USING (bucket_id = 'source-files');

-- Also add anon policies to the source_files table
-- to match the storage policies

-- View source files (anonymous users for demo mode)
CREATE POLICY "Anonymous view source files" ON source_files FOR SELECT
TO anon
USING (true);

-- Insert source files (anonymous users for demo mode)
CREATE POLICY "Anonymous insert source files" ON source_files FOR INSERT
TO anon
WITH CHECK (true);

-- Update source files (anonymous users for demo mode)
CREATE POLICY "Anonymous update source files" ON source_files FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Delete source files (anonymous users for demo mode)
CREATE POLICY "Anonymous delete source files" ON source_files FOR DELETE
TO anon
USING (true);
