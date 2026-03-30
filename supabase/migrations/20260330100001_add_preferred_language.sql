-- Add preferred_language column to organizations table
-- Supports org-level UI language preference (default: English)

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en';

COMMENT ON COLUMN organizations.preferred_language
  IS 'UI language preference for this organization. Supported: en, es. Default: en.';
