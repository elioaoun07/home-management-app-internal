# Household Sharing - Database Setup

## Overview

This migration sets up Row Level Security (RLS) policies to enable household sharing with proper access controls.

## Features Enabled

1. **Read-only access** to partner's accounts, categories, and transactions
2. **Edit/Delete restrictions** - users can only modify their own data
3. **Private transaction support** - hide sensitive transactions from partner
4. **Dashboard visibility** - view partner's data for context without polluting add expense forms

## Required Migrations

### 1. Add Private Transactions Column

Run first: `migrations/add_private_transactions.sql`

```sql
-- Adds is_private column to transactions table
ALTER TABLE public.transactions
ADD COLUMN is_private boolean NOT NULL DEFAULT false;

CREATE INDEX idx_transactions_is_private ON public.transactions(is_private);
```

### 2. Setup Household Sharing Policies

Run second: `migrations/household_sharing_policies.sql`

This migration will:

- Enable RLS on accounts, user_categories, and transactions tables
- Create policies for viewing partner's data (read-only)
- Create policies for editing/deleting (own data only)
- Filter out private transactions from partner's view
- Add performance indexes

## How to Run

### Option 1: Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `migrations/add_private_transactions.sql`
4. Click "Run"
5. Repeat for `migrations/household_sharing_policies.sql`

### Option 2: Supabase CLI

```bash
# From project root
supabase db push --file migrations/add_private_transactions.sql
supabase db push --file migrations/household_sharing_policies.sql
```

## Verification

After running migrations, verify:

1. **Check RLS is enabled:**

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('accounts', 'user_categories', 'transactions');
```

2. **Check policies exist:**

```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('accounts', 'user_categories', 'transactions');
```

3. **Check indexes:**

```sql
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('accounts', 'user_categories', 'transactions', 'household_links');
```

## Access Rules Summary

| Table               | Own Data  | Partner Data (Household Linked) |
| ------------------- | --------- | ------------------------------- |
| **accounts**        | Full CRUD | Read-only                       |
| **user_categories** | Full CRUD | Read-only                       |
| **transactions**    | Full CRUD | Read-only (excluding private)   |

## Frontend Implementation

The frontend enforces these rules by:

- Disabling swipe gestures on partner's transactions
- Hiding Save/Delete buttons in transaction detail modal for partner's data
- Making all form fields read-only for partner's transactions
- Showing "Read-only: This is your partner's transaction" message

## Rollback

If needed, to rollback the policies (keeps data intact):

```sql
-- Disable RLS (not recommended for production)
ALTER TABLE public.accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;

-- Or drop specific policies
DROP POLICY IF EXISTS "Users can view household partner accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can view household partner categories" ON public.user_categories;
DROP POLICY IF EXISTS "Users can view household partner transactions" ON public.transactions;
```

## Notes

- Policies only affect household-linked users (active=true in household_links)
- Private transactions are automatically hidden from partner's view
- Category/account names are fetched separately in the API to bypass RLS on JOINs
- All edit/delete operations require user_id to match auth.uid()
