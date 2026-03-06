// ============================================================================
// TRACK SCOPE CRUD OPERATIONS
// ============================================================================

import { supabase, getCurrentUserOrgId } from '../supabase';
import type { ContentScope, TrackScopeAssignment } from './tracks';

export type { ContentScope, TrackScopeAssignment };

export interface ScopeAssignmentInput {
  scope_type: Exclude<ContentScope, 'universal'>;
  scope_ref_id: string;
}

// US states for the state picker
export const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' },
] as const;

/**
 * Get all scope assignments for a track
 */
export async function getTrackScopeAssignments(trackId: string): Promise<TrackScopeAssignment[]> {
  const { data, error } = await supabase
    .from('track_scope_assignments')
    .select('*')
    .eq('track_id', trackId)
    .order('scope_type');

  if (error) {
    console.error('Error fetching track scope assignments:', error);
    return [];
  }

  return data || [];
}

/**
 * Set the content scope and assignments for a track.
 * Replaces all existing scope assignments.
 */
export async function setTrackScope(
  trackId: string,
  scope: ContentScope,
  assignments: ScopeAssignmentInput[] = []
): Promise<void> {
  const { error: updateError } = await supabase
    .from('tracks')
    .update({ content_scope: scope })
    .eq('id', trackId);

  if (updateError) throw updateError;

  // Delete existing assignments
  const { error: deleteError } = await supabase
    .from('track_scope_assignments')
    .delete()
    .eq('track_id', trackId);

  if (deleteError) throw deleteError;

  // Insert new assignments (skip for universal scope)
  if (scope !== 'universal' && assignments.length > 0) {
    const rows = assignments.map(a => ({
      track_id: trackId,
      scope_type: a.scope_type,
      scope_ref_id: a.scope_ref_id,
    }));

    const { error: insertError } = await supabase
      .from('track_scope_assignments')
      .insert(rows);

    if (insertError) throw insertError;
  }
}

/**
 * Get sectors (industries with level = 'sector')
 */
export async function getSectors() {
  const { data, error } = await supabase
    .from('industries')
    .select('id, name, slug, description')
    .eq('level', 'sector')
    .eq('is_active', true)
    .order('sort_order');

  if (error) {
    console.error('Error fetching sectors:', error);
    return [];
  }
  return data || [];
}

/**
 * Get industries (level = 'industry'), optionally filtered by parent sector
 */
export async function getIndustries(sectorId?: string) {
  let query = supabase
    .from('industries')
    .select('id, name, slug, description, parent_id')
    .eq('level', 'industry')
    .eq('is_active', true)
    .order('name');

  if (sectorId) {
    query = query.eq('parent_id', sectorId);
  }

  const { data, error } = query;
  if (error) {
    console.error('Error fetching industries:', error);
    return [];
  }
  return data || [];
}

/**
 * Get programs for the scope selector
 */
export async function getPrograms() {
  const { data, error } = await supabase
    .from('programs')
    .select('id, name, description')
    .order('name');

  if (error) {
    console.error('Error fetching programs:', error);
    return [];
  }
  return data || [];
}

/**
 * Get organizations (companies) for the scope selector
 */
export async function getCompanies() {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name')
    .order('name');

  if (error) {
    console.error('Error fetching companies:', error);
    return [];
  }
  return data || [];
}

/**
 * Get stores (units) for the scope selector
 */
export async function getUnits(organizationId?: string) {
  let query = supabase
    .from('stores')
    .select('id, name, code, organization_id')
    .order('name');

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data, error } = query;
  if (error) {
    console.error('Error fetching units:', error);
    return [];
  }
  return data || [];
}

/**
 * Get tracks that are applicable to a given organization based on scope rules.
 * Checks: universal, sector match, industry match, state overlap, program overlap,
 * direct company assignment, unit assignment.
 */
export async function getApplicableTracksForOrg(orgId: string): Promise<string[]> {
  // Fetch org details
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, industry_id, operating_states')
    .eq('id', orgId)
    .single();

  if (orgError || !org) {
    console.error('Error fetching org for scope check:', orgError);
    return [];
  }

  // Fetch org's industry parent (sector)
  let sectorId: string | null = null;
  if (org.industry_id) {
    const { data: industry } = await supabase
      .from('industries')
      .select('parent_id')
      .eq('id', org.industry_id)
      .single();
    sectorId = industry?.parent_id || null;
  }

  // Fetch org's programs
  const { data: orgPrograms } = await supabase
    .from('organization_programs')
    .select('program_id')
    .eq('organization_id', orgId);
  const programIds = orgPrograms?.map(p => p.program_id) || [];

  // Fetch org's stores
  const { data: orgStores } = await supabase
    .from('stores')
    .select('id')
    .eq('organization_id', orgId);
  const storeIds = orgStores?.map(s => s.id) || [];

  // 1. Universal tracks — always visible
  const { data: universalTracks } = await supabase
    .from('tracks')
    .select('id')
    .eq('content_scope', 'universal');
  const applicableIds = new Set((universalTracks || []).map(t => t.id));

  // 2. Sector-scoped tracks
  if (sectorId) {
    const { data: sectorAssignments } = await supabase
      .from('track_scope_assignments')
      .select('track_id')
      .eq('scope_type', 'sector')
      .eq('scope_ref_id', sectorId);
    sectorAssignments?.forEach(a => applicableIds.add(a.track_id));
  }

  // 3. Industry-scoped tracks
  if (org.industry_id) {
    const { data: industryAssignments } = await supabase
      .from('track_scope_assignments')
      .select('track_id')
      .eq('scope_type', 'industry')
      .eq('scope_ref_id', org.industry_id);
    industryAssignments?.forEach(a => applicableIds.add(a.track_id));
  }

  // 4. State-scoped tracks
  const states: string[] = org.operating_states || [];
  if (states.length > 0) {
    const { data: stateAssignments } = await supabase
      .from('track_scope_assignments')
      .select('track_id')
      .eq('scope_type', 'state')
      .in('scope_ref_id', states.map(s => s.toUpperCase()));
    stateAssignments?.forEach(a => applicableIds.add(a.track_id));
  }

  // 5. Program-scoped tracks
  if (programIds.length > 0) {
    const { data: programAssignments } = await supabase
      .from('track_scope_assignments')
      .select('track_id')
      .eq('scope_type', 'program')
      .in('scope_ref_id', programIds);
    programAssignments?.forEach(a => applicableIds.add(a.track_id));
  }

  // 6. Company-scoped tracks
  const { data: companyAssignments } = await supabase
    .from('track_scope_assignments')
    .select('track_id')
    .eq('scope_type', 'company')
    .eq('scope_ref_id', orgId);
  companyAssignments?.forEach(a => applicableIds.add(a.track_id));

  // 7. Unit-scoped tracks
  if (storeIds.length > 0) {
    const { data: unitAssignments } = await supabase
      .from('track_scope_assignments')
      .select('track_id')
      .eq('scope_type', 'unit')
      .in('scope_ref_id', storeIds);
    unitAssignments?.forEach(a => applicableIds.add(a.track_id));
  }

  return Array.from(applicableIds);
}
