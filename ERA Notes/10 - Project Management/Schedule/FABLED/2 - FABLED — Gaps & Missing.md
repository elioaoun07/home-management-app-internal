---
created: 2026-06-10
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled
  - module/schedule
---

# Schedule · FABLED 2 — Gaps & Missing

> **FABLED:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED — Current Implementation.md>) · **2 · Gaps** · [3 · Optimization](<3 - FABLED — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED — Future Enhancements.md>)
>
> Ranked. The UX-level pains live in the [Pain Inventory campaign](<../Pain Inventory & Plan/1 - Pain Inventory (Every Painful Thing).md>) — this file is the *technical* absence list; don't duplicate the campaign here.

---

## 🔴 G1 — Occurrence-action logic has no tests (the remaining half of the foundation)

Expansion is now tested (`expandOccurrences.test.ts` ✅) and the placement rule is guarded ✅ — but **complete/postpone/skip at the occurrence level** (`item_occurrence_actions` + `item_recurrence_exceptions` interplay) is still uncovered. This is the trickiest remaining logic: an action on occurrence N must not affect N+1, exceptions must suppress alerts (`item_alert_suppressions`), and pauses (`recurrence_pauses` — which **Trips writes to**) must mask correctly. A silent bug here mis-marks household obligations.

## 🔴 G2 — Task-type retirement is half-applied

UI says Reminder/Event only; **DB + API + other surfaces still know `task`** (global retirement deliberately deferred). This is a *tracked inconsistency* — fine while deliberate, dangerous when forgotten: any new surface or AI prompt that enumerates types must follow the UI taxonomy, not the DB enum. Closes only with the dedicated retirement session (campaign file 6).

## 🟠 G3 — Three prerequisite evaluator stubs (+1 deprioritized)

Engine works for NFC; `time_window`, `schedule`, `custom_formula` are inert stubs (`weather` consciously last). `time_window` is the smallest and already the named next step in [file 3](<../3 - Current — Action Plan.md>). Also pending from the form direction: "when I get home" currently stores `location_context: "home"` — the **NFC arrive-home trigger that should consume it is Phase 2** and doesn't exist yet.

## 🟠 G4 — Dead code with gravity: `MobileItemForm.tsx`

49 KB, zero importers, already cost one full mis-aimed refactor. Highest-priority *deletion* in the module (with a grep for stragglers). Until deleted it remains a trap for every future session and tool.

## 🟠 G5 — Bundle blind spot: partner-private `responsible=me` items

`get_schedule_bundle` doesn't surface items a partner assigned to me when marked private (parked drift, RLS memory). Visible as "my partner says they assigned it, I don't see it." Needs an RPC-body fix — **in a migration file**, since RPC bodies aren't in the repo export.

## 🟡 G6 — Duplicate RLS policy generations on the items tables

Live DB carries old + new policy generations per table (parked drift from the May verification). Harmless until someone edits the wrong generation. Cleanup = one migration; do it alongside the next auth-touching change, with `_verify_schedule_rls.md` re-run before/after.

## 🟡 G7 — No bulk occurrence operations / overdue triage

One-at-a-time complete/postpone/skip; overdue fixed items just sit. (File 2 Track A items — backlog, not building now.)

## 🟡 G8 — The week's shape isn't exported anywhere

ERA/Focus read shallow slices; there is no `getWeekShape()`-style read model (per-person load, overdue streaks, free evenings). This is Schedule's end of the briefing bridge — the module's biggest outward gap.

## ⚪ G9 — Stale PM claims (corrected 2026-06-10)

Parent file 1 said RRULE "math untested" — expansion now has tests; the *actions* half (G1) is what remains. Parent file updated this session; recorded so the next audit doesn't re-litigate.
