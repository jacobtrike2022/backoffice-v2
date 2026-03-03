// ============================================================================
// PROPOSALS CRUD OPERATIONS - Trike Sales Pipeline
// ============================================================================

import { supabase } from '../supabase';

// ============================================================================
// TYPES
// ============================================================================

export type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired' | 'superseded';

export interface Proposal {
  id: string;
  deal_id: string;
  organization_id: string;
  name: string;
  version: number;
  status: ProposalStatus;
  content_json: Record<string, any>;
  pdf_url: string | null;
  pricing_tiers: any[];
  selected_tier: string | null;
  total_value: number | null;
  created_at: string;
  sent_at: string | null;
  viewed_at: string | null;
  expires_at: string | null;
  responded_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_by: string | null;
  notes: string | null;
  rejection_reason: string | null;
  updated_at: string;
  // Joined relations
  deal?: { id: string; name: string; stage: string; value: number | null };
  organization?: { id: string; name: string };
  creator?: { id: string; first_name: string; last_name: string; display_name: string };
}

export interface CreateProposalInput {
  deal_id: string;
  organization_id: string;
  name: string;
  version?: number;
  status?: ProposalStatus;
  content_json?: Record<string, any>;
  pricing_tiers?: any[];
  total_value?: number | null;
  expires_at?: string | null;
  notes?: string | null;
  created_by?: string | null;
}

export interface UpdateProposalInput {
  name?: string;
  version?: number;
  status?: ProposalStatus;
  content_json?: Record<string, any>;
  pdf_url?: string | null;
  pricing_tiers?: any[];
  selected_tier?: string | null;
  total_value?: number | null;
  expires_at?: string | null;
  notes?: string | null;
  rejection_reason?: string | null;
}

export interface ProposalFilters {
  status?: ProposalStatus | ProposalStatus[];
  deal_id?: string;
  organization_id?: string;
  created_by?: string;
}

// ============================================================================
// SELECT CLAUSE (joined relations)
// ============================================================================

const PROPOSAL_SELECT = `
  *,
  deal:deals!deal_id(id, name, stage, value),
  organization:organizations!organization_id(id, name),
  creator:users!created_by(id, first_name, last_name, display_name)
`;

// ============================================================================
// READ OPERATIONS
// ============================================================================

/**
 * Get all proposals with optional filters
 */
export async function getProposals(filters?: ProposalFilters & { limit?: number }): Promise<Proposal[]> {
  try {
    let query = supabase
      .from('proposals')
      .select(PROPOSAL_SELECT)
      .order('created_at', { ascending: false });

    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status);
      } else {
        query = query.eq('status', filters.status);
      }
    }
    if (filters?.deal_id) {
      query = query.eq('deal_id', filters.deal_id);
    }
    if (filters?.organization_id) {
      query = query.eq('organization_id', filters.organization_id);
    }
    if (filters?.created_by) {
      query = query.eq('created_by', filters.created_by);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Proposal[];
  } catch (error) {
    console.error('Error fetching proposals:', error);
    return [];
  }
}

/**
 * Get a single proposal by ID
 */
export async function getProposalById(proposalId: string): Promise<Proposal | null> {
  try {
    const { data, error } = await supabase
      .from('proposals')
      .select(PROPOSAL_SELECT)
      .eq('id', proposalId)
      .single();

    if (error) throw error;
    return data as Proposal;
  } catch (error) {
    console.error('Error fetching proposal:', error);
    return null;
  }
}

/**
 * Get all proposals for a specific deal
 */
export async function getProposalsByDeal(dealId: string): Promise<Proposal[]> {
  return getProposals({ deal_id: dealId });
}

/**
 * Get all proposals for a specific organization
 */
export async function getProposalsByOrg(organizationId: string): Promise<Proposal[]> {
  return getProposals({ organization_id: organizationId });
}

// ============================================================================
// WRITE OPERATIONS
// ============================================================================

/**
 * Create a new proposal
 */
export async function createProposal(input: CreateProposalInput): Promise<Proposal | null> {
  try {
    const { data, error } = await supabase
      .from('proposals')
      .insert([{
        deal_id: input.deal_id,
        organization_id: input.organization_id,
        name: input.name,
        version: input.version || 1,
        status: input.status || 'draft',
        content_json: input.content_json || {},
        pricing_tiers: input.pricing_tiers || [],
        total_value: input.total_value,
        expires_at: input.expires_at,
        notes: input.notes,
        created_by: input.created_by,
      }])
      .select(PROPOSAL_SELECT)
      .single();

    if (error) throw error;
    return data as Proposal;
  } catch (error) {
    console.error('Error creating proposal:', error);
    return null;
  }
}

/**
 * Update an existing proposal
 */
export async function updateProposal(proposalId: string, input: UpdateProposalInput): Promise<Proposal | null> {
  try {
    const { data, error } = await supabase
      .from('proposals')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', proposalId)
      .select(PROPOSAL_SELECT)
      .single();

    if (error) throw error;
    return data as Proposal;
  } catch (error) {
    console.error('Error updating proposal:', error);
    return null;
  }
}

/**
 * Update proposal status with automatic timestamp tracking
 */
export async function updateProposalStatus(
  proposalId: string,
  newStatus: ProposalStatus,
  extra?: { rejection_reason?: string; selected_tier?: string }
): Promise<Proposal | null> {
  try {
    const now = new Date().toISOString();
    const updates: Record<string, any> = {
      status: newStatus,
      updated_at: now,
    };

    // Set status-specific timestamps
    switch (newStatus) {
      case 'sent':
        updates.sent_at = now;
        break;
      case 'viewed':
        updates.viewed_at = now;
        updates.last_viewed_at = now;
        updates.view_count = supabase.rpc ? undefined : undefined; // handled below
        break;
      case 'accepted':
        updates.responded_at = now;
        if (extra?.selected_tier) updates.selected_tier = extra.selected_tier;
        break;
      case 'rejected':
        updates.responded_at = now;
        if (extra?.rejection_reason) updates.rejection_reason = extra.rejection_reason;
        break;
    }

    // For 'viewed' status, increment view_count
    if (newStatus === 'viewed') {
      // First get current count, then update
      const { data: current } = await supabase
        .from('proposals')
        .select('view_count')
        .eq('id', proposalId)
        .single();

      updates.view_count = (current?.view_count || 0) + 1;
    }

    const { data, error } = await supabase
      .from('proposals')
      .update(updates)
      .eq('id', proposalId)
      .select(PROPOSAL_SELECT)
      .single();

    if (error) throw error;
    return data as Proposal;
  } catch (error) {
    console.error('Error updating proposal status:', error);
    return null;
  }
}

/**
 * Delete a proposal
 */
export async function deleteProposal(proposalId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('proposals')
      .delete()
      .eq('id', proposalId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting proposal:', error);
    return false;
  }
}

// ============================================================================
// AGGREGATE / SUMMARY
// ============================================================================

/**
 * Get proposal summary stats
 */
export async function getProposalStats(): Promise<{
  total: number;
  byStatus: Record<ProposalStatus, number>;
  totalValue: number;
  acceptanceRate: number;
}> {
  try {
    const { data, error } = await supabase
      .from('proposals')
      .select('id, status, total_value');

    if (error) throw error;

    const proposals = data || [];
    const byStatus: Record<string, number> = {};
    let totalValue = 0;
    let responded = 0;
    let accepted = 0;

    for (const p of proposals) {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
      totalValue += p.total_value || 0;
      if (p.status === 'accepted' || p.status === 'rejected') {
        responded++;
        if (p.status === 'accepted') accepted++;
      }
    }

    return {
      total: proposals.length,
      byStatus: byStatus as Record<ProposalStatus, number>,
      totalValue,
      acceptanceRate: responded > 0 ? (accepted / responded) * 100 : 0,
    };
  } catch (error) {
    console.error('Error fetching proposal stats:', error);
    return {
      total: 0,
      byStatus: {} as Record<ProposalStatus, number>,
      totalValue: 0,
      acceptanceRate: 0,
    };
  }
}
