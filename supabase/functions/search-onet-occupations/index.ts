import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ONET_PASSWORD = Deno.env.get('ONET_PASSWORD')!;
const ONET_BASE_URL = 'https://api-v2.onetcenter.org';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ONetSearchMatch {
  onet_code: string;
  title: string;
  relevance_score: number;
  description?: string;
}

/**
 * Search O*NET database for matching occupations
 */
async function searchONetOccupations(query: string): Promise<ONetSearchMatch[]> {
  const encodedQuery = encodeURIComponent(query);
  const url = `${ONET_BASE_URL}/mnm/search?keyword=${encodedQuery}`;
  
  console.log('Searching O*NET for:', query);
  
  const response = await fetch(url, {
    headers: {
      'X-API-Key': ONET_PASSWORD,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('O*NET API error:', error);
    throw new Error(`O*NET API error: ${response.status}`);
  }

  const data = await response.json();
  
  // Extract occupations from response
  const occupations = data.occupation || [];
  
  // Map to our format with relevance scores
  const matches: ONetSearchMatch[] = occupations.map((occ: any) => ({
    onet_code: occ.code,
    title: occ.title,
    relevance_score: occ.tags?.title || 0, // O*NET provides relevance in tags
  }));

  // Sort by relevance and take top 5
  const topMatches = matches
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 5);

  console.log(`Found ${topMatches.length} matches for "${query}"`);

  return topMatches;
}

/**
 * Main request handler
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query || query.trim().length === 0) {
      throw new Error('Search query is required');
    }

    // Search O*NET
    const matches = await searchONetOccupations(query.trim());

    return new Response(
      JSON.stringify({
        success: true,
        query,
        matches,
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      }
    );

  } catch (error) {
    console.error('Error in search-onet-occupations function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      }
    );
  }
});

