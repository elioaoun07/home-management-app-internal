# Apply Message Actions Migration

## Quick Setup (2 minutes)

### Step 1: Open Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor" in the left sidebar

### Step 2: Run Migration

1. Click "New Query"
2. Copy the ENTIRE contents of `migrations/add_hub_message_actions.sql`
3. Paste into the SQL editor
4. Click "Run" button

### Step 3: Verify Installation

Run this query to confirm table exists:

```sql
SELECT COUNT(*) FROM hub_message_actions;
```

Expected result: `0` (empty table)

### Step 4: Test the Feature

1. Refresh your app
2. Open Hub → Select a thread
3. Long-press a message with an amount ("Spent $20 on fuel")
4. Click "Add as Transaction"
5. Save the transaction
6. **Check console logs** - you should see:
   ```
   [useCreateMessageAction] Action created successfully: {id: "...", message_id: "...", ...}
   ```
7. **Check the message** - green checkmark should appear
8. **Try long-press again** - button should show "Already Added" (disabled)

### Step 5: Verify Database Entry

Run this query in Supabase SQL Editor:

```sql
SELECT * FROM hub_message_actions;
```

You should see your action entry with:

- `message_id`
- `user_id`
- `action_type` = 'transaction'
- `transaction_id` (linked to your transaction)

## Troubleshooting

### Error: "relation does not exist"

- The migration hasn't been applied yet
- Re-run the migration SQL
- Check for any error messages in Supabase SQL editor

### Action not saving but no errors

1. Check browser console for detailed error logs
2. Verify RLS policies are enabled in Supabase
3. Ensure you're logged in (check `auth.users`)

### UI doesn't show checkmark after refresh

- Local state is cleared on refresh (expected)
- Database query should restore it
- Check browser console for query errors

### "Already Added" shows but database is empty

- Local state is working correctly
- Database write might have failed silently
- Check console logs for error messages
- Verify migration was applied successfully

## Migration File Location

`migrations/add_hub_message_actions.sql`

## What This Migration Creates

1. **Table**: `hub_message_actions`
   - Tracks which messages have been converted to transactions
   - Prevents duplicate conversions
   - Supports multiple action types (future-proof)

2. **RLS Policies**:
   - Household-level security
   - Users can only see/create actions in their household

3. **Indexes**:
   - Fast lookups by message_id
   - Efficient queries for user actions

4. **Constraints**:
   - UNIQUE(message_id, user_id, action_type)
   - Prevents duplicate entries at database level
