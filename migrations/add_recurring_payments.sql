-- Create recurring_payments table for scheduled/recurring bills and payments
-- Run this migration in your Supabase SQL Editor

-- Drop existing table if needed (for development)
-- DROP TABLE IF EXISTS public.recurring_payments CASCADE;

CREATE TABLE IF NOT EXISTS public.recurring_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.user_categories(id) ON DELETE SET NULL,
  subcategory_id UUID REFERENCES public.user_categories(id) ON DELETE SET NULL,
  
  -- Payment details
  name TEXT NOT NULL, -- e.g., "Internet Bill", "Netflix Subscription"
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  
  -- Recurrence pattern
  recurrence_type TEXT NOT NULL CHECK (recurrence_type IN ('daily', 'weekly', 'monthly', 'yearly')),
  recurrence_day INTEGER, -- For monthly: 1-31 (day of month), for weekly: 0-6 (0=Sunday), null for daily
  
  -- Scheduling
  next_due_date DATE NOT NULL,
  last_processed_date DATE,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_recurring_payments_user_id ON public.recurring_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_payments_account_id ON public.recurring_payments(account_id);
CREATE INDEX IF NOT EXISTS idx_recurring_payments_next_due_date ON public.recurring_payments(next_due_date);
CREATE INDEX IF NOT EXISTS idx_recurring_payments_is_active ON public.recurring_payments(is_active);

-- Enable Row Level Security
ALTER TABLE public.recurring_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own recurring payments
CREATE POLICY "Users can view their own recurring payments"
  ON public.recurring_payments
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recurring payments"
  ON public.recurring_payments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recurring payments"
  ON public.recurring_payments
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recurring payments"
  ON public.recurring_payments
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_recurring_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_recurring_payments_updated_at
  BEFORE UPDATE ON public.recurring_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_recurring_payments_updated_at();

-- Function to calculate next due date after processing
CREATE OR REPLACE FUNCTION calculate_next_due_date(
  current_due_date DATE,
  recurrence_type TEXT,
  recurrence_day INTEGER
)
RETURNS DATE AS $$
BEGIN
  CASE recurrence_type
    WHEN 'daily' THEN
      RETURN current_due_date + INTERVAL '1 day';
    WHEN 'weekly' THEN
      RETURN current_due_date + INTERVAL '1 week';
    WHEN 'monthly' THEN
      -- Add one month, keeping the same day if possible
      RETURN (current_due_date + INTERVAL '1 month')::DATE;
    WHEN 'yearly' THEN
      RETURN (current_due_date + INTERVAL '1 year')::DATE;
    ELSE
      RETURN current_due_date;
  END CASE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE public.recurring_payments IS 'Stores recurring/scheduled payments like bills and subscriptions';
COMMENT ON COLUMN public.recurring_payments.recurrence_type IS 'Frequency: daily, weekly, monthly, or yearly';
COMMENT ON COLUMN public.recurring_payments.recurrence_day IS 'Day number: 1-31 for monthly (day of month), 0-6 for weekly (0=Sunday), null for daily/yearly';
COMMENT ON COLUMN public.recurring_payments.next_due_date IS 'Next date this payment is due';
COMMENT ON COLUMN public.recurring_payments.last_processed_date IS 'Last date this payment was confirmed and converted to a transaction';
