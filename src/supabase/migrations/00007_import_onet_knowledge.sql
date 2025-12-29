-- =====================================================
-- Import O*NET Knowledge Data from SQL Export
-- This migration imports data from the O*NET Knowledge Database.sql file
-- =====================================================

-- Step 1: Create a temporary staging table matching O*NET's structure
CREATE TABLE IF NOT EXISTS onet_knowledge_staging (
  onetsoc_code CHARACTER(10) NOT NULL,
  element_id CHARACTER VARYING(20) NOT NULL,
  scale_id CHARACTER VARYING(3) NOT NULL,
  data_value DECIMAL(5,2) NOT NULL,
  n DECIMAL(4,0),
  standard_error DECIMAL(7,4),
  lower_ci_bound DECIMAL(7,4),
  upper_ci_bound DECIMAL(7,4),
  recommend_suppress CHARACTER(1),
  not_relevant CHARACTER(1),
  date_updated DATE NOT NULL,
  domain_source CHARACTER VARYING(30) NOT NULL
);

-- Step 2: Import the data (you'll need to copy/paste the INSERT statements from the SQL file)
-- For now, this is a placeholder - you'll need to run the actual INSERT statements
-- from the O*NET Knowledge Database.sql file into this staging table

-- Step 3: Extract unique knowledge elements and populate master knowledge table
-- Note: We'll need content_model_reference table for names, but for now we'll use element_id as name
INSERT INTO onet_knowledge (knowledge_id, name, category, description)
SELECT DISTINCT
  element_id as knowledge_id,
  element_id as name, -- Placeholder - will need content_model_reference for actual names
  CASE 
    WHEN element_id LIKE '2.C.1%' THEN 'Administration and Management'
    WHEN element_id LIKE '2.C.2%' THEN 'Economics and Accounting'
    WHEN element_id LIKE '2.C.3%' THEN 'Sales and Marketing'
    WHEN element_id LIKE '2.C.4%' THEN 'Customer and Personal Service'
    WHEN element_id LIKE '2.C.5%' THEN 'Personnel and Human Resources'
    WHEN element_id LIKE '2.C.6%' THEN 'Production and Processing'
    WHEN element_id LIKE '2.C.7%' THEN 'Food Production'
    WHEN element_id LIKE '2.C.8%' THEN 'Computers and Electronics'
    WHEN element_id LIKE '2.C.9%' THEN 'Engineering and Technology'
    WHEN element_id LIKE '2.C.10%' THEN 'Design'
    WHEN element_id LIKE '2.C.11%' THEN 'Building and Construction'
    WHEN element_id LIKE '2.C.12%' THEN 'Mechanical'
    WHEN element_id LIKE '2.C.13%' THEN 'Chemistry'
    WHEN element_id LIKE '2.C.14%' THEN 'Biology'
    WHEN element_id LIKE '2.C.15%' THEN 'Psychology'
    WHEN element_id LIKE '2.C.16%' THEN 'Sociology and Anthropology'
    WHEN element_id LIKE '2.C.17%' THEN 'Geography'
    WHEN element_id LIKE '2.C.18%' THEN 'Medicine and Dentistry'
    WHEN element_id LIKE '2.C.19%' THEN 'Therapy and Counseling'
    WHEN element_id LIKE '2.C.20%' THEN 'Education and Training'
    WHEN element_id LIKE '2.C.21%' THEN 'English Language'
    WHEN element_id LIKE '2.C.22%' THEN 'Foreign Language'
    WHEN element_id LIKE '2.C.23%' THEN 'Fine Arts'
    WHEN element_id LIKE '2.C.24%' THEN 'History and Archeology'
    WHEN element_id LIKE '2.C.25%' THEN 'Philosophy and Theology'
    WHEN element_id LIKE '2.C.26%' THEN 'Public Safety and Security'
    WHEN element_id LIKE '2.C.27%' THEN 'Law and Government'
    WHEN element_id LIKE '2.C.28%' THEN 'Telecommunications'
    WHEN element_id LIKE '2.C.29%' THEN 'Transportation'
    ELSE 'Other'
  END as category,
  NULL as description
FROM onet_knowledge_staging
WHERE element_id IS NOT NULL
ON CONFLICT (knowledge_id) DO NOTHING;

-- Step 4: Transform and import occupation-knowledge mappings
-- Pivot the data: IM scale_id → importance, LV scale_id → level
INSERT INTO onet_occupation_knowledge (onet_code, knowledge_id, importance, level)
SELECT 
  im.onetsoc_code as onet_code,
  im.element_id as knowledge_id,
  im.data_value as importance,
  COALESCE(lv.data_value, 0) as level
FROM onet_knowledge_staging im
LEFT JOIN onet_knowledge_staging lv 
  ON im.onetsoc_code = lv.onetsoc_code 
  AND im.element_id = lv.element_id 
  AND lv.scale_id = 'LV'
WHERE im.scale_id = 'IM'
  AND im.recommend_suppress != 'Y' -- Exclude suppressed data
  AND (im.not_relevant IS NULL OR im.not_relevant != 'Y') -- Exclude not relevant
ON CONFLICT (onet_code, knowledge_id) 
DO UPDATE SET
  importance = EXCLUDED.importance,
  level = EXCLUDED.level,
  updated_at = NOW();

-- Step 5: Clean up staging table (optional - comment out if you want to keep it for reference)
-- DROP TABLE IF EXISTS onet_knowledge_staging;

-- =====================================================
-- NOTES:
-- 1. You'll need to import the actual INSERT statements from O*NET Knowledge Database.sql
--    into the onet_knowledge_staging table first
-- 2. If you have the content_model_reference table, update the knowledge names
-- 3. This script handles the pivot from O*NET's row-based format (IM/LV) to our column-based format
-- =====================================================

