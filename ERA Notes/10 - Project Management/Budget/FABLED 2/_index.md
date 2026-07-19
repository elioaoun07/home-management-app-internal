---
created: 2026-07-02
type: index
status: baseline-frozen
superseded: 2026-07-18
owner: Elio
tags:
  - pm/fabled2
  - module/budget
---

# Budget · FABLED 2 — Index

> ⚠️ **Frozen v2 baseline (2026-07-02)** — superseded 2026-07-18 by [`FABLED 3/`](<../FABLED 3/_index.md>) (model-generation handoff). Do not update; new history goes to the FABLED 3 delta ledger.


> **FABLED 2** is the second-generation deep-dive layer — the successor to [FABLED v1](<../FABLED/_index.md>) (2026-06-10). v1 stays frozen as the historical baseline; **this folder is the living one**. Everything here was re-verified against the working tree on **2026-07-02** (tests run, routes listed, LOC counted, hygiene grepped). When FABLED 2 and the code disagree, the code wins — and FABLED 2 gets the correction.
>
> **What's new in generation 2:** a scored maturity model, a delta ledger against v1 (what actually shipped vs what stalled), evidence commands on every claim, kill criteria on every enhancement, and links that point at the *current* campaign file names (v1's links rotted when the PM folders were uniformized in June).

| # | File | Read it when… |
|---|---|---|
| 1 | [Current Implementation](<1 - FABLED 2 — Current Implementation.md>) | You need the post-June-sprint X-ray: canonical spend math, the outlier engine, the AI layer, what moved where. |
| 2 | [Gaps & Missing](<2 - FABLED 2 — Gaps & Missing.md>) | You want the re-ranked absence list — what v1 flagged that's still open, plus the new gaps June created. |
| 3 | [Optimization Plan](<3 - FABLED 2 — Optimization Plan.md>) | You're about to touch the cluster and want the hardening moves with sequencing. |
| 4 | [Future Enhancements](<4 - FABLED 2 — Future Enhancements.md>) | You're planning the next Budget campaign — the 10× ideas, several newly unlocked by June's work. |

## Maturity scoreboard (2026-07-02)

Rubric: 0–2 absent · 3–4 fragile · 5–6 works-but-exposed · 7–8 solid · 9–10 hardened.

| Dimension | Score | One-line justification |
|---|---|---|
| **Data correctness** | 8 | Spend reconciled to the penny via one canonical `sumSpending` (`src/lib/utils/incomeExpense.ts`); debt-return/draft/hidden-account/soft-delete divergences all fixed in June; privacy masking is server-side. |
| **Test protection** | 4 | Unit layer real (`balance-utils`, `recurring`, `date`, `splitBill`, `budgetForecast` ×9, `anomalyDetection`) — but **zero** route/contract tests; every June read-path rule lives only in code. |
| **Cross-module bridges** | 3 | Merchant map still import-only; recurring/debt/future-purchase still don't touch Schedule; drafts bridge works. |
| **Code health** | 5 | `MobileExpenseForm` grew to 2,984 LOC; 4 debug/diagnostic routes still shipped; finance routes remain the `console.*` hotspot. |
| **AI leverage** | 7 | Best-in-app: AI allocations with deterministic statistical fallback + the `AnalysisReport` JSON-contract engine with ephemeral dashboard. |
| **Overall** | **5.4** | The money math is now trustworthy; the protection and the bridges around it are not. |

## Delta since FABLED v1 — the headline

June 2026 was the cluster's biggest sprint since launch: **spend-number reconciliation to the penny, the two-signal outlier engine, Review v3 interactive analytics, AI budget allocation, the Budget AI analysis engine, public/shared accounts, transfer templates + NFC multi-transfer.** Meanwhile v1's #2 gap (`analytics/debug` shipped to prod) is **still open after 5 weeks**, and the forecast/bridge work didn't start. Full ledger in [file 2](<2 - FABLED 2 — Gaps & Missing.md>).

## Delta ledger (append-only)

- **2026-07-06 (verified `git show --stat 6c5bdbb`):** Recurring redesign **first draft shipped 2026-07-04** (`6c5bdbb` — `src/app/recurring/page.tsx` +553, new `mark-covered` route) and with it the app's **first route/contract tests**: `src/app/api/recurring-payments/[id]/mark-covered/route.test.ts` (192 lines) + `[id]/route.test.ts` (255 lines). The "zero route tests" claim in file 2 is no longer absolute — Test-protection dimension moves 4 → 5 for this cluster. A balance bug was fixed same day (`0e37308`). Recurring UI work continues uncommitted in the working tree (recurring/page.tsx, TabContainer.tsx modified as of this stamp).

## The next 3 moves

1. **Lock the June math in tests** — the spend-definition contract test ([file 3 · O1](<3 - FABLED 2 — Optimization Plan.md>)). One fixture set, five consumers, permanent.
2. **Kill the debug surface** — 4 routes, ~15 minutes ([file 3 · O3](<3 - FABLED 2 — Optimization Plan.md>)).
3. **Ship the forecast** — the substrate (outlier cleaning + statistical forecast) now exists and is tested; E1 went from "big build" to "one lib file + two surfaces" ([file 4 · E1](<4 - FABLED 2 — Future Enhancements.md>)).

**Sibling deep-dives:** [Schedule](<../../Schedule/FABLED 2/_index.md>) · [Kitchen](<../../Kitchen/FABLED 2/_index.md>) · [Hub & ERA](<../../Hub & ERA/FABLED 2/_index.md>) · [Trips](<../../Trips/FABLED 2/_index.md>) · [Notifications & Alerts](<../../Notifications & Alerts/FABLED 2/_index.md>) · [PM system](<../../FABLED 2/_index.md>)
