/**
 * Type definitions for Trike Kitchen Food Service - Recipes & Ingredients
 *
 * These types correspond to the database tables created in migration 00062
 */

// =====================================================
// VENDOR TYPES
// =====================================================

export type VendorCategory =
  | 'broadline'
  | 'produce'
  | 'dairy'
  | 'bakery'
  | 'paper_goods'
  | 'frozen'
  | 'dry_goods';

export type DeliveryDay =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface Vendor {
  id: string;
  organization_id: string;

  // Identity
  name: string;
  vendor_code: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;

  // Integration
  edi_capable: boolean;
  edi_vendor_id: string | null;

  // Categories
  categories: VendorCategory[];
  typical_delivery_days: DeliveryDay[];

  // Metadata
  created_at: string;
  updated_at: string;
}

export interface CreateVendorInput {
  name: string;
  vendor_code?: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  edi_capable?: boolean;
  edi_vendor_id?: string;
  categories?: VendorCategory[];
  typical_delivery_days?: DeliveryDay[];
}

export interface UpdateVendorInput extends Partial<CreateVendorInput> {}

// =====================================================
// INGREDIENT TYPES
// =====================================================

export type IngredientCategory =
  | 'protein'
  | 'dairy'
  | 'produce'
  | 'dry_goods'
  | 'frozen'
  | 'packaging'
  | 'condiment'
  | 'beverage';

export type StorageType = 'dry' | 'refrigerated' | 'frozen';

export type IngredientStatus = 'active' | 'discontinued' | 'seasonal' | 'out_of_stock';

export type Allergen =
  | 'dairy'
  | 'gluten'
  | 'soy'
  | 'nuts'
  | 'eggs'
  | 'shellfish'
  | 'sesame'
  | 'fish'
  | 'peanuts'
  | 'tree_nuts';

export interface Ingredient {
  id: string;
  organization_id: string;

  // Identity
  name: string;
  description: string | null;
  category: IngredientCategory | null;

  // Purchasing
  vendor_id: string | null;
  vendor_item_number: string | null;
  case_pack_size: number | null;
  case_pack_unit: string | null;

  // Cost tracking
  current_cost_per_case: number | null;
  current_cost_per_unit: number | null; // Auto-calculated
  cost_updated_at: string | null;

  // Yield factor
  theoretical_yield_pct: number; // Default 1.0
  actual_yield_pct: number | null;

  // Allergens
  allergens: Allergen[];

  // Storage
  storage_type: StorageType | null;
  shelf_life_days: number | null;

  // Substitution tracking
  is_substitute_for: string | null;
  substitution_started_at: string | null;
  original_ingredient_id: string | null;

  // Status
  status: IngredientStatus;

  // Metadata
  created_at: string;
  updated_at: string;
}

// Extended interface with vendor details
export interface IngredientWithVendor extends Ingredient {
  vendor?: Vendor | null;
}

export interface CreateIngredientInput {
  name: string;
  description?: string;
  category?: IngredientCategory;
  vendor_id?: string;
  vendor_item_number?: string;
  case_pack_size?: number;
  case_pack_unit?: string;
  current_cost_per_case?: number;
  theoretical_yield_pct?: number;
  allergens?: Allergen[];
  storage_type?: StorageType;
  shelf_life_days?: number;
  status?: IngredientStatus;
}

export interface UpdateIngredientInput extends Partial<CreateIngredientInput> {}

export interface IngredientFilters {
  category?: IngredientCategory;
  vendor_id?: string;
  status?: IngredientStatus;
  search?: string; // Fuzzy search on name
  allergens?: Allergen[]; // Filter by allergens
}

// =====================================================
// RECIPE TYPES
// =====================================================

export type RecipeCategory =
  | 'hot_grab_go'
  | 'cold_grab_go'
  | 'made_to_order'
  | 'bakery'
  | 'beverage'
  | 'sides'
  | 'snacks';

export type Daypart = 'breakfast' | 'lunch' | 'dinner' | 'all_day';

export type RecipeStatus = 'draft' | 'active' | 'seasonal' | 'discontinued';

export interface Recipe {
  id: string;
  organization_id: string;

  // Identity
  name: string;
  description: string | null;
  category: RecipeCategory | null;
  subcategory: string | null;

  // Classification
  daypart: Daypart[];
  tags: string[];

  // Yield
  yield_quantity: number;
  yield_unit: string;

  // Pricing
  target_retail_price: number | null;
  current_retail_price: number | null;
  target_food_cost_pct: number | null;

  // Prep timing
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  hold_time_minutes: number | null;

  // Status
  status: RecipeStatus;

  // Versioning
  version: number;
  parent_recipe_id: string | null;

  // Media
  photo_urls: string[];
  prep_video_url: string | null;

  // Geographic/store scoping
  applicable_states: string[];
  applicable_store_ids: string[];

  // AI/RAG
  embedding: number[] | null;

  // Metadata
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Recipe with calculated costs
export interface RecipeWithCost extends Recipe {
  food_cost_per_serving?: number;
  food_cost_pct?: number;
  margin_per_serving?: number;
}

export interface CreateRecipeInput {
  name: string;
  description?: string;
  category?: RecipeCategory;
  subcategory?: string;
  daypart?: Daypart[];
  tags?: string[];
  yield_quantity: number;
  yield_unit: string;
  target_retail_price?: number;
  current_retail_price?: number;
  target_food_cost_pct?: number;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  hold_time_minutes?: number;
  status?: RecipeStatus;
  photo_urls?: string[];
  prep_video_url?: string;
  applicable_states?: string[];
  applicable_store_ids?: string[];
}

export interface UpdateRecipeInput extends Partial<CreateRecipeInput> {}

export interface RecipeFilters {
  category?: RecipeCategory;
  daypart?: Daypart;
  status?: RecipeStatus;
  search?: string;
  store_id?: string; // Filter by applicable stores
  tags?: string[];
}

// =====================================================
// RECIPE INGREDIENT TYPES (Junction)
// =====================================================

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  ingredient_id: string;

  // Quantity
  quantity: number;
  unit_of_measure: string;

  // Prep notes
  prep_instruction: string | null;
  is_optional: boolean;

  // Substitution rules
  allowed_substitutes: string[]; // Array of ingredient IDs
  substitution_notes: string | null;

  // Display order
  sort_order: number;

  // Metadata
  created_at: string;
}

// Extended with ingredient details
export interface RecipeIngredientWithDetails extends RecipeIngredient {
  ingredient: Ingredient;
  line_item_cost?: number; // Calculated cost for this ingredient in this recipe
}

export interface RecipeIngredientInput {
  ingredient_id: string;
  quantity: number;
  unit_of_measure: string;
  prep_instruction?: string;
  is_optional?: boolean;
  allowed_substitutes?: string[];
  substitution_notes?: string;
  sort_order?: number;
}

export interface UpdateRecipeIngredientInput extends Partial<RecipeIngredientInput> {}

// =====================================================
// RECIPE WITH FULL DETAILS
// =====================================================

export interface RecipeWithIngredients extends Recipe {
  recipe_ingredients: RecipeIngredientWithDetails[];
}

export interface RecipeWithIngredientsAndCost extends RecipeWithIngredients {
  food_cost_per_serving: number;
  food_cost_pct: number;
  margin_per_serving: number;
  ingredient_breakdown: IngredientBreakdown[];
}

// =====================================================
// FOOD COST CALCULATION TYPES
// =====================================================

export interface IngredientBreakdown {
  ingredient_id: string;
  ingredient_name: string;
  quantity: number;
  unit: string;
  cost_per_unit: number;
  yield_pct: number;
  line_item_cost: number;
}

export interface RecipeCostCalculation {
  food_cost_per_serving: number;
  food_cost_pct: number;
  margin_per_serving: number;
  ingredient_breakdown: IngredientBreakdown[];
}

export interface PriceChangeImpact {
  recipe_id: string;
  recipe_name: string;
  old_food_cost: number;
  new_food_cost: number;
  cost_change_pct: number;
  margin_impact: number;
}

export interface IngredientCostUpdate {
  ingredient_id: string;
  old_cost: number;
  new_cost: number;
  cost_change_pct: number;
  affected_recipes: PriceChangeImpact[];
}

// =====================================================
// SEARCH & PAGINATION
// =====================================================

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface SearchIngredientsParams {
  query: string;
  category?: IngredientCategory;
  vendor_id?: string;
  status?: IngredientStatus;
  limit?: number;
}

export interface SearchRecipesParams {
  query: string;
  category?: RecipeCategory;
  daypart?: Daypart;
  status?: RecipeStatus;
  limit?: number;
}
