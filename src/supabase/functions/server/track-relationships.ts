// ============================================================================
// TRACK RELATIONSHIPS - Server-side operations
// ============================================================================
// Handles the track_relationships table for tracking content derivation,
// prerequisites, and other relationships between tracks.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

export interface VariantContext {
  // Geographic
  state_code?: string;
  state_name?: string;

  // Company
  org_id?: string;
  org_name?: string;

  // Unit
  store_id?: string;
  store_name?: string;

  // Lineage tracking
  parent_variant_id?: string;  // Immediate parent if chained
  lineage?: string[];          // [base_id, parent_variant_id, ...]

  // Sync tracking
  base_synced_at?: string;     // ISO timestamp when variant was last synced with base
}

export type VariantType = 'geographic' | 'company' | 'unit';

export interface TrackRelationship {
  id: string;
  source_track_id: string;
  derived_track_id: string;
  relationship_type: 'source' | 'prerequisite' | 'related' | 'variant';
  variant_type?: VariantType | null;
  variant_context?: VariantContext | null;
  created_at: string;
  // Joined data (optional)
  source_track?: {
    id: string;
    title: string;
    type: string;
    thumbnail_url: string;
    status: string;
    updated_at?: string;  // For base update detection
  };
  derived_track?: {
    id: string;
    title: string;
    type: string;
    thumbnail_url: string;
    status: string;
  };
}

/**
 * Create a relationship between tracks
 */
export async function createTrackRelationship(
  orgId: string,
  sourceTrackId: string,
  derivedTrackId: string,
  relationshipType: 'source' | 'prerequisite' | 'related' = 'source'
): Promise<TrackRelationship> {
  console.log('📎 Creating track relationship:', {
    sourceTrackId,
    derivedTrackId,
    relationshipType
  });

  const { data, error } = await supabase
    .from('track_relationships')
    .insert({
      organization_id: orgId,
      source_track_id: sourceTrackId,
      derived_track_id: derivedTrackId,
      relationship_type: relationshipType
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Error creating track relationship:', error);
    throw error;
  }

  console.log('✅ Track relationship created:', data.id);
  return data;
}

/**
 * Get all tracks derived from a source track (children)
 */
export async function getDerivedTracks(
  orgId: string,
  sourceTrackId: string,
  relationshipType?: 'source' | 'prerequisite' | 'related'
): Promise<TrackRelationship[]> {
  console.log('🔍 Fetching derived tracks:', { orgId, sourceTrackId, relationshipType });
  
  let query = supabase
    .from('track_relationships')
    .select(`
      id,
      source_track_id,
      derived_track_id,
      relationship_type,
      created_at,
      derived_track:tracks!derived_track_id(
        id,
        title,
        type,
        thumbnail_url,
        status
      )
    `)
    .eq('organization_id', orgId)
    .eq('source_track_id', sourceTrackId);

  if (relationshipType) {
    query = query.eq('relationship_type', relationshipType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('❌ Error fetching derived tracks:', error);
    throw error;
  }

  console.log('📊 Derived tracks query result:', { 
    count: data?.length || 0, 
    hasData: !!data,
    sample: data?.[0] 
  });

  // If join didn't work (derived_track is null), fetch tracks separately
  const relationships = data || [];
  const needsFallback = relationships.some((rel: any) => !rel.derived_track && rel.derived_track_id);
  
  if (needsFallback && relationships.length > 0) {
    console.log('⚠️ Join returned null tracks, fetching separately...');
    const trackIds = relationships.map((rel: any) => rel.derived_track_id).filter(Boolean);
    
    if (trackIds.length > 0) {
      const { data: tracks, error: tracksError } = await supabase
        .from('tracks')
        .select('id, title, type, thumbnail_url, status')
        .in('id', trackIds)
        .eq('organization_id', orgId);

      if (!tracksError && tracks) {
        const trackMap = new Map(tracks.map((t: any) => [t.id, t]));
        relationships.forEach((rel: any) => {
          if (rel.derived_track_id && !rel.derived_track) {
            rel.derived_track = trackMap.get(rel.derived_track_id);
          }
        });
        console.log('✅ Fetched tracks separately and merged');
      }
    }
  }

  return relationships;
}

/**
 * Get the source track for a derived track (parent)
 */
export async function getSourceTrack(
  orgId: string,
  derivedTrackId: string,
  relationshipType?: 'source' | 'prerequisite' | 'related'
): Promise<TrackRelationship | null> {
  console.log('🔍 Fetching source track:', { orgId, derivedTrackId, relationshipType });
  
  let query = supabase
    .from('track_relationships')
    .select(`
      id,
      source_track_id,
      derived_track_id,
      relationship_type,
      created_at,
      source_track:tracks!source_track_id(
        id,
        title,
        type,
        thumbnail_url,
        status
      )
    `)
    .eq('organization_id', orgId)
    .eq('derived_track_id', derivedTrackId);

  if (relationshipType) {
    query = query.eq('relationship_type', relationshipType);
  }

  const { data, error } = await query.single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      console.log('📊 No source track found for derived track');
      return null;
    }
    console.error('❌ Error fetching source track:', error);
    throw error;
  }

  console.log('📊 Source track query result:', { 
    hasData: !!data,
    hasSourceTrack: !!data?.source_track,
    sourceTrackId: data?.source_track_id
  });

  // If join didn't work (source_track is null), fetch track separately
  if (data && !data.source_track && data.source_track_id) {
    console.log('⚠️ Join returned null track, fetching separately...');
    const { data: track, error: trackError } = await supabase
      .from('tracks')
      .select('id, title, type, thumbnail_url, status')
      .eq('id', data.source_track_id)
      .eq('organization_id', orgId)
      .single();

    if (!trackError && track) {
      data.source_track = track;
      console.log('✅ Fetched source track separately and merged');
    }
  }

  return data;
}

/**
 * Delete a track relationship
 */
export async function deleteTrackRelationship(
  orgId: string,
  relationshipId: string
): Promise<void> {
  const { error } = await supabase
    .from('track_relationships')
    .delete()
    .eq('id', relationshipId)
    .eq('organization_id', orgId);

  if (error) {
    console.error('❌ Error deleting track relationship:', error);
    throw error;
  }

  console.log('✅ Track relationship deleted:', relationshipId);
}

/**
 * Delete all relationships for a track (when deleting the track)
 */
export async function deleteTrackRelationships(
  orgId: string,
  trackId: string
): Promise<void> {
  const { error } = await supabase
    .from('track_relationships')
    .delete()
    .eq('organization_id', orgId)
    .or(`source_track_id.eq.${trackId},derived_track_id.eq.${trackId}`);

  if (error) {
    console.error('❌ Error deleting track relationships:', error);
    throw error;
  }

  console.log('✅ All relationships deleted for track:', trackId);
}

/**
 * Get relationship statistics for a track
 */
export async function getTrackRelationshipStats(
  orgId: string,
  trackId: string
): Promise<{
  derivedCount: number;
  sourceCount: number;
  hasDerivedCheckpoints: boolean;
  derived: TrackRelationship[];
}> {
  console.log('🔍 Fetching relationship stats:', { orgId, trackId });
  
  // Get derived tracks (where this is the source)
  const { data: derivedData, error: derivedError } = await supabase
    .from('track_relationships')
    .select(`
      id,
      source_track_id,
      derived_track_id,
      relationship_type,
      created_at,
      derived_track:tracks!derived_track_id(
        id,
        title,
        type,
        thumbnail_url,
        status
      )
    `)
    .eq('organization_id', orgId)
    .eq('source_track_id', trackId)
    .eq('relationship_type', 'source');

  if (derivedError) {
    console.error('❌ Error fetching derived track stats:', derivedError);
    throw derivedError;
  }

  console.log('📊 Derived tracks stats query result:', { 
    count: derivedData?.length || 0,
    hasData: !!derivedData,
    sample: derivedData?.[0]
  });

  // If join didn't work (derived_track is null), fetch tracks separately
  const relationships = derivedData || [];
  const needsFallback = relationships.some((rel: any) => !rel.derived_track && rel.derived_track_id);
  
  if (needsFallback && relationships.length > 0) {
    console.log('⚠️ Join returned null tracks in stats, fetching separately...');
    const trackIds = relationships.map((rel: any) => rel.derived_track_id).filter(Boolean);
    
    if (trackIds.length > 0) {
      const { data: tracks, error: tracksError } = await supabase
        .from('tracks')
        .select('id, title, type, thumbnail_url, status')
        .in('id', trackIds)
        .eq('organization_id', orgId);

      if (!tracksError && tracks) {
        const trackMap = new Map(tracks.map((t: any) => [t.id, t]));
        relationships.forEach((rel: any) => {
          if (rel.derived_track_id && !rel.derived_track) {
            rel.derived_track = trackMap.get(rel.derived_track_id);
          }
        });
        console.log('✅ Fetched tracks separately and merged in stats');
      }
    }
  }

  // Get source tracks (where this is derived)
  const { count: sourceCount, error: sourceError } = await supabase
    .from('track_relationships')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('derived_track_id', trackId);

  if (sourceError) {
    console.error('❌ Error fetching source track stats:', sourceError);
    throw sourceError;
  }

  const hasDerivedCheckpoints = relationships.some(
    (rel: any) => rel.derived_track?.type === 'checkpoint'
  );

  console.log('📊 Final stats:', {
    derivedCount: relationships.length,
    sourceCount: sourceCount || 0,
    hasDerivedCheckpoints
  });

  return {
    derivedCount: relationships.length,
    sourceCount: sourceCount || 0,
    hasDerivedCheckpoints,
    derived: relationships
  };
}

/**
 * Get relationship counts and details for multiple tracks (batch operation)
 */
export async function getBatchTrackRelationships(
  orgId: string,
  trackIds: string[]
): Promise<Record<string, {
  derivedCount: number;
  derivedTracks: Array<{
    id: string;
    title: string;
    type: string;
    relationship_type: string;
  }>;
}>> {
  console.log('🔍 Fetching batch track relationships:', { orgId, trackCount: trackIds.length });
  
  const { data, error } = await supabase
    .from('track_relationships')
    .select(`
      source_track_id,
      relationship_type,
      derived_track_id,
      derived_track:tracks!derived_track_id(
        id,
        title,
        type
      )
    `)
    .eq('organization_id', orgId)
    .in('source_track_id', trackIds);

  if (error) {
    console.error('❌ Error fetching batch track relationships:', error);
    throw error;
  }

  console.log('📊 Batch relationships query result:', { 
    count: data?.length || 0,
    hasData: !!data,
    sample: data?.[0]
  });

  // If join didn't work (derived_track is null), fetch tracks separately
  const relationships = data || [];
  const needsFallback = relationships.some((rel: any) => !rel.derived_track && rel.derived_track_id);
  
  if (needsFallback && relationships.length > 0) {
    console.log('⚠️ Join returned null tracks in batch, fetching separately...');
    const trackIdsToFetch = relationships
      .map((rel: any) => rel.derived_track_id)
      .filter(Boolean)
      .filter((id: string, index: number, arr: string[]) => arr.indexOf(id) === index); // unique
    
    if (trackIdsToFetch.length > 0) {
      const { data: tracks, error: tracksError } = await supabase
        .from('tracks')
        .select('id, title, type')
        .in('id', trackIdsToFetch)
        .eq('organization_id', orgId);

      if (!tracksError && tracks) {
        const trackMap = new Map(tracks.map((t: any) => [t.id, t]));
        relationships.forEach((rel: any) => {
          if (rel.derived_track_id && !rel.derived_track) {
            rel.derived_track = trackMap.get(rel.derived_track_id);
          }
        });
        console.log('✅ Fetched tracks separately and merged in batch');
      }
    }
  }

  // Initialize result for all requested tracks
  const result: Record<string, any> = {};
  for (const trackId of trackIds) {
    result[trackId] = {
      derivedCount: 0,
      derivedTracks: []
    };
  }

  // Group by source track
  for (const rel of relationships) {
    if (rel.derived_track) {
      result[rel.source_track_id].derivedCount++;
      result[rel.source_track_id].derivedTracks.push({
        id: rel.derived_track.id,
        title: rel.derived_track.title,
        type: rel.derived_track.type,
        relationship_type: rel.relationship_type
      });
    }
  }

  console.log('📊 Batch result summary:', {
    tracksWithRelationships: Object.values(result).filter((r: any) => r.derivedCount > 0).length
  });

  return result;
}

// ============================================================================
// VARIANT RELATIONSHIP FUNCTIONS
// ============================================================================

/**
 * Helper to get context key for uniqueness check based on variant type
 */
function getContextKeyForVariantType(variantType: VariantType): string {
  switch (variantType) {
    case 'geographic':
      return 'state_code';
    case 'company':
      return 'org_id';
    case 'unit':
      return 'store_id';
  }
}

/**
 * Helper to get human-readable context name for error messages
 */
function getContextDisplayName(variantType: VariantType, context: VariantContext): string {
  switch (variantType) {
    case 'geographic':
      return context.state_name || context.state_code || 'this state';
    case 'company':
      return context.org_name || 'this organization';
    case 'unit':
      return context.store_name || 'this store';
  }
}

/**
 * Create a variant relationship with validation
 * Enforces: uniqueness, valid chaining, max depth (3)
 */
export async function createVariantRelationship(
  orgId: string,
  sourceTrackId: string,
  derivedTrackId: string,
  variantType: VariantType,
  variantContext: VariantContext
): Promise<TrackRelationship> {
  console.log('📎 Creating variant relationship:', {
    sourceTrackId,
    derivedTrackId,
    variantType,
    variantContext
  });

  // VALIDATION 1: Validate variant type
  const validTypes: VariantType[] = ['geographic', 'company', 'unit'];
  if (!validTypes.includes(variantType)) {
    throw new Error('Invalid variant type. Allowed: geographic, company, unit');
  }

  // VALIDATION 2: Check uniqueness - no duplicate variants with same context
  const contextKey = getContextKeyForVariantType(variantType);
  const contextValue = variantContext[contextKey as keyof VariantContext];

  if (contextValue) {
    const existingVariant = await findVariantByContext(
      orgId,
      sourceTrackId,
      variantType,
      contextKey,
      String(contextValue)
    );

    if (existingVariant) {
      const displayName = getContextDisplayName(variantType, variantContext);
      throw new Error(`A ${variantType} variant for ${displayName} already exists for this track`);
    }
  }

  // VALIDATION 3: Check valid chaining rules
  // Get the source track's variant relationship (if it's a variant itself)
  const { data: sourceVariantRel } = await supabase
    .from('track_relationships')
    .select('variant_type, variant_context')
    .eq('organization_id', orgId)
    .eq('derived_track_id', sourceTrackId)
    .eq('relationship_type', 'variant')
    .single();

  // Determine if source is a base track or a variant
  const sourceIsVariant = !!sourceVariantRel;
  const sourceVariantType = sourceVariantRel?.variant_type as VariantType | null;
  const sourceContext = sourceVariantRel?.variant_context as VariantContext | null;

  // Chaining rules:
  // - geographic: only from base track (source has no variant relationship)
  // - company: from base OR geographic
  // - unit: from base, geographic, OR company
  if (sourceIsVariant) {
    switch (variantType) {
      case 'geographic':
        throw new Error('Geographic variants can only be created from base tracks, not from other variants');
      case 'company':
        if (sourceVariantType !== 'geographic') {
          throw new Error('Company variants can only be created from base tracks or geographic variants');
        }
        break;
      case 'unit':
        if (sourceVariantType !== 'geographic' && sourceVariantType !== 'company') {
          throw new Error('Unit variants can only be created from base tracks, geographic variants, or company variants');
        }
        break;
    }
  }

  // VALIDATION 4: Check max depth (3)
  const existingLineage = sourceContext?.lineage || [];
  if (existingLineage.length >= 3) {
    throw new Error('Maximum variant depth (3) exceeded. Cannot create variant of a variant of a variant of a variant.');
  }

  // BUILD lineage array
  let newLineage: string[];
  if (sourceIsVariant && sourceContext) {
    // Source is a variant - extend its lineage
    newLineage = [...(sourceContext.lineage || []), sourceTrackId];
  } else {
    // Source is base track - start new lineage
    newLineage = [sourceTrackId];
  }

  // GET source track's updated_at for base_synced_at
  const { data: sourceTrack } = await supabase
    .from('tracks')
    .select('updated_at')
    .eq('id', sourceTrackId)
    .eq('organization_id', orgId)
    .single();

  // BUILD final variant context with lineage and sync tracking
  const finalContext: VariantContext = {
    ...variantContext,
    lineage: newLineage,
    base_synced_at: sourceTrack?.updated_at || new Date().toISOString(),
  };

  // If chaining from a variant, record the parent variant ID
  if (sourceIsVariant) {
    finalContext.parent_variant_id = sourceTrackId;
  }

  // INSERT with all context
  const { data, error } = await supabase
    .from('track_relationships')
    .insert({
      organization_id: orgId,
      source_track_id: sourceTrackId,
      derived_track_id: derivedTrackId,
      relationship_type: 'variant',
      variant_type: variantType,
      variant_context: finalContext
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating variant relationship:', error);
    throw error;
  }

  console.log('Variant relationship created:', data.id);
  return data;
}

/**
 * Get all variants of a track
 */
export async function getTrackVariants(
  orgId: string,
  trackId: string,
  variantType?: VariantType
): Promise<TrackRelationship[]> {
  console.log('🔍 Fetching track variants:', { orgId, trackId, variantType });

  let query = supabase
    .from('track_relationships')
    .select(`
      id,
      source_track_id,
      derived_track_id,
      relationship_type,
      variant_type,
      variant_context,
      created_at,
      derived_track:tracks!derived_track_id(
        id,
        title,
        type,
        thumbnail_url,
        status
      )
    `)
    .eq('organization_id', orgId)
    .eq('source_track_id', trackId)
    .eq('relationship_type', 'variant');

  if (variantType) {
    query = query.eq('variant_type', variantType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('❌ Error fetching track variants:', error);
    throw error;
  }

  console.log('📊 Track variants query result:', {
    count: data?.length || 0,
    hasData: !!data,
    sample: data?.[0]
  });

  // If join didn't work (derived_track is null), fetch tracks separately
  const relationships = data || [];
  const needsFallback = relationships.some((rel: any) => !rel.derived_track && rel.derived_track_id);

  if (needsFallback && relationships.length > 0) {
    console.log('⚠️ Join returned null tracks, fetching separately...');
    const trackIds = relationships.map((rel: any) => rel.derived_track_id).filter(Boolean);

    if (trackIds.length > 0) {
      const { data: tracks, error: tracksError } = await supabase
        .from('tracks')
        .select('id, title, type, thumbnail_url, status')
        .in('id', trackIds)
        .eq('organization_id', orgId);

      if (!tracksError && tracks) {
        const trackMap = new Map(tracks.map((t: any) => [t.id, t]));
        relationships.forEach((rel: any) => {
          if (rel.derived_track_id && !rel.derived_track) {
            rel.derived_track = trackMap.get(rel.derived_track_id);
          }
        });
        console.log('✅ Fetched tracks separately and merged');
      }
    }
  }

  return relationships;
}

/**
 * Find variant for specific context (e.g., find TX variant)
 */
export async function findVariantByContext(
  orgId: string,
  sourceTrackId: string,
  variantType: VariantType,
  contextKey: string,
  contextValue: string
): Promise<TrackRelationship | null> {
  console.log('🔍 Finding variant by context:', {
    orgId,
    sourceTrackId,
    variantType,
    contextKey,
    contextValue
  });

  const { data, error } = await supabase
    .from('track_relationships')
    .select(`
      id,
      source_track_id,
      derived_track_id,
      relationship_type,
      variant_type,
      variant_context,
      created_at,
      derived_track:tracks!derived_track_id(
        id,
        title,
        type,
        thumbnail_url,
        status
      )
    `)
    .eq('organization_id', orgId)
    .eq('source_track_id', sourceTrackId)
    .eq('relationship_type', 'variant')
    .eq('variant_type', variantType);

  if (error) {
    console.error('❌ Error finding variant by context:', error);
    throw error;
  }

  // Filter by context key/value (Supabase JSONB containment)
  const matchingVariant = (data || []).find((rel: any) => {
    const context = rel.variant_context || {};
    return context[contextKey] === contextValue;
  });

  if (matchingVariant) {
    // Fallback for null derived_track
    if (!matchingVariant.derived_track && matchingVariant.derived_track_id) {
      const { data: track } = await supabase
        .from('tracks')
        .select('id, title, type, thumbnail_url, status')
        .eq('id', matchingVariant.derived_track_id)
        .eq('organization_id', orgId)
        .single();

      if (track) {
        matchingVariant.derived_track = track;
      }
    }
  }

  console.log('📊 Find variant result:', {
    found: !!matchingVariant,
    id: matchingVariant?.id
  });

  return matchingVariant || null;
}

/**
 * Get the "base" track for a variant (inverse lookup)
 */
export async function getBaseTrackForVariant(
  orgId: string,
  variantTrackId: string
): Promise<TrackRelationship | null> {
  console.log('🔍 Getting base track for variant:', { orgId, variantTrackId });

  const { data, error } = await supabase
    .from('track_relationships')
    .select(`
      id,
      source_track_id,
      derived_track_id,
      relationship_type,
      variant_type,
      variant_context,
      created_at,
      source_track:tracks!source_track_id(
        id,
        title,
        type,
        thumbnail_url,
        status
      )
    `)
    .eq('organization_id', orgId)
    .eq('derived_track_id', variantTrackId)
    .eq('relationship_type', 'variant')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      console.log('📊 No base track found for variant');
      return null;
    }
    console.error('❌ Error getting base track for variant:', error);
    throw error;
  }

  // Fallback for null source_track
  if (data && !data.source_track && data.source_track_id) {
    console.log('⚠️ Join returned null track, fetching separately...');
    const { data: track } = await supabase
      .from('tracks')
      .select('id, title, type, thumbnail_url, status')
      .eq('id', data.source_track_id)
      .eq('organization_id', orgId)
      .single();

    if (track) {
      data.source_track = track;
      console.log('✅ Fetched source track separately and merged');
    }
  }

  console.log('📊 Base track for variant result:', {
    found: !!data,
    sourceTrackId: data?.source_track_id
  });

  return data;
}

/**
 * Get relationship statistics for a track including variant counts
 */
export async function getTrackRelationshipStatsWithVariants(
  orgId: string,
  trackId: string
): Promise<{
  derivedCount: number;
  sourceCount: number;
  hasDerivedCheckpoints: boolean;
  derived: TrackRelationship[];
  variantCount: number;
  variants: {
    geographic: number;
    company: number;
    unit: number;
  };
  variantsNeedingReview: number;
}> {
  console.log('Fetching relationship stats with variants:', { orgId, trackId });

  // Get existing stats
  const baseStats = await getTrackRelationshipStats(orgId, trackId);

  // Get variant counts
  const { data: variantData, error: variantError } = await supabase
    .from('track_relationships')
    .select('variant_type, variant_context')
    .eq('organization_id', orgId)
    .eq('source_track_id', trackId)
    .eq('relationship_type', 'variant');

  if (variantError) {
    console.error('Error fetching variant stats:', variantError);
    throw variantError;
  }

  const variantCounts = {
    geographic: 0,
    company: 0,
    unit: 0
  };

  (variantData || []).forEach((v: any) => {
    if (v.variant_type && variantCounts.hasOwnProperty(v.variant_type)) {
      variantCounts[v.variant_type as VariantType]++;
    }
  });

  const totalVariants = Object.values(variantCounts).reduce((a, b) => a + b, 0);

  // Get count of variants needing review
  let variantsNeedingReviewCount = 0;
  if (totalVariants > 0) {
    try {
      const variantsNeedingReview = await getVariantsNeedingReview(orgId, trackId);
      variantsNeedingReviewCount = variantsNeedingReview.length;
    } catch {
      // If getVariantsNeedingReview fails, default to 0
      console.log('Could not get variants needing review count');
    }
  }

  console.log('Variant stats:', {
    totalVariants,
    breakdown: variantCounts,
    needingReview: variantsNeedingReviewCount
  });

  return {
    ...baseStats,
    variantCount: totalVariants,
    variants: variantCounts,
    variantsNeedingReview: variantsNeedingReviewCount
  };
}

/**
 * Get ALL descendants (full tree) - for displaying complete variant family
 * Returns flat list - UI can use lineage[] to build breadcrumbs
 */
export async function getVariantTree(
  orgId: string,
  baseTrackId: string
): Promise<TrackRelationship[]> {
  console.log('Fetching variant tree:', { orgId, baseTrackId });

  // Get all variants where this track is in their lineage OR is the direct source
  const { data: allVariants, error } = await supabase
    .from('track_relationships')
    .select(`
      id,
      source_track_id,
      derived_track_id,
      relationship_type,
      variant_type,
      variant_context,
      created_at,
      derived_track:tracks!derived_track_id(
        id,
        title,
        type,
        thumbnail_url,
        status
      )
    `)
    .eq('organization_id', orgId)
    .eq('relationship_type', 'variant');

  if (error) {
    console.error('Error fetching variant tree:', error);
    throw error;
  }

  // Filter to only include variants that have baseTrackId in their lineage
  // or have baseTrackId as their direct source
  const treeVariants = (allVariants || []).filter((rel: any) => {
    const context = rel.variant_context as VariantContext | null;
    const lineage = context?.lineage || [];

    // Include if baseTrackId is in lineage or is the source track
    return lineage.includes(baseTrackId) || rel.source_track_id === baseTrackId;
  });

  // Fallback for null derived_track
  const needsFallback = treeVariants.some((rel: any) => !rel.derived_track && rel.derived_track_id);
  if (needsFallback && treeVariants.length > 0) {
    console.log('Join returned null tracks in tree, fetching separately...');
    const trackIds = treeVariants.map((rel: any) => rel.derived_track_id).filter(Boolean);

    if (trackIds.length > 0) {
      const { data: tracks } = await supabase
        .from('tracks')
        .select('id, title, type, thumbnail_url, status')
        .in('id', trackIds)
        .eq('organization_id', orgId);

      if (tracks) {
        const trackMap = new Map(tracks.map((t: any) => [t.id, t]));
        treeVariants.forEach((rel: any) => {
          if (rel.derived_track_id && !rel.derived_track) {
            rel.derived_track = trackMap.get(rel.derived_track_id);
          }
        });
      }
    }
  }

  console.log('Variant tree result:', { count: treeVariants.length });
  return treeVariants;
}

/**
 * Get immediate parent variant (one level up)
 */
export async function getParentVariant(
  orgId: string,
  variantTrackId: string
): Promise<TrackRelationship | null> {
  console.log('Getting parent variant:', { orgId, variantTrackId });

  // First get this track's variant relationship to find its parent_variant_id
  const { data: thisVariantRel, error: relError } = await supabase
    .from('track_relationships')
    .select('variant_context, source_track_id')
    .eq('organization_id', orgId)
    .eq('derived_track_id', variantTrackId)
    .eq('relationship_type', 'variant')
    .single();

  if (relError) {
    if (relError.code === 'PGRST116') {
      console.log('Track is not a variant');
      return null;
    }
    throw relError;
  }

  const context = thisVariantRel?.variant_context as VariantContext | null;
  const parentVariantId = context?.parent_variant_id;

  if (!parentVariantId) {
    // No parent variant - this is a direct child of a base track
    console.log('No parent variant - direct child of base track');
    return null;
  }

  // Get the parent variant's relationship
  const { data: parentRel, error: parentError } = await supabase
    .from('track_relationships')
    .select(`
      id,
      source_track_id,
      derived_track_id,
      relationship_type,
      variant_type,
      variant_context,
      created_at,
      derived_track:tracks!derived_track_id(
        id,
        title,
        type,
        thumbnail_url,
        status
      )
    `)
    .eq('organization_id', orgId)
    .eq('derived_track_id', parentVariantId)
    .eq('relationship_type', 'variant')
    .single();

  if (parentError) {
    if (parentError.code === 'PGRST116') {
      return null;
    }
    throw parentError;
  }

  // Fallback for null derived_track
  if (parentRel && !parentRel.derived_track && parentRel.derived_track_id) {
    const { data: track } = await supabase
      .from('tracks')
      .select('id, title, type, thumbnail_url, status')
      .eq('id', parentRel.derived_track_id)
      .eq('organization_id', orgId)
      .single();

    if (track) {
      parentRel.derived_track = track;
    }
  }

  console.log('Parent variant result:', { found: !!parentRel });
  return parentRel;
}

/**
 * Check if variants need review (base was updated after base_synced_at)
 */
export async function getVariantsNeedingReview(
  orgId: string,
  baseTrackId: string
): Promise<TrackRelationship[]> {
  console.log('Getting variants needing review:', { orgId, baseTrackId });

  // Get the base track's updated_at
  const { data: baseTrack, error: baseError } = await supabase
    .from('tracks')
    .select('updated_at')
    .eq('id', baseTrackId)
    .eq('organization_id', orgId)
    .single();

  if (baseError) {
    console.error('Error fetching base track:', baseError);
    throw baseError;
  }

  const baseUpdatedAt = baseTrack?.updated_at;
  if (!baseUpdatedAt) {
    return [];
  }

  // Get all variants in the tree
  const allVariants = await getVariantTree(orgId, baseTrackId);

  // Filter to only variants where base_synced_at is older than base's updated_at
  const needsReview = allVariants.filter((rel: any) => {
    const context = rel.variant_context as VariantContext | null;
    const syncedAt = context?.base_synced_at;

    if (!syncedAt) {
      // No sync timestamp - needs review
      return true;
    }

    // Compare timestamps
    return new Date(syncedAt) < new Date(baseUpdatedAt);
  });

  console.log('Variants needing review:', {
    total: allVariants.length,
    needsReview: needsReview.length
  });

  return needsReview;
}

/**
 * Mark variant as synced with base (after admin reviews)
 */
export async function markVariantSynced(
  orgId: string,
  variantRelationshipId: string
): Promise<void> {
  console.log('Marking variant as synced:', { orgId, variantRelationshipId });

  // Get the current relationship
  const { data: rel, error: relError } = await supabase
    .from('track_relationships')
    .select('variant_context')
    .eq('id', variantRelationshipId)
    .eq('organization_id', orgId)
    .single();

  if (relError) {
    console.error('Error fetching relationship:', relError);
    throw relError;
  }

  const currentContext = (rel?.variant_context || {}) as VariantContext;
  const updatedContext: VariantContext = {
    ...currentContext,
    base_synced_at: new Date().toISOString()
  };

  // Update the variant_context with new sync timestamp
  const { error: updateError } = await supabase
    .from('track_relationships')
    .update({ variant_context: updatedContext })
    .eq('id', variantRelationshipId)
    .eq('organization_id', orgId);

  if (updateError) {
    console.error('Error updating variant sync status:', updateError);
    throw updateError;
  }

  console.log('Variant marked as synced');
}

/**
 * Get the ultimate base track for any variant (walks up the chain using lineage)
 */
export async function getUltimateBaseTrack(
  orgId: string,
  variantTrackId: string
): Promise<{ baseTrack: TrackRelationship | null; depth: number }> {
  console.log('Getting ultimate base track:', { orgId, variantTrackId });

  // Get this track's variant relationship
  const { data: rel, error } = await supabase
    .from('track_relationships')
    .select(`
      id,
      source_track_id,
      derived_track_id,
      relationship_type,
      variant_type,
      variant_context,
      created_at
    `)
    .eq('organization_id', orgId)
    .eq('derived_track_id', variantTrackId)
    .eq('relationship_type', 'variant')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      console.log('Track is not a variant');
      return { baseTrack: null, depth: 0 };
    }
    throw error;
  }

  const context = rel?.variant_context as VariantContext | null;
  const lineage = context?.lineage || [];

  // The first item in lineage is the ultimate base track
  const baseTrackId = lineage.length > 0 ? lineage[0] : rel?.source_track_id;
  const depth = lineage.length;

  if (!baseTrackId) {
    return { baseTrack: null, depth: 0 };
  }

  // Fetch the base track details
  const { data: baseTrackData } = await supabase
    .from('tracks')
    .select('id, title, type, thumbnail_url, status, updated_at')
    .eq('id', baseTrackId)
    .eq('organization_id', orgId)
    .single();

  if (!baseTrackData) {
    return { baseTrack: null, depth };
  }

  // Construct a TrackRelationship-like object for the base
  const result: TrackRelationship = {
    id: '',  // Base track has no relationship ID
    source_track_id: '',
    derived_track_id: baseTrackId,
    relationship_type: 'variant',
    created_at: '',
    source_track: baseTrackData
  };

  console.log('Ultimate base track result:', { found: true, depth });
  return { baseTrack: result, depth };
}
