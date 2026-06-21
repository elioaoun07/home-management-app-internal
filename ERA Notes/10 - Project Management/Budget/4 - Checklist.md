---
created: 2026-06-20
updated: 2026-06-20
type: checklist
status: active
owner: Elio
tags:
  - pm/checklist
  - scope/module
  - module/budget
---

# Budget · 4 — Checklist

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the single flat, checkable surface for Budget — every actionable item as one checkbox, grouped **Now / Next / Later**, each with an ID, severity, and effort. The narrative *why* is [3 · Action Plan](<3 - Action Plan.md>). ✅ items stay as the record (Hard Rule #25 — no orphan fixes).
>
> **Legend:** Sev 🔴 blocker · 🟠 friction · 🟡 annoyance · ⚪ parked. Effort S/M/H. Point at a line (e.g. _N4_), a group, or a phase.

---

## ▶️ Now — Foundation (protect the money)

- [x] **N1** `balance-utils` unit tests — expense/income/saving directions, reconcile. ✅ 2026-06-10 (`src/lib/balance-utils.test.ts`, 28 tests green). _(🔴 · M)_
- [x] **N2** Recurring next-due unit tests. ✅ 2026-06-10 (`src/lib/recurring.test.ts`). Still open: confirm→transaction flow + exceptions → see [FABLED Gaps G1](<FABLED/2 - FABLED — Gaps & Missing.md>). _(🔴 · M)_
- [x] **N3** Reconciliation checkpoint — "last checked" date + 7-day stale glow + one-tap match/correct in `BalanceHistoryDrawer` (with Undo). ✅ 2026-06-16. See [Balance System § Reconciliation Checkpoint](<../../02 - Standalone Modules/Accounts & Balance/Balance System.md>). _(🟠 · M)_
- [ ] **N4** Remove/guard `analytics/debug` — a debug endpoint shouldn't be in the prod surface. _(🟡 · S)_

## ⏭️ Next — First enhancement

- [ ] **X1** Merchant-map → manual entry: reuse the statement-import merchant→category map to auto-suggest on manual entry (gap 1b). _(🟡 · S–M)_

## 🔜 Later — Connect outward

- [ ] **L1** Recurring ↔ Schedule due-date unify — coordinate with [Schedule · 4 · Checklist](<../Schedule/4 - Checklist.md>). _(🟠 · H)_
- [ ] **L2** Cashflow forecast → ERA briefing — project balances forward; scope after core tests exist. _(🟠 · H)_
- [ ] **L3** 50/30/20 budgeting templates + Dashboard V2 widgets. _(🟡 · M)_
- [ ] **L4** Allocation auto-suggest from recurring commitments. _(🟡 · M)_
- [ ] **L5** Future Purchase → Transaction auto-complete on linked purchase. _(🟡 · S–M)_
- [ ] **L6** Debt → Schedule auto-reminder on collection date. _(🟡 · S–M)_
- [ ] **L7** Split the expense + recurring mega-forms into testable units (only when next touched). _(⚪ · M)_
- [ ] **L8** Statement Import → Inventory/Catalogue price pre-fill. _(⚪ · M)_

---

## ✅ Definition of done — this period

- [x] **D1** `balance-utils` has unit coverage; expense/income/saving directions verified; `pnpm test` green.
- [ ] **D2** Recurring next-due **+ auto-post** (confirm→transaction) covered by tests.
- [ ] **D3** `analytics/debug` removed or guarded.
- [ ] **D4** [1 · Feature State](<1 - Feature State.md>) updated to drop the "untested" notes this work closes.
