/**
 * Supabase Edge Function: Process Invoice
 *
 * Handles OCR and AI parsing of invoice images using Anthropic Claude Vision API
 * Workflow:
 * 1. Receive invoice_id and image_url from request
 * 2. Fetch image from Supabase Storage
 * 3. Call Claude Vision API for OCR extraction
 * 4. Parse structured invoice data from AI response
 * 5. Create invoice line items
 * 6. Match line items to ingredients
 * 7. Update invoice status
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.17.0';

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessInvoiceRequest {
  invoice_id: string;
  image_url: string;
  organization_id: string;
}

interface OCRLineItem {
  vendor_item_number?: string;
  description: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  extended_price: number;
}

interface OCRInvoiceData {
  vendor?: string;
  invoice_number?: string;
  invoice_date?: string;
  delivery_date?: string;
  line_items: OCRLineItem[];
  subtotal?: number;
  tax?: number;
  total?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '',
    });

    // Parse request body
    const { invoice_id, image_url, organization_id }: ProcessInvoiceRequest = await req.json();

    console.log(`Processing invoice ${invoice_id} for organization ${organization_id}`);

    // Update invoice status to 'processing'
    await supabaseClient
      .from('invoices')
      .update({ status: 'processing' })
      .eq('id', invoice_id);

    // Fetch image from URL
    console.log(`Fetching image from ${image_url}`);
    const imageResponse = await fetch(image_url);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));

    // Determine media type from URL or default to JPEG
    let mediaType = 'image/jpeg';
    if (image_url.toLowerCase().includes('.png')) {
      mediaType = 'image/png';
    } else if (image_url.toLowerCase().includes('.pdf')) {
      mediaType = 'application/pdf';
    }

    console.log(`Calling Claude Vision API with ${mediaType}`);

    // Call Anthropic Vision API for OCR
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `Extract all information from this vendor invoice. Return ONLY valid JSON (no markdown, no code blocks) in this exact format:

{
  "vendor": "vendor company name",
  "invoice_number": "INV-12345",
  "invoice_date": "2024-01-15",
  "delivery_date": "2024-01-15",
  "line_items": [
    {
      "vendor_item_number": "ITEM-123",
      "description": "Product description",
      "quantity": 2,
      "unit": "case",
      "unit_price": 45.99,
      "extended_price": 91.98
    }
  ],
  "subtotal": 200.00,
  "tax": 15.00,
  "total": 215.00
}

Important:
- Extract ALL line items from the invoice
- Include vendor item numbers if visible
- Quantities should be numeric (convert "2.0" to 2)
- Prices should be numeric decimals (convert "$45.99" to 45.99)
- If a field is not visible, use null
- Return ONLY the JSON object, no other text`,
            },
          ],
        },
      ],
    });

    // Extract text content from response
    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    console.log('Claude response received, parsing JSON...');

    // Parse JSON response (handle potential markdown wrapping)
    let responseText = textContent.text.trim();

    // Remove markdown code blocks if present
    if (responseText.startsWith('```json')) {
      responseText = responseText.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    const extractedData: OCRInvoiceData = JSON.parse(responseText);

    console.log(`Extracted ${extractedData.line_items.length} line items`);

    // Calculate confidence score based on data completeness
    let confidenceScore = 0.5; // Base score
    if (extractedData.vendor) confidenceScore += 0.1;
    if (extractedData.invoice_number) confidenceScore += 0.1;
    if (extractedData.invoice_date) confidenceScore += 0.1;
    if (extractedData.total) confidenceScore += 0.1;
    if (extractedData.line_items.length > 0) confidenceScore += 0.1;

    // Update invoice with parsed data
    await supabaseClient
      .from('invoices')
      .update({
        ocr_raw_output: extractedData,
        ai_parsed_output: extractedData,
        confidence_score: confidenceScore,
        status: 'parsed',
        invoice_number: extractedData.invoice_number || null,
        invoice_date: extractedData.invoice_date || null,
        delivery_date: extractedData.delivery_date || null,
        subtotal: extractedData.subtotal || null,
        tax: extractedData.tax || null,
        total: extractedData.total || null,
      })
      .eq('id', invoice_id);

    // Match line items to ingredients and create records
    const lineItemInserts = [];

    for (const lineItem of extractedData.line_items) {
      // Try to match ingredient by vendor_item_number first
      let matchedIngredient = null;
      let matchConfidence = 0;
      let matchStatus: 'auto' | 'manual' | 'unmatched' = 'unmatched';

      if (lineItem.vendor_item_number) {
        const { data: exactMatch } = await supabaseClient
          .from('ingredients')
          .select('id, current_cost_per_unit')
          .eq('organization_id', organization_id)
          .eq('vendor_item_number', lineItem.vendor_item_number)
          .limit(1)
          .single();

        if (exactMatch) {
          matchedIngredient = exactMatch;
          matchConfidence = 0.95;
          matchStatus = 'auto';
        }
      }

      // If no exact match, try fuzzy match on description
      if (!matchedIngredient && lineItem.description) {
        const searchTerm = lineItem.description.split(' ')[0]; // Use first word
        const { data: fuzzyMatches } = await supabaseClient
          .from('ingredients')
          .select('id, name, current_cost_per_unit')
          .eq('organization_id', organization_id)
          .ilike('name', `%${searchTerm}%`)
          .limit(1);

        if (fuzzyMatches && fuzzyMatches.length > 0) {
          matchedIngredient = fuzzyMatches[0];
          matchConfidence = 0.7;
          matchStatus = 'auto';
        }
      }

      // Calculate price change if ingredient matched
      let previousUnitPrice = null;
      let priceChangePct = null;

      if (matchedIngredient && matchedIngredient.current_cost_per_unit) {
        previousUnitPrice = matchedIngredient.current_cost_per_unit;
        priceChangePct = ((lineItem.unit_price - previousUnitPrice) / previousUnitPrice) * 100;
      }

      // Prepare line item insert
      lineItemInserts.push({
        invoice_id: invoice_id,
        vendor_item_number: lineItem.vendor_item_number || null,
        vendor_description: lineItem.description,
        quantity: lineItem.quantity,
        unit_of_measure: lineItem.unit || null,
        unit_price: lineItem.unit_price,
        extended_price: lineItem.extended_price,
        ingredient_id: matchedIngredient?.id || null,
        match_confidence: matchConfidence > 0 ? matchConfidence : null,
        match_status: matchStatus,
        previous_unit_price: previousUnitPrice,
        price_change_pct: priceChangePct,
      });
    }

    // Insert all line items
    if (lineItemInserts.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('invoice_line_items')
        .insert(lineItemInserts);

      if (insertError) {
        console.error('Error inserting line items:', insertError);
        throw insertError;
      }
    }

    // Determine if invoice needs review
    const unmatchedCount = lineItemInserts.filter((item) => !item.ingredient_id).length;
    const significantPriceChanges = lineItemInserts.filter(
      (item) => item.price_change_pct && Math.abs(item.price_change_pct) > 10
    ).length;

    let finalStatus = 'parsed';
    if (unmatchedCount > extractedData.line_items.length * 0.3 || significantPriceChanges > 0) {
      // More than 30% unmatched or any significant price changes
      finalStatus = 'review_required';
    }

    // Update final status
    await supabaseClient
      .from('invoices')
      .update({ status: finalStatus })
      .eq('id', invoice_id);

    console.log(`Invoice processing complete. Status: ${finalStatus}`);

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        invoice_id: invoice_id,
        parsed_data: extractedData,
        line_items_created: lineItemInserts.length,
        unmatched_items: unmatchedCount,
        status: finalStatus,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error processing invoice:', error);

    // Try to update invoice status to error if we have the invoice_id
    try {
      const body = await req.json();
      if (body.invoice_id) {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        await supabaseClient
          .from('invoices')
          .update({
            status: 'review_required',
            ai_parsed_output: { error: error.message },
          })
          .eq('id', body.invoice_id);
      }
    } catch (updateError) {
      console.error('Error updating invoice status:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
