-- Migration: Recalculate checkpoint durations
-- Changes duration calculation from 1 min per question to 0.5 min per question
-- Only updates checkpoints that don't have a manual timeLimit set

-- Update all checkpoint tracks with recalculated durations
UPDATE tracks
SET duration_minutes = CEIL(
  (SELECT COUNT(*)::numeric * 0.5
   FROM jsonb_array_elements(transcript::jsonb -> 'questions'))
)
WHERE type = 'checkpoint'
  AND transcript IS NOT NULL
  AND transcript != ''
  -- Only update if no manual timeLimit is set (null or empty)
  AND (
    transcript::jsonb ->> 'timeLimit' IS NULL
    OR transcript::jsonb ->> 'timeLimit' = ''
  )
  -- Only update if there are questions
  AND jsonb_array_length(transcript::jsonb -> 'questions') > 0;

-- Log the update count
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % checkpoint track durations (0.5 min per question)', updated_count;
END $$;
