// ============================================================================
// TRACK RELATIONSHIPS CRUD OPERATIONS (Frontend)
// ============================================================================

import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { supabase } from '../supabase';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-2858cc8b`;

export interface TrackRelationship {
  id: string;
  source_track_id: string;
  derived_track_id: string;
  relationship_type: 'source' | 'prerequisite' | 'related';
  created_at: string;
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

export interface RelationshipStats {
  derivedCount: number;
  sourceCount: number;
  hasDerivedCheckpoints: boolean;
}

/**
 * Get access token for authenticated requests
 */
async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    // In demo mode, use the public anon key instead
    return publicAnonKey;
  }
  return session.access_token;
}

/**
 * Create a relationship between tracks
 */
export async function createTrackRelationship(
  sourceTrackId: string,
  derivedTrackId: string,
  relationshipType: 'source' | 'prerequisite' | 'related' = 'source'
): Promise<TrackRelationship> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${SERVER_URL}/track-relationships/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      sourceTrackId,
      derivedTrackId,
      relationshipType,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create track relationship');
  }

  const data = await response.json();
  return data.relationship;
}

/**
 * Get all tracks derived from a source track (children)
 */
export async function getDerivedTracks(
  sourceTrackId: string,
  relationshipType?: 'source' | 'prerequisite' | 'related'
): Promise<TrackRelationship[]> {
  const accessToken = await getAccessToken();
  
  let url = `${SERVER_URL}/track-relationships/derived/${sourceTrackId}`;
  if (relationshipType) {
    url += `?type=${relationshipType}`;
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch derived tracks');
  }

  const data = await response.json();
  return data.derived;
}

/**
 * Get the source track for a derived track (parent)
 */
export async function getSourceTrack(
  derivedTrackId: string,
  relationshipType?: 'source' | 'prerequisite' | 'related'
): Promise<TrackRelationship | null> {
  const accessToken = await getAccessToken();
  
  let url = `${SERVER_URL}/track-relationships/source/${derivedTrackId}`;
  if (relationshipType) {
    url += `?type=${relationshipType}`;
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch source track');
  }

  const data = await response.json();
  return data.source;
}

/**
 * Get relationship statistics for a track
 */
export async function getTrackRelationshipStats(
  trackId: string
): Promise<RelationshipStats> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${SERVER_URL}/track-relationships/stats/${trackId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch relationship stats');
  }

  const data = await response.json();
  return data.stats;
}

/**
 * Delete a track relationship
 */
export async function deleteTrackRelationship(relationshipId: string): Promise<void> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${SERVER_URL}/track-relationships/${relationshipId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete track relationship');
  }
}