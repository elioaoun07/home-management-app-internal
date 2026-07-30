---
created: 2026-06-10
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled
  - module/trips
---

# Trips · FABLED 3 — Optimization Plan

> **FABLED:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED — Current Implementation.md>) · [2 · Gaps](<2 - FABLED — Gaps & Missing.md>) · **3 · Optimization** · [4 · Enhancements](<4 - FABLED — Future Enhancements.md>)
>
> Hardening only — the module is too new for perf work, and the file-2 rule stands: no enhancements until verification lands.

---

## O1 — Recover the RPC bodies into the repo (do before anything else, 30 min)

In Supabase SQL Editor: `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname IN ('activate_trip','complete_trip');` → save verbatim as `migrations/2026-06-XX_trips_rpc_snapshot.sql` (per Hard Rule #24's format, marked as a snapshot, not a change). From then on, every cascade edit is a diff against a file instead of archaeology. Do the same for `get_schedule_bundle` in the same file or a sibling (it has the identical problem — [Schedule FABLED O4](<../../Schedule/FABLED/3 - FABLED — Optimization Plan.md>)).

## O2 — Run the G1 verification round-trips (the deferred item — one focused session)

Use the checklist in [file 2 · G1](<2 - FABLED — Gaps & Missing.md>) verbatim. Practical setup: a throwaway "Test trip" with 1 chore, 1 recurring event, 1 one-time event, 1 meal plan, both modes (household, then solo). Inspect `trip_side_effects` rows after each step — the ledger inspection *is* the verification. Record results in [file 1](<../1 - Feature State — Current Reality.md>) (flip the "unverified" notes) and log any failure as a pain entry per Hard Rule #25.

## O3 — Ledger-symmetry assertion (cheap tripwire for G3)

A saved SQL check (commit it next to the verification doc):

```sql
-- after completing trip :id — both counts must match
SELECT (SELECT count(*) FROM trip_side_effects WHERE trip_id = :id)
     = (SELECT count(*) FROM trip_side_effects WHERE trip_id = :id AND reversed_at IS NOT NULL);
```

(Adjust to the actual reversal-marking column once O1 exposes the real ledger shape — that's the point of doing O1 first.) Run it after every future cascade change.

## O4 — Unify account creation with Budget

The shared `src/lib` account-creation function (Budget FABLED O4) — do it from whichever side is touched first; this file just keeps the pointer so a Trips session doesn't fork the logic further.

## O5 — Activate/complete UX guards

Small client-side hardening once verification passes: disable double-activation (two taps on a slow 30 s RPC must not fire twice — confirm the RPC is idempotent or guard the button), and surface RPC failure *distinctly* from timeout (a timed-out activation may have half-applied — the user must know to check, not retry blindly).

---

### Sequencing

```
O1 (recover bodies — 30 min, prerequisite for everything)
  → O2 (the verification session) → O3 (commit the tripwire)
  → only then any file-4 enhancement · O4 opportunistic · O5 after O2
```
