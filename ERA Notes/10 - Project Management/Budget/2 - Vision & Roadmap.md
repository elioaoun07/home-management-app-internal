---
created: 2026-05-30
type: roadmap
status: living
owner: Elio
tags:
  - pm/roadmap
  - scope/module
  - module/budget
---

# Budget · 2 — Vision & Roadmap

> **Command Center:** [\_index](_index.md) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the _ambitious_ Budget file — where the money domain could go. Enhancements to what exists **and** richer connections to the rest of the app. This is allowed to dream; [1 · Feature State](<1 - Feature State.md>) is the sober reality. Ladders up to the global [3 · Future Vision](<../3 - Future Vision & Roadmap.md>).

---

## The strategic thesis

Budget is the household's **money graph** — every account, transaction, recurring obligation, debt, and planned purchase lives here. Today it is a strong _reactive_ ledger: you record money in and out, it shows balances and analytics. Its untapped value is twofold:

1. **It is the second spine ERA should read from** (the first being Schedule's time graph). A cashflow-aware assistant can warn before a recurring payment overdraws an account — but only if the money graph is forecast-able, not just historical.
2. **Money and time are the same fact, recorded twice.** A recurring payment's due-date is a Schedule reminder; a debt's collection date is a reminder; a future purchase's target date is a deadline. The biggest wins unify these so confirming one closes the other.

**The vision in one line:** _Turn Budget from a ledger you review into a money graph that forecasts — telling you what's affordable, what's due, and what's drifting, before you ask._

---

## Track A — Internal enhancements (within the cluster)

| Enhancement                             | Today                                                                                                                                                                                                                                                                                                   | The dream                                                                                                                                                                                                                                                                               | Effort |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **Test the financial core**             | Calculation layer now unit-tested: balance direction, balance computation/adjustment, canonical spending totals, recurring next-due, and confirm→transaction posting _(IMPLEMENTED 2026-07-03)_                                                                                                         | Broader route/contract coverage for API error mapping remains FABLED O1 work                                                                                                                                                                                                            | M      |
| **Cashflow forecast**                   | Analytics is historical (net worth, mini-charts)                                                                                                                                                                                                                                                        | Project balances forward using recurring + allocations: "you'll dip below X on the 24th"                                                                                                                                                                                                | H      |
| **50/30/20 + Dashboard V2 widgets**     | Allocation is per-category envelopes; Monthly Savings shows the flat `Our Savings` account balance and Monthly includes `Expected Savings` + metric toggles _(IMPLEMENTED 2026-06-25)_. Review V2 and V3 both pass the global date range into the range-aware Monthly widget _(IMPLEMENTED 2026-06-26)_ | Guided budgeting templates, richer dashboard KPIs, and month-by-month savings transfer attribution                                                                                                                                                                                      | M      |
| **Merchant-map → manual entry**         | Typing a merchant on the Category/Subcategory steps makes the mapped card glow (color-matched pulse); guidance-only, user still taps. Works **cross-user and cross-account** — partner mappings included, categories resolved by slug/name on whatever account is selected, silent skip when absent _(IMPLEMENTED 2026-07-11, gap 1b; chip design replaced by card-glow and cross-user/account resolution added same day)_                                                                                    | Extend the same merchant match to **Voice Draft Transactions** (pre-select category/subcategory when the spoken message names a known merchant) and **Hub Budget Chat → "Add as Transaction"** (pre-select in the message action) — X2a / X2b, Hub & ERA L6                              | S–M    |
| **Allocation workflow across accounts** | Allocations set by hand and recurring commitments felt like a static bill list disconnected from manual transaction entry                                                                                                                                                                                | Redesign the allocation surface so account funding, Wallet balance, recurring minimums, and category envelopes read as one flow. AI-proposed allocation from outlier-cleaned history + inline Allocate/Review surface _(IMPLEMENTED 2026-06-26)_; recurring commitments console + manual transaction reconciliation _(IMPLEMENTED 2026-07-03)_ | M      |
| **Split the mega-forms**                | `MobileExpenseForm` 2,890 LOC; `recurring/page.tsx` 2,772 LOC                                                                                                                                                                                                                                           | Decompose into testable units when next touched                                                                                                                                                                                                                                         | M      |
| **Household transfer authorization**    | Household transfer UI can select every visible partner destination account                                                                                                                                                                                                                                | The API authorizes that destination without broadening ordinary private-account writes *(IMPLEMENTED 2026-07-21)*                                                                                                                                                                    | S      |

---

## Track B — Bridges out of Budget (cross-module)

Each ladders up to a track in the global [3 · Future Vision](<../3 - Future Vision & Roadmap.md>).

- **Recurring → Schedule (due-dated payments).** A recurring payment's due-date and a Schedule reminder are the same intent — unify so confirming a payment closes the reminder. _(global Track A · Recurring→Budget; Track C · Cashflow)_
- **Debt → Schedule.** Auto-create a reminder on a debt's collection date. _(global Track A · Debt→Reminder 2e)_
- **Future Purchase → Transaction.** Linking the actual purchase auto-completes the wishlist item. _(gap 2f)_
- **Budget → ERA briefing.** Feed cashflow + overspend signals into the proactive briefing so ERA can warn before a problem. _(global Track B · briefing enrichment)_ — _first piece IMPLEMENTED 2026-06-27:_ Budget AI now produces an on-demand **structured spending analysis** (`AnalysisReport`: KPIs, insights, anomalies, recommendations) that renders as a chat answer **and** a dashboard. Follow-up fixes _(IMPLEMENTED 2026-06-27)_: duplicate model category labels are merged before dashboard rendering, and `analysis_report` is persisted on `ai_messages` so historical answers can reopen **View as Dashboard** without another AI call. The structured signals now exist; wiring them into the _proactive_ ERA briefing is the remaining step. See [Spending Analysis Report](<../../03 - Junction Modules/AI Assistant/Spending Analysis Report.md>).
- **Statement Import → Inventory/Catalogue.** Parsed grocery lines could pre-fill inventory or catalogue prices (longer reach).

---

## Prioritization matrix

```
  IMPACT
   ▲
H  │  Test the financial core (A)     Cashflow forecast (B/A)
   │  Recurring↔Schedule unify (B)    Budget→ERA briefing (B)
   │                                  50/30/20 + Dashboard V2 (A)
   ├──────────────────────────────────────────────────────────
M  │  Merchant-map→entry (A)          Allocation auto-suggest (A)
   │  Debt→Schedule (B)               Split mega-forms (A)
   │  Future Purchase→Tx (B)
   ├──────────────────────────────────────────────────────────
L  │  (—)                             Statement→Inventory (B)
   │
   └──────────────────────────────────────────────────────────►
        LOW EFFORT             MED EFFORT             HIGH EFFORT
```

---

## 🎯 The bets (my recommendation)

If you point the next stretch at Budget:

1. **Bet 1 — Lock the foundation: test `balance-utils` + recurring next-due.** Lowest effort, kills the highest-stakes gap (wrong money is the worst bug). Do this before any enhancement that touches balances.
2. **Bet 2 — Unify Recurring ↔ Schedule due-dates.** The highest-leverage bridge: money and time stop being recorded twice. Coordinate with [Schedule · 2 · Vision & Roadmap](<../Schedule/2 - Vision & Roadmap.md>) (same bridge from the other side).
3. **Bet 3 — Cashflow forecast → ERA.** The biggest _felt_ upgrade: ERA can warn before an overdraft. Higher effort; scope it after the core tests exist.

> Resist building the cashflow forecast before the core tests exist — a silent balance bug would hide exactly there, and a forecast amplifies it.

→ This period's concrete actions: [3 · Action Plan](<3 - Action Plan.md>); the checkable list: [4 · Checklist](<4 - Checklist.md>).
