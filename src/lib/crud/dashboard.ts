// ============================================================================
// DASHBOARD CRUD OPERATIONS
// ============================================================================

import { supabase } from '../supabase';
import { getStorePerformanceData } from './stores';

/**
 * Get organization dashboard statistics
 */
export async function getOrganizationStats(organizationId: string) {
  if (!organizationId || typeof organizationId !== 'string') {
    throw new Error('Invalid organizationId: must be a non-empty string');
  }

  try {
    // Get total active employees
    const { count: employeeCount } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'active');

    // Get total stores
    const { count: storeCount } = await supabase
      .from('stores')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId);

    // Optimize: Fetch user IDs only once, then use in subsequent queries
    // This is more efficient than fetching user IDs separately for each query
    const { data: orgUsers } = await supabase
      .from('users')
      .select('id')
      .eq('organization_id', organizationId);

    const userIds = orgUsers?.map(u => u.id) || [];
    
    // Early return if no users (avoids unnecessary queries)
    if (userIds.length === 0) {
      return {
        employeeCount: employeeCount || 0,
        storeCount: storeCount || 0,
        activeAssignments: activeAssignments || 0,
        completedTracks: 0,
        avgCompletion: 0,
        certificationCount: 0,
        atRiskStores: 0
      };
    }

    // Calculate WEIGHTED average completion using track_completions (source of truth)
    // Company completion = Total completed tracks / Total assigned tracks
    
    // Get all assignments to know which tracks are assigned
    const { data: assignments } = await supabase
      .from('assignments')
      .select('playlist_id')
      .in('user_id', userIds);

    // Get all unique tracks from assignments
    const playlistIds = [...new Set(assignments?.map(a => a.playlist_id).filter(Boolean) || [])];
    let totalTracks = 0;
    if (playlistIds.length > 0) {
      const { count: trackCount } = await supabase
        .from('playlist_tracks')
        .select('id', { count: 'exact', head: true })
        .in('playlist_id', playlistIds);
      totalTracks = trackCount || 0;
    }

    // Get completed tracks from track_completions (filter by status='completed' or 'passed')
    const { count: completedTracks } = await supabase
      .from('track_completions')
      .select('id', { count: 'exact', head: true })
      .in('user_id', userIds)
      .in('status', ['completed', 'passed']);

    // Calculate weighted average completion
    const avgCompletion = totalTracks > 0
      ? Math.round(((completedTracks || 0) / totalTracks) * 100)
      : 0;

    // Get active assignments count
    const { count: activeAssignments } = await supabase
      .from('assignments')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'active');

    // Get certifications issued
    const { count: certificationCount } = await supabase
      .from('user_certifications')
      .select('id', { count: 'exact', head: true })
      .in('user_id', userIds)
      .eq('status', 'active');

    // Get stores with low performance - count stores with 'at-risk' status
    const storePerformance = await getStorePerformanceData(organizationId);
    const atRiskStores = storePerformance.filter(store => store.status === 'at-risk').length;

    return {
      employeeCount: employeeCount || 0,
      storeCount: storeCount || 0,
      activeAssignments: activeAssignments || 0,
      completedTracks: completedTracks || 0,
      avgCompletion,
      certificationCount: certificationCount || 0,
      atRiskStores
    };
  } catch (error) {
    console.error('Error fetching organization stats:', error);
    return {
      employeeCount: 0,
      storeCount: 0,
      activeAssignments: 0,
      completedTracks: 0,
      avgCompletion: 0,
      certificationCount: 0,
      atRiskStores: 0
    };
  }
}

/**
 * Get previous period stats for trend calculation
 */
export async function getOrganizationStatsTrends(organizationId: string, daysAgo: number = 30) {
  if (!organizationId || typeof organizationId !== 'string') {
    throw new Error('Invalid organizationId: must be a non-empty string');
  }
  if (typeof daysAgo !== 'number' || daysAgo < 0) {
    throw new Error('Invalid daysAgo: must be a non-negative number');
  }

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
    const cutoffStr = cutoffDate.toISOString();

    // Get new employees in the last period
    const { count: newEmployees } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .gte('created_at', cutoffStr);

    // Get user IDs for this organization (optimized: fetch once)
    const { data: orgUsers } = await supabase
      .from('users')
      .select('id')
      .eq('organization_id', organizationId);

    const userIds = orgUsers?.map(u => u.id) || [];

    // Get completed tracks in the last period
    const { count: recentCompletions } = await supabase
      .from('user_progress')
      .select('id', { count: 'exact', head: true })
      .in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('status', 'completed')
      .gte('completed_at', cutoffStr);

    return {
      newEmployees: newEmployees || 0,
      recentCompletions: recentCompletions || 0
    };
  } catch (error) {
    console.error('Error fetching organization trends:', error);
    return {
      newEmployees: 0,
      recentCompletions: 0
    };
  }
}

/**
 * Get top performing playlists (units) ranked by average completion rate
 */
export async function getTopPerformingUnits(organizationId: string, limit: number = 3) {
  if (!organizationId || typeof organizationId !== 'string') {
    throw new Error('Invalid organizationId: must be a non-empty string');
  }
  if (typeof limit !== 'number' || limit < 1) {
    throw new Error('Invalid limit: must be a positive number');
  }

  try {
    // Get all active assignments with their progress and playlist info
    const { data: assignments, error: assignmentsError } = await supabase
      .from('assignments')
      .select(`
        id,
        playlist_id,
        progress_percent,
        status,
        playlists!inner (
          id,
          title
        )
      `)
      .eq('organization_id', organizationId)
      .in('status', ['assigned', 'in_progress', 'completed'])
      .not('playlist_id', 'is', null);

    if (assignmentsError) {
      console.error('Error fetching assignments:', assignmentsError);
      return [];
    }

    if (!assignments || assignments.length === 0) {
      return [];
    }

    // Group by playlist and calculate average completion
    const playlistStats = new Map<string, { name: string; progressValues: number[] }>();

    assignments.forEach((assignment: any) => {
      if (assignment.playlist_id && assignment.playlists) {
        const playlistId = assignment.playlist_id;
        const playlistName = assignment.playlists.title;

        if (!playlistStats.has(playlistId)) {
          playlistStats.set(playlistId, { name: playlistName, progressValues: [] });
        }

        playlistStats.get(playlistId)!.progressValues.push(assignment.progress_percent || 0);
      }
    });

    // Calculate averages and create ranked list
    return Array.from(playlistStats.entries())
      .map(([playlistId, stats]) => {
        const avgProgress = stats.progressValues.reduce((sum, val) => sum + val, 0) / stats.progressValues.length;
        return {
          id: playlistId,
          name: stats.name,
          score: Math.round(avgProgress),
          assignmentCount: stats.progressValues.length
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((unit, index) => ({
        ...unit,
        rank: index + 1
      }));
  } catch (error) {
    console.error('Error fetching top performing units:', error);
    return [];
  }
}

/**
 * Get detailed unit performance data for all playlists
 */
export async function getUnitPerformanceData(organizationId: string) {
  if (!organizationId || typeof organizationId !== 'string') {
    throw new Error('Invalid organizationId: must be a non-empty string');
  }

  try {
    // Get all playlists with their assignments
    const { data: playlists, error: playlistsError } = await supabase
      .from('playlists')
      .select(`
        id,
        title,
        type,
        is_active
      `)
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    if (playlistsError) {
      console.error('Error fetching playlists:', playlistsError);
      return [];
    }

    if (!playlists || playlists.length === 0) {
      return [];
    }

    // Get all assignments for these playlists
    const { data: assignments, error: assignmentsError } = await supabase
      .from('assignments')
      .select('id, playlist_id, user_id, progress_percent, status, completed_at, created_at')
      .eq('organization_id', organizationId)
      .in('status', ['assigned', 'in_progress', 'completed', 'overdue']);

    if (assignmentsError) {
      console.error('Error fetching assignments:', assignmentsError);
      return [];
    }

    // Get user progress records to calculate avg scores
    const userIds = [...new Set(assignments?.map(a => a.user_id) || [])];
    const { data: progressRecords } = await supabase
      .from('user_progress')
      .select('user_id, assignment_id, score')
      .in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])
      .not('score', 'is', null);

    // Build performance data for each playlist
    return playlists.map((playlist: any) => {
      const playlistAssignments = assignments?.filter(a => a.playlist_id === playlist.id) || [];
      
      // Calculate completion rate
      const totalAssignments = playlistAssignments.length;
      const completedAssignments = playlistAssignments.filter(a => a.status === 'completed').length;
      const completion = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;

      // Get unique employees
      const uniqueEmployees = new Set(playlistAssignments.map(a => a.user_id)).size;

      // Calculate average score from progress records
      const assignmentIds = playlistAssignments.map(a => a.id);
      const relevantScores = progressRecords?.filter(p => 
        playlistAssignments.some(a => a.user_id === p.user_id)
      ).map(p => p.score || 0) || [];
      
      const avgScore = relevantScores.length > 0
        ? Math.round(relevantScores.reduce((sum, score) => sum + score, 0) / relevantScores.length)
        : 0;

      // Calculate trend (compare last 2 weeks vs previous 2 weeks)
      const now = new Date();
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

      const recentCompletions = playlistAssignments.filter(a => 
        a.completed_at && new Date(a.completed_at) >= twoWeeksAgo
      ).length;

      const previousCompletions = playlistAssignments.filter(a => 
        a.completed_at && new Date(a.completed_at) >= fourWeeksAgo && new Date(a.completed_at) < twoWeeksAgo
      ).length;

      const trend = recentCompletions >= previousCompletions ? 'up' : 'down';

      // Determine status based on completion rate
      let status: 'excellent' | 'good' | 'warning' | 'at-risk';
      if (completion >= 90) status = 'excellent';
      else if (completion >= 75) status = 'good';
      else if (completion >= 60) status = 'warning';
      else status = 'at-risk';

      // Generate trend data (last 6 weeks of progress)
      const trendData = generateTrendData(playlistAssignments, 6);

      return {
        id: playlist.id,
        unit: playlist.title,
        completion,
        employees: uniqueEmployees,
        assignments: totalAssignments,
        avgScore,
        trend,
        status,
        trendData
      };
    });
  } catch (error) {
    console.error('Error fetching unit performance data:', error);
    return [];
  }
}

/**
 * Helper function to generate weekly trend data
 */
function generateTrendData(assignments: any[], weeks: number) {
  const now = new Date();
  const trendData = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);

    const completedInWeek = assignments.filter(a => {
      if (!a.completed_at) return false;
      const completedDate = new Date(a.completed_at);
      return completedDate >= weekStart && completedDate < weekEnd;
    }).length;

    const totalInWeek = assignments.filter(a => {
      const createdDate = new Date(a.created_at);
      return createdDate < weekEnd;
    }).length;

    const value = totalInWeek > 0 ? Math.round((completedInWeek / totalInWeek) * 100) : 0;

    trendData.push({
      week: weeks - i,
      value
    });
  }

  return trendData;
}