// ============================================================================
// TRACK SCOPES CRUD
// ============================================================================
// Normalized scope per track: UNIVERSAL | SECTOR | INDUSTRY | STATE | COMPANY | PROGRAM | UNIT
//
// SECTOR enum (track_scopes.sector): RETAIL | RESTAURANT | HOSPITALITY | DISTRIBUTION.
// INDUSTRY options come from the industries table; when scope_level is SECTOR we filter
// industries by sector via a fixed mapping (e.g. qsr → RESTAURANT, convenience_retail → RETAIL).
// See getIndustriesForScope(sector) and sectorIndustryCodes below.
// ============================================================================

import { supabase, getCurrentUserOrgId } from '../supabase';
import { assignTrackTagsByName } from './tags';

export type TrackScopeLevel =
  | 'UNIVERSAL'
  | 'SECTOR'
  | 'INDUSTRY'
  | 'STATE'
  | 'COMPANY'
  | 'PROGRAM'
  | 'UNIT';

export type SectorType = 'RETAIL' | 'RESTAURANT' | 'HOSPITALITY' | 'DISTRIBUTION';

export interface TrackScopeRow {
  id: string;
  track_id: string;
  organization_id: string;
  scope_level: TrackScopeLevel;
  sector: string | null;
  industry_id: string | null;
  state_id: string | null;
  company_id: string | null;
  program_id: string | null;
  unit_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface TrackScopeEnriched extends TrackScopeRow {
  state_code?: string | null;
  industry_name?: string | null;
  company_name?: string | null;
  program_name?: string | null;
  unit_name?: string | null;
}

export interface UpsertTrackScopeInput {
  track_id: string;
  organization_id: string;
  scope_level: TrackScopeLevel;
  sector?: SectorType | null;
  industry_id?: string | null;
  state_id?: string | null;
  company_id?: string | null;
  program_id?: string | null;
  unit_id?: string | null;
  metadata?: Record<string, unknown> | null;
  syncToTags?: boolean;
}

export interface BulkUpdateTrackScopePayload {
  scope_level: TrackScopeLevel;
  sector?: SectorType | null;
  industry_id?: string | null;
  state_id?: string | null;
  company_id?: string | null;
  program_id?: string | null;
  unit_id?: string | null;
  syncToTags?: boolean;
}

export interface UsStateRow {
  id: string;
  code: string;
  name: string;
  is_active: boolean | null;
  sort_order: number | null;
}

const SCOPE_LEVELS: TrackScopeLevel[] = [
  'UNIVERSAL',
  'SECTOR',
  'INDUSTRY',
  'STATE',
  'COMPANY',
  'PROGRAM',
  'UNIT',
];

const SECTOR_OPTIONS: SectorType[] = ['RETAIL', 'RESTAURANT', 'HOSPITALITY', 'DISTRIBUTION'];

/** Get scope for one track (with optional joined labels). */
export async function getTrackScope(trackId: string): Promise<TrackScopeEnriched | null> {
  const { data: row, error } = await supabase
    .from('track_scopes')
    .select('*')
    .eq('track_id', trackId)
    .maybeSingle();

  if (error) throw error;
  if (!row) return null;

  const r = row as TrackScopeRow;
  const enriched: TrackScopeEnriched = { ...r, metadata: r.metadata as Record<string, unknown> | null };

  if (r.state_id) {
    const { data: state } = await supabase.from('us_states').select('code').eq('id', r.state_id).single();
    enriched.state_code = (state as any)?.code ?? null;
  }
  if (r.industry_id) {
    const { data: ind } = await supabase.from('industries').select('name').eq('id', r.industry_id).single();
    enriched.industry_name = (ind as any)?.name ?? null;
  }
  if (r.company_id) {
    const { data: org } = await supabase.from('organizations').select('name').eq('id', r.company_id).single();
    enriched.company_name = (org as any)?.name ?? null;
  }
  if (r.program_id) {
    const { data: prog } = await supabase.from('programs').select('name').eq('id', r.program_id).single();
    enriched.program_name = (prog as any)?.name ?? null;
  }
  if (r.unit_id) {
    const { data: store } = await supabase.from('stores').select('name').eq('id', r.unit_id).single();
    enriched.unit_name = (store as any)?.name ?? null;
  }

  return enriched;
}

/** Get scope for one track (raw row, no joins). Use when you only need IDs. */
export async function getTrackScopeRow(trackId: string): Promise<TrackScopeRow | null> {
  const { data, error } = await supabase
    .from('track_scopes')
    .select('*')
    .eq('track_id', trackId)
    .maybeSingle();

  if (error) throw error;
  return data as TrackScopeRow | null;
}

/** Upsert scope for a single track. One row per track (unique track_id). */
export async function upsertTrackScope(input: UpsertTrackScopeInput): Promise<TrackScopeRow> {
  const payload = {
    track_id: input.track_id,
    organization_id: input.organization_id,
    scope_level: input.scope_level,
    sector: input.sector ?? null,
    industry_id: input.industry_id ?? null,
    state_id: input.state_id ?? null,
    company_id: input.company_id ?? null,
    program_id: input.program_id ?? null,
    unit_id: input.unit_id ?? null,
    metadata: input.metadata ?? {},
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('track_scopes')
    .upsert(payload, {
      onConflict: 'track_id',
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (error) throw error;

  if (input.syncToTags) {
    syncScopeToTagsForTrack(input.track_id, payload).catch(() => {});
  }

  return data as TrackScopeRow;
}

/** Bulk update scope for multiple tracks. Same scope payload applied to all. */
export async function bulkUpdateTrackScope(
  trackIds: string[],
  payload: BulkUpdateTrackScopePayload
): Promise<{ updated: number; errors: string[] }> {
  if (trackIds.length === 0) {
    return { updated: 0, errors: [] };
  }

  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const errors: string[] = [];
  let updated = 0;

  for (const trackId of trackIds) {
    try {
      await upsertTrackScope({
        track_id: trackId,
        organization_id: orgId,
        scope_level: payload.scope_level,
        sector: payload.sector ?? null,
        industry_id: payload.industry_id ?? null,
        state_id: payload.state_id ?? null,
        company_id: payload.company_id ?? null,
        program_id: payload.program_id ?? null,
        unit_id: payload.unit_id ?? null,
        syncToTags: payload.syncToTags ?? true,
      });
      updated++;
    } catch (e: any) {
      errors.push(`${trackId}: ${e?.message || String(e)}`);
    }
  }

  return { updated, errors };
}

/** Fetch all US states (for STATE scope and filters). */
export async function getUsStates(): Promise<UsStateRow[]> {
  const { data, error } = await supabase
    .from('us_states')
    .select('id, code, name, is_active, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data || []) as UsStateRow[];
}

/**
 * Get industries for scope modal (optionally filtered by sector).
 * SECTOR → industry mapping: RETAIL (convenience_retail, grocery, fuel_retail, etc.),
 * RESTAURANT (qsr, fsr), HOSPITALITY (casino, hotel), DISTRIBUTION (wholesale, distribution).
 * Industries table uses code/slug; we match by code or slug.
 */
export async function getIndustriesForScope(sector?: SectorType | null): Promise<{ id: string; name: string; code: string | null; parent_id: string | null }[]> {
  let query = supabase
    .from('industries')
    .select('id, name, code, parent_id, slug')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  const { data, error } = await query;
  if (error) throw error;

  const list = (data || []) as { id: string; name: string; code: string | null; parent_id: string | null; slug?: string | null }[];
  if (!sector) return list;

  /** Sector → industry codes/slugs (aligns with industries seed: convenience_retail, qsr, grocery, fuel_retail). */
  const sectorIndustryCodes: Record<SectorType, string[]> = {
    RETAIL: ['cstore', 'grocery', 'retail', 'convenience_retail', 'fuel_retail'],
    RESTAURANT: ['qsr', 'fsr', 'full_service', 'quick_service'],
    HOSPITALITY: ['hospitality', 'casino', 'hotel'],
    DISTRIBUTION: ['wholesale', 'distribution', 'fuel_wholesale'],
  };
  const codes = sectorIndustryCodes[sector] || [];
  if (codes.length === 0) return list;

  return list.filter((i) => {
    const identifier = (i.code || (i as { slug?: string | null }).slug || '').toLowerCase();
    return identifier && codes.some((c) => identifier.includes(c.toLowerCase()));
  });
}

/** Get programs for PROGRAM scope (all active). */
export async function getProgramsForScope(): Promise<{ id: string; name: string; slug: string }[]> {
  const { data, error } = await supabase
    .from('programs')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    if (error.code === '42P01') return []; // table does not exist
    throw error;
  }
  return (data || []) as { id: string; name: string; slug: string }[];
}

/** Get organizations for COMPANY scope (for Trike admin: all orgs; else current org). */
export async function getOrganizationsForScope(allowAllOrgs: boolean = false): Promise<{ id: string; name: string }[]> {
  if (!allowAllOrgs) {
    const orgId = await getCurrentUserOrgId();
    if (!orgId) return [];
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', orgId);
    if (error) throw error;
    return (data || []) as { id: string; name: string }[];
  }

  const { data, error } = await supabase
    .from('organizations')
    .select('id, name')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []) as { id: string; name: string }[];
}

/** Get stores (units) for UNIT scope, optionally filtered by organization_id. */
export async function getStoresForScope(organizationId?: string | null): Promise<{ id: string; name: string; code: string | null; organization_id: string }[]> {
  let query = supabase
    .from('stores')
    .select('id, name, code, organization_id')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as { id: string; name: string; code: string | null; organization_id: string }[];
}

/** Mirror scope to track_tags for legacy filtering (e.g. state:TX, scope:state). */
export async function syncScopeToTagsForTrack(
  trackId: string,
  scope: {
    scope_level: string;
    sector?: string | null;
    state_id?: string | null;
  }
): Promise<void> {
  const { data: stateRow } =
    scope.state_id != null
      ? await supabase.from('us_states').select('code').eq('id', scope.state_id).single()
      : { data: null };

  const stateCode = stateRow?.code;
  const tagNames: string[] = [];

  if (scope.scope_level !== 'UNIVERSAL') {
    tagNames.push(`scope:${scope.scope_level.toLowerCase()}`);
  }
  if (scope.sector) {
    tagNames.push(`scope:sector:${scope.sector.toLowerCase()}`);
  }
  if (stateCode) {
    tagNames.push(`state:${stateCode}`);
  }

  if (tagNames.length > 0) {
    await assignTrackTagsByName(trackId, tagNames);
  }
}

/** Get scope level and sector constants for UI. */
export function getScopeLevels(): TrackScopeLevel[] {
  return [...SCOPE_LEVELS];
}

export function getSectorOptions(): SectorType[] {
  return [...SECTOR_OPTIONS];
}
