-- Add logo columns to organizations table for KB Settings
-- Run this in Supabase SQL Editor to enable logo saving

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS kb_logo_dark TEXT,
ADD COLUMN IF NOT EXISTS kb_logo_light TEXT;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'organizations' 
  AND column_name IN ('kb_logo_dark', 'kb_logo_light');
