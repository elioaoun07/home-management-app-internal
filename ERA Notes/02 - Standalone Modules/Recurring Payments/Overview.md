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

> **Source:** `src/features/recurring/`, `src/app/recurring/`
> **API:** `src/app/api/recurring/`
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
