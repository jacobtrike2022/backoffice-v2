-- =====================================================
-- Trike Kitchen Food Service Management Schema
-- Migration 00062
-- =====================================================
-- This migration creates the complete food service operations schema
-- for c-store food service management including:
-- - Recipes and ingredients
-- - Vendor management
-- - Invoice ingestion and cost tracking
-- - Waste and production logging
--
-- All tables follow Trike's multi-tenant RLS pattern using organization_id
-- =====================================================

-- =====================================================
-- VENDORS TABLE
-- =====================================================
-- Stores vendor/supplier information for ingredients
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identity
  name TEXT NOT NULL,
  vendor_code TEXT, -- Internal code for the vendor
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,

  -- Integration capabilities
  edi_capable BOOLEAN DEFAULT false,
  edi_vendor_id TEXT,

  -- Categories supplied
  categories TEXT[], -- 'broadline', 'produce', 'dairy', 'bakery', 'paper_goods', etc.

  -- Delivery schedule
  typical_delivery_days TEXT[], -- ['monday', 'thursday']

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT vendors_organization_name_unique UNIQUE (organization_id, name)
);

-- Create index for fast lookups
CREATE INDEX idx_vendors_organization_id ON vendors(organization_id);

-- Enable RLS
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view vendors in their organization"
    ON vendors FOR SELECT
    USING (organization_id = get_user_organization_id());

CREATE POLICY "Food service managers can manage vendors"
    ON vendors FOR ALL
    USING (organization_id = get_user_organization_id())
    WITH CHECK (organization_id = get_user_organization_id());

-- =====================================================
-- INGREDIENTS TABLE
-- =====================================================
-- Core ingredient database with cost tracking
CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identity
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'protein', 'dairy', 'produce', 'dry_goods', 'frozen', 'packaging', 'condiment'

  -- Purchasing info
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  vendor_item_number TEXT, -- Vendor's SKU/item number
  case_pack_size DECIMAL, -- e.g., 4 (four 5-lb bags per case)
  case_pack_unit TEXT, -- 'lb', 'oz', 'each', 'gallon'

  -- Cost tracking (updated from invoices)
  current_cost_per_case DECIMAL,
  current_cost_per_unit DECIMAL, -- derived: cost_per_case / case_pack_size
  cost_updated_at TIMESTAMPTZ,

  -- Yield factor (handles waste/loss during prep)
  theoretical_yield_pct DECIMAL DEFAULT 1.0, -- 1.0 = 100% usable, 0.85 = 15% waste
  actual_yield_pct DECIMAL, -- Calculated from historical waste tracking

  -- Allergen information
  allergens TEXT[], -- 'dairy', 'gluten', 'soy', 'nuts', 'eggs', 'shellfish', 'sesame'

  -- Storage requirements
  storage_type TEXT, -- 'dry', 'refrigerated', 'frozen'
  shelf_life_days INTEGER,

  -- Substitution tracking
  is_substitute_for UUID REFERENCES ingredients(id) ON DELETE SET NULL,
  substitution_started_at TIMESTAMPTZ,
  original_ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'discontinued', 'seasonal', 'out_of_stock')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT ingredients_organization_name_unique UNIQUE (organization_id, name)
);

-- Indexes
CREATE INDEX idx_ingredients_organization_id ON ingredients(organization_id);
CREATE INDEX idx_ingredients_vendor_id ON ingredients(vendor_id);
CREATE INDEX idx_ingredients_category ON ingredients(category);
CREATE INDEX idx_ingredients_status ON ingredients(status);

-- Enable RLS
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view ingredients in their organization"
    ON ingredients FOR SELECT
    USING (organization_id = get_user_organization_id());

CREATE POLICY "Food service managers can manage ingredients"
    ON ingredients FOR ALL
    USING (organization_id = get_user_organization_id())
    WITH CHECK (organization_id = get_user_organization_id());

-- =====================================================
-- RECIPES TABLE
-- =====================================================
-- Recipe master table with versioning and cost tracking
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identity
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'hot_grab_go', 'cold_grab_go', 'made_to_order', 'bakery', 'beverage', 'sides'
  subcategory TEXT,

  -- Classification
  daypart TEXT[], -- ['breakfast', 'lunch', 'dinner', 'all_day']
  tags TEXT[],

  -- Yield information
  yield_quantity DECIMAL NOT NULL, -- how many servings this recipe produces
  yield_unit TEXT NOT NULL, -- 'servings', 'portions', 'pieces', 'oz', 'lb'

  -- Pricing
  target_retail_price DECIMAL, -- What we want to sell it for
  current_retail_price DECIMAL, -- Current POS price
  target_food_cost_pct DECIMAL, -- e.g., 0.30 for 30% target

  -- Prep timing
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  hold_time_minutes INTEGER, -- Max safe holding time

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'seasonal', 'discontinued')),

  -- Versioning
  version INTEGER DEFAULT 1,
  parent_recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,

  -- Media
  photo_urls TEXT[], -- Stored in Supabase Storage
  prep_video_url TEXT,

  -- Geographic/store scoping
  applicable_states TEXT[], -- State-specific recipes (e.g., alcohol-based)
  applicable_store_ids UUID[], -- Specific stores only (references stores table)

  -- AI/RAG for semantic search
  embedding vector(1536), -- For semantic recipe search

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT recipes_organization_name_version_unique UNIQUE (organization_id, name, version)
);

-- Indexes
CREATE INDEX idx_recipes_organization_id ON recipes(organization_id);
CREATE INDEX idx_recipes_category ON recipes(category);
CREATE INDEX idx_recipes_status ON recipes(status);
CREATE INDEX idx_recipes_parent_recipe_id ON recipes(parent_recipe_id);
CREATE INDEX idx_recipes_created_by ON recipes(created_by);

-- Enable RLS
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view published recipes in their organization"
    ON recipes FOR SELECT
    USING (organization_id = get_user_organization_id());

CREATE POLICY "Food service managers can manage recipes"
    ON recipes FOR ALL
    USING (organization_id = get_user_organization_id())
    WITH CHECK (organization_id = get_user_organization_id());

-- =====================================================
-- RECIPE_INGREDIENTS TABLE (Junction)
-- =====================================================
-- Links recipes to ingredients with quantities
CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,

  -- Quantity for this recipe
  quantity DECIMAL NOT NULL,
  unit_of_measure TEXT NOT NULL, -- 'oz', 'lb', 'each', 'cup', 'tbsp', 'slice'

  -- Prep notes
  prep_instruction TEXT, -- 'diced', 'shredded', 'thawed', etc.
  is_optional BOOLEAN DEFAULT false,

  -- Substitution rules
  allowed_substitutes UUID[], -- Array of ingredient_ids
  substitution_notes TEXT,

  -- Display order
  sort_order INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT recipe_ingredients_recipe_ingredient_unique UNIQUE (recipe_id, ingredient_id)
);

-- Indexes
CREATE INDEX idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_ingredient_id ON recipe_ingredients(ingredient_id);

-- Enable RLS
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view recipe ingredients"
    ON recipe_ingredients FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM recipes
        WHERE recipes.id = recipe_ingredients.recipe_id
        AND recipes.organization_id = get_user_organization_id()
    ));

CREATE POLICY "Food service managers can manage recipe ingredients"
    ON recipe_ingredients FOR ALL
    USING (EXISTS (
        SELECT 1 FROM recipes
        WHERE recipes.id = recipe_ingredients.recipe_id
        AND recipes.organization_id = get_user_organization_id()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM recipes
        WHERE recipes.id = recipe_ingredients.recipe_id
        AND recipes.organization_id = get_user_organization_id()
    ));

-- =====================================================
-- INVOICES TABLE
-- =====================================================
-- Vendor invoices for cost tracking
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,

  -- Invoice details
  invoice_number TEXT,
  invoice_date DATE NOT NULL,
  delivery_date DATE,

  -- Totals
  subtotal DECIMAL,
  tax DECIMAL,
  total DECIMAL,

  -- Source tracking
  source_type TEXT NOT NULL CHECK (source_type IN ('ocr_photo', 'pdf_upload', 'edi', 'manual')),
  source_file_url TEXT, -- Supabase Storage path

  -- OCR/AI processing results
  ocr_raw_output JSONB, -- Raw OCR extraction
  ai_parsed_output JSONB, -- Structured AI interpretation
  confidence_score DECIMAL, -- Overall parsing confidence (0-1)

  -- Status workflow
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',         -- Uploaded, not yet processed
    'processing',      -- OCR/AI in progress
    'parsed',          -- Successfully parsed, awaiting review
    'review_required', -- Low confidence or errors, needs manual review
    'approved',        -- Reviewed and approved, costs updated
    'rejected'         -- Rejected, no cost updates
  )),

  -- Review tracking
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_invoices_organization_id ON invoices(organization_id);
CREATE INDEX idx_invoices_store_id ON invoices(store_id);
CREATE INDEX idx_invoices_vendor_id ON invoices(vendor_id);
CREATE INDEX idx_invoices_invoice_date ON invoices(invoice_date);
CREATE INDEX idx_invoices_status ON invoices(status);

-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view invoices in their organization"
    ON invoices FOR SELECT
    USING (organization_id = get_user_organization_id());

CREATE POLICY "Store managers can manage invoices for their stores"
    ON invoices FOR ALL
    USING (organization_id = get_user_organization_id())
    WITH CHECK (organization_id = get_user_organization_id());

-- =====================================================
-- INVOICE_LINE_ITEMS TABLE
-- =====================================================
-- Individual line items from invoices
CREATE TABLE invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,

  -- What was on the invoice
  vendor_item_number TEXT,
  vendor_description TEXT,
  quantity DECIMAL NOT NULL,
  unit_of_measure TEXT,
  unit_price DECIMAL NOT NULL,
  extended_price DECIMAL NOT NULL,

  -- Mapping to our ingredients
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,
  match_confidence DECIMAL, -- AI confidence in the match (0-1)
  match_status TEXT DEFAULT 'auto' CHECK (match_status IN (
    'auto',      -- Automatically matched
    'manual',    -- Manually matched by user
    'unmatched', -- No match found
    'new_item'   -- User created new ingredient from this
  )),

  -- Price change detection
  previous_unit_price DECIMAL, -- Last known price for this item
  price_change_pct DECIMAL, -- Calculated: (unit_price - previous) / previous

  -- Substitution tracking
  is_substitution BOOLEAN DEFAULT false,
  substitution_for_ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);
CREATE INDEX idx_invoice_line_items_ingredient_id ON invoice_line_items(ingredient_id);

-- Enable RLS
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view invoice line items"
    ON invoice_line_items FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM invoices
        WHERE invoices.id = invoice_line_items.invoice_id
        AND invoices.organization_id = get_user_organization_id()
    ));

CREATE POLICY "Users can manage invoice line items"
    ON invoice_line_items FOR ALL
    USING (EXISTS (
        SELECT 1 FROM invoices
        WHERE invoices.id = invoice_line_items.invoice_id
        AND invoices.organization_id = get_user_organization_id()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM invoices
        WHERE invoices.id = invoice_line_items.invoice_id
        AND invoices.organization_id = get_user_organization_id()
    ));

-- =====================================================
-- WASTE_LOGS TABLE
-- =====================================================
-- Track food waste by type and reason
CREATE TABLE waste_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  -- Waste classification
  log_type TEXT NOT NULL CHECK (log_type IN (
    'production_waste',  -- Waste during prep/cooking
    'spoilage',          -- Expired product
    'overproduction',    -- Made too much, couldn't sell
    'customer_return',   -- Remakes, complaints
    'quality_discard',   -- Didn't meet quality standards
    'theft_suspected',   -- Unexplained variance
    'sample',            -- Employee meals, sampling
    'other'
  )),

  -- Item details (either recipe OR raw ingredient)
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL,

  -- Quantity wasted
  quantity DECIMAL NOT NULL,
  unit_of_measure TEXT NOT NULL,
  estimated_cost DECIMAL, -- Calculated from recipe/ingredient cost

  -- Context
  daypart TEXT, -- 'breakfast', 'lunch', 'dinner', 'overnight'
  shift_id TEXT, -- Optional shift identifier
  logged_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Additional info
  reason TEXT, -- Free-text reason
  photo_url TEXT, -- Optional photo of wasted item

  -- Timing
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint: must have either recipe_id OR ingredient_id
  CONSTRAINT waste_logs_item_check CHECK (
    (recipe_id IS NOT NULL AND ingredient_id IS NULL) OR
    (recipe_id IS NULL AND ingredient_id IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX idx_waste_logs_organization_id ON waste_logs(organization_id);
CREATE INDEX idx_waste_logs_store_id ON waste_logs(store_id);
CREATE INDEX idx_waste_logs_recipe_id ON waste_logs(recipe_id);
CREATE INDEX idx_waste_logs_ingredient_id ON waste_logs(ingredient_id);
CREATE INDEX idx_waste_logs_log_type ON waste_logs(log_type);
CREATE INDEX idx_waste_logs_logged_at ON waste_logs(logged_at);

-- Enable RLS
ALTER TABLE waste_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view waste logs in their organization"
    ON waste_logs FOR SELECT
    USING (organization_id = get_user_organization_id());

CREATE POLICY "Store staff can create waste logs"
    ON waste_logs FOR INSERT
    WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Food service managers can manage waste logs"
    ON waste_logs FOR ALL
    USING (organization_id = get_user_organization_id())
    WITH CHECK (organization_id = get_user_organization_id());

-- =====================================================
-- PRODUCTION_LOGS TABLE
-- =====================================================
-- Track daily production quantities and variance
CREATE TABLE production_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,

  -- Production quantities
  quantity_produced DECIMAL NOT NULL,
  quantity_sold DECIMAL,
  quantity_wasted DECIMAL,
  quantity_held_over DECIMAL, -- Carried to next day

  -- Cost tracking
  theoretical_cost DECIMAL, -- What it should have cost (based on recipe)
  actual_cost DECIMAL, -- What it actually cost (based on ingredients used)
  variance DECIMAL, -- actual - theoretical
  variance_pct DECIMAL, -- variance / theoretical

  -- Timing
  production_date DATE NOT NULL,
  daypart TEXT, -- 'breakfast', 'lunch', 'dinner'

  -- Metadata
  logged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint: quantities should be logical
  CONSTRAINT production_logs_quantity_check CHECK (
    quantity_produced >= 0 AND
    quantity_sold >= 0 AND
    quantity_wasted >= 0 AND
    quantity_held_over >= 0
  )
);

-- Indexes
CREATE INDEX idx_production_logs_organization_id ON production_logs(organization_id);
CREATE INDEX idx_production_logs_store_id ON production_logs(store_id);
CREATE INDEX idx_production_logs_recipe_id ON production_logs(recipe_id);
CREATE INDEX idx_production_logs_production_date ON production_logs(production_date);

-- Enable RLS
ALTER TABLE production_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view production logs in their organization"
    ON production_logs FOR SELECT
    USING (organization_id = get_user_organization_id());

CREATE POLICY "Store staff can create production logs"
    ON production_logs FOR INSERT
    WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Food service managers can manage production logs"
    ON production_logs FOR ALL
    USING (organization_id = get_user_organization_id())
    WITH CHECK (organization_id = get_user_organization_id());

-- =====================================================
-- DATABASE FUNCTIONS
-- =====================================================

-- Function: Calculate recipe food cost with ingredient breakdown
CREATE OR REPLACE FUNCTION calculate_recipe_food_cost(recipe_uuid UUID)
RETURNS TABLE(
  food_cost_per_serving DECIMAL,
  food_cost_pct DECIMAL,
  margin_per_serving DECIMAL,
  ingredient_breakdown JSONB
) AS $$
DECLARE
  v_recipe recipes%ROWTYPE;
  v_total_ingredient_cost DECIMAL := 0;
  v_ingredient_details JSONB := '[]'::JSONB;
BEGIN
  -- Get recipe details
  SELECT * INTO v_recipe FROM recipes WHERE id = recipe_uuid;

  -- If recipe doesn't exist, return nulls
  IF v_recipe.id IS NULL THEN
    RETURN QUERY SELECT NULL::DECIMAL, NULL::DECIMAL, NULL::DECIMAL, NULL::JSONB;
    RETURN;
  END IF;

  -- Calculate total ingredient cost with breakdown
  SELECT
    COALESCE(SUM(
      (i.current_cost_per_unit * ri.quantity) / COALESCE(i.theoretical_yield_pct, 1.0)
    ), 0),
    COALESCE(jsonb_agg(jsonb_build_object(
      'ingredient_id', i.id,
      'ingredient_name', i.name,
      'quantity', ri.quantity,
      'unit', ri.unit_of_measure,
      'cost_per_unit', i.current_cost_per_unit,
      'yield_pct', i.theoretical_yield_pct,
      'line_item_cost', (i.current_cost_per_unit * ri.quantity) / COALESCE(i.theoretical_yield_pct, 1.0)
    ) ORDER BY ri.sort_order), '[]'::JSONB)
  INTO v_total_ingredient_cost, v_ingredient_details
  FROM recipe_ingredients ri
  JOIN ingredients i ON i.id = ri.ingredient_id
  WHERE ri.recipe_id = recipe_uuid;

  -- Return calculated values
  RETURN QUERY SELECT
    v_total_ingredient_cost / NULLIF(v_recipe.yield_quantity, 0) AS food_cost_per_serving,
    (v_total_ingredient_cost / NULLIF(v_recipe.yield_quantity, 0)) / NULLIF(v_recipe.current_retail_price, 0) AS food_cost_pct,
    v_recipe.current_retail_price - (v_total_ingredient_cost / NULLIF(v_recipe.yield_quantity, 0)) AS margin_per_serving,
    v_ingredient_details AS ingredient_breakdown;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Detect price changes and calculate impact across recipes
CREATE OR REPLACE FUNCTION detect_price_change_impact(ingredient_uuid UUID, new_cost_per_unit DECIMAL)
RETURNS TABLE(
  recipe_id UUID,
  recipe_name TEXT,
  old_food_cost DECIMAL,
  new_food_cost DECIMAL,
  cost_change_pct DECIMAL,
  margin_impact DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  WITH recipe_costs AS (
    SELECT
      r.id,
      r.name,
      r.yield_quantity,
      r.current_retail_price,
      (SELECT food_cost_per_serving FROM calculate_recipe_food_cost(r.id)) AS current_cost,
      (
        -- Recalculate with new cost for the specified ingredient
        COALESCE((SELECT SUM(
          CASE
            WHEN ri.ingredient_id = ingredient_uuid
            THEN (new_cost_per_unit * ri.quantity) / COALESCE(i.theoretical_yield_pct, 1.0)
            ELSE (i.current_cost_per_unit * ri.quantity) / COALESCE(i.theoretical_yield_pct, 1.0)
          END
        )
        FROM recipe_ingredients ri
        JOIN ingredients i ON i.id = ri.ingredient_id
        WHERE ri.recipe_id = r.id), 0)
      ) / NULLIF(r.yield_quantity, 0) AS new_cost
    FROM recipes r
    WHERE EXISTS (
      SELECT 1 FROM recipe_ingredients ri
      WHERE ri.recipe_id = r.id AND ri.ingredient_id = ingredient_uuid
    )
    AND r.status = 'active'
  )
  SELECT
    rc.id AS recipe_id,
    rc.name AS recipe_name,
    rc.current_cost AS old_food_cost,
    rc.new_cost AS new_food_cost,
    ((rc.new_cost - rc.current_cost) / NULLIF(rc.current_cost, 0)) * 100 AS cost_change_pct,
    (rc.current_retail_price - rc.current_cost) - (rc.current_retail_price - rc.new_cost) AS margin_impact
  FROM recipe_costs rc
  WHERE rc.current_cost IS NOT NULL AND rc.new_cost IS NOT NULL
  ORDER BY ABS((rc.current_retail_price - rc.current_cost) - (rc.current_retail_price - rc.new_cost)) DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Update ingredient cost and recalculate affected recipes
-- This is called when an invoice is approved
CREATE OR REPLACE FUNCTION update_ingredient_cost_from_invoice(
  p_ingredient_id UUID,
  p_new_cost_per_unit DECIMAL,
  p_invoice_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_old_cost DECIMAL;
  v_affected_recipes JSONB;
BEGIN
  -- Get current cost
  SELECT current_cost_per_unit INTO v_old_cost
  FROM ingredients
  WHERE id = p_ingredient_id;

  -- Update ingredient cost
  UPDATE ingredients
  SET
    current_cost_per_unit = p_new_cost_per_unit,
    cost_updated_at = NOW()
  WHERE id = p_ingredient_id;

  -- Get impact on recipes
  SELECT jsonb_agg(row_to_json(impact))
  INTO v_affected_recipes
  FROM detect_price_change_impact(p_ingredient_id, p_new_cost_per_unit) impact;

  -- Return summary
  RETURN jsonb_build_object(
    'ingredient_id', p_ingredient_id,
    'old_cost', v_old_cost,
    'new_cost', p_new_cost_per_unit,
    'cost_change_pct', ((p_new_cost_per_unit - v_old_cost) / NULLIF(v_old_cost, 0)) * 100,
    'affected_recipes', COALESCE(v_affected_recipes, '[]'::JSONB)
  );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp on vendors
CREATE OR REPLACE FUNCTION update_vendors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW
  EXECUTE FUNCTION update_vendors_updated_at();

-- Auto-update updated_at timestamp on ingredients
CREATE OR REPLACE FUNCTION update_ingredients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ingredients_updated_at
  BEFORE UPDATE ON ingredients
  FOR EACH ROW
  EXECUTE FUNCTION update_ingredients_updated_at();

-- Auto-calculate current_cost_per_unit when case cost changes
CREATE OR REPLACE FUNCTION calculate_ingredient_unit_cost()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_cost_per_case IS NOT NULL AND NEW.case_pack_size IS NOT NULL AND NEW.case_pack_size > 0 THEN
    NEW.current_cost_per_unit = NEW.current_cost_per_case / NEW.case_pack_size;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ingredients_calculate_unit_cost
  BEFORE INSERT OR UPDATE OF current_cost_per_case, case_pack_size ON ingredients
  FOR EACH ROW
  EXECUTE FUNCTION calculate_ingredient_unit_cost();

-- Auto-update updated_at timestamp on recipes
CREATE OR REPLACE FUNCTION update_recipes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recipes_updated_at
  BEFORE UPDATE ON recipes
  FOR EACH ROW
  EXECUTE FUNCTION update_recipes_updated_at();

-- Auto-update updated_at timestamp on invoices
CREATE OR REPLACE FUNCTION update_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_invoices_updated_at();

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE vendors IS 'Vendor/supplier master table for food service ingredients';
COMMENT ON TABLE ingredients IS 'Ingredient database with cost tracking and yield factors';
COMMENT ON TABLE recipes IS 'Recipe master with versioning and multi-tenant scoping';
COMMENT ON TABLE recipe_ingredients IS 'Junction table linking recipes to ingredients with quantities';
COMMENT ON TABLE invoices IS 'Vendor invoices with OCR/AI processing workflow';
COMMENT ON TABLE invoice_line_items IS 'Individual line items from invoices with ingredient matching';
COMMENT ON TABLE waste_logs IS 'Food waste tracking by type and reason';
COMMENT ON TABLE production_logs IS 'Daily production quantities with theoretical vs actual variance';

COMMENT ON FUNCTION calculate_recipe_food_cost IS 'Calculates total food cost per serving for a recipe with ingredient breakdown';
COMMENT ON FUNCTION detect_price_change_impact IS 'Identifies recipes affected by ingredient price change';
COMMENT ON FUNCTION update_ingredient_cost_from_invoice IS 'Updates ingredient cost and calculates recipe impact (called on invoice approval)';
