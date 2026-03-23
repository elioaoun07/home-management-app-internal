# Future Purchases Feature

A smart savings planning feature that helps users plan and track progress towards future purchases like monitors, laptops, vacations, etc.

## Overview

The Future Purchases feature allows users to:

- **Define purchase goals** with target amount, urgency, and desired date
- **Track savings progress** with visual progress indicators
- **Get smart recommendations** based on spending patterns and available surplus
- **Allocate monthly savings** towards goals
- **View spending analysis** to understand how achievable goals are

## Database Schema

The feature adds a new `future_purchases` table:

```sql
CREATE TABLE public.future_purchases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  target_amount numeric NOT NULL CHECK (target_amount > 0),
  current_saved numeric NOT NULL DEFAULT 0,
  urgency integer NOT NULL DEFAULT 3 CHECK (urgency >= 1 AND urgency <= 5),
  target_date date NOT NULL,
  recommended_monthly_savings numeric DEFAULT 0,
  icon text DEFAULT 'package',
  color text DEFAULT '#38bdf8',
  status text NOT NULL DEFAULT 'active',
  allocations jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone
);
```

### Run Migration

```bash
# Apply the migration in Supabase
psql -f migrations/add_future_purchases.sql
```

Or run it in the Supabase SQL editor.

## API Endpoints

### GET /api/future-purchases

List all future purchases for the authenticated user.

Query params:

- `status` (optional): Filter by status ('active', 'completed', 'cancelled', 'paused')

### POST /api/future-purchases

Create a new purchase goal.

Body:

```json
{
  "name": "New Monitor",
  "description": "4K 27-inch monitor for work",
  "target_amount": 500,
  "urgency": 4,
  "target_date": "2025-06-01",
  "icon": "monitor",
  "color": "#38bdf8"
}
```

### GET /api/future-purchases/[id]

Get a specific purchase goal.

### PATCH /api/future-purchases/[id]

Update a purchase goal.

### DELETE /api/future-purchases/[id]

Delete a purchase goal.

### POST /api/future-purchases/[id]/allocate

Allocate savings to a purchase goal.

Body:

```json
{
  "amount": 100,
  "month": "2025-01" // optional, defaults to current month
}
```

### GET /api/future-purchases/[id]/analysis

Get detailed savings analysis for a purchase goal including:

- Recommended monthly savings
- Progress percentage
- Risk assessment
- Confidence level
- Spending pattern analysis
- Suggestions for achieving the goal

### GET /api/future-purchases/spending-analysis

Get overall spending pattern analysis for the user (last 6 months).

## UI Components

### WebFuturePurchases

The main component for the Goals tab in the web view. Features:

- Overview statistics (total goals, target amount, saved so far, monthly target)
- Overall progress bar with animated shimmer effect
- Grid of purchase goal cards
- Add new goal modal with icon and color picker
- Allocate savings modal

### PurchaseCard

Individual purchase goal card with:

- Icon and color theming
- Urgency indicator
- Progress bar with gradient fill
- Stats (saved amount, remaining, time left)
- Recommended monthly savings
- Save button for quick allocation

## Smart Savings Algorithm

The system analyzes the user's spending patterns to provide intelligent recommendations:

1. **Historical Analysis**: Reviews the last 6 months of transactions
2. **Income vs Expense**: Calculates average monthly surplus
3. **Variance Detection**: Identifies how stable the user's surplus is
4. **Trend Analysis**: Determines if surplus is increasing, stable, or decreasing
5. **Confidence Scoring**: Provides a confidence level for achieving the goal
6. **Risk Assessment**: Categorizes goals as low, medium, or high risk
7. **Smart Suggestions**: Generates personalized suggestions based on analysis

### Calculation Formula

```typescript
recommendedMonthlySavings = amountRemaining / monthsRemaining;

confidenceLevel =
  100 -
  (surplusRatio > 1 ? (surplusRatio - 1) * 50 : 0) -
  (highVariance ? 20 : 0) -
  (decreasingTrend ? 15 : 0);

riskLevel =
  surplusRatio > 0.8 || confidence < 50
    ? "high"
    : surplusRatio > 0.5 || confidence < 70
      ? "medium"
      : "low";
```

## Urgency Levels

1. **Low** (Green): Nice to have, no rush
2. **Medium-Low** (Cyan): Would like eventually
3. **Medium** (Amber): Want it within timeline
4. **High** (Orange): Need it soon
5. **Critical** (Red): Must have ASAP

## Usage

1. Navigate to the **Goals** tab in the web view
2. Click **New Goal** to create a purchase goal
3. Fill in the details: name, target amount, desired date, urgency
4. Choose an icon and color for visual identification
5. View the recommended monthly savings based on your spending patterns
6. Click **Save** on any goal card to allocate monthly savings
7. Track progress as the progress bar fills up
8. Receive celebration toast when goal is reached!

## Tech Stack

- **Frontend**: React with Next.js 15, Tailwind CSS
- **State Management**: TanStack Query (React Query)
- **Database**: Supabase (PostgreSQL)
- **Animations**: CSS animations with shimmer and gradient effects
- **Icons**: Lucide React
