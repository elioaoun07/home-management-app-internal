---
created: 2026-07-18
type: deep-dive
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
predecessor: ../FABLED 2/1 - FABLED 2 — Current Implementation.md
tags:
  - pm/fabled3
  - module/budget
---

# Budget · FABLED 3.1 — Current Implementation

[_index](<_index.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

> **Inheritance (verified 2026-07-18):** [FABLED 2 file 1](<../FABLED 2/1 - FABLED 2 — Current Implementation.md>) remains normative for the canonical spend definition (`sumSpending` / `incomeExpense.ts`), outlier engine, AI layer, sharing/transfers, and size map. Re-verified via `git diff --stat c561635..HEAD -- <budget paths>` → 15 files, +1,705/−215, concentrated in recurring + statement-import. This file writes only the delta.

## 1. The commitments engine (the headline)

`src/features/recurring/commitments.ts` — 343 lines, pure, tested (`commitments.test.ts`). It classifies each recurring payment for the current period into a six-state ladder: `covered` (user marked), `matched` (a real transaction matched amount/account/date window), `due_this_period`, `missed`, `upcoming`, `monitor`. Matching consumes `RecurringMatchTransaction` candidates — recurring is now reconciled against *actual* transactions rather than trusting `last_processed_date` alone. `useRecurringPayments.ts` (+66) feeds it; `src/app/recurring/page.tsx` (3,083 LOC) renders it.

This stays within the recurring-*payments* system — it classifies and matches; it does **not** write balances or auto-post (drafts/consent doctrine intact).

## 2. Merchant learning (`0a39c4e`, 2026-07-11)

`src/app/api/merchant-mappings/route.ts` + `statement-import/hooks.ts` — persisted merchant→category mappings learned from import confirmations (rides the `2026-06-26_budget_ai_suggestion_meta.sql` schema). Still import-scoped; manual entry doesn't consult it yet.

## 3. Repairs & hygiene

- `migrations/2026-07-04_repair-drawer-account-balance.sql` — the `0e37308` balance bug fixed via a proper data-repair runbook (inspect→fix→verify shape), not an ad-hoc console script.
- **2026-07-18 (this session):** `env-check` + `supabase-check` routes deleted (unreferenced; the latter exposed an unauthenticated `listUsers` probe). The v2 "4 debug/diagnostic routes still shipped" complaint is finally clear.

## 4. Test reality (run 2026-07-18)

`npx vitest run` over the money core: **39 tests, 6 files, all green** — `commitments`, `balance-utils`, `balance`, `recurring`, `incomeExpense`, `recurring-payments` route pair. Transactions/accounts routes remain untested.
