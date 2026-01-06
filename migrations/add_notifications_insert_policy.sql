-- ============================================
-- ADD INSERT POLICY FOR NOTIFICATIONS
-- Allows users to create notifications for themselves or household members
-- ============================================

-- First, check current policies (run this to debug):
-- SELECT policyname, cmd, with_check FROM pg_policies WHERE tablename = 'notifications';

-- Drop any existing insert policies (if they exist)
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert household notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;

-- Single unified INSERT policy: users can insert for themselves OR their household partner
CREATE POLICY "Users can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (
    -- Can insert for self
    auth.uid() = user_id
    OR
    -- Can insert for household partner
    EXISTS (
      SELECT 1 FROM public.household_links hl
      WHERE hl.active = TRUE
        AND (
          (hl.owner_user_id = auth.uid() AND hl.partner_user_id = user_id)
          OR (hl.partner_user_id = auth.uid() AND hl.owner_user_id = user_id)
        )
    )
  );

-- Add comment for documentation
COMMENT ON POLICY "Users can insert notifications" ON public.notifications IS 
  'Allows users to create notifications for themselves or their household partner';

-- Verify the policy was created:
-- SELECT policyname, cmd, with_check FROM pg_policies WHERE tablename = 'notifications' AND cmd = 'INSERT';
