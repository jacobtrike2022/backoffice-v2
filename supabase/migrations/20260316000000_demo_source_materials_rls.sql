-- =====================================================
-- DEMO MODE: Source materials (upload, view, edit, chunks, entities)
-- =====================================================
-- Allows anon (demo) users to upload source files, run extraction,
-- view/edit chunks, and create tracks from chunks. Uses auth.uid() IS NULL
-- to match existing demo RLS pattern.
-- =====================================================

-- ----- 1: Storage bucket source-files -----
DROP POLICY IF EXISTS "Demo mode: anon upload source-files" ON storage.objects;
CREATE POLICY "Demo mode: anon upload source-files"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'source-files' AND auth.uid() IS NULL);

DROP POLICY IF EXISTS "Demo mode: anon read source-files" ON storage.objects;
CREATE POLICY "Demo mode: anon read source-files"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'source-files' AND auth.uid() IS NULL);

DROP POLICY IF EXISTS "Demo mode: anon update source-files" ON storage.objects;
CREATE POLICY "Demo mode: anon update source-files"
ON storage.objects FOR UPDATE TO anon
USING (bucket_id = 'source-files' AND auth.uid() IS NULL)
WITH CHECK (bucket_id = 'source-files' AND auth.uid() IS NULL);

DROP POLICY IF EXISTS "Demo mode: anon delete source-files" ON storage.objects;
CREATE POLICY "Demo mode: anon delete source-files"
ON storage.objects FOR DELETE TO anon
USING (bucket_id = 'source-files' AND auth.uid() IS NULL);

-- ----- 2: source_files table -----
DROP POLICY IF EXISTS "Demo mode: anon view source_files" ON source_files;
CREATE POLICY "Demo mode: anon view source_files"
ON source_files FOR SELECT TO anon USING (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Demo mode: anon insert source_files" ON source_files;
CREATE POLICY "Demo mode: anon insert source_files"
ON source_files FOR INSERT TO anon WITH CHECK (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Demo mode: anon update source_files" ON source_files;
CREATE POLICY "Demo mode: anon update source_files"
ON source_files FOR UPDATE TO anon
USING (auth.uid() IS NULL) WITH CHECK (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Demo mode: anon delete source_files" ON source_files;
CREATE POLICY "Demo mode: anon delete source_files"
ON source_files FOR DELETE TO anon USING (auth.uid() IS NULL);

-- ----- 3: source_chunks table -----
DROP POLICY IF EXISTS "Demo mode: anon view source_chunks" ON source_chunks;
CREATE POLICY "Demo mode: anon view source_chunks"
ON source_chunks FOR SELECT TO anon USING (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Demo mode: anon insert source_chunks" ON source_chunks;
CREATE POLICY "Demo mode: anon insert source_chunks"
ON source_chunks FOR INSERT TO anon WITH CHECK (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Demo mode: anon update source_chunks" ON source_chunks;
CREATE POLICY "Demo mode: anon update source_chunks"
ON source_chunks FOR UPDATE TO anon
USING (auth.uid() IS NULL) WITH CHECK (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Demo mode: anon delete source_chunks" ON source_chunks;
CREATE POLICY "Demo mode: anon delete source_chunks"
ON source_chunks FOR DELETE TO anon USING (auth.uid() IS NULL);

-- ----- 4: extracted_entities table -----
DROP POLICY IF EXISTS "Demo mode: anon view extracted_entities" ON extracted_entities;
CREATE POLICY "Demo mode: anon view extracted_entities"
ON extracted_entities FOR SELECT TO anon USING (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Demo mode: anon insert extracted_entities" ON extracted_entities;
CREATE POLICY "Demo mode: anon insert extracted_entities"
ON extracted_entities FOR INSERT TO anon WITH CHECK (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Demo mode: anon update extracted_entities" ON extracted_entities;
CREATE POLICY "Demo mode: anon update extracted_entities"
ON extracted_entities FOR UPDATE TO anon
USING (auth.uid() IS NULL) WITH CHECK (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Demo mode: anon delete extracted_entities" ON extracted_entities;
CREATE POLICY "Demo mode: anon delete extracted_entities"
ON extracted_entities FOR DELETE TO anon USING (auth.uid() IS NULL);
