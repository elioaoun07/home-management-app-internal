---
created: 2026-06-10
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled
  - module/budget
---

# Budget · FABLED 4 — Future Enhancements

> **FABLED:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED — Current Implementation.md>) · [2 · Gaps](<2 - FABLED — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED — Optimization Plan.md>) · **4 · Enhancements**
>
> The 10× ideas, with effort/impact and the *implementation seam* each would use. Expands [file 2 (Future Vision)](<../2 - Future Vision & Roadmap.md>) with the how. Dream here; sequence in [file 3](<../3 - Current — Action Plan.md>).

---

## E1 — Cashflow forecast engine ⭐ (the cluster's 10× feature)

**Impact: High · Effort: H · Prereq: O1 tests**

All inputs already exist: balances (`account_balances`), known future outflows (`recurring_payments` next-dues), planned outflows (allocations, future purchases). A pure `src/lib/forecast.ts` that expands recurring schedules N days forward (reuse the next-due math) and folds them onto current balances produces a daily projected-balance series per account.

- **Surface 1:** Analytics chart — projected line continuing the historical net-worth line.
- **Surface 2:** ERA briefing — *"Salary lands the 1st; three auto-posts before that put Checking at −$40 on the 28th."*
- **Why pure-lib first:** testable like `balance-utils`, no schema change, and both surfaces consume the same function.

## E2 — Recurring ↔ Schedule due-date unification

**Impact: High · Effort: H · Coordinate with [Schedule FABLED 4](<../Schedule/FABLED/4 - FABLED — Future Enhancements.md>)**

One fact, one record: a recurring payment's due-date materializes as a Schedule item (likely a generated read-model, *not* a duplicated row — Schedule's `expandOccurrences` already does virtual expansion for RRULEs). Confirming the payment completes the occurrence; snoozing the occurrence defers the payment. The trap to avoid: two-way sync between two stores. Pick one owner (Budget owns the fact; Schedule renders a projection of it).

## E3 — Merchant intelligence (start tiny: gap 1b)

**Impact: Med→High · Effort: S → M → L (staged)**

1. **Stage 1 (S):** manual entry reads `merchant-mappings` — type "Spinneys" → category pre-selected. One query + one autocomplete.
2. **Stage 2 (M):** merchant autocomplete from transaction history (names normalize over time).
3. **Stage 3 (L):** per-merchant analytics — monthly spend per merchant, price drift on statement-import line items, feeding Inventory/Catalogue prices.

## E4 — Debt → Schedule auto-reminder

**Impact: Med · Effort: S–M**

On debt create/update with a collection date, upsert a linked Schedule reminder (store the item id on the debt row for cleanup). Settling the debt completes the reminder. This is the smallest end-to-end rehearsal of the E2 pattern — **do it first** to derisk E2's design.

## E5 — Future Purchase → Transaction auto-complete

**Impact: Med · Effort: S–M**

"Link purchase" action on a transaction (or matching heuristic: amount within X% + category match within target window) marks the wishlist item purchased, records actual vs target price. Closes the wishlist loop that currently dead-ends.

## E6 — 50/30/20 + Dashboard V2 widgets

**Impact: High (felt daily) · Effort: M**

Guided allocation templates over the existing envelope system (needs/wants/savings tagging on categories) + the Dashboard V2 KPI widgets from the global roadmap. Pairs naturally with E1's projected line.

## E7 — Allocation auto-suggest from recurring

**Impact: Med · Effort: M**

Envelope minimum = sum of recurring commitments in that category (already computable). Suggest, don't force: show "committed: $X" under each envelope slider.

## E8 — Budget → ERA proactive money briefings

**Impact: High · Effort: M (after E1)**

Weekly digest + threshold alerts through the existing Notifications junction: overspend vs envelope, unusual merchant spend, upcoming auto-posts, forecast warnings (E1). ERA becomes the read-surface; Budget just exposes signal functions.

## E9 — Statement Import → Inventory/Catalogue price feed

**Impact: Low–Med · Effort: M–L (longer reach)**

Grocery line items → price observations on catalogue/inventory entries. Depends on E3 stage 3 normalization. Park until Kitchen pulls for it.

---

## Recommended order (mirrors file 2's bets, refined)

```
E4 (rehearses the bridge pattern, small)
  → E3 stage 1 (instant daily win)
  → E1 (the 10× core, after O1 tests)
  → E2 (the big unification, informed by E4)
  → E6/E7/E8 (ride on E1)
  → E5 · E9 opportunistic
```
