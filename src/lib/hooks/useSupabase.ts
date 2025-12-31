// ============================================================================
// CUSTOM REACT HOOKS FOR SUPABASE DATA FETCHING
// ============================================================================

import { useState, useEffect } from 'react';
import { supabase, getCurrentUserProfile } from '../supabase';
import * as crud from '../crud';

// Debug: Check if function is imported correctly
console.log('🔍 Hook module loaded. getCurrentUserProfile is:', typeof getCurrentUserProfile);

/**
 * Hook to get current user profile
 */
export function useCurrentUser() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        console.log('👤 useCurrentUser: Fetching user profile...');
        console.log('👤 getCurrentUserProfile type:', typeof getCurrentUserProfile);
        const profile = await getCurrentUserProfile();
        console.log('👤 useCurrentUser: Profile fetched:', profile);
        setUser(profile);
      } catch (err) {
        console.error('👤 useCurrentUser: Error fetching user:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchUser();
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading, error };
}

/**
 * Hook to get tracks with filters
 */
export function useTracks(filters?: Parameters<typeof crud.getTracks>[0]) {
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  useEffect(() => {
    async function fetchTracks() {
      try {
        setLoading(true);
        console.log('🔄 useTracks: Fetching tracks with filters:', filters);
        const data = await crud.getTracks(filters);
        console.log('✅ useTracks: Fetched', data.length, 'tracks');
        setTracks(data);
        setError(null);
      } catch (err) {
        console.error('❌ useTracks: Error fetching tracks:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchTracks();
  }, [JSON.stringify(filters), refetchTrigger]);

  const refetch = async () => {
    console.log('🔄 useTracks: Refetch triggered');
    setRefetchTrigger(prev => prev + 1);
  };

  return { tracks, loading, error, refetch };
}

/**
 * Hook to get forms with filters
 */
export function useForms(filters?: Parameters<typeof crud.getForms>[0]) {
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchForms() {
      try {
        setLoading(true);
        const data = await crud.getForms(filters);
        setForms(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchForms();
  }, [JSON.stringify(filters)]);

  return { forms, loading, error, refetch: () => setLoading(true) };
}

/**
 * Hook to get active playlists with enriched data for Dashboard
 */
export function useAssignments(filters?: Parameters<typeof crud.getAssignments>[0]) {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchActivePlaylists() {
      try {
        setLoading(true);
        
        // Fetch active playlists with enriched data (same as Playlists component)
        const playlists = await crud.getPlaylists({ is_active: true });
        
        console.log('[useAssignments] Raw playlists data:', playlists);
        console.log('[useAssignments] Total playlists:', playlists.length);
        
        // Filter to only playlists with assignments and calculate durations
        const playlistsWithDurations = await Promise.all(
          playlists
            .filter((playlist: any) => playlist.assignment_count > 0) // Only playlists with learners
            .slice(0, 5) // Limit to 5 most recent
            .map(async (playlist: any) => {
              let totalDuration = 0;
              
              // Calculate total duration from tracks (same as Playlists component)
              if (playlist.track_ids && playlist.track_ids.length > 0) {
                try {
                  const tracks = await crud.getTracks({ ids: playlist.track_ids });
                  totalDuration = tracks.reduce((sum: number, track: any) => sum + (track.duration_minutes || 0), 0);
                } catch (error) {
                  console.error(`Error calculating duration for playlist ${playlist.id}:`, error);
                }
              }
              
              return {
                id: playlist.id,
                title: playlist.title,
                totalTracks: playlist.track_count || 0,
                totalDuration, // in minutes
                assignedTo: playlist.assignment_count || 0, // # of learners
                completion: playlist.completion_rate || 0, // % completion
                type: playlist.type,
                description: playlist.description
              };
            })
        );

        console.log('[useAssignments] Transformed playlists for dashboard:', playlistsWithDurations);
        setAssignments(playlistsWithDurations);
      } catch (err) {
        console.error('[useAssignments] Error fetching playlists:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchActivePlaylists();
  }, [JSON.stringify(filters)]);

  return { assignments, loading, error, refetch: () => setLoading(true) };
}

/**
 * Hook to get users with filters
 */
export function useUsers(filters?: Parameters<typeof crud.getUsers>[0]) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchUsers() {
      try {
        setLoading(true);
        const data = await crud.getUsers(filters);
        setUsers(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, [JSON.stringify(filters)]);

  return { users, loading, error, refetch: () => setLoading(true) };
}

/**
 * Hook to get unread notifications for current user
 */
export function useNotifications() {
  const { user } = useCurrentUser();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    async function fetchNotifications() {
      try {
        const data = await crud.getUnreadNotifications(user.id);
        setNotifications(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchNotifications();

    // Set up realtime subscription for notifications
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const markAsRead = async (notificationId: string) => {
    await crud.markNotificationAsRead(notificationId);
    setNotifications(notifications.filter(n => n.id !== notificationId));
  };

  const markAllAsRead = async () => {
    if (user?.id) {
      await crud.markAllNotificationsAsRead(user.id);
      setNotifications([]);
    }
  };

  return { 
    notifications, 
    loading, 
    error, 
    unreadCount: notifications.length,
    markAsRead,
    markAllAsRead
  };
}

/**
 * Hook to get stores with enriched data
 */
export function useStores(filters?: Parameters<typeof crud.getStores>[0]) {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchStores() {
      try {
        setLoading(true);
        const data = await crud.getStores(filters);
        setStores(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchStores();
  }, [JSON.stringify(filters)]);

  return { stores, loading, error, refetch: () => {
    setLoading(true);
    crud.getStores(filters).then(data => {
      setStores(data);
      setLoading(false);
    }).catch(err => {
      setError(err as Error);
      setLoading(false);
    });
  }};
}

/**
 * Hook for real-time data subscription
 */
export function useRealtimeSubscription(
  table: string,
  callback: () => void,
  filter?: string
) {
  useEffect(() => {
    const config: any = {
      event: '*',
      schema: 'public',
      table
    };

    if (filter) {
      config.filter = filter;
    }

    const channel = supabase
      .channel(`${table}-changes`)
      .on('postgres_changes', config, callback)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, callback]);
}

/**
 * Hook to get KB category tracks (tracks assigned to KB category)
 */
export function useKBCategoryTracks(categoryId: string | null, filters?: Parameters<typeof crud.getKBCategoryTracks>[1]) {
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  useEffect(() => {
    async function fetchTracks() {
      if (!categoryId) {
        setTracks([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log('🔄 useKBCategoryTracks: Fetching tracks for category:', categoryId);
        const data = await crud.getKBCategoryTracks(categoryId, filters);
        console.log('✅ useKBCategoryTracks: Fetched', data.length, 'tracks');
        setTracks(data);
        setError(null);
      } catch (err) {
        console.error('❌ useKBCategoryTracks: Error fetching tracks:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchTracks();
  }, [categoryId, JSON.stringify(filters), refetchTrigger]);

  const refetch = async () => {
    console.log('🔄 useKBCategoryTracks: Refetch triggered');
    setRefetchTrigger(prev => prev + 1);
  };

  return { tracks, loading, error, refetch };
}

/**
 * Hook to get KB categories with track counts
 */
export function useKBCategories() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  useEffect(() => {
    async function fetchCategories() {
      try {
        setLoading(true);
        console.log('🔄 useKBCategories: Fetching categories with track counts');
        const data = await crud.getKBCategoriesWithCounts();
        console.log('✅ useKBCategories: Fetched', data.length, 'categories');
        setCategories(data);
        setError(null);
      } catch (err) {
        console.error('❌ useKBCategories: Error fetching categories:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchCategories();
  }, [refetchTrigger]);

  const refetch = async () => {
    console.log('🔄 useKBCategories: Refetch triggered');
    setRefetchTrigger(prev => prev + 1);
  };

  return { categories, loading, error, refetch };
}

/**
 * Hook to get roles for an organization
 */
export function useRoles(organizationId?: string) {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchRoles() {
      try {
        setLoading(true);
        const data = await crud.getRoles(organizationId);
        setRoles(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching roles:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchRoles();
  }, [organizationId]);

  return { roles, loading, error, refetch: () => setLoading(true) };
}

/**
 * Hook to get districts for an organization
 */
export function useDistricts(organizationId?: string) {
  const [districts, setDistricts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  useEffect(() => {
    async function fetchDistricts() {
      try {
        setLoading(true);
        const data = await crud.getDistricts(organizationId);
        setDistricts(data);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchDistricts();
  }, [organizationId, refetchTrigger]);

  const refetch = () => {
    setRefetchTrigger(prev => prev + 1);
  };

  return { districts, loading, error, refetch };
}

/**
 * Hook to get counts of pending AI tag suggestions for tracks
 */
export function useAITagSuggestionsCount(trackIds: string[]) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!trackIds || trackIds.length === 0) {
      setLoading(false);
      return;
    }

    async function fetchCounts() {
      try {
        const { data, error } = await supabase
          .from('ai_tag_suggestions')
          .select('track_id')
          .in('track_id', trackIds)
          .eq('status', 'pending');

        if (error) throw error;

        const newCounts: Record<string, number> = {};
        data?.forEach((row: any) => {
          newCounts[row.track_id] = (newCounts[row.track_id] || 0) + 1;
        });
        setCounts(newCounts);
      } catch (err) {
        console.error('Error fetching AI tag suggestion counts:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchCounts();
  }, [JSON.stringify(trackIds)]);

  return { counts, loading };
}
