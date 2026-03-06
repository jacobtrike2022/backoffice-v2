/**
 * Waste Tracking Service Layer
 *
 * Integrates waste and production logging with the existing forms system.
 * Handles form submission → database record conversion.
 */

import { supabase } from '../supabase';
import type {
  WasteLog,
  WasteLogWithDetails,
  CreateWasteLogInput,
  WasteLogFilters,
  ProductionLog,
  ProductionLogWithRecipe,
  CreateProductionLogInput,
  UpdateProductionLogInput,
  ProductionLogFilters,
  WasteSummary,
  ProductionSummary,
  WasteLogFormSubmission,
  ProductionLogFormSubmission,
  wasteLogFromFormSubmission,
  productionLogFromFormSubmission,
} from '../../types/waste';
import { calculateRecipeCost } from '../crud/recipes';

// =====================================================
// WASTE LOG OPERATIONS
// =====================================================

/**
 * Create a waste log entry
 */
export async function createWasteLog(
  organizationId: string,
  input: CreateWasteLogInput
): Promise<WasteLog> {
  // Calculate estimated cost if not provided
  let estimatedCost = input.estimated_cost;

  if (!estimatedCost) {
    if (input.recipe_id) {
      // Get recipe cost
      const costData = await calculateRecipeCost(input.recipe_id);
      estimatedCost = costData.food_cost_per_serving * input.quantity;
    } else if (input.ingredient_id) {
      // Get ingredient cost
      const { data: ingredient } = await supabase
        .from('ingredients')
        .select('current_cost_per_unit')
        .eq('id', input.ingredient_id)
        .single();

      if (ingredient) {
        estimatedCost = ingredient.current_cost_per_unit * input.quantity;
      }
    }
  }

  const { data, error } = await supabase
    .from('waste_logs')
    .insert({
      organization_id: organizationId,
      ...input,
      estimated_cost: estimatedCost,
      logged_at: input.logged_at || new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get waste logs with optional filters
 */
export async function getWasteLogs(
  organizationId: string,
  filters?: WasteLogFilters
): Promise<WasteLogWithDetails[]> {
  let query = supabase
    .from('waste_logs')
    .select('*, recipe:recipes(*), ingredient:ingredients(*)')
    .eq('organization_id', organizationId);

  // Apply filters
  if (filters?.store_id) {
    query = query.eq('store_id', filters.store_id);
  }
  if (filters?.log_type) {
    query = query.eq('log_type', filters.log_type);
  }
  if (filters?.daypart) {
    query = query.eq('daypart', filters.daypart);
  }
  if (filters?.date_from) {
    query = query.gte('logged_at', filters.date_from);
  }
  if (filters?.date_to) {
    query = query.lte('logged_at', filters.date_to);
  }
  if (filters?.recipe_id) {
    query = query.eq('recipe_id', filters.recipe_id);
  }
  if (filters?.ingredient_id) {
    query = query.eq('ingredient_id', filters.ingredient_id);
  }
  if (filters?.min_cost) {
    query = query.gte('estimated_cost', filters.min_cost);
  }

  query = query.order('logged_at', { ascending: false });

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

/**
 * Get waste summary analytics
 */
export async function getWasteSummary(
  organizationId: string,
  storeIds?: string[],
  dateFrom?: string,
  dateTo?: string
): Promise<WasteSummary> {
  let query = supabase
    .from('waste_logs')
    .select('*')
    .eq('organization_id', organizationId);

  if (storeIds && storeIds.length > 0) {
    query = query.in('store_id', storeIds);
  }
  if (dateFrom) {
    query = query.gte('logged_at', dateFrom);
  }
  if (dateTo) {
    query = query.lte('logged_at', dateTo);
  }

  const { data: wasteLogs, error } = await query;

  if (error) throw error;

  const logs = wasteLogs || [];
  const totalWasteCost = logs.reduce((sum, log) => sum + (log.estimated_cost || 0), 0);

  // Waste by type
  const wasteByType = Object.entries(
    logs.reduce((acc, log) => {
      const type = log.log_type;
      if (!acc[type]) {
        acc[type] = { count: 0, total_cost: 0 };
      }
      acc[type].count += 1;
      acc[type].total_cost += log.estimated_cost || 0;
      return acc;
    }, {} as Record<string, { count: number; total_cost: number }>)
  ).map(([log_type, stats]) => ({
    log_type: log_type as any,
    count: stats.count,
    total_cost: stats.total_cost,
    percentage: totalWasteCost > 0 ? (stats.total_cost / totalWasteCost) * 100 : 0,
  }));

  // Waste by daypart
  const wasteByDaypart = Object.entries(
    logs
      .filter((log) => log.daypart)
      .reduce((acc, log) => {
        const daypart = log.daypart!;
        if (!acc[daypart]) {
          acc[daypart] = { count: 0, total_cost: 0 };
        }
        acc[daypart].count += 1;
        acc[daypart].total_cost += log.estimated_cost || 0;
        return acc;
      }, {} as Record<string, { count: number; total_cost: number }>)
  ).map(([daypart, stats]) => ({
    daypart: daypart as any,
    count: stats.count,
    total_cost: stats.total_cost,
    percentage: totalWasteCost > 0 ? (stats.total_cost / totalWasteCost) * 100 : 0,
  }));

  // Top wasted items (recipes and ingredients)
  const recipeWaste = logs
    .filter((log) => log.recipe_id)
    .reduce((acc, log) => {
      const id = log.recipe_id!;
      if (!acc[id]) {
        acc[id] = { count: 0, total_cost: 0, total_quantity: 0, type: 'recipe' as const };
      }
      acc[id].count += 1;
      acc[id].total_cost += log.estimated_cost || 0;
      acc[id].total_quantity += log.quantity;
      return acc;
    }, {} as Record<string, { count: number; total_cost: number; total_quantity: number; type: 'recipe' }>);

  const ingredientWaste = logs
    .filter((log) => log.ingredient_id)
    .reduce((acc, log) => {
      const id = log.ingredient_id!;
      if (!acc[id]) {
        acc[id] = { count: 0, total_cost: 0, total_quantity: 0, type: 'ingredient' as const };
      }
      acc[id].count += 1;
      acc[id].total_cost += log.estimated_cost || 0;
      acc[id].total_quantity += log.quantity;
      return acc;
    }, {} as Record<string, { count: number; total_cost: number; total_quantity: number; type: 'ingredient' }>);

  // Get names for top items
  const topWastedItems = await Promise.all([
    ...Object.entries(recipeWaste).map(async ([id, stats]) => {
      const { data: recipe } = await supabase
        .from('recipes')
        .select('name')
        .eq('id', id)
        .single();
      return {
        item_id: id,
        item_name: recipe?.name || 'Unknown Recipe',
        item_type: 'recipe' as const,
        total_quantity: stats.total_quantity,
        total_cost: stats.total_cost,
        waste_count: stats.count,
        most_common_reason: 'overproduction' as any, // TODO: Calculate actual most common
      };
    }),
    ...Object.entries(ingredientWaste).map(async ([id, stats]) => {
      const { data: ingredient } = await supabase
        .from('ingredients')
        .select('name')
        .eq('id', id)
        .single();
      return {
        item_id: id,
        item_name: ingredient?.name || 'Unknown Ingredient',
        item_type: 'ingredient' as const,
        total_quantity: stats.total_quantity,
        total_cost: stats.total_cost,
        waste_count: stats.count,
        most_common_reason: 'spoilage' as any, // TODO: Calculate actual most common
      };
    }),
  ]);

  // Sort by total cost and take top 10
  topWastedItems.sort((a, b) => b.total_cost - a.total_cost);
  const top10 = topWastedItems.slice(0, 10);

  // Waste trend (daily)
  const wasteTrend = Object.entries(
    logs.reduce((acc, log) => {
      const date = log.logged_at.split('T')[0];
      if (!acc[date]) {
        acc[date] = { count: 0, total_cost: 0 };
      }
      acc[date].count += 1;
      acc[date].total_cost += log.estimated_cost || 0;
      return acc;
    }, {} as Record<string, { count: number; total_cost: number }>)
  ).map(([date, stats]) => ({
    date,
    total_cost: stats.total_cost,
    count: stats.count,
  }));

  wasteTrend.sort((a, b) => a.date.localeCompare(b.date));

  return {
    total_waste_count: logs.length,
    total_waste_cost: totalWasteCost,
    waste_by_type: wasteByType,
    waste_by_daypart: wasteByDaypart,
    top_wasted_items: top10,
    waste_trend: wasteTrend,
  };
}

// =====================================================
// PRODUCTION LOG OPERATIONS
// =====================================================

/**
 * Create a production log entry
 */
export async function createProductionLog(
  organizationId: string,
  input: CreateProductionLogInput
): Promise<ProductionLog> {
  // Calculate theoretical cost if not provided
  let theoreticalCost = input.theoretical_cost;
  if (!theoreticalCost && input.recipe_id) {
    const costData = await calculateRecipeCost(input.recipe_id);
    theoreticalCost = costData.food_cost_per_serving * input.quantity_produced;
  }

  // Calculate variance if both theoretical and actual costs are available
  let variance = input.actual_cost && theoreticalCost ? input.actual_cost - theoreticalCost : null;
  let variancePct =
    variance && theoreticalCost && theoreticalCost > 0 ? (variance / theoreticalCost) * 100 : null;

  const { data, error } = await supabase
    .from('production_logs')
    .insert({
      organization_id: organizationId,
      ...input,
      theoretical_cost: theoreticalCost,
      variance,
      variance_pct: variancePct,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get production logs with optional filters
 */
export async function getProductionLogs(
  organizationId: string,
  filters?: ProductionLogFilters
): Promise<ProductionLogWithRecipe[]> {
  let query = supabase
    .from('production_logs')
    .select('*, recipe:recipes(*)')
    .eq('organization_id', organizationId);

  // Apply filters
  if (filters?.store_id) {
    query = query.eq('store_id', filters.store_id);
  }
  if (filters?.recipe_id) {
    query = query.eq('recipe_id', filters.recipe_id);
  }
  if (filters?.daypart) {
    query = query.eq('daypart', filters.daypart);
  }
  if (filters?.date_from) {
    query = query.gte('production_date', filters.date_from);
  }
  if (filters?.date_to) {
    query = query.lte('production_date', filters.date_to);
  }
  if (filters?.has_variance) {
    query = query.not('variance', 'is', null);
  }

  query = query.order('production_date', { ascending: false });

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

/**
 * Update a production log entry
 */
export async function updateProductionLog(
  logId: string,
  updates: UpdateProductionLogInput
): Promise<ProductionLog> {
  const { data, error } = await supabase
    .from('production_logs')
    .update(updates)
    .eq('id', logId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get production summary analytics
 */
export async function getProductionSummary(
  organizationId: string,
  storeIds?: string[],
  recipeIds?: string[],
  dateFrom?: string,
  dateTo?: string
): Promise<ProductionSummary> {
  let query = supabase
    .from('production_logs')
    .select('*, recipe:recipes(id, name)')
    .eq('organization_id', organizationId);

  if (storeIds && storeIds.length > 0) {
    query = query.in('store_id', storeIds);
  }
  if (recipeIds && recipeIds.length > 0) {
    query = query.in('recipe_id', recipeIds);
  }
  if (dateFrom) {
    query = query.gte('production_date', dateFrom);
  }
  if (dateTo) {
    query = query.lte('production_date', dateTo);
  }

  const { data: productionLogs, error } = await query;

  if (error) throw error;

  const logs = productionLogs || [];

  const totalProduced = logs.reduce((sum, log) => sum + log.quantity_produced, 0);
  const totalSold = logs.reduce((sum, log) => sum + (log.quantity_sold || 0), 0);
  const totalWasted = logs.reduce((sum, log) => sum + (log.quantity_wasted || 0), 0);
  const totalHeldOver = logs.reduce((sum, log) => sum + (log.quantity_held_over || 0), 0);

  const productionEfficiency = totalProduced > 0 ? (totalSold / totalProduced) * 100 : 0;
  const wasteRate = totalProduced > 0 ? (totalWasted / totalProduced) * 100 : 0;

  // Top recipes by production volume
  const recipeStats = logs.reduce((acc, log) => {
    const recipeId = log.recipe_id;
    if (!acc[recipeId]) {
      acc[recipeId] = {
        recipe_id: recipeId,
        recipe_name: (log.recipe as any)?.name || 'Unknown Recipe',
        total_produced: 0,
        total_sold: 0,
        total_wasted: 0,
      };
    }
    acc[recipeId].total_produced += log.quantity_produced;
    acc[recipeId].total_sold += log.quantity_sold || 0;
    acc[recipeId].total_wasted += log.quantity_wasted || 0;
    return acc;
  }, {} as Record<string, any>);

  const topRecipes = Object.values(recipeStats).map((stats: any) => ({
    ...stats,
    sell_through_rate: stats.total_produced > 0 ? (stats.total_sold / stats.total_produced) * 100 : 0,
  }));

  topRecipes.sort((a, b) => b.total_produced - a.total_produced);

  // Variance summary
  const logsWithVariance = logs.filter((log) => log.variance !== null);
  const totalTheoreticalCost = logsWithVariance.reduce((sum, log) => sum + (log.theoretical_cost || 0), 0);
  const totalActualCost = logsWithVariance.reduce((sum, log) => sum + (log.actual_cost || 0), 0);
  const totalVariance = totalActualCost - totalTheoreticalCost;
  const avgVariancePct =
    logsWithVariance.length > 0
      ? logsWithVariance.reduce((sum, log) => sum + (log.variance_pct || 0), 0) / logsWithVariance.length
      : 0;

  return {
    total_production_logs: logs.length,
    total_produced: totalProduced,
    total_sold: totalSold,
    total_wasted: totalWasted,
    total_held_over: totalHeldOver,
    production_efficiency: productionEfficiency,
    waste_rate: wasteRate,
    top_recipes: topRecipes.slice(0, 10),
    variance_summary: {
      total_theoretical_cost: totalTheoreticalCost,
      total_actual_cost: totalActualCost,
      total_variance: totalVariance,
      average_variance_pct: avgVariancePct,
      logs_with_variance_count: logsWithVariance.length,
    },
  };
}

// =====================================================
// FORM SUBMISSION INTEGRATION
// =====================================================

/**
 * Create waste log from form submission
 * This is called when a user submits the "Daily Waste Log" form
 */
export async function createWasteLogFromFormSubmission(
  submissionId: string,
  organizationId: string
): Promise<WasteLog> {
  // Get form submission
  const { data: submission, error: submissionError } = await supabase
    .from('form_submissions')
    .select('*, user:users!inner(id, store_id)')
    .eq('id', submissionId)
    .single();

  if (submissionError) throw submissionError;

  const answers = submission.answers as WasteLogFormSubmission;
  const userId = submission.user.id;
  const storeId = submission.user.store_id;

  if (!storeId) {
    throw new Error('User must have a store_id to create waste logs');
  }

  // Convert form submission to waste log input
  const input = wasteLogFromFormSubmission(answers, organizationId, storeId, userId);

  // Create waste log
  return createWasteLog(organizationId, input);
}

/**
 * Create production log from form submission
 * This is called when a user submits the "Daily Production Log" form
 */
export async function createProductionLogFromFormSubmission(
  submissionId: string,
  organizationId: string
): Promise<ProductionLog> {
  // Get form submission
  const { data: submission, error: submissionError } = await supabase
    .from('form_submissions')
    .select('*, user:users!inner(id, store_id)')
    .eq('id', submissionId)
    .single();

  if (submissionError) throw submissionError;

  const answers = submission.answers as ProductionLogFormSubmission;
  const userId = submission.user.id;
  const storeId = submission.user.store_id;

  if (!storeId) {
    throw new Error('User must have a store_id to create production logs');
  }

  // Convert form submission to production log input
  const input = productionLogFromFormSubmission(answers, organizationId, storeId, userId);

  // Create production log
  return createProductionLog(organizationId, input);
}
