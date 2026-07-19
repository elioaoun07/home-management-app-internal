---
created: 2026-07-18
type: index
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
predecessor: ../FABLED 2/
tags:
  - pm/fabled3
  - module/budget
---

# Budget · FABLED 3 — Index

> Third-generation audit, created 2026-07-18 as part of a **model-generation handoff** (FABLED 2 is only 16 days old; the >40%/6-month rule was not met and still governs FABLED 4). Verified against `f0a8e19`. Headline: the recurring redesign matured from "first draft" into a real **commitments engine** with its own test file, and the money core now carries 39 green tests. The two 3,000-line UI blobs are the new health ceiling.

| File | Read it when… |
|---|---|
| [3.1 Current Implementation](<1 - FABLED 3 — Current Implementation.md>) | delta since 07-02 — commitments engine, merchant learning, repair migration |
| [3.2 Gaps & Missing](<2 - FABLED 3 — Gaps & Missing.md>) | what still leaks |
| [3.3 Optimization Plan](<3 - FABLED 3 — Optimization Plan.md>) | ranked moves |
| [3.4 Future Enhancements](<4 - FABLED 3 — Future Enhancements.md>) | ideas + kill criteria |
| [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>) | **you are a successor model about to touch money code — read this first** |

## Maturity scoreboard (2026-07-18)

| Dimension | Score | Δ vs 07-02 | Evidence |
|---|---|---|---|
| Data correctness | 8 | = | Canonical `sumSpending` untouched; drawer-balance repair executed as a proper runbook migration (`2026-07-04_repair-drawer-account-balance.sql`) |
| Test protection | 6 | +2 | 39 tests green across 6 money files (run 2026-07-18): `commitments.test.ts` (new), `balance-utils`, `balance`, `recurring`, `incomeExpense`, + 2 recurring route tests |
| Cross-module bridges | 3 | = | Merchant mappings API shipped (`0a39c4e`) but still import-scoped; recurring/debts still don't touch Schedule |
| Code health | 5 | = | Debug/diagnostic routes **deleted 2026-07-18** (finally) — but `recurring/page.tsx` is a new 3,083-LOC blob and `MobileExpenseForm` grew to 3,099 |
| AI leverage | 7 | = | AI allocations + AnalysisReport engine unchanged; merchant learning adds a small real loop |
| **Overall** | **5.8** | **+0.4** | Protection caught up a step; the blobs and bridges are next |
| **Handoff readiness** | **5** | new | `money-rules` skill + real tests make scoped money work mid-tier-safe; balance-semantics changes stay gated (worked example + test mandatory); UI work any-model |

## Delta ledger — inherited from FABLED 2 (verbatim)

- **2026-07-06 (verified `git show --stat 6c5bdbb`):** Recurring redesign **first draft shipped 2026-07-04** (`6c5bdbb` — `src/app/recurring/page.tsx` +553, new `mark-covered` route) and with it the app's **first route/contract tests**: `src/app/api/recurring-payments/[id]/mark-covered/route.test.ts` (192 lines) + `[id]/route.test.ts` (255 lines). The "zero route tests" claim in file 2 is no longer absolute — Test-protection dimension moves 4 → 5 for this cluster. A balance bug was fixed same day (`0e37308`). Recurring UI work continues uncommitted in the working tree (recurring/page.tsx, TabContainer.tsx modified as of this stamp).

## Delta ledger (FABLED 3 era, append-only)

- **2026-07-18** (generation created): commitments engine audited (`src/features/recurring/commitments.ts`, 343 lines + test — status ladder covered/matched/due_this_period/missed/upcoming/monitor with transaction matching); merchant-mappings route (`0a39c4e`); **debug routes deleted this session** (`env-check`, `supabase-check` — the v2 Code-health complaint item). Test protection 5 → 6. Evidence cutoff `f0a8e19`.

## The next 3 moves

1. **Split `recurring/page.tsx` (3,083 LOC)** while it's young — the commitments engine is already cleanly extracted; the page just needs the same treatment before it calcifies like MobileExpenseForm.
2. **Bridge merchant mappings beyond import** — apply learned mappings in manual entry suggestions (v2's E-item, now with the API in place).
3. **Route tests for transactions + accounts** — recurring proved the pattern; the two highest-traffic route families still have zero.

**Siblings:** [Schedule](<../../Schedule/FABLED 3/_index.md>) · [Kitchen](<../../Kitchen/FABLED 3/_index.md>) · [Trips](<../../Trips/FABLED 3/_index.md>) · [Hub & ERA](<../../Hub & ERA/FABLED 3/_index.md>) · [Notifications](<../../Notifications & Alerts/FABLED 3/_index.md>) · [Healthcare](<../../Healthcare/FABLED 3/_index.md>) · [PM system](<../../FABLED 3/_index.md>)
