---
created: 2026-03-23
type: moc
tags:
  - type/moc
  - scope/home
---

# ERA Dashboard

> Central hub for the ERA personal assistant project.
> Every module, session, and pattern is connected here.

---

## Quick Links

- [[Module Index]] — all modules in a queryable table
- [[Common Patterns]] — shared code patterns across the app
- [[Sync and Offline]] — offline-first architecture

---

## Standalone Modules

| Module             | Overview                                                | Source                                            |
| ------------------ | ------------------------------------------------------- | ------------------------------------------------- |
| Accounts & Balance | [[02 - Standalone Modules/Accounts & Balance/Overview]] | `src/features/accounts/`, `src/features/balance/` |
| Transactions       | [[02 - Standalone Modules/Transactions/Overview]]       | `src/features/transactions/`                      |
| Categories         | [[02 - Standalone Modules/Categories/Overview]]         | `src/features/categories/`                        |
| Recurring Payments | [[02 - Standalone Modules/Recurring Payments/Overview]] | `src/features/recurring/`                         |
| Recipes            | [[02 - Standalone Modules/Recipes/Overview]]            | `src/features/recipes/`                           |
| Catalogue          | [[02 - Standalone Modules/Catalogue/Overview]]          | `src/features/catalogue/`                         |
| Inventory          | [[02 - Standalone Modules/Inventory/Overview]]          | `src/features/inventory/`                         |
| Debts              | [[02 - Standalone Modules/Debts/Overview]]              | `src/features/debts/`                             |
| Future Purchases   | [[02 - Standalone Modules/Future Purchases/Overview]]   | `src/features/future-purchases/`                  |
| Budget Allocation  | [[02 - Standalone Modules/Budget Allocation/Overview]]  | `src/features/budget/`                            |
| Preferences        | [[02 - Standalone Modules/Preferences/Overview]]        | `src/features/preferences/`                       |
| Statement Import   | [[02 - Standalone Modules/Statement Import/Overview]]   | `src/features/statement-import/`                  |
| Transfers          | [[02 - Standalone Modules/Transfers/Overview]]          | `src/features/transfers/`                         |
| Items & Reminders  | [[02 - Standalone Modules/Items & Reminders/Overview]]  | `src/features/items/`                             |
| Analytics          | [[02 - Standalone Modules/Analytics/Overview]]          | `src/features/analytics/`                         |
| Drafts             | [[02 - Standalone Modules/Drafts/Overview]]             | `src/features/drafts/`                            |
| Watch UI           | [[02 - Standalone Modules/Watch UI/Overview]]           | `src/components/watch/`                           |
| Guest Portal       | [[02 - Standalone Modules/Guest Portal/Overview]]       | `src/app/g/[tag]/`                                |
| Error Logs         | [[02 - Standalone Modules/Error Logs/Overview]]         | `src/app/error-logs/`                             |

## Junction Modules

| Module            | Overview                                             | Connects                          |
| ----------------- | ---------------------------------------------------- | --------------------------------- |
| Hub Chat          | [[03 - Junction Modules/Hub Chat/Overview]]          | Budget, Reminders, Shopping List  |
| Shopping List     | [[03 - Junction Modules/Shopping List/Overview]]     | Hub Chat, Recipes, Inventory      |
| Message Actions   | [[03 - Junction Modules/Message Actions/Overview]]   | Hub Chat, Transactions            |
| Meal Planning     | [[03 - Junction Modules/Meal Planning/Overview]]     | Recipes, Reminders, Shopping List |
| AI Assistant      | [[03 - Junction Modules/AI Assistant/Overview]]      | Transactions, Items, Dashboard    |
| Notifications     | [[03 - Junction Modules/Notifications/Overview]]     | Items, Recurring, Budget          |
| Household Sharing | [[03 - Junction Modules/Household Sharing/Overview]] | ALL modules                       |
| Sync & Offline    | [[03 - Junction Modules/Sync & Offline/Overview]]    | ALL modules                       |

---

## Architecture & Cross-Cutting

- [[Common Patterns]]
- [[Sync and Offline]]
- [[Error Logging System]]
- [[Budget Reminder Merge]]
- [[Standalone PWA Apps]]

---

## Recent Sessions

```dataview
TABLE session-type AS "Type", module AS "Module", status AS "Status"
FROM "08 - Sessions"
SORT created DESC
LIMIT 10
```

## In Progress

```dataview
LIST
FROM ""
WHERE status = "in-progress"
SORT created DESC
```
