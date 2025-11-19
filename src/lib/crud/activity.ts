// ============================================================================
// ACTIVITY LOGS CRUD OPERATIONS
// ============================================================================

import { supabase } from '../supabase';

export interface CreateActivityLogInput {
  user_id?: string;
  activity_type: 'completion' | 'assignment' | 'update' | 'audit' | 'training' | 
                 'review' | 'form-submission' | 'certification' | 'login' | 'content-created';
  entity_type?: string;
  entity_id?: string;
  description: string;
  metadata?: Record<string, any>;
}

/**
 * Log an activity
 */
export async function logActivity(input: CreateActivityLogInput) {
  const { data, error } = await supabase
    .from('activity_logs')
    .insert({
      user_id: input.user_id,
      activity_type: input.activity_type,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      description: input.description,
      metadata: input.metadata
    })
    .select()
    .single();

  if (error) {
    console.error('Error logging activity:', error);
    return null;
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
    activity_type?: string;
    user_id?: string;
    entity_type?: string;
  }
) {
  let query = supabase
    .from('activity_logs')
    .select(`
      *,
      user:users(name, email, organization_id)
    `)
    .eq('user.organization_id', organizationId);

  if (filters?.activity_type) {
    query = query.eq('activity_type', filters.activity_type);
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
      user:users(name, email)
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
      activity_type,
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
    activityCounts[log.activity_type] = (activityCounts[log.activity_type] || 0) + 1;

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
