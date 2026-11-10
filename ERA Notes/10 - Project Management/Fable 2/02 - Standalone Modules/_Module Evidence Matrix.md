---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit 8da80ae, 2026-11-10. Counts by `find`, `wc` and `grep` over `src/`. 'No Zod' means a mutating route file that imports no Zod schema and calls no parse; it does not prove the input is unchecked."
---

# Modules — evidence matrix

[Fable 2 index](<../_index.md>) · [Verification pyramid](<../01 - Architecture/Verification Pyramid.md>) · junction view: [Junction evidence matrix](<../03 - Junction Modules/_Junction Evidence Matrix.md>)

One row per module that the Feature Index lists as Standalone. This pass measured every module and read deeply only where a row is marked **read**. A blank Notes cell means "measured, not audited", not "clean".

## Feature code and tests

| Module | Feature dir | Lines | Test files | Notes |
|---|---|---|---|---|
| Accounts & Balance | `accounts`, `balance` | 591 + 736 | 0 | Stored balance with compare-and-swap adjust (`src/lib/balance.ts`); 22 calls in 12 files. **read** |
| Transactions | `transactions` | 1,480 | 1 | Shared-cache header on the read route: [finding](<Transactions/Shared-Cache Header on the Transactions Read.md>). **read** |
| Transfers | `transfers` | 858 | 1 | Exactly-once shipped as BUD-87 (2026-11-03) |
| Recurring Payments | `recurring` | 938 | 1 | Confirm is not exactly-once (sweep M2, BUD-90) |
| Debts | `debts` | 402 | 0 | Settlement not exactly-once, amount unvalidated (BUD-90, BUD-94) |
| Drafts | `drafts` | 352 | 0 | Existing BUD-64 |
| Budget Allocation | `budget` | 411 | 0 | |
| Categories | `categories` | 527 | 0 | |
| Future Purchases | `future-purchases` | 388 | 0 | |
| Statement Import | `statement-import` | 1,458 | 1 | Plus four `src/lib/statement-*` tests |
| Analytics | `analytics` | 344 | 0 | |
| Preferences | `preferences` | 627 | 0 | |
| Items / Reminders | `items` | 5,737 | 3 | Largest standalone feature; `useItems.ts` is 2,207 lines |
| Chores | `chores` | 1,587 | 4 | Best-tested small module |
| Recipes | `recipes` | 799 | 0 | Search breaks on punctuation (KIT-28) |
| Inventory | `inventory` | 289 | 0 | |
| Catalogue | `catalogue` | 1,019 | 0 | |
| Meal Planning | `meal-planning` | 164 | 0 | One coverage test under `tests/` |
| Healthcare | `healthcare` | 897 | 0 | 15 routes, all with Zod; three `src/lib/health` tests |
| Fitness | `fitness` | 580 | 0 | Four `src/lib/fitness` tests |
| Outfits | `outfits` | 642 | 0 | |
| NFC Tags | `nfc` | 300 | 0 | |
| Recycle Bin | `recycle-bin` | 194 | 0 | Restore path is central to BUD-89 and BUD-92 |
| Guest Portal | (no feature dir) | 2,602 in one client file | 0 | [Finding](<Guest Portal/Guest Data Exposure Still Unqueued.md>). **read** |
| Error Logs, Focus, Dashboard, Watch UI | (components and pages) | not measured | 0 | Not examined |

## API areas

| Area | Routes | Mutating | No Zod | Service-role | Route tests |
|---|---|---|---|---|---|
| accounts | 10 | 7 | 4 | 4 | 0 |
| transactions | 5 | 5 | 4 | 2 | 1 |
| transfers | 3 | 3 | 0 | 0 | 1 |
| recurring-payments | 4 | 3 | 2 | 0 | 2 |
| debts | 3 | 3 | 3 | 0 | 0 |
| drafts | 2 | 2 | 2 | 0 | 0 |
| future-payments | 3 | 2 | 1 | 0 | 0 |
| future-purchases | 5 | 3 | 3 | 0 | 0 |
| budget-allocations | 2 | 2 | 0 | 0 | 0 |
| statement-import | 6 | 4 | 1 | 0 | 2 |
| categories, user-categories | 6 | 5 | 4 | 1 | 0 |
| merchant-mappings, transaction-templates | 2 | 2 | 2 | 1 | 0 |
| items, subtasks, reminder-templates | 12 | 12 | 7 | 4 | 3 |
| recipes | 9 | 9 | 4 | 0 | 0 |
| inventory | 7 | 4 | 4 | 0 | 0 |
| catalogue | 13 | 12 | 7 | 2 | 0 |
| meal-plans | 3 | 3 | 3 | 0 | 0 |
| healthcare | 15 | 13 | 0 | 0 | 0 |
| fitness | 9 | 6 | 0 | 0 | 0 |
| outfits | 7 | 7 | 1 | 3 | 0 |
| nfc | 7 | 5 | 0 | 0 | 0 |
| recycle-bin | 4 | 3 | 0 | 3 | 1 |
| guest-portal | 7 | 7 | 7 | 7 | 0 |
| auth, onboarding, user-preferences | 9 | 7 | 5 | 0 | 0 |

## What the matrix says

1. **Newer modules are stricter than older ones.** Healthcare, Fitness, NFC, ERA and Transfers validate every mutating route. The money core written earliest (accounts, transactions, debts, drafts) validates the least.
2. **Route tests are rare and clustered.** They exist only for transfers, recurring payments, statement import, recycle-bin restore, items, the transaction split, ERA and the activity log.
3. **Guest Portal is the outlier on every column:** seven public routes, all service-role, none validated, none tested.

## Tier hint per module

For where to send work, see [Model Tiers](<../Model Tiers/_Routing.md>). In short: anything in a money row, Recycle Bin restore and Guest Portal goes to the high tier or gets its review; modules with full Zod coverage and no balance effects are safe for the mid tier; single-file fixes like KIT-28 for the low tier.
