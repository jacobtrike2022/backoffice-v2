-- Add submission_config JSONB column to forms table (idempotent)
ALTER TABLE forms ADD COLUMN IF NOT EXISTS submission_config JSONB DEFAULT '{}';
