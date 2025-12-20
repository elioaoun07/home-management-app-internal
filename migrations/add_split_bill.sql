-- ============================================
-- SPLIT BILL FEATURE
-- Migration: add_split_bill.sql
-- ============================================
-- This migration adds support for split transactions where two household 
-- members share a single expense, each contributing their portion.
--
-- Key design decisions:
-- 1. Single transaction entry in database (not two separate entries)
-- 2. Owner is the person who created the transaction
-- 3. Collaborator can add their amount and description
-- 4. Total amount = owner_amount + collaborator_amount for analytics
-- ============================================

-- Add split bill columns to transactions table
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS split_requested BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS collaborator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS collaborator_amount NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS collaborator_description TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS split_completed_at TIMESTAMPTZ DEFAULT NULL;

-- Index for finding pending split requests for a user
CREATE INDEX IF NOT EXISTS idx_transactions_split_pending
ON public.transactions(collaborator_id, split_requested, split_completed_at)
WHERE split_requested = TRUE AND split_completed_at IS NULL;

-- Index for finding all split transactions
CREATE INDEX IF NOT EXISTS idx_transactions_split
ON public.transactions(split_requested)
WHERE split_requested = TRUE;

-- ============================================
-- UPDATE RLS POLICIES
-- ============================================

-- Allow collaborators to update their portion of split transactions
CREATE POLICY "Collaborators can update split amounts"
ON public.transactions FOR UPDATE
USING (
  split_requested = TRUE 
  AND collaborator_id = auth.uid()
  AND split_completed_at IS NULL
)
WITH CHECK (
  split_requested = TRUE 
  AND collaborator_id = auth.uid()
);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN public.transactions.split_requested IS 'When true, this transaction is a split bill awaiting collaborator input';
COMMENT ON COLUMN public.transactions.collaborator_id IS 'The partner user ID who will contribute to this split transaction';
COMMENT ON COLUMN public.transactions.collaborator_amount IS 'The amount the collaborator contributed to this transaction';
COMMENT ON COLUMN public.transactions.collaborator_description IS 'Optional description from the collaborator about their portion';
COMMENT ON COLUMN public.transactions.split_completed_at IS 'Timestamp when the collaborator completed their portion';
