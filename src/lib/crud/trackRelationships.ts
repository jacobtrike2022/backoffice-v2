// ============================================================================
// TRACK RELATIONSHIPS CRUD OPERATIONS (Frontend)
// ============================================================================

import { publicAnonKey, getServerUrl } from '../../utils/supabase/info';
import { supabase } from '../supabase';

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
  variantCount?: number;
  variants?: {
    geographic: number;
    company: number;
    language: number;
    unit: number;
  };
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

  const response = await fetch(`${getServerUrl()}/track-relationships/create`, {
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
  
  let url = `${getServerUrl()}/track-relationships/derived/${sourceTrackId}`;
  if (relationshipType) {
    url += `?type=${relationshipType}`;
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || 'make-server-2858cc8b';
      console.error(`❌ Track relationships endpoint not found. Check that VITE_SUPABASE_FUNCTION_NAME is set to 'make-server-2858cc8b' (currently: '${functionName}')`);
    }
    const error = await response.json().catch(() => ({ error: 'Not found' }));
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
  
  let url = `${getServerUrl()}/track-relationships/source/${derivedTrackId}`;
  if (relationshipType) {
    url += `?type=${relationshipType}`;
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || 'make-server-2858cc8b';
      console.error(`❌ Track relationships endpoint not found. Check that VITE_SUPABASE_FUNCTION_NAME is set to 'make-server-2858cc8b' (currently: '${functionName}')`);
    }
    const error = await response.json().catch(() => ({ error: 'Not found' }));
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

  const response = await fetch(`${getServerUrl()}/track-relationships/stats/${trackId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || 'make-server-2858cc8b';
      console.error(`❌ Track relationships endpoint not found. Check that VITE_SUPABASE_FUNCTION_NAME is set to 'make-server-2858cc8b' (currently: '${functionName}')`);
    }
    const error = await response.json().catch(() => ({ error: 'Not found' }));
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

  const response = await fetch(`${getServerUrl()}/track-relationships/${relationshipId}`, {
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

// ============================================================================
// VARIANT RELATIONSHIP FUNCTIONS
// ============================================================================

/**
 * Create a variant relationship between tracks
 */
export async function createVariantRelationship(
  sourceTrackId: string,
  derivedTrackId: string,
  variantType: VariantType,
  variantContext: VariantContext
): Promise<TrackRelationship> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${getServerUrl()}/track-relationships/variant/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      sourceTrackId,
      derivedTrackId,
      variantType,
      variantContext,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create variant relationship');
  }

  const data = await response.json();
  return data.relationship;
}

/**
 * Get all variants of a track
 */
export async function getTrackVariants(
  trackId: string,
  variantType?: VariantType
): Promise<TrackRelationship[]> {
  const accessToken = await getAccessToken();

  let url = `${getServerUrl()}/track-relationships/variants/${trackId}`;
  if (variantType) {
    url += `?type=${variantType}`;
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || 'make-server-2858cc8b';
      console.error(`Track variants endpoint not found. Check that VITE_SUPABASE_FUNCTION_NAME is set to 'make-server-2858cc8b' (currently: '${functionName}')`);
    }
    const error = await response.json().catch(() => ({ error: 'Not found' }));
    throw new Error(error.error || 'Failed to fetch track variants');
  }

  const data = await response.json();
  return data.variants;
}

/**
 * Find variant for specific context (e.g., find TX variant)
 */
export async function findVariantByContext(
  sourceTrackId: string,
  variantType: VariantType,
  contextKey: string,
  contextValue: string
): Promise<TrackRelationship | null> {
  const accessToken = await getAccessToken();

  const params = new URLSearchParams({
    sourceTrackId,
    variantType,
    contextKey,
    contextValue,
  });

  const response = await fetch(`${getServerUrl()}/track-relationships/variant/find?${params}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || 'make-server-2858cc8b';
      console.error(`Find variant endpoint not found. Check that VITE_SUPABASE_FUNCTION_NAME is set to 'make-server-2858cc8b' (currently: '${functionName}')`);
    }
    const error = await response.json().catch(() => ({ error: 'Not found' }));
    throw new Error(error.error || 'Failed to find variant');
  }

  const data = await response.json();
  return data.variant;
}

/**
 * Get the "base" track for a variant (inverse lookup)
 */
export async function getBaseTrackForVariant(
  variantTrackId: string
): Promise<TrackRelationship | null> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${getServerUrl()}/track-relationships/variant/base/${variantTrackId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || 'make-server-2858cc8b';
      console.error(`Base track endpoint not found. Check that VITE_SUPABASE_FUNCTION_NAME is set to 'make-server-2858cc8b' (currently: '${functionName}')`);
    }
    const error = await response.json().catch(() => ({ error: 'Not found' }));
    throw new Error(error.error || 'Failed to get base track');
  }

  const data = await response.json();
  return data.baseTrack;
}

/**
 * Get relationship statistics including variant counts
 */
export async function getTrackRelationshipStatsWithVariants(
  trackId: string
): Promise<RelationshipStats> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${getServerUrl()}/track-relationships/stats-with-variants/${trackId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || 'make-server-2858cc8b';
      console.error(`Stats with variants endpoint not found. Check that VITE_SUPABASE_FUNCTION_NAME is set to 'make-server-2858cc8b' (currently: '${functionName}')`);
    }
    const error = await response.json().catch(() => ({ error: 'Not found' }));
    throw new Error(error.error || 'Failed to fetch relationship stats with variants');
  }

  const data = await response.json();
  return data.stats;
}