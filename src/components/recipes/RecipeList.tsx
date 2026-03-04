/**
 * Recipe List Component
 *
 * Displays all recipes in a grid/list view with search, filters, and actions
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getRecipes, deleteRecipe } from '../../lib/crud/recipes';
import { getCurrentUserOrgId } from '../../lib/supabase';
import type { Recipe, RecipeFilters } from '../../types/recipes';

export function RecipeList() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [daypartFilter, setDaypartFilter] = useState<string>('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Auth context
  const [organizationId, setOrganizationId] = useState<string>('');

  useEffect(() => {
    async function loadAuth() {
      const orgId = await getCurrentUserOrgId();
      if (orgId) setOrganizationId(orgId);
    }
    loadAuth();
  }, []);

  useEffect(() => {
    if (organizationId) {
      loadRecipes();
    }
  }, [organizationId, searchQuery, categoryFilter, statusFilter, daypartFilter, page]);

  async function loadRecipes() {
    try {
      setLoading(true);
      setError(null);

      const filters: RecipeFilters = {};
      if (searchQuery) filters.search = searchQuery;
      if (categoryFilter) filters.category = categoryFilter as any;
      if (statusFilter) filters.status = statusFilter as any;
      if (daypartFilter) filters.daypart = daypartFilter as any;

      const response = await getRecipes(organizationId, filters, page, 20);

      setRecipes(response.data);
      setTotalPages(response.total_pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recipes');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(recipeId: string, recipeName: string) {
    if (!confirm(`Are you sure you want to delete "${recipeName}"? This will also remove all ingredient associations.`)) {
      return;
    }

    try {
      await deleteRecipe(recipeId);
      loadRecipes(); // Reload list
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete recipe');
    }
  }

  if (loading && recipes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading recipes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recipes</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your food service recipes and track costs
          </p>
        </div>
        <Link
          to="/food-service/recipes/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          + New Recipe
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              placeholder="Search recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Categories</option>
              <option value="hot_grab_go">Hot Grab & Go</option>
              <option value="cold_grab_go">Cold Grab & Go</option>
              <option value="made_to_order">Made to Order</option>
              <option value="bakery">Bakery</option>
              <option value="beverage">Beverage</option>
              <option value="sides">Sides</option>
            </select>
          </div>

          {/* Daypart Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Daypart
            </label>
            <select
              value={daypartFilter}
              onChange={(e) => setDaypartFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Dayparts</option>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="all_day">All Day</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="seasonal">Seasonal</option>
              <option value="discontinued">Discontinued</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Recipe Grid */}
      {recipes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No recipes found</p>
          <Link
            to="/food-service/recipes/new"
            className="mt-4 inline-block text-blue-600 hover:text-blue-700"
          >
            Create your first recipe →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onDelete={() => handleDelete(recipe.id, recipe.name)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
            className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// =====================================================
// Recipe Card Component
// =====================================================

interface RecipeCardProps {
  recipe: Recipe;
  onDelete: () => void;
}

function RecipeCard({ recipe, onDelete }: RecipeCardProps) {
  const categoryLabels: Record<string, string> = {
    hot_grab_go: 'Hot Grab & Go',
    cold_grab_go: 'Cold Grab & Go',
    made_to_order: 'Made to Order',
    bakery: 'Bakery',
    beverage: 'Beverage',
    sides: 'Sides',
  };

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    draft: 'bg-gray-100 text-gray-800',
    seasonal: 'bg-yellow-100 text-yellow-800',
    discontinued: 'bg-red-100 text-red-800',
  };

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
      {/* Image */}
      <div className="h-48 bg-gray-200 rounded-t-lg overflow-hidden">
        {recipe.photo_urls && recipe.photo_urls.length > 0 ? (
          <img
            src={recipe.photo_urls[0]}
            alt={recipe.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <span className="text-4xl">🍽️</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 flex-1">
            {recipe.name}
          </h3>
          <span
            className={`px-2 py-1 text-xs font-medium rounded ${
              statusColors[recipe.status] || statusColors.draft
            }`}
          >
            {recipe.status}
          </span>
        </div>

        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {recipe.description || 'No description'}
        </p>

        {/* Metadata */}
        <div className="space-y-1 text-sm text-gray-500 mb-4">
          {recipe.category && (
            <div>Category: {categoryLabels[recipe.category] || recipe.category}</div>
          )}
          {recipe.daypart && recipe.daypart.length > 0 && (
            <div>Daypart: {recipe.daypart.join(', ')}</div>
          )}
          {recipe.yield_quantity && (
            <div>
              Yields: {recipe.yield_quantity} {recipe.yield_unit}
            </div>
          )}
          {recipe.current_retail_price && (
            <div>Price: ${recipe.current_retail_price.toFixed(2)}</div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2">
          <Link
            to={`/food-service/recipes/${recipe.id}`}
            className="flex-1 px-3 py-2 text-center text-sm font-medium text-blue-600 border border-blue-600 rounded hover:bg-blue-50 transition"
          >
            View
          </Link>
          <Link
            to={`/food-service/recipes/${recipe.id}/edit`}
            className="flex-1 px-3 py-2 text-center text-sm font-medium text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition"
          >
            Edit
          </Link>
          <button
            onClick={onDelete}
            className="px-3 py-2 text-sm font-medium text-red-600 border border-red-600 rounded hover:bg-red-50 transition"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
