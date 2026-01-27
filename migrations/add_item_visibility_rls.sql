-- ============================================================
-- UPDATE RLS POLICIES FOR CATALOGUE_ITEMS VISIBILITY
-- ============================================================
-- Allows items to be shared with household members when is_public = true.
-- ============================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own items" ON public.catalogue_items;
DROP POLICY IF EXISTS "Users can view own and partner public items" ON public.catalogue_items;
DROP POLICY IF EXISTS "catalogue_items_select_policy" ON public.catalogue_items;
DROP POLICY IF EXISTS "catalogue_items_insert_policy" ON public.catalogue_items;
DROP POLICY IF EXISTS "catalogue_items_update_policy" ON public.catalogue_items;
DROP POLICY IF EXISTS "catalogue_items_delete_policy" ON public.catalogue_items;
DROP POLICY IF EXISTS "Users can insert own items" ON public.catalogue_items;
DROP POLICY IF EXISTS "Users can update own items" ON public.catalogue_items;
DROP POLICY IF EXISTS "Users can delete own items" ON public.catalogue_items;

-- SELECT: Users can see their own items OR public items from household partner
CREATE POLICY "catalogue_items_select_policy" ON public.catalogue_items
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

-- INSERT: Users can only insert their own items
CREATE POLICY "catalogue_items_insert_policy" ON public.catalogue_items
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- UPDATE: Users can only update their own items
CREATE POLICY "catalogue_items_update_policy" ON public.catalogue_items
  FOR UPDATE USING (user_id = auth.uid());

-- DELETE: Users can only delete their own items
CREATE POLICY "catalogue_items_delete_policy" ON public.catalogue_items
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- Ensure RLS is enabled
-- ============================================================
ALTER TABLE public.catalogue_items ENABLE ROW LEVEL SECURITY;
