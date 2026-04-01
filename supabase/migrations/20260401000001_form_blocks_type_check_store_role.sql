-- Migration: Add store_lookup and role_lookup to form_blocks type CHECK constraint
-- These are new reference-lookup block types added in session 4.
-- Idempotent: drops before recreating.

ALTER TABLE form_blocks DROP CONSTRAINT IF EXISTS form_blocks_type_check;
ALTER TABLE form_blocks DROP CONSTRAINT IF EXISTS form_blocks_block_type_check;

ALTER TABLE form_blocks ADD CONSTRAINT form_blocks_type_check
  CHECK (type IN (
    -- Questions (from frontend BLOCK_TYPES)
    'text', 'textarea', 'number', 'date', 'time',
    'radio', 'checkboxes', 'dropdown', 'yes_no', 'rating',
    'file', 'signature', 'slider', 'location', 'photo',
    -- Reference lookups
    'store_lookup', 'role_lookup',
    -- Content
    'instruction', 'divider',
    -- Actions
    'conditional',
    -- Legacy types from initial schema (keep for existing data)
    'select', 'multiselect', 'checkbox', 'section', 'html'
  ));
