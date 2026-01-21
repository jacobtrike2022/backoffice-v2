// ============================================================================
// INDUSTRIES CRUD OPERATIONS
// ============================================================================

import { supabase, getCurrentUserOrgId } from '../supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface Industry {
  id: string;
  name: string;
  code: string | null;
  slug: string | null;
  parent_id: string | null;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface IndustryRequirement {
  industry_id: string;
  requirement_id: string;
  is_required: boolean;
  notes: string | null;
  created_at: string;
  requirement?: {
    id: string;
    requirement_name: string;
    state_code: string;
    topic?: { name: string; icon: string | null };
    authority?: { name: string; abbreviation: string | null };
  };
}

// ============================================================================
// INDUSTRY CRUD
// ============================================================================

/**
 * Get all industries
 */
export async function getIndustries(): Promise<Industry[]> {
  const { data, error } = await supabase
    .from('industries')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get a single industry by ID
 */
export async function getIndustry(id: string): Promise<Industry | null> {
  const { data, error } = await supabase
    .from('industries')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

/**
 * Get industry by code
 */
export async function getIndustryByCode(code: string): Promise<Industry | null> {
  const { data, error } = await supabase
    .from('industries')
    .select('*')
    .eq('code', code)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

/**
 * Get compliance requirements for an industry
 */
export async function getIndustryRequirements(industryId: string): Promise<IndustryRequirement[]> {
  const { data, error } = await supabase
    .from('industry_compliance_requirements')
    .select(`
      *,
      requirement:compliance_requirements(
        id,
        requirement_name,
        state_code,
        topic:compliance_topics(name, icon),
        authority:compliance_authorities(name, abbreviation)
      )
    `)
    .eq('industry_id', industryId);

  if (error) throw error;
  return data || [];
}

/**
 * Create a new industry (Trike Super Admin only)
 */
export async function createIndustry(input: {
  name: string;
  code?: string;
  description?: string;
  parent_id?: string;
  sort_order?: number;
}): Promise<Industry> {
  const { data, error } = await supabase
    .from('industries')
    .insert({
      name: input.name,
      code: input.code,
      slug: input.code, // Use code as slug for compatibility
      description: input.description,
      parent_id: input.parent_id,
      sort_order: input.sort_order ?? 0
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update an industry (Trike Super Admin only)
 */
export async function updateIndustry(
  id: string,
  input: Partial<{
    name: string;
    code: string;
    description: string;
    parent_id: string;
    sort_order: number;
  }>
): Promise<Industry> {
  const updateData: any = { ...input };
  if (input.code) {
    updateData.slug = input.code; // Keep slug in sync
  }

  const { data, error } = await supabase
    .from('industries')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete an industry (Trike Super Admin only)
 */
export async function deleteIndustry(id: string): Promise<void> {
  const { error } = await supabase
    .from('industries')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// ============================================================================
// ORGANIZATION INDUSTRY
// ============================================================================

/**
 * Set the industry for the current user's organization
 */
export async function setOrganizationIndustry(industryId: string): Promise<void> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('organizations')
    .update({ industry_id: industryId })
    .eq('id', orgId);

  if (error) throw error;
}

/**
 * Get the industry for the current user's organization
 */
export async function getOrganizationIndustry(): Promise<Industry | null> {
  const orgId = await getCurrentUserOrgId();
  if (!orgId) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('organizations')
    .select('industry:industries(*)')
    .eq('id', orgId)
    .single();

  if (error) throw error;
  return (data?.industry as Industry) || null;
}

// ============================================================================
// INDUSTRY-REQUIREMENT MAPPING (Admin)
// ============================================================================

/**
 * Add a requirement to an industry
 */
export async function addIndustryRequirement(
  industryId: string,
  requirementId: string,
  options?: { is_required?: boolean; notes?: string }
): Promise<void> {
  const { error } = await supabase
    .from('industry_compliance_requirements')
    .upsert({
      industry_id: industryId,
      requirement_id: requirementId,
      is_required: options?.is_required ?? true,
      notes: options?.notes
    });

  if (error) throw error;
}

/**
 * Remove a requirement from an industry
 */
export async function removeIndustryRequirement(
  industryId: string,
  requirementId: string
): Promise<void> {
  const { error } = await supabase
    .from('industry_compliance_requirements')
    .delete()
    .eq('industry_id', industryId)
    .eq('requirement_id', requirementId);

  if (error) throw error;
}

/**
 * Get industries that have a specific requirement
 */
export async function getIndustriesForRequirement(requirementId: string): Promise<Industry[]> {
  const { data, error } = await supabase
    .from('industry_compliance_requirements')
    .select('industry:industries(*)')
    .eq('requirement_id', requirementId);

  if (error) throw error;
  return (data?.map(d => d.industry) as Industry[]) || [];
}
