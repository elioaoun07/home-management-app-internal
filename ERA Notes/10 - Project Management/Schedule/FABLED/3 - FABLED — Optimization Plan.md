---
created: 2026-06-10
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled
  - module/schedule
---

# Schedule · FABLED 3 — Optimization Plan

> **FABLED:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED — Current Implementation.md>) · [2 · Gaps](<2 - FABLED — Gaps & Missing.md>) · **3 · Optimization** · [4 · Enhancements](<4 - FABLED — Future Enhancements.md>)
>
> Hardening/perf/code-health. The active UX campaign owns the form work — this file owns the engine. Don't run both into the same file at the same time (`useItems.ts` is the collision point).

---

## O1 — Finish the pure-logic extraction (the proven pattern)

`src/lib/schedule/` already shows the way (`expandOccurrences` + test). Continue it for the untested half (G1):

1. Extract **occurrence-action resolution** (what does complete/postpone/skip on occurrence N actually write, and how do exceptions/pauses/suppressions compose) from `useItemActions.ts`/route code into `src/lib/schedule/applyOccurrenceAction.ts`.
2. Test the matrix: action × (recurring | flexible) × (exception exists | pause active | alert pending). ~20 table-driven cases kill the module's biggest remaining risk.
3. Same treatment later for alert resolution edge cases (`alertResolution.ts` exists; give it a test file).

## O2 — Delete `MobileItemForm.tsx` (and salt the earth)

Grep for any references, delete the file (49 KB), and remove it from the Feature Map's items module file if listed. The memory + FABLED note remain as the record. 15 minutes; permanently removes the module's worst trap.

## O3 — Shrink `useItems.ts` by subtraction, not refactor

81 KB. The rule stands — no gratuitous refactor — but two *subtractions* are safe wins whenever it's next open:
- Mutations already duplicated/superseded by `useItemActions.ts` (verify importers first).
- Pure helpers that belong in `src/lib/schedule/` (each move = one more testable unit, per O1).
Leave the query plumbing alone until the campaign's form work settles.

## O4 — RPC hygiene: bring `get_schedule_bundle` into the repo's light

The bundle body lives only in the live DB. Counter the blind spot: (1) commit the current body as a migration file (it's the runbook convention anyway), (2) fix G5 (partner-private responsible items) in that same migration, (3) re-run `_verify_schedule_rls.md` after. This also sets the precedent for every future RPC change.

## O5 — RLS policy-generation cleanup (with the next auth change)

Drop the stale duplicate policy generations (G6) in one migration, verify before/after. Never as a drive-by — only alongside intentional auth work, with the verification file run both sides.

## O6 — Cron/alert path audit (30–60 min)

The `item-reminders` cron is the module's only unattended writer: verify Hard Rule #8 compliance (`CRON_SECRET`, `supabaseAdmin()`, `maxDuration`), confirm soft-delete/archive deactivates alerts in all paths (file 1 names this as a watch-point), and confirm suppression rows actually block sends for cancelled occurrences. Findings → campaign pain inventory if any.

## O7 — Type-retirement guard (until the dedicated session)

Cheap tripwire for G2: a unit test (or zod refinement) asserting no *new* write path produces `type: "task"`. Prevents the half-retired taxonomy from regressing while full retirement waits.

---

### Sequencing

```
O2 (15 min, do first)  →  O1 (the foundation's second half)
  → O4 (one migration: body + G5 fix)  →  O5 with next auth work
O6 anytime · O7 cheap tripwire · O3 only when the file is already open
```
