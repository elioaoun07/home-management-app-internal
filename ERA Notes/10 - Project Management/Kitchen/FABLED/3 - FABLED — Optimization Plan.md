---
created: 2026-06-10
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled
  - module/kitchen
---

# Kitchen · FABLED 3 — Optimization Plan

> **FABLED:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED — Current Implementation.md>) · [2 · Gaps](<2 - FABLED — Gaps & Missing.md>) · **3 · Optimization** · [4 · Enhancements](<4 - FABLED — Future Enhancements.md>)
>
> Hardening/perf/code-health for what already works. The domain rule from file 3 applies: the value is the loop — don't polish one tool in isolation.

---

## O1 — Cheap test wins on the pure surfaces

1. **Recipe scale math** — ratios, fraction handling, unit edge cases. Pure function territory; mirrors how `splitBill` got tested.
2. **Low-stock threshold logic** — pin the boundary semantics (at vs below threshold) *before* G1's auto-add trigger builds on it; an off-by-one here becomes duplicate shopping items.
3. **`extract-from-url` fixture corpus** — commit 3–4 saved recipe-page HTML files + expected structured output. Catches both parser and prompt drift. Do this *before* touching the extraction prompt again.

## O2 — Make the AI routes uniformly safe

One pass over `generate` / `optimize` / `scale` / `substitute` / `extract-from-url`: confirm each client call passes a long `timeoutMs` (Hard Rule 6 — a 3 s default kill here falsely flags offline), confirm `lib/ai/rateLimit.ts` covers them, and return structured errors (not 500s) when Gemini output fails validation. Half a day; protects the most expensive calls in the domain.

## O3 — Carve the shopping seams out of `ShoppingListView.tsx` (107 KB)

When gap-2a lands (it will touch this file): extract the **list-item add/dedupe logic** into `src/lib/shopping/` pure functions first, so the auto-add trigger and the manual add share one code path and the idempotency rules (G1) are testable. Don't attempt a full component split in the same change as the feature.

## O4 — Decide stock-mutation invariants once

`stock/[itemId]`, `restock`, and (future) cook-deduction all mutate the same counts. Centralize the invariant set — never below zero, history row per change, threshold check after every write — in one `src/lib/inventory/stock.ts` used by all three routes. This is the substrate that makes G1/G2/G7 safe to build.

## O5 — Meal-plan read-model for time surfaces

For G4: expose planned meals as a read-only projection (a `getMealsForRange()` lib function or a view), consumed by calendar/today/ERA. No schema change, no write path — keep it a projection so Meal Planning stays the single owner of the fact.

## O6 — Document the two intentional oddities

Five-minute vault-doc updates that prevent future mis-fixes:
1. Shopping List's legacy localStorage queue is **sanctioned** (already in CLAUDE.md — repeat it in the Shopping List vault doc's header).
2. Inventory **deliberately has no route** and mounts inside Catalogue (if confirmed intentional — G5).

---

### Sequencing

```
O1.2 threshold tests → O4 stock invariants → G1 auto-add (the keystone)
  → O3 shopping seams (with G1) → G2 cook-deduction (uses O4)
O1.3 fixtures before any extraction-prompt change · O2 one pass anytime · O5 with G4 · O6 now (5 min)
```
