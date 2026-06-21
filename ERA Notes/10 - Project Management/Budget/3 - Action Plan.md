---
created: 2026-05-30
updated: 2026-06-20
type: action-plan
status: active
owner: Elio
tags:
  - pm/action
  - scope/module
  - module/budget
---

# Budget · 3 — Action Plan

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the *why, and in what order* for Budget — the strategic call and the candidate work as narrative. The flat, checkable version of this plan is [4 · Checklist](<4 - Checklist.md>); tick the boxes there.

---

## 📌 The call

**This period: protect the money, then unify money with time.**

Budget's core is 🟢 Core and stable, so the danger isn't missing features — it's that the **highest-stakes logic (balance math + recurring auto-post) is untested**, and a wrong number here is worse than any UI bug. Lock that foundation first. Then collapse the duplicate facts: a recurring due-date and a Schedule reminder are the same thing recorded twice.

This mirrors the global theme ("Stabilize, then Connect") at the cluster level: harden the financial core, then connect Budget outward.

---

## 🎯 Candidate work (from [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>))

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

## 🗺️ The sequence (narrative)

**Now — Foundation.** Lock the highest-stakes logic before anything else: `balance-utils` and recurring next-due tests (both ✅ done), the reconciliation checkpoint (✅ done), then the quick `analytics/debug` hygiene fix.

**Next — First enhancement.** The smallest high-value win: reuse the learned statement-import merchant→category map to auto-suggest on manual entry.

**Later — Connect outward.** Open the Recurring ↔ Schedule due-date bridge (coordinate with [Schedule · 4 · Checklist](<../Schedule/4 - Checklist.md>)), then the cashflow forecast → ERA briefing — only after the core tests exist. Resist building the forecast before the core tests exist: a silent balance bug would hide exactly there, and a forecast amplifies it.

→ Every item above as a checkable line (with IDs, severity, effort): [4 · Checklist](<4 - Checklist.md>).

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
