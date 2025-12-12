-- =====================================================
-- RENAME STORES.EMAIL TO STORES.STORE_EMAIL
-- More descriptive column name to avoid confusion
-- =====================================================

-- Rename the column from 'email' to 'store_email'
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='stores' AND column_name='email'
  ) THEN
    ALTER TABLE stores RENAME COLUMN email TO store_email;
  END IF;
END $$;

-- Update the index if it exists
DROP INDEX IF EXISTS idx_stores_email;
CREATE INDEX IF NOT EXISTS idx_stores_store_email ON stores(store_email) WHERE store_email IS NOT NULL;

-- Update the comment
COMMENT ON COLUMN stores.store_email IS 'Primary email contact for the store';

