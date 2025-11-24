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
 * Hook to get assignments with filters
 */
export function useAssignments(filters?: Parameters<typeof crud.getAssignments>[0]) {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchAssignments() {
      try {
        setLoading(true);
        const data = await crud.getAssignments(filters);
        
        // Transform assignments data for Dashboard display
        const transformedAssignments = data.map((assignment: any) => {
          const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
          const today = new Date();
          const daysLeft = dueDate ? Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 0;
          
          return {
            id: assignment.id,
            title: assignment.playlist?.title || 'Unnamed Assignment',
            playlistId: assignment.playlist_id,
            status: assignment.status,
            assignedTo: 1, // This would need to be calculated based on assignment_type
            dueDate: dueDate ? dueDate.toLocaleDateString() : 'No due date',
            daysLeft,
            completion: assignment.progress_percent || 0
          };
        });
        
        setAssignments(transformedAssignments);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchAssignments();
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