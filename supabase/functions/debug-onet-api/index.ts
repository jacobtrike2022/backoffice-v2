import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ONET_PASSWORD = Deno.env.get('ONET_PASSWORD')!;
const ONET_BASE_URL = 'https://api-v2.onetcenter.org';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Make authenticated request to O*NET API v2.0
 */
async function fetchONet(endpoint: string): Promise<any> {
  const url = `${ONET_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    headers: {
      'X-API-Key': ONET_PASSWORD,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`O*NET API error: ${response.status} ${error}`);
  }

  return await response.json();
}

/**
 * Main request handler - returns raw API responses for debugging
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const onetCode = url.searchParams.get('code') || '41-2011.00'; // Default to Cashiers
    const endpoint = url.searchParams.get('endpoint') || 'career'; // career, skills, knowledge, technology
    
    let data: any = {};
    let endpointPath = '';
    
    switch (endpoint) {
      case 'career':
        endpointPath = `/mnm/careers/${onetCode}`;
        data = await fetchONet(endpointPath);
        break;
      case 'skills':
        endpointPath = `/mnm/careers/${onetCode}/skills`;
        data = await fetchONet(endpointPath);
        break;
      case 'knowledge':
        endpointPath = `/mnm/careers/${onetCode}/knowledge`;
        data = await fetchONet(endpointPath);
        break;
      case 'technology':
        endpointPath = `/mnm/careers/${onetCode}/technology`;
        data = await fetchONet(endpointPath);
        break;
      default:
        throw new Error(`Unknown endpoint: ${endpoint}`);
    }
    
    // Return detailed analysis
    const analysis = {
      endpoint: endpointPath,
      onet_code: onetCode,
      response_keys: Object.keys(data),
      response_type: Array.isArray(data) ? 'array' : typeof data,
      response_length: Array.isArray(data) ? data.length : 'N/A',
      
      // Analyze career data
      ...(endpoint === 'career' && {
        career_fields: Object.keys(data),
        has_on_the_job: !!data.on_the_job,
        on_the_job_type: Array.isArray(data.on_the_job) ? 'array' : typeof data.on_the_job,
        on_the_job_length: Array.isArray(data.on_the_job) ? data.on_the_job.length : 'N/A',
        on_the_job_sample: Array.isArray(data.on_the_job) ? data.on_the_job.slice(0, 3) : data.on_the_job,
        has_tasks: !!data.tasks,
        has_task: !!data.task,
        has_work_activities: !!data.work_activities,
      }),
      
      // Analyze skills data
      ...(endpoint === 'skills' && {
        skills_type: Array.isArray(data) ? 'array' : typeof data,
        skills_length: Array.isArray(data) ? data.length : 'N/A',
        first_item_keys: Array.isArray(data) && data.length > 0 ? Object.keys(data[0]) : [],
        first_item_sample: Array.isArray(data) && data.length > 0 ? data[0] : null,
        nested_structure: Array.isArray(data) && data.length > 0 && data[0].element ? 'has element array' : 'no element array',
      }),
      
      // Analyze knowledge data
      ...(endpoint === 'knowledge' && {
        knowledge_type: Array.isArray(data) ? 'array' : typeof data,
        knowledge_length: Array.isArray(data) ? data.length : 'N/A',
        first_item_keys: Array.isArray(data) && data.length > 0 ? Object.keys(data[0]) : [],
        first_item_sample: Array.isArray(data) && data.length > 0 ? data[0] : null,
      }),
      
      // Full raw response (truncated for readability)
      raw_response: JSON.stringify(data, null, 2).substring(0, 5000),
    };
    
    return new Response(
      JSON.stringify(analysis, null, 2),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      }
    );

  } catch (error: any) {
    console.error('Error in debug-onet-api function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: error.stack,
      }),
      {
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      }
    );
  }
});

