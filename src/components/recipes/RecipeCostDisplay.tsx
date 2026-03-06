/**
 * Recipe Cost Display Component
 *
 * Shows real-time food cost calculation with visual indicators
 */

import React from 'react';
import type { RecipeCostCalculation } from '../../types/recipes';

interface RecipeCostDisplayProps {
  foodCost: RecipeCostCalculation;
  targetFoodCostPct?: number;
}

export function RecipeCostDisplay({ foodCost, targetFoodCostPct }: RecipeCostDisplayProps) {
  const {
    food_cost_per_serving,
    food_cost_pct,
    margin_per_serving,
    ingredient_breakdown,
  } = foodCost;

  // Determine if we're over/under target
  const isOverTarget = targetFoodCostPct && food_cost_pct > targetFoodCostPct;
  const isUnderTarget = targetFoodCostPct && food_cost_pct < targetFoodCostPct * 0.8; // 20% under

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Cost Analysis</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Food Cost per Serving */}
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm text-blue-600 font-medium">Food Cost per Serving</div>
          <div className="text-2xl font-bold text-blue-900 mt-1">
            ${food_cost_per_serving.toFixed(2)}
          </div>
        </div>

        {/* Food Cost % */}
        <div
          className={`rounded-lg p-4 ${
            isOverTarget
              ? 'bg-red-50'
              : isUnderTarget
              ? 'bg-green-50'
              : 'bg-yellow-50'
          }`}
        >
          <div
            className={`text-sm font-medium ${
              isOverTarget
                ? 'text-red-600'
                : isUnderTarget
                ? 'text-green-600'
                : 'text-yellow-600'
            }`}
          >
            Food Cost %
            {targetFoodCostPct && (
              <span className="ml-2 text-xs">
                (Target: {(targetFoodCostPct * 100).toFixed(0)}%)
              </span>
            )}
          </div>
          <div
            className={`text-2xl font-bold mt-1 ${
              isOverTarget
                ? 'text-red-900'
                : isUnderTarget
                ? 'text-green-900'
                : 'text-yellow-900'
            }`}
          >
            {(food_cost_pct * 100).toFixed(1)}%
          </div>
          {isOverTarget && (
            <div className="text-xs text-red-600 mt-1">
              ⚠️ Over target by {((food_cost_pct - targetFoodCostPct) * 100).toFixed(1)}%
            </div>
          )}
          {isUnderTarget && (
            <div className="text-xs text-green-600 mt-1">
              ✓ Under target by {((targetFoodCostPct - food_cost_pct) * 100).toFixed(1)}%
            </div>
          )}
        </div>

        {/* Margin per Serving */}
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-sm text-green-600 font-medium">Margin per Serving</div>
          <div className="text-2xl font-bold text-green-900 mt-1">
            ${margin_per_serving.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Ingredient Breakdown */}
      {ingredient_breakdown && ingredient_breakdown.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Ingredient Breakdown
          </h3>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Ingredient
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Quantity
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Cost/Unit
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Line Cost
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    % of Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {ingredient_breakdown.map((item, index) => {
                  const pctOfTotal = (item.line_item_cost / food_cost_per_serving) * 100;
                  const isExpensive = pctOfTotal > 30; // Highlight if >30% of cost

                  return (
                    <tr
                      key={index}
                      className={isExpensive ? 'bg-yellow-50' : ''}
                    >
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {item.ingredient_name}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600 text-right">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600 text-right">
                        ${item.cost_per_unit.toFixed(4)}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right font-medium">
                        ${item.line_item_cost.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600 text-right">
                        {pctOfTotal.toFixed(1)}%
                        {isExpensive && (
                          <span className="ml-1 text-yellow-600">⚠️</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-sm font-semibold text-gray-900">
                    Total Food Cost
                  </td>
                  <td className="px-4 py-2 text-sm font-semibold text-gray-900 text-right">
                    ${food_cost_per_serving.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-sm font-semibold text-gray-900 text-right">
                    100%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Cost Optimization Tips */}
      {ingredient_breakdown && ingredient_breakdown.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm font-semibold text-blue-900 mb-2">
            💡 Cost Optimization Tips
          </div>
          <ul className="text-sm text-blue-800 space-y-1">
            {ingredient_breakdown
              .filter((item) => (item.line_item_cost / food_cost_per_serving) * 100 > 30)
              .map((item, index) => (
                <li key={index}>
                  • <strong>{item.ingredient_name}</strong> accounts for{' '}
                  {((item.line_item_cost / food_cost_per_serving) * 100).toFixed(1)}% of
                  cost. Consider reducing quantity or finding cheaper alternative.
                </li>
              ))}
            {isOverTarget && (
              <li>
                • Your food cost is {((food_cost_pct - (targetFoodCostPct || 0)) * 100).toFixed(1)}% over target.
                Consider increasing retail price or reducing portion sizes.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
