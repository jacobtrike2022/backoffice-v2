-- ============================================
-- AI Tag Suggestions - Add parent tag ID reference
-- ============================================
-- This allows the frontend to directly pre-select the correct parent
-- when creating a new tag from an AI suggestion

ALTER TABLE ai_tag_suggestions
ADD COLUMN IF NOT EXISTS suggested_parent_id UUID REFERENCES tags(id) ON DELETE SET NULL;

-- Add index for looking up suggestions by parent
CREATE INDEX IF NOT EXISTS idx_ai_tag_suggestions_parent
ON ai_tag_suggestions(suggested_parent_id)
WHERE suggested_parent_id IS NOT NULL;

COMMENT ON COLUMN ai_tag_suggestions.suggested_parent_id IS
  'Reference to the parent tag (subcategory) where this new tag should be created as a child';
