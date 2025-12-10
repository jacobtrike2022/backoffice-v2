-- =====================================================
-- UPDATE STORES ADDRESS FIELDS
-- Separate street_address from full formatted address
-- Ensure city, state, zip, county are separate fields
-- =====================================================

-- Add street_address column if it doesn't exist (for the street line only)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name='stores' AND column_name='street_address') THEN
    ALTER TABLE stores ADD COLUMN street_address TEXT;
  END IF;
END $$;

-- The following columns should already exist from organizational_hierarchy.sql:
-- - city (TEXT)
-- - state (TEXT)  
-- - zip (TEXT)
-- - county (TEXT) - added in previous migration

-- Add latitude and longitude for map integration (optional but useful)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name='stores' AND column_name='latitude') THEN
    ALTER TABLE stores ADD COLUMN latitude DECIMAL(10, 8);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name='stores' AND column_name='longitude') THEN
    ALTER TABLE stores ADD COLUMN longitude DECIMAL(11, 8);
  END IF;
END $$;

-- Add place_id for Google Places reference (useful for updates/verification)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name='stores' AND column_name='place_id') THEN
    ALTER TABLE stores ADD COLUMN place_id TEXT;
  END IF;
END $$;

-- Create indexes for location-based queries
CREATE INDEX IF NOT EXISTS idx_stores_city ON stores(city);
CREATE INDEX IF NOT EXISTS idx_stores_state ON stores(state);
CREATE INDEX IF NOT EXISTS idx_stores_zip ON stores(zip);
CREATE INDEX IF NOT EXISTS idx_stores_county ON stores(county);
CREATE INDEX IF NOT EXISTS idx_stores_location ON stores(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN stores.street_address IS 'Street address only (e.g., "123 Main St")';
COMMENT ON COLUMN stores.address IS 'Full formatted address for display';
COMMENT ON COLUMN stores.city IS 'City/Town name';
COMMENT ON COLUMN stores.state IS 'State/Province (2-letter code preferred)';
COMMENT ON COLUMN stores.zip IS 'ZIP/Postal code';
COMMENT ON COLUMN stores.county IS 'County name';
COMMENT ON COLUMN stores.latitude IS 'Latitude coordinate (decimal degrees)';
COMMENT ON COLUMN stores.longitude IS 'Longitude coordinate (decimal degrees)';
COMMENT ON COLUMN stores.place_id IS 'Google Places ID for reference';
