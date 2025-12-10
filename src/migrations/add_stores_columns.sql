-- =====================================================
-- ADD MISSING COLUMNS TO STORES TABLE
-- Adds email, county, and photo_url columns
-- =====================================================

-- Add email column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name='stores' AND column_name='email') THEN
    ALTER TABLE stores ADD COLUMN email TEXT;
  END IF;
END $$;

-- Add county column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name='stores' AND column_name='county') THEN
    ALTER TABLE stores ADD COLUMN county TEXT;
  END IF;
END $$;

-- Add photo_url column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name='stores' AND column_name='photo_url') THEN
    ALTER TABLE stores ADD COLUMN photo_url TEXT;
  END IF;
END $$;

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_stores_email ON stores(email) WHERE email IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN stores.email IS 'Primary email contact for the store';
COMMENT ON COLUMN stores.county IS 'County where the store is located';
COMMENT ON COLUMN stores.photo_url IS 'Public URL of store photo in Supabase Storage';
