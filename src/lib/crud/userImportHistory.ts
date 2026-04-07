// ============================================================================
// USER IMPORT HISTORY (audit log)
// ============================================================================

import { supabase } from '../supabase';

export interface RecordImportInput {
  organization_id: string;
  imported_by?: string | null;
  filename?: string;
  source?: string;
  match_strategy?: string;
  total_rows: number;
  created_count: number;
  updated_count: number;
  unchanged_count: number;
  reactivated_count: number;
  deactivated_count: number;
  ignored_count: number;
  skipped_count: number;
  failed_count: number;
  diff_summary: any;
}

// Roughly 1MB JSON cap for the diff payload — Postgres TOAST handles bigger,
// but we want to keep audit rows reasonable to query.
const MAX_DIFF_BYTES = 1_000_000;

function safeDiff(diff: any): any {
  try {
    const serialized = JSON.stringify(diff);
    if (serialized.length <= MAX_DIFF_BYTES) return diff;
    return {
      truncated: true,
      original_size_bytes: serialized.length,
      note: 'diff_summary truncated to avoid exceeding ~1MB',
      stats: diff?.stats ?? null,
    };
  } catch {
    return { truncated: true, note: 'diff_summary failed to serialize' };
  }
}

/**
 * Record an audit log row in user_import_history.
 * NEVER throws — audit log failures must not break the import.
 */
export async function recordImport(input: RecordImportInput): Promise<{ id: string } | null> {
  try {
    const { data, error } = await supabase
      .from('user_import_history')
      .insert({
        organization_id: input.organization_id,
        imported_by: input.imported_by ?? null,
        filename: input.filename ?? null,
        source: input.source ?? null,
        match_strategy: input.match_strategy ?? null,
        total_rows: input.total_rows,
        created_count: input.created_count,
        updated_count: input.updated_count,
        unchanged_count: input.unchanged_count,
        reactivated_count: input.reactivated_count,
        deactivated_count: input.deactivated_count,
        ignored_count: input.ignored_count,
        skipped_count: input.skipped_count,
        failed_count: input.failed_count,
        diff_summary: safeDiff(input.diff_summary),
      })
      .select('id')
      .single();

    if (error) {
      console.error('[userImportHistory] Failed to write audit log:', error);
      return null;
    }
    return data ? { id: data.id } : null;
  } catch (err) {
    console.error('[userImportHistory] Unexpected error writing audit log:', err);
    return null;
  }
}
