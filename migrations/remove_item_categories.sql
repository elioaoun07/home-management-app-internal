-- Migration: Remove item categories and mappings tables
-- Date: 2025-12-08
-- Description: Removes database tables for item categories since categories are now hardcoded in the application

-- ============================================
-- STEP 1: Drop foreign key constraints first
-- ============================================

-- Drop the foreign key constraint from item_category_mappings to items
ALTER TABLE IF EXISTS item_category_mappings 
DROP CONSTRAINT IF EXISTS item_category_mappings_item_id_fkey;

-- Drop the foreign key constraint from item_category_mappings to item_categories
ALTER TABLE IF EXISTS item_category_mappings 
DROP CONSTRAINT IF EXISTS item_category_mappings_category_id_fkey;

-- ============================================
-- STEP 2: Drop the mapping table
-- ============================================

DROP TABLE IF EXISTS item_category_mappings CASCADE;

-- ============================================
-- STEP 3: Drop the categories table
-- ============================================

DROP TABLE IF EXISTS item_categories CASCADE;

-- ============================================
-- STEP 4: Drop any related indexes (if they weren't cascade deleted)
-- ============================================

DROP INDEX IF EXISTS idx_item_category_mappings_item_id;
DROP INDEX IF EXISTS idx_item_category_mappings_category_id;
DROP INDEX IF EXISTS idx_item_categories_user_id;
DROP INDEX IF EXISTS idx_item_categories_position;

-- ============================================
-- VERIFICATION QUERY
-- ============================================

-- Run this to verify the tables are gone:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('item_categories', 'item_category_mappings');

-- Expected result: No rows (empty result set)
