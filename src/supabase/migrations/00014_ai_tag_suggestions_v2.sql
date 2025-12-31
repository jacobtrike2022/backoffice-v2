-- ============================================
-- AI Tag Suggestions V2 - Observability and Background Processing
-- ============================================

-- Add observability columns
ALTER TABLE ai_tag_suggestions 
ADD COLUMN IF NOT EXISTS prompt_hash TEXT,
ADD COLUMN IF NOT EXISTS response_hash TEXT,
ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER,
ADD COLUMN IF NOT EXISTS model_version TEXT DEFAULT 'gpt-4o';

-- Track analysis status (can be used for background jobs)
CREATE TABLE IF NOT EXISTS ai_analysis_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL, -- 'tags', 'key_facts', etc.
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for pending analysis
CREATE INDEX IF NOT EXISTS idx_ai_analysis_log_pending 
ON ai_analysis_log(status, created_at) 
WHERE status = 'pending';

-- RLS for analysis log
ALTER TABLE ai_analysis_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view analysis logs for their org"
ON ai_analysis_log FOR SELECT
USING (organization_id = get_user_organization_id());

-- Function to enqueue tag analysis on track change
CREATE OR REPLACE FUNCTION enqueue_track_tag_analysis()
RETURNS TRIGGER AS $$
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

-- Trigger for tracks table
-- NOTE: We use UNIQUE index to prevent multiple pending analyses for same track/type
ALTER TABLE ai_analysis_log ADD CONSTRAINT unique_track_analysis_type UNIQUE (track_id, analysis_type);

DROP TRIGGER IF EXISTS trigger_enqueue_tag_analysis ON tracks;
CREATE TRIGGER trigger_enqueue_tag_analysis
AFTER INSERT OR UPDATE ON tracks
FOR EACH ROW EXECUTE FUNCTION enqueue_track_tag_analysis();


