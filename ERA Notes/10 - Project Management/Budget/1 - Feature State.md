---
created: 2026-05-30
type: status
status: living
owner: Elio
tags:
  - pm/status
  - scope/module
  - module/budget
---

# Budget · 1 — Feature State

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the *honest, no-hype* state of every Budget sub-feature — what exists, how mature it is, and the single most useful next step. **No imagination here** (that's file 2).
>
> **Method & confidence:** a **structural** assessment derived from the cluster's vault docs (`02 - Standalone Modules/`), live route/API surface, and `src/features/`. It is **not** a line-by-line correctness audit. Treat tiers as "how battle-tested," not "bug-free."
>
> **Module identity:** "Budget" is the user-facing name for the **finance cluster** — several architecturally independent standalone modules (accounts, transactions, categories, recurring, transfers, allocation, statement import, analytics, debts, future purchases, drafts) that together form the money side of the app. At the app level (global [2 · Feature State](<../2 - Feature State — Current Reality.md>)) the core of it is **🟢 Core, stable** but **untested** — this is the financial heart and carries the highest regression cost.

---

## Maturity tiers

| Tier | Meaning |
|---|---|
| 🟢 **Core** | Foundational, oldest, used daily, most battle-tested. Regressions here hurt most. |
| 🔵 **Established** | Fully built and shipping; less hammered than Core but stable. |
| 🟡 **New / Thin** | Recently shipped or lightly wired; expect rough edges. |
| 🟠 **Stub / Partial** | Exists but key paths are placeholders or known-incomplete. |
| ⚫ **Orphan / Debt** | Empty, dead, or misfiled. |

---

## Sub-features

| Sub-feature | Tier | Reality / known gaps | Next step |
|---|---|---|---|
| **Accounts & Balance** | 🟢 Core | Multi-account, dynamic balance, balance history, default account, reconcile. The financial core. Account types (expense/income/saving) drive balance direction. `balance-utils` unit-tested ✅ (2026-06-10); API routes still uncovered. **Reconciliation checkpoint** ✅ (2026-06-16) — "last checked" date (reused `balance_set_at`) glows red past 7 days; one-tap "Balance matches" / "Doesn't match — correct it" in `BalanceHistoryDrawer`, with Undo. | Route contract tests (FABLED O1). |
| **Transactions** | 🟢 Core | Full CRUD, drafts, private, split-bill, category grid, voice entry. `MobileExpenseForm` is **2,890 LOC** — a change-risk hotspot. | Split the mega-form when next touched; don't refactor "just because". |
| **Categories** | 🟢 Core | Hierarchical, icons/colors, DnD reorder, cross-user slug matching (module Hard Rule). Solid. | — (stable) |
| **Recurring Payments** | 🟢 Core | Schedule, auto next-due, confirm→transaction, exceptions. `recurring/page.tsx` **2,772 LOC**. Next-due math unit-tested ✅ (2026-06-10); confirm→transaction flow still uncovered. | Test confirm→transaction (FABLED O1); monthly "confirm paid" digest (backlog). |
| **Budget Allocation** | 🔵 Established | Envelope allocations per category. User pain surfaced 2026-06-25: allocation across accounts feels weak after Salary -> Wallet funding. | Make allocation workflow the next Budget focus; clarify how Wallet funding, account balances, and category envelopes connect. |
| **Transfers** | 🔵 Established | Between-account transfers with correct balance direction. Done 2026-06-25: `/expense?transfer=salary-wallet` opens a small Salary -> Wallet amount prompt and resolves account IDs from the tapping user's own account names. | — (stable) |
| **Statement Import** | 🔵 Established | CSV/PDF parse, merchant→category mapping. Recently split ("split estatement import", May 28). | Feed merchant map into manual entry (gap 1b). |
| **Analytics** | 🔵 Established | Net worth, mini-charts, world spend map. Has a `debug` route shipped to prod surface. Dashboard V2 Monthly Savings now reads the flat `Our Savings` account balance and adds `Expected Savings` (`Income - Expense`) with metric toggles ✅ (2026-06-25); month-by-month transfer attribution is still future work. **Review v3** experimental dashboard view added ✅ (2026-06-26) — Insight tab (category-stacked monthly spend + runtime outlier toggle + budget reference line + Income/Expense/Expected-Savings pie) reusing the v2 Monthly/Categories tabs; pending merge-back into v2. | Remove/guard `analytics/debug`; validate Review v3 then merge into v2; 50/30/20 (backlog). |
| **Debts** | 🔵 Established | Owed-to / owed-by, settlement, standalone debts. | Auto-reminder on collection date (gap 2e → Schedule bridge). |
| **Future Purchases** | 🔵 Established | Wishlist, target amount/date, allocation, spending analysis. | Link actual purchase → auto-complete (gap 2f). |
| **Drafts** | 🔵 Established | Drafts drawer/badge/dialog for pending (voice) transactions. | — (stable) |

---

## Implemented Notes

- [x] 2026-06-26 - Public/shared accounts shipped. Accounts remain private by default; public visible accounts can be opened and used by the active household partner for balances, transactions, categories, and transfers.

---

## Related code (single source of truth)

Do **not** duplicate file-path tables here — they drift. The authoritative code maps live in the per-module vault docs:

- [Accounts & Balance / Overview](<../../02 - Standalone Modules/Accounts & Balance/Overview.md>) (+ `Balance System.md`, `Default Account.md`, `Income Expense System.md`)
- [Transactions / Overview](<../../02 - Standalone Modules/Transactions/Overview.md>) (+ `Voice Draft Transactions.md`, `Expense Form Design Guide.md`)
- [Categories / Overview](<../../02 - Standalone Modules/Categories/Overview.md>) · [Recurring Payments / Overview](<../../02 - Standalone Modules/Recurring Payments/Overview.md>)
- [Budget Allocation](<../../02 - Standalone Modules/Budget Allocation/>) · [Transfers](<../../02 - Standalone Modules/Transfers/>) · [Statement Import](<../../02 - Standalone Modules/Statement Import/>) · [Analytics](<../../02 - Standalone Modules/Analytics/>) · [Debts](<../../02 - Standalone Modules/Debts/>) · [Future Purchases](<../../02 - Standalone Modules/Future Purchases/>) · [Drafts](<../../02 - Standalone Modules/Drafts/>)
- Schema source of truth: `migrations/schema.sql` (Finance domain tables). Balance direction: `src/lib/balance-utils.ts`.

---

## The honest weak-link summary

_(Updated 2026-05-30)_

1. **The financial core is untested.** Accounts/balance math and recurring auto-post next-due are the highest-stakes logic in the entire app — wrong numbers here are worse than any UI bug — and they have **no unit coverage**. This is the top risk (global P0).
2. **Two mega-files are change-risk hotspots.** `MobileExpenseForm` (~2,890 LOC) and `recurring/page.tsx` (~2,772 LOC). Don't refactor for its own sake; split when next touched.
3. **`analytics/debug` route is shipped to the prod surface** — remove or guard it.
4. **Bridges are mostly one-directional.** Recurring due-dates, debt collection dates, and future-purchase completions are facts that *also* live (or should) in Schedule / Transactions — see file 2.

→ The growth opportunities are in [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>); the concrete next steps are in [3 · Action Plan](<3 - Action Plan.md>); the checkable list is [4 · Checklist](<4 - Checklist.md>).
