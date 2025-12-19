// ============================================================================
// STORES CRUD OPERATIONS
// ============================================================================

import { supabase, getCurrentUserOrgId } from '../supabase';
import { publicAnonKey, getServerUrl } from '../../utils/supabase/info';

// ============================================================================
// ROLES CRUD OPERATIONS
// ============================================================================

/**
 * Get all roles for an organization
 */
export async function getRoles(organizationId?: string) {
  try {
    const orgId = organizationId || await getCurrentUserOrgId();
    if (!orgId) throw new Error('Organization ID required');

    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .order('level', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error in getRoles:', err);
    throw err;
  }
}

/**
 * Get a single role by ID
 */
export async function getRoleById(roleId: string) {
  try {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .eq('id', roleId)
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error in getRoleById:', err);
    throw err;
  }
}

/**
 * Create a new role
 */
export async function createRole(roleData: {
  organization_id: string;
  name: string;
  description?: string;
  level?: number;
  permissions_json?: Record<string, any>;
}) {
  try {
    const { data, error } = await supabase
      .from('roles')
      .insert([roleData])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error in createRole:', err);
    throw err;
  }
}

/**
 * Update a role
 */
export async function updateRole(
  roleId: string,
  updates: {
    name?: string;
    description?: string;
    level?: number;
    permissions_json?: Record<string, any>;
    is_active?: boolean;
  }
) {
  try {
    const { data, error } = await supabase
      .from('roles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', roleId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error in updateRole:', err);
    throw err;
  }
}

// ============================================================================
// DISTRICTS CRUD OPERATIONS
// ============================================================================

/**
 * Get all districts for an organization
 */
export async function getDistricts(organizationId?: string) {
  try {
    const orgId = organizationId || await getCurrentUserOrgId();
    if (!orgId) throw new Error('Organization ID required');

    const { data, error } = await supabase
      .from('districts')
      .select(`
        *,
        manager:users!manager_id(id, first_name, last_name, email)
      `)
      .eq('organization_id', orgId)
      .eq('status', 'active')
      .order('name');

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error in getDistricts:', err);
    throw err;
  }
}

/**
 * Get a single district by ID
 */
export async function getDistrictById(districtId: string) {
  try {
    const { data, error } = await supabase
      .from('districts')
      .select(`
        *,
        manager:users!manager_id(id, first_name, last_name, email)
      `)
      .eq('id', districtId)
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error in getDistrictById:', err);
    throw err;
  }
}

/**
 * Create a new district
 */
export async function createDistrict(districtData: {
  district_name: string;
  district_code: string;
}) {
  try {
    // Get the current user's session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('You must be logged in to create a district');
    }

    // Call server endpoint (bypasses RLS by using service role key)
    const response = await fetch(`${getServerUrl()}/districts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        name: districtData.district_name,
        code: districtData.district_code,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create district');
    }

    const { district } = await response.json();
    return district;
  } catch (err) {
    console.error('Error in createDistrict:', err);
    throw err;
  }
}

/**
 * Update a district
 */
export async function updateDistrict(
  districtId: string,
  updates: {
    district_name?: string;
    district_code?: string;
  }
) {
  try {
    const updateData: any = {};
    if (updates.district_name) updateData.name = updates.district_name;
    if (updates.district_code) updateData.code = updates.district_code;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('districts')
      .update(updateData)
      .eq('id', districtId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error in updateDistrict:', err);
    throw err;
  }
}

/**
 * Delete a district
 */
export async function deleteDistrict(districtId: string) {
  try {
    const { error } = await supabase
      .from('districts')
      .delete()
      .eq('id', districtId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error in deleteDistrict:', err);
    throw err;
  }
}

// ============================================================================
// STORES CRUD OPERATIONS
// ============================================================================

/**
 * Get store performance data for dashboard
 * Includes: staff count, assignments, average progress, status
 */
export async function getStorePerformanceData(organizationId: string) {
  try {
    // Get all active stores for the organization
    const { data: stores, error: storesError } = await supabase
      .from('stores')
      .select('id, name, code, is_active')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('name');

    if (storesError) throw storesError;

    // For each store, calculate metrics
    const storePerformance = await Promise.all(
      (stores || []).map(async (store) => {
        // Get active employees for this store
        const { data: employees, error: empError } = await supabase
          .from('users')
          .select('id')
          .eq('store_id', store.id)
          .eq('status', 'active');

        if (empError) {
          console.error('Error fetching employees for store:', empError);
        }

        const employeeIds = employees?.map(e => e.id) || [];
        const employeeCount = employeeIds.length;

        // Get active assignments for these employees (for count)
        const { data: activeAssignments, error: assignError } = await supabase
          .from('assignments')
          .select('id, status')
          .in('user_id', employeeIds)
          .eq('status', 'active');

        if (assignError) {
          console.error('Error fetching assignments:', assignError);
        }

        const assignmentCount = activeAssignments?.length || 0;

        // Get progress data from track_completions (source of truth)
        // Calculate average progress by averaging individual employee progress percentages
        let avgProgress = 0;
        
        if (employeeIds.length > 0) {
          // Get all assignments for these employees
          const { data: allAssignments } = await supabase
            .from('assignments')
            .select('id, user_id, playlist_id')
            .in('user_id', employeeIds);

          // Get all track completions for these employees
          const { data: completions } = await supabase
            .from('track_completions')
            .select('track_id, user_id')
            .in('user_id', employeeIds);

          if (allAssignments && allAssignments.length > 0) {
            const playlistIds = [...new Set(allAssignments.map(a => a.playlist_id).filter(Boolean))];
            if (playlistIds.length > 0) {
              const { data: playlistTracks } = await supabase
                .from('playlist_tracks')
                .select('track_id, playlist_id')
                .in('playlist_id', playlistIds);

              // Build track assignment map per user
              const tracksByUser: Record<string, Set<string>> = {};
              allAssignments.forEach(assignment => {
                if (!tracksByUser[assignment.user_id]) {
                  tracksByUser[assignment.user_id] = new Set();
                }
                playlistTracks?.forEach(pt => {
                  if (pt.playlist_id === assignment.playlist_id) {
                    tracksByUser[assignment.user_id].add(pt.track_id);
                  }
                });
              });

              // Calculate progress percentage for each employee
              const employeeProgresses: number[] = [];
              employeeIds.forEach(employeeId => {
                const assignedTracks = tracksByUser[employeeId] || new Set();
                const userCompletions = completions?.filter(tc => tc.user_id === employeeId) || [];
                const completedTracks = userCompletions.filter(tc => assignedTracks.has(tc.track_id));
                
                if (assignedTracks.size > 0) {
                  const employeeProgress = Math.round((completedTracks.length / assignedTracks.size) * 100);
                  employeeProgresses.push(employeeProgress);
                } else {
                  // Employee with no assignments has 0% progress
                  employeeProgresses.push(0);
                }
              });

              // Average the individual employee progress percentages
              if (employeeProgresses.length > 0) {
                const sum = employeeProgresses.reduce((acc, p) => acc + p, 0);
                avgProgress = Math.round(sum / employeeProgresses.length);
              }
            }
          }
        }

        // Determine status based on avgProgress
        let status: 'excellent' | 'good' | 'warning' | 'at-risk' = 'good';
        if (avgProgress >= 90) {
          status = 'excellent';
        } else if (avgProgress >= 75) {
          status = 'good';
        } else if (avgProgress >= 60) {
          status = 'warning';
        } else {
          status = 'at-risk';
        }

        // Determine trend (simplified - comparing to a baseline)
        const trend = avgProgress >= 75 ? 'up' : 'down';

        // Generate simple trend data (last 4 weeks)
        const trendData = Array.from({ length: 4 }, (_, i) => ({
          week: i + 1,
          value: Math.max(0, avgProgress - (3 - i) * 5 + Math.random() * 10)
        }));

        return {
          id: store.id,
          unit: store.name,
          employees: employeeCount,
          assignments: assignmentCount,
          completion: avgProgress,
          status,
          trend,
          trendData
        };
      })
    );

    return storePerformance;
  } catch (err) {
    console.error('Error in getStorePerformanceData:', err);
    throw err;
  }
}

/**
 * Get top performing stores ranked by average employee progress
 */
export async function getTopPerformingStores(organizationId: string, limit: number = 3) {
  try {
    const storePerformance = await getStorePerformanceData(organizationId);
    
    // Sort by completion percentage (descending) and take top N
    const topStores = storePerformance
      .sort((a, b) => b.completion - a.completion)
      .slice(0, limit)
      .map((store, index) => ({
        rank: index + 1,
        name: store.unit,
        score: store.completion
      }));

    return topStores;
  } catch (err) {
    console.error('Error in getTopPerformingStores:', err);
    throw err;
  }
}

/**
 * Get all stores with related data (district, manager, employee counts, metrics)
 * 
 * @param filters - Optional filters for organization_id, district_id, is_active
 * @returns Array of stores with enriched data
 */
export async function getStores(filters?: {
  organization_id?: string;
  district_id?: string;
  is_active?: boolean;
}) {
  try {
    let query = supabase
      .from('stores')
      .select(`
        *,
        district:districts(id, name, code),
        manager:users!fk_stores_manager(id, first_name, last_name, email)
      `);

    // Apply filters
    if (filters?.organization_id) {
      query = query.eq('organization_id', filters.organization_id);
    }
    if (filters?.district_id) {
      query = query.eq('district_id', filters.district_id);
    }
    if (filters?.is_active !== undefined) {
      query = query.eq('is_active', filters.is_active);
    }

    const { data: stores, error } = await query.order('name');

    if (error) throw error;

    // For each store, get employee count and calculate metrics
    const enrichedStores = await Promise.all(
      (stores || []).map(async (store) => {
        // Get employees for this store
        const { data: employees, error: empError } = await supabase
          .from('users')
          .select('id, store_id')
          .eq('store_id', store.id);

        if (empError) {
          console.error('Error fetching employees for store:', empError);
        }

        const employeeCount = employees?.length || 0;

        // Get progress data from track_completions (source of truth)
        const employeeIds = employees?.map(e => e.id) || [];
        
        // Calculate average progress by averaging individual employee progress percentages
        let avgProgress = 0;
        let compliance = 0;
        
        if (employeeIds.length > 0) {
          // Get all assignments for these employees
          const { data: assignments } = await supabase
            .from('assignments')
            .select('id, user_id, playlist_id')
            .in('user_id', employeeIds);

          // Get all track completions for these employees
          const { data: completions } = await supabase
            .from('track_completions')
            .select('track_id, user_id')
            .in('user_id', employeeIds);

          if (assignments && assignments.length > 0) {
            // Get all unique tracks from assignments
            const playlistIds = [...new Set(assignments.map(a => a.playlist_id).filter(Boolean))];
            const { data: playlistTracks } = await supabase
              .from('playlist_tracks')
              .select('track_id, playlist_id')
              .in('playlist_id', playlistIds);

            // Build track assignment map per user
            const tracksByUser: Record<string, Set<string>> = {};
            assignments.forEach(assignment => {
              if (!tracksByUser[assignment.user_id]) {
                tracksByUser[assignment.user_id] = new Set();
              }
              playlistTracks?.forEach(pt => {
                if (pt.playlist_id === assignment.playlist_id) {
                  tracksByUser[assignment.user_id].add(pt.track_id);
                }
              });
            });

            // Calculate progress percentage for each employee
            const employeeProgresses: number[] = [];
            employeeIds.forEach(employeeId => {
              const assignedTracks = tracksByUser[employeeId] || new Set();
              const userCompletions = completions?.filter(tc => tc.user_id === employeeId) || [];
              const completedTracks = userCompletions.filter(tc => assignedTracks.has(tc.track_id));
              
              if (assignedTracks.size > 0) {
                const employeeProgress = Math.round((completedTracks.length / assignedTracks.size) * 100);
                employeeProgresses.push(employeeProgress);
              } else {
                // Employee with no assignments has 0% progress
                employeeProgresses.push(0);
              }
            });

            // Average the individual employee progress percentages
            if (employeeProgresses.length > 0) {
              const sum = employeeProgresses.reduce((acc, p) => acc + p, 0);
              avgProgress = Math.round(sum / employeeProgresses.length);
              compliance = avgProgress; // Use same calculation for compliance
            }
          }
        }

        // Determine performance level based on avgProgress
        let performance: 'excellent' | 'good' | 'needs-improvement' = 'needs-improvement';
        if (avgProgress >= 85) {
          performance = 'excellent';
        } else if (avgProgress >= 70) {
          performance = 'good';
        }

        return {
          id: store.id,
          name: store.name,
          code: store.code,
          district: store.district,
          manager: store.manager,
          city: store.city,
          state: store.state,
          address: store.address,
          address_line_2: store.address_line_2,
          zip: store.zip,
          county: store.county,
          phone: store.phone,
          store_email: store.store_email,
          photo_url: store.photo_url,
          district_id: store.district_id,
          manager_id: store.manager_id,
          latitude: store.latitude,
          longitude: store.longitude,
          place_id: store.place_id,
          timezone: store.timezone,
          organization_id: store.organization_id,
          is_active: store.is_active,
          employeeCount,
          avgProgress,
          compliance,
          performance,
          created_at: store.created_at,
          updated_at: store.updated_at,
        };
      })
    );

    return enrichedStores;
  } catch (err) {
    console.error('Error in getStores:', err);
    throw err;
  }
}

/**
 * Get a single store by ID with all related data
 */
export async function getStoreById(storeId: string) {
  try {
    const { data, error } = await supabase
      .from('stores')
      .select(`
        *,
        district:districts(id, name, code),
        manager:users!fk_stores_manager(id, first_name, last_name, email)
      `)
      .eq('id', storeId)
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error in getStoreById:', err);
    throw err;
  }
}

/**
 * Create a new store
 */
export async function createStore(storeData: {
  store_name: string;
  store_code: string;
  district_id?: string | null;
  address?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  county?: string | null;
  phone?: string | null;
  store_email?: string | null;
  photo_url?: string | null;
  manager_id?: string | null;
}) {
  try {
    const orgId = await getCurrentUserOrgId();
    if (!orgId) throw new Error('Organization ID required');

    const { data, error } = await supabase
      .from('stores')
      .insert([{
        organization_id: orgId,
        name: storeData.store_name,
        code: storeData.store_code,
        district_id: storeData.district_id || null,
        address: storeData.address || null,
        address_line_2: storeData.address_line_2 || null,
        city: storeData.city || null,
        state: storeData.state || null,
        zip: storeData.zip_code || null,
        county: storeData.county || null,
        phone: storeData.phone || null,
        store_email: storeData.store_email || null,
        photo_url: storeData.photo_url || null,
        manager_id: storeData.manager_id || null
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error in createStore:', err);
    throw err;
  }
}

/**
 * Update a store
 */
export async function updateStore(
  storeId: string,
  updates: {
    store_name?: string;
    store_code?: string;
    district_id?: string | null;
    address?: string | null;
    address_line_2?: string | null;
    city?: string | null;
    state?: string | null;
    zip_code?: string | null;
    phone?: string | null;
    store_email?: string | null;
    county?: string | null;
    photo_url?: string | null;
    manager_id?: string | null;
  }
) {
  try {
    const updateData: any = {};
    if (updates.store_name) updateData.name = updates.store_name;
    if (updates.store_code) updateData.code = updates.store_code;
    if (updates.district_id !== undefined) updateData.district_id = updates.district_id;
    if (updates.address !== undefined) updateData.address = updates.address;
    if (updates.address_line_2 !== undefined) updateData.address_line_2 = updates.address_line_2;
    if (updates.city !== undefined) updateData.city = updates.city;
    if (updates.state !== undefined) updateData.state = updates.state;
    if (updates.zip_code !== undefined) updateData.zip = updates.zip_code;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.store_email !== undefined) updateData.store_email = updates.store_email;
    if (updates.county !== undefined) updateData.county = updates.county;
    if (updates.photo_url !== undefined) updateData.photo_url = updates.photo_url;
    if (updates.manager_id !== undefined) updateData.manager_id = updates.manager_id;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('stores')
      .update(updateData)
      .eq('id', storeId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error in updateStore:', err)
    throw err;
  }
}

/**
 * Delete a store
 */
export async function deleteStore(storeId: string) {
  try {
    const { error } = await supabase
      .from('stores')
      .delete()
      .eq('id', storeId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error in deleteStore:', err);
    throw err;
  }
}

/**
 * Get store activity feed
 * Returns recent activity logs for employees at a specific store
 */
export async function getStoreActivity(storeId: string, limit: number = 20) {
  try {
    // Get all employees for this store
    const { data: employees, error: empError } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .eq('store_id', storeId)
      .eq('status', 'active');

    if (empError) throw empError;
    if (!employees || employees.length === 0) return [];

    const employeeIds = employees.map(e => e.id);
    const employeeMap = new Map(employees.map(e => [e.id, `${e.first_name} ${e.last_name}`]));

    // Get recent activity logs for these employees
    const { data: activities, error: activityError } = await supabase
      .from('activity_logs')
      .select(`
        *,
        user:users(id, first_name, last_name)
      `)
      .in('user_id', employeeIds)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (activityError) throw activityError;

    // Format activities for display
    return (activities || []).map((activity: any) => {
      const employeeName = activity.user 
        ? `${activity.user.first_name} ${activity.user.last_name}`
        : 'Unknown';
      
      // Format timestamp
      const timestamp = new Date(activity.created_at);
      const now = new Date();
      const diffMs = now.getTime() - timestamp.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      
      let timeAgo = '';
      if (diffHours < 1) {
        timeAgo = 'Just now';
      } else if (diffHours < 24) {
        timeAgo = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      } else if (diffDays < 7) {
        timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      } else {
        timeAgo = timestamp.toLocaleDateString();
      }

      // Determine activity type and icon
      let type: 'completion' | 'certification' | 'assignment' | 'alert' = 'assignment';
      let title = activity.action || 'Activity';
      let description = activity.details?.description || activity.action || '';

      if (activity.action === 'completion') {
        type = 'completion';
        title = 'Training Module Completed';
        const trackTitle = activity.details?.track_title || 'Training';
        const score = activity.details?.score;
        description = `${trackTitle}${score ? ` - Score: ${score}%` : ''}`;
      } else if (activity.action === 'certification') {
        type = 'certification';
        title = 'New Certification Earned';
        description = activity.details?.certification_name || 'Certification';
      } else if (activity.action === 'assignment') {
        type = 'assignment';
        title = 'New Content Assigned';
        description = activity.details?.playlist_title || 'Content';
      }

      return {
        id: activity.id,
        type,
        employee: employeeName,
        title,
        description,
        timestamp: timeAgo,
        created_at: activity.created_at
      };
    });
  } catch (err) {
    console.error('Error in getStoreActivity:', err);
    throw err;
  }
}

/**
 * Get store performance trends (monthly data for last 6 months)
 * Returns progress, compliance, and engagement metrics
 */
export async function getStorePerformanceTrends(storeId: string) {
  try {
    // Get all employees for this store
    const { data: employees, error: empError } = await supabase
      .from('users')
      .select('id')
      .eq('store_id', storeId)
      .eq('status', 'active');

    if (empError) throw empError;
    if (!employees || employees.length === 0) {
      // Return empty data structure
      const months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
      return months.map(month => ({ month, progress: 0, compliance: 0, engagement: 0 }));
    }

    const employeeIds = employees.map(e => e.id);

    // Get last 6 months
    const now = new Date();
    const months: { month: string; start: Date; end: Date }[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
      months.push({
        month: monthNames[date.getMonth()],
        start: monthStart,
        end: monthEnd
      });
    }

    // Calculate metrics for each month
    const performanceData = await Promise.all(
      months.map(async ({ month, start, end }) => {
        // Get progress data for this month
        const { data: progressData } = await supabase
          .from('user_progress')
          .select('status, progress_percent, updated_at')
          .in('user_id', employeeIds)
          .gte('updated_at', start.toISOString())
          .lte('updated_at', end.toISOString());

        // Calculate average progress
        let progress = 0;
        if (progressData && progressData.length > 0) {
          const completed = progressData.filter(p => p.status === 'completed').length;
          progress = Math.round((completed / progressData.length) * 100);
        }

        // Calculate compliance (completed assignments / total assignments)
        const { data: assignments } = await supabase
          .from('assignments')
          .select('status, assigned_at')
          .in('user_id', employeeIds)
          .lte('assigned_at', end.toISOString());

        let compliance = 0;
        if (assignments && assignments.length > 0) {
          const completed = assignments.filter(a => a.status === 'completed').length;
          compliance = Math.round((completed / assignments.length) * 100);
        }

        // Calculate engagement (activity count as percentage)
        const { data: activities } = await supabase
          .from('activity_logs')
          .select('id')
          .in('user_id', employeeIds)
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString());

        // Engagement score based on activity frequency (normalized to 0-100)
        const activityCount = activities?.length || 0;
        const expectedActivity = employeeIds.length * 10; // Assume 10 activities per employee per month is 100%
        const engagement = Math.min(100, Math.round((activityCount / expectedActivity) * 100));

        return { month, progress, compliance, engagement };
      })
    );

    return performanceData;
  } catch (err) {
    console.error('Error in getStorePerformanceTrends:', err);
    throw err;
  }
}

/**
 * Get employee progress for a store
 * Returns top employees by progress percentage
 */
export async function getStoreEmployeeProgress(storeId: string, limit: number = 10) {
  try {
    // Get employees for this store
    const { data: employees, error: empError } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .eq('store_id', storeId)
      .eq('status', 'active');

    if (empError) throw empError;
    if (!employees || employees.length === 0) return [];

    const employeeIds = employees.map(e => e.id);

    // Get progress data for all employees
    const { data: progressData, error: progressError } = await supabase
      .from('user_progress')
      .select('user_id, progress_percent, status')
      .in('user_id', employeeIds);

    if (progressError) throw progressError;

    // Calculate average progress per employee
    const employeeProgressMap = new Map<string, { total: number; completed: number }>();
    
    (progressData || []).forEach((progress: any) => {
      const existing = employeeProgressMap.get(progress.user_id) || { total: 0, completed: 0 };
      existing.total += 1;
      if (progress.status === 'completed') {
        existing.completed += 1;
      }
      employeeProgressMap.set(progress.user_id, existing);
    });

    // Calculate progress percentage for each employee
    const employeeProgress = employees.map(employee => {
      const stats = employeeProgressMap.get(employee.id) || { total: 0, completed: 0 };
      const progress = stats.total > 0 
        ? Math.round((stats.completed / stats.total) * 100)
        : 0;
      
      return {
        name: `${employee.first_name} ${employee.last_name}`,
        progress
      };
    });

    // Sort by progress (descending) and return top N
    return employeeProgress
      .sort((a, b) => b.progress - a.progress)
      .slice(0, limit);
  } catch (err) {
    console.error('Error in getStoreEmployeeProgress:', err);
    throw err;
  }
}

/**
 * Get quick statistics for a store
 * Returns completion rate, certifications, learning hours, and overdue items
 */
export async function getStoreQuickStats(storeId: string) {
  try {
    // Get all employees for this store
    const { data: employees, error: empError } = await supabase
      .from('users')
      .select('id')
      .eq('store_id', storeId)
      .eq('status', 'active');

    if (empError) throw empError;
    if (!employees || employees.length === 0) {
      return {
        completionRate: 0,
        certifications: 0,
        learningHours: 0,
        overdueItems: 0
      };
    }

    const employeeIds = employees.map(e => e.id);

    // Calculate completion rate (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentProgress } = await supabase
      .from('user_progress')
      .select('status, updated_at')
      .in('user_id', employeeIds)
      .gte('updated_at', thirtyDaysAgo.toISOString());

    let completionRate = 0;
    if (recentProgress && recentProgress.length > 0) {
      const completed = recentProgress.filter(p => p.status === 'completed').length;
      completionRate = Math.round((completed / recentProgress.length) * 100);
    }

    // Count active certifications
    const { data: certifications } = await supabase
      .from('user_certifications')
      .select('id')
      .in('user_id', employeeIds)
      .eq('status', 'active');

    const certificationCount = certifications?.length || 0;

    // Sum learning hours (from user_progress time_spent_minutes)
    const { data: userProgress } = await supabase
      .from('user_progress')
      .select('time_spent_minutes')
      .in('user_id', employeeIds);

    const totalMinutes = userProgress?.reduce((sum, p) => sum + (p.time_spent_minutes || 0), 0) || 0;
    const learningHours = Math.round(totalMinutes / 60);

    // Count overdue assignments
    const now = new Date().toISOString();
    const { data: overdueAssignments } = await supabase
      .from('assignments')
      .select('id')
      .in('user_id', employeeIds)
      .lt('due_date', now)
      .neq('status', 'completed');

    const overdueCount = overdueAssignments?.length || 0;

    return {
      completionRate,
      certifications: certificationCount,
      learningHours,
      overdueItems: overdueCount
    };
  } catch (err) {
    console.error('Error in getStoreQuickStats:', err);
    throw err;
  }
}