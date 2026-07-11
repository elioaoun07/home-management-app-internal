---
created: 2026-03-23
type: overview
module: transactions
module-type: standalone
tags:
  - type/overview
  - module/transactions
---

# Transactions

> **Source:** `src/features/transactions/`, `src/app/expense/`
> **API:** `src/app/api/transactions/`
> **DB Tables:** `transactions`
> **Type:** Standalone

## Docs in This Module

- [[Voice Draft Transactions]]
- [[LBP Change Feature]]

## Key Concepts

- Voice entry with NLP parsing and draft review flow
- Dual-currency tracking (USD/LBP)
- Query cache: 2min staleTime
- Category & Subcategory steps (mobile form) glow-highlight the card suggested by Statement Import's learned merchant map as the user types a merchant; guidance-only, nothing auto-selects — see [Feature Map/standalone/transactions.md](<../../01 - Architecture/Feature Map/standalone/transactions.md>). Planned extensions: voice drafts + Hub chat "Add as Transaction" (Budget checklist X2a/X2b).

## See Also

- [[Statement Import Guide]] — CSV/PDF import
- [[Common Patterns]]
