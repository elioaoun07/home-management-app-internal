---
created: 2026-06-10
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled
  - module/schedule
---

# Schedule · FABLED 4 — Future Enhancements

> **FABLED:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED — Current Implementation.md>) · [2 · Gaps](<2 - FABLED — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED — Optimization Plan.md>) · **4 · Enhancements**
>
> Beyond the current pain campaign. Each idea names its seam. The campaign (capture UX) and this file (engine + bridges) should not collide in the same files simultaneously.

---

## E1 — `getWeekShape()` — Schedule's gift to ERA ⭐

**Impact: High (the moat's spine) · Effort: M · Prereq: O1 tests**

One read-model function over the bundle: per-person counts by day, overdue routines + streaks, upcoming recurring (incl. paused-by-trip), free evenings. Consumed by the ERA briefing composer (Hub FABLED E1), the Focus page, and the weekly digest. Build it as a pure transform over `get_schedule_bundle` output so it's testable like `expandOccurrences`.

## E2 — `time_window` prerequisite → conditional automation proven

**Impact: High demo value · Effort: S–M (already the action plan's "Next")**

"Show meds 7–9am" — the smallest stub, proves the dormant→pending engine end-to-end. Then `schedule` ("after gym → log meal") reuses the pattern; `custom_formula` only if a real use case appears; `weather` stays last.

## E3 — Arrive-home trigger (closes the capture promise)

**Impact: High (felt magic) · Effort: M**

`location_context: "home"` is already being captured by the form; nothing consumes it. NFC tag at the door (tap-on-arrival) → prerequisites engine wakes `location_context` items. Pairs with the Capacitor-shell decision memory (NFC friction is the trigger to revisit the shell).

## E4 — Overdue triage + roll-forward

**Impact: Med–High (daily friction) · Effort: M**

One triage surface for everything overdue with three verbs: do-today, slot-into-week (suggested via E1's free-evening data), let-go (skip with exception). Flexible items already have look-back semantics; this generalizes the idea to fixed items.

## E5 — Recurrence edit UX completion ("this / this-and-future / all")

**Impact: Med · Effort: S–M (audit first)**

`RecurringEditChoiceDialog` + `EditScopeDialog` already exist — audit which edit/delete paths bypass them, then close the holes. Likely cheaper than file 2 assumes; mostly a coverage problem, not a build.

## E6 — Bulk occurrence operations

**Impact: Med · Effort: M · Prereq: O1**

Multi-select on list/calendar → bulk complete/postpone/skip, riding the tested `applyOccurrenceAction` (every bulk op = N tested single ops in one transaction).

## E7 — Schedule ↔ Budget due-date unification (receiving end)

**Impact: High · Effort: H · Coordinate with [Budget FABLED 4 · E2](<../../Budget/FABLED/4 - FABLED — Future Enhancements.md>)**

Budget owns the fact; Schedule renders the projection — recurring payments appear as virtual occurrences (the flexible-injection pattern proves views can host non-rrule rows). Rehearse with the small Debt→Reminder bridge first (Budget E4).

## E8 — NL capture, second pass

**Impact: Med · Effort: M**

`smartTextParser.ts` (~1,420 lines) already handles dates/times/RRULE/priority. The gap is *trust UX*: show the parse as removable chips (the `manualOverrides` plumbing exists), so "every other Thursday 7pm" is visibly confirmed. Respect the standing signal — this must *reduce* visible controls, not add panels. Defer until the campaign's progressive-disclosure direction settles.

---

## Recommended order

```
E2 (proves automation) → E1 (the spine, after O1) → E3 (consumes captured context)
  → E5 audit (cheap) → E4 → E6 → E7 after Budget E4 rehearsal → E8 post-campaign
```
