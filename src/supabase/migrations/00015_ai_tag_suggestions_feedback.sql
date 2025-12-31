-- ============================================
-- AI Tag Suggestions - Quality Signals
-- ============================================

ALTER TABLE ai_tag_suggestions 
ADD COLUMN IF NOT EXISTS feedback TEXT CHECK (feedback IN ('positive', 'negative')),
ADD COLUMN IF NOT EXISTS feedback_at TIMESTAMPTZ;

