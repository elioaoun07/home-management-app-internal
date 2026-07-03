---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - module/schedule
---

# Schedule · FABLED 2.2 — Gaps & Missing

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · **2 · Gaps** · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>) · v1 baseline: [FABLED/2](<../FABLED/2 - FABLED — Gaps & Missing.md>)
>
> Re-ranked 2026-07-02, with v1 lineage on every carried gap.

---

## Delta ledger — what happened to v1's gaps

| v1 | Verdict 2026-07-02 |
|---|---|
| G1 occurrence-action logic untested | **Half-closed** — `dayOccurrences.test.ts` covers skip/complete/move math; route-level exception/pause interplay still uncovered; and the fix exposed the deeper issue: three engines (→ G1) |
| G2 task-type retirement half-applied | **Open, unchanged** (→ G4) |
| G3 prerequisite evaluator stubs | **Open** — evaluator files exist (`time-window.ts`, `schedule.ts`, `custom-formula.ts`, `weather.ts`) but remain inert stubs per the vault doc (→ G5) |
| G4 dead `MobileItemForm.tsx` | **Open — third flag** (→ G3) |
| G5 bundle partner-private blind spot | **Open, parked deliberately** (→ G6) |
| G6 duplicate RLS policy generations | **Open, parked** (→ G7) |
| G7 no bulk ops / overdue triage | **Open** (→ G8) |
| G8 week shape not exported | **Open — now the biggest outward gap by a widening margin** (→ G9) |
| G9 stale PM claims | **Closed** (delta ledger institutionalized) |

## 🔴 G1 — Three engines, one truth (carried v1-G1, promoted to the defining gap)

Stage 1 fixed the *actions*; the *expansion* is still forked three ways ([file 1 §2](<1 - FABLED 2 — Current Implementation.md>)). Consequences verified in June: an edited/paused/moved occurrence renders correctly on the calendar and wrongly on `/reminders`/Today, because only the inline engine speaks the full exception dialect. Every new surface must pick an engine, and history says it picks wrong. **This is no longer a test gap — it's an architecture debt with a decided target (Google/Outlook model) and no started migration.**

## 🔴 G2 — The suite is red and everyone is learning to live with it (new)

`pnpm test` on main: 92/93, the placement-rule guard failing since ~06-19 because it greps source text that a legitimate refactor moved. A permanently red suite destroys the only cheap signal the app has: today a *real* regression would look identical to the known failure. Fix is one behavioral test ([file 3 · O1](<3 - FABLED 2 — Optimization Plan.md>)) — the cost of leaving it red compounds daily.

## 🟠 G3 — `MobileItemForm.tsx` survives its third flagging (carried v1-G4)

1,363 lines, zero importers, already cost one mis-aimed refactor pass (memory + v1 + this file). Deletion is 15 minutes. At this point the gap isn't the file — it's that **flagged hygiene work has no execution slot** in the weekly cadence; the same pattern shows in Budget's debug routes ([Budget FABLED 2.2 · G2](<../../Budget/FABLED 2/2 - FABLED 2 — Gaps & Missing.md>)) and the empty `blink/`/`today/` dirs ([PM FABLED 2](<../../FABLED 2/2 - FABLED 2 — Gaps & Missing.md>)).

## 🟠 G4 — Task-type retirement still half-applied (carried v1-G2)

UI says Reminder/Event; DB + API still accept `task`. Fine while tracked — but June added new surfaces (planner, Assign tab, bulk convert) and each had to *know* the convention informally. The tripwire test (v1-O7) was never added.

## 🟡 G5 — Prerequisite evaluators: files now exist, behavior still doesn't (carried v1-G3)

`src/lib/prerequisites/evaluators/` now has one file per evaluator type — the *structure* for finishing them landed, the semantics didn't. `time_window` remains the named first ship. The form still stores `location_context: "home"` that nothing consumes (the arrive-home trigger is [file 4 · E3](<4 - FABLED 2 — Future Enhancements.md>)).

## 🟡 G6 — Bundle blind spot: partner-private `responsible=me` (carried v1-G5)

Unchanged, parked. Becomes non-parkable the day assignment can happen outside the picker (bulk convert and NL capture are creeping toward that). Fix in a migration now that the RPC body lives in `schema.sql`.

## 🟡 G7 — Duplicate RLS policy generations (carried v1-G6)

Unchanged. Cleanup only alongside deliberate auth work, verification run both sides.

## 🟡 G8 — No bulk occurrence ops / overdue triage (carried v1-G7)

Unchanged; the planner's collapsed-overdue section made overdue *visible* but still one-tap-at-a-time.

## 🟠 G9 — The week's shape still isn't exported (carried v1-G8, escalated)

Everything else matured around this hole: Budget can now forecast, Kitchen knows low stock, Plan My Day captures intent — and ERA still can't answer "how heavy is Thursday?" because no `getWeekShape()` read-model exists. Every sibling FABLED 2 file 4 lists a consumer for it. It is the single highest-leverage unbuilt function in the app.

## ⚪ G10 — `day_plans.intent` is captured and ignored (new)

The planner stores rest/productivity intent per day; nothing reads it. Cheap to consume ([file 4 · E9](<4 - FABLED 2 — Future Enhancements.md>)); costless to keep — but don't let a redesign delete the column before its consumer ships.
