-- Migration: Clean up categories from saving accounts and seed income-style categories
-- Saving accounts should have the same categories as Income accounts

-- Step 1: Delete all existing categories (and their subcategories via cascade) for saving-type accounts
DELETE FROM public.user_categories
WHERE account_id IN (
  SELECT id FROM public.accounts WHERE type = 'saving'
);

-- Step 2: Seed income-style categories for all saving accounts
-- These match the categories used for Income accounts: "Income" and "Bonus"
INSERT INTO public.user_categories (user_id, account_id, name, color, parent_id, position, visible)
SELECT 
  a.user_id,
  a.id as account_id,
  'Income' as name,
  '#85bb65' as color,
  NULL as parent_id,
  1 as position,
  true as visible
FROM public.accounts a
WHERE a.type = 'saving';

INSERT INTO public.user_categories (user_id, account_id, name, color, parent_id, position, visible)
SELECT 
  a.user_id,
  a.id as account_id,
  'Bonus' as name,
  '#FFD700' as color,
  NULL as parent_id,
  2 as position,
  true as visible
FROM public.accounts a
WHERE a.type = 'saving';

-- Add comment
COMMENT ON TABLE public.accounts IS 'User accounts. Expense accounts track spending with expense categories, Income and Saving accounts track earnings with income-style categories.';
