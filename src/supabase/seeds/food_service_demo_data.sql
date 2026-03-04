-- =====================================================
-- Trike Kitchen Food Service Demo Data
-- Seed file for testing and demonstration
-- =====================================================
-- This file creates a complete demo organization with:
-- - 3 vendors (PFG, McLane, Local Produce)
-- - 20 ingredients across all categories
-- - 5 recipes (breakfast sandwich, hot dog, burrito, pizza slice, coffee)
-- - 2 sample invoices (one with price increase)
--
-- NOTE: This assumes a demo organization already exists
-- Replace the organization_id values below with your actual demo org ID
-- =====================================================

-- Demo organization ID (replace with actual)
-- For this demo, we'll use a placeholder that can be replaced
DO $$
DECLARE
  demo_org_id UUID;
  demo_store_id UUID;
  demo_user_id UUID;

  -- Vendor IDs
  pfg_vendor_id UUID;
  mclane_vendor_id UUID;
  local_produce_vendor_id UUID;

  -- Ingredient IDs
  cheese_american_id UUID;
  beef_patty_id UUID;
  hot_dog_bun_id UUID;
  breakfast_sausage_id UUID;
  egg_whole_id UUID;
  bacon_id UUID;
  lettuce_iceberg_id UUID;
  tomato_fresh_id UUID;
  onion_yellow_id UUID;
  tortilla_flour_id UUID;
  beans_refried_id UUID;
  salsa_id UUID;
  pizza_dough_id UUID;
  pizza_sauce_id UUID;
  mozzarella_id UUID;
  pepperoni_id UUID;
  coffee_beans_id UUID;
  milk_whole_id UUID;
  sugar_white_id UUID;
  biscuit_id UUID;

  -- Recipe IDs
  breakfast_sandwich_id UUID;
  hot_dog_id UUID;
  burrito_id UUID;
  pizza_slice_id UUID;
  coffee_id UUID;

BEGIN
  -- Check if demo organization exists, create if not
  SELECT id INTO demo_org_id FROM organizations WHERE name = 'Trike Kitchen Demo' LIMIT 1;

  IF demo_org_id IS NULL THEN
    INSERT INTO organizations (name, subdomain, settings)
    VALUES ('Trike Kitchen Demo', 'trike-kitchen-demo', '{"food_service_enabled": true}'::JSONB)
    RETURNING id INTO demo_org_id;

    RAISE NOTICE 'Created demo organization: %', demo_org_id;
  ELSE
    RAISE NOTICE 'Using existing demo organization: %', demo_org_id;
  END IF;

  -- Get or create demo store
  SELECT id INTO demo_store_id FROM stores WHERE organization_id = demo_org_id LIMIT 1;

  IF demo_store_id IS NULL THEN
    INSERT INTO stores (organization_id, name, code, address, city, state, zip)
    VALUES (demo_org_id, 'Demo Store #1', 'DEMO001', '123 Main St', 'Dallas', 'TX', '75201')
    RETURNING id INTO demo_store_id;

    RAISE NOTICE 'Created demo store: %', demo_store_id;
  END IF;

  -- Get or create demo user
  SELECT id INTO demo_user_id FROM users WHERE organization_id = demo_org_id LIMIT 1;

  IF demo_user_id IS NULL THEN
    INSERT INTO users (organization_id, store_id, first_name, last_name, email, role_id)
    VALUES (demo_org_id, demo_store_id, 'Food Service', 'Director', 'foodservice@trikekitchen.demo',
            (SELECT id FROM roles WHERE organization_id = demo_org_id AND level = 3 LIMIT 1))
    RETURNING id INTO demo_user_id;

    RAISE NOTICE 'Created demo user: %', demo_user_id;
  END IF;

  -- =====================================================
  -- CREATE VENDORS
  -- =====================================================

  INSERT INTO vendors (organization_id, name, vendor_code, contact_name, contact_email, contact_phone, categories, typical_delivery_days)
  VALUES
    (demo_org_id, 'Performance Food Group (PFG)', 'PFG', 'John Smith', 'john.smith@pfgc.com', '800-555-0100',
     ARRAY['broadline', 'frozen', 'dry_goods'], ARRAY['monday', 'thursday'])
  RETURNING id INTO pfg_vendor_id;

  INSERT INTO vendors (organization_id, name, vendor_code, contact_name, contact_email, categories, typical_delivery_days)
  VALUES
    (demo_org_id, 'McLane Company', 'MCLANE', 'Sarah Johnson', 'sarah.j@mclane.com',
     ARRAY['broadline', 'frozen', 'dairy'], ARRAY['tuesday', 'friday'])
  RETURNING id INTO mclane_vendor_id;

  INSERT INTO vendors (organization_id, name, vendor_code, contact_name, contact_phone, categories, typical_delivery_days)
  VALUES
    (demo_org_id, 'Local Fresh Produce Co', 'LOCAL', 'Mike Rodriguez', '214-555-0199',
     ARRAY['produce'], ARRAY['monday', 'wednesday', 'friday'])
  RETURNING id INTO local_produce_vendor_id;

  RAISE NOTICE 'Created 3 vendors';

  -- =====================================================
  -- CREATE INGREDIENTS
  -- =====================================================

  -- Dairy
  INSERT INTO ingredients (organization_id, vendor_id, name, category, vendor_item_number, case_pack_size, case_pack_unit, current_cost_per_case, storage_type, allergens)
  VALUES (demo_org_id, pfg_vendor_id, 'American Cheese Slices', 'dairy', 'PFG-12345', 160, 'slices', 45.99, 'refrigerated', ARRAY['dairy'])
  RETURNING id INTO cheese_american_id;

  INSERT INTO ingredients (organization_id, vendor_id, name, category, vendor_item_number, case_pack_size, case_pack_unit, current_cost_per_case, storage_type, allergens)
  VALUES (demo_org_id, mclane_vendor_id, 'Mozzarella Cheese Shredded', 'dairy', 'MCL-78901', 4, 'lb', 18.50, 'refrigerated', ARRAY['dairy'])
  RETURNING id INTO mozzarella_id;

  INSERT INTO ingredients (organization_id, vendor_id, name, category, vendor_item_number, case_pack_size, case_pack_unit, current_cost_per_case, storage_type, allergens)
  VALUES (demo_org_id, mclane_vendor_id, 'Whole Milk', 'dairy', 'MCL-55501', 1, 'gallon', 4.25, 'refrigerated', ARRAY['dairy'])
  RETURNING id INTO milk_whole_id;

  -- Protein
  INSERT INTO ingredients (organization_id, vendor_id, name, category, vendor_item_number, case_pack_size, case_pack_unit, current_cost_per_case, storage_type)
  VALUES (demo_org_id, pfg_vendor_id, 'Beef Patty 1/4 lb Frozen', 'protein', 'PFG-23456', 40, 'each', 35.00, 'frozen')
  RETURNING id INTO beef_patty_id;

  INSERT INTO ingredients (organization_id, vendor_id, name, category, vendor_item_number, case_pack_size, case_pack_unit, current_cost_per_case, storage_type)
  VALUES (demo_org_id, pfg_vendor_id, 'Breakfast Sausage Patty', 'protein', 'PFG-23457', 96, 'each', 42.00, 'frozen')
  RETURNING id INTO breakfast_sausage_id;

  INSERT INTO ingredients (organization_id, vendor_id, name, category, vendor_item_number, case_pack_size, case_pack_unit, current_cost_per_case, storage_type, allergens)
  VALUES (demo_org_id, mclane_vendor_id, 'Whole Eggs Fresh', 'protein', 'MCL-34501', 12, 'dozen', 28.00, 'refrigerated', ARRAY['eggs'])
  RETURNING id INTO egg_whole_id;

  INSERT INTO ingredients (organization_id, vendor_id, name, category, vendor_item_number, case_pack_size, case_pack_unit, current_cost_per_case, storage_type)
  VALUES (demo_org_id, pfg_vendor_id, 'Bacon Strips Cooked', 'protein', 'PFG-23480', 200, 'strips', 55.00, 'refrigerated')
  RETURNING id INTO bacon_id;

  INSERT INTO ingredients (organization_id, vendor_id, name, category, vendor_item_number, case_pack_size, case_pack_unit, current_cost_per_case, storage_type)
  VALUES (demo_org_id, mclane_vendor_id, 'Pepperoni Sliced', 'protein', 'MCL-88901', 2, 'lb', 12.50, 'refrigerated')
  RETURNING id INTO pepperoni_id;

  -- Produce
  INSERT INTO ingredients (organization_id, vendor_id, name, category, case_pack_size, case_pack_unit, current_cost_per_case, storage_type, theoretical_yield_pct)
  VALUES (demo_org_id, local_produce_vendor_id, 'Iceberg Lettuce', 'produce', 24, 'head', 18.00, 'refrigerated', 0.75)
  RETURNING id INTO lettuce_iceberg_id;

  INSERT INTO ingredients (organization_id, vendor_id, name, category, case_pack_size, case_pack_unit, current_cost_per_case, storage_type, theoretical_yield_pct)
  VALUES (demo_org_id, local_produce_vendor_id, 'Fresh Tomatoes', 'produce', 25, 'lb', 22.50, 'refrigerated', 0.90)
  RETURNING id INTO tomato_fresh_id;

  INSERT INTO ingredients (organization_id, vendor_id, name, category, case_pack_size, case_pack_unit, current_cost_per_case, storage_type, theoretical_yield_pct)
  VALUES (demo_org_id, local_produce_vendor_id, 'Yellow Onions', 'produce', 50, 'lb', 15.00, 'dry', 0.85)
  RETURNING id INTO onion_yellow_id;

  -- Dry Goods & Bakery
  INSERT INTO ingredients (organization_id, vendor_id, name, category, vendor_item_number, case_pack_size, case_pack_unit, current_cost_per_case, storage_type)
  VALUES (demo_org_id, mclane_vendor_id, 'Hot Dog Buns', 'dry_goods', 'MCL-66601', 96, 'buns', 16.50, 'dry')
  RETURNING id INTO hot_dog_bun_id;

  INSERT INTO ingredients (organization_id, vendor_id, name, category, vendor_item_number, case_pack_size, case_pack_unit, current_cost_per_case, storage_type, allergens)
  VALUES (demo_org_id, pfg_vendor_id, 'Flour Tortillas 10-inch', 'dry_goods', 'PFG-77701', 144, 'tortillas', 22.00, 'dry', ARRAY['gluten'])
  RETURNING id INTO tortilla_flour_id;

  INSERT INTO ingredients (organization_id, vendor_id, name, category, vendor_item_number, case_pack_size, case_pack_unit, current_cost_per_case, storage_type, allergens)
  VALUES (demo_org_id, pfg_vendor_id, 'Buttermilk Biscuits', 'dry_goods', 'PFG-88801', 100, 'biscuits', 20.00, 'refrigerated', ARRAY['gluten', 'dairy'])
  RETURNING id INTO biscuit_id;

  INSERT INTO ingredients (organization_id, vendor_id, name, category, vendor_item_number, case_pack_size, case_pack_unit, current_cost_per_case, storage_type, allergens)
  VALUES (demo_org_id, mclane_vendor_id, 'Pizza Dough Frozen', 'frozen', 'MCL-99901', 20, 'dough balls', 25.00, 'frozen', ARRAY['gluten'])
  RETURNING id INTO pizza_dough_id;

  INSERT INTO ingredients (organization_id, vendor_id, name, category, vendor_item_number, case_pack_size, case_pack_unit, current_cost_per_case, storage_type)
  VALUES (demo_org_id, pfg_vendor_id, 'White Granulated Sugar', 'dry_goods', 'PFG-11101', 50, 'lb', 18.75, 'dry')
  RETURNING id INTO sugar_white_id;

  -- Condiments & Prepared Foods
  INSERT INTO ingredients (organization_id, vendor_id, name, category, vendor_item_number, case_pack_size, case_pack_unit, current_cost_per_case, storage_type)
  VALUES (demo_org_id, mclane_vendor_id, 'Refried Beans Canned', 'condiment', 'MCL-44401', 6, 'cans', 12.00, 'dry')
  RETURNING id INTO beans_refried_id;

  INSERT INTO ingredients (organization_id, vendor_id, name, category, vendor_item_number, case_pack_size, case_pack_unit, current_cost_per_case, storage_type)
  VALUES (demo_org_id, local_produce_vendor_id, 'Fresh Salsa', 'condiment', 2, 'lb', 8.00, 'refrigerated')
  RETURNING id INTO salsa_id;

  INSERT INTO ingredients (organization_id, vendor_id, name, category, vendor_item_number, case_pack_size, case_pack_unit, current_cost_per_case, storage_type)
  VALUES (demo_org_id, mclane_vendor_id, 'Pizza Sauce', 'condiment', 'MCL-99902', 4, 'lb', 9.50, 'refrigerated')
  RETURNING id INTO pizza_sauce_id;

  -- Beverage
  INSERT INTO ingredients (organization_id, vendor_id, name, category, vendor_item_number, case_pack_size, case_pack_unit, current_cost_per_case, storage_type)
  VALUES (demo_org_id, pfg_vendor_id, 'Coffee Beans Medium Roast', 'beverage', 'PFG-55501', 5, 'lb', 32.50, 'dry')
  RETURNING id INTO coffee_beans_id;

  RAISE NOTICE 'Created 20 ingredients';

  -- =====================================================
  -- CREATE RECIPES
  -- =====================================================

  -- Recipe 1: Breakfast Sausage Biscuit
  INSERT INTO recipes (
    organization_id, name, description, category, daypart, yield_quantity, yield_unit,
    target_retail_price, current_retail_price, target_food_cost_pct,
    prep_time_minutes, cook_time_minutes, hold_time_minutes,
    status, created_by
  )
  VALUES (
    demo_org_id, 'Breakfast Sausage Biscuit', 'Hot breakfast sandwich with sausage patty, egg, and cheese on buttermilk biscuit',
    'hot_grab_go', ARRAY['breakfast'], 1, 'serving',
    2.99, 2.99, 0.30,
    3, 5, 120,
    'active', demo_user_id
  )
  RETURNING id INTO breakfast_sandwich_id;

  -- Add ingredients to breakfast sandwich
  INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit_of_measure, prep_instruction, sort_order)
  VALUES
    (breakfast_sandwich_id, biscuit_id, 1, 'biscuit', 'warmed', 1),
    (breakfast_sandwich_id, breakfast_sausage_id, 1, 'patty', 'cooked', 2),
    (breakfast_sandwich_id, egg_whole_id, 1, 'egg', 'scrambled', 3),
    (breakfast_sandwich_id, cheese_american_id, 1, 'slice', NULL, 4);

  -- Recipe 2: Classic Hot Dog
  INSERT INTO recipes (
    organization_id, name, description, category, daypart, yield_quantity, yield_unit,
    target_retail_price, current_retail_price, target_food_cost_pct,
    prep_time_minutes, cook_time_minutes, hold_time_minutes,
    status, created_by
  )
  VALUES (
    demo_org_id, 'Classic Hot Dog', 'All-beef hot dog on toasted bun',
    'hot_grab_go', ARRAY['lunch', 'dinner', 'all_day'], 1, 'serving',
    1.99, 1.99, 0.25,
    2, 3, 180,
    'active', demo_user_id
  )
  RETURNING id INTO hot_dog_id;

  -- Add ingredients to hot dog
  INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit_of_measure, prep_instruction, sort_order)
  VALUES
    (hot_dog_id, hot_dog_bun_id, 1, 'bun', 'toasted', 1),
    (hot_dog_id, beef_patty_id, 0.25, 'lb', 'formed into hot dog shape', 2);

  -- Recipe 3: Breakfast Burrito
  INSERT INTO recipes (
    organization_id, name, description, category, daypart, yield_quantity, yield_unit,
    target_retail_price, current_retail_price, target_food_cost_pct,
    prep_time_minutes, cook_time_minutes, hold_time_minutes,
    status, created_by
  )
  VALUES (
    demo_org_id, 'Breakfast Burrito', 'Scrambled eggs, bacon, cheese, and salsa in flour tortilla',
    'hot_grab_go', ARRAY['breakfast'], 1, 'serving',
    3.49, 3.49, 0.32,
    4, 6, 90,
    'active', demo_user_id
  )
  RETURNING id INTO burrito_id;

  -- Add ingredients to burrito
  INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit_of_measure, prep_instruction, sort_order)
  VALUES
    (burrito_id, tortilla_flour_id, 1, 'tortilla', 'warmed', 1),
    (burrito_id, egg_whole_id, 2, 'eggs', 'scrambled', 2),
    (burrito_id, bacon_id, 3, 'strips', 'crumbled', 3),
    (burrito_id, cheese_american_id, 1, 'slice', 'shredded', 4),
    (burrito_id, salsa_id, 2, 'oz', NULL, 5);

  -- Recipe 4: Pepperoni Pizza Slice
  INSERT INTO recipes (
    organization_id, name, description, category, daypart, yield_quantity, yield_unit,
    target_retail_price, current_retail_price, target_food_cost_pct,
    prep_time_minutes, cook_time_minutes, hold_time_minutes,
    status, created_by
  )
  VALUES (
    demo_org_id, 'Pepperoni Pizza Slice', 'Classic pepperoni pizza slice',
    'hot_grab_go', ARRAY['lunch', 'dinner'], 8, 'slices',
    2.49, 2.49, 0.28,
    10, 15, 240,
    'active', demo_user_id
  )
  RETURNING id INTO pizza_slice_id;

  -- Add ingredients to pizza (makes 8 slices from one pizza)
  INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit_of_measure, prep_instruction, sort_order)
  VALUES
    (pizza_slice_id, pizza_dough_id, 1, 'dough ball', 'rolled to 14-inch', 1),
    (pizza_slice_id, pizza_sauce_id, 6, 'oz', 'spread evenly', 2),
    (pizza_slice_id, mozzarella_id, 8, 'oz', 'shredded', 3),
    (pizza_slice_id, pepperoni_id, 4, 'oz', 'sliced', 4);

  -- Recipe 5: Regular Coffee
  INSERT INTO recipes (
    organization_id, name, description, category, daypart, yield_quantity, yield_unit,
    target_retail_price, current_retail_price, target_food_cost_pct,
    prep_time_minutes, cook_time_minutes,
    status, created_by
  )
  VALUES (
    demo_org_id, 'Regular Coffee (12 oz)', 'Freshly brewed coffee',
    'beverage', ARRAY['breakfast', 'lunch', 'dinner', 'all_day'], 1, 'cup',
    1.49, 1.49, 0.15,
    1, 5,
    'active', demo_user_id
  )
  RETURNING id INTO coffee_id;

  -- Add ingredients to coffee
  INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit_of_measure, prep_instruction, sort_order)
  VALUES
    (coffee_id, coffee_beans_id, 0.75, 'oz', 'ground', 1),
    (coffee_id, sugar_white_id, 0.25, 'oz', 'optional', 2),
    (coffee_id, milk_whole_id, 1, 'oz', 'optional', 3);

  RAISE NOTICE 'Created 5 recipes with ingredients';

  -- =====================================================
  -- CREATE SAMPLE INVOICES
  -- =====================================================

  -- Invoice 1: PFG delivery (normal pricing)
  INSERT INTO invoices (
    organization_id, store_id, vendor_id,
    invoice_number, invoice_date, delivery_date,
    subtotal, tax, total,
    source_type, status
  )
  VALUES (
    demo_org_id, demo_store_id, pfg_vendor_id,
    'PFG-2024-001', '2024-01-15', '2024-01-15',
    312.49, 25.00, 337.49,
    'manual', 'approved'
  );

  -- Add line items for Invoice 1
  INSERT INTO invoice_line_items (
    invoice_id, ingredient_id, vendor_item_number, vendor_description,
    quantity, unit_of_measure, unit_price, extended_price,
    match_status, match_confidence
  )
  SELECT
    (SELECT id FROM invoices WHERE invoice_number = 'PFG-2024-001'),
    cheese_american_id, 'PFG-12345', 'AMERICAN CHEESE SLICES 160CT',
    2, 'case', 45.99, 91.98,
    'auto', 0.95
  UNION ALL SELECT
    (SELECT id FROM invoices WHERE invoice_number = 'PFG-2024-001'),
    beef_patty_id, 'PFG-23456', 'BEEF PATTY 1/4LB FRZ 40CT',
    3, 'case', 35.00, 105.00,
    'auto', 0.92
  UNION ALL SELECT
    (SELECT id FROM invoices WHERE invoice_number = 'PFG-2024-001'),
    bacon_id, 'PFG-23480', 'BACON STRIPS COOKED 200CT',
    2, 'case', 55.00, 110.00,
    'auto', 0.90;

  -- Invoice 2: PFG delivery with price increase on cheese
  INSERT INTO invoices (
    organization_id, store_id, vendor_id,
    invoice_number, invoice_date, delivery_date,
    subtotal, tax, total,
    source_type, status
  )
  VALUES (
    demo_org_id, demo_store_id, pfg_vendor_id,
    'PFG-2024-002', '2024-02-01', '2024-02-01',
    113.46, 9.08, 122.54,
    'manual', 'review_required' -- Needs review due to price increase
  );

  -- Add line items for Invoice 2 (with price increase)
  INSERT INTO invoice_line_items (
    invoice_id, ingredient_id, vendor_item_number, vendor_description,
    quantity, unit_of_measure, unit_price, extended_price,
    previous_unit_price, price_change_pct,
    match_status, match_confidence
  )
  SELECT
    (SELECT id FROM invoices WHERE invoice_number = 'PFG-2024-002'),
    cheese_american_id, 'PFG-12345', 'AMERICAN CHEESE SLICES 160CT',
    2, 'case', 51.49, 102.98,  -- PRICE INCREASE from 45.99 to 51.49
    45.99, ((51.49 - 45.99) / 45.99) * 100,  -- 12% increase
    'auto', 0.95;

  RAISE NOTICE 'Created 2 sample invoices';

  -- =====================================================
  -- SUMMARY
  -- =====================================================

  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Trike Kitchen Demo Data Created Successfully';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Organization ID: %', demo_org_id;
  RAISE NOTICE 'Store ID: %', demo_store_id;
  RAISE NOTICE 'User ID: %', demo_user_id;
  RAISE NOTICE 'Vendors: 3 (PFG, McLane, Local Produce)';
  RAISE NOTICE 'Ingredients: 20 across all categories';
  RAISE NOTICE 'Recipes: 5 (breakfast sandwich, hot dog, burrito, pizza, coffee)';
  RAISE NOTICE 'Invoices: 2 (one with 12%% price increase on cheese)';
  RAISE NOTICE '===========================================';

END $$;
