// ============================================================================
// FORM SCOPES CRUD
// ============================================================================
// Normalized scope per form: UNIVERSAL | SECTOR | INDUSTRY | STATE | COMPANY | PROGRAM | UNIT
// Mirrors the track_scopes pattern for consistent visibility across content types.
// ============================================================================

import { supabase, getCurrentUserOrgId } from '../supabase';

// Re-export shared types from trackScopes so consumers don't need two imports
export type { TrackScopeLevel as FormScopeLevel, SectorType } from './trackScopes';
export {
  getScopeLevels,
  getSectorOptions,
  getUsStates,
  getIndustriesForScope,
  getProgramsForScope,
  getOrganizationsForScope,
  getStoresForScope,
} from './trackScopes';

import type { TrackScopeLevel, SectorType } from './trackScopes';

export interface FormScopeRow {
  id: string;
  form_id: string;
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

export interface FormScopeEnriched extends FormScopeRow {
  state_code?: string | null;
  industry_name?: string | null;
  company_name?: string | null;
  program_name?: string | null;
  unit_name?: string | null;
}

export interface UpsertFormScopeInput {
  form_id: string;
  organization_id: string;
  scope_level: TrackScopeLevel;
  sector?: SectorType | null;
  industry_id?: string | null;
  state_id?: string | null;
  company_id?: string | null;
  program_id?: string | null;
  unit_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** Get scope for one form (with optional joined labels). */
export async function getFormScope(formId: string): Promise<FormScopeEnriched | null> {
  const { data: row, error } = await supabase
    .from('form_scopes')
    .select('*')
    .eq('form_id', formId)
    .maybeSingle();

  if (error) throw error;
  if (!row) return null;

  const r = row as FormScopeRow;
  const enriched: FormScopeEnriched = { ...r, metadata: r.metadata as Record<string, unknown> | null };

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

/** Upsert scope for a single form. One row per form (unique form_id). */
export async function upsertFormScope(input: UpsertFormScopeInput): Promise<FormScopeRow> {
  const payload = {
    form_id: input.form_id,
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
    .from('form_scopes')
    .upsert(payload, {
      onConflict: 'form_id',
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data as FormScopeRow;
}

/** Get a human-readable scope label for display in badges, lists, etc. */
export function formatScopeLabel(scope: FormScopeEnriched | null): string {
  if (!scope) return 'No scope';
  switch (scope.scope_level) {
    case 'UNIVERSAL': return 'Universal';
    case 'SECTOR': return scope.sector ? `Sector: ${scope.sector}` : 'Sector';
    case 'INDUSTRY': return scope.industry_name ? `Industry: ${scope.industry_name}` : 'Industry';
    case 'STATE': return scope.state_code ? `State: ${scope.state_code}` : 'State';
    case 'COMPANY': return scope.company_name ? `Company: ${scope.company_name}` : 'Company';
    case 'PROGRAM': return scope.program_name ? `Program: ${scope.program_name}` : 'Program';
    case 'UNIT': return scope.unit_name ? `Unit: ${scope.unit_name}` : 'Unit';
    default: return scope.scope_level;
  }
}
