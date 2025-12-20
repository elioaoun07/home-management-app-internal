-- ============================================
-- ADD SELECT POLICY FOR SPLIT BILL COLLABORATORS
-- Migration: add_split_bill_select_policy.sql
-- ============================================
-- This migration adds a SELECT policy so collaborators can view
-- transactions where they are marked as the collaborator_id.
-- Without this, the collaborator cannot see the split bill request.
-- ============================================

-- Drop existing policy if it exists (to allow re-running)
DROP POLICY IF EXISTS "Collaborators can view split transactions" ON public.transactions;

-- Allow collaborators to view split transactions where they are the collaborator
CREATE POLICY "Collaborators can view split transactions"
ON public.transactions FOR SELECT
USING (
  split_requested = TRUE 
  AND collaborator_id = auth.uid()
);

COMMENT ON POLICY "Collaborators can view split transactions" ON public.transactions 
IS 'Allows collaborators to view split bill transactions where they are marked as the collaborator';
