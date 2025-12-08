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

export interface TrackRelationship {
  id: string;
  source_track_id: string;
  derived_track_id: string;
  relationship_type: 'source' | 'prerequisite' | 'related';
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

  return data || [];
}

/**
 * Get the source track for a derived track (parent)
 */
export async function getSourceTrack(
  orgId: string,
  derivedTrackId: string,
  relationshipType?: 'source' | 'prerequisite' | 'related'
): Promise<TrackRelationship | null> {
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
      return null;
    }
    console.error('❌ Error fetching source track:', error);
    throw error;
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

  const derived = derivedData || [];
  const hasDerivedCheckpoints = derived.some(
    (rel: any) => rel.derived_track?.type === 'checkpoint'
  );

  return {
    derivedCount: derived.length,
    sourceCount: sourceCount || 0,
    hasDerivedCheckpoints,
    derived
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
  const { data, error } = await supabase
    .from('track_relationships')
    .select(`
      source_track_id,
      relationship_type,
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

  // Initialize result for all requested tracks
  const result: Record<string, any> = {};
  for (const trackId of trackIds) {
    result[trackId] = {
      derivedCount: 0,
      derivedTracks: []
    };
  }

  // Group by source track
  for (const rel of data || []) {
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

  return result;
}
