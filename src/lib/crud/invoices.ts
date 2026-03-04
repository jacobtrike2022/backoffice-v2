/**
 * CRUD operations for Trike Kitchen Food Service - Invoices & Cost Tracking
 *
 * Handles invoice upload, OCR processing, line item matching, and approval workflow
 */

import { supabase } from '../supabase';
import type {
  Invoice,
  InvoiceWithVendor,
  InvoiceWithLineItems,
  InvoiceComplete,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  InvoiceFilters,
  InvoiceLineItem,
  InvoiceLineItemWithDetails,
  CreateInvoiceLineItemInput,
  UpdateInvoiceLineItemInput,
  ApproveInvoiceResponse,
  IngredientCostUpdateSummary,
  PriceChangeAlert,
  PriceChangeAlertFilters,
} from '../../types/invoices';
import { updateIngredient } from './recipes';

// =====================================================
// INVOICE OPERATIONS
// =====================================================

/**
 * Create a new invoice
 */
export async function createInvoice(
  organizationId: string,
  input: CreateInvoiceInput
): Promise<Invoice> {
  const { data, error } = await supabase
    .from('invoices')
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
 * Get invoice by ID with optional vendor and line items
 */
export async function getInvoiceById(
  invoiceId: string,
  includeVendor = false,
  includeLineItems = false
): Promise<InvoiceComplete | InvoiceWithLineItems | InvoiceWithVendor | Invoice | null> {
  let query = supabase.from('invoices').select('*').eq('id', invoiceId);

  // Build select string based on includes
  let selectStr = '*';
  if (includeVendor) {
    selectStr += ', vendor:vendors(*)';
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select(selectStr)
    .eq('id', invoiceId)
    .single();

  if (invoiceError) {
    if (invoiceError.code === 'PGRST116') return null;
    throw invoiceError;
  }

  if (!includeLineItems) {
    return invoice;
  }

  // Get line items if requested
  const { data: lineItems, error: lineItemsError } = await supabase
    .from('invoice_line_items')
    .select('*, ingredient:ingredients(*), substitution_for_ingredient:ingredients!substitution_for_ingredient_id(*)')
    .eq('invoice_id', invoiceId);

  if (lineItemsError) throw lineItemsError;

  return {
    ...invoice,
    line_items: lineItems || [],
  } as InvoiceComplete;
}

/**
 * Get all invoices with optional filters
 */
export async function getInvoices(
  organizationId: string,
  filters?: InvoiceFilters
): Promise<InvoiceWithVendor[]> {
  let query = supabase
    .from('invoices')
    .select('*, vendor:vendors(*)')
    .eq('organization_id', organizationId);

  // Apply filters
  if (filters?.store_id) {
    query = query.eq('store_id', filters.store_id);
  }
  if (filters?.vendor_id) {
    query = query.eq('vendor_id', filters.vendor_id);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.source_type) {
    query = query.eq('source_type', filters.source_type);
  }
  if (filters?.date_from) {
    query = query.gte('invoice_date', filters.date_from);
  }
  if (filters?.date_to) {
    query = query.lte('invoice_date', filters.date_to);
  }
  if (filters?.search) {
    query = query.ilike('invoice_number', `%${filters.search}%`);
  }

  query = query.order('invoice_date', { ascending: false });

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

/**
 * Update an invoice
 */
export async function updateInvoice(
  invoiceId: string,
  updates: UpdateInvoiceInput
): Promise<Invoice> {
  const { data, error } = await supabase
    .from('invoices')
    .update(updates)
    .eq('id', invoiceId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete an invoice (cascades to line items)
 */
export async function deleteInvoice(invoiceId: string): Promise<void> {
  const { error } = await supabase.from('invoices').delete().eq('id', invoiceId);

  if (error) throw error;
}

// =====================================================
// INVOICE LINE ITEM OPERATIONS
// =====================================================

/**
 * Create a new invoice line item
 */
export async function createInvoiceLineItem(
  input: CreateInvoiceLineItemInput
): Promise<InvoiceLineItem> {
  const { data, error } = await supabase
    .from('invoice_line_items')
    .insert(input)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create multiple line items at once (from OCR parsing)
 */
export async function createInvoiceLineItemsBulk(
  inputs: CreateInvoiceLineItemInput[]
): Promise<InvoiceLineItem[]> {
  const { data, error } = await supabase
    .from('invoice_line_items')
    .insert(inputs)
    .select();

  if (error) throw error;
  return data;
}

/**
 * Get all line items for an invoice
 */
export async function getInvoiceLineItems(
  invoiceId: string
): Promise<InvoiceLineItemWithDetails[]> {
  const { data, error } = await supabase
    .from('invoice_line_items')
    .select('*, ingredient:ingredients(*), substitution_for_ingredient:ingredients!substitution_for_ingredient_id(*)')
    .eq('invoice_id', invoiceId);

  if (error) throw error;
  return data || [];
}

/**
 * Update an invoice line item
 */
export async function updateInvoiceLineItem(
  lineItemId: string,
  updates: UpdateInvoiceLineItemInput
): Promise<InvoiceLineItem> {
  const { data, error } = await supabase
    .from('invoice_line_items')
    .update(updates)
    .eq('id', lineItemId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete an invoice line item
 */
export async function deleteInvoiceLineItem(lineItemId: string): Promise<void> {
  const { error } = await supabase
    .from('invoice_line_items')
    .delete()
    .eq('id', lineItemId);

  if (error) throw error;
}

// =====================================================
// INGREDIENT MATCHING
// =====================================================

/**
 * Match a line item to an ingredient (manual or auto)
 */
export async function matchLineItemToIngredient(
  lineItemId: string,
  ingredientId: string,
  manual = false
): Promise<InvoiceLineItem> {
  const { data, error } = await supabase
    .from('invoice_line_items')
    .update({
      ingredient_id: ingredientId,
      match_status: manual ? 'manual' : 'auto',
      match_confidence: manual ? 1.0 : null,
    })
    .eq('id', lineItemId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Find suggested ingredient matches for a line item
 * Uses fuzzy matching on vendor_item_number and description
 */
export async function findIngredientMatches(
  organizationId: string,
  vendorDescription: string,
  vendorItemNumber?: string,
  vendorId?: string
): Promise<Array<{ ingredient_id: string; ingredient_name: string; confidence: number; match_reason: string }>> {
  // Try exact match on vendor_item_number first
  if (vendorItemNumber) {
    const { data: exactMatch } = await supabase
      .from('ingredients')
      .select('id, name, vendor_item_number')
      .eq('organization_id', organizationId)
      .eq('vendor_item_number', vendorItemNumber)
      .limit(1);

    if (exactMatch && exactMatch.length > 0) {
      return [
        {
          ingredient_id: exactMatch[0].id,
          ingredient_name: exactMatch[0].name,
          confidence: 0.95,
          match_reason: 'Exact vendor item number match',
        },
      ];
    }
  }

  // Fuzzy match on name/description
  const { data: fuzzyMatches } = await supabase
    .from('ingredients')
    .select('id, name, vendor_item_number')
    .eq('organization_id', organizationId)
    .ilike('name', `%${vendorDescription.split(' ')[0]}%`)
    .limit(5);

  if (!fuzzyMatches || fuzzyMatches.length === 0) {
    return [];
  }

  // Calculate simple confidence score based on string similarity
  return fuzzyMatches.map((ingredient) => ({
    ingredient_id: ingredient.id,
    ingredient_name: ingredient.name,
    confidence: 0.6, // Simple confidence for fuzzy matches
    match_reason: 'Fuzzy description match',
  }));
}

// =====================================================
// INVOICE APPROVAL WORKFLOW
// =====================================================

/**
 * Approve an invoice and update ingredient costs
 */
export async function approveInvoice(
  invoiceId: string,
  userId: string
): Promise<ApproveInvoiceResponse> {
  // Get invoice with line items
  const invoice = await getInvoiceById(invoiceId, false, true);
  if (!invoice || !('line_items' in invoice)) {
    throw new Error('Invoice not found');
  }

  const lineItems = invoice.line_items;
  const costUpdates: IngredientCostUpdateSummary[] = [];

  // Update ingredient costs for matched line items
  for (const lineItem of lineItems) {
    if (!lineItem.ingredient_id) continue;

    // Get current ingredient cost
    const { data: ingredient } = await supabase
      .from('ingredients')
      .select('current_cost_per_unit, name')
      .eq('id', lineItem.ingredient_id)
      .single();

    if (!ingredient) continue;

    const oldCost = ingredient.current_cost_per_unit || 0;
    const newCost = lineItem.unit_price;

    // Update ingredient cost
    await updateIngredient(lineItem.ingredient_id, {
      current_cost_per_unit: newCost,
    });

    // Calculate price change
    const priceChangePct = oldCost > 0 ? ((newCost - oldCost) / oldCost) * 100 : 0;

    // Get affected recipe count
    const { count: affectedRecipeCount } = await supabase
      .from('recipe_ingredients')
      .select('*', { count: 'exact', head: true })
      .eq('ingredient_id', lineItem.ingredient_id);

    costUpdates.push({
      ingredient_id: lineItem.ingredient_id,
      ingredient_name: ingredient.name,
      old_cost: oldCost,
      new_cost: newCost,
      cost_change_pct: priceChangePct,
      affected_recipe_count: affectedRecipeCount || 0,
    });
  }

  // Update invoice status
  await updateInvoice(invoiceId, {
    status: 'approved',
  });

  // Update reviewed_by and reviewed_at
  await supabase
    .from('invoices')
    .update({
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', invoiceId);

  return {
    success: true,
    invoice_id: invoiceId,
    cost_updates: costUpdates,
  };
}

/**
 * Reject an invoice
 */
export async function rejectInvoice(
  invoiceId: string,
  userId: string,
  reason?: string
): Promise<void> {
  await supabase
    .from('invoices')
    .update({
      status: 'rejected',
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      // Store rejection reason in ai_parsed_output for now
      ai_parsed_output: { rejection_reason: reason },
    })
    .eq('id', invoiceId);
}

// =====================================================
// PRICE CHANGE ALERTS
// =====================================================

/**
 * Get price change alerts for recent invoices
 */
export async function getPriceChangeAlerts(
  organizationId: string,
  filters?: PriceChangeAlertFilters
): Promise<PriceChangeAlert[]> {
  let query = supabase
    .from('invoice_line_items')
    .select(`
      id,
      invoice_id,
      ingredient_id,
      vendor_description,
      unit_price,
      previous_unit_price,
      price_change_pct,
      invoice:invoices!inner(
        id,
        invoice_number,
        invoice_date,
        organization_id
      ),
      ingredient:ingredients(
        id,
        name
      )
    `)
    .eq('invoice.organization_id', organizationId)
    .not('price_change_pct', 'is', null);

  // Apply filters
  if (filters?.min_change_pct) {
    query = query.or(
      `price_change_pct.gte.${filters.min_change_pct},price_change_pct.lte.-${filters.min_change_pct}`
    );
  }
  if (filters?.date_from) {
    query = query.gte('invoice.invoice_date', filters.date_from);
  }
  if (filters?.date_to) {
    query = query.lte('invoice.invoice_date', filters.date_to);
  }
  if (filters?.ingredient_id) {
    query = query.eq('ingredient_id', filters.ingredient_id);
  }

  const { data, error } = await query;

  if (error) throw error;

  // Transform data into PriceChangeAlert format
  const alerts: PriceChangeAlert[] = await Promise.all(
    (data || []).map(async (item: any) => {
      // Get affected recipe count
      const { count: affectedRecipeCount } = await supabase
        .from('recipe_ingredients')
        .select('*', { count: 'exact', head: true })
        .eq('ingredient_id', item.ingredient_id);

      return {
        invoice_id: item.invoice.id,
        invoice_number: item.invoice.invoice_number,
        invoice_date: item.invoice.invoice_date,
        line_item_id: item.id,
        ingredient_id: item.ingredient_id,
        ingredient_name: item.ingredient?.name || 'Unknown',
        vendor_description: item.vendor_description,
        old_price: item.previous_unit_price,
        new_price: item.unit_price,
        price_change_pct: item.price_change_pct,
        affected_recipe_count: affectedRecipeCount || 0,
      };
    })
  );

  return alerts;
}

// =====================================================
// FILE UPLOAD
// =====================================================

/**
 * Upload invoice file to Supabase Storage
 */
export async function uploadInvoiceFile(
  organizationId: string,
  file: File
): Promise<string> {
  const fileName = `${organizationId}/${Date.now()}-${file.name}`;
  const { data, error } = await supabase.storage
    .from('invoices')
    .upload(fileName, file);

  if (error) throw error;

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from('invoices').getPublicUrl(fileName);

  return publicUrl;
}

/**
 * Complete invoice upload workflow: upload file + create invoice record
 */
export async function uploadInvoice(
  organizationId: string,
  file: File,
  storeId: string,
  vendorId?: string,
  invoiceDate?: string
): Promise<{ invoice: Invoice; file_url: string }> {
  // Upload file
  const fileUrl = await uploadInvoiceFile(organizationId, file);

  // Create invoice record
  const invoice = await createInvoice(organizationId, {
    store_id: storeId,
    vendor_id: vendorId,
    invoice_date: invoiceDate || new Date().toISOString().split('T')[0],
    source_type: file.type === 'application/pdf' ? 'pdf_upload' : 'ocr_photo',
    source_file_url: fileUrl,
    status: 'pending',
  });

  return { invoice, file_url: fileUrl };
}

// =====================================================
// ANALYTICS & REPORTING
// =====================================================

/**
 * Get invoice summary statistics
 */
export async function getInvoiceStats(
  organizationId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<{
  total_invoices: number;
  total_amount: number;
  avg_invoice_amount: number;
  invoices_by_status: Record<string, number>;
}> {
  let query = supabase
    .from('invoices')
    .select('status, total')
    .eq('organization_id', organizationId);

  if (dateFrom) {
    query = query.gte('invoice_date', dateFrom);
  }
  if (dateTo) {
    query = query.lte('invoice_date', dateTo);
  }

  const { data, error } = await query;

  if (error) throw error;

  const invoices = data || [];
  const totalAmount = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

  const invoicesByStatus = invoices.reduce((acc, inv) => {
    acc[inv.status] = (acc[inv.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    total_invoices: invoices.length,
    total_amount: totalAmount,
    avg_invoice_amount: invoices.length > 0 ? totalAmount / invoices.length : 0,
    invoices_by_status: invoicesByStatus,
  };
}
