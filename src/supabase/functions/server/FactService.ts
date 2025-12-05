import { createClient } from "npm:@supabase/supabase-js@2.39.3";

// =====================================================
// TYPES
// =====================================================

export type FactSpecificity = 'universal' | 'sector' | 'industry' | 'program' | 'state' | 'company' | 'unit';
export type FactType = 'Fact' | 'Procedure';
export type TrackType = 'article' | 'video' | 'story' | 'checkpoint';
export type ConflictReason = 'state-override' | 'company-policy' | 'outdated' | 'contradictory';
export type ConflictResolution = 'defer-to-company' | 'defer-to-state' | 'needs-review';

export interface FactContext {
  specificity: FactSpecificity;
  tags: {
    sector?: string;
    industry?: string;
    program?: string;
    state?: string;
    company?: string;
    unit?: string;
  };
}

export interface FactConflict {
  id?: string;
  factId: string;
  conflictingFactId: string; // Renamed from factId to match DB structure slightly better, but mapped back
  reason: ConflictReason;
  resolution?: ConflictResolution;
  detectedAt: string;
}

export interface FactUsage {
  id?: string;
  factId: string;
  type: TrackType;
  trackId: string;
  addedAt: string;
  // NEW: Media source tracking for composability
  sourceMediaId?: string;      // The slide/video ID within the story/track
  sourceMediaUrl?: string;      // The actual media file URL (for cross-track reusability)
  sourceMediaType?: 'image' | 'video';
  displayOrder?: number;        // Order within the track (for auto-sorting)
}

export interface FactChangeHistoryEntry {
  version: number;
  changedAt: string;
  changedBy: string;
  reason: string;
  previousContent: string;
}

export interface ExternalSource {
  type: 'fda-food-code' | 'justia-law' | 'osha-regulation' | 'custom';
  sourceId: string;
  lastSynced: string;
  url?: string;
}

export interface KeyFact {
  id: string;
  title: string;
  content: string;
  type: FactType;
  steps?: string[];
  
  context: FactContext;
  
  sourceId?: string;
  sourceSection?: string;
  sourcePage?: number;
  extractedBy: 'ai-pass-1' | 'ai-pass-2' | 'manual' | 'imported';
  extractionConfidence?: number;
  
  relatedFacts: string[]; // IDs
  prerequisiteFacts: string[]; // IDs
  conflictsWith: FactConflict[]; // Populated from join
  supersedes?: string[];
  supersededBy?: string;
  
  usedIn: FactUsage[]; // Populated from join
  
  views: number;
  effectiveness?: number;
  needsReview: boolean;
  lastVerified?: string;
  verifiedBy?: string;
  
  externalSource?: ExternalSource;
  companyId?: string;
  
  createdAt: string;
  updatedAt: string;
  version: number;
  changeHistory: FactChangeHistoryEntry[];
}

export interface CreateFactInput {
  title: string;
  content: string;
  type: FactType;
  steps?: string[];
  context?: Partial<FactContext>;
  sourceId?: string;
  sourceSection?: string;
  sourcePage?: number;
  extractedBy?: KeyFact['extractedBy'];
  extractionConfidence?: number;
  companyId?: string;
  externalSource?: ExternalSource;
}

export interface UpdateFactInput {
  title?: string;
  content?: string;
  type?: FactType;
  steps?: string[];
  context?: Partial<FactContext>;
  needsReview?: boolean;
  changedBy: string;
  changeReason: string;
}

// Initialize Supabase Client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// =====================================================
// FACT CRUD OPERATIONS
// =====================================================

/**
 * Create a new fact
 */
export async function createFact(input: CreateFactInput): Promise<KeyFact> {
  const context: FactContext = {
    specificity: input.context?.specificity || 'universal',
    tags: input.context?.tags || {},
  };

  const { data, error } = await supabase
    .from('facts')
    .insert({
      title: input.title,
      content: input.content,
      type: input.type,
      steps: input.steps || [],
      context: context,
      source_id: input.sourceId,
      source_section: input.sourceSection,
      source_page: input.sourcePage,
      extracted_by: input.extractedBy || 'manual',
      extraction_confidence: input.extractionConfidence,
      company_id: input.companyId,
      external_source: input.externalSource,
      needs_review: false,
      views: 0,
      version: 1,
      change_history: [],
      related_facts: [],
      prerequisite_facts: [],
      supersedes: [],
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating fact:', error);
    throw new Error(`Failed to create fact: ${error.message}`);
  }

  return mapDbToFact(data, [], []);
}

/**
 * Get a fact by ID with all relationships
 */
export async function getFact(id: string): Promise<KeyFact | null> {
  // Fetch fact
  const { data: fact, error } = await supabase
    .from('facts')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !fact) return null;

  // Fetch usage
  const { data: usage } = await supabase
    .from('fact_usage')
    .select('*')
    .eq('fact_id', id);

  // Fetch conflicts
  const { data: conflicts } = await supabase
    .from('fact_conflicts')
    .select('*')
    .eq('fact_id', id);

  return mapDbToFact(fact, usage || [], conflicts || []);
}

/**
 * Update a fact
 */
export async function updateFact(id: string, updates: UpdateFactInput): Promise<KeyFact> {
  const existing = await getFact(id);
  if (!existing) {
    throw new Error(`Fact ${id} not found`);
  }

  const historyEntry: FactChangeHistoryEntry = {
    version: existing.version,
    changedAt: new Date().toISOString(),
    changedBy: updates.changedBy,
    reason: updates.changeReason,
    previousContent: existing.content,
  };

  const updatePayload: any = {
    updated_at: new Date().toISOString(),
    version: existing.version + 1,
    change_history: [...existing.changeHistory, historyEntry],
  };

  if (updates.title !== undefined) updatePayload.title = updates.title;
  if (updates.content !== undefined) updatePayload.content = updates.content;
  if (updates.type !== undefined) updatePayload.type = updates.type;
  if (updates.steps !== undefined) updatePayload.steps = updates.steps;
  if (updates.needsReview !== undefined) updatePayload.needs_review = updates.needsReview;
  
  if (updates.context) {
    updatePayload.context = {
      specificity: updates.context.specificity ?? existing.context.specificity,
      tags: { ...existing.context.tags, ...updates.context.tags },
    };
  }

  const { data, error } = await supabase
    .from('facts')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update fact: ${error.message}`);
  }

  // Re-fetch to get complete object with relations
  const updated = await getFact(id);
  if (!updated) throw new Error('Fact not found after update');
  
  return updated;
}

/**
 * Delete a fact
 */
export async function deleteFact(id: string): Promise<void> {
  const { error } = await supabase
    .from('facts')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete fact: ${error.message}`);
  }
}

// =====================================================
// QUERY OPERATIONS
// =====================================================

export async function getFactsByContext(filters: {
  specificity?: FactSpecificity;
  sector?: string;
  industry?: string;
  program?: string;
  state?: string;
  company?: string;
  unit?: string;
}): Promise<KeyFact[]> {
  let query = supabase.from('facts').select('*');

  if (filters.specificity) {
    query = query.eq('context->>specificity', filters.specificity);
  }
  if (filters.sector) {
    query = query.eq('context->tags->>sector', filters.sector);
  }
  if (filters.industry) {
    query = query.eq('context->tags->>industry', filters.industry);
  }
  if (filters.program) {
    query = query.eq('context->tags->>program', filters.program);
  }
  if (filters.state) {
    query = query.eq('context->tags->>state', filters.state);
  }
  if (filters.company) {
    query = query.eq('context->tags->>company', filters.company);
  }
  if (filters.unit) {
    query = query.eq('context->tags->>unit', filters.unit);
  }

  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching facts by context:', error);
    return [];
  }

  return Promise.all((data || []).map(async (fact) => {
     // Optimization: Only fetch relations if needed, or do a separate join query?
     // For now, doing simplistic fetch to match interface. 
     // In production, you'd want to join these or load them lazily.
     // I'll return them without extra relations for list views to be fast,
     // unless critical. The KV store implementation returned full objects.
     return mapDbToFact(fact, [], []);
  }));
}

export async function getFactsBySource(sourceId: string): Promise<KeyFact[]> {
  const { data, error } = await supabase
    .from('facts')
    .select('*')
    .eq('source_id', sourceId);

  if (error) return [];
  return (data || []).map(f => mapDbToFact(f, [], []));
}

export async function getFactsWithConflicts(): Promise<KeyFact[]> {
  // Get IDs from conflict table
  const { data: conflicts } = await supabase
    .from('fact_conflicts')
    .select('fact_id');

  if (!conflicts?.length) return [];

  const ids = [...new Set(conflicts.map(c => c.fact_id))];
  
  const { data: facts } = await supabase
    .from('facts')
    .select('*')
    .in('id', ids);

  // We should populate the conflict details
  // Fetch all conflicts for these facts
  const { data: conflictDetails } = await supabase
    .from('fact_conflicts')
    .select('*')
    .in('fact_id', ids);

  return (facts || []).map(f => {
    const myConflicts = conflictDetails?.filter(c => c.fact_id === f.id) || [];
    return mapDbToFact(f, [], myConflicts);
  });
}

// =====================================================
// USAGE TRACKING
// =====================================================

export async function trackFactUsage(factId: string, usage: FactUsage): Promise<void> {
  const { error } = await supabase
    .from('fact_usage')
    .upsert({
      fact_id: factId,
      track_type: usage.type,
      track_id: usage.trackId,
      added_at: usage.addedAt || new Date().toISOString(),
      source_media_id: usage.sourceMediaId,
      source_media_url: usage.sourceMediaUrl,
      source_media_type: usage.sourceMediaType,
      display_order: usage.displayOrder
    }, { onConflict: 'fact_id, track_type, track_id' });

  if (error) {
    console.error('Error tracking usage:', error);
  }
}

export async function removeFactUsage(factId: string, trackType: TrackType, trackId: string): Promise<void> {
  await supabase
    .from('fact_usage')
    .delete()
    .match({ fact_id: factId, track_type: trackType, track_id: trackId });
}

export async function getFactsForTrack(trackType: TrackType, trackId: string): Promise<KeyFact[]> {
  // Get fact usages WITH media source metadata
  const { data: usages } = await supabase
    .from('fact_usage')
    .select('fact_id, source_media_id, source_media_url, source_media_type, display_order')
    .eq('track_type', trackType)
    .eq('track_id', trackId);

  if (!usages?.length) return [];

  const ids = usages.map(u => u.fact_id);
  
  const { data: facts } = await supabase
    .from('facts')
    .select('*')
    .in('id', ids);

  // Map facts and attach usage metadata
  return (facts || []).map(f => {
    const usage = usages.find(u => u.fact_id === f.id);
    const mappedFact = mapDbToFact(f, [], []);
    
    // Attach usage metadata for client-side grouping
    return {
      ...mappedFact,
      usage: usage ? [usage] : []
    };
  });
}

// =====================================================
// CONFLICT DETECTION
// =====================================================

export async function markConflict(factId: string, conflict: FactConflict): Promise<void> {
  const { error } = await supabase
    .from('fact_conflicts')
    .upsert({
      fact_id: factId,
      conflicting_fact_id: conflict.conflictingFactId || conflict.factId, // Handle mapping
      reason: conflict.reason,
      resolution: conflict.resolution,
      detected_at: conflict.detectedAt || new Date().toISOString()
    }, { onConflict: 'fact_id, conflicting_fact_id' });

  if (error) {
    console.error('Error marking conflict:', error);
    return;
  }

  // Mark fact as needing review
  await supabase
    .from('facts')
    .update({ needs_review: true })
    .eq('id', factId);
}

// =====================================================
// HELPERS
// =====================================================

function mapDbToFact(
  dbFact: any, 
  usage: any[], 
  conflicts: any[]
): KeyFact {
  return {
    id: dbFact.id,
    title: dbFact.title,
    content: dbFact.content,
    type: dbFact.type as FactType,
    steps: dbFact.steps,
    context: dbFact.context,
    sourceId: dbFact.source_id,
    sourceSection: dbFact.source_section,
    sourcePage: dbFact.source_page,
    extractedBy: dbFact.extracted_by,
    extractionConfidence: dbFact.extraction_confidence,
    
    relatedFacts: dbFact.related_facts || [],
    prerequisiteFacts: dbFact.prerequisite_facts || [],
    supersedes: dbFact.supersedes || [],
    supersededBy: dbFact.superseded_by,
    
    // Map relations
    usedIn: usage.map(u => ({
      id: u.id,
      factId: u.fact_id,
      type: u.track_type as TrackType,
      trackId: u.track_id,
      addedAt: u.added_at,
      sourceMediaId: u.source_media_id,
      sourceMediaUrl: u.source_media_url,
      sourceMediaType: u.source_media_type,
      displayOrder: u.display_order
    })),
    
    conflictsWith: conflicts.map(c => ({
      id: c.id,
      factId: c.fact_id,
      conflictingFactId: c.conflicting_fact_id,
      reason: c.reason as ConflictReason,
      resolution: c.resolution as ConflictResolution,
      detectedAt: c.detected_at
    })),
    
    views: dbFact.views || 0,
    needsReview: dbFact.needs_review,
    lastVerified: dbFact.last_verified,
    verifiedBy: dbFact.verified_by,
    
    externalSource: dbFact.external_source,
    companyId: dbFact.company_id,
    
    createdAt: dbFact.created_at,
    updatedAt: dbFact.updated_at,
    version: dbFact.version,
    changeHistory: dbFact.change_history || [],
  };
}