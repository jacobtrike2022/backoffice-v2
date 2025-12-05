import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { getHealthStatus } from '../serverHealth';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-2858cc8b`;

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
      `${SERVER_URL}/facts/track/${trackId}`,
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
      `${SERVER_URL}/generate-key-facts`,
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