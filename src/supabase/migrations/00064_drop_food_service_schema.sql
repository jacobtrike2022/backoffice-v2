-- =====================================================
-- Drop Trike Kitchen Food Service Schema
-- Migration 00064 - Drops food service schema (removed from wrong project)
-- =====================================================
-- This migration removes the food service module that was
-- added to the wrong project. All tables, functions, and
-- triggers from 00062 are dropped.
-- =====================================================

-- Drop triggers first (they reference tables)
DROP TRIGGER IF EXISTS vendors_updated_at ON vendors;
DROP TRIGGER IF EXISTS ingredients_updated_at ON ingredients;
DROP TRIGGER IF EXISTS ingredients_calculate_unit_cost ON ingredients;
DROP TRIGGER IF EXISTS recipes_updated_at ON recipes;
DROP TRIGGER IF EXISTS invoices_updated_at ON invoices;

-- Drop tables in dependency order (children before parents)
DROP TABLE IF EXISTS production_logs;
DROP TABLE IF EXISTS waste_logs;
DROP TABLE IF EXISTS invoice_line_items;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS recipe_ingredients;
DROP TABLE IF EXISTS recipes;
DROP TABLE IF EXISTS ingredients;
DROP TABLE IF EXISTS vendors;

-- Drop functions
DROP FUNCTION IF EXISTS update_vendors_updated_at();
DROP FUNCTION IF EXISTS update_ingredients_updated_at();
DROP FUNCTION IF EXISTS calculate_ingredient_unit_cost();
DROP FUNCTION IF EXISTS update_recipes_updated_at();
DROP FUNCTION IF EXISTS update_invoices_updated_at();
DROP FUNCTION IF EXISTS calculate_recipe_food_cost(UUID);
DROP FUNCTION IF EXISTS detect_price_change_impact(UUID, DECIMAL);
DROP FUNCTION IF EXISTS update_ingredient_cost_from_invoice(UUID, DECIMAL, UUID);
