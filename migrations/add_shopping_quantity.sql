-- ============================================
-- SHOPPING LIST QUANTITY SUPPORT
-- Migration: add_shopping_quantity.sql
-- ============================================
-- Adds quantity field to shopping list items for better inventory tracking

-- 1. Add quantity column to hub_messages for shopping items
ALTER TABLE public.hub_messages
ADD COLUMN IF NOT EXISTS item_quantity TEXT DEFAULT NULL;

-- 2. Create index for shopping list queries with quantity
CREATE INDEX IF NOT EXISTS idx_hub_messages_shopping_quantity
ON public.hub_messages(thread_id, item_quantity)
WHERE item_quantity IS NOT NULL AND archived_at IS NULL;

-- Note: Using TEXT instead of INTEGER to allow flexible quantities like:
-- - "2 bags"
-- - "1 lb"
-- - "3-4 pieces"
-- - "500g"
-- This gives users more flexibility in describing quantities
