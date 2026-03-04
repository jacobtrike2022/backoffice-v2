/**
 * CRUD operations for Trike Kitchen Food Service - Recipes & Ingredients
 *
 * Follows the same pattern as forms.ts with organization-scoped queries and RLS
 */

import { supabase } from '../supabase';
import type {
  Vendor,
  CreateVendorInput,
  UpdateVendorInput,
  Ingredient,
  IngredientWithVendor,
  CreateIngredientInput,
  UpdateIngredientInput,
  IngredientFilters,
  Recipe,
  RecipeWithCost,
  RecipeWithIngredients,
  RecipeWithIngredientsAndCost,
  CreateRecipeInput,
  UpdateRecipeInput,
  RecipeFilters,
  RecipeIngredient,
  RecipeIngredientWithDetails,
  RecipeIngredientInput,
  UpdateRecipeIngredientInput,
  RecipeCostCalculation,
  PriceChangeImpact,
  SearchIngredientsParams,
  SearchRecipesParams,
  PaginatedResponse,
} from '../../types/recipes';

// =====================================================
// VENDOR OPERATIONS
// =====================================================

/**
 * Create a new vendor
 */
export async function createVendor(
  organizationId: string,
  input: CreateVendorInput
): Promise<Vendor> {
  const { data, error } = await supabase
    .from('vendors')
    .insert({
      organization_id: organizationId,
      ...input,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get vendor by ID
 */
export async function getVendorById(vendorId: string): Promise<Vendor | null> {
  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .eq('id', vendorId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }

  return data;
}

/**
 * Get all vendors for an organization
 */
export async function getVendors(organizationId: string): Promise<Vendor[]> {
  const { data, error } = await supabase
    .from('vendors')
    .select('*')
    .eq('organization_id', organizationId)
    .order('name');

  if (error) throw error;
  return data || [];
}

/**
 * Update a vendor
 */
export async function updateVendor(
  vendorId: string,
  updates: UpdateVendorInput
): Promise<Vendor> {
  const { data, error } = await supabase
    .from('vendors')
    .update(updates)
    .eq('id', vendorId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a vendor
 */
export async function deleteVendor(vendorId: string): Promise<void> {
  const { error } = await supabase
    .from('vendors')
    .delete()
    .eq('id', vendorId);

  if (error) throw error;
}

// =====================================================
// INGREDIENT OPERATIONS
// =====================================================

/**
 * Create a new ingredient
 */
export async function createIngredient(
  organizationId: string,
  input: CreateIngredientInput
): Promise<Ingredient> {
  const { data, error } = await supabase
    .from('ingredients')
    .insert({
      organization_id: organizationId,
      ...input,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get ingredient by ID with optional vendor details
 */
export async function getIngredientById(
  ingredientId: string,
  includeVendor = false
): Promise<IngredientWithVendor | null> {
  let query = supabase
    .from('ingredients')
    .select(includeVendor ? '*, vendor:vendors(*)' : '*')
    .eq('id', ingredientId)
    .single();

  const { data, error } = await query;

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }

  return data;
}

/**
 * Get all ingredients with optional filters
 */
export async function getIngredients(
  organizationId: string,
  filters?: IngredientFilters,
  includeVendor = false
): Promise<IngredientWithVendor[]> {
  let query = supabase
    .from('ingredients')
    .select(includeVendor ? '*, vendor:vendors(*)' : '*')
    .eq('organization_id', organizationId);

  // Apply filters
  if (filters?.category) {
    query = query.eq('category', filters.category);
  }
  if (filters?.vendor_id) {
    query = query.eq('vendor_id', filters.vendor_id);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }
  if (filters?.allergens && filters.allergens.length > 0) {
    query = query.overlaps('allergens', filters.allergens);
  }

  query = query.order('name');

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

/**
 * Search ingredients by name (fuzzy search)
 */
export async function searchIngredients(
  organizationId: string,
  params: SearchIngredientsParams
): Promise<IngredientWithVendor[]> {
  let query = supabase
    .from('ingredients')
    .select('*, vendor:vendors(*)')
    .eq('organization_id', organizationId)
    .ilike('name', `%${params.query}%`);

  if (params.category) {
    query = query.eq('category', params.category);
  }
  if (params.vendor_id) {
    query = query.eq('vendor_id', params.vendor_id);
  }
  if (params.status) {
    query = query.eq('status', params.status);
  }

  query = query.order('name').limit(params.limit || 20);

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

/**
 * Update an ingredient
 */
export async function updateIngredient(
  ingredientId: string,
  updates: UpdateIngredientInput
): Promise<Ingredient> {
  const { data, error } = await supabase
    .from('ingredients')
    .update(updates)
    .eq('id', ingredientId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete an ingredient
 * Note: Will fail if ingredient is used in recipes (ON DELETE RESTRICT)
 */
export async function deleteIngredient(ingredientId: string): Promise<void> {
  const { error } = await supabase
    .from('ingredients')
    .delete()
    .eq('id', ingredientId);

  if (error) throw error;
}

// =====================================================
// RECIPE OPERATIONS
// =====================================================

/**
 * Create a new recipe
 */
export async function createRecipe(
  organizationId: string,
  userId: string,
  input: CreateRecipeInput
): Promise<Recipe> {
  const { data, error } = await supabase
    .from('recipes')
    .insert({
      organization_id: organizationId,
      created_by: userId,
      ...input,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get recipe by ID with optional ingredients and cost calculation
 */
export async function getRecipeById(
  recipeId: string,
  includeIngredients = false,
  includeCost = false
): Promise<RecipeWithIngredientsAndCost | RecipeWithIngredients | Recipe | null> {
  // First get the recipe
  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .select('*')
    .eq('id', recipeId)
    .single();

  if (recipeError) {
    if (recipeError.code === 'PGRST116') return null;
    throw recipeError;
  }

  if (!includeIngredients && !includeCost) {
    return recipe;
  }

  // Get recipe ingredients if requested
  let recipeIngredients: RecipeIngredientWithDetails[] = [];
  if (includeIngredients || includeCost) {
    const { data, error } = await supabase
      .from('recipe_ingredients')
      .select('*, ingredient:ingredients(*)')
      .eq('recipe_id', recipeId)
      .order('sort_order');

    if (error) throw error;
    recipeIngredients = data || [];
  }

  if (!includeCost) {
    return {
      ...recipe,
      recipe_ingredients: recipeIngredients,
    } as RecipeWithIngredients;
  }

  // Calculate cost if requested
  const costData = await calculateRecipeCost(recipeId);

  return {
    ...recipe,
    recipe_ingredients: recipeIngredients,
    ...costData,
  } as RecipeWithIngredientsAndCost;
}

/**
 * Get all recipes with optional filters
 */
export async function getRecipes(
  organizationId: string,
  filters?: RecipeFilters,
  page = 1,
  pageSize = 50
): Promise<PaginatedResponse<Recipe>> {
  let query = supabase
    .from('recipes')
    .select('*', { count: 'exact' })
    .eq('organization_id', organizationId);

  // Apply filters
  if (filters?.category) {
    query = query.eq('category', filters.category);
  }
  if (filters?.daypart) {
    query = query.contains('daypart', [filters.daypart]);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }
  if (filters?.store_id) {
    query = query.contains('applicable_store_ids', [filters.store_id]);
  }
  if (filters?.tags && filters.tags.length > 0) {
    query = query.overlaps('tags', filters.tags);
  }

  // Pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  query = query.order('name');

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    data: data || [],
    count: count || 0,
    page,
    page_size: pageSize,
    total_pages: Math.ceil((count || 0) / pageSize),
  };
}

/**
 * Search recipes by name (fuzzy search)
 */
export async function searchRecipes(
  organizationId: string,
  params: SearchRecipesParams
): Promise<Recipe[]> {
  let query = supabase
    .from('recipes')
    .select('*')
    .eq('organization_id', organizationId)
    .ilike('name', `%${params.query}%`);

  if (params.category) {
    query = query.eq('category', params.category);
  }
  if (params.daypart) {
    query = query.contains('daypart', [params.daypart]);
  }
  if (params.status) {
    query = query.eq('status', params.status);
  }

  query = query.order('name').limit(params.limit || 20);

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

/**
 * Update a recipe
 */
export async function updateRecipe(
  recipeId: string,
  updates: UpdateRecipeInput
): Promise<Recipe> {
  const { data, error } = await supabase
    .from('recipes')
    .update(updates)
    .eq('id', recipeId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a recipe
 * Note: Cascades to recipe_ingredients (ON DELETE CASCADE)
 */
export async function deleteRecipe(recipeId: string): Promise<void> {
  const { error } = await supabase
    .from('recipes')
    .delete()
    .eq('id', recipeId);

  if (error) throw error;
}

// =====================================================
// RECIPE INGREDIENT OPERATIONS
// =====================================================

/**
 * Add an ingredient to a recipe
 */
export async function addRecipeIngredient(
  recipeId: string,
  input: RecipeIngredientInput
): Promise<RecipeIngredient> {
  const { data, error } = await supabase
    .from('recipe_ingredients')
    .insert({
      recipe_id: recipeId,
      ...input,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get all ingredients for a recipe
 */
export async function getRecipeIngredients(
  recipeId: string
): Promise<RecipeIngredientWithDetails[]> {
  const { data, error } = await supabase
    .from('recipe_ingredients')
    .select('*, ingredient:ingredients(*)')
    .eq('recipe_id', recipeId)
    .order('sort_order');

  if (error) throw error;
  return data || [];
}

/**
 * Update a recipe ingredient
 */
export async function updateRecipeIngredient(
  ingredientId: string,
  updates: UpdateRecipeIngredientInput
): Promise<RecipeIngredient> {
  const { data, error } = await supabase
    .from('recipe_ingredients')
    .update(updates)
    .eq('id', ingredientId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Remove an ingredient from a recipe
 */
export async function removeRecipeIngredient(ingredientId: string): Promise<void> {
  const { error } = await supabase
    .from('recipe_ingredients')
    .delete()
    .eq('id', ingredientId);

  if (error) throw error;
}

/**
 * Reorder recipe ingredients
 */
export async function reorderRecipeIngredients(
  ingredientOrders: { id: string; sort_order: number }[]
): Promise<void> {
  // Update each ingredient's sort_order
  const updates = ingredientOrders.map(({ id, sort_order }) =>
    supabase
      .from('recipe_ingredients')
      .update({ sort_order })
      .eq('id', id)
  );

  const results = await Promise.all(updates);

  // Check for errors
  const errors = results.filter((r) => r.error);
  if (errors.length > 0) {
    throw errors[0].error;
  }
}

// =====================================================
// FOOD COST CALCULATIONS
// =====================================================

/**
 * Calculate recipe food cost using database function
 */
export async function calculateRecipeCost(
  recipeId: string
): Promise<RecipeCostCalculation> {
  const { data, error } = await supabase.rpc('calculate_recipe_food_cost', {
    recipe_uuid: recipeId,
  });

  if (error) throw error;

  // The function returns an array with one row
  if (!data || data.length === 0) {
    return {
      food_cost_per_serving: 0,
      food_cost_pct: 0,
      margin_per_serving: 0,
      ingredient_breakdown: [],
    };
  }

  return data[0];
}

/**
 * Detect price change impact using database function
 */
export async function detectPriceChangeImpact(
  ingredientId: string,
  newCostPerUnit: number
): Promise<PriceChangeImpact[]> {
  const { data, error } = await supabase.rpc('detect_price_change_impact', {
    ingredient_uuid: ingredientId,
    new_cost_per_unit: newCostPerUnit,
  });

  if (error) throw error;
  return data || [];
}

/**
 * Get recipes that use a specific ingredient
 */
export async function getRecipesUsingIngredient(
  ingredientId: string
): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from('recipe_ingredients')
    .select('recipe:recipes(*)')
    .eq('ingredient_id', ingredientId);

  if (error) throw error;

  // Extract recipes from the join
  return data?.map((ri) => ri.recipe).filter(Boolean) || [];
}

/**
 * Get recipes with their current food costs
 * Useful for dashboard views
 */
export async function getRecipesWithCosts(
  organizationId: string,
  filters?: RecipeFilters
): Promise<RecipeWithCost[]> {
  // Get recipes
  const recipesResponse = await getRecipes(organizationId, filters, 1, 100);
  const recipes = recipesResponse.data;

  // Calculate costs for each recipe
  const recipesWithCosts = await Promise.all(
    recipes.map(async (recipe) => {
      const costData = await calculateRecipeCost(recipe.id);
      return {
        ...recipe,
        ...costData,
      };
    })
  );

  return recipesWithCosts;
}

// =====================================================
// BULK OPERATIONS
// =====================================================

/**
 * Create multiple ingredients at once (e.g., from CSV import)
 */
export async function createIngredientsBulk(
  organizationId: string,
  inputs: CreateIngredientInput[]
): Promise<Ingredient[]> {
  const { data, error } = await supabase
    .from('ingredients')
    .insert(
      inputs.map((input) => ({
        organization_id: organizationId,
        ...input,
      }))
    )
    .select();

  if (error) throw error;
  return data;
}

/**
 * Update multiple ingredient costs at once (e.g., from invoice approval)
 */
export async function updateIngredientCostsBulk(
  updates: { id: string; current_cost_per_unit: number }[]
): Promise<void> {
  const updatePromises = updates.map(({ id, current_cost_per_unit }) =>
    supabase
      .from('ingredients')
      .update({
        current_cost_per_unit,
        cost_updated_at: new Date().toISOString(),
      })
      .eq('id', id)
  );

  const results = await Promise.all(updatePromises);

  // Check for errors
  const errors = results.filter((r) => r.error);
  if (errors.length > 0) {
    throw errors[0].error;
  }
}
