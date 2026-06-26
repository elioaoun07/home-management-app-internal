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

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the *ambitious* Budget file — where the money domain could go. Enhancements to what exists **and** richer connections to the rest of the app. This is allowed to dream; [1 · Feature State](<1 - Feature State.md>) is the sober reality. Ladders up to the global [3 · Future Vision](<../3 - Future Vision & Roadmap.md>).

---

## The strategic thesis

Budget is the household's **money graph** — every account, transaction, recurring obligation, debt, and planned purchase lives here. Today it is a strong *reactive* ledger: you record money in and out, it shows balances and analytics. Its untapped value is twofold:

1. **It is the second spine ERA should read from** (the first being Schedule's time graph). A cashflow-aware assistant can warn before a recurring payment overdraws an account — but only if the money graph is forecast-able, not just historical.
2. **Money and time are the same fact, recorded twice.** A recurring payment's due-date is a Schedule reminder; a debt's collection date is a reminder; a future purchase's target date is a deadline. The biggest wins unify these so confirming one closes the other.

**The vision in one line:** *Turn Budget from a ledger you review into a money graph that forecasts — telling you what's affordable, what's due, and what's drifting, before you ask.*

---

## Track A — Internal enhancements (within the cluster)

| Enhancement | Today | The dream | Effort |
|---|---|---|---|
| **Test the financial core** | `balance-utils` + recurring next-due untested | Unit coverage for balance direction (expense/income/saving), reconcile, and auto-post next-due math | M |
| **Cashflow forecast** | Analytics is historical (net worth, mini-charts) | Project balances forward using recurring + allocations: "you'll dip below X on the 24th" | H |
| **Salary -> Wallet quick refill** | Funding Wallet required opening the full transfer dialog and knowing which accounts to pick | Direct URL/NFC shortcut opens `/expense`, prompts only for amount, resolves Salary/Wallet by signed-in user's account names *(IMPLEMENTED 2026-06-25)* | S |
| **Public/shared accounts** | Household account access was effectively owner-only/read-only for partner data | Account-level privacy: private stays owner-only, public visible accounts are collaborative across active household partners *(IMPLEMENTED 2026-06-26)* | M |
| **50/30/20 + Dashboard V2 widgets** | Allocation is per-category envelopes; Monthly Savings shows the flat `Our Savings` account balance and Monthly includes `Expected Savings` + metric toggles *(IMPLEMENTED 2026-06-25)* | Guided budgeting templates, richer dashboard KPIs, and month-by-month savings transfer attribution | M |
| **Merchant-map → manual entry** | Statement import learns merchant→category; manual entry doesn't reuse it | Auto-suggest category on manual entry from the learned map (gap 1b) | S–M |
| **Allocation workflow across accounts** | Allocations set by hand and feel disconnected from Salary -> Wallet funding | Redesign the allocation surface so account funding, Wallet balance, recurring minimums, and category envelopes read as one flow | M |
| **Split the mega-forms** | `MobileExpenseForm` 2,890 LOC; `recurring/page.tsx` 2,772 LOC | Decompose into testable units when next touched | M |

---

## Track B — Bridges out of Budget (cross-module)

Each ladders up to a track in the global [3 · Future Vision](<../3 - Future Vision & Roadmap.md>).

- **Recurring → Schedule (due-dated payments).** A recurring payment's due-date and a Schedule reminder are the same intent — unify so confirming a payment closes the reminder. *(global Track A · Recurring→Budget; Track C · Cashflow)*
- **Debt → Schedule.** Auto-create a reminder on a debt's collection date. *(global Track A · Debt→Reminder 2e)*
- **Future Purchase → Transaction.** Linking the actual purchase auto-completes the wishlist item. *(gap 2f)*
- **Budget → ERA briefing.** Feed cashflow + overspend signals into the proactive briefing so ERA can warn before a problem. *(global Track B · briefing enrichment)*
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
3. **Bet 3 — Cashflow forecast → ERA.** The biggest *felt* upgrade: ERA can warn before an overdraft. Higher effort; scope it after the core tests exist.

> Resist building the cashflow forecast before the core tests exist — a silent balance bug would hide exactly there, and a forecast amplifies it.

→ This period's concrete actions: [3 · Action Plan](<3 - Action Plan.md>); the checkable list: [4 · Checklist](<4 - Checklist.md>).
