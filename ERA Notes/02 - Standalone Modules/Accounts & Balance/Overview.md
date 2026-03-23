---
created: 2026-03-23
type: overview
module: accounts
module-type: standalone
tags:
  - type/overview
  - module/accounts
---

# Accounts & Balance

> **Source:** `src/features/accounts/`, `src/features/balance/`
> **API:** `src/app/api/accounts/`
> **DB Tables:** `accounts`, `account_balances`, `account_balance_history`
> **Type:** Standalone

## Docs in This Module

- [[Balance System]]
- [[Income Expense System]]
- [[Account Transfers]]
- [[Default Account]]

## Key Concepts

- Baseline + delta balance model
- Account types: `expense`, `income`, `saving` — affect balance direction
- Custom month start day for billing cycles

## See Also

- [[Common Patterns]] — optimistic mutations
- [[Transfers Overview|Transfers]]
