// ============================================================================
// DASHBOARD CRUD OPERATIONS
// ============================================================================

import { supabase } from '../supabase';
import { getStorePerformanceData } from './stores';

/**
 * Get organization dashboard statistics
 */
export async function getOrganizationStats(organizationId: string) {
  try {
    console.log('[getOrganizationStats] Starting with organizationId:', organizationId);

    // Get total active employees
    const { count: employeeCount, error: employeeError } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'active');

    console.log('[getOrganizationStats] Employee count:', employeeCount, 'error:', employeeError);

    // Get total stores
    const { count: storeCount, error: storeError } = await supabase
      .from('stores')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId);

    console.log('[getOrganizationStats] Store count:', storeCount, 'error:', storeError);

    // Get all user IDs for this organization first
    const { data: orgUsers, error: orgUsersError } = await supabase
      .from('users')
      .select('id')
      .eq('organization_id', organizationId);

    console.log('[getOrganizationStats] Org users:', orgUsers?.length, 'error:', orgUsersError);

    const userIds = orgUsers?.map(u => u.id) || [];
    console.log('[getOrganizationStats] User IDs array length:', userIds.length, 'first few IDs:', userIds.slice(0, 3));

    // Calculate WEIGHTED average completion using user_progress (TRACKS, not playlists)
    // Company completion = Total completed tracks / Total assigned tracks
    const { count: completedTracks, error: completedError } = await supabase
      .from('user_progress')
      .select('id', { count: 'exact', head: true })
      .in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('status', 'completed');

    console.log('[getOrganizationStats] Completed tracks:', completedTracks, 'error:', completedError);

    // Get total track progress records (all assigned tracks)
    const { count: totalProgressRecords, error: totalProgressError } = await supabase
      .from('user_progress')
      .select('id', { count: 'exact', head: true })
      .in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

    console.log('[getOrganizationStats] Total progress records:', totalProgressRecords, 'error:', totalProgressError);

    // Calculate weighted average completion
    const avgCompletion = totalProgressRecords && totalProgressRecords > 0
      ? Math.round(((completedTracks || 0) / totalProgressRecords) * 100)
      : 0;

    console.log('[getOrganizationStats] Weighted avg completion:', avgCompletion, `(${completedTracks}/${totalProgressRecords})`);

    // Get active assignments count
    const { count: activeAssignments, error: assignmentError } = await supabase
      .from('assignments')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'active');

    console.log('[getOrganizationStats] Active assignments:', activeAssignments, 'error:', assignmentError);

    // Get certifications issued
    const { count: certificationCount, error: certError } = await supabase
      .from('user_certifications')
      .select('id', { count: 'exact', head: true })
      .in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('status', 'valid');

    console.log('[getOrganizationStats] Certifications:', certificationCount, 'error:', certError);

    // Get stores with low performance - count stores with 'at-risk' status
    const storePerformance = await getStorePerformanceData(organizationId);
    const atRiskStores = storePerformance.filter(store => store.status === 'at-risk').length;

    console.log('[getOrganizationStats] Store performance:', storePerformance.length, 'at-risk:', atRiskStores);

    const result = {
      employeeCount: employeeCount || 0,
      storeCount: storeCount || 0,
      activeAssignments: activeAssignments || 0,
      completedTracks: completedTracks || 0,
      avgCompletion,
      certificationCount: certificationCount || 0,
      atRiskStores
    };

    console.log('[getOrganizationStats] Final result:', result);

    return result;
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
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
    const cutoffStr = cutoffDate.toISOString();

    console.log('[getOrganizationStatsTrends] Starting with organizationId:', organizationId, 'cutoff:', cutoffStr);

    // Get new employees in the last period
    const { count: newEmployees, error: employeeError } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .gte('created_at', cutoffStr);

    console.log('[getOrganizationStatsTrends] New employees:', newEmployees, 'error:', employeeError);

    // Get all user IDs for this organization
    const { data: orgUsers } = await supabase
      .from('users')
      .select('id')
      .eq('organization_id', organizationId);

    const userIds = orgUsers?.map(u => u.id) || [];

    // Get completed tracks in the last period
    const { count: recentCompletions, error: completionError } = await supabase
      .from('user_progress')
      .select('id', { count: 'exact', head: true })
      .in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('status', 'completed')
      .gte('completed_at', cutoffStr);

    console.log('[getOrganizationStatsTrends] Recent completions:', recentCompletions, 'error:', completionError);

    const result = {
      newEmployees: newEmployees || 0,
      recentCompletions: recentCompletions || 0
    };

    console.log('[getOrganizationStatsTrends] Final result:', result);

    return result;
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
  try {
    console.log('[getTopPerformingUnits] Starting with organizationId:', organizationId, 'limit:', limit);

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
      console.error('[getTopPerformingUnits] Error fetching assignments:', assignmentsError);
      return [];
    }

    console.log('[getTopPerformingUnits] Assignments fetched:', assignments?.length);

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
    const rankedUnits = Array.from(playlistStats.entries())
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

    console.log('[getTopPerformingUnits] Ranked units:', rankedUnits);

    return rankedUnits;
  } catch (error) {
    console.error('Error fetching top performing units:', error);
    return [];
  }
}

/**
 * Get detailed unit performance data for all playlists
 */
export async function getUnitPerformanceData(organizationId: string) {
  try {
    console.log('[getUnitPerformanceData] Starting with organizationId:', organizationId);

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
      console.error('[getUnitPerformanceData] Error fetching playlists:', playlistsError);
      return [];
    }

    console.log('[getUnitPerformanceData] Playlists fetched:', playlists?.length);

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
      console.error('[getUnitPerformanceData] Error fetching assignments:', assignmentsError);
      return [];
    }

    console.log('[getUnitPerformanceData] Assignments fetched:', assignments?.length);

    // Get user progress records to calculate avg scores
    const userIds = [...new Set(assignments?.map(a => a.user_id) || [])];
    const { data: progressRecords, error: progressError } = await supabase
      .from('user_progress')
      .select('user_id, assignment_id, score')
      .in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])
      .not('score', 'is', null);

    console.log('[getUnitPerformanceData] Progress records fetched:', progressRecords?.length);

    // Build performance data for each playlist
    const performanceData = playlists.map((playlist: any) => {
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

    console.log('[getUnitPerformanceData] Performance data generated:', performanceData.length);

    return performanceData;
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