// ============================================================================
// REPORTS CRUD OPERATIONS
// ============================================================================

import { supabase, getCurrentUserOrgId } from '../supabase';

// Individual assignment within an employee record
export interface AssignmentRecord {
  id: string;
  playlist: string;
  album: string;
  track: string;
  progress: number;
  completionDate: string | null;
  score: number;
  timeSpent: number;
  attempts: number;
  status: 'completed' | 'in-progress' | 'not-started' | 'overdue';
  lastActivity: string;
  dateAssigned: string | null;
  dueDate: string | null;
  playlistStatus: 'active' | 'archived'; // Whether the playlist is active or archived
}

// Employee-level record with nested assignments
export interface LearnerRecord {
  id: string;
  employeeName: string;
  employeeId: string;
  district: string;
  store: string;
  role: string;
  // Aggregated values across all assignments
  progress: number; // Average progress
  score: number; // Average score
  timeSpent: number; // Total time
  attempts: number; // Total attempts
  certification: string | null;
  certificationDate: string | null;
  status: 'completed' | 'in-progress' | 'not-started' | 'overdue';
  lastActivity: string;
  // Nested assignments
  assignments: AssignmentRecord[];
  // For backwards compatibility with filters
  album: string;
  playlist: string;
  track: string;
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

// Report type for the grain selector
export type ReportType = 'people' | 'assignments' | 'units';

// Flattened assignment row for Assignments mode (one row per learner x assignment)
export interface FlattenedAssignmentRow {
  id: string;
  employeeName: string;
  employeeId: string;
  district: string;
  store: string;
  role: string;
  playlist: string;
  album: string;
  track: string;
  progress: number;
  score: number;
  status: 'completed' | 'in-progress' | 'not-started' | 'overdue';
  dateAssigned: string | null;
  dueDate: string | null;
  completionDate: string | null;
  playlistStatus: 'active' | 'archived';
}

// Unit rollup row for Units mode (one row per store/location)
export interface UnitReportRow {
  id: string;
  unitName: string;
  district: string;
  employeeCount: number;
  assignmentCount: number;
  avgProgress: number;
  completedCount: number;
  inProgressCount: number;
  overdueCount: number;
  notStartedCount: number;
  compliance: number;
}

/**
 * Fetch all filter options for reports in a single optimized query batch
 */
export async function getReportFilterOptions(): Promise<FilterOptions> {
  try {
    const orgId = await getCurrentUserOrgId();
    console.log('[Reports] getReportFilterOptions - orgId:', orgId);
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

    // Log any errors from queries
    if (albums.error) console.error('[Reports] albums query error:', albums.error);
    if (districts.error) console.error('[Reports] districts query error:', districts.error);
    if (stores.error) console.error('[Reports] stores query error:', stores.error);
    if (roles.error) console.error('[Reports] roles query error:', roles.error);
    if (playlists.error) console.error('[Reports] playlists query error:', playlists.error);
    if (tracks.error) console.error('[Reports] tracks query error:', tracks.error);
    if (certifications.error) console.error('[Reports] certifications query error:', certifications.error);

    const result = {
      albums: (albums.data || []).map(a => ({ id: a.id, name: a.title })),
      districts: (districts.data || []).map(d => ({ id: d.id, name: d.name })),
      stores: (stores.data || []).map(s => ({ id: s.id, name: s.name })),
      roles: (roles.data || []).map(r => ({ id: r.id, name: r.name })),
      playlists: (playlists.data || []).map(p => ({ id: p.id, name: p.title })),
      tracks: (tracks.data || []).map(t => ({ id: t.id, name: t.title })),
      certifications: (certifications.data || []).map(c => ({ id: c.id, name: c.name })),
    };

    console.log('[Reports] Filter options loaded:', {
      albums: result.albums.length,
      districts: result.districts.length,
      stores: result.stores.length,
      roles: result.roles.length,
      playlists: result.playlists.length,
      tracks: result.tracks.length,
      certifications: result.certifications.length,
    });

    return result;
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
        role:roles!users_role_id_fkey(name)
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

    // Get all active assignments (exclude archived) with playlist info including is_active status
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
          title,
          is_active
        )
      `)
      .in('user_id', userIds)
      .neq('status', 'archived');

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

    // Build aggregated stats per user-playlist
    const userPlaylistStats = new Map<string, {
      totalScore: number;
      totalTime: number;
      totalAttempts: number;
      completedCount: number;
      lastActivity: string | null;
      lastCompletionDate: string | null;
    }>();

    // Aggregate completion stats per user-playlist
    (completions || []).forEach(c => {
      const playlistsForTrack = (playlistTracks || []).filter(pt => pt.track_id === c.track_id);
      playlistsForTrack.forEach(pt => {
        const key = `${c.user_id}-${pt.playlist_id}`;
        const existing = userPlaylistStats.get(key) || {
          totalScore: 0,
          totalTime: 0,
          totalAttempts: 0,
          completedCount: 0,
          lastActivity: null,
          lastCompletionDate: null
        };

        existing.totalScore += c.score || 0;
        existing.totalTime += c.time_spent_minutes || 0;
        existing.totalAttempts += c.attempts || 0;

        if (c.status === 'completed' || c.status === 'passed') {
          existing.completedCount += 1;
          if (c.completed_at && (!existing.lastCompletionDate || c.completed_at > existing.lastCompletionDate)) {
            existing.lastCompletionDate = c.completed_at;
          }
        }

        if (c.completed_at && (!existing.lastActivity || c.completed_at > existing.lastActivity)) {
          existing.lastActivity = c.completed_at;
        }

        userPlaylistStats.set(key, existing);
      });
    });

    // Build learner records - one record per employee with nested assignments
    const records: LearnerRecord[] = [];

    users.forEach(user => {
      const userAssignments = (assignments || []).filter(a => a.user_id === user.id);

      // Skip users with no assignments
      if (userAssignments.length === 0) return;

      const userCerts = certificationsByUser.get(user.id) || [];
      const latestCert = userCerts.length > 0
        ? userCerts.sort((a, b) =>
            new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime()
          )[0]
        : null;

      // Build assignment records for this user
      const assignmentRecords: AssignmentRecord[] = [];
      let totalProgress = 0;
      let totalScore = 0;
      let totalTimeSpent = 0;
      let totalAttempts = 0;
      let scoreCount = 0;
      let latestActivity: string | null = null;
      const allAlbums: string[] = [];
      const allPlaylists: string[] = [];
      const allTracks: string[] = [];

      userAssignments.forEach(assignment => {
        // Get album name (if any)
        const album = albumMap.get(assignment.playlist_id) || (assignment.playlist as any)?.title || 'N/A';
        const playlistTitle = (assignment.playlist as any)?.title || 'N/A';

        // Calculate progress for the playlist
        const totalTracksInPlaylist = trackCountByPlaylist.get(assignment.playlist_id) || 0;
        const completedTracksInPlaylist = completedCountByUserPlaylist.get(`${user.id}-${assignment.playlist_id}`) || 0;
        const progress = totalTracksInPlaylist > 0 ? Math.round((completedTracksInPlaylist / totalTracksInPlaylist) * 100) : 0;

        // Get aggregated stats for this assignment
        const stats = userPlaylistStats.get(`${user.id}-${assignment.playlist_id}`);
        const avgScore = stats && stats.completedCount > 0
          ? Math.round(stats.totalScore / stats.completedCount)
          : 0;

        // Determine status based on playlist progress
        let status: 'completed' | 'in-progress' | 'not-started' | 'overdue' = 'not-started';
        if (progress === 100) {
          status = 'completed';
        } else if (progress > 0) {
          status = 'in-progress';
        } else if (assignment.due_date && new Date(assignment.due_date) < new Date()) {
          status = 'overdue';
        }

        // Get track names for display
        const assignmentTracks = (playlistTracks || []).filter(
          pt => pt.playlist_id === assignment.playlist_id
        );
        const trackNames = assignmentTracks
          .map(pt => (pt.track as any)?.title)
          .filter(Boolean);
        const trackDisplay = trackNames.length > 0
          ? (trackNames.length > 3
              ? `${trackNames.slice(0, 3).join(', ')} (+${trackNames.length - 3} more)`
              : trackNames.join(', '))
          : 'N/A';

        const assignmentLastActivity = stats?.lastActivity || assignment.assigned_at || new Date().toISOString();

        // Determine playlist status (active or archived)
        const playlistIsActive = (assignment.playlist as any)?.is_active !== false;

        assignmentRecords.push({
          id: assignment.id,
          playlist: playlistTitle,
          album: album,
          track: trackDisplay,
          progress: progress,
          completionDate: stats?.lastCompletionDate || null,
          score: avgScore,
          timeSpent: stats?.totalTime || 0,
          attempts: stats?.totalAttempts || 0,
          status: status,
          lastActivity: assignmentLastActivity,
          dateAssigned: assignment.assigned_at || null,
          dueDate: assignment.due_date || null,
          playlistStatus: playlistIsActive ? 'active' : 'archived'
        });

        // Aggregate for employee-level stats
        totalProgress += progress;
        if (avgScore > 0) {
          totalScore += avgScore;
          scoreCount++;
        }
        totalTimeSpent += stats?.totalTime || 0;
        totalAttempts += stats?.totalAttempts || 0;

        if (!latestActivity || assignmentLastActivity > latestActivity) {
          latestActivity = assignmentLastActivity;
        }

        // Collect for filter compatibility
        if (album !== 'N/A' && !allAlbums.includes(album)) allAlbums.push(album);
        if (playlistTitle !== 'N/A' && !allPlaylists.includes(playlistTitle)) allPlaylists.push(playlistTitle);
        trackNames.forEach(t => { if (!allTracks.includes(t)) allTracks.push(t); });
      });

      // Calculate employee-level averages
      const avgProgress = assignmentRecords.length > 0
        ? Math.round(totalProgress / assignmentRecords.length)
        : 0;
      const avgEmployeeScore = scoreCount > 0
        ? Math.round(totalScore / scoreCount)
        : 0;

      // Determine overall employee status
      let employeeStatus: 'completed' | 'in-progress' | 'not-started' | 'overdue' = 'not-started';
      const completedCount = assignmentRecords.filter(a => a.status === 'completed').length;
      const inProgressCount = assignmentRecords.filter(a => a.status === 'in-progress').length;
      const overdueCount = assignmentRecords.filter(a => a.status === 'overdue').length;

      if (completedCount === assignmentRecords.length) {
        employeeStatus = 'completed';
      } else if (inProgressCount > 0 || completedCount > 0) {
        employeeStatus = 'in-progress';
      } else if (overdueCount > 0) {
        employeeStatus = 'overdue';
      }

      records.push({
        id: user.id,
        employeeName: `${user.first_name} ${user.last_name}`,
        employeeId: user.employee_id || 'N/A',
        district: (user.store as any)?.district?.name || 'N/A',
        store: (user.store as any)?.name || 'N/A',
        role: (user.role as any)?.name || 'N/A',
        progress: avgProgress,
        score: avgEmployeeScore,
        timeSpent: totalTimeSpent,
        attempts: totalAttempts,
        certification: latestCert ? (latestCert.certification as any)?.name || null : null,
        certificationDate: latestCert?.issued_at || null,
        status: employeeStatus,
        lastActivity: latestActivity || new Date().toISOString(),
        assignments: assignmentRecords,
        // For filter compatibility
        album: allAlbums.join(', ') || 'N/A',
        playlist: allPlaylists.join(', ') || 'N/A',
        track: allTracks.slice(0, 5).join(', ') || 'N/A'
      });
    });

    return records;
  } catch (error) {
    console.error('Error fetching learner records:', error);
    throw error;
  }
}

/**
 * Flatten learner records to assignment-level rows
 * One row per learner x assignment combination (for Assignments mode)
 */
export function flattenToAssignmentRows(
  learnerRecords: LearnerRecord[]
): FlattenedAssignmentRow[] {
  const rows: FlattenedAssignmentRow[] = [];

  learnerRecords.forEach(learner => {
    if (learner.assignments && learner.assignments.length > 0) {
      learner.assignments.forEach(assignment => {
        rows.push({
          id: `${learner.id}-${assignment.id}`,
          employeeName: learner.employeeName,
          employeeId: learner.employeeId,
          district: learner.district,
          store: learner.store,
          role: learner.role,
          playlist: assignment.playlist,
          album: assignment.album,
          track: assignment.track,
          progress: assignment.progress,
          score: assignment.score,
          status: assignment.status,
          dateAssigned: assignment.dateAssigned,
          dueDate: assignment.dueDate,
          completionDate: assignment.completionDate,
          playlistStatus: assignment.playlistStatus,
        });
      });
    }
  });

  return rows;
}

/**
 * Aggregate learner records to unit-level rollups
 * One row per store/unit (for Units mode)
 */
export function aggregateToUnitRows(
  learnerRecords: LearnerRecord[]
): UnitReportRow[] {
  // Group learners by store
  const storeGroups = new Map<string, LearnerRecord[]>();

  learnerRecords.forEach(learner => {
    const key = learner.store;
    if (!storeGroups.has(key)) {
      storeGroups.set(key, []);
    }
    storeGroups.get(key)!.push(learner);
  });

  const unitRows: UnitReportRow[] = [];

  storeGroups.forEach((learners, storeName) => {
    const firstLearner = learners[0];

    // Aggregate all assignments across all learners in this unit
    const allAssignments = learners.flatMap(l => l.assignments || []);

    const completedCount = allAssignments.filter(a => a.status === 'completed').length;
    const inProgressCount = allAssignments.filter(a => a.status === 'in-progress').length;
    const overdueCount = allAssignments.filter(a => a.status === 'overdue').length;
    const notStartedCount = allAssignments.filter(a => a.status === 'not-started').length;

    const totalProgress = allAssignments.reduce((sum, a) => sum + a.progress, 0);
    const avgProgress = allAssignments.length > 0
      ? Math.round(totalProgress / allAssignments.length)
      : 0;

    // Compliance is percentage of completed assignments
    const compliance = allAssignments.length > 0
      ? Math.round((completedCount / allAssignments.length) * 100)
      : 0;

    unitRows.push({
      id: storeName,
      unitName: storeName,
      district: firstLearner.district,
      employeeCount: learners.length,
      assignmentCount: allAssignments.length,
      avgProgress,
      completedCount,
      inProgressCount,
      overdueCount,
      notStartedCount,
      compliance,
    });
  });

  // Sort by unit name
  unitRows.sort((a, b) => a.unitName.localeCompare(b.unitName));

  return unitRows;
}
