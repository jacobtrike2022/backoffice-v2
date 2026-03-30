// ============================================================================
// DEALS CRUD OPERATIONS - Trike Sales Pipeline
// ============================================================================

import { supabase } from '../supabase';

// ============================================================================
// TYPES
// ============================================================================

export type DealStage = 'lead' | 'prospect' | 'evaluating' | 'closing' | 'won' | 'lost' | 'frozen';
export type DealType = 'new' | 'upsell' | 'renewal' | 'expansion';
export type ActivityType = 'note' | 'email' | 'call' | 'meeting' | 'proposal_sent' | 'demo' | 'stage_change' | 'value_change' | 'task' | 'system';

export interface Deal {
  id: string;
  organization_id: string;
  name: string;
  deal_type: DealType;
  stage: DealStage;
  value: number | null;
  mrr: number | null;
  probability: number;
  owner_id: string | null;
  created_at: string;
  expected_close_date: string | null;
  actual_close_date: string | null;
  last_activity_at: string;
  next_action: string | null;
  next_action_date: string | null;
  lost_reason: string | null;
  lost_competitor: string | null;
  notes: string | null;
  tags: string[];
  metadata: Record<string, any>;
  updated_at: string;
  // Joined data
  organization?: {
    id: string;
    name: string;
    status: string;
    industry: string | null;
    website: string | null;
  };
  owner?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

export interface DealActivity {
  id: string;
  deal_id: string;
  activity_type: ActivityType;
  title: string;
  description: string | null;
  from_stage: string | null;
  to_stage: string | null;
  from_value: number | null;
  to_value: number | null;
  user_id: string | null;
  created_at: string;
  metadata: Record<string, any>;
  // Joined
  user?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  };
}

export interface PipelineSummary {
  stage: DealStage;
  deal_count: number;
  total_value: number | null;
  total_mrr: number | null;
  avg_probability: number | null;
  weighted_value: number | null;
}

export interface CreateDealInput {
  organization_id: string;
  name: string;
  deal_type?: DealType;
  stage?: DealStage;
  value?: number | null;
  mrr?: number | null;
  probability?: number;
  owner_id?: string | null;
  expected_close_date?: string | null;
  next_action?: string | null;
  next_action_date?: string | null;
  notes?: string | null;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateDealInput {
  name?: string;
  deal_type?: DealType;
  stage?: DealStage;
  value?: number | null;
  mrr?: number | null;
  probability?: number;
  owner_id?: string | null;
  expected_close_date?: string | null;
  actual_close_date?: string | null;
  next_action?: string | null;
  next_action_date?: string | null;
  lost_reason?: string | null;
  lost_competitor?: string | null;
  notes?: string | null;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface DealFilters {
  stage?: DealStage | DealStage[];
  owner_id?: string;
  organization_id?: string;
  deal_type?: DealType;
  search?: string;
  min_value?: number;
  max_value?: number;
  expected_close_before?: string;
  expected_close_after?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// DEALS CRUD
// ============================================================================

/**
 * Get all deals with optional filtering
 */
export async function getDeals(filters?: DealFilters): Promise<Deal[]> {
  try {
    let query = supabase
      .from('deals')
      .select(`
        *,
        organization:organizations(id, name, status, industry, website),
        owner:users!owner_id(id, first_name, last_name, email)
      `)
      .order('last_activity_at', { ascending: false });

    // Apply filters
    if (filters?.stage) {
      if (Array.isArray(filters.stage)) {
        query = query.in('stage', filters.stage);
      } else {
        query = query.eq('stage', filters.stage);
      }
    }

    if (filters?.owner_id) {
      query = query.eq('owner_id', filters.owner_id);
    }

    if (filters?.organization_id) {
      query = query.eq('organization_id', filters.organization_id);
    }

    if (filters?.deal_type) {
      query = query.eq('deal_type', filters.deal_type);
    }

    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`);
    }

    if (filters?.min_value !== undefined) {
      query = query.gte('value', filters.min_value);
    }

    if (filters?.max_value !== undefined) {
      query = query.lte('value', filters.max_value);
    }

    if (filters?.expected_close_before) {
      query = query.lte('expected_close_date', filters.expected_close_before);
    }

    if (filters?.expected_close_after) {
      query = query.gte('expected_close_date', filters.expected_close_after);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, (filters.offset + (filters.limit || 50)) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []) as Deal[];
  } catch (err) {
    console.error('Error in getDeals:', err);
    throw err;
  }
}

/**
 * Get a single deal by ID
 */
export async function getDealById(dealId: string): Promise<Deal | null> {
  try {
    const { data, error } = await supabase
      .from('deals')
      .select(`
        *,
        organization:organizations(id, name, status, industry, website),
        owner:users!owner_id(id, first_name, last_name, email)
      `)
      .eq('id', dealId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data as Deal;
  } catch (err) {
    console.error('Error in getDealById:', err);
    throw err;
  }
}

/**
 * Get deals grouped by stage (for pipeline board)
 */
export async function getDealsByStage(stages?: DealStage[]): Promise<Record<DealStage, Deal[]>> {
  try {
    const targetStages = stages || ['lead', 'prospect', 'evaluating', 'closing'];

    const { data, error } = await supabase
      .from('deals')
      .select(`
        *,
        organization:organizations(id, name, status, industry, website),
        owner:users!owner_id(id, first_name, last_name, email)
      `)
      .in('stage', targetStages)
      .order('last_activity_at', { ascending: false });

    if (error) throw error;

    // Group by stage
    const dealsByStage: Record<DealStage, Deal[]> = {
      lead: [],
      prospect: [],
      evaluating: [],
      closing: [],
      won: [],
      lost: [],
      frozen: [],
    };

    (data || []).forEach((deal: Deal) => {
      if (dealsByStage[deal.stage]) {
        dealsByStage[deal.stage].push(deal);
      }
    });

    return dealsByStage;
  } catch (err) {
    console.error('Error in getDealsByStage:', err);
    throw err;
  }
}

/**
 * Create a new deal
 */
export async function createDeal(input: CreateDealInput): Promise<Deal> {
  try {
    const { data, error } = await supabase
      .from('deals')
      .insert([{
        organization_id: input.organization_id,
        name: input.name,
        deal_type: input.deal_type || 'new',
        stage: input.stage || 'lead',
        value: input.value ?? null,
        mrr: input.mrr ?? null,
        probability: input.probability ?? 0,
        owner_id: input.owner_id ?? null,
        expected_close_date: input.expected_close_date ?? null,
        next_action: input.next_action ?? null,
        next_action_date: input.next_action_date ?? null,
        notes: input.notes ?? null,
        tags: input.tags || [],
        metadata: input.metadata || {},
      }])
      .select(`
        *,
        organization:organizations(id, name, status, industry, website),
        owner:users!owner_id(id, first_name, last_name, email)
      `)
      .single();

    if (error) throw error;
    return data as Deal;
  } catch (err) {
    console.error('Error in createDeal:', err);
    throw err;
  }
}

/**
 * Update a deal
 */
export async function updateDeal(dealId: string, input: UpdateDealInput): Promise<Deal> {
  try {
    const updateData: any = { ...input, updated_at: new Date().toISOString() };

    const { data, error } = await supabase
      .from('deals')
      .update(updateData)
      .eq('id', dealId)
      .select(`
        *,
        organization:organizations(id, name, status, industry, website),
        owner:users!owner_id(id, first_name, last_name, email)
      `)
      .single();

    if (error) throw error;
    return data as Deal;
  } catch (err) {
    console.error('Error in updateDeal:', err);
    throw err;
  }
}

/**
 * Update deal stage (convenience method that also handles side effects)
 */
export async function updateDealStage(
  dealId: string,
  newStage: DealStage,
  options?: {
    lost_reason?: string;
    lost_competitor?: string;
    actual_close_date?: string;
  }
): Promise<Deal> {
  try {
    const updateData: any = {
      stage: newStage,
      updated_at: new Date().toISOString(),
    };

    // Handle terminal states
    if (newStage === 'won') {
      updateData.actual_close_date = options?.actual_close_date || new Date().toISOString().split('T')[0];
      updateData.probability = 100;
    } else if (newStage === 'lost') {
      updateData.actual_close_date = options?.actual_close_date || new Date().toISOString().split('T')[0];
      updateData.probability = 0;
      if (options?.lost_reason) updateData.lost_reason = options.lost_reason;
      if (options?.lost_competitor) updateData.lost_competitor = options.lost_competitor;
    }

    const { data, error } = await supabase
      .from('deals')
      .update(updateData)
      .eq('id', dealId)
      .select(`
        *,
        organization:organizations(id, name, status, industry, website),
        owner:users!owner_id(id, first_name, last_name, email)
      `)
      .single();

    if (error) throw error;
    return data as Deal;
  } catch (err) {
    console.error('Error in updateDealStage:', err);
    throw err;
  }
}

/**
 * Delete a deal
 */
export async function deleteDeal(dealId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('deals')
      .delete()
      .eq('id', dealId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error in deleteDeal:', err);
    throw err;
  }
}

// ============================================================================
// PIPELINE SUMMARY
// ============================================================================

/**
 * Get pipeline summary statistics
 */
export async function getPipelineSummary(): Promise<PipelineSummary[]> {
  try {
    // Use the pipeline_summary view created in migration
    const { data, error } = await supabase
      .from('pipeline_summary')
      .select('*');

    if (error) {
      // Fallback to manual calculation if view doesn't exist
      console.warn('pipeline_summary view not available, calculating manually');
      return await calculatePipelineSummary();
    }

    return (data || []) as PipelineSummary[];
  } catch (err) {
    console.error('Error in getPipelineSummary:', err);
    return await calculatePipelineSummary();
  }
}

/**
 * Calculate pipeline summary manually (fallback)
 */
async function calculatePipelineSummary(): Promise<PipelineSummary[]> {
  const stages: DealStage[] = ['lead', 'prospect', 'evaluating', 'closing'];
  const results: PipelineSummary[] = [];

  for (const stage of stages) {
    const { data, error } = await supabase
      .from('deals')
      .select('value, mrr, probability')
      .eq('stage', stage);

    if (error) {
      console.error(`Error calculating summary for stage ${stage}:`, error);
      continue;
    }

    const deals = data || [];
    const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
    const totalMrr = deals.reduce((sum, d) => sum + (d.mrr || 0), 0);
    const avgProb = deals.length > 0
      ? deals.reduce((sum, d) => sum + (d.probability || 0), 0) / deals.length
      : 0;
    const weightedValue = deals.reduce((sum, d) => sum + ((d.value || 0) * (d.probability || 0) / 100), 0);

    results.push({
      stage,
      deal_count: deals.length,
      total_value: totalValue || null,
      total_mrr: totalMrr || null,
      avg_probability: avgProb || null,
      weighted_value: weightedValue || null,
    });
  }

  return results;
}

/**
 * Get total pipeline metrics
 */
export async function getPipelineMetrics(): Promise<{
  totalValue: number;
  weightedValue: number;
  totalDeals: number;
  avgDealSize: number;
  totalMrr: number;
}> {
  try {
    const { data, error } = await supabase
      .from('deals')
      .select('value, mrr, probability')
      .in('stage', ['lead', 'prospect', 'evaluating', 'closing']);

    if (error) throw error;

    const deals = data || [];
    const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
    const weightedValue = deals.reduce((sum, d) => sum + ((d.value || 0) * (d.probability || 0) / 100), 0);
    const totalDeals = deals.length;
    const avgDealSize = totalDeals > 0 ? totalValue / totalDeals : 0;
    const totalMrr = deals.reduce((sum, d) => sum + (d.mrr || 0), 0);

    return { totalValue, weightedValue, totalDeals, avgDealSize, totalMrr };
  } catch (err) {
    console.error('Error in getPipelineMetrics:', err);
    throw err;
  }
}

// ============================================================================
// DEAL ACTIVITIES
// ============================================================================

/**
 * Get activities for a deal
 */
export async function getDealActivities(dealId: string, limit?: number): Promise<DealActivity[]> {
  try {
    let query = supabase
      .from('deal_activities')
      .select(`
        *,
        user:users(id, first_name, last_name)
      `)
      .eq('deal_id', dealId)
      .order('created_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []) as DealActivity[];
  } catch (err) {
    console.error('Error in getDealActivities:', err);
    throw err;
  }
}

/**
 * Add an activity to a deal
 */
export async function addDealActivity(input: {
  deal_id: string;
  activity_type: ActivityType;
  title: string;
  description?: string | null;
  user_id?: string | null;
  metadata?: Record<string, any>;
}): Promise<DealActivity> {
  try {
    const { data, error } = await supabase
      .from('deal_activities')
      .insert([{
        deal_id: input.deal_id,
        activity_type: input.activity_type,
        title: input.title,
        description: input.description ?? null,
        user_id: input.user_id ?? null,
        metadata: input.metadata || {},
      }])
      .select(`
        *,
        user:users(id, first_name, last_name)
      `)
      .single();

    if (error) throw error;
    return data as DealActivity;
  } catch (err) {
    console.error('Error in addDealActivity:', err);
    throw err;
  }
}

/**
 * Get recent activities across all deals
 */
export async function getRecentActivities(limit: number = 20): Promise<DealActivity[]> {
  try {
    const { data, error } = await supabase
      .from('deal_activities')
      .select(`
        *,
        user:users(id, first_name, last_name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as DealActivity[];
  } catch (err) {
    console.error('Error in getRecentActivities:', err);
    throw err;
  }
}

// ============================================================================
// STAGE TRANSITION ANALYTICS
// ============================================================================

export interface StageTransition {
  deal_id: string;
  from_stage: string;
  to_stage: string;
  transitioned_at: string; // created_at of the activity
}

/**
 * Get all stage_change activities across all deals.
 * Used by analytics to compute:
 * - Historical conversion rates between stages
 * - Average time-in-stage (bottleneck detection)
 */
export async function getStageTransitions(): Promise<StageTransition[]> {
  try {
    const { data, error } = await supabase
      .from('deal_activities')
      .select('deal_id, from_stage, to_stage, created_at')
      .eq('activity_type', 'stage_change')
      .not('from_stage', 'is', null)
      .not('to_stage', 'is', null)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []).map((row: any) => ({
      deal_id: row.deal_id,
      from_stage: row.from_stage,
      to_stage: row.to_stage,
      transitioned_at: row.created_at,
    }));
  } catch (err) {
    console.error('Error in getStageTransitions:', err);
    throw err;
  }
}

// ============================================================================
// UPCOMING ACTIONS
// ============================================================================

/**
 * Get deals with upcoming next actions
 */
export async function getUpcomingActions(daysAhead: number = 7): Promise<Deal[]> {
  try {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + daysAhead);

    const { data, error } = await supabase
      .from('deals')
      .select(`
        *,
        organization:organizations(id, name, status, industry, website),
        owner:users!owner_id(id, first_name, last_name, email)
      `)
      .not('next_action', 'is', null)
      .not('next_action_date', 'is', null)
      .gte('next_action_date', today.toISOString().split('T')[0])
      .lte('next_action_date', futureDate.toISOString().split('T')[0])
      .in('stage', ['lead', 'prospect', 'evaluating', 'closing'])
      .order('next_action_date', { ascending: true });

    if (error) throw error;
    return (data || []) as Deal[];
  } catch (err) {
    console.error('Error in getUpcomingActions:', err);
    throw err;
  }
}

/**
 * Get overdue deals (expected close date passed)
 */
export async function getOverdueDeals(): Promise<Deal[]> {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('deals')
      .select(`
        *,
        organization:organizations(id, name, status, industry, website),
        owner:users!owner_id(id, first_name, last_name, email)
      `)
      .lt('expected_close_date', today)
      .in('stage', ['lead', 'prospect', 'evaluating', 'closing'])
      .order('expected_close_date', { ascending: true });

    if (error) throw error;
    return (data || []) as Deal[];
  } catch (err) {
    console.error('Error in getOverdueDeals:', err);
    throw err;
  }
}

// ============================================================================
// ORGANIZATION HELPERS
// ============================================================================

/**
 * Get organizations available for deal creation (not already in active deal)
 */
export async function getOrganizationsForDeals(): Promise<Array<{
  id: string;
  name: string;
  status: string;
  industry: string | null;
  website: string | null;
}>> {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, status, industry, website')
      .in('status', ['demo', 'live'])
      .order('name');

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error in getOrganizationsForDeals:', err);
    throw err;
  }
}

/**
 * Get Trike Super Admin users (for deal owner assignment)
 */
export async function getDealOwnerCandidates(): Promise<Array<{
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}>> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select(`
        id, first_name, last_name, email,
        role:roles!role_id(name)
      `)
      .eq('status', 'active');

    if (error) throw error;

    // Filter to Trike Super Admins
    const admins = (data || []).filter((u: any) =>
      u.role?.name === 'Trike Super Admin'
    ).map((u: any) => ({
      id: u.id,
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
    }));

    return admins;
  } catch (err) {
    console.error('Error in getDealOwnerCandidates:', err);
    throw err;
  }
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Move multiple deals to a new stage at once
 */
export async function bulkUpdateDealStage(
  dealIds: string[],
  newStage: DealStage
): Promise<void> {
  if (dealIds.length === 0) return;

  try {
    const { error } = await supabase
      .from('deals')
      .update({
        stage: newStage,
        updated_at: new Date().toISOString(),
      })
      .in('id', dealIds);

    if (error) throw error;
  } catch (err) {
    console.error('Error in bulkUpdateDealStage:', err);
    throw err;
  }
}

/**
 * Reassign multiple deals to a new owner
 */
export async function bulkReassignOwner(
  dealIds: string[],
  newOwnerId: string
): Promise<void> {
  if (dealIds.length === 0) return;

  try {
    const { error } = await supabase
      .from('deals')
      .update({
        owner_id: newOwnerId,
        updated_at: new Date().toISOString(),
      })
      .in('id', dealIds);

    if (error) throw error;
  } catch (err) {
    console.error('Error in bulkReassignOwner:', err);
    throw err;
  }
}
