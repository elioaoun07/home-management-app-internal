# Balance History Architecture v2

## Overview

This document describes the improved balance history system that separates transaction summaries from critical balance events (transfers, reconciliations).

## Problem Statement

The original balance history logged **every single transaction** as an individual entry, which:

1. Created redundancy with the dashboard (which already shows transactions)
2. Made the history noisy and hard to navigate
3. Generated a large volume of records over time

## Solution: Three-Tier History View

### 1. Activity Tab (Transfers & Adjustments)

**What it shows:**

- Transfers between accounts
- Manual balance sets/adjustments
- Reconciliation entries
- Initial balance entries
- Deleted transaction reversals

**What it excludes:**

- Individual transaction_expense entries
- Individual transaction_income entries

These are critical audit events that can't be seen elsewhere.

### 2. Daily Tab (Transaction Summaries)

**What it shows:**

- Daily net summary (total income - total expenses)
- Transaction count per day
- Category breakdown with colors
- Largest income/expense of the day

**Expandable details:**

- Income vs expense breakdown
- Category-by-category amounts
- Highlight transactions

This replaces individual transaction entries with a cleaner summary.

### 3. Archives Tab (Monthly Snapshots)

**What it shows:**

- Monthly opening/closing balances
- Total income/expenses for month
- Transfer totals (in/out)
- Adjustment totals
- Net change for month

**Use cases:**

- Historical balance tracking
- Month-over-month comparison
- Audit trail for past periods

## Database Schema

### New Tables

```sql
-- Monthly balance archives
CREATE TABLE account_balance_archives (
  id uuid PRIMARY KEY,
  account_id uuid REFERENCES accounts(id),
  user_id uuid REFERENCES auth.users(id),
  year_month text,  -- "2026-01"
  month_start_date date,
  month_end_date date,
  opening_balance numeric,
  closing_balance numeric,
  total_transaction_count integer,
  total_income numeric,
  total_expenses numeric,
  net_change numeric,
  total_transfers_in numeric,
  total_transfers_out numeric,
  transfer_count integer,
  total_adjustments numeric,
  adjustment_count integer,
  archived_at timestamp
);

-- Daily transaction summaries (optional - can be computed on-the-fly)
CREATE TABLE account_daily_summaries (
  id uuid PRIMARY KEY,
  account_id uuid REFERENCES accounts(id),
  user_id uuid REFERENCES auth.users(id),
  summary_date date,
  opening_balance numeric,
  closing_balance numeric,
  transaction_count integer,
  income_count integer,
  expense_count integer,
  total_income numeric,
  total_expenses numeric,
  net_transactions numeric,
  largest_income numeric,
  largest_income_desc text,
  largest_expense numeric,
  largest_expense_desc text,
  category_breakdown jsonb
);
```

### Modified Behavior

The `account_balance_history` table still exists but:

1. **No longer receives** individual transaction entries (expense/income)
2. **Still receives** transfers, manual adjustments, reconciliations
3. **API filters** transaction entries by default when querying

## API Endpoints

### Balance History (Modified)

```
GET /api/accounts/{id}/balance/history
```

- Now excludes transaction entries by default
- Add `?exclude_transactions=false` to include them (for debugging)

### Daily Summaries (New)

```
GET /api/accounts/{id}/balance/daily
```

- Returns summarized daily transaction data
- Computed on-the-fly from transactions table
- Optional date range: `?start=2026-01-01&end=2026-01-31`

### Monthly Archives (New)

```
GET /api/accounts/{id}/balance/archives
GET /api/accounts/{id}/balance/archives?year=2026
POST /api/accounts/{id}/balance/archives
  Body: { "year_month": "2026-01" }
```

- GET: Retrieve archived monthly data
- POST: Generate/update archive for a specific month

## UI Components

### BalanceHistoryDrawer

Updated with three tabs:

1. **Activity** - Shows transfers and adjustments (clean audit trail)
2. **Daily** - Shows daily transaction summaries (expandable cards)
3. **Archives** - Shows monthly snapshots (expandable cards)

### DailySummaryCard

Expandable card showing:

- Date header with transaction count
- Net amount (color-coded)
- Income/expense breakdown
- Category breakdown when expanded
- Largest transaction highlights

### ArchiveCard

Expandable card showing:

- Month/year header
- Transaction and transfer counts
- Net change for month
- Detailed breakdown when expanded

## Migration Steps

1. Run `migrations/add_balance_archives.sql` to create new tables
2. The code changes automatically:
   - Stop logging transaction entries to balance_history
   - Filter out legacy transaction entries in API responses
   - Compute daily summaries on-the-fly from transactions

## Benefits

1. **Cleaner History** - Only important balance events (transfers, adjustments)
2. **Reduced Storage** - No more duplicate transaction data
3. **Better UX** - Daily summaries are more digestible than individual entries
4. **Historical Tracking** - Monthly archives for long-term audit trail
5. **Backward Compatible** - Legacy transaction entries filtered out automatically
