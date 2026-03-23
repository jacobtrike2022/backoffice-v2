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

// ============================================================================
// INDUSTRY → COMPLIANCE TOPICS (Direct Association)
// ============================================================================

export interface IndustryComplianceTopic {
  industry_id: string;
  topic_id: string;
  is_typical: boolean;
  priority: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  topic?: {
    id: string;
    name: string;
    description: string | null;
  };
}

/**
 * Get compliance topics directly associated with an industry
 * (For onboarding suggestions, before specific state requirements)
 */
export async function getIndustryComplianceTopics(industryId: string): Promise<IndustryComplianceTopic[]> {
  const { data, error } = await supabase
    .from('industry_compliance_topics')
    .select(`
      *,
      topic:compliance_topics(id, name, description)
    `)
    .eq('industry_id', industryId)
    .order('priority', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get all industries that have a specific compliance topic
 */
export async function getIndustriesForComplianceTopic(topicId: string): Promise<Industry[]> {
  const { data, error } = await supabase
    .from('industry_compliance_topics')
    .select('industry:industries(*)')
    .eq('topic_id', topicId);

  if (error) throw error;
  return (data?.map(d => d.industry) as Industry[]) || [];
}

/**
 * Add a compliance topic to an industry
 */
export async function addIndustryComplianceTopic(input: {
  industry_id: string;
  topic_id: string;
  is_typical?: boolean;
  priority?: number;
  notes?: string;
}): Promise<IndustryComplianceTopic> {
  const { data, error } = await supabase
    .from('industry_compliance_topics')
    .insert({
      industry_id: input.industry_id,
      topic_id: input.topic_id,
      is_typical: input.is_typical ?? true,
      priority: input.priority ?? 0,
      notes: input.notes || null,
    })
    .select(`
      *,
      topic:compliance_topics(id, name, description)
    `)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update an industry compliance topic association
 */
export async function updateIndustryComplianceTopic(
  industryId: string,
  topicId: string,
  input: Partial<{
    is_typical: boolean;
    priority: number;
    notes: string | null;
  }>
): Promise<IndustryComplianceTopic> {
  const { data, error } = await supabase
    .from('industry_compliance_topics')
    .update(input)
    .eq('industry_id', industryId)
    .eq('topic_id', topicId)
    .select(`
      *,
      topic:compliance_topics(id, name, description)
    `)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Remove a compliance topic from an industry
 */
export async function removeIndustryComplianceTopic(industryId: string, topicId: string): Promise<void> {
  const { error } = await supabase
    .from('industry_compliance_topics')
    .delete()
    .eq('industry_id', industryId)
    .eq('topic_id', topicId);

  if (error) throw error;
}

/**
 * Set all compliance topics for an industry (replaces existing)
 */
export async function setIndustryComplianceTopics(
  industryId: string,
  topicIds: string[]
): Promise<void> {
  // Delete all existing
  const { error: deleteError } = await supabase
    .from('industry_compliance_topics')
    .delete()
    .eq('industry_id', industryId);

  if (deleteError) throw deleteError;

  // Insert new ones if any
  if (topicIds.length > 0) {
    const { error: insertError } = await supabase
      .from('industry_compliance_topics')
      .insert(
        topicIds.map((topicId, index) => ({
          industry_id: industryId,
          topic_id: topicId,
          priority: index,
        }))
      );

    if (insertError) throw insertError;
  }
}

/**
 * Get an industry with all its relationships (topics, programs, requirements)
 */
export async function getIndustryWithRelationships(industryId: string): Promise<{
  industry: Industry;
  complianceTopics: IndustryComplianceTopic[];
  requirements: IndustryRequirement[];
} | null> {
  const industry = await getIndustry(industryId);
  if (!industry) return null;

  const [complianceTopics, requirements] = await Promise.all([
    getIndustryComplianceTopics(industryId),
    getIndustryRequirements(industryId),
  ]);

  return { industry, complianceTopics, requirements };
}
