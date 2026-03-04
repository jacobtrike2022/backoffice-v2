/**
 * Invoice Review Component
 *
 * Review parsed invoice, map line items to ingredients, approve/reject
 */

import React, { useState, useEffect } from 'react';
import {
  getInvoiceById,
  approveInvoice,
  rejectInvoice,
  updateLineItemMatch,
} from '../../lib/crud/invoices';
import { searchIngredients } from '../../lib/crud/recipes';
import type { InvoiceComplete, InvoiceLineItemWithDetails } from '../../types/invoices';
import type { IngredientWithVendor } from '../../types/recipes';

interface InvoiceReviewProps {
  invoiceId: string;
  onApprove?: () => void;
  onReject?: () => void;
}

export function InvoiceReview({ invoiceId, onApprove, onReject }: InvoiceReviewProps) {
  const [invoice, setInvoice] = useState<InvoiceComplete | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // Matching state
  const [matchingLineItemId, setMatchingLineItemId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<IngredientWithVendor[]>([]);

  useEffect(() => {
    loadInvoice();
  }, [invoiceId]);

  async function loadInvoice() {
    setLoading(true);
    setError(null);

    try {
      const data = await getInvoiceById(invoiceId, true, true);
      if (!data || !('line_items' in data)) {
        throw new Error('Invoice not found');
      }
      setInvoice(data as InvoiceComplete);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    if (!invoice) return;

    // Check for unmatched items
    const unmatchedCount = invoice.line_items.filter((item) => !item.ingredient_id).length;

    if (unmatchedCount > 0) {
      const confirmed = window.confirm(
        `${unmatchedCount} line item(s) are not matched to ingredients. These items will not update ingredient costs. Continue?`
      );
      if (!confirmed) return;
    }

    setProcessing(true);
    setError(null);

    try {
      const userId = 'current-user-id'; // TODO: Get from auth context
      const result = await approveInvoice(invoiceId, userId);

      // Show cost update summary
      if (result.cost_updates.length > 0) {
        const summary = result.cost_updates
          .map(
            (update) =>
              `${update.ingredient_name}: ${update.cost_change_pct > 0 ? '+' : ''}${update.cost_change_pct.toFixed(1)}% (affects ${update.affected_recipe_count} recipes)`
          )
          .join('\n');

        alert(`Invoice approved!\n\nCost Updates:\n${summary}`);
      } else {
        alert('Invoice approved! No ingredient costs were updated.');
      }

      if (onApprove) onApprove();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve invoice');
    } finally {
      setProcessing(false);
    }
  }

  async function handleReject() {
    if (!invoice) return;

    const reason = window.prompt('Reason for rejection:');
    if (!reason) return;

    setProcessing(true);
    setError(null);

    try {
      const userId = 'current-user-id'; // TODO: Get from auth context
      await rejectInvoice(invoiceId, userId, reason);
      alert('Invoice rejected');
      if (onReject) onReject();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject invoice');
    } finally {
      setProcessing(false);
    }
  }

  async function handleSearchIngredients(query: string) {
    if (!invoice || query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const results = await searchIngredients(invoice.organization_id, {
        query,
        limit: 10,
      });
      setSearchResults(results);
    } catch (err) {
      console.error('Failed to search ingredients:', err);
      setSearchResults([]);
    }
  }

  async function handleMatchLineItem(lineItemId: string, ingredientId: string) {
    setProcessing(true);
    setError(null);

    try {
      await updateLineItemMatch(lineItemId, ingredientId, true);
      await loadInvoice(); // Reload to show updated match
      setMatchingLineItemId(null);
      setSearchQuery('');
      setSearchResults([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to match line item');
    } finally {
      setProcessing(false);
    }
  }

  function formatCurrency(amount: number | null) {
    if (amount === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  function getLineItemRowClass(lineItem: InvoiceLineItemWithDetails) {
    if (lineItem.ingredient_id && lineItem.match_status === 'auto') {
      return 'bg-green-50'; // Auto-matched
    }
    if (lineItem.ingredient_id && lineItem.match_status === 'manual') {
      return 'bg-blue-50'; // Manual match
    }
    if (lineItem.price_change_pct && Math.abs(lineItem.price_change_pct) > 10) {
      return 'bg-yellow-50'; // Significant price change
    }
    if (!lineItem.ingredient_id) {
      return 'bg-red-50'; // Unmatched
    }
    return '';
  }

  function getMatchStatusIcon(lineItem: InvoiceLineItemWithDetails) {
    if (lineItem.ingredient_id && lineItem.match_status === 'auto') {
      return <span className="text-green-600">✓ Auto</span>;
    }
    if (lineItem.ingredient_id && lineItem.match_status === 'manual') {
      return <span className="text-blue-600">✓ Manual</span>;
    }
    return <span className="text-red-600">⚠ Unmatched</span>;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
        <p className="mt-4 text-sm text-gray-600">Loading invoice...</p>
      </div>
    );
  }

  if (error && !invoice) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-600 text-sm">{error}</div>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <p className="text-gray-600">Invoice not found</p>
      </div>
    );
  }

  const matchedCount = invoice.line_items.filter((item) => item.ingredient_id).length;
  const unmatchedCount = invoice.line_items.length - matchedCount;
  const matchRate = invoice.line_items.length > 0 ? (matchedCount / invoice.line_items.length) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Invoice Review: {invoice.invoice_number || 'N/A'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {invoice.vendor?.name || 'Unknown Vendor'} • {new Date(invoice.invoice_date).toLocaleDateString()}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">{formatCurrency(invoice.total)}</div>
            <div className="text-xs text-gray-500 mt-1">
              {invoice.line_items.length} line item{invoice.line_items.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Match Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600">Ingredient Matching</span>
            <span className="font-medium text-gray-900">
              {matchedCount} / {invoice.line_items.length} ({matchRate.toFixed(0)}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                matchRate === 100 ? 'bg-green-600' : matchRate >= 80 ? 'bg-blue-600' : 'bg-yellow-600'
              }`}
              style={{ width: `${matchRate}%` }}
            />
          </div>
          {unmatchedCount > 0 && (
            <p className="text-xs text-orange-600 mt-2">
              ⚠ {unmatchedCount} item{unmatchedCount !== 1 ? 's' : ''} need matching
            </p>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-red-600 text-sm">{error}</div>
          </div>
        )}
      </div>

      {/* Line Items Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Item #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Description
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Qty
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Unit Price
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Total
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Matched To
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoice.line_items.map((lineItem) => (
                <tr key={lineItem.id} className={getLineItemRowClass(lineItem)}>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {lineItem.vendor_item_number || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {lineItem.vendor_description}
                    {lineItem.price_change_pct && Math.abs(lineItem.price_change_pct) > 10 && (
                      <div className="text-xs text-orange-600 mt-1">
                        ⚠ Price change: {lineItem.price_change_pct > 0 ? '+' : ''}
                        {lineItem.price_change_pct.toFixed(1)}%
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">
                    {lineItem.quantity} {lineItem.unit_of_measure}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    {formatCurrency(lineItem.unit_price)}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                    {formatCurrency(lineItem.extended_price)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {lineItem.ingredient ? (
                      <div>
                        <div className="font-medium text-gray-900">{lineItem.ingredient.name}</div>
                        <div className="text-xs text-gray-500">{lineItem.ingredient.category}</div>
                      </div>
                    ) : matchingLineItemId === lineItem.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Search ingredients..."
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            handleSearchIngredients(e.target.value);
                          }}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                          autoFocus
                        />
                        {searchResults.length > 0 && (
                          <div className="border border-gray-200 rounded bg-white shadow-lg max-h-48 overflow-y-auto">
                            {searchResults.map((ingredient) => (
                              <button
                                key={ingredient.id}
                                onClick={() => handleMatchLineItem(lineItem.id, ingredient.id)}
                                className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm"
                              >
                                <div className="font-medium text-gray-900">{ingredient.name}</div>
                                <div className="text-xs text-gray-500">{ingredient.category}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-center">{getMatchStatusIcon(lineItem)}</td>
                  <td className="px-4 py-3 text-center">
                    {!lineItem.ingredient_id && matchingLineItemId !== lineItem.id && (
                      <button
                        onClick={() => setMatchingLineItemId(lineItem.id)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Match
                      </button>
                    )}
                    {matchingLineItemId === lineItem.id && (
                      <button
                        onClick={() => {
                          setMatchingLineItemId(null);
                          setSearchQuery('');
                          setSearchResults([]);
                        }}
                        className="text-gray-600 hover:text-gray-700 text-sm font-medium"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex gap-4 justify-end">
          <button
            onClick={handleReject}
            disabled={processing || invoice.status === 'approved' || invoice.status === 'rejected'}
            className="px-6 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reject Invoice
          </button>
          <button
            onClick={handleApprove}
            disabled={processing || invoice.status === 'approved' || invoice.status === 'rejected'}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? 'Processing...' : 'Approve & Update Costs'}
          </button>
        </div>
      </div>
    </div>
  );
}
