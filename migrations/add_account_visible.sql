-- Add visible column to accounts table for soft-delete
-- Run this migration to enable hiding accounts instead of hard deleting

ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS visible boolean NOT NULL DEFAULT true;

-- Create index for filtering visible accounts
CREATE INDEX IF NOT EXISTS idx_accounts_visible ON public.accounts (visible);

-- Update existing accounts to be visible
UPDATE public.accounts SET visible = true WHERE visible IS NULL;
