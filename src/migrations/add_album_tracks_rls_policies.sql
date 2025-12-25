-- =====================================================
-- ADD RLS POLICIES FOR ALBUM_TRACKS TABLE
-- =====================================================
-- This adds INSERT, UPDATE, and DELETE policies for album_tracks
-- to allow content creators to manage tracks within albums
-- =====================================================

-- Album Tracks: Allow content creators to manage tracks in albums they can manage
CREATE POLICY "Content creators can insert album tracks"
    ON album_tracks FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM albums 
        WHERE albums.id = album_tracks.album_id 
        AND albums.organization_id = get_user_organization_id()
    ));

CREATE POLICY "Content creators can update album tracks"
    ON album_tracks FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM albums 
        WHERE albums.id = album_tracks.album_id 
        AND albums.organization_id = get_user_organization_id()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM albums 
        WHERE albums.id = album_tracks.album_id 
        AND albums.organization_id = get_user_organization_id()
    ));

CREATE POLICY "Content creators can delete album tracks"
    ON album_tracks FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM albums 
        WHERE albums.id = album_tracks.album_id 
        AND albums.organization_id = get_user_organization_id()
    ));

-- =====================================================
-- DONE!
-- =====================================================
-- Content creators can now:
-- - Add tracks to albums (INSERT)
-- - Reorder tracks in albums (UPDATE display_order)
-- - Remove tracks from albums (DELETE)
-- All operations are scoped to albums in the user's organization
-- =====================================================

