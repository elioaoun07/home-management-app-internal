---
created: 2026-06-10
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled
  - module/trips
---

# Trips · FABLED 2 — Gaps & Missing

> **FABLED:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED — Current Implementation.md>) · **2 · Gaps** · [3 · Optimization](<3 - FABLED — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED — Future Enhancements.md>)
>
> Ranked. One gap dominates everything: until G1 closes, every other line in this folder is theoretical.

---

## 🔴 G1 — The cascades have never been run end-to-end

The defining gap since ship day (deferred by choice 2026-05-30; still open). What "verified" concretely means — the checklist that closes this:

**Household trip round-trip:**
- [ ] Activate → chores skipped · recurring events paused (`recurrence_pauses` rows exist) · one-time events cancelled · meal plans skipped · account created · **every one of those logged in `trip_side_effects`**
- [ ] Schedule views show paused items correctly *during* the trip (pauses must mask occurrences — interacts with `expandOccurrences`)
- [ ] Complete → every logged effect reversed · nothing extra reversed · account remains
- [ ] `recurring_payments` untouched in both directions (the deliberate rule)

**Solo trip round-trip:**
- [ ] Activate → traveler's items flipped to partner (`responsible_user_id`) · meal plans untouched
- [ ] Partner actually *sees* the reassigned items (cross-check [Schedule FABLED G5](<../../Schedule/FABLED/2 - FABLED — Gaps & Missing.md>): the bundle's partner-private blind spot could make a reassigned item invisible — the two bugs would compound)
- [ ] Complete → reassignment reversed

**Both:** ledger symmetry — count of effects logged at activation == count reversed at completion.

## 🔴 G2 — The RPC bodies exist nowhere in the repo

`activate_trip()` / `complete_trip()` (and `get_schedule_bundle`) live only in the live DB; the migrations folder retains no dated files, and CLAUDE.md's own reference to `migrations/2026-05-11_schedule_bundle_rpc.sql` points at a file that **no longer exists**. A DB restore, a fat-fingered `DROP FUNCTION`, or an undocumented edit loses or forks the module's core logic with no diff trail. (Fix: [file 3 · O1](<3 - FABLED — Optimization Plan.md>); flagged app-wide in [6 · Optimized Claude Setup Structure](<../../6 - Optimized Claude Setup Structure.md>).)

## 🟠 G3 — No ledger-symmetry guard

Nothing asserts "logged == reversed." A new cascade added to `activate_trip` without its reversal in `complete_trip` fails silently as a half-travelled household — the worst-feeling bug class in the app. Closable with one SQL assertion run after any round-trip (or a pgTAP-style test if test infra ever reaches the DB).

## 🟠 G4 — Cascades are invisible to the user

`trip_side_effects` is internal; nothing shows "what did this trip change / what will completion restore." Skipped chores are *silently absent* rather than "paused: travelling," and meal-skips are invisible on the calendar. Transparency is both a UX feature and the manual verification tool for G1 — build them together ([file 4 · E1](<4 - FABLED — Future Enhancements.md>)).

## 🟡 G5 — Account-creation logic duplicated with Budget

Direct inserts mirroring the accounts route ([file 1 §2](<1 - FABLED — Current Implementation.md>)). Tracked as Budget FABLED G6/O4 — the shared-function fix lives on the Budget side; noted here so a Trips session doesn't re-solve it differently.

## 🟡 G6 — Clone semantics unconfirmed

Template clone should copy places + packing and never side-effects — believed true, never confirmed. One manual clone + row inspection closes it (fold into the G1 session).

## ⚪ G7 — No re-entry awareness

Nothing tells anyone "trip ends tomorrow; 3 chores and 2 routines resume." The ERA re-entry briefing ([file 4 · E3](<4 - FABLED — Future Enhancements.md>)) is the natural consumer of the ledger once trusted.
