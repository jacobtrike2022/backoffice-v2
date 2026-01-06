// ============================================================================
// TRACK RELATIONSHIPS CRUD OPERATIONS (Frontend)
// ============================================================================

import { publicAnonKey, getServerUrl } from '../../utils/supabase/info';
import { supabase } from '../supabase';

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

export interface RelationshipStats {
  derivedCount: number;
  sourceCount: number;
  hasDerivedCheckpoints: boolean;
  variantCount?: number;
  variants?: {
    geographic: number;
    company: number;
    unit: number;
  };
  variantsNeedingReview?: number;
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

/**
 * Get full variant tree (all descendants)
 */
export async function getVariantTree(
  trackId: string
): Promise<TrackRelationship[]> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${getServerUrl()}/track-relationships/variant-tree/${trackId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || 'make-server-2858cc8b';
      console.error(`Variant tree endpoint not found. Check that VITE_SUPABASE_FUNCTION_NAME is set to 'make-server-2858cc8b' (currently: '${functionName}')`);
    }
    const error = await response.json().catch(() => ({ error: 'Not found' }));
    throw new Error(error.error || 'Failed to fetch variant tree');
  }

  const data = await response.json();
  return data.tree;
}

/**
 * Get parent variant (immediate parent in chain)
 */
export async function getParentVariant(
  variantTrackId: string
): Promise<TrackRelationship | null> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${getServerUrl()}/track-relationships/variant/parent/${variantTrackId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || 'make-server-2858cc8b';
      console.error(`Parent variant endpoint not found. Check that VITE_SUPABASE_FUNCTION_NAME is set to 'make-server-2858cc8b' (currently: '${functionName}')`);
    }
    const error = await response.json().catch(() => ({ error: 'Not found' }));
    throw new Error(error.error || 'Failed to get parent variant');
  }

  const data = await response.json();
  return data.parentVariant;
}

/**
 * Get variants needing review (base was updated after they were synced)
 */
export async function getVariantsNeedingReview(
  baseTrackId: string
): Promise<TrackRelationship[]> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${getServerUrl()}/track-relationships/variants/needs-review/${baseTrackId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || 'make-server-2858cc8b';
      console.error(`Variants needing review endpoint not found. Check that VITE_SUPABASE_FUNCTION_NAME is set to 'make-server-2858cc8b' (currently: '${functionName}')`);
    }
    const error = await response.json().catch(() => ({ error: 'Not found' }));
    throw new Error(error.error || 'Failed to get variants needing review');
  }

  const data = await response.json();
  return data.variantsNeedingReview;
}

/**
 * Mark variant as synced with base (after admin reviews)
 */
export async function markVariantSynced(
  relationshipId: string
): Promise<void> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${getServerUrl()}/track-relationships/variant/mark-synced/${relationshipId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || 'make-server-2858cc8b';
      console.error(`Mark synced endpoint not found. Check that VITE_SUPABASE_FUNCTION_NAME is set to 'make-server-2858cc8b' (currently: '${functionName}')`);
    }
    const error = await response.json().catch(() => ({ error: 'Not found' }));
    throw new Error(error.error || 'Failed to mark variant as synced');
  }
}

/**
 * Get ultimate base track for any variant (walks up the chain)
 */
export async function getUltimateBaseTrack(
  variantTrackId: string
): Promise<{ baseTrack: TrackRelationship | null; depth: number }> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${getServerUrl()}/track-relationships/variant/ultimate-base/${variantTrackId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || 'make-server-2858cc8b';
      console.error(`Ultimate base track endpoint not found. Check that VITE_SUPABASE_FUNCTION_NAME is set to 'make-server-2858cc8b' (currently: '${functionName}')`);
    }
    const error = await response.json().catch(() => ({ error: 'Not found' }));
    throw new Error(error.error || 'Failed to get ultimate base track');
  }

  const data = await response.json();
  return data;
}