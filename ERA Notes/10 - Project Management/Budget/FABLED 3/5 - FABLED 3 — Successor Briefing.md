---
created: 2026-07-18
type: deep-dive
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
predecessor: ../FABLED 2/
tags:
  - pm/fabled3
  - module/budget
---

# Budget · FABLED 3.5 — Successor Briefing

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>)

## Who should read this

You are an AI model about to change money code. This cluster displays and moves real family money. The rules protecting it are strict, mechanical, and mostly enforced by skills and tests — follow them and you are safe at any capability tier; improvise and you will corrupt balances silently.

## First 10 minutes in this cluster

```bash
git log --format="%h %ad %s" --date=short --since=2026-07-18 -- src/features/accounts src/features/transactions src/features/recurring src/features/balance src/lib/balance-utils.ts
npx vitest run src/features/recurring/commitments.test.ts src/lib/balance-utils.test.ts src/lib/recurring.test.ts src/lib/utils/incomeExpense.test.ts   # expect all green
```

Then read: `.claude/skills/money-rules/SKILL.md` (**mandatory, not optional**) → `src/lib/utils/incomeExpense.ts` (the canonical spend definition) → [FABLED 2 file 1](<../FABLED 2/1 - FABLED 2 — Current Implementation.md>) (the X-ray).

## Task-tier map

| Task archetype | Tier | Route |
|---|---|---|
| UI/layout on budget pages, toasts, category pickers | **any-model** | `ui-guardrails`; Undo on every toast (Hard Rule 1); LBP in thousands (Preferences rule) |
| New read-only display of existing amounts | **any-model** | consume `sumSpending`/existing hooks; NEVER re-derive spend math locally |
| CRUD field additions (non-amount, non-balance) | **any-model** | `add-feature` + `api-route` skills; household linking per Hard Rule 13 |
| Anything creating/editing/deleting amounts, transfers, recurring, debts | **mid-tier+** | `money-rules` open; worked before/after balance example **written down**; test for changed math — no exceptions |
| Changing balance semantics, account-type direction, `sumSpending` | **human-first** | propose with the worked example; Elio verifies against real data |
| Commitments matching constants (window/tolerance) | **human-first** | silent false-match risk; see [3.2 Gap #4](<2 - FABLED 3 — Gaps & Missing.md>) |

**Out-of-depth tells — stop if:** you can't write the before/after balance example for your change; you're about to compute spending anywhere other than `incomeExpense.ts`; you're letting AI output write directly to transactions (drafts pattern exists precisely to forbid this); you're editing `MobileExpenseForm.tsx` or `recurring/page.tsx` without a scoped plan (3k-line blobs punish drive-by edits).

## Trap registry

| Trap | Symptom | Guard |
|---|---|---|
| Account types flip balance direction | expense/income/saving sign confusion | `src/lib/balance-utils.ts` + schema CHECK constraints are the law; `money-rules` has the worked examples |
| Custom month start ≠ calendar month | totals "wrong" near month boundaries | always `startOfCustomMonth()` from `src/lib/utils/date.ts` |
| Household linking on reads | partner data missing or duplicated | Hard Rule 13; `accounts/route.ts:28-52` is the canonical pattern |
| `matched` is a heuristic | commitment shows handled, money not actually paid | constants live in `commitments.ts`; don't widen tolerances to make data look better |
| safeFetch 3s default | AI/import calls falsely mark app offline | pass `timeoutMs` on anything >3s (Hard Rule 6) |
| Recurring is NOT item recurrence | editing the wrong engine | two systems (`recurrence-safety`); `recurring_payments` is money, rrule items are schedule |

## Verification manifest

| Claim | Command | Expected |
|---|---|---|
| Money tests green | `npx vitest run src/lib/balance-utils.test.ts src/lib/recurring.test.ts src/features/recurring/commitments.test.ts` | all pass |
| Canonical spend single-sourced | `grep -rln "sumSpending" src \| wc -l` | small, stable set — if it grew, someone re-derived |
| Debug routes stay dead | `ls src/app/api/env-check src/app/api/supabase-check 2>/dev/null` | nothing |
| Recurring route tests exist | `ls src/app/api/recurring-payments/[id]/*.test.ts` | 2 files |
| Repair migration paired | `ls migrations/2026-07-04_repair-drawer-account-balance.sql` | exists |

## What FABLED 2 got wrong here

Its Code-health justification said "4 debug/diagnostic routes still shipped" — by 2026-07-18 only 2 remained (`analytics/debug` had already been removed unrecorded); the ledger missed that partial fix. Its uncommitted-work note ("recurring UI continues in the working tree") resolved into `0a39c4e`/later commits as predicted. Everything else held.
