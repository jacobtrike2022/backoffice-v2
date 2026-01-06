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
  state_code?: string;
  state_name?: string;
  org_id?: string;
  org_name?: string;
  language_code?: string;
  language_name?: string;
  store_id?: string;
  store_name?: string;
}

export type VariantType = 'geographic' | 'company' | 'language' | 'unit';

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
 * Create a variant relationship between tracks
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

  const { data, error } = await supabase
    .from('track_relationships')
    .insert({
      organization_id: orgId,
      source_track_id: sourceTrackId,
      derived_track_id: derivedTrackId,
      relationship_type: 'variant',
      variant_type: variantType,
      variant_context: variantContext
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Error creating variant relationship:', error);
    throw error;
  }

  console.log('✅ Variant relationship created:', data.id);
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
    language: number;
    unit: number;
  };
}> {
  console.log('🔍 Fetching relationship stats with variants:', { orgId, trackId });

  // Get existing stats
  const baseStats = await getTrackRelationshipStats(orgId, trackId);

  // Get variant counts
  const { data: variantData, error: variantError } = await supabase
    .from('track_relationships')
    .select('variant_type')
    .eq('organization_id', orgId)
    .eq('source_track_id', trackId)
    .eq('relationship_type', 'variant');

  if (variantError) {
    console.error('❌ Error fetching variant stats:', variantError);
    throw variantError;
  }

  const variantCounts = {
    geographic: 0,
    company: 0,
    language: 0,
    unit: 0
  };

  (variantData || []).forEach((v: any) => {
    if (v.variant_type && variantCounts.hasOwnProperty(v.variant_type)) {
      variantCounts[v.variant_type as VariantType]++;
    }
  });

  const totalVariants = Object.values(variantCounts).reduce((a, b) => a + b, 0);

  console.log('📊 Variant stats:', {
    totalVariants,
    breakdown: variantCounts
  });

  return {
    ...baseStats,
    variantCount: totalVariants,
    variants: variantCounts
  };
}
