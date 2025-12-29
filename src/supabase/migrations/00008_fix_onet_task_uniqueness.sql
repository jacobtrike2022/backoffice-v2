-- =====================================================
-- Fix Unique Constraints for O*NET Data Imports
-- =====================================================
-- Purpose: Add unique constraints to enable proper upsert behavior
--          for idempotent data imports
-- =====================================================

-- Tasks: prevent duplicate tasks per occupation
ALTER TABLE onet_tasks 
ADD CONSTRAINT IF NOT EXISTS onet_tasks_unique_task 
UNIQUE (onet_code, task_description);

COMMENT ON CONSTRAINT onet_tasks_unique_task ON onet_tasks IS 
'Ensures each task description is unique per occupation for proper upsert behavior';

-- Technology Skills: prevent duplicate technologies per occupation  
ALTER TABLE onet_technology_skills 
ADD CONSTRAINT IF NOT EXISTS onet_tech_skills_unique 
UNIQUE (onet_code, technology_name);

COMMENT ON CONSTRAINT onet_tech_skills_unique ON onet_technology_skills IS 
'Ensures each technology is unique per occupation for proper upsert behavior';

