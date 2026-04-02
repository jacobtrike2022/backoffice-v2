import { supabase } from '../supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface BlockTemplate {
  ref_id: string;
  block_type: string;
  label: string;
  description?: string;
  placeholder?: string;
  options?: string[];
  is_required: boolean;
  validation_rules?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  conditional_logic?: {
    action: string;
    operator: string;
    conditions: Array<{
      source_block_id: string; // real ID, ref_id, or "__PARENT__"
      operator: string;
      value: string;
    }>;
  } | null;
}

export interface BlockGroup {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  block_templates: BlockTemplate[];
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// CRUD
// ============================================================================

export async function saveBlockGroup(
  orgId: string,
  name: string,
  blockTemplates: BlockTemplate[],
  createdById?: string
): Promise<BlockGroup> {
  const { data, error } = await supabase
    .from('form_block_groups')
    .insert({
      organization_id: orgId,
      name,
      block_templates: blockTemplates,
      created_by_id: createdById || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as BlockGroup;
}

export async function getBlockGroups(orgId: string): Promise<BlockGroup[]> {
  const { data, error } = await supabase
    .from('form_block_groups')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as BlockGroup[];
}

export async function deleteBlockGroup(groupId: string): Promise<void> {
  const { error } = await supabase
    .from('form_block_groups')
    .delete()
    .eq('id', groupId);

  if (error) throw error;
}
