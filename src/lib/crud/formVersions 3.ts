// ============================================================================
// FORM VERSIONS CRUD
// ============================================================================

import { supabase } from '../supabase';

export interface FormVersionSnapshot {
  title: string;
  description?: string;
  type: string;
  blocks: Array<{
    id: string;
    type: string;
    label: string;
    is_required: boolean;
    display_order: number;
    options?: string[];
    conditional_logic?: unknown;
  }>;
}

export interface FormVersion {
  id: string;
  form_id: string;
  version_number: number;
  snapshot: FormVersionSnapshot;
  published_at: string;
  published_by_id?: string | null;
  change_notes?: string | null;
}

/**
 * Create a version snapshot when a form is published.
 * Reads current form+blocks and stores as JSONB snapshot.
 */
export async function createFormVersion(formId: string, orgId: string): Promise<FormVersion> {
  // 1. Fetch form + blocks scoped by organization_id
  const { data: form, error: formError } = await supabase
    .from('forms')
    .select('*, form_blocks(*)')
    .eq('id', formId)
    .eq('organization_id', orgId)
    .single();

  if (formError) throw formError;

  // 2. Get next version number
  const { data: lastVersion } = await supabase
    .from('form_versions')
    .select('version_number')
    .eq('form_id', formId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersionNumber = (lastVersion?.version_number ?? 0) + 1;

  // 3. Build snapshot
  const snapshot: FormVersionSnapshot = {
    title: form.title,
    description: form.description,
    type: form.type,
    blocks: ((form.form_blocks as any[]) || [])
      .sort((a, b) => a.display_order - b.display_order)
      .map((b) => ({
        id: b.id,
        type: b.type,
        label: b.label,
        is_required: b.is_required,
        display_order: b.display_order,
        options: b.options,
        conditional_logic: b.conditional_logic,
      })),
  };

  // 4. Insert version
  const { data: version, error: versionError } = await supabase
    .from('form_versions')
    .insert({
      form_id: formId,
      version_number: nextVersionNumber,
      snapshot,
      published_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (versionError) throw versionError;

  // 5. Update current_version on form
  await supabase
    .from('forms')
    .update({ current_version: nextVersionNumber })
    .eq('id', formId);

  return version as FormVersion;
}

/**
 * Get all versions for a form, newest first.
 */
export async function getFormVersions(formId: string): Promise<FormVersion[]> {
  const { data, error } = await supabase
    .from('form_versions')
    .select('*')
    .eq('form_id', formId)
    .order('version_number', { ascending: false });

  if (error) throw error;
  return (data ?? []) as FormVersion[];
}
