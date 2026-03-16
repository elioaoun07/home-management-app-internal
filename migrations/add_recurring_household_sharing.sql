-- Migration: Allow household partners to view recurring payments
-- Both household members can see all recurring payments and log transactions from them

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own recurring payments" ON public.recurring_payments;
DROP POLICY IF EXISTS "Users can update their own recurring payments" ON public.recurring_payments;

-- SELECT: Own + household partner's recurring payments
CREATE POLICY "Users can view own and partner recurring payments" ON public.recurring_payments
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.household_links hl
      WHERE hl.active = true
      AND (
        (hl.owner_user_id = auth.uid() AND hl.partner_user_id = recurring_payments.user_id)
        OR
        (hl.partner_user_id = auth.uid() AND hl.owner_user_id = recurring_payments.user_id)
      )
    )
  );

-- UPDATE: Own + household partner's recurring payments (for advancing next_due_date on confirm)
CREATE POLICY "Users can update own and partner recurring payments" ON public.recurring_payments
  FOR UPDATE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.household_links hl
      WHERE hl.active = true
      AND (
        (hl.owner_user_id = auth.uid() AND hl.partner_user_id = recurring_payments.user_id)
        OR
        (hl.partner_user_id = auth.uid() AND hl.owner_user_id = recurring_payments.user_id)
      )
    )
  );

-- INSERT and DELETE remain owner-only (already exist from original migration)
