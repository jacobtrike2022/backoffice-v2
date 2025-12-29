#!/usr/bin/env node
/**
 * O*NET Data Import Script
 * 
 * Imports O*NET SQL Server database exports into Supabase PostgreSQL tables.
 * Handles MS SQL Server syntax conversion, data pivoting (IM/LV scales), and batch upserts.
 * 
 * Usage: npm run import:onet
 * 
 * Requires:
 * - SUPABASE_URL environment variable
 * - SUPABASE_SERVICE_ROLE_KEY environment variable
 * - O*NET SQL files in ./Onet Data/ directory
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// =====================================================
// CONFIGURATION
// =====================================================

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
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

const ONET_DATA_DIR = path.join(process.cwd(), 'Onet Data');
const BATCH_SIZE = 500;

// =====================================================
// TYPES
// =====================================================

interface RawRating {
  onetsoc_code: string;
  element_id: string;
  scale_id: 'IM' | 'LV';
  data_value: number;
  recommend_suppress: string;
  not_relevant: string | null;
}

interface PivotedRating {
  onet_code: string;
  element_id: string;
  element_name: string;
  importance: number | null;
  level: number | null;
}

interface ContentModelRef {
  element_id: string;
  element_name: string;
  description: string | null;
}

interface Occupation {
  onet_code: string;
  title: string;
  description: string | null;
  job_zone: number | null;
}

interface Task {
  onet_code: string;
  task_description: string;
  task_order: number;
}

interface TechnologySkill {
  onet_code: string;
  technology_name: string;
  technology_type: string | null;
  hot_technology: boolean;
}

interface AlternateTitle {
  onet_code: string;
  title: string;
}

interface DetailedActivity {
  activity_id: string;
  name: string;
  category: string | null;
  description: string | null;
}

// =====================================================
// SQL PARSING UTILITIES
// =====================================================

/**
 * Parse SQL INSERT statements from MS SQL Server format
 * Handles: single quotes, NULL values, numbers, GO statements, nested parentheses
 */
function parseSQLInserts(filePath: string): any[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Remove GO statements (MS SQL batch separator)
  const cleaned = content.replace(/^\s*GO\s*$/gim, '');
  
  // Match INSERT INTO table (...) VALUES (...);
  // Use a more robust regex that handles nested parentheses
  const insertRegex = /INSERT INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(/gi;
  const records: any[] = [];
  
  let match;
  while ((match = insertRegex.exec(cleaned)) !== null) {
    const tableName = match[1];
    const startPos = match.index + match[0].length;
    
    // Find matching closing parenthesis for VALUES clause
    let depth = 1;
    let endPos = startPos;
    let inQuotes = false;
    let escapeNext = false;
    
    for (let i = startPos; i < cleaned.length && depth > 0; i++) {
      const char = cleaned[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char === "'") {
        inQuotes = !inQuotes;
        continue;
      }
      
      if (!inQuotes) {
        if (char === '(') depth++;
        if (char === ')') depth--;
      }
      
      endPos = i;
    }
    
    const valuesStr = cleaned.substring(startPos, endPos);
    
    // Parse values - handle quoted strings, numbers, NULL, nested structures
    const values: any[] = [];
    let current = '';
    inQuotes = false;
    escapeNext = false;
    let parenDepth = 0;
    
    for (let i = 0; i < valuesStr.length; i++) {
      const char = valuesStr[i];
      
      if (escapeNext) {
        current += char;
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        current += char;
        continue;
      }
      
      if (char === "'" && !escapeNext) {
        inQuotes = !inQuotes;
        current += char;
        continue;
      }
      
      if (!inQuotes) {
        if (char === '(') parenDepth++;
        if (char === ')') parenDepth--;
      }
      
      if (!inQuotes && parenDepth === 0 && char === ',') {
        // End of value
        const trimmed = current.trim();
        if (trimmed === 'NULL' || trimmed === '') {
          values.push(null);
        } else if (trimmed.match(/^-?\d+\.?\d*$/)) {
          values.push(parseFloat(trimmed));
        } else if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
          // Remove surrounding quotes and handle escaped quotes
          const unquoted = trimmed.slice(1, -1).replace(/''/g, "'");
          values.push(unquoted);
        } else {
          values.push(trimmed);
        }
        current = '';
        continue;
      }
      
      current += char;
    }
    
    // Handle last value
    if (current.trim()) {
      const trimmed = current.trim();
      if (trimmed === 'NULL' || trimmed === '') {
        values.push(null);
      } else if (trimmed.match(/^-?\d+\.?\d*$/)) {
        values.push(parseFloat(trimmed));
      } else if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
        const unquoted = trimmed.slice(1, -1).replace(/''/g, "'");
        values.push(unquoted);
      } else {
        values.push(trimmed);
      }
    }
    
    records.push({ tableName, values });
  }
  
  return records;
}

/**
 * Extract column names from CREATE TABLE statement
 */
function extractColumns(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const createMatch = content.match(/CREATE TABLE\s+\w+\s*\(([^)]+)\)/is);
  if (!createMatch) return [];
  
  const columns: string[] = [];
  const columnDefs = createMatch[1];
  const columnRegex = /(\w+)\s+[^,]+/g;
  let match;
  
  while ((match = columnRegex.exec(columnDefs)) !== null) {
    columns.push(match[1]);
  }
  
  return columns;
}

// =====================================================
// DATA TRANSFORMATION
// =====================================================

/**
 * Pivot IM/LV rows into single records with importance and level columns
 */
function pivotRatings(
  records: any[],
  columns: string[],
  contentModelRef: Map<string, ContentModelRef>
): PivotedRating[] {
  const grouped = new Map<string, { im?: number; lv?: number }>();
  
  for (const record of records) {
    const onetsocCodeIdx = columns.indexOf('onetsoc_code');
    const elementIdIdx = columns.indexOf('element_id');
    const scaleIdIdx = columns.indexOf('scale_id');
    const dataValueIdx = columns.indexOf('data_value');
    const recommendSuppressIdx = columns.indexOf('recommend_suppress');
    const notRelevantIdx = columns.indexOf('not_relevant');
    
    if (onetsocCodeIdx === -1 || elementIdIdx === -1 || scaleIdIdx === -1 || dataValueIdx === -1) {
      continue;
    }
    
    const onetsoc_code = record.values[onetsocCodeIdx];
    const element_id = record.values[elementIdIdx];
    const scale_id = record.values[scaleIdIdx];
    const data_value = record.values[dataValueIdx];
    const recommend_suppress = recommendSuppressIdx >= 0 ? record.values[recommendSuppressIdx] : 'N';
    const not_relevant = notRelevantIdx >= 0 ? record.values[notRelevantIdx] : null;
    
    // Skip suppressed or not relevant records
    if (recommend_suppress === 'Y' || not_relevant === 'Y') {
      continue;
    }
    
    const key = `${onetsoc_code}|${element_id}`;
    const existing = grouped.get(key) || {};
    
    if (scale_id === 'IM') {
      existing.im = data_value;
    } else if (scale_id === 'LV') {
      existing.lv = data_value;
    }
    
    grouped.set(key, existing);
  }
  
  return Array.from(grouped.entries()).map(([key, vals]) => {
    const [onet_code, element_id] = key.split('|');
    const ref = contentModelRef.get(element_id);
    
    return {
      onet_code,
      element_id,
      element_name: ref?.element_name || element_id,
      importance: vals.im ?? null,
      level: vals.lv ?? null,
    };
  });
}

// =====================================================
// IMPORT FUNCTIONS
// =====================================================

/**
 * Load Content Model Reference into memory
 */
async function loadContentModelReference(): Promise<Map<string, ContentModelRef>> {
  const filePath = path.join(ONET_DATA_DIR, '000 Content Model Reference O*NET 21.3.sql');
  
  if (!fs.existsSync(filePath)) {
    console.warn('⚠️  Content Model Reference file not found, using element_id as name');
    return new Map();
  }
  
  console.log('📖 Loading Content Model Reference...');
  const records = parseSQLInserts(filePath);
  const columns = extractColumns(filePath);
  
  const refMap = new Map<string, ContentModelRef>();
  
  for (const record of records) {
    const elementIdIdx = columns.indexOf('element_id');
    const elementNameIdx = columns.indexOf('element_name');
    const descriptionIdx = columns.indexOf('description');
    
    if (elementIdIdx === -1 || elementNameIdx === -1) continue;
    
    const element_id = record.values[elementIdIdx];
    const element_name = record.values[elementNameIdx];
    const description = descriptionIdx >= 0 ? record.values[descriptionIdx] : null;
    
    refMap.set(element_id, { element_id, element_name, description });
  }
  
  console.log(`✅ Loaded ${refMap.size} content model references`);
  return refMap;
}

/**
 * Import occupations
 */
async function importOccupations(): Promise<number> {
  const filePath = path.join(ONET_DATA_DIR, '017 Occupation Data.sql');
  
  if (!fs.existsSync(filePath)) {
    console.warn('⚠️  Occupation Data file not found');
    return 0;
  }
  
  console.log('📋 Importing occupations...');
  const records = parseSQLInserts(filePath);
  const columns = extractColumns(filePath);
  
  const occupations: Occupation[] = [];
  
  for (const record of records) {
    const onetsocCodeIdx = columns.indexOf('onetsoc_code');
    const titleIdx = columns.indexOf('title');
    const descriptionIdx = columns.indexOf('description');
    const jobZoneIdx = columns.indexOf('job_zone');
    
    if (onetsocCodeIdx === -1 || titleIdx === -1) continue;
    
    occupations.push({
      onet_code: record.values[onetsocCodeIdx],
      title: record.values[titleIdx],
      description: descriptionIdx >= 0 ? record.values[descriptionIdx] : null,
      job_zone: jobZoneIdx >= 0 ? (record.values[jobZoneIdx] ?? null) : null,
    });
  }
  
  // Batch upsert
  let imported = 0;
  for (let i = 0; i < occupations.length; i += BATCH_SIZE) {
    const batch = occupations.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('onet_occupations')
      .upsert(batch, { onConflict: 'onet_code' });
    
    if (error) {
      console.error(`❌ Error importing occupations batch ${i / BATCH_SIZE + 1}:`, error);
    } else {
      imported += batch.length;
      process.stdout.write(`\r   Progress: ${imported}/${occupations.length}`);
    }
  }
  
  console.log(`\n✅ Imported ${imported} occupations`);
  return imported;
}

/**
 * Import alternate titles
 */
async function importAlternateTitles(): Promise<number> {
  const filePath = path.join(ONET_DATA_DIR, '018 Alternate Titles.sql');
  
  if (!fs.existsSync(filePath)) {
    console.warn('⚠️  Alternate Titles file not found');
    return 0;
  }
  
  console.log('🏷️  Importing alternate titles...');
  const records = parseSQLInserts(filePath);
  const columns = extractColumns(filePath);
  
  const titles: AlternateTitle[] = [];
  
  for (const record of records) {
    const onetsocCodeIdx = columns.indexOf('onetsoc_code');
    const titleIdx = columns.indexOf('alternate_title');
    
    if (onetsocCodeIdx === -1 || titleIdx === -1) continue;
    
    titles.push({
      onet_code: record.values[onetsocCodeIdx],
      title: record.values[titleIdx],
    });
  }
  
  // Group by occupation and update also_called array
  const grouped = new Map<string, string[]>();
  for (const title of titles) {
    const existing = grouped.get(title.onet_code) || [];
    existing.push(title.title);
    grouped.set(title.onet_code, existing);
  }
  
  let imported = 0;
  for (const [onet_code, also_called] of grouped.entries()) {
    const { error } = await supabase
      .from('onet_occupations')
      .update({ also_called })
      .eq('onet_code', onet_code);
    
    if (error) {
      console.error(`❌ Error updating alternate titles for ${onet_code}:`, error);
    } else {
      imported++;
      if (imported % 100 === 0) {
        process.stdout.write(`\r   Progress: ${imported}/${grouped.size}`);
      }
    }
  }
  
  console.log(`\n✅ Updated ${imported} occupations with alternate titles`);
  return imported;
}

/**
 * Import tasks
 */
async function importTasks(): Promise<number> {
  const filePath = path.join(ONET_DATA_DIR, '006 Task Statements.sql');
  
  if (!fs.existsSync(filePath)) {
    console.warn('⚠️  Task Statements file not found');
    return 0;
  }
  
  console.log('📝 Importing tasks...');
  const records = parseSQLInserts(filePath);
  const columns = extractColumns(filePath);
  
  const tasks: Task[] = [];
  const taskOrderMap = new Map<string, number>();
  
  for (const record of records) {
    const onetsocCodeIdx = columns.indexOf('onetsoc_code');
    const taskIdx = columns.indexOf('task');
    const taskIdIdx = columns.indexOf('task_id');
    
    if (onetsocCodeIdx === -1 || taskIdx === -1) continue;
    
    const onet_code = record.values[onetsocCodeIdx];
    const task_description = record.values[taskIdx];
    
    // Track order by task_id if available
    const key = `${onet_code}|${task_description}`;
    if (!taskOrderMap.has(key)) {
      taskOrderMap.set(key, taskOrderMap.size + 1);
    }
    
    tasks.push({
      onet_code,
      task_description,
      task_order: taskOrderMap.get(key)!,
    });
  }
  
  // Batch upsert
  let imported = 0;
  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    const batch = tasks.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('onet_tasks')
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: true });
    
    if (error) {
      console.error(`❌ Error importing tasks batch ${i / BATCH_SIZE + 1}:`, error);
    } else {
      imported += batch.length;
      process.stdout.write(`\r   Progress: ${imported}/${tasks.length}`);
    }
  }
  
  console.log(`\n✅ Imported ${imported} tasks`);
  return imported;
}

/**
 * Import technology skills
 */
async function importTechnologySkills(): Promise<number> {
  const filePath = path.join(ONET_DATA_DIR, '010 Technology Skills.sql');
  
  if (!fs.existsSync(filePath)) {
    console.warn('⚠️  Technology Skills file not found');
    return 0;
  }
  
  console.log('💻 Importing technology skills...');
  const records = parseSQLInserts(filePath);
  const columns = extractColumns(filePath);
  
  const technologies: TechnologySkill[] = [];
  
  for (const record of records) {
    const onetsocCodeIdx = columns.indexOf('onetsoc_code');
    const technologyIdx = columns.indexOf('technology');
    const hotTechIdx = columns.indexOf('hot_technology');
    
    if (onetsocCodeIdx === -1 || technologyIdx === -1) continue;
    
    technologies.push({
      onet_code: record.values[onetsocCodeIdx],
      technology_name: record.values[technologyIdx],
      technology_type: null, // O*NET doesn't provide this in the export
      hot_technology: hotTechIdx >= 0 ? (record.values[hotTechIdx] === 'Y' || record.values[hotTechIdx] === true) : false,
    });
  }
  
  // Batch upsert
  let imported = 0;
  for (let i = 0; i < technologies.length; i += BATCH_SIZE) {
    const batch = technologies.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('onet_technology_skills')
      .upsert(batch, { onConflict: 'id', ignoreDuplicates: true });
    
    if (error) {
      console.error(`❌ Error importing technology skills batch ${i / BATCH_SIZE + 1}:`, error);
    } else {
      imported += batch.length;
      process.stdout.write(`\r   Progress: ${imported}/${technologies.length}`);
    }
  }
  
  console.log(`\n✅ Imported ${imported} technology skills`);
  return imported;
}

/**
 * Import detailed work activities
 */
async function importDetailedActivities(contentModelRef: Map<string, ContentModelRef>): Promise<number> {
  const filePath = path.join(ONET_DATA_DIR, '013 Detailed Work Activities.sql');
  
  if (!fs.existsSync(filePath)) {
    console.warn('⚠️  Detailed Work Activities file not found');
    return 0;
  }
  
  console.log('🔧 Importing detailed work activities...');
  const records = parseSQLInserts(filePath);
  const columns = extractColumns(filePath);
  
  const activities: DetailedActivity[] = [];
  const seen = new Set<string>();
  
  for (const record of records) {
    const elementIdIdx = columns.indexOf('element_id');
    
    if (elementIdIdx === -1) continue;
    
    const activity_id = record.values[elementIdIdx];
    if (seen.has(activity_id)) continue;
    seen.add(activity_id);
    
    const ref = contentModelRef.get(activity_id);
    
    activities.push({
      activity_id,
      name: ref?.element_name || activity_id,
      category: null, // Extract from element_id pattern if needed
      description: ref?.description || null,
    });
  }
  
  // Batch upsert
  let imported = 0;
  for (let i = 0; i < activities.length; i += BATCH_SIZE) {
    const batch = activities.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('onet_detailed_activities')
      .upsert(batch, { onConflict: 'activity_id' });
    
    if (error) {
      console.error(`❌ Error importing activities batch ${i / BATCH_SIZE + 1}:`, error);
    } else {
      imported += batch.length;
      process.stdout.write(`\r   Progress: ${imported}/${activities.length}`);
    }
  }
  
  console.log(`\n✅ Imported ${imported} detailed work activities`);
  return imported;
}

/**
 * Import knowledge with pivot transformation
 */
async function importKnowledge(contentModelRef: Map<string, ContentModelRef>): Promise<number> {
  const filePath = path.join(ONET_DATA_DIR, '001 Knowledge.sql');
  
  if (!fs.existsSync(filePath)) {
    console.warn('⚠️  Knowledge file not found');
    return 0;
  }
  
  console.log('🧠 Importing knowledge...');
  const records = parseSQLInserts(filePath);
  const columns = extractColumns(filePath);
  
  // Pivot the data
  const pivoted = pivotRatings(records, columns, contentModelRef);
  
  // Extract unique knowledge elements for master table
  const knowledgeMap = new Map<string, { name: string; category: string | null }>();
  for (const item of pivoted) {
    if (!knowledgeMap.has(item.element_id)) {
      const ref = contentModelRef.get(item.element_id);
      knowledgeMap.set(item.element_id, {
        name: item.element_name,
        category: null, // Extract from element_id pattern if needed
      });
    }
  }
  
  // Upsert master knowledge table
  const knowledgeMaster = Array.from(knowledgeMap.entries()).map(([knowledge_id, data]) => ({
    knowledge_id,
    name: data.name,
    category: data.category,
    description: null,
  }));
  
  let masterImported = 0;
  for (let i = 0; i < knowledgeMaster.length; i += BATCH_SIZE) {
    const batch = knowledgeMaster.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('onet_knowledge')
      .upsert(batch, { onConflict: 'knowledge_id' });
    
    if (error) {
      console.error(`❌ Error importing knowledge master batch ${i / BATCH_SIZE + 1}:`, error);
    } else {
      masterImported += batch.length;
    }
  }
  
  console.log(`   ✅ Imported ${masterImported} knowledge elements (master table)`);
  
  // Upsert occupation-knowledge mappings
  const mappings = pivoted.map(item => ({
    onet_code: item.onet_code,
    knowledge_id: item.element_id,
    importance: item.importance,
    level: item.level,
  }));
  
  let mappingImported = 0;
  for (let i = 0; i < mappings.length; i += BATCH_SIZE) {
    const batch = mappings.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('onet_occupation_knowledge')
      .upsert(batch, { onConflict: 'onet_code,knowledge_id' });
    
    if (error) {
      console.error(`❌ Error importing knowledge mappings batch ${i / BATCH_SIZE + 1}:`, error);
    } else {
      mappingImported += batch.length;
      process.stdout.write(`\r   Progress: ${mappingImported}/${mappings.length} mappings`);
    }
  }
  
  console.log(`\n✅ Imported ${mappingImported} knowledge mappings`);
  return mappingImported;
}

/**
 * Import skills with pivot transformation
 */
async function importSkills(contentModelRef: Map<string, ContentModelRef>): Promise<number> {
  const filePath = path.join(ONET_DATA_DIR, '002 Skills.sql');
  
  if (!fs.existsSync(filePath)) {
    console.warn('⚠️  Skills file not found');
    return 0;
  }
  
  console.log('🎯 Importing skills...');
  const records = parseSQLInserts(filePath);
  const columns = extractColumns(filePath);
  
  // Pivot the data
  const pivoted = pivotRatings(records, columns, contentModelRef);
  
  // Extract unique skills for master table
  const skillsMap = new Map<string, { name: string; category: string | null }>();
  for (const item of pivoted) {
    if (!skillsMap.has(item.element_id)) {
      skillsMap.set(item.element_id, {
        name: item.element_name,
        category: null,
      });
    }
  }
  
  // Upsert master skills table
  const skillsMaster = Array.from(skillsMap.entries()).map(([skill_id, data]) => ({
    skill_id,
    name: data.name,
    category: data.category,
    description: null,
  }));
  
  let masterImported = 0;
  for (let i = 0; i < skillsMaster.length; i += BATCH_SIZE) {
    const batch = skillsMaster.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('onet_skills')
      .upsert(batch, { onConflict: 'skill_id' });
    
    if (error) {
      console.error(`❌ Error importing skills master batch ${i / BATCH_SIZE + 1}:`, error);
    } else {
      masterImported += batch.length;
    }
  }
  
  console.log(`   ✅ Imported ${masterImported} skills (master table)`);
  
  // Upsert occupation-skills mappings
  const mappings = pivoted.map(item => ({
    onet_code: item.onet_code,
    skill_id: item.element_id,
    importance: item.importance,
    level: item.level,
  }));
  
  let mappingImported = 0;
  for (let i = 0; i < mappings.length; i += BATCH_SIZE) {
    const batch = mappings.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('onet_occupation_skills')
      .upsert(batch, { onConflict: 'onet_code,skill_id' });
    
    if (error) {
      console.error(`❌ Error importing skills mappings batch ${i / BATCH_SIZE + 1}:`, error);
    } else {
      mappingImported += batch.length;
      process.stdout.write(`\r   Progress: ${mappingImported}/${mappings.length} mappings`);
    }
  }
  
  console.log(`\n✅ Imported ${mappingImported} skills mappings`);
  return mappingImported;
}

/**
 * Import abilities with pivot transformation
 */
async function importAbilities(contentModelRef: Map<string, ContentModelRef>): Promise<number> {
  const filePath = path.join(ONET_DATA_DIR, '003 Abilities.sql');
  
  if (!fs.existsSync(filePath)) {
    console.warn('⚠️  Abilities file not found');
    return 0;
  }
  
  console.log('💪 Importing abilities...');
  const records = parseSQLInserts(filePath);
  const columns = extractColumns(filePath);
  
  // Pivot the data
  const pivoted = pivotRatings(records, columns, contentModelRef);
  
  // Extract unique abilities for master table
  const abilitiesMap = new Map<string, { name: string; category: string | null }>();
  for (const item of pivoted) {
    if (!abilitiesMap.has(item.element_id)) {
      abilitiesMap.set(item.element_id, {
        name: item.element_name,
        category: null,
      });
    }
  }
  
  // Upsert master abilities table
  const abilitiesMaster = Array.from(abilitiesMap.entries()).map(([ability_id, data]) => ({
    ability_id,
    name: data.name,
    category: data.category,
    description: null,
  }));
  
  let masterImported = 0;
  for (let i = 0; i < abilitiesMaster.length; i += BATCH_SIZE) {
    const batch = abilitiesMaster.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('onet_abilities')
      .upsert(batch, { onConflict: 'ability_id' });
    
    if (error) {
      console.error(`❌ Error importing abilities master batch ${i / BATCH_SIZE + 1}:`, error);
    } else {
      masterImported += batch.length;
    }
  }
  
  console.log(`   ✅ Imported ${masterImported} abilities (master table)`);
  
  // Upsert occupation-abilities mappings
  const mappings = pivoted.map(item => ({
    onet_code: item.onet_code,
    ability_id: item.element_id,
    importance: item.importance,
    level: item.level,
  }));
  
  let mappingImported = 0;
  for (let i = 0; i < mappings.length; i += BATCH_SIZE) {
    const batch = mappings.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('onet_occupation_abilities')
      .upsert(batch, { onConflict: 'onet_code,ability_id' });
    
    if (error) {
      console.error(`❌ Error importing abilities mappings batch ${i / BATCH_SIZE + 1}:`, error);
    } else {
      mappingImported += batch.length;
      process.stdout.write(`\r   Progress: ${mappingImported}/${mappings.length} mappings`);
    }
  }
  
  console.log(`\n✅ Imported ${mappingImported} abilities mappings`);
  return mappingImported;
}

// =====================================================
// MAIN EXECUTION
// =====================================================

async function main() {
  console.log('🚀 Starting O*NET Data Import\n');
  console.log(`📁 Data directory: ${ONET_DATA_DIR}\n`);
  
  if (!fs.existsSync(ONET_DATA_DIR)) {
    console.error(`❌ Data directory not found: ${ONET_DATA_DIR}`);
    console.error('   Please create the directory and place O*NET SQL files there');
    process.exit(1);
  }
  
  const startTime = Date.now();
  const stats = {
    occupations: 0,
    alternateTitles: 0,
    tasks: 0,
    technologySkills: 0,
    detailedActivities: 0,
    knowledge: 0,
    skills: 0,
    abilities: 0,
  };
  
  try {
    // Step 1: Load Content Model Reference
    const contentModelRef = await loadContentModelReference();
    
    // Step 2: Import in dependency order
    stats.occupations = await importOccupations();
    stats.alternateTitles = await importAlternateTitles();
    stats.tasks = await importTasks();
    stats.technologySkills = await importTechnologySkills();
    stats.detailedActivities = await importDetailedActivities(contentModelRef);
    stats.knowledge = await importKnowledge(contentModelRef);
    stats.skills = await importSkills(contentModelRef);
    stats.abilities = await importAbilities(contentModelRef);
    
    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n' + '='.repeat(60));
    console.log('✅ Import Complete!');
    console.log('='.repeat(60));
    console.log(`📊 Statistics:`);
    console.log(`   Occupations: ${stats.occupations}`);
    console.log(`   Alternate Titles: ${stats.alternateTitles}`);
    console.log(`   Tasks: ${stats.tasks}`);
    console.log(`   Technology Skills: ${stats.technologySkills}`);
    console.log(`   Detailed Activities: ${stats.detailedActivities}`);
    console.log(`   Knowledge Mappings: ${stats.knowledge}`);
    console.log(`   Skills Mappings: ${stats.skills}`);
    console.log(`   Abilities Mappings: ${stats.abilities}`);
    console.log(`\n⏱️  Duration: ${duration}s`);
    console.log('='.repeat(60));
    
  } catch (error: any) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { main };

