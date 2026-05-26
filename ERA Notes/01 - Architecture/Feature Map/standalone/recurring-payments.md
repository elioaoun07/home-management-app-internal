# Recurring Payments

**Type:** Standalone
**Route:** `/recurring`
**Vault doc:** `ERA Notes/02 - Standalone Modules/Recurring Payments/`

## What it does

Tracks payments that repeat on a schedule (rent, subscriptions). The page lists them; a cron job auto-posts the corresponding `transactions` when each one is due. A "future payments" drawer in the expense form previews upcoming ones.

## Files at a glance

- **Page entry**: `src/app/recurring/page.tsx`, `src/app/recurring/loading.tsx`
- **Hooks**:
  - `src/features/recurring/useRecurringPayments.ts`
  - `src/features/recurring/useFuturePayments.ts`
- **UI within expense form**: `src/components/expense/FuturePaymentsDrawer.tsx`
- **API routes**:
  - `src/app/api/recurring-payments/route.ts`
  - `src/app/api/recurring-payments/[id]/route.ts`
  - `src/app/api/future-payments/route.ts`
  - Cron auto-post: `src/app/api/cron/<recurring-runner>/route.ts`
- **DB table**: `recurring_payments`
- **Cache config**: `RECURRING = 30 min` staleTime

## Common edit scenarios

- **"Edit the recurring payments list UI"** → `src/app/recurring/page.tsx`.
- **"Change cron behavior for auto-posting"** → the cron route under `src/app/api/cron/`. Verify `Bearer CRON_SECRET`, use `supabaseAdmin()`, set `maxDuration = 60` (Hard Rule #8/15).
- **"Add a new field (e.g. day-of-month)"** → DB column → API zod → `useRecurringPayments` mutation → page form.

## Gotchas

- The auto-post path inserts a row into `transactions`. It must respect the user's custom month start day (see `startOfCustomMonth` in `src/lib/utils/date.ts`).
- `recurring_payments` rows are user-scoped; household-linking applies (Hard Rule #13) if the partner should see them.

## Connected modules

- **Transactions** — auto-posted entries.
- **Notifications** — payment reminders.
- **Accounts & Balance** — the debited account.
