-- Add logo_url column to organizations table
-- This stores the scraped/uploaded primary logo for the organization

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add a comment explaining the column
COMMENT ON COLUMN organizations.logo_url IS 'Primary organization logo URL - may be scraped during onboarding or uploaded later';

-- Verify the column was added
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations'
    AND column_name = 'logo_url'
  ) THEN
    RAISE NOTICE 'Column logo_url added successfully to organizations table';
  ELSE
    RAISE WARNING 'Failed to add logo_url column to organizations table';
  END IF;
END $$;
