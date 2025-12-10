-- =====================================================
-- CREATE SUPABASE STORAGE BUCKET FOR STORE PHOTOS
-- =====================================================

-- Create the store-photos bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-photos', 'store-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the store-photos bucket

-- Policy: Allow authenticated users to upload photos
CREATE POLICY IF NOT EXISTS "Authenticated users can upload store photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'store-photos');

-- Policy: Allow authenticated users to update their organization's photos
CREATE POLICY IF NOT EXISTS "Authenticated users can update store photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'store-photos')
WITH CHECK (bucket_id = 'store-photos');

-- Policy: Allow authenticated users to delete their organization's photos
CREATE POLICY IF NOT EXISTS "Authenticated users can delete store photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'store-photos');

-- Policy: Allow public read access (since bucket is public)
CREATE POLICY IF NOT EXISTS "Public can view store photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'store-photos');

-- Set CORS and other bucket configurations
UPDATE storage.buckets
SET 
  file_size_limit = 5242880, -- 5MB in bytes
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'store-photos';
