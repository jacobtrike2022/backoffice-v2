-- Seed data for districts and stores
-- Run this after organizational_hierarchy.sql

-- Get the Demo Company organization ID
DO $$
DECLARE
  demo_org_id uuid;
BEGIN
  -- Get Demo Company org ID
  SELECT organization_id INTO demo_org_id
  FROM roles
  WHERE role_name = 'Trike Super Admin'
  LIMIT 1;

  -- Insert Districts
  INSERT INTO districts (organization_id, district_name, district_code) VALUES
    (demo_org_id, 'Northeast District', 'NE'),
    (demo_org_id, 'Southeast District', 'SE'),
    (demo_org_id, 'Midwest District', 'MW'),
    (demo_org_id, 'West Coast District', 'WC');

  -- Insert Stores
  -- Northeast District Stores
  INSERT INTO stores (organization_id, district_id, store_name, store_code, address, city, state, zip_code)
  SELECT 
    demo_org_id,
    d.district_id,
    'Boston Flagship',
    '101',
    '123 Boylston Street',
    'Boston',
    'MA',
    '02116'
  FROM districts d WHERE d.district_code = 'NE' AND d.organization_id = demo_org_id;

  INSERT INTO stores (organization_id, district_id, store_name, store_code, address, city, state, zip_code)
  SELECT 
    demo_org_id,
    d.district_id,
    'New York Times Square',
    '102',
    '789 Broadway',
    'New York',
    'NY',
    '10003'
  FROM districts d WHERE d.district_code = 'NE' AND d.organization_id = demo_org_id;

  -- Southeast District Stores
  INSERT INTO stores (organization_id, district_id, store_name, store_code, address, city, state, zip_code)
  SELECT 
    demo_org_id,
    d.district_id,
    'Atlanta Perimeter',
    '201',
    '456 Peachtree Street',
    'Atlanta',
    'GA',
    '30303'
  FROM districts d WHERE d.district_code = 'SE' AND d.organization_id = demo_org_id;

  INSERT INTO stores (organization_id, district_id, store_name, store_code, address, city, state, zip_code)
  SELECT 
    demo_org_id,
    d.district_id,
    'Miami Beach',
    '202',
    '100 Ocean Drive',
    'Miami Beach',
    'FL',
    '33139'
  FROM districts d WHERE d.district_code = 'SE' AND d.organization_id = demo_org_id;

  -- Midwest District Stores
  INSERT INTO stores (organization_id, district_id, store_name, store_code, address, city, state, zip_code)
  SELECT 
    demo_org_id,
    d.district_id,
    'Chicago Magnificent Mile',
    '301',
    '900 N Michigan Ave',
    'Chicago',
    'IL',
    '60611'
  FROM districts d WHERE d.district_code = 'MW' AND d.organization_id = demo_org_id;

  INSERT INTO stores (organization_id, district_id, store_name, store_code, address, city, state, zip_code)
  SELECT 
    demo_org_id,
    d.district_id,
    'Minneapolis Mall of America',
    '302',
    '60 E Broadway',
    'Bloomington',
    'MN',
    '55425'
  FROM districts d WHERE d.district_code = 'MW' AND d.organization_id = demo_org_id;

  -- West Coast District Stores
  INSERT INTO stores (organization_id, district_id, store_name, store_code, address, city, state, zip_code)
  SELECT 
    demo_org_id,
    d.district_id,
    'Los Angeles Beverly Center',
    '401',
    '8500 Beverly Blvd',
    'Los Angeles',
    'CA',
    '90048'
  FROM districts d WHERE d.district_code = 'WC' AND d.organization_id = demo_org_id;

  INSERT INTO stores (organization_id, district_id, store_name, store_code, address, city, state, zip_code)
  SELECT 
    demo_org_id,
    d.district_id,
    'San Francisco Union Square',
    '402',
    '865 Market Street',
    'San Francisco',
    'CA',
    '94103'
  FROM districts d WHERE d.district_code = 'WC' AND d.organization_id = demo_org_id;

  INSERT INTO stores (organization_id, district_id, store_name, store_code, address, city, state, zip_code)
  SELECT 
    demo_org_id,
    d.district_id,
    'Seattle Downtown',
    '403',
    '1601 3rd Ave',
    'Seattle',
    'WA',
    '98101'
  FROM districts d WHERE d.district_code = 'WC' AND d.organization_id = demo_org_id;

END $$;
