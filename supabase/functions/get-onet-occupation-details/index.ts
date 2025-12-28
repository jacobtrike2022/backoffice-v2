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
  const [summaryData, tasksData, skillsData, knowledgeData] = await Promise.all([
    fetchONet(`/online/occupations/${onetCode}/summary`),
    fetchONet(`/online/occupations/${onetCode}/summary/tasks`),
    fetchONet(`/online/occupations/${onetCode}/summary/skills`),
    fetchONet(`/online/occupations/${onetCode}/summary/knowledge`),
  ]);

  // Extract tasks
  const tasks = (tasksData.task || [])
    .map((task: any) => task.description)
    .filter(Boolean)
    .slice(0, 10); // Top 10 tasks

  // Extract skills with importance scores
  const skills = (skillsData.skill || [])
    .map((skill: any) => ({
      name: skill.element_name,
      importance: skill.scale?.value || 0,
    }))
    .sort((a: any, b: any) => b.importance - a.importance)
    .slice(0, 10); // Top 10 skills

  // Extract knowledge areas with importance scores
  const knowledge = (knowledgeData.knowledge || [])
    .map((know: any) => ({
      name: know.element_name,
      importance: know.scale?.value || 0,
    }))
    .sort((a: any, b: any) => b.importance - a.importance)
    .slice(0, 10); // Top 10 knowledge areas

  // Build job description from tasks
  const jobDescription = tasks.length > 0
    ? tasks.join(' ')
    : summaryData.description || '';

  return {
    onet_code: onetCode,
    title: summaryData.title,
    description: summaryData.description || '',
    tasks,
    skills,
    knowledge,
    job_zone: summaryData.job_zone || 0,
    sample_job_titles: summaryData.sample_of_reported_job_titles || [],
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

