---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - module/trips
---

# Trips · FABLED 2.2 — Gaps & Missing

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · **2 · Gaps** · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>) · v1 baseline: [FABLED/2](<../FABLED/2 - FABLED — Gaps & Missing.md>)
>
> Delta ledger: **all seven v1 gaps carried unchanged.** Rather than re-argue them, this file adds what a month of stasis changed about each — and one new gap about the stasis itself.

---

## 🔴 G1 — Cascades still never run end-to-end (carried v1-G1; 5th week)

v1's checklist remains the definition of done (household round-trip · solo round-trip · ledger symmetry · `recurring_payments` untouched both directions). Two **additions** to that checklist from June's environmental drift:

- [ ] Mid-trip manual reassignment: partner "returns" a solo-trip item via the new pass/take-back UI, then `complete_trip` runs — reversal must not double-flip or error.
- [ ] Trip-account creation against the June accounts semantics: created account respects `visible`/`is_public` expectations and appears correctly in `useHouseholdAccounts` surfaces.

**New deadline argument:** verify *before* Schedule Stage 2 rewires pause-masking, or every future pause bug is a two-module dig ([file 1 §2](<1 - FABLED 2 — Current Implementation.md>)).

## 🔴 G2 — RPC bodies exist nowhere in the repo (carried v1-G2)

Still zero matches for `activate_trip`/`complete_trip` in `migrations/` (verified 2026-07-02). The excuse expired: Schedule proved the snapshot workflow (`get_schedule_bundle` + 13 policies now live in `schema.sql`). Thirty minutes in the SQL Editor separates the module's core logic from unrecoverable.

## 🟠 G3 — No ledger-symmetry guard (carried v1-G3)

Unchanged; the saved SQL assertion in [file 3 · O3](<3 - FABLED 2 — Optimization Plan.md>) is still unwritten.

## 🟠 G4 — Cascades invisible to the user (carried v1-G4)

Unchanged — and Schedule's FABLED 2 now offers a shared solution: ghost "paused — travelling" rows ([Schedule FABLED 2.4 · E11](<../../Schedule/FABLED 2/4 - FABLED 2 — Future Enhancements.md>)) double as the cascade-transparency surface. Build once, both modules gain trust.

## 🟡 G5 — Account-creation duplication (carried v1-G5, risk raised)

The Budget-side original changed in June (visibility semantics, RLS fix); the Trips copy didn't. The two now *definitely* differ in assumptions even if they still agree in effect — exactly the drift v1 predicted. The shared-function fix still lives on whichever side is touched first.

## 🟡 G6 — Clone semantics unconfirmed (carried v1-G6)

Unchanged; fold into the G1 session (one clone + row inspection).

## ⚪ G7 — No re-entry awareness (carried v1-G7)

Unchanged; remains the natural ERA consumer once the ledger is trusted.

## 🟠 G8 — The module has no honest status (new — the meta-gap)

Trips has been "verify deferred by choice" for five consecutive weeks across three planning documents. That's no longer a deferral; it's an undeclared freeze. The gap is the *pretense of active status*: roadmaps keep sequencing enhancements behind a verification that keeps not happening, and the FAR's modes-engine bet (J2) silently waits on it. **Close it either way:** book the O1+O2 session this month, or write "Trips is frozen until [trigger]" in the campaign [Feature State](<../1 - Feature State.md>) — an honest freeze costs nothing and stops the weekly re-deferral tax. What it must not remain is permanently-pending.
