-- =====================================================
-- CREATE FORM UPLOADS STORAGE BUCKET
-- Idempotent — safe to re-run
-- =====================================================

-- Create the bucket (public-readable so uploaded files can be viewed in submissions)
INSERT INTO storage.buckets (id, name, public)
VALUES ('form-uploads', 'form-uploads', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Set bucket configuration: 20 MB limit, common file types
UPDATE storage.buckets
SET
  file_size_limit = 20971520, -- 20 MB
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ]
WHERE id = 'form-uploads';

-- =====================================================
-- RLS POLICIES — allow anon + authenticated uploads
-- (demo mode has no auth session, uses anon key)
-- =====================================================

-- Anyone can read (bucket is public, but SELECT policy is still needed)
DROP POLICY IF EXISTS "Anyone can read form uploads" ON storage.objects;
CREATE POLICY "Anyone can read form uploads"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'form-uploads');

-- Anyone can upload (anon for demo mode, authenticated for logged-in users)
DROP POLICY IF EXISTS "Anyone can upload to form uploads" ON storage.objects;
CREATE POLICY "Anyone can upload to form uploads"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'form-uploads');

-- Anyone can update their own uploads
DROP POLICY IF EXISTS "Anyone can update form uploads" ON storage.objects;
CREATE POLICY "Anyone can update form uploads"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'form-uploads')
WITH CHECK (bucket_id = 'form-uploads');

-- Anyone can delete (for re-upload scenarios)
DROP POLICY IF EXISTS "Anyone can delete form uploads" ON storage.objects;
CREATE POLICY "Anyone can delete form uploads"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'form-uploads');
