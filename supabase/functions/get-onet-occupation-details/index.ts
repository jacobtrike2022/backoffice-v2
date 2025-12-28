import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ONET_PASSWORD = Deno.env.get('ONET_PASSWORD')!;
const ONET_BASE_URL = 'https://api-v2.onetcenter.org';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ONetOccupationDetails {
  onet_code: string;
  title: string;
  description: string;
  tasks: string[];
  skills: Array<{ name: string; importance: number }>;
  knowledge: Array<{ name: string; importance: number }>;
  job_zone: number;
  sample_job_titles: string[];
}

/**
 * Make authenticated request to O*NET API
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
    console.error('O*NET API error:', url, error);
    throw new Error(`O*NET API error: ${response.status}`);
  }

  return await response.json();
}

/**
 * Get full occupation details from O*NET
 */
async function getOccupationDetails(onetCode: string): Promise<ONetOccupationDetails> {
  console.log('Fetching details for O*NET code:', onetCode);

  // Fetch all data in parallel
  const [careerData, skillsData, knowledgeData] = await Promise.all([
    fetchONet(`/mnm/careers/${onetCode}`),
    fetchONet(`/mnm/careers/${onetCode}/skills`),
    fetchONet(`/mnm/careers/${onetCode}/knowledge`),
  ]);

  // Extract tasks from on_the_job array
  const tasks = (careerData.on_the_job || []).slice(0, 10);

  // Extract skills - flatten the nested structure
  const skillElements: any[] = [];
  (skillsData || []).forEach((category: any) => {
    (category.element || []).forEach((skill: any) => {
      skillElements.push(skill);
    });
  });
  const skills = skillElements.map((skill: any) => ({
    name: skill.name,
    importance: 50, // v2.0 doesn't provide importance scores in this endpoint
  })).slice(0, 10);

  // Extract knowledge - flatten the nested structure
  const knowledgeElements: any[] = [];
  (knowledgeData || []).forEach((category: any) => {
    (category.element || []).forEach((know: any) => {
      knowledgeElements.push(know);
    });
  });
  const knowledge = knowledgeElements.map((know: any) => ({
    name: know.name,
    importance: 50, // v2.0 doesn't provide importance scores in this endpoint
  })).slice(0, 10);

  // Extract sample job titles from also_called
  const sampleJobTitles = (careerData.also_called || [])
    .map((job: any) => job.title)
    .slice(0, 10);

  return {
    onet_code: onetCode,
    title: careerData.title,
    description: careerData.what_they_do || '',
    tasks,
    skills,
    knowledge,
    job_zone: 0, // v2.0 doesn't provide this in the basic career endpoint
    sample_job_titles: sampleJobTitles,
  };
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
    const { onet_code } = await req.json();

    if (!onet_code) {
      throw new Error('O*NET code is required');
    }

    // Get occupation details
    const details = await getOccupationDetails(onet_code);

    return new Response(
      JSON.stringify({
        success: true,
        data: details,
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      }
    );

  } catch (error) {
    console.error('Error in get-onet-occupation-details function:', error);
    
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

