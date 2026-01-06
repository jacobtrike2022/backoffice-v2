-- ============================================
-- AI Tag Suggestions - Add description field
-- ============================================
-- The description field stores a contextual hint about what content
-- belongs in this tag (for future AI classification), separate from
-- the reasoning field which explains why the tag is being suggested.

ALTER TABLE ai_tag_suggestions
ADD COLUMN IF NOT EXISTS suggested_description TEXT;

-- Add comment for clarity
COMMENT ON COLUMN ai_tag_suggestions.suggested_description IS
'Contextual description of what content belongs in this tag (for AI classification). Different from reasoning which justifies why the tag is needed.';
