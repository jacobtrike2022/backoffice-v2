#!/usr/bin/env node
/**
 * O*NET Data Import Verification Script
 * 
 * Verifies the imported O*NET data by running count queries and spot checks.
 * 
 * Usage: npm run verify:onet
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load .env file if it exists
try {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove quotes
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    });
  }
} catch (error) {
  // Silently fail if .env can't be read
}

// Construct SUPABASE_URL from project ID if available
const projectId = process.env.VITE_SUPABASE_PROJECT_ID || process.env.SUPABASE_PROJECT_ID;
const explicitUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_URL = explicitUrl || (projectId ? `https://${projectId}.supabase.co` : null);

const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface TableStats {
  table: string;
  count: number;
  expected?: string;
  status: '✅' | '⚠️' | '❌';
}

async function verifyImport() {
  console.log('🔍 Verifying O*NET Data Import\n');
  console.log('='.repeat(60));
  
  const stats: TableStats[] = [];
  
  // Check occupations
  const { count: occupationsCount } = await supabase
    .from('onet_occupations')
    .select('*', { count: 'exact', head: true });
  
  stats.push({
    table: 'onet_occupations',
    count: occupationsCount || 0,
    expected: '~1,000',
    status: (occupationsCount || 0) > 500 ? '✅' : '⚠️',
  });
  
  // Check knowledge master
  const { count: knowledgeMasterCount } = await supabase
    .from('onet_knowledge')
    .select('*', { count: 'exact', head: true });
  
  stats.push({
    table: 'onet_knowledge (master)',
    count: knowledgeMasterCount || 0,
    expected: '~33',
    status: (knowledgeMasterCount || 0) > 20 ? '✅' : '⚠️',
  });
  
  // Check knowledge mappings
  const { count: knowledgeMappingsCount } = await supabase
    .from('onet_occupation_knowledge')
    .select('*', { count: 'exact', head: true });
  
  stats.push({
    table: 'onet_occupation_knowledge',
    count: knowledgeMappingsCount || 0,
    expected: '~33,000',
    status: (knowledgeMappingsCount || 0) > 10000 ? '✅' : '⚠️',
  });
  
  // Check skills master
  const { count: skillsMasterCount } = await supabase
    .from('onet_skills')
    .select('*', { count: 'exact', head: true });
  
  stats.push({
    table: 'onet_skills (master)',
    count: skillsMasterCount || 0,
    expected: '~35',
    status: (skillsMasterCount || 0) > 20 ? '✅' : '⚠️',
  });
  
  // Check skills mappings
  const { count: skillsMappingsCount } = await supabase
    .from('onet_occupation_skills')
    .select('*', { count: 'exact', head: true });
  
  stats.push({
    table: 'onet_occupation_skills',
    count: skillsMappingsCount || 0,
    expected: '~35,000',
    status: (skillsMappingsCount || 0) > 10000 ? '✅' : '⚠️',
  });
  
  // Check abilities master
  const { count: abilitiesMasterCount } = await supabase
    .from('onet_abilities')
    .select('*', { count: 'exact', head: true });
  
  stats.push({
    table: 'onet_abilities (master)',
    count: abilitiesMasterCount || 0,
    expected: '~52',
    status: (abilitiesMasterCount || 0) > 30 ? '✅' : '⚠️',
  });
  
  // Check abilities mappings
  const { count: abilitiesMappingsCount } = await supabase
    .from('onet_occupation_abilities')
    .select('*', { count: 'exact', head: true });
  
  stats.push({
    table: 'onet_occupation_abilities',
    count: abilitiesMappingsCount || 0,
    expected: '~52,000',
    status: (abilitiesMappingsCount || 0) > 10000 ? '✅' : '⚠️',
  });
  
  // Check tasks
  const { count: tasksCount } = await supabase
    .from('onet_tasks')
    .select('*', { count: 'exact', head: true });
  
  stats.push({
    table: 'onet_tasks',
    count: tasksCount || 0,
    expected: '~28,000',
    status: (tasksCount || 0) > 10000 ? '✅' : '⚠️',
  });
  
  // Check technology skills
  const { count: techCount } = await supabase
    .from('onet_technology_skills')
    .select('*', { count: 'exact', head: true });
  
  stats.push({
    table: 'onet_technology_skills',
    count: techCount || 0,
    expected: '~10,000+',
    status: (techCount || 0) > 1000 ? '✅' : '⚠️',
  });
  
  // Check detailed activities
  const { count: activitiesCount } = await supabase
    .from('onet_detailed_activities')
    .select('*', { count: 'exact', head: true });
  
  stats.push({
    table: 'onet_detailed_activities',
    count: activitiesCount || 0,
    expected: '~400',
    status: (activitiesCount || 0) > 200 ? '✅' : '⚠️',
  });
  
  // Print results
  console.log('\n📊 Table Statistics:\n');
  for (const stat of stats) {
    const countStr = stat.count.toLocaleString();
    const expectedStr = stat.expected ? ` (expected: ${stat.expected})` : '';
    console.log(`${stat.status} ${stat.table.padEnd(35)} ${countStr.padStart(10)}${expectedStr}`);
  }
  
  // Spot check: Cashiers (41-2011.00)
  console.log('\n' + '='.repeat(60));
  console.log('🔍 Spot Check: Cashiers (41-2011.00)\n');
  
  const { data: cashier } = await supabase
    .from('onet_occupations')
    .select('*')
    .eq('onet_code', '41-2011.00')
    .single();
  
  if (cashier) {
    console.log(`✅ Occupation found: ${cashier.title}`);
    console.log(`   Description: ${cashier.description?.substring(0, 100)}...`);
    console.log(`   Job Zone: ${cashier.job_zone || 'N/A'}`);
    console.log(`   Alternate Titles: ${cashier.also_called?.length || 0}`);
  } else {
    console.log('❌ Cashiers occupation not found');
  }
  
  // Check knowledge for cashiers
  const { data: cashierKnowledge } = await supabase
    .from('onet_occupation_knowledge')
    .select('knowledge_id, importance, level, onet_knowledge(name)')
    .eq('onet_code', '41-2011.00')
    .order('importance', { ascending: false })
    .limit(5);
  
  if (cashierKnowledge && cashierKnowledge.length > 0) {
    console.log(`\n✅ Top 5 Knowledge Areas:`);
    for (const kn of cashierKnowledge) {
      const knowledge = kn.onet_knowledge as any;
      console.log(`   • ${knowledge?.name || kn.knowledge_id}: Importance=${kn.importance}, Level=${kn.level}`);
    }
  } else {
    console.log('\n⚠️  No knowledge data found for Cashiers');
  }
  
  // Check skills for cashiers
  const { data: cashierSkills } = await supabase
    .from('onet_occupation_skills')
    .select('skill_id, importance, level, onet_skills(name)')
    .eq('onet_code', '41-2011.00')
    .order('importance', { ascending: false })
    .limit(5);
  
  if (cashierSkills && cashierSkills.length > 0) {
    console.log(`\n✅ Top 5 Skills:`);
    for (const sk of cashierSkills) {
      const skill = sk.onet_skills as any;
      console.log(`   • ${skill?.name || sk.skill_id}: Importance=${sk.importance}, Level=${sk.level}`);
    }
  } else {
    console.log('\n⚠️  No skills data found for Cashiers');
  }
  
  // Check tasks for cashiers
  const { data: cashierTasks } = await supabase
    .from('onet_tasks')
    .select('task_description, task_order')
    .eq('onet_code', '41-2011.00')
    .order('task_order', { ascending: true })
    .limit(5);
  
  if (cashierTasks && cashierTasks.length > 0) {
    console.log(`\n✅ Sample Tasks (${cashierTasks.length} shown):`);
    for (const task of cashierTasks) {
      console.log(`   ${task.task_order}. ${task.task_description.substring(0, 80)}...`);
    }
  } else {
    console.log('\n⚠️  No tasks found for Cashiers');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Verification Complete');
  console.log('='.repeat(60));
}

verifyImport().catch(console.error);

