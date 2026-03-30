/**
 * CRUD operations for Programs management
 *
 * Tables:
 * - program_categories (top tier: Technology, Vendor, Equipment, etc.)
 * - programs (second tier: specific vendors/products)
 * - industry_programs (junction: industries → programs)
 * - program_compliance_topics (junction: programs → compliance topics)
 */

import { supabase } from '../supabase';

// ============================================================
// TYPES
// ============================================================

export interface ProgramCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Program {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  display_name: string | null;
  description: string | null;
  vendor_name: string | null;
  website_url: string | null;
  logo_url: string | null;
  sort_order: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Joined data
  category?: ProgramCategory;
}

export interface IndustryProgram {
  industry_id: string;
  program_id: string;
  is_common: boolean;
  market_share_tier: 'dominant' | 'major' | 'notable' | 'niche' | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  program?: Program;
  industry?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface ProgramComplianceTopic {
  program_id: string;
  topic_id: string;
  relationship_type: 'requires' | 'enables' | 'related';
  notes: string | null;
  created_at: string;
  // Joined data
  topic?: {
    id: string;
    name: string;
  };
  program?: Program;
}

// ============================================================
// PROGRAM CATEGORIES
// ============================================================

export async function getProgramCategories(): Promise<ProgramCategory[]> {
  const { data, error } = await supabase
    .from('program_categories')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw new Error(`Failed to fetch program categories: ${error.message}`);
  return data || [];
}

export async function getProgramCategory(id: string): Promise<ProgramCategory | null> {
  const { data, error } = await supabase
    .from('program_categories')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch program category: ${error.message}`);
  }
  return data;
}

export async function createProgramCategory(input: {
  name: string;
  slug: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
}): Promise<ProgramCategory> {
  const { data, error } = await supabase
    .from('program_categories')
    .insert({
      name: input.name,
      slug: input.slug,
      description: input.description || null,
      sort_order: input.sort_order ?? 0,
      is_active: input.is_active ?? true,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create program category: ${error.message}`);
  return data;
}

export async function updateProgramCategory(
  id: string,
  input: Partial<{
    name: string;
    slug: string;
    description: string | null;
    sort_order: number;
    is_active: boolean;
  }>
): Promise<ProgramCategory> {
  const { data, error } = await supabase
    .from('program_categories')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update program category: ${error.message}`);
  return data;
}

export async function deleteProgramCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from('program_categories')
    .delete()
    .eq('id', id);

  if (error) {
    // Check for foreign key constraint violation
    if (error.message.includes('foreign key constraint') || error.code === '23503') {
      throw new Error('Cannot delete this category because it has programs assigned. Please move or delete those programs first.');
    }
    throw new Error(`Failed to delete program category: ${error.message}`);
  }
}

/**
 * Get the count of programs in a category
 */
export async function getCategoryProgramCount(categoryId: string): Promise<number> {
  const { count, error } = await supabase
    .from('programs')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', categoryId);

  if (error) throw new Error(`Failed to count programs: ${error.message}`);
  return count || 0;
}

// ============================================================
// PROGRAMS
// ============================================================

export async function getPrograms(filters?: {
  categoryId?: string;
  isActive?: boolean;
  search?: string;
}): Promise<Program[]> {
  let query = supabase
    .from('programs')
    .select(`
      *,
      category:program_categories(*)
    `)
    .order('sort_order', { ascending: true });

  if (filters?.categoryId) {
    query = query.eq('category_id', filters.categoryId);
  }
  if (filters?.isActive !== undefined) {
    query = query.eq('is_active', filters.isActive);
  }
  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,vendor_name.ilike.%${filters.search}%,display_name.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to fetch programs: ${error.message}`);
  return data || [];
}

export async function getProgram(id: string): Promise<Program | null> {
  const { data, error } = await supabase
    .from('programs')
    .select(`
      *,
      category:program_categories(*)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch program: ${error.message}`);
  }
  return data;
}

export async function createProgram(input: {
  category_id: string;
  name: string;
  slug: string;
  display_name?: string;
  description?: string;
  vendor_name?: string;
  website_url?: string;
  logo_url?: string;
  sort_order?: number;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}): Promise<Program> {
  const { data, error } = await supabase
    .from('programs')
    .insert({
      category_id: input.category_id,
      name: input.name,
      slug: input.slug,
      display_name: input.display_name || null,
      description: input.description || null,
      vendor_name: input.vendor_name || null,
      website_url: input.website_url || null,
      logo_url: input.logo_url || null,
      sort_order: input.sort_order ?? 0,
      is_active: input.is_active ?? true,
      metadata: input.metadata || {},
    })
    .select(`
      *,
      category:program_categories(*)
    `)
    .single();

  if (error) throw new Error(`Failed to create program: ${error.message}`);
  return data;
}

export async function updateProgram(
  id: string,
  input: Partial<{
    category_id: string;
    name: string;
    slug: string;
    display_name: string | null;
    description: string | null;
    vendor_name: string | null;
    website_url: string | null;
    logo_url: string | null;
    sort_order: number;
    is_active: boolean;
    metadata: Record<string, unknown>;
  }>
): Promise<Program> {
  const { data, error } = await supabase
    .from('programs')
    .update(input)
    .eq('id', id)
    .select(`
      *,
      category:program_categories(*)
    `)
    .single();

  if (error) throw new Error(`Failed to update program: ${error.message}`);
  return data;
}

export async function deleteProgram(id: string): Promise<void> {
  const { error } = await supabase
    .from('programs')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete program: ${error.message}`);
}

// ============================================================
// INDUSTRY → PROGRAMS
// ============================================================

export async function getIndustryPrograms(industryId: string): Promise<IndustryProgram[]> {
  const { data, error } = await supabase
    .from('industry_programs')
    .select(`
      *,
      program:programs(
        *,
        category:program_categories(*)
      )
    `)
    .eq('industry_id', industryId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch industry programs: ${error.message}`);
  return data || [];
}

export async function getProgramIndustries(programId: string): Promise<IndustryProgram[]> {
  const { data, error } = await supabase
    .from('industry_programs')
    .select(`
      *,
      industry:industries(id, name, code)
    `)
    .eq('program_id', programId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch program industries: ${error.message}`);
  return data || [];
}

export async function addIndustryProgram(input: {
  industry_id: string;
  program_id: string;
  is_common?: boolean;
  market_share_tier?: 'dominant' | 'major' | 'notable' | 'niche';
  notes?: string;
}): Promise<IndustryProgram> {
  const { data, error } = await supabase
    .from('industry_programs')
    .insert({
      industry_id: input.industry_id,
      program_id: input.program_id,
      is_common: input.is_common ?? true,
      market_share_tier: input.market_share_tier || null,
      notes: input.notes || null,
    })
    .select(`
      *,
      program:programs(*),
      industry:industries(id, name, code)
    `)
    .single();

  if (error) throw new Error(`Failed to add industry program: ${error.message}`);
  return data;
}

export async function updateIndustryProgram(
  industryId: string,
  programId: string,
  input: Partial<{
    is_common: boolean;
    market_share_tier: 'dominant' | 'major' | 'notable' | 'niche' | null;
    notes: string | null;
  }>
): Promise<IndustryProgram> {
  const { data, error } = await supabase
    .from('industry_programs')
    .update(input)
    .eq('industry_id', industryId)
    .eq('program_id', programId)
    .select(`
      *,
      program:programs(*),
      industry:industries(id, name, code)
    `)
    .single();

  if (error) throw new Error(`Failed to update industry program: ${error.message}`);
  return data;
}

export async function removeIndustryProgram(industryId: string, programId: string): Promise<void> {
  const { error } = await supabase
    .from('industry_programs')
    .delete()
    .eq('industry_id', industryId)
    .eq('program_id', programId);

  if (error) throw new Error(`Failed to remove industry program: ${error.message}`);
}

export async function setIndustryPrograms(
  industryId: string,
  programIds: string[]
): Promise<void> {
  // Delete all existing
  const { error: deleteError } = await supabase
    .from('industry_programs')
    .delete()
    .eq('industry_id', industryId);

  if (deleteError) throw new Error(`Failed to clear industry programs: ${deleteError.message}`);

  // Insert new ones if any
  if (programIds.length > 0) {
    const { error: insertError } = await supabase
      .from('industry_programs')
      .insert(
        programIds.map(programId => ({
          industry_id: industryId,
          program_id: programId,
        }))
      );

    if (insertError) throw new Error(`Failed to set industry programs: ${insertError.message}`);
  }
}

// ============================================================
// PROGRAM → COMPLIANCE TOPICS
// ============================================================

export async function getProgramComplianceTopics(programId: string): Promise<ProgramComplianceTopic[]> {
  const { data, error } = await supabase
    .from('program_compliance_topics')
    .select(`
      *,
      topic:compliance_topics(id, name)
    `)
    .eq('program_id', programId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch program compliance topics: ${error.message}`);
  return data || [];
}

export async function addProgramComplianceTopic(input: {
  program_id: string;
  topic_id: string;
  relationship_type?: 'requires' | 'enables' | 'related';
  notes?: string;
}): Promise<ProgramComplianceTopic> {
  const { data, error } = await supabase
    .from('program_compliance_topics')
    .insert({
      program_id: input.program_id,
      topic_id: input.topic_id,
      relationship_type: input.relationship_type || 'related',
      notes: input.notes || null,
    })
    .select(`
      *,
      topic:compliance_topics(id, name)
    `)
    .single();

  if (error) throw new Error(`Failed to add program compliance topic: ${error.message}`);
  return data;
}

export async function removeProgramComplianceTopic(programId: string, topicId: string): Promise<void> {
  const { error } = await supabase
    .from('program_compliance_topics')
    .delete()
    .eq('program_id', programId)
    .eq('topic_id', topicId);

  if (error) throw new Error(`Failed to remove program compliance topic: ${error.message}`);
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Generate a URL-safe slug from a name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Get programs grouped by category
 */
export async function getProgramsByCategory(): Promise<Map<string, Program[]>> {
  const programs = await getPrograms({ isActive: true });
  const grouped = new Map<string, Program[]>();

  for (const program of programs) {
    const categoryName = program.category?.name || 'Uncategorized';
    if (!grouped.has(categoryName)) {
      grouped.set(categoryName, []);
    }
    grouped.get(categoryName)!.push(program);
  }

  return grouped;
}

/**
 * Get all programs for an industry with full details
 */
export async function getIndustryProgramsWithDetails(industryId: string): Promise<{
  category: ProgramCategory;
  programs: (Program & { industryRelation: IndustryProgram })[];
}[]> {
  const industryPrograms = await getIndustryPrograms(industryId);
  const categories = await getProgramCategories();

  // Group by category
  const grouped = new Map<string, (Program & { industryRelation: IndustryProgram })[]>();

  for (const ip of industryPrograms) {
    if (!ip.program) continue;
    const categoryId = ip.program.category_id;
    if (!grouped.has(categoryId)) {
      grouped.set(categoryId, []);
    }
    grouped.get(categoryId)!.push({
      ...ip.program,
      industryRelation: ip,
    });
  }

  // Build result with category objects
  const result: {
    category: ProgramCategory;
    programs: (Program & { industryRelation: IndustryProgram })[];
  }[] = [];

  for (const category of categories) {
    const programs = grouped.get(category.id);
    if (programs && programs.length > 0) {
      result.push({ category, programs });
    }
  }

  return result;
}
