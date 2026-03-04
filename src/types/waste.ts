/**
 * Type definitions for Trike Kitchen Food Service - Waste & Production Tracking
 *
 * These types correspond to waste_logs and production_logs tables
 */

import type { Recipe, Ingredient } from './recipes';

// =====================================================
// WASTE LOG TYPES
// =====================================================

export type WasteLogType =
  | 'production_waste'  // Waste during prep/cooking
  | 'spoilage'          // Expired product
  | 'overproduction'    // Made too much, couldn't sell
  | 'customer_return'   // Remakes, complaints
  | 'quality_discard'   // Didn't meet quality standards
  | 'theft_suspected'   // Unexplained variance
  | 'sample'            // Employee meals, sampling
  | 'other';

export type WasteDaypart = 'breakfast' | 'lunch' | 'dinner' | 'overnight';

export interface WasteLog {
  id: string;
  organization_id: string;
  store_id: string;

  // Waste classification
  log_type: WasteLogType;

  // Item details (either recipe OR ingredient, never both)
  recipe_id: string | null;
  ingredient_id: string | null;

  // Quantity
  quantity: number;
  unit_of_measure: string;
  estimated_cost: number | null;

  // Context
  daypart: WasteDaypart | null;
  shift_id: string | null;
  logged_by: string | null;

  // Additional info
  reason: string | null;
  photo_url: string | null;

  // Timing
  logged_at: string;
  created_at: string;
}

// Extended with recipe/ingredient details
export interface WasteLogWithDetails extends WasteLog {
  recipe?: Recipe | null;
  ingredient?: Ingredient | null;
}

export interface CreateWasteLogInput {
  store_id: string;
  log_type: WasteLogType;
  recipe_id?: string;
  ingredient_id?: string;
  quantity: number;
  unit_of_measure: string;
  estimated_cost?: number;
  daypart?: WasteDaypart;
  shift_id?: string;
  reason?: string;
  photo_url?: string;
  logged_at?: string; // Defaults to NOW() if not provided
}

export interface WasteLogFilters {
  store_id?: string;
  log_type?: WasteLogType;
  daypart?: WasteDaypart;
  date_from?: string;
  date_to?: string;
  recipe_id?: string;
  ingredient_id?: string;
  min_cost?: number; // Filter by cost threshold
}

// =====================================================
// PRODUCTION LOG TYPES
// =====================================================

export interface ProductionLog {
  id: string;
  organization_id: string;
  store_id: string;
  recipe_id: string;

  // Production quantities
  quantity_produced: number;
  quantity_sold: number | null;
  quantity_wasted: number | null;
  quantity_held_over: number | null; // Carried to next day

  // Cost tracking
  theoretical_cost: number | null;
  actual_cost: number | null;
  variance: number | null; // actual - theoretical
  variance_pct: number | null;

  // Timing
  production_date: string; // DATE in DB
  daypart: WasteDaypart | null;

  // Metadata
  logged_by: string | null;
  created_at: string;
}

// Extended with recipe details
export interface ProductionLogWithRecipe extends ProductionLog {
  recipe: Recipe;
}

export interface CreateProductionLogInput {
  store_id: string;
  recipe_id: string;
  quantity_produced: number;
  quantity_sold?: number;
  quantity_wasted?: number;
  quantity_held_over?: number;
  theoretical_cost?: number;
  actual_cost?: number;
  production_date: string;
  daypart?: WasteDaypart;
}

export interface UpdateProductionLogInput extends Partial<CreateProductionLogInput> {}

export interface ProductionLogFilters {
  store_id?: string;
  recipe_id?: string;
  daypart?: WasteDaypart;
  date_from?: string;
  date_to?: string;
  has_variance?: boolean; // Filter to only logs with cost variance
}

// =====================================================
// WASTE ANALYTICS
// =====================================================

export interface WasteSummary {
  total_waste_count: number;
  total_waste_cost: number;
  waste_by_type: WasteByType[];
  waste_by_daypart: WasteByDaypart[];
  top_wasted_items: TopWastedItem[];
  waste_trend: WasteTrend[];
}

export interface WasteByType {
  log_type: WasteLogType;
  count: number;
  total_cost: number;
  percentage: number; // Of total waste cost
}

export interface WasteByDaypart {
  daypart: WasteDaypart;
  count: number;
  total_cost: number;
  percentage: number;
}

export interface TopWastedItem {
  item_id: string;
  item_name: string;
  item_type: 'recipe' | 'ingredient';
  total_quantity: number;
  total_cost: number;
  waste_count: number;
  most_common_reason: WasteLogType;
}

export interface WasteTrend {
  date: string;
  total_cost: number;
  count: number;
}

export interface WasteAnalyticsRequest {
  store_ids?: string[];
  date_from: string;
  date_to: string;
  group_by?: 'store' | 'daypart' | 'type' | 'date';
}

// =====================================================
// PRODUCTION ANALYTICS
// =====================================================

export interface ProductionSummary {
  total_production_logs: number;
  total_produced: number;
  total_sold: number;
  total_wasted: number;
  total_held_over: number;
  production_efficiency: number; // (sold / produced) * 100
  waste_rate: number; // (wasted / produced) * 100
  top_recipes: TopProducedRecipe[];
  variance_summary: VarianceSummary;
}

export interface TopProducedRecipe {
  recipe_id: string;
  recipe_name: string;
  total_produced: number;
  total_sold: number;
  total_wasted: number;
  sell_through_rate: number; // (sold / produced) * 100
}

export interface VarianceSummary {
  total_theoretical_cost: number;
  total_actual_cost: number;
  total_variance: number;
  average_variance_pct: number;
  logs_with_variance_count: number;
}

export interface ProductionAnalyticsRequest {
  store_ids?: string[];
  recipe_ids?: string[];
  date_from: string;
  date_to: string;
}

// =====================================================
// FORM SUBMISSION INTEGRATION
// =====================================================
// These types support creating waste/production logs from form submissions

export interface WasteLogFormSubmission {
  date: string;
  waste_type: string; // Maps to WasteLogType
  item_type: 'Recipe (Prepared Item)' | 'Raw Ingredient';
  recipe?: string; // Recipe ID if item_type is Recipe
  ingredient?: string; // Ingredient ID if item_type is Raw Ingredient
  quantity: number;
  unit_of_measure: string;
  daypart?: string;
  reason_notes?: string;
  photo?: string; // File upload URL
}

export interface ProductionLogFormSubmission {
  production_date: string;
  recipe: string; // Recipe ID
  quantity_produced: number;
  quantity_sold?: number;
  quantity_wasted?: number;
  quantity_held_over?: number;
  daypart: string;
}

// Function to convert form submission to WasteLog
export function wasteLogFromFormSubmission(
  submission: WasteLogFormSubmission,
  organizationId: string,
  storeId: string,
  userId: string
): CreateWasteLogInput {
  const logType = submission.waste_type.toLowerCase().replace(' ', '_') as WasteLogType;
  const daypart = submission.daypart?.toLowerCase() as WasteDaypart | undefined;

  return {
    store_id: storeId,
    log_type: logType,
    recipe_id: submission.item_type === 'Recipe (Prepared Item)' ? submission.recipe : undefined,
    ingredient_id: submission.item_type === 'Raw Ingredient' ? submission.ingredient : undefined,
    quantity: submission.quantity,
    unit_of_measure: submission.unit_of_measure,
    daypart,
    reason: submission.reason_notes,
    photo_url: submission.photo,
  };
}

// Function to convert form submission to ProductionLog
export function productionLogFromFormSubmission(
  submission: ProductionLogFormSubmission,
  organizationId: string,
  storeId: string,
  userId: string
): CreateProductionLogInput {
  const daypart = submission.daypart?.toLowerCase() as WasteDaypart | undefined;

  return {
    store_id: storeId,
    recipe_id: submission.recipe,
    quantity_produced: submission.quantity_produced,
    quantity_sold: submission.quantity_sold,
    quantity_wasted: submission.quantity_wasted,
    quantity_held_over: submission.quantity_held_over,
    production_date: submission.production_date,
    daypart,
  };
}
