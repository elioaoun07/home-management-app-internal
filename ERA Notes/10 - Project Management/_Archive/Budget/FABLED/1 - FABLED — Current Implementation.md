---
created: 2026-06-10
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled
  - module/budget
---

# Budget · FABLED 1 — Current Implementation

> **FABLED:** [_index](<_index.md>) · **1 · Implementation** · [2 · Gaps](<2 - FABLED — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED — Future Enhancements.md>)
>
> How the finance cluster is *actually* built, verified against `main` 2026-06-10. Authoritative code maps stay in the vault docs (`02 - Standalone Modules/`); this file is the cluster-level X-ray that no single vault doc gives you.

---

## 1 · Identity & shape

"Budget" is the user-facing name for **11 architecturally independent standalone modules** that share the Finance domain tables: Accounts & Balance, Transactions, Categories, Recurring Payments, Budget Allocation, Transfers, Statement Import, Analytics, Debts, Future Purchases, Drafts.

The cluster follows the app-wide layering exactly:

```
src/features/<module>/     ← thin: TanStack Query hooks only (verified: every budget feature
                              dir is 1–3 hook files; zero UI, zero cross-feature imports)
src/components/...         ← the actual UI (expense form, drawers, grids)
src/app/<route>/           ← pages (expense/, recurring/, analytics/…)
src/app/api/<route>/       ← API routes (auth → zod → DB → error mapping)
src/lib/                   ← the real business logic (balance-utils, nlp, utils/date, recurring)
```

**Key implication:** the brains of Budget are NOT in `src/features/` — they're in `src/lib/`. `balance-utils.ts` (balance direction), `utils/date.ts` (`startOfCustomMonth` billing cycles), `recurring.ts` (next-due math), `utils/splitBill.ts`, and the budget NLP parser under `src/lib/nlp/`. This is why the unit-test baseline targets `src/lib`.

## 2 · Data model (Finance domain)

Per `migrations/schema.sql` (tables/columns authoritative; **RLS/functions are NOT in the repo export** — see CLAUDE.md Database caveat):

- `accounts` — typed `expense | income | saving`; the type **drives balance direction** (a CHECK constraint + `balance-utils.ts`). Hard Rule #13's household-linking pattern is implemented here (`src/app/api/accounts/route.ts:28-52`) and is the canonical copy other routes mirror.
- `account_balances`, `account_balance_history` — current + historical balance, reconcile support (history archiving via `features/balance/archiveHooks.ts`).
- `transactions` — full CRUD, `private` flag (household-invisible), split-bill fields, draft linkage.
- `transfers` — between-account with direction-aware double entry.
- `user_categories` — hierarchical, icon/color, ordered; cross-user slug matching is a module Hard Rule (see Categories vault doc).
- `recurring_payments` — schedule + next-due + confirm→transaction + exceptions.

Satellite tables surfaced by the API: budget allocations, merchant mappings, transaction templates, future payments/purchases, debts, drafts (names per route surface below; check `schema.sql` before SQL).

## 3 · API surface (verified route inventory)

Finance routes under `src/app/api/`: `accounts`, `transactions`, `transfers`, `recurring-payments`, `future-payments`, `future-purchases`, `budget-allocations`, `statement-import`, `merchant-mappings`, `user-categories`, `debts`, `drafts`, `transaction-templates`, `receipts`, `analytics` (+ `analytics/debug` — ⚠️ still shipped as of 2026-06-10).

All follow the canonical pattern from `accounts/route.ts`: Supabase server-client auth check → zod parse → DB op → `23505 → 409` mapping → household-link expansion unless `ownOnly=true`.

## 4 · The flows that matter

**Manual expense entry (the daily-driver flow):**
`MobileExpenseForm.tsx` (~2,890 LOC, `src/components/expense/`) — multi-step wizard (amount → account → category → subcategory → review) with quick-amount chips, calculator, swipe-back gesture, haptics, inline note, numbered-step indicator (ERA Design System pass, Apr 2026). Mutations via `safeFetch` + optimistic TanStack updates; cache invalidation per `queryConfig.ts` constants (`BALANCE=5min`, `TRANSACTIONS=2min`, `ACCOUNTS/CATEGORIES=1h`, `RECURRING=30min`).

**Voice → Draft → Transaction:**
voice/Hub input is parsed by the **budget NLP parser** (`src/lib/nlp/` — distinct from the Schedule parser `smartTextParser.ts`; the two have been confused before, see memory) → creates a **draft** (drafts drawer/badge, `features/drafts/useDrafts.ts`) → user confirms → transaction. This is the cluster's main junction touchpoint with Hub/ERA.

**Recurring auto-post:**
`recurring_payments` + next-due computation in `src/lib/recurring.ts` → cron confirms/posts → transaction created → next-due rolls forward; exceptions supported. Cron routes obey Hard Rule #8 (`CRON_SECRET`, `supabaseAdmin()`, `maxDuration=60`).

**Statement import:**
CSV/PDF parse → line items → **merchant→category mapping** persisted via `merchant-mappings` API (the learned map currently feeds *only* import, not manual entry — gap 1b).

**Billing cycle:** all monthly aggregation uses `startOfCustomMonth(date, monthStartDay)` — never calendar months. LBP display uses the Preferences thousands rule.

## 5 · Test reality (run 2026-06-10: 28 tests, 5 files, all green)

| Suite | Covers |
|---|---|
| `src/lib/balance-utils.test.ts` | Balance direction for expense/income/saving ✅ |
| `src/lib/recurring.test.ts` | Next-due math ✅ |
| `src/lib/utils/date.test.ts` | Custom month start / date logic ✅ |
| `src/lib/utils/splitBill.test.ts` | Split-bill display ✅ |
| `src/lib/schedule/expandOccurrences.test.ts` | (Schedule, not Budget) |

**This means the Budget action-plan "Now" foundation items are DONE** — file [3](<../3 - Current — Action Plan.md>) updated 2026-06-10. What remains untested: every API route, the confirm→transaction flow end-to-end, transfers, statement parsing.

## 6 · Size & risk map (change-risk hotspots)

| File | LOC (≈) | Risk |
|---|---|---|
| `src/components/expense/MobileExpenseForm.tsx` | 2,890 | The daily driver; every UX pass lands here. Split on next feature touch. |
| `src/app/recurring/page.tsx` | 2,772 | Page + logic entangled; auto-post UI lives here. |
| `src/components/web/WebDashboard.tsx` | 2,426 | Consumes the cluster's data; owned by Dashboard module. |

## 7 · Cross-module touchpoints (what can break Budget from outside)

- **Hub Chat / Message Actions** — message → transaction creation.
- **ERA** — budget context injection + voice entry → drafts.
- **Trips** — auto-creates a trip account on activation (direct Supabase inserts mirroring the accounts route, *not* via the API — keep in sync if accounts route logic changes).
- **Notifications** — spending alerts, recurring payment reminders.
- **Household Sharing** — every read path doubles via `household_links`.
