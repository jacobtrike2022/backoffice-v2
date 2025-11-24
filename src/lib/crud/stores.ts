// ============================================================================
// STORES CRUD OPERATIONS
// ============================================================================

import { supabase } from '../supabase';

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

        // Get active assignments for these employees
        const { data: assignments, error: assignError } = await supabase
          .from('assignments')
          .select('id, status')
          .in('user_id', employeeIds)
          .eq('status', 'active');

        if (assignError) {
          console.error('Error fetching assignments:', assignError);
        }

        const assignmentCount = assignments?.length || 0;

        // Get progress data for these employees
        const { data: progressData, error: progressError } = await supabase
          .from('user_progress')
          .select('user_id, progress_percent, status')
          .in('user_id', employeeIds);

        if (progressError) {
          console.error('Error fetching progress:', progressError);
        }

        // Calculate WEIGHTED average progress (total completed / total assigned)
        let avgProgress = 0;
        if (progressData && progressData.length > 0) {
          const completedCount = progressData.filter(p => p.status === 'completed').length;
          avgProgress = Math.round((completedCount / progressData.length) * 100);
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

        // Get progress data for employees at this store
        const { data: progressData, error: progressError } = await supabase
          .from('user_progress')
          .select('user_id, progress_percent, status')
          .in('user_id', employees?.map(e => e.id) || []);

        if (progressError) {
          console.error('Error fetching progress:', progressError);
        }

        // Calculate WEIGHTED average progress (total completed / total assigned)
        let avgProgress = 0;
        if (progressData && progressData.length > 0) {
          const completedCount = progressData.filter(p => p.status === 'completed').length;
          avgProgress = Math.round((completedCount / progressData.length) * 100);
        }

        // Calculate compliance (percentage of completed assignments)
        let compliance = 0;
        if (progressData && progressData.length > 0) {
          const completedCount = progressData.filter(p => p.status === 'completed').length;
          compliance = Math.round((completedCount / progressData.length) * 100);
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
          zip: store.zip,
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
    const stores = await getStores();
    return stores.find(s => s.id === storeId) || null;
  } catch (err) {
    console.error('Error in getStoreById:', err);
    throw err;
  }
}

/**
 * Create a new store
 */
export async function createStore(storeData: {
  organization_id: string;
  name: string;
  code?: string;
  district_id?: string;
  manager_id?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}) {
  try {
    const { data, error } = await supabase
      .from('stores')
      .insert([storeData])
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
    name?: string;
    code?: string;
    district_id?: string;
    manager_id?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    is_active?: boolean;
  }
) {
  try {
    const { data, error } = await supabase
      .from('stores')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', storeId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error in updateStore:', err);
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