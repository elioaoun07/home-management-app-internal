-- Migration: Setup Row Level Security for Household Sharing
-- Purpose: Allow household partners to view each other's accounts, categories, and transactions (read-only)
-- Note: Partners can only edit/delete their OWN data, but can VIEW partner's data

-- ==============================================
-- ACCOUNTS TABLE - Read access for household partners
-- ==============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can insert their own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can update their own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can delete their own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can view household partner accounts" ON public.accounts;

-- Enable RLS
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own accounts
CREATE POLICY "Users can view their own accounts"
ON public.accounts FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can view household partner's accounts (read-only)
CREATE POLICY "Users can view household partner accounts"
ON public.accounts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.household_links
    WHERE active = true
    AND (
      (owner_user_id = auth.uid() AND partner_user_id = user_id)
      OR (partner_user_id = auth.uid() AND owner_user_id = user_id)
    )
  )
);

-- Policy: Users can only insert their own accounts
CREATE POLICY "Users can insert their own accounts"
ON public.accounts FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own accounts
CREATE POLICY "Users can update their own accounts"
ON public.accounts FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only delete their own accounts
CREATE POLICY "Users can delete their own accounts"
ON public.accounts FOR DELETE
USING (auth.uid() = user_id);

-- ==============================================
-- USER_CATEGORIES TABLE - Read access for household partners
-- ==============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own categories" ON public.user_categories;
DROP POLICY IF EXISTS "Users can insert their own categories" ON public.user_categories;
DROP POLICY IF EXISTS "Users can update their own categories" ON public.user_categories;
DROP POLICY IF EXISTS "Users can delete their own categories" ON public.user_categories;
DROP POLICY IF EXISTS "Users can view household partner categories" ON public.user_categories;

-- Enable RLS
ALTER TABLE public.user_categories ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own categories
CREATE POLICY "Users can view their own categories"
ON public.user_categories FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can view household partner's categories (read-only)
CREATE POLICY "Users can view household partner categories"
ON public.user_categories FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.household_links
    WHERE active = true
    AND (
      (owner_user_id = auth.uid() AND partner_user_id = user_id)
      OR (partner_user_id = auth.uid() AND owner_user_id = user_id)
    )
  )
);

-- Policy: Users can only insert their own categories
CREATE POLICY "Users can insert their own categories"
ON public.user_categories FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own categories
CREATE POLICY "Users can update their own categories"
ON public.user_categories FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only delete their own categories
CREATE POLICY "Users can delete their own categories"
ON public.user_categories FOR DELETE
USING (auth.uid() = user_id);

-- ==============================================
-- TRANSACTIONS TABLE - Read access for household partners
-- ==============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can view household partner transactions" ON public.transactions;

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own transactions
CREATE POLICY "Users can view their own transactions"
ON public.transactions FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can view household partner's transactions (read-only, excluding private ones)
CREATE POLICY "Users can view household partner transactions"
ON public.transactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.household_links
    WHERE active = true
    AND (
      (owner_user_id = auth.uid() AND partner_user_id = user_id)
      OR (partner_user_id = auth.uid() AND owner_user_id = user_id)
    )
  )
  AND (is_private = false OR is_private IS NULL)
);

-- Policy: Users can only insert their own transactions
CREATE POLICY "Users can insert their own transactions"
ON public.transactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own transactions
CREATE POLICY "Users can update their own transactions"
ON public.transactions FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only delete their own transactions
CREATE POLICY "Users can delete their own transactions"
ON public.transactions FOR DELETE
USING (auth.uid() = user_id);

-- ==============================================
-- INDEXES for better query performance
-- ==============================================

-- Index for household links lookup
CREATE INDEX IF NOT EXISTS idx_household_links_owner ON public.household_links(owner_user_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_household_links_partner ON public.household_links(partner_user_id) WHERE active = true;

-- Index for transactions user_id lookup
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);

-- Index for accounts user_id lookup
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);

-- Index for user_categories user_id lookup
CREATE INDEX IF NOT EXISTS idx_user_categories_user_id ON public.user_categories(user_id);

COMMENT ON POLICY "Users can view household partner accounts" ON public.accounts IS 'Allows viewing partner accounts in household for dashboard display only';
COMMENT ON POLICY "Users can view household partner categories" ON public.user_categories IS 'Allows viewing partner categories in household for dashboard display only';
COMMENT ON POLICY "Users can view household partner transactions" ON public.transactions IS 'Allows viewing partner transactions in household for dashboard display (excluding private transactions)';
