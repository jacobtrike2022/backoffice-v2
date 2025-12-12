// ============================================================================
// KNOWLEDGE BASE CRUD OPERATIONS
// Knowledge Base = Organizational layer on top of existing tracks
// Tracks can live in playlists (assigned) AND/OR KB categories (reference)
// ============================================================================

import { supabase, getCurrentUserOrgId, getCurrentUserProfile } from '../supabase';
import { projectId, publicAnonKey, getServerUrl } from '../../utils/supabase/info';

export interface AddTrackToKBInput {
  track_id: string;
  kb_category_id: string;
  display_type?: 'required' | 'optional' | 'manager-only';
  pinned?: boolean;
  display_order?: number;
}

/**
 * Add existing track to KB category
 */
export async function addTrackToKB(input: AddTrackToKBInput) {
  const orgId = await getCurrentUserOrgId();
  const userProfile = await getCurrentUserProfile();
  
  if (!orgId || !userProfile) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('kb_track_assignments')
    .insert({
      organization_id: orgId,
      track_id: input.track_id,
      kb_category_id: input.kb_category_id,
      display_type: input.display_type || 'optional',
      pinned: input.pinned || false,
      display_order: input.display_order || 0,
      added_by: userProfile.id
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Remove track from KB category
 */
export async function removeTrackFromKB(trackId: string, categoryId: string) {
  const { error } = await supabase
    .from('kb_track_assignments')
    .delete()
    .eq('track_id', trackId)
    .eq('kb_category_id', categoryId);

  if (error) throw error;
}

/**
 * Update KB track assignment settings
 */
export async function updateKBTrackAssignment(
  trackId: string,
  categoryId: string,
  updates: {
    display_type?: 'required' | 'optional' | 'manager-only';
    pinned?: boolean;
    display_order?: number;
  }
) {
  const { data, error } = await supabase
    .from('kb_track_assignments')
    .update(updates)
    .eq('track_id', trackId)
    .eq('kb_category_id', categoryId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get tracks in a KB category
 */
export async function getKBCategoryTracks(categoryId: string, filters: {
  display_type?: string;
  search?: string;
  track_type?: string; // 'article', 'video', 'story'
} = {}) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  let query = supabase
    .from('kb_track_assignments')
    .select(`
      *,
      track:tracks!inner(
        *,
        created_by_user:users!tracks_created_by_fkey(first_name, last_name, email),
        track_tags(tags(name, color))
      )
    `)
    .eq('organization_id', orgId)
    .eq('kb_category_id', categoryId);

  if (filters.display_type) {
    query = query.eq('display_type', filters.display_type);
  }

  // Filter by track type (article, video, story)
  if (filters.track_type) {
    query = query.eq('track.track_type', filters.track_type);
  }

  // Filter by published tracks only
  query = query.eq('track.status', 'published');

  const { data, error } = await query.order('pinned', { ascending: false })
                                     .order('display_order', { ascending: true });

  if (error) throw error;

  // Client-side search filter if needed
  let results = data || [];
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    results = results.filter((item: any) => 
      item.track?.title?.toLowerCase().includes(searchLower) ||
      item.track?.description?.toLowerCase().includes(searchLower)
    );
  }

  return results;
}

/**
 * Get all KB categories with track counts
 */
export async function getKBCategoriesWithCounts() {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const { data: categories, error: categoriesError } = await supabase
    .from('kb_categories')
    .select('*')
    .eq('organization_id', orgId)
    .order('display_order', { ascending: true });

  if (categoriesError) throw categoriesError;

  // Get track counts for each category
  const categoriesWithCounts = await Promise.all(
    categories.map(async (category) => {
      const { count } = await supabase
        .from('kb_track_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('kb_category_id', category.id);

      return {
        ...category,
        trackCount: count || 0
      };
    })
  );

  return categoriesWithCounts;
}

/**
 * Get KB categories
 */
export async function getKBCategories() {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('kb_categories')
    .select('*')
    .eq('organization_id', orgId)
    .order('display_order', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Create KB category
 */
export async function createKBCategory(input: {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  parent_category_id?: string;
  display_order?: number;
}) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('kb_categories')
    .insert({
      organization_id: orgId,
      ...input
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update KB category
 */
export async function updateKBCategory(
  categoryId: string,
  updates: {
    name?: string;
    description?: string;
    icon?: string;
    color?: string;
    display_order?: number;
  }
) {
  const { data, error } = await supabase
    .from('kb_categories')
    .update(updates)
    .eq('id', categoryId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete KB category
 */
export async function deleteKBCategory(categoryId: string) {
  const { error } = await supabase
    .from('kb_categories')
    .delete()
    .eq('id', categoryId);

  if (error) throw error;
}

/**
 * Get KB categories a track belongs to
 */
export async function getTrackKBCategories(trackId: string) {
  const { data, error } = await supabase
    .from('kb_track_assignments')
    .select(`
      *,
      category:kb_categories(*)
    `)
    .eq('track_id', trackId);

  if (error) throw error;
  return data;
}

/**
 * Bookmark a track in KB
 */
export async function bookmarkKBTrack(trackId: string) {
  const userProfile = await getCurrentUserProfile();
  if (!userProfile) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('kb_track_bookmarks')
    .insert({
      user_id: userProfile.id,
      track_id: trackId
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Remove bookmark from track
 */
export async function removeKBTrackBookmark(trackId: string) {
  const userProfile = await getCurrentUserProfile();
  if (!userProfile) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('kb_track_bookmarks')
    .delete()
    .eq('user_id', userProfile.id)
    .eq('track_id', trackId);

  if (error) throw error;
}

/**
 * Get user's bookmarked tracks
 */
export async function getUserKBBookmarks() {
  const userProfile = await getCurrentUserProfile();
  if (!userProfile) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('kb_track_bookmarks')
    .select(`
      *,
      track:tracks(*)
    `)
    .eq('user_id', userProfile.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Check if track is bookmarked
 */
export async function isTrackBookmarked(trackId: string): Promise<boolean> {
  const userProfile = await getCurrentUserProfile();
  if (!userProfile) return false;

  const { data } = await supabase
    .from('kb_track_bookmarks')
    .select('id')
    .eq('user_id', userProfile.id)
    .eq('track_id', trackId)
    .single();

  return !!data;
}

/**
 * Record KB track view
 */
export async function recordKBTrackView(trackId: string, categoryId?: string) {
  const userProfile = await getCurrentUserProfile();
  if (!userProfile) return;

  await supabase
    .from('kb_track_views')
    .insert({
      user_id: userProfile.id,
      track_id: trackId,
      kb_category_id: categoryId
    });
}

/**
 * Get popular tracks in KB (most viewed)
 */
export async function getPopularKBTracks(limit: number = 10) {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('kb_track_views')
    .select(`
      track_id,
      track:tracks!inner(
        *,
        created_by_user:users!tracks_created_by_fkey(first_name, last_name)
      )
    `)
    .eq('track.organization_id', orgId)
    .limit(limit);

  if (error) throw error;

  // Group by track and count views
  const trackViewCounts = new Map();
  data?.forEach((view: any) => {
    const count = trackViewCounts.get(view.track_id) || 0;
    trackViewCounts.set(view.track_id, count + 1);
  });

  // Get unique tracks with view counts
  const uniqueTracks = Array.from(new Map(data?.map((v: any) => [v.track_id, v.track])).values());
  const tracksWithCounts = uniqueTracks.map((track: any) => ({
    ...track,
    viewCount: trackViewCounts.get(track.id) || 0
  }));

  // Sort by view count
  return tracksWithCounts.sort((a: any, b: any) => b.viewCount - a.viewCount).slice(0, limit);
}

/**
 * Search all tracks available for KB (published tracks not yet in category)
 */
export async function searchAvailableTracksForKB(categoryId: string, search: string = '') {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  // Get all published tracks
  let query = supabase
    .from('tracks')
    .select(`
      *,
      created_by_user:users!tracks_created_by_fkey(first_name, last_name, email),
      track_tags(tags(name, color))
    `)
    .eq('organization_id', orgId)
    .eq('status', 'published');

  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const { data: allTracks, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;

  // Get tracks already in this category
  const { data: assignedTracks } = await supabase
    .from('kb_track_assignments')
    .select('track_id')
    .eq('kb_category_id', categoryId);

  const assignedTrackIds = new Set(assignedTracks?.map((a: any) => a.track_id) || []);

  // Filter out already assigned tracks
  return allTracks?.filter((track: any) => !assignedTrackIds.has(track.id)) || [];
}

/**
 * Toggle like on a track (increment/decrement)
 * Uses KV store to persist likes count
 */
export async function toggleTrackLike(trackId: string) {
  const response = await fetch(`${getServerUrl()}/kb/like`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${publicAnonKey}`
    },
    body: JSON.stringify({ trackId })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to like track');
  }
  
  const data = await response.json();
  return data.likes;
}

/**
 * Record detailed feedback (Helpful / Not Helpful)
 */
export async function recordKBFeedback(trackId: string, helpful: boolean) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || publicAnonKey;

  const response = await fetch(`${getServerUrl()}/kb/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ trackId, helpful })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to record feedback');
  }
  
  return await response.json();
}

/**
 * Get user's feedback for a track
 */
export async function getUserKBFeedback(trackId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || publicAnonKey;

  const response = await fetch(`${getServerUrl()}/kb/feedback/${trackId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    return null;
  }
  
  return await response.json();
}