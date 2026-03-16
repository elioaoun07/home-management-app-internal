# LBP Change Feature - Lebanon Dual-Currency Tracking

## Overview

This feature allows tracking the **actual value** of items when paying in USD and receiving Lebanese Pound (LBP) change. This is common in Lebanon where merchants accept USD but give change in LBP at the current exchange rate.

## How It Works

### Example Scenario:

- You pay **$10 USD** for an item
- The item costs **300,000 LBP** (at rate of 90,000 LBP = $1)
- You receive **600,000 LBP** change (equivalent to ~$6.67)
- **Actual item value**: ~$3.33

### Balance Behavior:

- Your account balance **decreases by the full $10** (what you actually paid)
- The dashboard shows both the **paid amount** AND the **actual value**
- Analytics can use actual values for better spending insights

## Usage

### 1. Set Up the LBP Exchange Rate

Before using the feature, you need to set your current LBP exchange rate:

1. When adding an expense, look for "🇱🇧 Track LBP change? Set exchange rate"
2. Tap to open the rate drawer
3. Enter the rate in thousands (e.g., **90** = 90,000 LBP per $1 USD)
4. Save the rate

You can update the rate anytime by tapping the "Rate: XXK" button when adding expenses.

### 2. Recording Transactions with LBP Change

When adding an expense:

1. Enter the **USD amount you paid** (e.g., 10 for $10)
2. In the "LBP Change Received" field, enter the amount in thousands
   - If you received 600,000 LBP, enter **600**
   - The system automatically multiplies by 1,000
3. You'll see a preview: "Change: 600,000 LBP" and "Actual: $X.XX"

### 3. Viewing Transactions

In the dashboard, transactions with LBP change display:

- The **paid amount** (what reduced from your balance)
- An arrow pointing to the **actual value** with "actual" label

Example display:

```
$10.00
→ $3.33 actual
```

## Database Schema

### Transactions Table

```sql
ALTER TABLE transactions
ADD COLUMN lbp_change_received numeric DEFAULT NULL;
```

- Stores LBP change in thousands (e.g., 600 = 600,000 LBP)

### User Preferences Table

```sql
ALTER TABLE user_preferences
ADD COLUMN lbp_exchange_rate numeric DEFAULT NULL;
```

- Stores rate in thousands (e.g., 90 = 90,000 LBP per USD)

## Calculation Formula

```typescript
actual_value_usd = amount_paid - lbp_change_received / lbp_exchange_rate;
```

Where:

- `amount_paid` = USD amount entered
- `lbp_change_received` = LBP change in thousands (e.g., 600)
- `lbp_exchange_rate` = LBP per USD in thousands (e.g., 90)

Example:

- Paid: $10
- LBP Change: 600 (= 600,000 LBP)
- Rate: 90 (= 90,000 LBP per USD)
- Actual: $10 - (600/90) = $10 - $6.67 = **$3.33**

## Files Modified

### Service Layer

- `src/services/transaction.service.ts`
  - Added `lbp_change_received` to DTOs
  - Updated create/update methods
  - Included in transaction mapping

### User Preferences

- `src/features/preferences/useLbpSettings.ts` (NEW)
  - Hook for getting/setting LBP exchange rate
  - `calculateActualValue()` helper function
- `src/lib/queryConfig.ts`
  - Added `lbp_exchange_rate` to cached preferences type
- `src/app/api/user-preferences/route.ts`
  - Added `lbp_exchange_rate` to GET and PATCH handlers

### UI Components

- `src/components/expense/MobileExpenseForm.tsx`
  - LBP change input field (optional)
  - Rate setting drawer
  - Live preview of actual value
- `src/components/dashboard/SwipeableTransactionItem.tsx`
  - Display actual value for transactions with LBP change

### Database

- `migrations/add_lbp_change_feature.sql`
  - Migration for both columns

## Migration

Run the migration:

```bash
psql -d your_database -f migrations/add_lbp_change_feature.sql
```

Or via Supabase:

```sql
-- Add lbp_change_received column to transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS lbp_change_received numeric DEFAULT NULL;
COMMENT ON COLUMN transactions.lbp_change_received IS 'LBP change received in thousands (e.g., 600 = 600,000 LBP). Used for Lebanon dual-currency tracking.';

-- Add lbp_exchange_rate to user_preferences
ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS lbp_exchange_rate numeric DEFAULT NULL;
COMMENT ON COLUMN user_preferences.lbp_exchange_rate IS 'LBP per USD rate in thousands (e.g., 90 = 90,000 LBP per 1 USD). Used for Lebanon dual-currency tracking.';
```

## Future Enhancements

1. **Analytics using actual values**: Spending breakdown by actual item value
2. **Exchange rate history**: Track rate changes over time
3. **Auto-fetch rates**: Pull current rate from an API
4. **Export reports**: Include both paid and actual values
5. **Category insights**: Compare spending by category using actual values
