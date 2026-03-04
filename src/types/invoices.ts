/**
 * Type definitions for Trike Kitchen Food Service - Invoices & Cost Tracking
 *
 * These types correspond to the invoice-related database tables
 */

import type { Vendor } from './recipes';
import type { Ingredient } from './recipes';

// =====================================================
// INVOICE TYPES
// =====================================================

export type InvoiceSourceType = 'ocr_photo' | 'pdf_upload' | 'edi' | 'manual';

export type InvoiceStatus =
  | 'pending'         // Uploaded, not yet processed
  | 'processing'      // OCR/AI in progress
  | 'parsed'          // Successfully parsed, awaiting review
  | 'review_required' // Low confidence or errors, needs manual review
  | 'approved'        // Reviewed and approved, costs updated
  | 'rejected';       // Rejected, no cost updates

export interface Invoice {
  id: string;
  organization_id: string;
  store_id: string;
  vendor_id: string | null;

  // Invoice details
  invoice_number: string | null;
  invoice_date: string; // DATE in DB
  delivery_date: string | null;

  // Totals
  subtotal: number | null;
  tax: number | null;
  total: number | null;

  // Source tracking
  source_type: InvoiceSourceType;
  source_file_url: string | null; // Supabase Storage path

  // OCR/AI processing
  ocr_raw_output: Record<string, any> | null; // JSONB
  ai_parsed_output: Record<string, any> | null; // JSONB
  confidence_score: number | null;

  // Status workflow
  status: InvoiceStatus;

  // Review tracking
  reviewed_by: string | null;
  reviewed_at: string | null;

  // Metadata
  created_at: string;
  updated_at: string;
}

// Extended with vendor details
export interface InvoiceWithVendor extends Invoice {
  vendor?: Vendor | null;
}

// Extended with line items
export interface InvoiceWithLineItems extends Invoice {
  line_items: InvoiceLineItemWithDetails[];
}

// Extended with both vendor and line items
export interface InvoiceComplete extends Invoice {
  vendor?: Vendor | null;
  line_items: InvoiceLineItemWithDetails[];
}

export interface CreateInvoiceInput {
  store_id: string;
  vendor_id?: string;
  invoice_number?: string;
  invoice_date: string;
  delivery_date?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  source_type: InvoiceSourceType;
  source_file_url?: string;
}

export interface UpdateInvoiceInput extends Partial<CreateInvoiceInput> {
  ocr_raw_output?: Record<string, any>;
  ai_parsed_output?: Record<string, any>;
  confidence_score?: number;
  status?: InvoiceStatus;
}

export interface InvoiceFilters {
  store_id?: string;
  vendor_id?: string;
  status?: InvoiceStatus;
  source_type?: InvoiceSourceType;
  date_from?: string;
  date_to?: string;
  search?: string; // Search by invoice number
}

// =====================================================
// INVOICE LINE ITEM TYPES
// =====================================================

export type LineItemMatchStatus = 'auto' | 'manual' | 'unmatched' | 'new_item';

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;

  // What was on the invoice
  vendor_item_number: string | null;
  vendor_description: string | null;
  quantity: number;
  unit_of_measure: string | null;
  unit_price: number;
  extended_price: number;

  // Mapping to our ingredients
  ingredient_id: string | null;
  match_confidence: number | null; // 0-1
  match_status: LineItemMatchStatus;

  // Price change detection
  previous_unit_price: number | null;
  price_change_pct: number | null;

  // Substitution tracking
  is_substitution: boolean;
  substitution_for_ingredient_id: string | null;

  // Metadata
  created_at: string;
}

// Extended with ingredient details
export interface InvoiceLineItemWithDetails extends InvoiceLineItem {
  ingredient?: Ingredient | null;
  substitution_for_ingredient?: Ingredient | null;
}

export interface CreateInvoiceLineItemInput {
  invoice_id: string;
  vendor_item_number?: string;
  vendor_description?: string;
  quantity: number;
  unit_of_measure?: string;
  unit_price: number;
  extended_price: number;
  ingredient_id?: string;
  match_confidence?: number;
  match_status?: LineItemMatchStatus;
  previous_unit_price?: number;
  is_substitution?: boolean;
  substitution_for_ingredient_id?: string;
}

export interface UpdateInvoiceLineItemInput extends Partial<CreateInvoiceLineItemInput> {}

// =====================================================
// OCR/AI PROCESSING TYPES
// =====================================================

export interface OCRInvoiceData {
  vendor?: string;
  invoice_number?: string;
  invoice_date?: string;
  delivery_date?: string;
  line_items: OCRLineItem[];
  subtotal?: number;
  tax?: number;
  total?: number;
}

export interface OCRLineItem {
  vendor_item_number?: string;
  description: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  extended_price: number;
}

export interface ProcessInvoiceRequest {
  invoice_id: string;
  image_url: string;
  organization_id: string;
}

export interface ProcessInvoiceResponse {
  success: boolean;
  invoice_id: string;
  parsed_data?: OCRInvoiceData;
  error?: string;
}

// =====================================================
// INVOICE APPROVAL WORKFLOW
// =====================================================

export interface ApproveInvoiceRequest {
  invoice_id: string;
  user_id: string;
}

export interface ApproveInvoiceResponse {
  success: boolean;
  invoice_id: string;
  cost_updates: IngredientCostUpdateSummary[];
  error?: string;
}

export interface RejectInvoiceRequest {
  invoice_id: string;
  user_id: string;
  reason?: string;
}

export interface IngredientCostUpdateSummary {
  ingredient_id: string;
  ingredient_name: string;
  old_cost: number;
  new_cost: number;
  cost_change_pct: number;
  affected_recipe_count: number;
}

// =====================================================
// LINE ITEM MATCHING
// =====================================================

export interface MatchLineItemRequest {
  line_item_id: string;
  ingredient_id: string;
  manual: boolean; // true if manually matched by user
}

export interface MatchLineItemResponse {
  success: boolean;
  line_item_id: string;
  ingredient_id: string;
  error?: string;
}

export interface SuggestedIngredientMatch {
  ingredient_id: string;
  ingredient_name: string;
  vendor_item_number: string | null;
  confidence: number; // 0-1
  match_reason: string; // e.g., "Exact vendor item number match" or "Fuzzy description match"
}

export interface FindMatchesRequest {
  vendor_description: string;
  vendor_item_number?: string;
  vendor_id?: string;
  organization_id: string;
}

export interface FindMatchesResponse {
  suggested_matches: SuggestedIngredientMatch[];
}

// =====================================================
// PRICE CHANGE ALERTS
// =====================================================

export interface PriceChangeAlert {
  invoice_id: string;
  invoice_number: string | null;
  invoice_date: string;
  line_item_id: string;
  ingredient_id: string;
  ingredient_name: string;
  vendor_description: string;
  old_price: number;
  new_price: number;
  price_change_pct: number;
  affected_recipe_count: number;
  estimated_daily_impact?: number; // Estimated $ impact per day (if sales data available)
}

export interface PriceChangeAlertFilters {
  min_change_pct?: number; // Only show changes > X%
  date_from?: string;
  date_to?: string;
  ingredient_id?: string;
  vendor_id?: string;
}

// =====================================================
// INVOICE UPLOAD
// =====================================================

export interface UploadInvoiceRequest {
  file: File;
  store_id: string;
  vendor_id?: string;
  invoice_date?: string;
}

export interface UploadInvoiceResponse {
  success: boolean;
  invoice_id: string;
  file_url: string;
  error?: string;
}
