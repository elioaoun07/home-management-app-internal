---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - module/kitchen
---

# Kitchen · FABLED 2.3 — Optimization Plan

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · **3 · Optimization** · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>) · v1 baseline: [FABLED/3](<../FABLED/3 - FABLED — Optimization Plan.md>)
>
> v1's plan was right and unexecuted — it carries forward intact, with the June patterns named so each item starts from precedent instead of a blank page.

---

## O1 — The two pure tests (carried v1-O1.1/O1.2; do first, <1 hour total)

1. **Low-stock threshold boundary** — pin at-vs-below semantics before the keystone builds on it. Mirror `splitBill.test.ts` in shape.
2. **Recipe scale ratios** — fractions, unit edges. Pure function, zero setup.

## O2 — Stock-mutation invariants in one place (carried v1-O4 — the keystone's substrate)

One `src/lib/inventory/stock.ts` used by `stock/[itemId]`, `restock`, and the future cook-deduction: never below zero · history row per change · threshold check after every write. This is where the keystone's trigger hooks in (server-side, post-write) — not in a route, not client-side.

## O3 — Extract shopping add/dedupe logic before the keystone lands (carried v1-O3)

`ShoppingListView.tsx` is 3,181 LOC; the auto-add must not become its 3,300th line. Pure functions in `src/lib/shopping/` (add, dedupe, idempotency identity) so manual add and auto-add share one path — and the idempotency rule gets a unit test. Respect the sanctioned legacy-queue rule; go through existing shopping-add APIs.

## O4 — Extraction fixture corpus (carried v1-O1.3; before any prompt change)

3–4 saved recipe-page HTML files + expected structured output, snapshot-tested. Add the `AnalysisReport`-style contract while there: schema-constrained response + tolerant Zod + structured error instead of 500 ([Budget FABLED 2.1 §3](<../../Budget/FABLED 2/1 - FABLED 2 — Current Implementation.md>) is the template).

## O5 — AI route safety pass (carried v1-O2)

One pass over `generate`/`optimize`/`scale`/`substitute`/`extract-from-url`: long `timeoutMs` on every client call (Hard Rule 6), `lib/ai/rateLimit.ts` coverage, structured errors. Half a day.

## O6 — `getMealsForRange()` projection (carried v1-O5; the G4 enabler)

Pure read-model over meal plans — no schema change, no write path. First consumer: `WebDayPlanner` day rows ([file 4 · E6](<4 - FABLED 2 — Future Enhancements.md>)). Second: ERA briefing. Keep Meal Planning the single owner of the fact.

## O7 — Document the two intentional oddities (carried v1-O6; 5 minutes, third listing)

Shopping List's legacy queue is sanctioned (repeat in its vault doc header) · Inventory deliberately has no route (confirm + one paragraph in the Inventory doc). Cheap enough that not-done is a choice.

---

### Sequencing

```
O1.1 threshold test → O2 stock invariants → G1 keystone (proposal-style, idempotent)
  → O3 shopping seams (with G1) → G2 cook-deduction (uses O2 + matcher)
O4 before any extraction-prompt touch · O5 one pass anytime · O6 with E6 · O7 now
```

Kill criterion: if the keystone session runs past a day, the scope crept — the trigger is a threshold check + a proposal insert, nothing more. Cadence learning, restock return-path, and matching all live in [file 4](<4 - FABLED 2 — Future Enhancements.md>), not in the wiring step.
