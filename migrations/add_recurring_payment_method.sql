-- Add payment_method column to recurring_payments
-- 'manual' = cash/in-person (user confirms & creates transaction)
-- 'auto' = online/card/auto-debit (informational only, imported via statement)

ALTER TABLE public.recurring_payments
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'manual'
  CHECK (payment_method IN ('manual', 'auto'));

-- Add index for filtering by payment method
CREATE INDEX IF NOT EXISTS idx_recurring_payments_payment_method
  ON public.recurring_payments(payment_method);
