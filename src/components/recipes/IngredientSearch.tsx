/**
 * Ingredient Search Component
 *
 * Autocomplete search for adding ingredients to recipes
 */

import React, { useState, useEffect, useRef } from 'react';
import { searchIngredients } from '../../lib/crud/recipes';
import type { Ingredient } from '../../types/recipes';

interface IngredientSearchProps {
  onSelect: (ingredient: Ingredient) => void;
}

export function IngredientSearch({ onSelect }: IngredientSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Ingredient[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Get organization ID from context/auth (placeholder)
  const organizationId = 'demo-org-id'; // TODO: Get from auth context

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search when query changes
  useEffect(() => {
    if (query.length >= 2) {
      performSearch();
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [query]);

  async function performSearch() {
    try {
      setLoading(true);
      const ingredients = await searchIngredients(organizationId, {
        query,
        status: 'active',
        limit: 10,
      });
      setResults(ingredients);
      setIsOpen(true);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(ingredient: Ingredient) {
    onSelect(ingredient);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search ingredients..."
        className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
      />

      {isOpen && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-80 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {results.map((ingredient) => (
            <button
              key={ingredient.id}
              type="button"
              onClick={() => handleSelect(ingredient)}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center justify-between"
            >
              <div>
                <div className="font-medium text-gray-900">{ingredient.name}</div>
                <div className="text-sm text-gray-500">{ingredient.category}</div>
              </div>
              <div className="text-sm text-gray-600">
                ${ingredient.current_cost_per_unit?.toFixed(4) || 'N/A'}
              </div>
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="absolute z-10 mt-1 w-80 bg-white border border-gray-300 rounded-md shadow-lg px-4 py-2">
          <div className="text-sm text-gray-500">Searching...</div>
        </div>
      )}

      {isOpen && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute z-10 mt-1 w-80 bg-white border border-gray-300 rounded-md shadow-lg px-4 py-2">
          <div className="text-sm text-gray-500">No ingredients found</div>
        </div>
      )}
    </div>
  );
}
