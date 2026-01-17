// ============================================================================
// REPORTS CRUD OPERATIONS
// ============================================================================

import { supabase, getCurrentUserOrgId } from '../supabase';

export interface LearnerRecord {
  id: string;
  employeeName: string;
  employeeId: string;
  district: string;
  store: string;
  role: string;
  department: string;
  album: string;
  playlist: string;
  track: string;
  progress: number;
  completionDate: string | null;
  score: number;
  timeSpent: number;
  attempts: number;
  certification: string | null;
  certificationDate: string | null;
  status: 'completed' | 'in-progress' | 'not-started' | 'overdue';
  lastActivity: string;
}

export interface FilterOptions {
  albums: { id: string; name: string }[];
  districts: { id: string; name: string }[];
  stores: { id: string; name: string }[];
  roles: { id: string; name: string }[];
  playlists: { id: string; name: string }[];
  tracks: { id: string; name: string }[];
  certifications: { id: string; name: string }[];
}

/**
 * Fetch all filter options for reports in a single optimized query batch
 */
export async function getReportFilterOptions(): Promise<FilterOptions> {
  try {
    const orgId = await getCurrentUserOrgId();
    if (!orgId) throw new Error('User not authenticated');

    // Run all queries in parallel for efficiency
    const [albums, districts, stores, roles, playlists, tracks, certifications] = await Promise.all([
      supabase
        .from('albums')
        .select('id, title')
        .eq('organization_id', orgId)
        .order('title'),
      supabase
        .from('districts')
        .select('id, name')
        .eq('organization_id', orgId)
        .order('name'),
      supabase
        .from('stores')
        .select('id, name')
        .eq('organization_id', orgId)
        .order('name'),
      supabase
        .from('roles')
        .select('id, name')
        .eq('organization_id', orgId)
        .order('name'),
      supabase
        .from('playlists')
        .select('id, title')
        .eq('organization_id', orgId)
        .order('title'),
      supabase
        .from('tracks')
        .select('id, title')
        .eq('organization_id', orgId)
        .order('title'),
      supabase
        .from('certifications')
        .select('id, name')
        .eq('organization_id', orgId)
        .order('name'),
    ]);

    return {
      albums: (albums.data || []).map(a => ({ id: a.id, name: a.title })),
      districts: (districts.data || []).map(d => ({ id: d.id, name: d.name })),
      stores: (stores.data || []).map(s => ({ id: s.id, name: s.name })),
      roles: (roles.data || []).map(r => ({ id: r.id, name: r.name })),
      playlists: (playlists.data || []).map(p => ({ id: p.id, name: p.title })),
      tracks: (tracks.data || []).map(t => ({ id: t.id, name: t.title })),
      certifications: (certifications.data || []).map(c => ({ id: c.id, name: c.name })),
    };
  } catch (error) {
    console.error('Error fetching filter options:', error);
    throw error;
  }
}

/**
 * Get learner records for reports
 * Returns detailed records of user assignments, progress, and completions
 */
export async function getLearnerRecords(storeFilter?: string): Promise<LearnerRecord[]> {
  try {
    const orgId = await getCurrentUserOrgId();
    if (!orgId) throw new Error('User not authenticated');

    // Get all users with their store and role info
    let userQuery = supabase
      .from('users')
      .select(`
        id,
        first_name,
        last_name,
        employee_id,
        status,
        store:stores!store_id(
          id,
          name,
          code,
          district:districts(name)
        ),
        role:roles(name)
      `)
      .eq('organization_id', orgId)
      .eq('status', 'active');

    // Apply store filter if provided
    if (storeFilter) {
      // Find store ID by name
      const { data: stores } = await supabase
        .from('stores')
        .select('id')
        .eq('name', storeFilter)
        .eq('organization_id', orgId)
        .limit(1);
      
      if (stores && stores.length > 0) {
        userQuery = userQuery.eq('store_id', stores[0].id);
      } else {
        // Store not found, return empty array
        return [];
      }
    }

    const { data: users, error: usersError } = await userQuery;

    if (usersError) throw usersError;
    if (!users || users.length === 0) return [];

    const userIds = users.map(u => u.id);

    // Get all assignments with playlist info
    const { data: assignments, error: assignmentsError } = await supabase
      .from('assignments')
      .select(`
        id,
        user_id,
        playlist_id,
        assigned_at,
        due_date,
        status,
        playlist:playlists(
          id,
          title
        )
      `)
      .in('user_id', userIds);

    if (assignmentsError) throw assignmentsError;

    // Get all playlist tracks
    const playlistIds = [...new Set((assignments || []).map(a => a.playlist_id).filter(Boolean))];
    
    // Get albums for playlists separately
    const { data: playlistAlbums, error: albumsError } = await supabase
      .from('playlist_albums')
      .select(`
        playlist_id,
        album:albums(title)
      `)
      .in('playlist_id', playlistIds.length > 0 ? playlistIds : ['00000000-0000-0000-0000-000000000000']);

    if (albumsError) throw albumsError;
    
    // Build album map: playlist_id -> album title
    const albumMap = new Map<string, string>();
    (playlistAlbums || []).forEach((pa: any) => {
      if (pa.album && pa.album.title) {
        albumMap.set(pa.playlist_id, pa.album.title);
      }
    });
    const { data: playlistTracks, error: tracksError } = await supabase
      .from('playlist_tracks')
      .select(`
        track_id,
        playlist_id,
        track:tracks(
          id,
          title
        )
      `)
      .in('playlist_id', playlistIds.length > 0 ? playlistIds : ['00000000-0000-0000-0000-000000000000']);

    if (tracksError) throw tracksError;

    // Get all track completions
    const trackIds = [...new Set((playlistTracks || []).map(pt => pt.track_id).filter(Boolean))];
    const { data: completions, error: completionsError } = await supabase
      .from('track_completions')
      .select('track_id, user_id, status, completed_at, score, attempts, time_spent_minutes')
      .in('user_id', userIds)
      .in('track_id', trackIds.length > 0 ? trackIds : ['00000000-0000-0000-0000-000000000000']);

    if (completionsError) throw completionsError;

    // Get all certifications
    const { data: certifications, error: certsError } = await supabase
      .from('user_certifications')
      .select(`
        user_id,
        issued_at,
        certification:certifications(name)
      `)
      .in('user_id', userIds)
      .eq('status', 'active');

    if (certsError) throw certsError;

    // Build lookup maps
    const completionsByUserTrack = new Map<string, any>();
    (completions || []).forEach(c => {
      const key = `${c.user_id}-${c.track_id}`;
      completionsByUserTrack.set(key, c);
    });

    const certificationsByUser = new Map<string, any[]>();
    (certifications || []).forEach(cert => {
      if (!certificationsByUser.has(cert.user_id)) {
        certificationsByUser.set(cert.user_id, []);
      }
      certificationsByUser.get(cert.user_id)!.push(cert);
    });

    // Build progress calculation maps
    // Map of playlist_id -> total track count
    const trackCountByPlaylist = new Map<string, number>();
    (playlistTracks || []).forEach(pt => {
      const count = trackCountByPlaylist.get(pt.playlist_id) || 0;
      trackCountByPlaylist.set(pt.playlist_id, count + 1);
    });

    // Map of user_id-playlist_id -> completed track count
    const completedCountByUserPlaylist = new Map<string, number>();
    (completions || []).forEach(c => {
      if (c.status === 'completed' || c.status === 'passed') {
        // Find which playlist(s) this track belongs to
        const playlistsForTrack = (playlistTracks || []).filter(pt => pt.track_id === c.track_id);
        playlistsForTrack.forEach(pt => {
          const key = `${c.user_id}-${pt.playlist_id}`;
          const count = completedCountByUserPlaylist.get(key) || 0;
          completedCountByUserPlaylist.set(key, count + 1);
        });
      }
    });

    // Build learner records - one record per user-track assignment
    const records: LearnerRecord[] = [];

    users.forEach(user => {
      const userAssignments = (assignments || []).filter(a => a.user_id === user.id);
      
      userAssignments.forEach(assignment => {
        const assignmentTracks = (playlistTracks || []).filter(
          pt => pt.playlist_id === assignment.playlist_id
        );

        assignmentTracks.forEach(pt => {
          const completion = completionsByUserTrack.get(`${user.id}-${pt.track_id}`);
          const userCerts = certificationsByUser.get(user.id) || [];
          const latestCert = userCerts.length > 0 
            ? userCerts.sort((a, b) => 
                new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime()
              )[0]
            : null;

          // Determine status
          let status: 'completed' | 'in-progress' | 'not-started' | 'overdue' = 'not-started';
          if (completion && (completion.status === 'completed' || completion.status === 'passed')) {
            status = 'completed';
          } else if (completion) {
            status = 'in-progress';
          } else if (assignment.due_date && new Date(assignment.due_date) < new Date()) {
            status = 'overdue';
          }

          // Get album name (if any)
          const album = albumMap.get(assignment.playlist_id) || 'N/A';

          // Calculate actual progress for the playlist
          const totalTracks = trackCountByPlaylist.get(assignment.playlist_id) || 0;
          const completedTracks = completedCountByUserPlaylist.get(`${user.id}-${assignment.playlist_id}`) || 0;
          const progress = totalTracks > 0 ? Math.round((completedTracks / totalTracks) * 100) : 0;

          records.push({
            id: `${user.id}-${assignment.id}-${pt.track_id}`,
            employeeName: `${user.first_name} ${user.last_name}`,
            employeeId: user.employee_id || 'N/A',
            district: (user.store as any)?.district?.name || 'N/A',
            store: (user.store as any)?.name || 'N/A',
            role: (user.role as any)?.name || 'N/A',
            department: 'N/A', // Not in current schema
            album: album,
            playlist: (assignment.playlist as any)?.title || 'N/A',
            track: (pt.track as any)?.title || 'N/A',
            progress: progress,
            completionDate: completion?.completed_at || null,
            score: completion?.score || 0,
            timeSpent: completion?.time_spent_minutes || 0,
            attempts: completion?.attempts || 0,
            certification: latestCert ? (latestCert.certification as any)?.name || null : null,
            certificationDate: latestCert?.issued_at || null,
            status: status,
            lastActivity: completion?.completed_at || assignment.assigned_at || new Date().toISOString()
          });
        });
      });
    });

    return records;
  } catch (error) {
    console.error('Error fetching learner records:', error);
    throw error;
  }
}
