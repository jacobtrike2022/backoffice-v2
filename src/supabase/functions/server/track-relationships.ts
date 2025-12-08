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

  const { data, error } = await query.order('created_at', { ascending: false });

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

  const { data, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();

  if (error) {
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
    .eq('organization_id', orgId)
    .eq('id', relationshipId);

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
  // Delete where this track is the source
  await supabase
    .from('track_relationships')
    .delete()
    .eq('organization_id', orgId)
    .eq('source_track_id', trackId);

  // Delete where this track is derived
  await supabase
    .from('track_relationships')
    .delete()
    .eq('organization_id', orgId)
    .eq('derived_track_id', trackId);

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
}> {
  // Count derived tracks (children)
  const { count: derivedCount, error: derivedError } = await supabase
    .from('track_relationships')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('source_track_id', trackId);

  if (derivedError) {
    console.error('❌ Error counting derived tracks:', derivedError);
    throw derivedError;
  }

  // Count source tracks (parents)
  const { count: sourceCount, error: sourceError } = await supabase
    .from('track_relationships')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('derived_track_id', trackId);

  if (sourceError) {
    console.error('❌ Error counting source tracks:', sourceError);
    throw sourceError;
  }

  // Check if any derived tracks are checkpoints
  const { data: checkpointData, error: checkpointError } = await supabase
    .from('track_relationships')
    .select('derived_track:tracks!derived_track_id(type)')
    .eq('organization_id', orgId)
    .eq('source_track_id', trackId)
    .eq('relationship_type', 'source')
    .limit(1);

  if (checkpointError) {
    console.error('❌ Error checking for derived checkpoints:', checkpointError);
  }

  const hasDerivedCheckpoints = checkpointData?.some(
    (rel: any) => rel.derived_track?.type === 'checkpoint'
  ) || false;

  return {
    derivedCount: derivedCount || 0,
    sourceCount: sourceCount || 0,
    hasDerivedCheckpoints
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
  // Get all derived relationships for these tracks
  const { data: relationships, error } = await supabase
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
    .in('source_track_id', trackIds)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching batch relationships:', error);
    throw error;
  }

  // Group by source track
  const result: Record<string, any> = {};
  
  for (const trackId of trackIds) {
    result[trackId] = {
      derivedCount: 0,
      derivedTracks: []
    };
  }

  for (const rel of relationships || []) {
    if (!result[rel.source_track_id]) {
      result[rel.source_track_id] = {
        derivedCount: 0,
        derivedTracks: []
      };
    }
    
    result[rel.source_track_id].derivedCount++;
    result[rel.source_track_id].derivedTracks.push({
      id: rel.derived_track.id,
      title: rel.derived_track.title,
      type: rel.derived_track.type,
      relationship_type: rel.relationship_type
    });
  }

  return result;
}