// ============================================================================
// ACTIVITY LOGS CRUD OPERATIONS
// ============================================================================

import { supabase, getCurrentUserOrgId } from '../supabase';

export interface CreateActivityLogInput {
  user_id?: string;
  action: 'completion' | 'assignment' | 'update' | 'audit' | 'training' | 
                 'review' | 'form-submission' | 'certification' | 'login' | 'content-created' | 'create';
  entity_type?: string;
  entity_id?: string;
  description: string;
  metadata?: Record<string, any>;
}

/**
 * Log an activity
 * Note: This function throws errors to allow callers to handle failures explicitly.
 * For non-critical activity logging, wrap calls in try-catch if needed.
 */
export async function logActivity(input: CreateActivityLogInput) {
  const orgId = await getCurrentUserOrgId();
  
  const { data, error } = await supabase
    .from('activity_logs')
    .insert({
      organization_id: orgId,
      user_id: input.user_id,
      action: input.action,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      details: input.metadata
    })
    .select()
    .single();

  if (error) {
    console.error('Error logging activity:', error);
    throw error;
  }

  return data;
}

/**
 * Get recent activity logs for organization
 */
export async function getRecentActivity(
  organizationId: string,
  limit: number = 50,
  filters?: {
    action?: string;
    user_id?: string;
    entity_type?: string;
  }
) {
  let query = supabase
    .from('activity_logs')
    .select(`
      *,
      user:users(
        first_name,
        last_name,
        email,
        organization_id,
        store:stores!users_store_id_fkey(name),
        role:roles(name)
      )
    `)
    .eq('user.organization_id', organizationId);

  if (filters?.action) {
    query = query.eq('action', filters.action);
  }

  if (filters?.user_id) {
    query = query.eq('user_id', filters.user_id);
  }

  if (filters?.entity_type) {
    query = query.eq('entity_type', filters.entity_type);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

/**
 * Get activity logs for a specific user
 */
export async function getUserActivity(userId: string, limit: number = 100) {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

/**
 * Get activity logs for a specific entity
 */
export async function getEntityActivity(
  entityType: string,
  entityId: string,
  limit: number = 50
) {
  const { data, error } = await supabase
    .from('activity_logs')
    .select(`
      *,
      user:users(first_name, last_name, email)
    `)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

/**
 * Get activity analytics for dashboard
 */
export async function getActivityAnalytics(
  organizationId: string,
  timeRange: {
    start: string;
    end: string;
  }
) {
  const { data, error } = await supabase
    .from('activity_logs')
    .select(`
      action,
      created_at,
      user:users!inner(organization_id)
    `)
    .eq('user.organization_id', organizationId)
    .gte('created_at', timeRange.start)
    .lte('created_at', timeRange.end);

  if (error) throw error;

  // Aggregate by activity type
  const activityCounts: Record<string, number> = {};
  const dailyCounts: Record<string, number> = {};

  data?.forEach(log => {
    // Count by type
    activityCounts[log.action] = (activityCounts[log.action] || 0) + 1;

    // Count by day
    const day = log.created_at.split('T')[0];
    dailyCounts[day] = (dailyCounts[day] || 0) + 1;
  });

  return {
    totalActivities: data?.length || 0,
    activityCounts,
    dailyCounts,
    rawData: data
  };
}