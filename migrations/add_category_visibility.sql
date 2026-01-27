-- ============================================================
-- ADD VISIBILITY (PUBLIC/PRIVATE) TO CATALOGUE CATEGORIES
-- ============================================================
-- Allows categories to be shared with household members when public.
-- Default: true (public) - visible to household members
-- ============================================================

-- Add is_public column to catalogue_categories
ALTER TABLE public.catalogue_categories
ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

-- Create index for efficient filtering by visibility
CREATE INDEX IF NOT EXISTS catalogue_categories_is_public_idx 
  ON public.catalogue_categories(is_public);

-- ============================================================
-- UPDATE RLS POLICIES
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own categories" ON public.catalogue_categories;
DROP POLICY IF EXISTS "Users can view own and partner public categories" ON public.catalogue_categories;
DROP POLICY IF EXISTS "catalogue_categories_select_policy" ON public.catalogue_categories;
DROP POLICY IF EXISTS "catalogue_categories_insert_policy" ON public.catalogue_categories;
DROP POLICY IF EXISTS "catalogue_categories_update_policy" ON public.catalogue_categories;
DROP POLICY IF EXISTS "catalogue_categories_delete_policy" ON public.catalogue_categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON public.catalogue_categories;
DROP POLICY IF EXISTS "Users can update own categories" ON public.catalogue_categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON public.catalogue_categories;

-- SELECT: Users can see their own categories OR public categories from household partner
CREATE POLICY "catalogue_categories_select_policy" ON public.catalogue_categories
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

-- INSERT: Users can only insert their own categories
CREATE POLICY "catalogue_categories_insert_policy" ON public.catalogue_categories
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- UPDATE: Users can only update their own categories
CREATE POLICY "catalogue_categories_update_policy" ON public.catalogue_categories
  FOR UPDATE USING (user_id = auth.uid());

-- DELETE: Users can only delete their own categories
CREATE POLICY "catalogue_categories_delete_policy" ON public.catalogue_categories
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON COLUMN public.catalogue_categories.is_public IS 
  'Visibility: true = visible to all household members, false = private (only owner)';
