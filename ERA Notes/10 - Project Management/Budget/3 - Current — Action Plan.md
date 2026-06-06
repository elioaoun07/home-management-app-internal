---
created: 2026-05-30
updated: 2026-05-30
type: action-plan
status: active
owner: Elio
tags:
  - pm/action
  - scope/module
  - module/budget
---

# Budget · 3 — Current — Action Plan

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State — Current Reality.md>) · [2 · Future Vision](<2 - Future Vision & Roadmap.md>) · [3 · Current Action Plan](<3 - Current — Action Plan.md>)
>
> **What this file is:** the living queue of what to actually do next on Budget — **might be this week, might be later.** Not a fixed Mon–Fri grid. Re-order as priorities move; promote an item to "Now" when you pick it up.

---

## 📌 The call

**This period: protect the money, then unify money with time.**

Budget's core is 🟢 Core and stable, so the danger isn't missing features — it's that the **highest-stakes logic (balance math + recurring auto-post) is untested**, and a wrong number here is worse than any UI bug. Lock that foundation first. Then collapse the duplicate facts: a recurring due-date and a Schedule reminder are the same thing recorded twice.

This mirrors the global theme ("Stabilize, then Connect") at the cluster level: harden the financial core, then connect Budget outward.

---

## 🎯 Candidate work (from [2 · Future Vision](<2 - Future Vision & Roadmap.md>))

| Candidate | Track | Impact | Effort | Foundation? |
|---|---|---|---|---|
| `balance-utils` unit tests | A | High | M | ✅ yes |
| Recurring next-due unit tests | A | High | M | ✅ yes |
| Recurring ↔ Schedule due-date unify | B | High | H | — |
| Merchant-map → manual entry | A | Med | S–M | — |
| Cashflow forecast → ERA | B | High | H | — |
| 50/30/20 + Dashboard V2 widgets | A | High | M | — |
| Debt → Schedule auto-reminder | B | Med | S–M | — |
| Allocation auto-suggest from recurring | A | Med | M | — |
| Remove/guard `analytics/debug` route | A | Low | S | — |

---

## 🗓️ Sequenced plan

### Now — Foundation (do first)

- [ ] **`balance-utils` unit tests.** Cover balance direction for expense/income/saving accounts, reconcile, and history. Pure-logic where possible so no Supabase mocks are needed. (global P0)
- [ ] **Recurring next-due unit tests.** Cover auto next-due computation, confirm→transaction, and exceptions. The auto-post math is the second-highest-stakes path.
- [ ] **Remove/guard `analytics/debug`.** Quick hygiene — a debug endpoint shouldn't be in the prod surface.

### Next — First enhancement

- [ ] **Merchant-map → manual entry.** Smallest high-value win: reuse the learned statement-import merchant→category map to auto-suggest on manual entry (gap 1b).

### Later — Connect outward

- [ ] **Recurring ↔ Schedule due-date unify** — bigger; coordinate with [Schedule · 3](<../Schedule/3 - Current — Action Plan.md>). _(global Track A / Cashflow)_
- [ ] **Cashflow forecast → ERA briefing** — project balances forward; scope after core tests exist. _(global Track B / C)_

---

## ✅ Definition of done — this period

- [ ] `balance-utils` has unit coverage; expense/income/saving directions verified; `pnpm test` green.
- [ ] Recurring next-due + auto-post covered by tests.
- [ ] `analytics/debug` removed or guarded.
- [ ] File 1 (Feature State) updated to drop the "untested" notes this work closes.

---

## 🚫 Not now

- ❌ Don't refactor `MobileExpenseForm` (~2,890 LOC) or `recurring/page.tsx` (~2,772 LOC) "just because" — only when you next touch them for a feature.
- ❌ Don't build the cashflow forecast before the balance/recurring tests exist — a silent number bug would hide there and the forecast would amplify it.
- ❌ Don't open the Recurring↔Schedule bridge before the recurring tests exist.

---

## ⏭️ Later / backlog

- Cashflow forecast (project balances forward from recurring + allocations).
- 50/30/20 budgeting templates + Dashboard V2 widgets.
- Allocation auto-suggest from recurring commitments.
- Future Purchase → Transaction auto-complete on linked purchase.
- Debt → Schedule auto-reminder on collection date.
- Split the expense + recurring mega-forms into testable units.
- Statement Import → Inventory/Catalogue price pre-fill.
