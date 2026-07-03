---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - module/kitchen
---

# Kitchen · FABLED 2.4 — Future Enhancements

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · **4 · Enhancements** · v1 baseline: [FABLED/4](<../FABLED/4 - FABLED — Future Enhancements.md>)
>
> v1's ladder (E1–E8) survives intact; E9–E11 are new. Kill criteria added throughout — Kitchen has the app's highest risk of building tools instead of links.

---

## E1 — Self-driving shopping list ⭐ (carried v1-E1)

**Impact: High daily · Effort: M · Prereq: O2 invariants.** Stage 1 keystone trigger → Stage 2 check-off offers restock → Stage 3 cadence learning ("milk every 9 days") pre-adds. Each stage ships alone.
**Kill criterion:** Stage 3 only if Stage 2 restock data accumulates ≥1 month of real use — cadence learned from sparse data annoys more than it helps.

## E2 — Cooking that updates reality (carried v1-E2)

**Impact: High · Effort: M–H.** The matcher (ingredient ↔ inventory item) is the hard, reusable piece; confirmation card, never silent. **Kill criterion:** if matching accuracy on your own recipes is <70% after a week of tuning, flip the model — let cooking mode ask "what did you use up?" with fuzzy suggestions instead of pre-matching.

## E3 — Pantry-aware everything (carried v1-E3; rides E2's matcher)

"Can make now / missing 2" on the recipe list; chef face answers "what can I make tonight?" from real stock. The moment Kitchen feels intelligent.

## E4 — Budget-aware meal planning (carried v1-E4; unblocked by the price-seed decision)

Manual price on staples first; statement observations upgrade later (Budget's `normalizeMerchant` halved that path). Weekly plan shows estimated cost; ERA says "this week's plan ≈ $85, $20 over the groceries envelope."

## E5 — Leftovers & waste tracking (carried v1-E5)

Servings made vs eaten + expiry hints → "eat the chicken by Thursday." Rides E2's data. **Kill criterion:** if E2's confirmation step gets skipped in practice, this has no data — don't build on a habit that didn't form.

## E6 — Meals on the time surfaces (carried v1-E6 — now the cheapest visible win in the whole app)

**Impact: Med–High · Effort: S.** `getMealsForRange()` (O6) rendered as read-only rows in `WebDayPlanner` + calendar. The planner's injection pattern already exists; this is one data source away. Do it before the keystone if a small win is needed to restart the domain.

## E7 — Barcode → price + receipt OCR (carried v1-E7; park)

Unchanged: after E1/E4.

## E8 — Kitchen signals into the briefing composer (carried v1-E8)

`getKitchenBriefingSignals()`: low-stock staples, tonight's plan, expiring items, cost vs envelope. Mostly plumbing once the composer exists ([Hub & ERA FABLED 2.4 · E1](<../../Hub & ERA/FABLED 2/4 - FABLED 2 — Future Enhancements.md>)).

## E9 — The pantry report (new — `AnalysisReport` pattern, first non-Budget adopter)

**Impact: Med · Effort: S once the pattern doc exists**

"How's the kitchen?" → precomputed inputs (stock levels, expiry, cadence gaps, this week's plan coverage) → schema-constrained Gemini + deterministic fallback → markdown + ephemeral dashboard. Proves Budget's E6 generalization claim on a second domain, and gives the chef face its first *composed* answer instead of single-intent lookups.
**Kill criterion:** if it needs >30% new plumbing beyond Budget's pattern, the pattern isn't ready — feed that finding back to [Budget FABLED 2.4 · E6](<../../Budget/FABLED 2/4 - FABLED 2 — Future Enhancements.md>) and wait.

## E10 — Unit canonicalization service (new — the quiet enabler)

**Impact: Med (unlocks E2/E4 accuracy) · Effort: S–M**

One pure `src/lib/kitchen/units.ts`: g↔kg↔lb, ml↔l↔cups, "1 pack" declarations per inventory item. Every ❌ loop link that touches quantities (deduction, restock amounts, price-per-unit) currently hand-waves units; canonicalize once, test it like `splitBill`, and E2's matcher confidence jumps. Boring, foundational, an afternoon.

## E11 — Shopping trip mode (new — the list meets the store)

**Impact: Med · Effort: M**

When shopping starts (manual toggle or NFC tag on the cart hook): reorder list by learned per-store pick order (order items were historically checked off), big-tap rows, running total vs groceries envelope (via canonical `sumSpending` inputs), and a "3 proposals from low-stock" section on top. Ends with one-tap "log $X at Spinneys" → expense draft. Closes the physical-world loop the domain exists for.
**Kill criterion:** if check-off timestamps show no stable per-store order after 5 trips, drop the reordering and keep the totals + draft handoff.

---

## Recommended order

```
E6 (cheapest visible win) → E1 stage 1 (keystone) → E10 (units) → E2 (matcher)
  → E3 (rides matcher) → E4 (price seed) → E1 stages 2–3 → E8/E9 when composer/pattern exist
  → E11 after E1 · E5/E7 later
```
