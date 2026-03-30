// ============================================================================
// ALBUM SCOPES CRUD
// ============================================================================
// Same scope model as track_scopes: UNIVERSAL | STATE | COMPANY | etc.
// One row per album. Used to show state/company-specific albums when opening an org.
// ============================================================================

import { supabase } from '../supabase';
import { getUsStates } from './trackScopes';

export type AlbumScopeLevel =
  | 'UNIVERSAL'
  | 'SECTOR'
  | 'INDUSTRY'
  | 'STATE'
  | 'COMPANY'
  | 'PROGRAM'
  | 'UNIT';

export interface AlbumScopeRow {
  id: string;
  album_id: string;
  organization_id: string;
  scope_level: AlbumScopeLevel;
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

export interface AlbumScopeEnriched extends AlbumScopeRow {
  state_code?: string | null;
  state_name?: string | null;
  company_name?: string | null;
}

export interface UpsertAlbumScopeInput {
  album_id: string;
  organization_id: string;
  scope_level: AlbumScopeLevel;
  state_id?: string | null;
  company_id?: string | null;
}

/** Get scope for one album (with optional joined labels). */
export async function getAlbumScope(albumId: string): Promise<AlbumScopeEnriched | null> {
  const { data: row, error } = await supabase
    .from('album_scopes')
    .select('*')
    .eq('album_id', albumId)
    .maybeSingle();

  if (error) throw error;
  if (!row) return null;

  const r = row as AlbumScopeRow;
  const enriched: AlbumScopeEnriched = { ...r, metadata: r.metadata as Record<string, unknown> | null };

  if (r.state_id) {
    const { data: state } = await supabase.from('us_states').select('code, name').eq('id', r.state_id).single();
    enriched.state_code = (state as { code: string; name: string } | null)?.code ?? null;
    enriched.state_name = (state as { code: string; name: string } | null)?.name ?? null;
  }
  if (r.company_id) {
    const { data: org } = await supabase.from('organizations').select('name').eq('id', r.company_id).single();
    enriched.company_name = (org as { name: string } | null)?.name ?? null;
  }

  return enriched;
}

/** Upsert scope for a single album. */
export async function upsertAlbumScope(input: UpsertAlbumScopeInput): Promise<AlbumScopeRow> {
  const payload = {
    album_id: input.album_id,
    organization_id: input.organization_id,
    scope_level: input.scope_level,
    state_id: input.state_id ?? null,
    company_id: input.company_id ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('album_scopes')
    .upsert(payload, {
      onConflict: 'album_id',
      ignoreDuplicates: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data as AlbumScopeRow;
}

/** Get US states (re-export for album scope modal). */
export { getUsStates };
