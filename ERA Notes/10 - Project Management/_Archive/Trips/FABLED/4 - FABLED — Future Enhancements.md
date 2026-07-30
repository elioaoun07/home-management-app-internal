---
created: 2026-06-10
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled
  - module/trips
---

# Trips · FABLED 4 — Future Enhancements

> **FABLED:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED — Current Implementation.md>) · [2 · Gaps](<2 - FABLED — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED — Optimization Plan.md>) · **4 · Enhancements**
>
> All of this waits behind verification (O2) — building on unverified cascades hides reversal bugs under features. Each idea names its seam; most consume the `trip_side_effects` ledger, which is why trusting it comes first.

---

## E1 — Trip impact panel ⭐ (transparency = trust = the verification tool)

**Impact: High · Effort: M · First after O2**

A panel on `TripDetail`: "this trip paused 4 events, skipped 6 chores, reassigned 3 items, created account X — completion will restore all of it," rendered straight from `trip_side_effects` (read-only — no new write path). Doubles as the permanent manual-verification surface; turns the riskiest module into the most legible one. Sub-pieces: chores show "paused: travelling" instead of vanishing; meal calendar shows skip ghosts.

## E2 — Per-cascade opt-out

**Impact: Med–High · Effort: M · Needs E1 first**

Toggles on `TripActivateSheet`: pause chores ✓ / keep meal plans ✗ … Stored as flags the RPC reads. Only meaningful once the user can *see* cascades (E1) — choice without visibility is noise. RPC change ⇒ goes through the O1 snapshot-diff workflow.

## E3 — ERA re-entry briefing

**Impact: High (felt magic) · Effort: S–M once the briefing composer exists**

"You're back tomorrow — 3 chores and 2 routines resume, trip spend was $412." A `getTripBriefingSignals()` over `trips` + ledger + trip account, plugged into the composer (Hub FABLED E1). The cheapest of the cross-module signals because the ledger already aggregates everything.

## E4 — Trip budget rollup

**Impact: Med–High · Effort: M**

The trip account exists and persists — surface it: spend-vs-budget during the trip, post-trip summary card, trip costs as a dimension in Analytics ("travel this year: $X"). Pure read-side; coordinates with Budget's analytics rather than new tables.

## E5 — Template library

**Impact: Med · Effort: M · After G6 clone-semantics confirmation**

Named templates (Weekend · Abroad · Business) seeding places + packing + (post-E2) cascade preferences. The clone API is the seam; this is mostly UI + a few template rows.

## E6 — Smart packing

**Impact: Low–Med · Effort: M–L (later)**

Packing list (already the module's biggest component at 32 KB) gets: reuse-from-last-trip, per-destination suggestions, weather-aware hints — the latter being the one genuine consumer for the Schedule `weather` prerequisite evaluator if it's ever built. Park until the module is trusted and used.

---

## Recommended order

```
O2 verification → E1 (transparency) → E3 (re-entry briefing, when composer exists)
  → E2 (opt-outs) → E4 (budget rollup) → E5 → E6
```
