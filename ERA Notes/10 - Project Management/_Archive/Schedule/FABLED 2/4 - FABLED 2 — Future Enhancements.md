---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - module/schedule
---

# Schedule · FABLED 2.4 — Future Enhancements

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · **4 · Enhancements** · v1 baseline: [FABLED/4](<../FABLED/4 - FABLED — Future Enhancements.md>)
>
> Impact · effort · seam · kill criterion. E1–E8 carry v1 lineage (all still valid); E9–E11 are new.

---

## E1 — `getWeekShape()` ⭐ (carried v1-E1 — now blocking three other modules' roadmaps)

**Impact: Highest outward · Effort: M · Prereq: O3 stage 2 (build it on the canonical engine, not on a doomed one)**

Pure transform over the bundle: per-person load by day, overdue streaks, upcoming recurring (incl. paused-by-trip), free evenings, planned-meal slots (via Kitchen's projection). Consumers already queued: ERA briefing composer, Focus, weekly digest, Budget's E2 display, [E10](<#e10--schedule-pressure-index-new>) below.
**Kill criterion:** none. If Stage 2 stalls past August, build it on `dayOccurrences` and accept one rewrite — the consumers are worth it.

## E2 — `time_window` evaluator (carried v1-E2; the file already exists)

**Impact: High demo value · Effort: S** — `evaluators/time-window.ts` is scaffolded; give it semantics + one test. Proves dormant→pending end-to-end. Then `schedule` reuses the shape. **Kill criterion:** if no real item uses it within a month of shipping, stop the evaluator program at two and revisit demand.

## E3 — Arrive-home trigger (carried v1-E3)

**Impact: High felt magic · Effort: M** — NFC door tag → prerequisites engine wakes `location_context: "home"` items (already captured by the form, still consumed by nothing). Pairs with the Capacitor-shell trigger memory. **Kill criterion:** if NFC taps aren't yet a daily habit (per the shell decision), park — magic nobody triggers is dead code.

## E4 — Overdue triage & roll-forward (carried v1-E4)

**Impact: Med–High · Effort: M · After E1** (slot-into-week wants free-evening data). Three verbs: do-today, slot-into-week, let-go.

## E5 — Recurrence edit-scope audit (carried v1-E5)

**Impact: Med · Effort: S** — `RecurringEditChoiceDialog`/`EditScopeDialog` exist; audit which paths bypass them; close holes. Cheaper post-O4 when there's one action sheet.

## E6 — Bulk occurrence operations (carried v1-E6)

**Impact: Med · Effort: M · Prereq: O5** — each bulk op = N tested single ops in one transaction.

## E7 — Budget due-date unification, receiving end (carried v1-E7)

**Impact: High · Effort: H · Coordinate with [Budget FABLED 2.4 · E2](<../../Budget/FABLED 2/4 - FABLED 2 — Future Enhancements.md>)** — recurring payments as virtual occurrences (the flexible-injection pattern proves views host non-rrule rows). After Stage 2, this is one more injection source instead of a fourth engine.

## E8 — NL capture trust chips (carried v1-E8)

**Impact: Med · Effort: M** — show the parse as removable chips (`manualOverrides` plumbing exists). Must *reduce* visible controls. **Kill criterion:** if the capture campaign's progressive-disclosure direction changes the form again, wait it out.

## E9 — Intent-aware day planning (new — consume what June already captures)

**Impact: Med–High · Effort: S–M**

`day_plans.intent` (rest / productivity) is stored and unread ([G10](<2 - FABLED 2 — Gaps & Missing.md>)). Smallest consumer: the planner's suggestion order — rest day ⇒ propose moving flexible items out, surface fewer slots, celebrate emptiness; productivity day ⇒ pull overdue into free slots. One ranking function inside `WebDayPlanner`, no schema change, no AI required. Later, ERA phrases it ("light day planned — I left the evening clear").
**Kill criterion:** if you stop filling in intent within two weeks of the consumer shipping, the field was aspiration — remove both.

## E10 — Schedule pressure index (new)

**Impact: Med · Effort: S after E1**

One number per person per day (weighted: fixed items, routines due, overdue debt, meeting density) exposed from `getWeekShape()`. Consumers: planner header ("Thursday is your heaviest day"), ERA briefing, household fairness view ("this week: you 14, partner 9 — rebalance?"). The fairness angle is the novel household feature no calendar app has.
**Kill criterion:** if the weights need >3 tuning rounds to feel true, drop the single number and show the raw per-day counts instead.

## E11 — "Paused by trip" transparency rows (new; joint with Trips)

**Impact: Med · Effort: S · Joint with [Trips FABLED 2.4 · E1](<../../Trips/FABLED 2/4 - FABLED 2 — Future Enhancements.md>)**

When `recurrence_pauses` masks an occurrence, render a ghost row ("paused — Beirut trip") instead of silence. Doubles as the *visual verifier* for Trips' cascade correctness — two modules' trust problems, one small render change.

---

## Recommended order

```
E2 (small proof) → E1 (the spine, post-Stage 2) → E9 (cheap, uses stored data)
  → E10 + E11 (ride E1 / trip pauses) → E4 → E5/E6 → E7 (with Budget) → E8 post-campaign · E3 when NFC habit fires
```
