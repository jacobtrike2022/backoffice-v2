/**
 * Recipe Builder Component
 *
 * Create/edit recipes with real-time food cost calculation
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createRecipe,
  updateRecipe,
  getRecipeById,
  addRecipeIngredient,
  removeRecipeIngredient,
  calculateRecipeCost,
} from '../../lib/crud/recipes';
import { searchIngredients } from '../../lib/crud/recipes';
import type {
  CreateRecipeInput,
  RecipeIngredientInput,
  RecipeWithIngredientsAndCost,
  Ingredient,
} from '../../types/recipes';
import { IngredientSearch } from './IngredientSearch';
import { RecipeCostDisplay } from './RecipeCostDisplay';

export function RecipeBuilder() {
  const navigate = useNavigate();
  const { recipeId } = useParams<{ recipeId?: string }>();
  const isEditMode = !!recipeId;

  // Get organization ID and user ID from context/auth (placeholder)
  const organizationId = 'demo-org-id'; // TODO: Get from auth context
  const userId = 'demo-user-id'; // TODO: Get from auth context

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('');
  const [dayparts, setDayparts] = useState<string[]>([]);
  const [yieldQuantity, setYieldQuantity] = useState<number>(1);
  const [yieldUnit, setYieldUnit] = useState('servings');
  const [targetRetailPrice, setTargetRetailPrice] = useState<number | ''>('');
  const [currentRetailPrice, setCurrentRetailPrice] = useState<number | ''>('');
  const [targetFoodCostPct, setTargetFoodCostPct] = useState<number | ''>(0.30);
  const [prepTimeMinutes, setPrepTimeMinutes] = useState<number | ''>('');
  const [cookTimeMinutes, setCookTimeMinutes] = useState<number | ''>('');
  const [status, setStatus] = useState('active');

  // Ingredients
  const [ingredients, setIngredients] = useState<
    Array<{
      id?: string; // recipe_ingredient id (for edits)
      ingredient: Ingredient;
      quantity: number;
      unit_of_measure: string;
      prep_instruction: string;
    }>
  >([]);

  // Cost calculation
  const [foodCost, setFoodCost] = useState<any>(null);

  // Loading states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load existing recipe if editing
  useEffect(() => {
    if (isEditMode && recipeId) {
      loadRecipe();
    }
  }, [recipeId]);

  // Recalculate cost when ingredients or pricing changes
  useEffect(() => {
    if (recipeId && ingredients.length > 0) {
      recalculateCost();
    }
  }, [ingredients, yieldQuantity, currentRetailPrice]);

  async function loadRecipe() {
    try {
      setLoading(true);
      const recipe = await getRecipeById(recipeId!, true, true);
      if (!recipe) {
        throw new Error('Recipe not found');
      }

      const fullRecipe = recipe as RecipeWithIngredientsAndCost;

      // Populate form fields
      setName(fullRecipe.name);
      setDescription(fullRecipe.description || '');
      setCategory(fullRecipe.category || '');
      setDayparts(fullRecipe.daypart || []);
      setYieldQuantity(fullRecipe.yield_quantity);
      setYieldUnit(fullRecipe.yield_unit);
      setTargetRetailPrice(fullRecipe.target_retail_price || '');
      setCurrentRetailPrice(fullRecipe.current_retail_price || '');
      setTargetFoodCostPct(fullRecipe.target_food_cost_pct || '');
      setPrepTimeMinutes(fullRecipe.prep_time_minutes || '');
      setCookTimeMinutes(fullRecipe.cook_time_minutes || '');
      setStatus(fullRecipe.status);

      // Populate ingredients
      if ('recipe_ingredients' in fullRecipe && fullRecipe.recipe_ingredients) {
        setIngredients(
          fullRecipe.recipe_ingredients.map((ri) => ({
            id: ri.id,
            ingredient: ri.ingredient,
            quantity: ri.quantity,
            unit_of_measure: ri.unit_of_measure,
            prep_instruction: ri.prep_instruction || '',
          }))
        );
      }

      // Load cost data
      if ('food_cost_per_serving' in fullRecipe) {
        setFoodCost({
          food_cost_per_serving: fullRecipe.food_cost_per_serving,
          food_cost_pct: fullRecipe.food_cost_pct,
          margin_per_serving: fullRecipe.margin_per_serving,
          ingredient_breakdown: fullRecipe.ingredient_breakdown,
        });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to load recipe');
      navigate('/food-service/recipes');
    } finally {
      setLoading(false);
    }
  }

  async function recalculateCost() {
    if (!recipeId) return;
    try {
      const costData = await calculateRecipeCost(recipeId);
      setFoodCost(costData);
    } catch (err) {
      console.error('Failed to recalculate cost:', err);
    }
  }

  function handleAddIngredient(ingredient: Ingredient) {
    setIngredients([
      ...ingredients,
      {
        ingredient,
        quantity: 1,
        unit_of_measure: 'oz',
        prep_instruction: '',
      },
    ]);
  }

  function handleRemoveIngredient(index: number) {
    setIngredients(ingredients.filter((_, i) => i !== index));
  }

  function handleUpdateIngredient(
    index: number,
    field: string,
    value: any
  ) {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name || !yieldQuantity || !yieldUnit) {
      alert('Please fill in required fields');
      return;
    }

    try {
      setSaving(true);

      const recipeInput: CreateRecipeInput = {
        name,
        description: description || undefined,
        category: category as any || undefined,
        daypart: dayparts.length > 0 ? (dayparts as any) : undefined,
        yield_quantity: yieldQuantity,
        yield_unit: yieldUnit,
        target_retail_price: targetRetailPrice || undefined,
        current_retail_price: currentRetailPrice || undefined,
        target_food_cost_pct: targetFoodCostPct || undefined,
        prep_time_minutes: prepTimeMinutes || undefined,
        cook_time_minutes: cookTimeMinutes || undefined,
        status: status as any,
      };

      let savedRecipeId: string;

      if (isEditMode && recipeId) {
        // Update existing recipe
        await updateRecipe(recipeId, recipeInput);
        savedRecipeId = recipeId;
      } else {
        // Create new recipe
        const newRecipe = await createRecipe(organizationId, userId, recipeInput);
        savedRecipeId = newRecipe.id;
      }

      // Add ingredients
      for (const ing of ingredients) {
        if (!ing.id) {
          // New ingredient
          await addRecipeIngredient(savedRecipeId, {
            ingredient_id: ing.ingredient.id,
            quantity: ing.quantity,
            unit_of_measure: ing.unit_of_measure,
            prep_instruction: ing.prep_instruction || undefined,
          });
        }
      }

      navigate(`/food-service/recipes/${savedRecipeId}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save recipe');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditMode ? 'Edit Recipe' : 'New Recipe'}
        </h1>
        <button
          type="button"
          onClick={() => navigate('/food-service/recipes')}
          className="text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
      </div>

      {/* Basic Information */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Recipe Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="Breakfast Burrito"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="Scrambled eggs, bacon, cheese, and salsa in a flour tortilla"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select category</option>
              <option value="hot_grab_go">Hot Grab & Go</option>
              <option value="cold_grab_go">Cold Grab & Go</option>
              <option value="made_to_order">Made to Order</option>
              <option value="bakery">Bakery</option>
              <option value="beverage">Beverage</option>
              <option value="sides">Sides</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="seasonal">Seasonal</option>
              <option value="discontinued">Discontinued</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dayparts
          </label>
          <div className="flex flex-wrap gap-2">
            {['breakfast', 'lunch', 'dinner', 'all_day'].map((daypart) => (
              <label key={daypart} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={dayparts.includes(daypart)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setDayparts([...dayparts, daypart]);
                    } else {
                      setDayparts(dayparts.filter((d) => d !== daypart));
                    }
                  }}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 capitalize">{daypart.replace('_', ' ')}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Yield & Pricing */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Yield & Pricing</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Yield Quantity *
            </label>
            <input
              type="number"
              step="0.01"
              value={yieldQuantity}
              onChange={(e) => setYieldQuantity(parseFloat(e.target.value))}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Yield Unit *
            </label>
            <select
              value={yieldUnit}
              onChange={(e) => setYieldUnit(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="servings">Servings</option>
              <option value="portions">Portions</option>
              <option value="pieces">Pieces</option>
              <option value="oz">Ounces</option>
              <option value="lb">Pounds</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Retail Price
            </label>
            <input
              type="number"
              step="0.01"
              value={currentRetailPrice}
              onChange={(e) => setCurrentRetailPrice(e.target.value ? parseFloat(e.target.value) : '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="2.99"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Food Cost %
            </label>
            <input
              type="number"
              step="0.01"
              value={targetFoodCostPct}
              onChange={(e) => setTargetFoodCostPct(e.target.value ? parseFloat(e.target.value) : '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.30"
            />
          </div>
        </div>
      </div>

      {/* Ingredients */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Ingredients</h2>
          <IngredientSearch onSelect={handleAddIngredient} />
        </div>

        {ingredients.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            No ingredients added yet. Search and add ingredients above.
          </p>
        ) : (
          <div className="space-y-2">
            {ingredients.map((ing, index) => (
              <div
                key={index}
                className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{ing.ingredient.name}</div>
                  <div className="text-sm text-gray-500">
                    ${ing.ingredient.current_cost_per_unit?.toFixed(4) || '0.00'} per unit
                  </div>
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={ing.quantity}
                  onChange={(e) =>
                    handleUpdateIngredient(index, 'quantity', parseFloat(e.target.value))
                  }
                  className="w-24 px-2 py-1 border border-gray-300 rounded"
                  placeholder="Qty"
                />
                <select
                  value={ing.unit_of_measure}
                  onChange={(e) =>
                    handleUpdateIngredient(index, 'unit_of_measure', e.target.value)
                  }
                  className="w-24 px-2 py-1 border border-gray-300 rounded"
                >
                  <option value="oz">oz</option>
                  <option value="lb">lb</option>
                  <option value="each">each</option>
                  <option value="cup">cup</option>
                  <option value="tbsp">tbsp</option>
                  <option value="tsp">tsp</option>
                </select>
                <input
                  type="text"
                  value={ing.prep_instruction}
                  onChange={(e) =>
                    handleUpdateIngredient(index, 'prep_instruction', e.target.value)
                  }
                  className="w-32 px-2 py-1 border border-gray-300 rounded"
                  placeholder="Prep (optional)"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveIngredient(index)}
                  className="text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cost Display */}
      {foodCost && currentRetailPrice && (
        <RecipeCostDisplay
          foodCost={foodCost}
          targetFoodCostPct={typeof targetFoodCostPct === 'number' ? targetFoodCostPct : undefined}
        />
      )}

      {/* Submit */}
      <div className="flex items-center justify-end space-x-3">
        <button
          type="button"
          onClick={() => navigate('/food-service/recipes')}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : isEditMode ? 'Update Recipe' : 'Create Recipe'}
        </button>
      </div>
    </form>
  );
}
