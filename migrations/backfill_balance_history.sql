-- ============================================================
-- BALANCE HISTORY BACKFILL SCRIPT
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 0: Add is_archived column if it doesn't exist
ALTER TABLE account_daily_summaries 
ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_ads_is_archived 
ON account_daily_summaries(account_id, is_archived, summary_date DESC);

-- Step 1: Check current state
SELECT 
  'Current State' as info,
  (SELECT COUNT(*) FROM account_daily_summaries) as daily_summaries_count,
  (SELECT COUNT(*) FROM account_balance_archives) as monthly_archives_count,
  (SELECT COUNT(*) FROM account_balance_history) as balance_history_count,
  (SELECT COUNT(*) FROM transactions WHERE is_draft = false) as transactions_count,
  (SELECT COUNT(*) FROM transfers) as transfers_count;

-- ============================================================
-- Step 2: Backfill account_daily_summaries from transactions
-- ============================================================

-- Clear existing summaries (optional - comment out if you want to preserve existing)
-- TRUNCATE account_daily_summaries;

-- Insert daily summaries for all days with transactions
INSERT INTO account_daily_summaries (
  account_id,
  user_id,
  summary_date,
  opening_balance,
  closing_balance,
  transaction_count,
  income_count,
  expense_count,
  total_income,
  total_expenses,
  net_transactions,
  largest_income,
  largest_income_desc,
  largest_expense,
  largest_expense_desc,
  category_breakdown
)
SELECT 
  t.account_id,
  t.user_id,
  t.date as summary_date,
  0 as opening_balance,  -- Will calculate after
  0 as closing_balance,  -- Will calculate after
  COUNT(*) as transaction_count,
  0 as income_count,  -- All transactions are expenses in this app
  COUNT(*) as expense_count,
  0 as total_income,
  SUM(t.amount) as total_expenses,
  -SUM(t.amount) as net_transactions,  -- Negative because expenses reduce balance
  NULL as largest_income,
  NULL as largest_income_desc,
  MAX(t.amount) as largest_expense,
  (
    SELECT t2.description 
    FROM transactions t2 
    WHERE t2.account_id = t.account_id 
      AND t2.date = t.date 
      AND t2.is_draft = false
    ORDER BY t2.amount DESC 
    LIMIT 1
  ) as largest_expense_desc,
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'name', COALESCE(cat.name, 'Uncategorized'),
        'color', COALESCE(cat.color, '#888888'),
        'amount', -cat_sum.total,
        'count', cat_sum.cnt
      )
    )
    FROM (
      SELECT 
        t3.category_id,
        SUM(t3.amount) as total,
        COUNT(*) as cnt
      FROM transactions t3
      WHERE t3.account_id = t.account_id 
        AND t3.date = t.date 
        AND t3.is_draft = false
      GROUP BY t3.category_id
    ) cat_sum
    LEFT JOIN user_categories cat ON cat.id = cat_sum.category_id
  ) as category_breakdown
FROM transactions t
WHERE t.is_draft = false
GROUP BY t.account_id, t.user_id, t.date
ON CONFLICT (account_id, summary_date) 
DO UPDATE SET
  transaction_count = EXCLUDED.transaction_count,
  expense_count = EXCLUDED.expense_count,
  total_expenses = EXCLUDED.total_expenses,
  net_transactions = EXCLUDED.net_transactions,
  largest_expense = EXCLUDED.largest_expense,
  largest_expense_desc = EXCLUDED.largest_expense_desc,
  category_breakdown = EXCLUDED.category_breakdown,
  updated_at = now();

-- ============================================================
-- Step 3: Calculate running balances for daily summaries
-- ============================================================
-- This updates opening_balance and closing_balance for each day
-- by working backwards from current balance

WITH ranked_summaries AS (
  SELECT 
    ads.id,
    ads.account_id,
    ads.summary_date,
    ads.total_expenses,
    ab.balance as current_balance,
    COALESCE(tr_in.amt, 0) as transfers_in,
    COALESCE(tr_out.amt, 0) as transfers_out,
    ROW_NUMBER() OVER (PARTITION BY ads.account_id ORDER BY ads.summary_date DESC) as rn
  FROM account_daily_summaries ads
  JOIN account_balances ab ON ab.account_id = ads.account_id
  LEFT JOIN LATERAL (
    SELECT SUM(amount) as amt FROM transfers 
    WHERE to_account_id = ads.account_id AND date = ads.summary_date
  ) tr_in ON true
  LEFT JOIN LATERAL (
    SELECT SUM(amount) as amt FROM transfers 
    WHERE from_account_id = ads.account_id AND date = ads.summary_date
  ) tr_out ON true
),
with_cumulative AS (
  SELECT 
    id,
    account_id,
    summary_date,
    total_expenses,
    current_balance,
    transfers_in,
    transfers_out,
    -- Net change for this day: +transfers_in - transfers_out - expenses
    (transfers_in - transfers_out - total_expenses) as day_net_change,
    -- Sum of all changes AFTER this day (for days with smaller rn = more recent)
    SUM(transfers_in - transfers_out - total_expenses) OVER (
      PARTITION BY account_id 
      ORDER BY summary_date DESC 
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ) as future_changes
  FROM ranked_summaries
)
UPDATE account_daily_summaries ads
SET 
  closing_balance = wc.current_balance - COALESCE(wc.future_changes, 0),
  opening_balance = wc.current_balance - COALESCE(wc.future_changes, 0) - wc.day_net_change
FROM with_cumulative wc
WHERE wc.id = ads.id;

-- ============================================================
-- Step 4: Backfill account_balance_history for transfers
-- ============================================================

-- Insert transfer_in entries
INSERT INTO account_balance_history (
  account_id, 
  user_id, 
  previous_balance, 
  new_balance, 
  change_amount, 
  change_type, 
  transfer_id, 
  effective_date
)
SELECT 
  tr.to_account_id,
  tr.user_id,
  0 as previous_balance,
  0 as new_balance,
  tr.amount,
  'transfer_in',
  tr.id,
  tr.date
FROM transfers tr
WHERE NOT EXISTS (
  SELECT 1 FROM account_balance_history h 
  WHERE h.transfer_id = tr.id 
    AND h.account_id = tr.to_account_id
    AND h.change_type = 'transfer_in'
)
ON CONFLICT DO NOTHING;

-- Insert transfer_out entries
INSERT INTO account_balance_history (
  account_id, 
  user_id, 
  previous_balance, 
  new_balance, 
  change_amount, 
  change_type, 
  transfer_id, 
  effective_date
)
SELECT 
  tr.from_account_id,
  tr.user_id,
  0 as previous_balance,
  0 as new_balance,
  -tr.amount,
  'transfer_out',
  tr.id,
  tr.date
FROM transfers tr
WHERE NOT EXISTS (
  SELECT 1 FROM account_balance_history h 
  WHERE h.transfer_id = tr.id 
    AND h.account_id = tr.from_account_id
    AND h.change_type = 'transfer_out'
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Step 5: Mark all days before current month as archived
-- ============================================================
UPDATE account_daily_summaries
SET is_archived = true
WHERE summary_date < DATE_TRUNC('month', CURRENT_DATE)
  AND is_archived = false;

-- ============================================================
-- Step 6: Fix wallet balance (your specific case)
-- ============================================================
-- Based on your earlier calculation: should be $66
UPDATE account_balances 
SET balance = 66, updated_at = now()
WHERE account_id = '95e86bc8-a531-4f58-bf2a-e0f442a58230';

-- ============================================================
-- Step 7: Verify results
-- ============================================================
SELECT 
  'After Backfill' as info,
  (SELECT COUNT(*) FROM account_daily_summaries WHERE is_archived = false) as current_month_days,
  (SELECT COUNT(*) FROM account_daily_summaries WHERE is_archived = true) as archived_days,
  (SELECT COUNT(*) FROM account_balance_history) as balance_history_count;

-- Show current month summaries only
SELECT 
  ads.summary_date,
  a.name as account_name,
  ads.opening_balance,
  ads.closing_balance,
  ads.transaction_count,
  ads.total_expenses,
  ads.is_archived
FROM account_daily_summaries ads
JOIN accounts a ON a.id = ads.account_id
WHERE ads.is_archived = false
ORDER BY ads.summary_date DESC
LIMIT 10;

-- Show archived months summary
SELECT 
  SUBSTRING(ads.summary_date::text, 1, 7) as year_month,
  a.name as account_name,
  COUNT(*) as days_in_month,
  SUM(ads.transaction_count) as total_transactions,
  SUM(ads.total_expenses) as total_expenses
FROM account_daily_summaries ads
JOIN accounts a ON a.id = ads.account_id
WHERE ads.is_archived = true
GROUP BY SUBSTRING(ads.summary_date::text, 1, 7), a.name
ORDER BY year_month DESC;
