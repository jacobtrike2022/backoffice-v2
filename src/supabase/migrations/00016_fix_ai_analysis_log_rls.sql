-- ============================================
-- Fix AI Analysis Log RLS Policy
-- ============================================
-- This migration fixes the RLS policy issue that was preventing
-- the trigger from inserting into ai_analysis_log when tracks are updated.

-- Add INSERT policy for ai_analysis_log (was missing)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_analysis_log' AND policyname = 'Users can insert analysis logs for their org'
  ) THEN
    CREATE POLICY "Users can insert analysis logs for their org"
    ON ai_analysis_log FOR INSERT
    WITH CHECK (organization_id = get_user_organization_id());
  END IF;
END $$;

-- Update the trigger function to use SECURITY DEFINER
-- This allows the trigger to bypass RLS when inserting into ai_analysis_log
CREATE OR REPLACE FUNCTION enqueue_track_tag_analysis()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enqueue if title or description or transcript changed significantly
  IF (TG_OP = 'INSERT') OR 
     (OLD.title IS DISTINCT FROM NEW.title) OR 
     (OLD.description IS DISTINCT FROM NEW.description) OR
     (OLD.transcript IS DISTINCT FROM NEW.transcript) THEN
     
    INSERT INTO ai_analysis_log (track_id, organization_id, analysis_type, status)
    VALUES (NEW.id, NEW.organization_id, 'tags', 'pending')
    ON CONFLICT (track_id, analysis_type) DO UPDATE 
    SET status = 'pending', created_at = NOW()
    WHERE ai_analysis_log.status != 'processing';
    
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

