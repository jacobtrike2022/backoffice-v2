-- =====================================================
-- CREATE TRACK MEDIA STORAGE BUCKET RLS POLICIES
-- Run this in Supabase SQL Editor
-- =====================================================

-- Ensure the bucket exists (it should already exist, but this is a safety check)
INSERT INTO storage.buckets (id, name, public)
VALUES ('make-2858cc8b-track-media', 'make-2858cc8b-track-media', false)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for track media bucket

-- Policy: Allow authenticated users to upload track media
DROP POLICY IF EXISTS "Authenticated users can upload track media" ON storage.objects;
CREATE POLICY "Authenticated users can upload track media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'make-2858cc8b-track-media' 
  AND auth.role() = 'authenticated'
);

-- Policy: Allow authenticated users to update track media
DROP POLICY IF EXISTS "Authenticated users can update track media" ON storage.objects;
CREATE POLICY "Authenticated users can update track media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'make-2858cc8b-track-media'
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'make-2858cc8b-track-media'
  AND auth.role() = 'authenticated'
);

-- Policy: Allow authenticated users to delete track media
DROP POLICY IF EXISTS "Authenticated users can delete track media" ON storage.objects;
CREATE POLICY "Authenticated users can delete track media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'make-2858cc8b-track-media'
  AND auth.role() = 'authenticated'
);

-- Policy: Allow authenticated users to read track media (for signed URLs)
DROP POLICY IF EXISTS "Authenticated users can read track media" ON storage.objects;
CREATE POLICY "Authenticated users can read track media"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'make-2858cc8b-track-media'
  AND auth.role() = 'authenticated'
);

-- Set bucket configuration
UPDATE storage.buckets
SET 
  file_size_limit = 52428800, -- 50MB in bytes
  allowed_mime_types = ARRAY[
    'image/jpeg', 
    'image/jpg', 
    'image/png', 
    'image/webp', 
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'application/pdf'
  ]
WHERE id = 'make-2858cc8b-track-media';

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check if bucket exists
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'make-2858cc8b-track-media';

-- Check policies
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'objects' AND policyname LIKE '%track media%';

