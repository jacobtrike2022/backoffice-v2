-- =====================================================
-- ADD ADDRESS LINE 2 COLUMN TO STORES TABLE
-- Supports suite, apartment, unit numbers, etc.
-- =====================================================

-- Add address_line_2 column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stores' 
    AND column_name = 'address_line_2'
  ) THEN
    ALTER TABLE stores ADD COLUMN address_line_2 TEXT;
    RAISE NOTICE 'Added address_line_2 column to stores table';
  ELSE
    RAISE NOTICE 'address_line_2 column already exists in stores table';
  END IF;
END $$;
