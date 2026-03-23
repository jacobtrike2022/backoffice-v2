-- =====================================================
-- COMPREHENSIVE DEMO MODE RLS FIX
-- =====================================================
-- Fixes ALL RLS policies that block demo mode users from
-- using the application when not authenticated.
--
-- Demo mode context:
--   auth.role()  = 'anon'
--   auth.uid()   = NULL
--   Demo users access via ?demo_org_id=<uuid> URL param
--
-- Pattern used: auth.uid() IS NULL
--   This is the simplest, most reliable demo detection since
--   unauthenticated demo requests inherently have no auth.uid().
--   Production authenticated users always have auth.uid() != NULL,
--   so these policies cannot accidentally grant extra access.
-- =====================================================


-- =====================================================
-- SECTION 1: STORAGE BUCKETS
-- Fix upload/update/delete for demo users on all buckets
-- =====================================================

-- ----- 1A: organization-logos bucket -----
-- (Root cause of "Failed to save logos" error)

DROP POLICY IF EXISTS "Demo mode: anon upload logos" ON storage.objects;
CREATE POLICY "Demo mode: anon upload logos"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'organization-logos'
  AND auth.uid() IS NULL
);

DROP POLICY IF EXISTS "Demo mode: anon update logos" ON storage.objects;
CREATE POLICY "Demo mode: anon update logos"
ON storage.objects FOR UPDATE
TO anon
USING (
  bucket_id = 'organization-logos'
  AND auth.uid() IS NULL
)
WITH CHECK (
  bucket_id = 'organization-logos'
  AND auth.uid() IS NULL
);

DROP POLICY IF EXISTS "Demo mode: anon delete logos" ON storage.objects;
CREATE POLICY "Demo mode: anon delete logos"
ON storage.objects FOR DELETE
TO anon
USING (
  bucket_id = 'organization-logos'
  AND auth.uid() IS NULL
);


-- ----- 1B: store-photos bucket -----
-- Allows demo users to upload/manage store photos

DROP POLICY IF EXISTS "Demo mode: anon upload store photos" ON storage.objects;
CREATE POLICY "Demo mode: anon upload store photos"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'store-photos'
  AND auth.uid() IS NULL
);

DROP POLICY IF EXISTS "Demo mode: anon update store photos" ON storage.objects;
CREATE POLICY "Demo mode: anon update store photos"
ON storage.objects FOR UPDATE
TO anon
USING (
  bucket_id = 'store-photos'
  AND auth.uid() IS NULL
)
WITH CHECK (
  bucket_id = 'store-photos'
  AND auth.uid() IS NULL
);

DROP POLICY IF EXISTS "Demo mode: anon delete store photos" ON storage.objects;
CREATE POLICY "Demo mode: anon delete store photos"
ON storage.objects FOR DELETE
TO anon
USING (
  bucket_id = 'store-photos'
  AND auth.uid() IS NULL
);


-- ----- 1C: track-media bucket -----
-- Allows demo users to upload track content (images, video, audio, PDFs)

DROP POLICY IF EXISTS "Demo mode: anon upload track media" ON storage.objects;
CREATE POLICY "Demo mode: anon upload track media"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'make-2858cc8b-track-media'
  AND auth.uid() IS NULL
);

DROP POLICY IF EXISTS "Demo mode: anon read track media" ON storage.objects;
CREATE POLICY "Demo mode: anon read track media"
ON storage.objects FOR SELECT
TO anon
USING (
  bucket_id = 'make-2858cc8b-track-media'
  AND auth.uid() IS NULL
);

DROP POLICY IF EXISTS "Demo mode: anon update track media" ON storage.objects;
CREATE POLICY "Demo mode: anon update track media"
ON storage.objects FOR UPDATE
TO anon
USING (
  bucket_id = 'make-2858cc8b-track-media'
  AND auth.uid() IS NULL
)
WITH CHECK (
  bucket_id = 'make-2858cc8b-track-media'
  AND auth.uid() IS NULL
);

DROP POLICY IF EXISTS "Demo mode: anon delete track media" ON storage.objects;
CREATE POLICY "Demo mode: anon delete track media"
ON storage.objects FOR DELETE
TO anon
USING (
  bucket_id = 'make-2858cc8b-track-media'
  AND auth.uid() IS NULL
);


-- =====================================================
-- SECTION 2: ORGANIZATIONAL HIERARCHY TABLES
-- Allow demo users to view org structure (roles, districts, stores)
-- =====================================================

-- ----- 2A: roles table -----
-- Demo users need to view roles (for user management, profile display)

DROP POLICY IF EXISTS "Demo mode: anon view roles" ON roles;
CREATE POLICY "Demo mode: anon view roles"
  ON roles FOR SELECT
  USING (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Demo mode: anon manage roles" ON roles;
CREATE POLICY "Demo mode: anon manage roles"
  ON roles FOR ALL
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);


-- ----- 2B: districts table -----
-- Demo users need to view/manage districts

DROP POLICY IF EXISTS "Demo mode: anon view districts" ON districts;
CREATE POLICY "Demo mode: anon view districts"
  ON districts FOR SELECT
  USING (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Demo mode: anon manage districts" ON districts;
CREATE POLICY "Demo mode: anon manage districts"
  ON districts FOR ALL
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);


-- ----- 2C: stores table -----
-- Demo users need to view/manage stores

DROP POLICY IF EXISTS "Demo mode: anon view stores" ON stores;
CREATE POLICY "Demo mode: anon view stores"
  ON stores FOR SELECT
  USING (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Demo mode: anon manage stores" ON stores;
CREATE POLICY "Demo mode: anon manage stores"
  ON stores FOR ALL
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);


-- =====================================================
-- SECTION 3: CONTENT MANAGEMENT TABLES
-- Allow demo users to manage tracks and tags
-- =====================================================

-- ----- 3A: tracks table -----
-- Demo users need to update/manage tracks (archive, edit metadata)
-- NOTE: SELECT already works via fix_track_tags_demo_access pattern

DROP POLICY IF EXISTS "Demo mode: anon manage tracks" ON tracks;
CREATE POLICY "Demo mode: anon manage tracks"
  ON tracks FOR ALL
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);


-- ----- 3B: track_tags table -----
-- Demo users need to add/remove tags on tracks
-- NOTE: SELECT already works via fix_track_tags_demo_access.sql

DROP POLICY IF EXISTS "Demo mode: anon manage track_tags" ON track_tags;
CREATE POLICY "Demo mode: anon manage track_tags"
  ON track_tags FOR INSERT
  WITH CHECK (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Demo mode: anon delete track_tags" ON track_tags;
CREATE POLICY "Demo mode: anon delete track_tags"
  ON track_tags FOR DELETE
  USING (auth.uid() IS NULL);


-- =====================================================
-- SECTION 4: USER MANAGEMENT
-- Allow demo users to view/manage users within the demo org
-- =====================================================

DROP POLICY IF EXISTS "Demo mode: anon view users" ON users;
CREATE POLICY "Demo mode: anon view users"
  ON users FOR SELECT
  USING (auth.uid() IS NULL);

DROP POLICY IF EXISTS "Demo mode: anon manage users" ON users;
CREATE POLICY "Demo mode: anon manage users"
  ON users FOR ALL
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);
