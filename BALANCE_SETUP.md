# Account Balance Feature Setup

## Overview

This feature allows you to track account balances (e.g., weekly wallet budget) and automatically deduct expenses from the balance for reconciliation purposes.

## Database Setup

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy and paste the contents of `migrations/add_account_balances.sql`
5. Click **Run** to execute the migration

### Option 2: Using psql Command Line

```bash
# Replace with your actual Supabase connection details
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f migrations/add_account_balances.sql
```

### Option 3: Using Supabase CLI

```bash
# Make sure you have Supabase CLI installed and linked to your project
supabase db push
```

## How to Use

### 1. Set Weekly Budget

1. Go to the Expense page
2. Select your account (e.g., "Wallet")
3. You'll see the Account Balance card at the top
4. Click the edit icon (pencil)
5. Enter your weekly budget amount (e.g., $300)
6. Click save (checkmark icon)

### 2. Track Spending

- Every time you add a transaction, the amount is automatically deducted from your account balance
- The balance display updates immediately
- You can see exactly how much you have left

### 3. Weekly Reconciliation

- At the end of the week, compare your actual wallet balance with the displayed balance
- This helps you catch any missing entries
- Click the edit icon to reset the balance for the next week

## Troubleshooting

### "Database table not found" Error

This means the migration hasn't been run yet. Follow the Database Setup steps above.

### Balance Not Showing

1. Make sure you've selected an account in the expense form
2. Check that the database migration was run successfully
3. Open browser console (F12) to check for any API errors

### Balance Not Updating After Transaction

1. The balance should update automatically
2. If not, try refreshing the page
3. Check browser console for errors

## Features

- ✅ Manual balance entry/editing
- ✅ Automatic deduction on transaction creation
- ✅ Visual display of current balance
- ✅ Last updated timestamp
- ✅ Reconciliation helper text
- ✅ Support for both expense and income accounts

## API Endpoints

- `GET /api/accounts/[id]/balance` - Fetch current balance
- `POST /api/accounts/[id]/balance` - Set/update balance manually
- `PATCH /api/accounts/[id]/balance` - Adjust balance by amount (internal use)

## Notes

- Balance tracking is per-account
- For expense accounts: transactions subtract from balance
- For income accounts: transactions add to balance
- Balance persists in the database until manually changed
