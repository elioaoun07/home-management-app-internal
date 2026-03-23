# Setup Instructions

## ✅ Fixed Issues

### 1. Hydration Error - FIXED

- Added `suppressHydrationWarning` to `SidebarProvider` component
- Added `suppressHydrationWarning` to the header div containing the SidebarTrigger
- This prevents React from complaining about browser extensions adding attributes like `fdprocessedid`

### 2. Account Balance Display - IMPLEMENTED

- Created `AccountBalance` component that shows at the top of the expense form
- Component appears after you select an account
- Shows current balance with edit functionality
- Includes helpful error messages if database isn't set up

## 🚀 Next Steps - Run Database Migration

The balance feature won't work until you create the database table. Follow these steps:

### Quick Setup (Supabase Dashboard):

1. Open your Supabase project: https://supabase.com/dashboard/project/YOUR_PROJECT
2. Click on **SQL Editor** in the left sidebar
3. Click **New Query**
4. Copy the entire contents from: `migrations/add_account_balances.sql`
5. Paste into the SQL editor
6. Click **Run** (or press Ctrl+Enter)
7. You should see "Success. No rows returned"

### Alternative: Using Command Line

If you have PostgreSQL client installed:

```bash
# Get your connection string from Supabase Dashboard > Project Settings > Database
# It looks like: postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres

psql "YOUR_CONNECTION_STRING" -f migrations/add_account_balances.sql
```

## 📖 How to Use the Balance Feature

Once the migration is run:

### Setting Your Weekly Budget:

1. Go to `/expense` page
2. Select an account (e.g., "Wallet") from the dropdown
3. You'll see the "Account Balance" card appear below the date
4. Click the pencil/edit icon
5. Enter your weekly amount (e.g., 300)
6. Press Enter or click the checkmark

### Tracking Expenses:

- Add expenses normally
- The balance automatically decreases with each transaction
- You can see exactly how much is left

### Weekly Reconciliation:

- At week's end, compare your actual wallet with the displayed balance
- If they don't match, you know you forgot to record something
- Click edit to reset the balance for next week

## 🧪 Testing the Setup

After running the migration:

1. Refresh your app in the browser
2. Go to the expense page
3. Select an account
4. You should see the balance card (showing $0.00)
5. Click the edit icon and set a balance
6. Add a transaction
7. The balance should automatically decrease

## ⚠️ Troubleshooting

### "Database table not found" warning appears:

- The migration hasn't been run yet
- Follow the setup steps above

### Balance card doesn't appear:

- Make sure you've selected an account
- Check browser console (F12) for errors
- Verify the migration ran successfully

### Balance doesn't update after adding transaction:

- Check browser console for API errors
- Verify RLS policies are set correctly in Supabase
- Try refreshing the page

## 📁 Files Changed

- ✅ `src/components/layouts/ExpenseShell.tsx` - Added hydration fix
- ✅ `src/components/expense/AccountBalance.tsx` - New balance component
- ✅ `src/components/expense/ExpenseForm.tsx` - Integrated balance display
- ✅ `src/app/api/accounts/[id]/balance/route.ts` - New API endpoints
- ✅ `src/app/api/transactions/route.ts` - Auto-deduct from balance
- ✅ `migrations/add_account_balances.sql` - Database schema

## 🎉 Ready to Go!

Once you run the migration, everything should work perfectly. The hydration errors are already fixed, and the balance tracking will be fully functional.
