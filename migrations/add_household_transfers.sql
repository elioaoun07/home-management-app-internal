-- Migration: Add household transfer support to transfers table
-- Allows transfers between household members with fee/return tracking

-- Add new columns to transfers table
ALTER TABLE public.transfers
  ADD COLUMN IF NOT EXISTS transfer_type text NOT NULL DEFAULT 'self'
    CHECK (transfer_type IN ('self', 'household')),
  ADD COLUMN IF NOT EXISTS recipient_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS fee_amount numeric DEFAULT 0 CHECK (fee_amount >= 0),
  ADD COLUMN IF NOT EXISTS returned_amount numeric DEFAULT 0 CHECK (returned_amount >= 0),
  ADD COLUMN IF NOT EXISTS household_link_id uuid REFERENCES public.household_links(id);

-- Add comment explaining the fields
COMMENT ON COLUMN public.transfers.transfer_type IS 'self = between own accounts, household = between household members';
COMMENT ON COLUMN public.transfers.recipient_user_id IS 'The user_id of the recipient (partner) for household transfers';
COMMENT ON COLUMN public.transfers.fee_amount IS 'Fee/charge deducted from the transfer (e.g., wire transfer fee)';
COMMENT ON COLUMN public.transfers.returned_amount IS 'Amount returned back to sender (partial return scenario)';
COMMENT ON COLUMN public.transfers.household_link_id IS 'Reference to the household link for household transfers';

-- For household transfers, the net amounts are:
--   Sender net: -(amount - returned_amount)  (they sent amount, got back returned_amount)
--   Recipient net: +(amount - fee_amount - returned_amount)  (they received amount, paid fee, returned some)
--   Fee is recorded as a separate transaction on the recipient's side

-- Index for efficient household transfer queries
CREATE INDEX IF NOT EXISTS idx_transfers_recipient_user_id ON public.transfers(recipient_user_id) WHERE recipient_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transfers_transfer_type ON public.transfers(transfer_type);

-- Update RLS policies to allow household members to see each other's transfers
-- (The existing code already handles this via the getPartnerUserId helper)
