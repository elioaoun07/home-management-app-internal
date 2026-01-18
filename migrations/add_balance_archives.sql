-- Migration: Add balance archives and daily transaction summaries
-- This replaces individual transaction entries with summarized data

-- ============================================================
-- 1. Monthly Balance Archives Table
-- ============================================================
-- Archives monthly snapshots for each account
CREATE TABLE IF NOT EXISTS public.account_balance_archives (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  
  -- Time period
  year_month text NOT NULL,  -- Format: "2026-01" for January 2026
  month_start_date date NOT NULL,
  month_end_date date NOT NULL,
  
  -- Balance snapshots
  opening_balance numeric NOT NULL,
  closing_balance numeric NOT NULL,
  
  -- Transaction summaries
  total_transaction_count integer NOT NULL DEFAULT 0,
  total_income numeric NOT NULL DEFAULT 0,
  total_expenses numeric NOT NULL DEFAULT 0,
  net_change numeric NOT NULL DEFAULT 0,  -- closing - opening (includes transfers/adjustments)
  
  -- Transfer summaries
  total_transfers_in numeric NOT NULL DEFAULT 0,
  total_transfers_out numeric NOT NULL DEFAULT 0,
  transfer_count integer NOT NULL DEFAULT 0,
  
  -- Manual adjustment summaries
  total_adjustments numeric NOT NULL DEFAULT 0,
  adjustment_count integer NOT NULL DEFAULT 0,
  
  -- Metadata
  archived_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT account_balance_archives_pkey PRIMARY KEY (id),
  CONSTRAINT aba_account_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
  CONSTRAINT aba_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT aba_unique_month UNIQUE (account_id, year_month)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_aba_account_id ON public.account_balance_archives(account_id);
CREATE INDEX IF NOT EXISTS idx_aba_user_id ON public.account_balance_archives(user_id);
CREATE INDEX IF NOT EXISTS idx_aba_year_month ON public.account_balance_archives(year_month DESC);

-- Enable RLS
ALTER TABLE public.account_balance_archives ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own balance archives" ON public.account_balance_archives
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own balance archives" ON public.account_balance_archives
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own balance archives" ON public.account_balance_archives
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Household members can view balance archives" ON public.account_balance_archives
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.household_links hl
      WHERE hl.active = true
        AND (
          (hl.owner_user_id = auth.uid() AND hl.partner_user_id = user_id)
          OR (hl.partner_user_id = auth.uid() AND hl.owner_user_id = user_id)
        )
    )
  );

-- ============================================================
-- 2. Daily Transaction Summaries Table
-- ============================================================
-- Instead of logging every transaction, we summarize by day
CREATE TABLE IF NOT EXISTS public.account_daily_summaries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  user_id uuid NOT NULL,
  
  -- Date
  summary_date date NOT NULL,
  
  -- Balance snapshots for the day
  opening_balance numeric NOT NULL,
  closing_balance numeric NOT NULL,
  
  -- Transaction counts
  transaction_count integer NOT NULL DEFAULT 0,
  income_count integer NOT NULL DEFAULT 0,
  expense_count integer NOT NULL DEFAULT 0,
  
  -- Transaction amounts
  total_income numeric NOT NULL DEFAULT 0,
  total_expenses numeric NOT NULL DEFAULT 0,
  net_transactions numeric NOT NULL DEFAULT 0,  -- income - expenses
  
  -- Largest transactions (for quick reference)
  largest_income numeric,
  largest_income_desc text,
  largest_expense numeric,
  largest_expense_desc text,
  
  -- Category breakdown (JSON for flexibility)
  category_breakdown jsonb,  -- [{"name": "Food", "color": "#ff0000", "amount": -50.00, "count": 3}]
  
  -- Metadata
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT account_daily_summaries_pkey PRIMARY KEY (id),
  CONSTRAINT ads_account_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE,
  CONSTRAINT ads_user_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT ads_unique_date UNIQUE (account_id, summary_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ads_account_id ON public.account_daily_summaries(account_id);
CREATE INDEX IF NOT EXISTS idx_ads_user_id ON public.account_daily_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_ads_summary_date ON public.account_daily_summaries(summary_date DESC);
CREATE INDEX IF NOT EXISTS idx_ads_account_date ON public.account_daily_summaries(account_id, summary_date DESC);

-- Enable RLS
ALTER TABLE public.account_daily_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own daily summaries" ON public.account_daily_summaries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own daily summaries" ON public.account_daily_summaries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily summaries" ON public.account_daily_summaries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Household members can view daily summaries" ON public.account_daily_summaries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.household_links hl
      WHERE hl.active = true
        AND (
          (hl.owner_user_id = auth.uid() AND hl.partner_user_id = user_id)
          OR (hl.partner_user_id = auth.uid() AND hl.owner_user_id = user_id)
        )
    )
  );

-- ============================================================
-- 3. Update balance_history to NOT include transactions
-- ============================================================
-- Add a flag to existing entries so we can filter out transaction entries
-- This keeps transfers, manual adjustments, reconciliations in history
-- But transactions will be shown via daily summaries instead

-- Add summary_only filter constraint comment
COMMENT ON TABLE public.account_balance_history IS 
'Audit trail for non-transaction balance changes. 
Transactions are now tracked via account_daily_summaries table.
Only transfers, manual adjustments, and reconciliations should be logged here going forward.
Legacy transaction entries are kept for historical accuracy but can be filtered with:
WHERE change_type NOT IN (''transaction_expense'', ''transaction_income'', ''transaction_deleted'')';

-- ============================================================
-- 4. Comments
-- ============================================================
COMMENT ON TABLE public.account_balance_archives IS 'Monthly archive snapshots of account balance changes. Used for historical reporting and performance optimization.';
COMMENT ON TABLE public.account_daily_summaries IS 'Daily transaction summaries per account. Replaces individual transaction logging in balance_history for cleaner UI.';

COMMENT ON COLUMN public.account_balance_archives.year_month IS 'Format: YYYY-MM, e.g., 2026-01';
COMMENT ON COLUMN public.account_balance_archives.net_change IS 'Total change including transactions, transfers, and adjustments';

COMMENT ON COLUMN public.account_daily_summaries.category_breakdown IS 'JSON array: [{"name": "Food", "color": "#ff0000", "amount": -50.00, "count": 3}]';
