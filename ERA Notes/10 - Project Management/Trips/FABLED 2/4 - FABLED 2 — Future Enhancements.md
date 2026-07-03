---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - module/trips
---

# Trips · FABLED 2.4 — Future Enhancements

> **FABLED 2:** [_index](<_index.md>) · [1 - Implementation](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · **4 · Enhancements** · v1 baseline: [FABLED/4](<../FABLED/4 - FABLED — Future Enhancements.md>)
>
> The v1 rule stands absolutely: **everything here waits behind verification (O2).** Building on unverified cascades hides reversal bugs under features. E1–E6 carry v1; E7–E8 are new.

---

## E1 — Trip impact panel ⭐ (carried v1-E1; first after O2)

**Impact: High · Effort: M** — "this trip paused 4 events, skipped 6 chores, reassigned 3 items, created account X; completion restores all of it," rendered read-only from `trip_side_effects`. Doubles as the permanent verification surface. Now half-shared with Schedule: the "paused — travelling" ghost rows are [Schedule FABLED 2.4 · E11](<../../Schedule/FABLED 2/4 - FABLED 2 — Future Enhancements.md>) — build the ledger panel here, the ghost rows there, one session together.

## E2 — Per-cascade opt-out (carried v1-E2; needs E1)

Toggles on `TripActivateSheet` stored as flags the RPC reads. Choice without visibility is noise — E1 first. RPC change ⇒ through the O1 snapshot-diff workflow.

## E3 — ERA re-entry briefing (carried v1-E3)

"Back tomorrow — 3 chores and 2 routines resume; trip spend $412." `getTripBriefingSignals()` over trips + ledger + trip account, into the composer ([Hub & ERA FABLED 2.4 · E1](<../../Hub & ERA/FABLED 2/4 - FABLED 2 — Future Enhancements.md>)). Cheapest cross-module signal because the ledger already aggregates everything.

## E4 — Trip budget rollup (carried v1-E4)

Spend-vs-budget during, summary card after, travel as an Analytics dimension. Pure read-side; the canonical `sumSpending` rule ([Budget FABLED 2.1 §1](<../../Budget/FABLED 2/1 - FABLED 2 — Current Implementation.md>)) now defines how to count it — don't invent a sixth spend definition here.

## E5 — Template library (carried v1-E5; after G6 confirmation)

Weekend · Abroad · Business seeding places + packing + (post-E2) cascade preferences.

## E6 — Smart packing (carried v1-E6; parked)

Reuse-from-last-trip → per-destination suggestions → weather hints (the one real consumer for the `weather` evaluator, if ever).

## E7 — The modes engine: Trips generalized (new — the FAR's J2, given its seam)

**Impact: High (architectural) · Effort: H · Strictly after O2+E1 prove the ledger**

Trips is secretly a **context-switch engine with a reversal ledger** — "travelling" is just one mode. The same machinery (activate → log side-effects → live differently → complete → reverse) models: **sick mode** (pause routines, lower chore expectations, notify partner), **guest mode** (meal plans scale up, privacy defaults flip), **crunch week** (flexible routines auto-defer, quiet hours widen). Implementation seam: extract the ledger walk + reversal into a generic `mode_side_effects` engine the trip RPCs become the first client of.
**Kill criterion:** if after E1 the household has activated fewer than ~3 real trips, the ledger isn't battle-tested enough to generalize — revisit next quarter. Never build the abstraction before the single case is trusted.

## E8 — Trip capture from the wild (new; small)

**Impact: Med · Effort: S–M** — a booking-confirmation email/screenshot shared to the PWA (share-target, FAR M2) → parsed proposal: trip dates, destination, template suggestion. Rides the capture-upgrade work, not a Trips build; listed here so the seam is owned.

---

## Recommended order

```
O2 verification → E1 impact panel (+ Schedule ghost rows jointly)
  → E3 re-entry briefing (when composer exists) → E2 opt-outs → E4 rollup
  → E5 templates → E7 modes engine (only after real-trip mileage) → E6/E8 opportunistic
```
