# Recurring Payments Feature - Implementation Guide

## ✅ Completed Steps

### 1. Database Migration

**File:** `migrations/add_recurring_payments.sql`

- Created `recurring_payments` table with all necessary fields
- Added RLS policies for user data security
- Created helper function `calculate_next_due_date()` for automatic scheduling
- **ACTION REQUIRED:** Run this SQL file in your Supabase SQL Editor

### 2. API Endpoints

**Files Created:**

- `src/app/api/recurring-payments/route.ts` - GET (list), POST (create)
- `src/app/api/recurring-payments/[id]/route.ts` - PATCH (update), DELETE (remove), POST (confirm payment)

**Key Endpoints:**

- `GET /api/recurring-payments` - List all recurring payments
- `GET /api/recurring-payments?due_only=true` - Get only due payments
- `POST /api/recurring-payments` - Create new recurring payment
- `PATCH /api/recurring-payments/[id]` - Update recurring payment
- `DELETE /api/recurring-payments/[id]` - Delete recurring payment
- `POST /api/recurring-payments/[id]` - Confirm payment (creates transaction, updates next_due_date)

### 3. Navigation Changes

**Files Modified:**

- `src/contexts/TabContext.tsx` - Changed `'drafts'` to `'recurring'`
- `src/components/layouts/MobileNav.tsx` - Updated tab label and icon
- `src/components/icons/FuturisticIcons.tsx` - Added `CalendarClockIcon`

**Changes:**

- Bottom nav now shows "Recurring" instead of "Drafts"
- Uses CalendarClock icon instead of FileText icon
- Draft notification badge now navigates to recurring tab

---

## 🚧 Next Steps to Complete

### 4. Create Recurring Payments Hook

**File to create:** `src/features/recurring/useRecurringPayments.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useRecurringPayments() {
  return useQuery({
    queryKey: ["recurring-payments"],
    queryFn: async () => {
      const res = await fetch("/api/recurring-payments");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      return data.recurring_payments || [];
    },
  });
}

export function useDuePayments() {
  return useQuery({
    queryKey: ["recurring-payments", "due"],
    queryFn: async () => {
      const res = await fetch("/api/recurring-payments?due_only=true");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      return data.recurring_payments || [];
    },
  });
}

export function useDuePaymentsCount() {
  const { data = [] } = useDuePayments();
  return data.length;
}

export function useConfirmPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      amount,
      description,
      date,
    }: {
      id: string;
      amount?: number;
      description?: string;
      date?: string;
    }) => {
      const res = await fetch(`/api/recurring-payments/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, description, date }),
      });
      if (!res.ok) throw new Error("Failed to confirm payment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-payments"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["account-balance"] });
    },
  });
}
```

### 5. Update Draft Badge to Show Due Payments

**File to modify:** `src/components/layouts/MobileNav.tsx`

Replace the line:

```typescript
const draftCount = useDraftCount();
```

With:

```typescript
import { useDuePaymentsCount } from "@/features/recurring/useRecurringPayments";
const duePaymentsCount = useDuePaymentsCount();
```

And update all `draftCount` references to `duePaymentsCount`.

### 6. Create Recurring Payments Page

**File to create:** `src/app/recurring/page.tsx`

This page should:

- List all recurring payments
- Show next due date for each
- Allow adding new recurring payments
- Allow editing/deleting recurring payments
- Show badge for payments due today

### 7. Create Confirm Payment Dialog

**File to create:** `src/components/recurring/ConfirmPaymentDialog.tsx`

This dialog should:

- Show payment details (name, amount, due date)
- Allow editing amount before confirming
- Allow editing description
- Confirm button creates transaction and updates next_due_date
- Show success message with next due date

### 8. Update TabContainer

**File to modify:** `src/components/layouts/TabContainer.tsx`

Replace the drafts section with:

```typescript
import RecurringPage from "@/app/recurring/page";

// In the JSX, replace:
<div className={activeTab === "drafts" ? "block pt-14" : "hidden"}>
  <DraftsPage />
</div>

// With:
<div className={activeTab === "recurring" ? "block pt-14" : "hidden"}>
  <RecurringPage />
</div>
```

---

## 📊 Database Schema

### recurring_payments Table

```sql
id                   UUID PRIMARY KEY
user_id              UUID (FK to auth.users)
account_id           UUID (FK to accounts)
category_id          UUID (FK to user_categories)
subcategory_id       UUID (FK to user_categories)
name                 TEXT (e.g., "Internet Bill")
amount               DECIMAL(10,2)
description          TEXT
recurrence_type      TEXT ('daily', 'weekly', 'monthly', 'yearly')
recurrence_day       INTEGER (day of month or week)
next_due_date        DATE
last_processed_date  DATE
is_active            BOOLEAN
created_at           TIMESTAMPTZ
updated_at           TIMESTAMPTZ
```

---

## 🎯 Usage Examples

### Creating a Recurring Payment

```typescript
POST /api/recurring-payments
{
  "account_id": "uuid",
  "category_id": "uuid",
  "name": "Internet Bill",
  "amount": 79.99,
  "recurrence_type": "monthly",
  "recurrence_day": 15,
  "next_due_date": "2025-12-15"
}
```

### Confirming a Due Payment

```typescript
POST /api/recurring-payments/{id}
{
  "amount": 82.50,  // Optional: edit amount
  "description": "Paid via credit card"  // Optional
}
```

This will:

1. Create a transaction with the specified amount
2. Update `next_due_date` to next month (e.g., 2026-01-15)
3. Set `last_processed_date` to today

---

## 🔔 Notification Flow

1. User creates recurring payment for "Rent - $1500 - Monthly - 1st of month"
2. On December 1st, `useDuePayments()` returns this payment
3. Badge appears above nav bar showing "1" due payment
4. User clicks badge → navigates to recurring tab
5. User sees payment marked as "Due Today"
6. User clicks "Confirm" → can edit amount if needed
7. System creates transaction and schedules next payment for January 1st

---

## 🛠️ To-Do Checklist

- [x] Create database migration
- [x] Create API endpoints
- [x] Update navigation tabs
- [x] Add CalendarClockIcon
- [ ] Create useRecurringPayments hook
- [ ] Create RecurringPage component
- [ ] Create ConfirmPaymentDialog component
- [ ] Update MobileNav to use due payments count
- [ ] Update TabContainer to show RecurringPage
- [ ] Run database migration in Supabase
- [ ] Test creating recurring payment
- [ ] Test confirming due payment
- [ ] Test notification badge

---

## 💡 Feature Ideas for Later

- **Snooze Payment:** Postpone by 1 day without creating transaction
- **Auto-Pay:** Automatically create transaction on due date
- **Payment History:** See past instances of recurring payment
- **Edit Next Due Date:** Manually adjust when payment is due
- **Notifications:** Email/push when payment is due
- **Multiple Recurrence Patterns:** Every 2 weeks, quarterly, etc.
- **Templates:** Convert recurring payment to transaction template
