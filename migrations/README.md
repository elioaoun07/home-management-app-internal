# Database Migrations

This folder contains SQL migration scripts for the budget app.

## How to Run Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy and paste the contents of the migration file you want to run
5. Click **Run** or press `Ctrl/Cmd + Enter`

### Option 2: Supabase CLI

```bash
# Install Supabase CLI if you haven't already
npm install -g supabase

# Run a specific migration
supabase db push --file migrations/add_default_account.sql
```

## Available Migrations

### `add_account_balances.sql`

- Creates the `account_balances` table for tracking wallet balances
- Adds RLS policies for secure access
- **Status**: Should already be applied if you're tracking balances

### `add_default_account.sql` ⭐ NEW

- Adds `is_default` column to the `accounts` table
- Creates a unique constraint to ensure only one default account per user
- Adds a trigger to automatically unset other defaults when setting a new one
- Sets the first account as default for existing users
- **Run this migration to enable the default account feature**

## Verification

After running a migration, you can verify it worked by:

1. Checking the table structure:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'accounts';
```

2. Checking your default account:

```sql
SELECT id, name, is_default
FROM accounts
WHERE user_id = auth.uid();
```

## Troubleshooting

If you encounter errors:

- Ensure you're logged into Supabase
- Check that the table exists before running migrations
- Review the error message - it usually indicates what's wrong
- You can safely re-run migrations that use `IF NOT EXISTS` or `IF EXISTS` clauses
