-- Migration: Update form_blocks type CHECK constraint to include all frontend block types
-- Fixes: "new row for relation form_blocks violates check constraint form_blocks_type_check"
-- The frontend uses block types (checkboxes, dropdown, conditional) not in the old constraint.
-- This migration is idempotent — it drops before recreating.

ALTER TABLE form_blocks DROP CONSTRAINT IF EXISTS form_blocks_type_check;
ALTER TABLE form_blocks DROP CONSTRAINT IF EXISTS form_blocks_block_type_check;

ALTER TABLE form_blocks ADD CONSTRAINT form_blocks_type_check
  CHECK (type IN (
    -- Questions (from frontend BLOCK_TYPES)
    'text', 'textarea', 'number', 'date', 'time',
    'radio', 'checkboxes', 'dropdown', 'yes_no', 'rating',
    'file', 'signature', 'slider', 'location', 'photo',
    -- Content
    'instruction', 'divider',
    -- Actions
    'conditional',
    -- Legacy types from initial schema (keep for existing data)
    'select', 'multiselect', 'checkbox', 'section', 'html'
  ));
