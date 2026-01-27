-- ============================================================
-- ADD VISIBILITY (PUBLIC/PRIVATE) TO CATALOGUE MODULES
-- ============================================================
-- Allows modules to be shared with household members when public.
-- Default: true (public) - visible to household members
-- ============================================================

-- Add is_public column to catalogue_modules
ALTER TABLE public.catalogue_modules
ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

-- Create index for efficient filtering by visibility
CREATE INDEX IF NOT EXISTS catalogue_modules_is_public_idx 
  ON public.catalogue_modules(is_public);

-- ============================================================
-- UPDATE RLS POLICIES
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own modules" ON public.catalogue_modules;
DROP POLICY IF EXISTS "Users can view own and partner public modules" ON public.catalogue_modules;
DROP POLICY IF EXISTS "catalogue_modules_select_policy" ON public.catalogue_modules;
DROP POLICY IF EXISTS "catalogue_modules_insert_policy" ON public.catalogue_modules;
DROP POLICY IF EXISTS "catalogue_modules_update_policy" ON public.catalogue_modules;
DROP POLICY IF EXISTS "catalogue_modules_delete_policy" ON public.catalogue_modules;
DROP POLICY IF EXISTS "Users can insert own modules" ON public.catalogue_modules;
DROP POLICY IF EXISTS "Users can update own modules" ON public.catalogue_modules;
DROP POLICY IF EXISTS "Users can delete own modules" ON public.catalogue_modules;

-- SELECT: Users can see their own modules OR public modules from household partner
CREATE POLICY "catalogue_modules_select_policy" ON public.catalogue_modules
  FOR SELECT USING (
    user_id = auth.uid()
    OR
    (
      is_public = true
      AND EXISTS (
        SELECT 1 FROM public.household_links hl
        WHERE hl.active = true
        AND (
          (hl.owner_user_id = auth.uid() AND hl.partner_user_id = user_id)
          OR
          (hl.partner_user_id = auth.uid() AND hl.owner_user_id = user_id)
        )
      )
    )
  );

-- INSERT: Users can only insert their own modules
CREATE POLICY "catalogue_modules_insert_policy" ON public.catalogue_modules
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- UPDATE: Users can only update their own modules
CREATE POLICY "catalogue_modules_update_policy" ON public.catalogue_modules
  FOR UPDATE USING (user_id = auth.uid());

-- DELETE: Users can only delete their own modules
CREATE POLICY "catalogue_modules_delete_policy" ON public.catalogue_modules
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON COLUMN public.catalogue_modules.is_public IS 
  'Visibility: true = visible to all household members, false = private (only owner)';

-- ============================================================
-- CLEANUP: Remove duplicate modules for partner user
-- ============================================================
-- Run this AFTER the above migration to remove Rachel's duplicate modules
-- This will cascade delete her categories and items too if they exist

-- First, check what will be deleted:
-- SELECT * FROM public.catalogue_modules WHERE user_id = 'c23cd730-b468-4b2f-8db0-8c8100f79f4b';

-- Then delete:
DELETE FROM public.catalogue_modules 
WHERE user_id = 'c23cd730-b468-4b2f-8db0-8c8100f79f4b';
