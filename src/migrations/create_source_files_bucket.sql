-- =====================================================
-- CREATE SUPABASE STORAGE BUCKET FOR SOURCE FILES
-- =====================================================

-- Create the source-files bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'source-files',
    'source-files',
    false, -- Private bucket
    209715200, -- 200MB in bytes
    ARRAY[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/gif'
    ]
)
ON CONFLICT (id) DO UPDATE
SET 
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv'
    ];

-- Set up RLS policies for the source-files bucket

-- Policy: Allow anonymous uploads
DROP POLICY IF EXISTS "Allow anonymous uploads" ON storage.objects;
CREATE POLICY "Allow anonymous uploads"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'source-files');

-- Policy: Allow anonymous reads
DROP POLICY IF EXISTS "Allow anonymous reads" ON storage.objects;
CREATE POLICY "Allow anonymous reads"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'source-files');

-- Policy: Allow anonymous updates
DROP POLICY IF EXISTS "Allow anonymous updates" ON storage.objects;
CREATE POLICY "Allow anonymous updates"
ON storage.objects FOR UPDATE
TO anon
USING (bucket_id = 'source-files')
WITH CHECK (bucket_id = 'source-files');

-- Policy: Allow anonymous deletes
DROP POLICY IF EXISTS "Allow anonymous deletes" ON storage.objects;
CREATE POLICY "Allow anonymous deletes"
ON storage.objects FOR DELETE
TO anon
USING (bucket_id = 'source-files');

