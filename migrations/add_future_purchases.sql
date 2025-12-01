-- Migration: Add Future Purchases Feature
-- This table stores planned future purchases with savings goals

-- Create the future_purchases table
CREATE TABLE IF NOT EXISTS public.future_purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  
  -- Purchase details
  name text NOT NULL,
  description text,
  target_amount numeric NOT NULL CHECK (target_amount > 0),
  current_saved numeric NOT NULL DEFAULT 0 CHECK (current_saved >= 0),
  
  -- Urgency: 1 (low) to 5 (critical)
  urgency integer NOT NULL DEFAULT 3 CHECK (urgency >= 1 AND urgency <= 5),
  
  -- Target date for the purchase
  target_date date NOT NULL,
  
  -- Calculated recommended monthly savings (updated by app logic)
  recommended_monthly_savings numeric DEFAULT 0,
  
  -- Category/icon for visual representation
  icon text DEFAULT 'package',
  color text DEFAULT '#38bdf8',
  
  -- Status tracking
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'paused')),
  
  -- Monthly allocation history (stored as JSONB array)
  -- Format: [{ "month": "2024-01", "amount": 100, "allocated_at": "2024-01-31T00:00:00Z" }]
  allocations jsonb DEFAULT '[]'::jsonb,
  
  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  
  CONSTRAINT future_purchases_pkey PRIMARY KEY (id),
  CONSTRAINT future_purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_future_purchases_user_id ON public.future_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_future_purchases_status ON public.future_purchases(status);
CREATE INDEX IF NOT EXISTS idx_future_purchases_target_date ON public.future_purchases(target_date);
CREATE INDEX IF NOT EXISTS idx_future_purchases_user_status ON public.future_purchases(user_id, status);

-- Enable RLS (Row Level Security)
ALTER TABLE public.future_purchases ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own future purchases
CREATE POLICY "Users can view own future purchases"
  ON public.future_purchases
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own future purchases"
  ON public.future_purchases
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own future purchases"
  ON public.future_purchases
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own future purchases"
  ON public.future_purchases
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_future_purchases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_future_purchases_updated_at ON public.future_purchases;
CREATE TRIGGER trigger_future_purchases_updated_at
  BEFORE UPDATE ON public.future_purchases
  FOR EACH ROW
  EXECUTE FUNCTION update_future_purchases_updated_at();

-- Add comments for documentation
COMMENT ON TABLE public.future_purchases IS 'Stores planned future purchases with savings goals and progress tracking';
COMMENT ON COLUMN public.future_purchases.urgency IS 'Priority level: 1=low, 2=medium-low, 3=medium, 4=high, 5=critical';
COMMENT ON COLUMN public.future_purchases.allocations IS 'JSON array tracking monthly savings allocations';
COMMENT ON COLUMN public.future_purchases.recommended_monthly_savings IS 'Calculated based on target amount, date, and user spending patterns';
