import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const ONET_PASSWORD = Deno.env.get('ONET_PASSWORD')!;
const ONET_BASE_URL = 'https://api-v2.onetcenter.org';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
    console.error('O*NET API error:', url, error);
    throw new Error(`O*NET API error: ${response.status} ${error}`);
  }

  return await response.json();
}

/**
 * Sync a single occupation from O*NET API
 */
async function syncSingleOccupation(supabase: any, onetCode: string): Promise<void> {
  console.log(`Syncing occupation ${onetCode}...`);
  
  const careerData = await fetchONet(`/mnm/careers/${onetCode}`);
  
  if (!careerData || !careerData.code) {
    throw new Error(`Invalid response for occupation ${onetCode}`);
  }
  
  // Transform to our schema
  const occupation = {
    onet_code: careerData.code,
    title: careerData.title,
    description: careerData.what_they_do || null,
    job_zone: careerData.job_zone || null,
    also_called: (careerData.also_called || []).map((job: any) => 
      typeof job === 'string' ? job : (job.title || job)
    ),
  };
  
  // Upsert occupation
  const { error } = await supabase
    .from('onet_occupations')
    .upsert(occupation, { onConflict: 'onet_code' });
    
  if (error) {
    console.error('Error upserting occupation:', error);
    throw error;
  }
  
  console.log(`Synced occupation: ${occupation.title}`);
}

/**
 * Sync all occupations from O*NET API (for full sync)
 * Note: O*NET v2.0 doesn't have a direct "get all careers" endpoint
 * We'll need to use search or get them one by one
 */
async function syncOccupations(supabase: any, limit?: number): Promise<number> {
  console.log('Syncing occupations from O*NET...');
  
  // O*NET v2.0 doesn't have a /mnm/careers endpoint that returns all careers
  // Instead, we'll use search with a broad term to get many results
  // Or we can fetch occupations individually as we encounter them
  
  // For now, let's try a search approach to get a list
  try {
    // Search for common terms to get a variety of occupations
    const searchTerms = ['manager', 'assistant', 'clerk', 'technician', 'specialist'];
    const allCareers: any[] = [];
    const seenCodes = new Set<string>();
    
    for (const term of searchTerms) {
      try {
        const searchData = await fetchONet(`/mnm/search?keyword=${encodeURIComponent(term)}`);
        const careers = searchData.career || [];
        
        careers.forEach((career: any) => {
          if (career.code && !seenCodes.has(career.code)) {
            seenCodes.add(career.code);
            allCareers.push(career);
          }
        });
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.log(`Search for "${term}" failed, continuing...`);
      }
    }
    
    if (allCareers.length === 0) {
      console.log('No careers found via search. You may need to sync occupations individually.');
      return 0;
    }
    
    // Limit if specified
    const careersToSync = limit ? allCareers.slice(0, limit) : allCareers;
    
    // Transform to our schema
    const occupations = careersToSync.map((career: any) => ({
      onet_code: career.code,
      title: career.title,
      description: null, // Will be filled when we sync individual occupation details
      job_zone: null,
      also_called: [],
    }));
    
    // Upsert occupations
    const { error } = await supabase
      .from('onet_occupations')
      .upsert(occupations, { onConflict: 'onet_code' });
      
    if (error) {
      console.error('Error upserting occupations:', error);
      throw error;
    }
    
    console.log(`Synced ${occupations.length} occupations`);
    return occupations.length;
  } catch (error: any) {
    console.error('Error in syncOccupations:', error);
    // Don't throw - return 0 and let individual syncs handle it
    return 0;
  }
}

/**
 * Sync skills for a specific occupation
 */
async function syncOccupationSkills(supabase: any, onetCode: string): Promise<number> {
  console.log(`Syncing skills for ${onetCode}...`);
  
  try {
    const skillsData = await fetchONet(`/mnm/careers/${onetCode}/skills`);
    
    if (!skillsData || !Array.isArray(skillsData)) {
      console.log(`No skills data for ${onetCode}`);
      return 0;
    }
    
    // Flatten nested structure (O*NET v2.0 returns categories with elements)
    const allSkills: any[] = [];
    skillsData.forEach((category: any) => {
      if (category.element && Array.isArray(category.element)) {
        category.element.forEach((skill: any) => {
          allSkills.push({
            ...skill,
            category: category.name || category.category || null,
          });
        });
      }
    });
    
    if (allSkills.length === 0) {
      console.log(`No skills found in response for ${onetCode}. Response structure:`, JSON.stringify(skillsData).substring(0, 500));
      return 0;
    }
    
    console.log(`Found ${allSkills.length} skills for ${onetCode}. Sample skill structure:`, JSON.stringify(allSkills[0]).substring(0, 300));
    
    // 1. Upsert skills into master table
    // O*NET v2.0 might use different field names - try multiple possibilities
    const skills = allSkills.map((skill: any) => {
      // Try various ID field names
      const skillId = skill.id || skill.element_id || skill.skill_id || skill.code || 
                     (skill.name ? skill.name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20) : null);
      
      if (!skillId) {
        console.warn(`Skill missing ID field:`, JSON.stringify(skill).substring(0, 200));
        return null;
      }
      
      return {
        skill_id: skillId,
        name: skill.name || skill.title || 'Unknown Skill',
        category: skill.category || null,
        description: skill.description || null,
      };
    }).filter((s: any) => s !== null && s.skill_id && s.name); // Filter out invalid entries
    
    if (skills.length === 0) {
      console.error(`No valid skills extracted for ${onetCode}. All skills filtered out.`);
      return 0;
    }
    
    console.log(`Upserting ${skills.length} skills for ${onetCode}`);
    
    if (skills.length > 0) {
      const { error: skillsError } = await supabase
        .from('onet_skills')
        .upsert(skills, { onConflict: 'skill_id' });
        
      if (skillsError) {
        console.error(`Error upserting skills for ${onetCode}:`, skillsError);
        throw skillsError;
      }
    }
    
    // 2. Create occupation → skill mappings
    const mappings = allSkills
      .map((skill: any) => {
        // Use same ID extraction logic as above
        const skillId = skill.id || skill.element_id || skill.skill_id || skill.code || 
                       (skill.name ? skill.name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20) : null);
        
        if (!skillId) return null;
        
        return {
          onet_code: onetCode,
          skill_id: skillId,
          importance: skill.importance || skill.value || skill.scale?.importance || 50,
          level: skill.level || skill.scale?.value || skill.scale?.level || 50,
        };
      })
      .filter((m: any) => m !== null);
    
    if (mappings.length > 0) {
      const { error: mappingError } = await supabase
        .from('onet_occupation_skills')
        .upsert(mappings, { onConflict: 'onet_code,skill_id' });
        
      if (mappingError) {
        console.error(`Error upserting skill mappings for ${onetCode}:`, mappingError);
        throw mappingError;
      }
    }
    
    return mappings.length;
  } catch (error: any) {
    // If endpoint doesn't exist or returns error, log and continue
    if (error.message?.includes('404') || error.message?.includes('not found')) {
      console.log(`Skills endpoint not available for ${onetCode}`);
      return 0;
    }
    throw error;
  }
}

/**
 * Sync knowledge for a specific occupation
 */
async function syncOccupationKnowledge(supabase: any, onetCode: string): Promise<number> {
  console.log(`Syncing knowledge for ${onetCode}...`);
  
  try {
    const knowledgeData = await fetchONet(`/mnm/careers/${onetCode}/knowledge`);
    
    if (!knowledgeData || !Array.isArray(knowledgeData)) {
      console.log(`No knowledge data for ${onetCode}`);
      return 0;
    }
    
    // Flatten nested structure
    const allKnowledge: any[] = [];
    knowledgeData.forEach((category: any) => {
      if (category.element && Array.isArray(category.element)) {
        category.element.forEach((know: any) => {
          allKnowledge.push({
            ...know,
            category: category.name || category.category || null,
          });
        });
      }
    });
    
    if (allKnowledge.length === 0) {
      console.log(`No knowledge found in response for ${onetCode}. Response structure:`, JSON.stringify(knowledgeData).substring(0, 500));
      return 0;
    }
    
    console.log(`Found ${allKnowledge.length} knowledge areas for ${onetCode}`);
    
    // 1. Upsert knowledge into master table
    const knowledge = allKnowledge.map((know: any) => {
      // Try various ID field names
      const knowledgeId = know.id || know.element_id || know.knowledge_id || know.code || 
                         (know.name ? know.name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20) : null);
      
      if (!knowledgeId) {
        console.warn(`Knowledge missing ID field:`, JSON.stringify(know).substring(0, 200));
        return null;
      }
      
      return {
        knowledge_id: knowledgeId,
        name: know.name || know.title || 'Unknown Knowledge',
        category: know.category || null,
        description: know.description || null,
      };
    }).filter((k: any) => k !== null && k.knowledge_id && k.name);
    
    if (knowledge.length === 0) {
      console.error(`No valid knowledge extracted for ${onetCode}. All knowledge filtered out.`);
      return 0;
    }
    
    console.log(`Upserting ${knowledge.length} knowledge areas for ${onetCode}`);
    
    if (knowledge.length > 0) {
      const { error: knowledgeError } = await supabase
        .from('onet_knowledge')
        .upsert(knowledge, { onConflict: 'knowledge_id' });
        
      if (knowledgeError) {
        console.error(`Error upserting knowledge for ${onetCode}:`, knowledgeError);
        throw knowledgeError;
      }
    }
    
    // 2. Create occupation → knowledge mappings
    const mappings = allKnowledge
      .map((know: any) => {
        // Use same ID extraction logic as above
        const knowledgeId = know.id || know.element_id || know.knowledge_id || know.code || 
                           (know.name ? know.name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20) : null);
        
        if (!knowledgeId) return null;
        
        return {
          onet_code: onetCode,
          knowledge_id: knowledgeId,
          importance: know.importance || know.value || know.scale?.importance || 50,
          level: know.level || know.scale?.value || know.scale?.level || 50,
        };
      })
      .filter((m: any) => m !== null);
    
    if (mappings.length > 0) {
      const { error: mappingError } = await supabase
        .from('onet_occupation_knowledge')
        .upsert(mappings, { onConflict: 'onet_code,knowledge_id' });
        
      if (mappingError) {
        console.error(`Error upserting knowledge mappings for ${onetCode}:`, mappingError);
        throw mappingError;
      }
    }
    
    return mappings.length;
  } catch (error: any) {
    if (error.message?.includes('404') || error.message?.includes('not found')) {
      console.log(`Knowledge endpoint not available for ${onetCode}`);
      return 0;
    }
    throw error;
  }
}

/**
 * Sync tasks for a specific occupation
 */
async function syncOccupationTasks(supabase: any, onetCode: string): Promise<number> {
  console.log(`Syncing tasks for ${onetCode}...`);
  
  try {
    const careerData = await fetchONet(`/mnm/careers/${onetCode}`);
    
    // O*NET v2.0 might have tasks in different fields
    // Try multiple possible field names
    let tasks: any[] = [];
    
    if (careerData.on_the_job && Array.isArray(careerData.on_the_job)) {
      tasks = careerData.on_the_job;
    } else if (careerData.tasks && Array.isArray(careerData.tasks)) {
      tasks = careerData.tasks;
    } else if (careerData.task && Array.isArray(careerData.task)) {
      tasks = careerData.task;
    } else if (careerData.work_activities && Array.isArray(careerData.work_activities)) {
      tasks = careerData.work_activities;
    }
    
    // If tasks are objects, extract descriptions
    if (tasks.length > 0 && typeof tasks[0] === 'object') {
      tasks = tasks.map((t: any) => t.description || t.task || t.name || t.title || JSON.stringify(t));
    }
    
    console.log(`Found ${tasks.length} tasks for ${onetCode}. Sample fields in careerData:`, Object.keys(careerData).join(', '));
    
    if (!Array.isArray(tasks) || tasks.length === 0) {
      console.log(`No tasks found for ${onetCode}. Available fields:`, Object.keys(careerData));
      return 0;
    }
    
    // Delete existing tasks for this occupation (to handle updates)
    await supabase
      .from('onet_tasks')
      .delete()
      .eq('onet_code', onetCode);
    
    // Insert new tasks
    const taskRecords = tasks
      .filter((task: any) => task && (typeof task === 'string' ? task.trim() : true)) // Filter out empty tasks
      .map((task: any, index: number) => ({
        onet_code: onetCode,
        task_description: typeof task === 'string' ? task : (task.description || task.task || task.name || JSON.stringify(task)),
        task_order: index + 1,
      }));
    
    const { error } = await supabase
      .from('onet_tasks')
      .insert(taskRecords);
    
    if (error) {
      console.error(`Error inserting tasks for ${onetCode}:`, error);
      throw error;
    }
    
    return taskRecords.length;
  } catch (error: any) {
    if (error.message?.includes('404') || error.message?.includes('not found')) {
      console.log(`Tasks not available for ${onetCode}`);
      return 0;
    }
    throw error;
  }
}

/**
 * Sync technology skills for a specific occupation
 */
async function syncOccupationTechnology(supabase: any, onetCode: string): Promise<number> {
  console.log(`Syncing technology for ${onetCode}...`);
  
  try {
    const techData = await fetchONet(`/mnm/careers/${onetCode}/technology`);
    
    if (!techData || !Array.isArray(techData) || techData.length === 0) {
      return 0;
    }
    
    // Delete existing technology for this occupation
    await supabase
      .from('onet_technology_skills')
      .delete()
      .eq('onet_code', onetCode);
    
    const techRecords = techData.map((tech: any) => ({
      onet_code: onetCode,
      technology_name: tech.name || tech.title || tech.technology,
      technology_type: tech.type || tech.category || null,
      hot_technology: tech.hot_technology || false,
    })).filter((t: any) => t.technology_name);
    
    if (techRecords.length > 0) {
      const { error } = await supabase
        .from('onet_technology_skills')
        .insert(techRecords);
        
      if (error) {
        console.error(`Error inserting technology for ${onetCode}:`, error);
        throw error;
      }
    }
    
    return techRecords.length;
  } catch (error: any) {
    if (error.message?.includes('404') || error.message?.includes('not found')) {
      console.log(`Technology endpoint not available for ${onetCode}`);
      return 0;
    }
    // Don't throw - technology is optional
    console.log(`Error syncing technology for ${onetCode}:`, error.message);
    return 0;
  }
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
    // Create Supabase client with service role (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const url = new URL(req.url);
    const scope = url.searchParams.get('scope') || 'full';
    const onetCode = url.searchParams.get('code');
    const limit = parseInt(url.searchParams.get('limit') || '10'); // Default to 10 for testing
    
    let results = {
      success: true,
      scope,
      occupations_synced: 0,
      skills_synced: 0,
      knowledge_synced: 0,
      tasks_synced: 0,
      technology_synced: 0,
      errors: [] as string[],
    };
    
    if (scope === 'occupation' && onetCode) {
      // Sync single occupation
      console.log(`Syncing single occupation: ${onetCode}`);
      
      // First, sync the occupation itself
      try {
        await syncSingleOccupation(supabase, onetCode);
        results.occupations_synced = 1;
      } catch (error: any) {
        results.errors.push(`Occupation: ${error.message}`);
        throw error; // Can't continue without the occupation
      }
      
      // Sync all related data for this occupation
      try {
        const skillsCount = await syncOccupationSkills(supabase, onetCode);
        results.skills_synced = skillsCount;
      } catch (error: any) {
        results.errors.push(`Skills: ${error.message}`);
      }
      
      try {
        const knowledgeCount = await syncOccupationKnowledge(supabase, onetCode);
        results.knowledge_synced = knowledgeCount;
      } catch (error: any) {
        results.errors.push(`Knowledge: ${error.message}`);
      }
      
      try {
        const tasksCount = await syncOccupationTasks(supabase, onetCode);
        results.tasks_synced = tasksCount;
      } catch (error: any) {
        results.errors.push(`Tasks: ${error.message}`);
      }
      
      try {
        const techCount = await syncOccupationTechnology(supabase, onetCode);
        results.technology_synced = techCount;
      } catch (error: any) {
        results.errors.push(`Technology: ${error.message}`);
      }
      
    } else {
      // Full sync (with limit for testing)
      console.log(`Starting full sync (limit: ${limit})...`);
      
      const occupationCount = await syncOccupations(supabase, limit);
      results.occupations_synced = occupationCount;
      
      // Get list of occupation codes (with limit for testing)
      const { data: occupations, error: fetchError } = await supabase
        .from('onet_occupations')
        .select('onet_code')
        .limit(limit);
      
      if (fetchError) {
        throw fetchError;
      }
      
      if (!occupations || occupations.length === 0) {
        console.log('No occupations found in database. Run individual occupation syncs first.');
        return new Response(
          JSON.stringify({
            ...results,
            message: 'No occupations found. Try syncing individual occupations first, or use search to populate the list.',
          }),
          {
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json' 
            },
          }
        );
      }
      
      console.log(`Syncing ${occupations.length} occupations...`);
      
      // Sync each occupation's related data
      for (const occ of occupations) {
        // First, ensure we have full occupation details
        try {
          await syncSingleOccupation(supabase, occ.onet_code);
        } catch (error: any) {
          results.errors.push(`${occ.onet_code} occupation: ${error.message}`);
        }
        
        try {
          const skillsCount = await syncOccupationSkills(supabase, occ.onet_code);
          results.skills_synced += skillsCount;
        } catch (error: any) {
          results.errors.push(`${occ.onet_code} skills: ${error.message}`);
        }
        
        try {
          const knowledgeCount = await syncOccupationKnowledge(supabase, occ.onet_code);
          results.knowledge_synced += knowledgeCount;
        } catch (error: any) {
          results.errors.push(`${occ.onet_code} knowledge: ${error.message}`);
        }
        
        try {
          const tasksCount = await syncOccupationTasks(supabase, occ.onet_code);
          results.tasks_synced += tasksCount;
        } catch (error: any) {
          results.errors.push(`${occ.onet_code} tasks: ${error.message}`);
        }
        
        try {
          const techCount = await syncOccupationTechnology(supabase, occ.onet_code);
          results.technology_synced += techCount;
        } catch (error: any) {
          results.errors.push(`${occ.onet_code} technology: ${error.message}`);
        }
        
        // Rate limiting - be nice to O*NET API
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return new Response(
      JSON.stringify(results),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
      }
    );

  } catch (error: any) {
    console.error('Error in sync-onet-data function:', error);
    
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

