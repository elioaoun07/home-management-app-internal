-- Migration: Add statement import and merchant mappings
-- This enables PDF bank statement import with OCR merchant recognition

-- Table to store learned merchant-to-category mappings
-- This is your "training" data - when you map a merchant once, it remembers
CREATE TABLE IF NOT EXISTS public.merchant_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  merchant_pattern text NOT NULL,  -- The text pattern from statement (e.g., "TOTERS", "SPINNEYS")
  merchant_name text NOT NULL,     -- Clean display name
  category_id uuid,
  subcategory_id uuid,
  account_id uuid,                 -- Default account for this merchant
  use_count integer DEFAULT 1,     -- How often this mapping was used
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT merchant_mappings_pkey PRIMARY KEY (id),
  CONSTRAINT merchant_mappings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT merchant_mappings_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.user_categories(id),
  CONSTRAINT merchant_mappings_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.user_categories(id),
  CONSTRAINT merchant_mappings_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id),
  CONSTRAINT merchant_mappings_unique_pattern UNIQUE (user_id, merchant_pattern)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_merchant_mappings_user_pattern 
  ON public.merchant_mappings(user_id, merchant_pattern);

-- Table to track statement imports history
CREATE TABLE IF NOT EXISTS public.statement_imports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  imported_at timestamp with time zone NOT NULL DEFAULT now(),
  transactions_count integer DEFAULT 0,
  status text DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  CONSTRAINT statement_imports_pkey PRIMARY KEY (id),
  CONSTRAINT statement_imports_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.merchant_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_imports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for merchant_mappings
CREATE POLICY "Users can view own merchant mappings" ON public.merchant_mappings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own merchant mappings" ON public.merchant_mappings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own merchant mappings" ON public.merchant_mappings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own merchant mappings" ON public.merchant_mappings
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for statement_imports
CREATE POLICY "Users can view own statement imports" ON public.statement_imports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own statement imports" ON public.statement_imports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to increment merchant mapping use count
CREATE OR REPLACE FUNCTION public.increment_merchant_use_count(
  p_user_id uuid,
  p_pattern text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.merchant_mappings
  SET use_count = use_count + 1,
      updated_at = now()
  WHERE user_id = p_user_id
    AND merchant_pattern = p_pattern;
END;
$$;
