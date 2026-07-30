---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - module/trips
---

# Trips · FABLED 2.3 — Optimization Plan

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · **3 · Optimization** · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>) · v1 baseline: [FABLED/3](<../FABLED/3 - FABLED — Optimization Plan.md>)
>
> v1's plan was right; execution was zero. It carries forward with the June-drift additions folded in. The sequencing is not negotiable: O1 before everything, because you cannot verify (O2) what you cannot read (the RPC bodies).

---

## O1 — Recover the RPC bodies (carried v1-O1; 30 minutes, do first)

```sql
SELECT pg_get_functiondef(oid) FROM pg_proc
WHERE proname IN ('activate_trip','complete_trip');
```

→ save verbatim as `migrations/2026-07-XX_trips_rpc_snapshot.sql` (marked snapshot, per Hard Rule #24's format) and fold the definitions into `schema.sql` the way `get_schedule_bundle` already is. From then on every cascade edit is a reviewable diff. The precedent exists; this is now copy-work.

## O2 — Run the G1 verification session (carried v1-O2, checklist extended)

v1's setup stands: throwaway trip, 1 chore + 1 recurring event + 1 one-time event + 1 meal plan, household mode then solo. Use the [file 2 · G1](<2 - FABLED 2 — Gaps & Missing.md>) checklist **including the two June additions** (mid-trip manual reassignment; account semantics under the new visibility rules). Inspect `trip_side_effects` after each step — the ledger inspection *is* the verification. Record results in the campaign [Feature State](<../1 - Feature State.md>) (flip the "unverified" rows); log failures as pains per Hard Rule #25.

## O3 — Ledger-symmetry assertion (carried v1-O3)

Commit the saved SQL check next to the verification notes; adjust to the real reversal-marking column once O1 exposes the ledger shape. Run after every future cascade change — it's the module's regression test until real test infra reaches the DB.

## O4 — Re-diff the account-creation copy (carried v1-O4, now urgent-adjacent)

After O1, diff the trip-account insert block against the *current* accounts route (post-June semantics). Two outcomes: they still agree → note it in the vault doc with the date; they don't → extract the shared `src/lib` creation function now rather than "whichever side is touched first" (the drift v1 tolerated has actually occurred — [file 2 · G5](<2 - FABLED 2 — Gaps & Missing.md>)).

## O5 — Activate/complete UX guards (carried v1-O5; after O2)

Double-activation guard (30 s RPC, two taps must not fire twice — confirm idempotency or disable the button) · timeout distinct from failure (a timed-out activation may have half-applied; the user must know to *check*, not retry).

## O6 — The freeze decision (new; zero engineering)

If O1+O2 don't get booked this month, execute [file 2 · G8](<2 - FABLED 2 — Gaps & Missing.md>): one paragraph in the campaign Feature State declaring Trips frozen until a named trigger (e.g., "next real trip planned" or "Schedule Stage 2 complete"). Freezing is a legitimate PM outcome; rolling deferral is not.

---

### Sequencing

```
O1 (30 min) → O2 (one session, extended checklist) → O3 (commit the tripwire)
  → O4 (re-diff) → O5 (UX guards) → only then anything in file 4
O6 fires automatically if O1/O2 miss the month
```
