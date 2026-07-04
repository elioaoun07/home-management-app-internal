---
created: 2026-03-23
type: overview
module: recurring
module-type: standalone
tags:
  - type/overview
  - module/recurring
---

# Recurring Payments

## Current Implementation Notes

- Updated 2026-07-03: the mobile Plan / Recurring tab is a commitment console, not just a static bill list. It shows compact metrics, current-period status labels, Wallet-after-unpaid when Wallet balance is available, and suggested matches to manually logged transactions.
- Monthly Cash / Manual commitments use the user's custom billing month as the grace window: inside the current billing period they are "due this period"; they become missed only when the period closes without coverage.
- Confirming a recurring payment still creates a transaction, but stale due dates now advance repeatedly until the next due date is after the paid date.
- `POST /api/recurring-payments/[id]/mark-covered` reconciles an existing non-draft, non-deleted transaction by updating `last_processed_date` and `next_due_date` without creating duplicate spend.
- Shared logic lives in `src/features/recurring/commitments.ts`.

> **Source:** `src/features/recurring/`, `src/app/recurring/`
> **API:** `src/app/api/recurring-payments/`
> **DB Tables:** `recurring_payments`
> **Type:** Standalone

## Docs in This Module

- [[Recurring Payments Setup]]
- [[Recurrence Exceptions Guide]]

## Key Concepts

- RRULE-based recurrence patterns
- Confirm payment → creates transaction
- Skip/override single occurrences
- Query cache: 30min staleTime

## See Also

- [[Common Patterns]]
- [[Notifications Overview|Notifications]] — payment reminders
