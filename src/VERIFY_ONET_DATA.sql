-- =====================================================
-- O*NET DATA VERIFICATION SCRIPT
-- Run this in Supabase SQL Editor to check synced data
-- =====================================================

-- 1. CHECK OCCUPATIONS
-- =====================================================
SELECT 
  onet_code,
  title,
  CASE 
    WHEN description IS NULL THEN '❌ Missing description'
    WHEN description = '' THEN '⚠️ Empty description'
    ELSE '✅ Has description'
  END as description_status,
  CASE 
    WHEN job_zone IS NULL THEN '❌ Missing job_zone'
    ELSE '✅ Has job_zone: ' || job_zone::text
  END as job_zone_status,
  CASE 
    WHEN also_called IS NULL OR array_length(also_called, 1) IS NULL THEN '❌ No alternative titles'
    ELSE '✅ Has ' || array_length(also_called, 1)::text || ' alternative titles'
  END as also_called_status,
  created_at,
  updated_at
FROM onet_occupations
ORDER BY created_at DESC;

-- 2. CHECK SKILLS
-- =====================================================
SELECT 
  'Master Skills Table' as table_name,
  COUNT(*) as total_skills,
  COUNT(DISTINCT category) as unique_categories
FROM onet_skills;

SELECT 
  'Occupation-Skills Mappings' as table_name,
  COUNT(*) as total_mappings,
  COUNT(DISTINCT onet_code) as occupations_with_skills,
  COUNT(DISTINCT skill_id) as unique_skills_mapped
FROM onet_occupation_skills;

-- 3. CHECK KNOWLEDGE
-- =====================================================
SELECT 
  'Master Knowledge Table' as table_name,
  COUNT(*) as total_knowledge,
  COUNT(DISTINCT category) as unique_categories
FROM onet_knowledge;

SELECT 
  'Occupation-Knowledge Mappings' as table_name,
  COUNT(*) as total_mappings,
  COUNT(DISTINCT onet_code) as occupations_with_knowledge,
  COUNT(DISTINCT knowledge_id) as unique_knowledge_mapped
FROM onet_occupation_knowledge;

-- 4. CHECK TASKS
-- =====================================================
SELECT 
  onet_code,
  COUNT(*) as task_count,
  MIN(task_order) as min_order,
  MAX(task_order) as max_order
FROM onet_tasks
GROUP BY onet_code
ORDER BY onet_code;

-- 5. CHECK TECHNOLOGY
-- =====================================================
SELECT 
  onet_code,
  COUNT(*) as technology_count,
  COUNT(*) FILTER (WHERE hot_technology = true) as hot_tech_count
FROM onet_technology_skills
GROUP BY onet_code
ORDER BY onet_code;

-- 6. DETAILED VIEW FOR ONE OCCUPATION
-- =====================================================
-- Replace '41-2011.00' with any occupation code you want to inspect
SELECT 
  '=== OCCUPATION DETAILS ===' as section,
  o.onet_code,
  o.title,
  o.description,
  o.job_zone,
  o.also_called
FROM onet_occupations o
WHERE o.onet_code = '41-2011.00';

SELECT 
  '=== SKILLS ===' as section,
  s.skill_id,
  s.name,
  s.category,
  os.importance,
  os.level
FROM onet_occupation_skills os
JOIN onet_skills s ON os.skill_id = s.skill_id
WHERE os.onet_code = '41-2011.00'
ORDER BY os.importance DESC NULLS LAST;

SELECT 
  '=== KNOWLEDGE ===' as section,
  k.knowledge_id,
  k.name,
  k.category,
  ok.importance,
  ok.level
FROM onet_occupation_knowledge ok
JOIN onet_knowledge k ON ok.knowledge_id = k.knowledge_id
WHERE ok.onet_code = '41-2011.00'
ORDER BY ok.importance DESC NULLS LAST;

SELECT 
  '=== TASKS ===' as section,
  task_order,
  task_description
FROM onet_tasks
WHERE onet_code = '41-2011.00'
ORDER BY task_order;

SELECT 
  '=== TECHNOLOGY ===' as section,
  technology_name,
  technology_type,
  hot_technology
FROM onet_technology_skills
WHERE onet_code = '41-2011.00';

-- 7. SUMMARY STATISTICS
-- =====================================================
SELECT 
  'SUMMARY' as section,
  (SELECT COUNT(*) FROM onet_occupations) as total_occupations,
  (SELECT COUNT(*) FROM onet_skills) as total_skills,
  (SELECT COUNT(*) FROM onet_knowledge) as total_knowledge,
  (SELECT COUNT(*) FROM onet_tasks) as total_tasks,
  (SELECT COUNT(*) FROM onet_technology_skills) as total_technology,
  (SELECT COUNT(*) FROM onet_occupation_skills) as total_skill_mappings,
  (SELECT COUNT(*) FROM onet_occupation_knowledge) as total_knowledge_mappings;

