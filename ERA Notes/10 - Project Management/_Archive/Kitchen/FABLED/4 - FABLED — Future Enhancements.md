---
created: 2026-06-10
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled
  - module/kitchen
---

# Kitchen · FABLED 4 — Future Enhancements

> **FABLED:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED — Current Implementation.md>) · [2 · Gaps](<2 - FABLED — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED — Optimization Plan.md>) · **4 · Enhancements**
>
> The 10× ideas with the implementation seam each would use. The domain's enhancements are *links*, not tools — each one closes a loop edge from [file 1 §4](<1 - FABLED — Current Implementation.md>).

---

## E1 — Self-driving shopping list ⭐ (gaps 2a + restock loop)

**Impact: High (daily felt) · Effort: M · Prereq: O4 stock invariants**

Stage 1 = the keystone trigger (low stock → auto-add, idempotent). Stage 2 = the return path: checking off a grocery item offers one-tap restock (+ quantity). Stage 3 = cadence learning — restock history predicts "you buy milk every 9 days" and pre-adds before you run out. Each stage ships alone.

## E2 — Cooking that updates reality (gap 2b)

**Impact: High · Effort: M–H (matching is the hard part)**

Cooking mode ends with a "pantry update" confirmation card: matched ingredients pre-checked with quantities, unmatched ones skippable. Matching layer (ingredient name ↔ inventory item) is the reusable hard piece — build it once, E1 stage 2 and E5 reuse it. Never silently deduct.

## E3 — Pantry-aware everything

**Impact: High · Effort: M (after E2's matcher)**

The same matcher inverted: recipe list shows "can make now / missing 2," cooking mode flags out-of-stock before you start, and the **chef face** answers "what can I make tonight?" from real stock. This is the moment Kitchen starts feeling intelligent rather than organized.

## E4 — Budget-aware meal planning (gap 2c)

**Impact: Med–High · Effort: M · Blocked by: price-source decision (G3)**

Recommended seed: manual price on inventory staples (cheapest to ship), upgraded later by statement-import line items (Budget FABLED E9). Weekly plan shows estimated cost; ERA's briefing can say "this week's plan ≈ $85, $20 over your groceries envelope."

## E5 — Smart leftovers & waste tracking

**Impact: Med · Effort: M**

Cooking log already records what/when. Add servings-made vs servings-eaten and expiry hints on fresh inventory → "eat the chicken by Thursday" nudges via ERA. Differentiating feature most apps lack; rides on E2's data.

## E6 — Meal plans on the time surfaces (G4)

**Impact: Med · Effort: S–M**

The `getMealsForRange()` projection (O5) consumed by calendar, today view, and ERA's morning briefing ("Pasta tonight — defrost the sauce"). Cheapest visible win in this file.

## E7 — Barcode → catalogue price + receipt OCR

**Impact: Med · Effort: M–L**

Barcode lookup already exists; tie scans to catalogue product prices, then (further out) receipt photos feed both restock (E1) and price observations (E4). Park until E1/E4 exist.

## E8 — Kitchen signals into the ERA briefing composer

**Impact: High · Effort: S once Hub FABLED E1 exists**

`getKitchenBriefingSignals()`: low-stock staples, tonight's plan, expiring items (E5), cost vs envelope (E4). The chef face + `useChefSummary` already prove the read pattern — this is mostly plumbing into the composer.

---

## Recommended order

```
E6 (cheap visibility) → E1 stage 1 (keystone) → E2 (matcher) → E3 (rides matcher)
  → E4 after the price-source decision → E1 stages 2–3 → E8 when the composer exists → E5/E7 later
```
