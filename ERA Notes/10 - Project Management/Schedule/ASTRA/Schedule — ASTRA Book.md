---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: active
owner: Elio
---

# Schedule — ASTRA Book

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../../ERA Top Layer — Master Plan (2026-09-02).md>), not a replacement roadmap. Evidence cutoff `3106164`; [Master Book](<../Schedule — Master Book.md>) updated 2026-07-30. Study only; no DB calls.

## Book delta

Master Book read end to end. Source delta since Jul30 over items/schedule/dayOccurrences/gcal/planner/prerequisites: `e1f149a 2026-08-27 ERA AI`, `05c698b 2026-08-27 ERA Init`, `1f604a8 2026-07-30 delivery sessions`.

The “suite still red because WebTodayView lacks is_flexible” claim is stale: `expandOccurrences.test.ts:99–114` now accepts delegation to `expandOccurrencesInRange`, which WebTodayView calls at111/122. Test execution is **NOT RUN** here; this is source correction, not a claim that every test passes. SCH-4.2's broader behavioral obligation remains open.

The “canonical engine imported by nothing” still describes production: source searches find `expandOccurrencesForRange` in its definition/tests, while Today, Planner and now ERA import `dayOccurrences`. Schedule's two user-facing recurrence systems remain distinct from the multiple **item** expansion implementations.

The Feature Map calls MobileItemForm dead and then routes “change mobile form” back to it. Overview lists retired StandaloneRemindersPage despite the Plan My Day doc recording deletion. Source maps need Phase5 correction. No deletion is authorized by this study.

## Re-scored maturity

Same seven dimensions, provisional source assessment. The Book's displayed scores total37/7=5.3, not its5.5 headline.

| Dimension | Book | ASTRA | Evidence |
|---|---:|---:|---|
| Household semantics | 8 | 6 | Intended access well described; no current DB/dual-phone verification |
| Engine correctness | 5 | 4 | F1/F2 concrete boundary and input omissions |
| Test protection | 5 | 5 | Stale guard repaired, incomplete behavior coverage persists |
| Capture UX | 7 | 6 | Form exists; conversational recurrence acknowledgment is inaccurate |
| Code health | 4 | 4 | Same disconnected engine/large hooks |
| Outward bridges | 4 | 5 | ERA reads schedule; Google projection still limited |
| Handoff readiness | 4 | 5 | Explicit migration slices and failure fixtures below |
| **Mean** | **5.5 headline** | **5.0** | No production claim |

## Ranked findings

### F1 — “Canonical” is a name until production uses the contract

`dayOccurrences.ts:55–67` expands RRULEs with no pause/exception/materialization pass. `date.ts:224–265` handles recurrence generation/phase flips only. The unused `schedule/expandOccurrences.ts:97–146` applies exceptions/pauses but lacks flexible placement injection and legacy moved-action parity. Do not simply swap imports.

Two additional source faults make the compatibility boundary concrete: `getOccurrencesForDay` supplies next midnight to an inclusive range (`dayOccurrences.ts:138–141`; `date.ts:240`), so a midnight event can appear on both adjacent days; `dayOccurrences.ts:115` uses `hh || 9`, turning a valid00:30 flexible placement into09:30. Deduplication at119 keys only item+day, which can collapse distinct same-day slots. One recurrence identity must preserve origin occurrence/placement slot, not merely display date.

ASTRA-SCH-1 routes the existing day adapter through the existing canonical materializer after closing these parity gaps. Calendar/Week inline-loop retirement remains later SCH-4.3b work; no fourth engine.

### F2 — Identical helper plus different inputs yields different agendas

`src/features/era/intents/resolvers/schedule.ts:50–65` fetches items/actions then supplies `[]` for flexible placements. The comment promises ERA and Schedule “can never disagree.” Planner supplies placements (`WebDayPlanner.tsx:749`); `fetchFlexibleRoutines` exists at `useFlexibleRoutines.ts:235`. ERA also computes overdue from an alert trigger (`schedule.ts:80–90`), not the occurrence's due/completion state. Alert-delivery time is not a task deadline.

ASTRA-SCH-3 obtains the same per-item-period inputs and returns unavailable when any required input fails. E-04/E-22 then reuse that fact set instead of another calendar.

### F3 — Recurrence is acknowledged but not persisted by conversational capture

`schedule.ts:170–209` passes a parsed recurrenceRule into writeReminder, posts only type/title/priority/due_at, then formats `recurring: Boolean(recurrenceRule)`. Pending answers reach the same writer at237–238. This is a concrete false-success path, not an argument to enable arbitrary RRULE creation. ASTRA-SCH-2 refuses unsupported recurrence before any write/pending capture and keeps existing structured form routing. Top Layer E-09c remains the owner of nonrecurring atomic capture.

### F4 — Google is a projection with an explicit capability gap

`src/lib/gcal/sync.ts:64,111` fetches/maps the base RRULE, not recurrence exceptions, pauses or flexible placements. It records `sync_error` at224, so the Book's “no error state” overstates the absence; observation/rendering and scheduled execution remain **UNVERIFIED**. Owner supplies daily last_synced_at progression and an isolated exception/pause fixture rendered in Google. A healthy transport timestamp cannot prove semantic parity. Healthcare's proposed medication bridge cannot treat this as a complete schedule backup.

### F5 — A time-window evaluator needs a clock trigger, not just a predicate

`prerequisites/evaluators/time-window.ts:8–9` is a false-returning stub. `prerequisites/engine.ts:122–189` evaluates candidates from trigger events; `rg --files src/app/api/cron` lists six routes, none a time-window prerequisite poller. Implementing the predicate alone would not wake a dormant item at07:00. SCH-4.4 is explicitly optional in the checklist while the DoD requires it unconditionally: recommend making that criterion conditional on a real caller. Reuse E-03's observed clock only when a product packet needs it.

## Ranked enhancement catalog

| Rank | Sheet / proposal | Size / severity | Mapping |
|---|---|---|---|
| 1 | ASTRA-SCH-2: refuse unpersisted recurrence | S / blocker | EXTENDS → SCH-1b.4/SCH-1c.2; DOCKS → E-09 |
| 2 | ASTRA-SCH-1: day-engine compatibility migration | M / friction | EXTENDS → SCH-4.2/SCH-4.3b |
| 3 | ASTRA-SCH-3: same agenda inputs for ERA | M / friction | DOCKS → E-04/E-08/E-22 |
| Held | Calendar/Week loop and action-sheet retirement | Separate existing slices | EXTENDS → SCH-4.3b; no full-migration claim |
| Held | Dead-form deletion, task taxonomy, clock evaluator | Existing decisions first | EXTENDS → SCH-5.3/SCH-6.1/SCH-4.4; M-09 cannot erase task type before consumers/migrations agree |
| New signal | Google semantic completeness | No new sheet | DOCKS → E-02/E-04; current observation needed |

## What ERA needs

Read one date/range contract with exact occurrence identity, person scope, completion state, flexible placement and fetch completeness. Distinguish due state from delivery state; distinguish recurrence-origin date from moved display date. E-04's week-shape facts are useful only after these inputs agree. Write capabilities stay nonrecurring until the established occurrence action contract is exposed, with human confirmation.

## Do not do

Do not merge payment recurrence with item RRULEs, add an expansion engine, emit a one-time item for a recurring request without consent, reinterpret skip as move, redesign Month/Week/Today or add a mood optimizer to consume a column merely because it exists. No automatic live DB verification or Google mutations.

## Coverage note

Owns Items, flexible routines/Chores, Focus behavior, Plan My Day and Prerequisites execution; NFC configuration remains cross-cutting. Kitchen's book groups Chores but Schedule owns occurrence state. Top Layer owns E-09c atomic parent/details/prerequisites; this Book does not duplicate it. [Coverage appendix](<../../ASTRA — Coverage & Orphans.md>).

## ASTRA 10× Findings

- **Leverage:** Make the existing day adapter a compatibility facade over the existing canonical engine; Today, Planner and ERA benefit together (F1).
- **Leverage:** Reuse the planner's placement inputs before adding new briefing intelligence (F2).
- **Simplification:** Retire competing loops progressively after fixture parity; retain the two separate business recurrence systems.
- **Frontier — DOCKS → E-04/E-22:** A trustworthy week-shape fact can anticipate overloaded days without an AI scheduling optimizer.
- **Uncomfortable:** The “shared helper guarantees parity” claim ignores missing inputs, while another resolver promises recurrence it never writes (F2/F3).

