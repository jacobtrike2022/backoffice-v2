import { publicAnonKey, getServerUrl } from '../../utils/supabase/info';
import { getHealthStatus } from '../serverHealth';

export interface KeyFact {
  id: string;
  title: string;
  content: string;
  type: string;
  steps?: string[];
  context?: any;
  extractedBy?: string;
  extractionConfidence?: number;
  companyId?: string;
  createdAt?: string;
  updatedAt?: string;
  usedIn?: Array<{
    type: string;
    trackId: string;
    slideId?: string;
    slideName?: string;
    slideIndex?: number;
  }>;
}

/**
 * Get all facts for a track
 */
export async function getFactsForTrack(trackId: string): Promise<KeyFact[]> {
  try {
    const response = await fetch(
      `${getServerUrl()}/facts/track/${trackId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get facts');
    }

    const data = await response.json();
    return data.facts || [];
  } catch (error) {
    // Return empty array silently - server health check handles the warning
    if (getHealthStatus()) {
      console.error('Failed to fetch facts despite server being healthy:', error);
    }
    return [];
  }
}

/**
 * Generate key facts using AI
 */
export async function generateKeyFacts(params: {
  title?: string;
  content?: string;
  description?: string;
  transcript?: string;
  trackType?: string;
  trackId?: string;
  companyId?: string;
}): Promise<{ enriched: any[]; factIds: string[] }> {
  try {
    const response = await fetch(
      `${getServerUrl()}/generate-key-facts`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate facts');
    }

    const data = await response.json();
    return {
      enriched: data.enriched || [],
      factIds: data.factIds || [],
    };
  } catch (error) {
    console.error('Failed to generate key facts:', error);
    throw error;
  }
}

/**
 * Delete a fact from a track
 */
export async function deleteFactFromTrack(factId: string, trackId: string): Promise<void> {
  try {
    const response = await fetch(
      `${getServerUrl()}/facts/${factId}/track/${trackId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete fact');
    }
  } catch (error) {
    console.error('Failed to delete fact:', error);
    throw error;
  }
}

/**
 * Update a fact
 */
export async function updateFact(
  factId: string,
  updates: {
    title?: string;
    content?: string;
    type?: string;
    steps?: string[];
  }
): Promise<KeyFact> {
  try {
    const response = await fetch(
      `${getServerUrl()}/facts/${factId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update fact');
    }

    const data = await response.json();
    return data.fact;
  } catch (error) {
    console.error('Failed to update fact:', error);
    throw error;
  }
}