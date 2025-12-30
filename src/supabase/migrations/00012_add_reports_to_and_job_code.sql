-- Add reports_to field (self-referencing)
ALTER TABLE roles 
ADD COLUMN IF NOT EXISTS reports_to_role_id UUID REFERENCES roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_roles_reports_to ON roles(reports_to_role_id);

-- Rename display_name to job_code if not already renamed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'roles' 
      AND column_name = 'display_name'
  ) AND NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'roles' 
      AND column_name = 'job_code'
  ) THEN
    ALTER TABLE roles RENAME COLUMN display_name TO job_code;
  END IF;
END $$;

