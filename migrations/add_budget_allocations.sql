-- Migration: Add Budget Allocations Feature
-- This table stores monthly budget allocations by category/subcategory with user/partner assignment

-- Create the budget_allocations table
CREATE TABLE IF NOT EXISTS public.budget_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  
  -- Budget assignment: 'user' (me), 'partner', or 'both' (shared)
  assigned_to text NOT NULL DEFAULT 'both' CHECK (assigned_to IN ('user', 'partner', 'both')),
  
  -- Category reference (required)
  category_id uuid NOT NULL,
  
  -- Optional subcategory for granular budgets
  -- When NULL, budget applies to entire category
  -- When set, budget applies only to that subcategory
  subcategory_id uuid,
  
  -- Account reference (expense accounts only)
  account_id uuid NOT NULL,
  
  -- Budget amount for the month
  monthly_budget numeric NOT NULL DEFAULT 0 CHECK (monthly_budget >= 0),
  
  -- Which month this budget applies to (format: 'YYYY-MM')
  -- NULL means it's the default/recurring budget
  budget_month text,
  
  -- Timestamps
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT budget_allocations_pkey PRIMARY KEY (id),
  CONSTRAINT budget_allocations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT budget_allocations_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.user_categories(id) ON DELETE CASCADE,
  CONSTRAINT budget_allocations_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.user_categories(id) ON DELETE CASCADE,
  CONSTRAINT budget_allocations_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
  
  -- Unique constraint: one budget per category/subcategory/assigned_to/month combination
  CONSTRAINT budget_allocations_unique UNIQUE (user_id, category_id, subcategory_id, assigned_to, budget_month)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_budget_allocations_user_id ON public.budget_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_allocations_account_id ON public.budget_allocations(account_id);
CREATE INDEX IF NOT EXISTS idx_budget_allocations_category_id ON public.budget_allocations(category_id);
CREATE INDEX IF NOT EXISTS idx_budget_allocations_month ON public.budget_allocations(budget_month);
CREATE INDEX IF NOT EXISTS idx_budget_allocations_user_month ON public.budget_allocations(user_id, budget_month);

-- Enable RLS (Row Level Security)
ALTER TABLE public.budget_allocations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can access their own budget allocations
-- Also allow access to partner's budgets if household linked
CREATE POLICY "Users can view own budget allocations"
  ON public.budget_allocations
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.household_links
      WHERE active = true
      AND (
        (owner_user_id = auth.uid() AND partner_user_id = user_id)
        OR (partner_user_id = auth.uid() AND owner_user_id = user_id)
      )
    )
  );

CREATE POLICY "Users can insert own budget allocations"
  ON public.budget_allocations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budget allocations"
  ON public.budget_allocations
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own budget allocations"
  ON public.budget_allocations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_budget_allocations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_budget_allocations_updated_at ON public.budget_allocations;
CREATE TRIGGER trigger_budget_allocations_updated_at
  BEFORE UPDATE ON public.budget_allocations
  FOR EACH ROW
  EXECUTE FUNCTION update_budget_allocations_updated_at();

-- Add comments for documentation
COMMENT ON TABLE public.budget_allocations IS 'Stores monthly budget allocations by category with user/partner assignment';
COMMENT ON COLUMN public.budget_allocations.assigned_to IS 'Who this budget is for: user (me), partner, or both (shared)';
COMMENT ON COLUMN public.budget_allocations.subcategory_id IS 'Optional subcategory - when set, enables granular sub-budgets';
COMMENT ON COLUMN public.budget_allocations.budget_month IS 'YYYY-MM format - NULL means default recurring budget';
