---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: baseline-frozen
owner: Elio
---

> Archived study. Current ownership and execution criteria live in the [PM index](<../../../../_index.md>); unchecked boxes here are historical proposals.

# Schedule — ASTRA Packets

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../../../Plans/ERA Top Layer — Master Plan (2026-09-02).md>), not a replacement roadmap. Evidence cutoff `3106164`; [Master Book](<../../../../Schedule/Schedule — Master Book.md>) updated 2026-07-30. Study only; no DB calls.

## Phase 5 landing — authoritative on 2026-09-06

This table and the PM fields below complete queue reconciliation at `3106164`. Earlier phase-only editing/validation statements are historical receipts. Implementation gates remain **NOT RUN**. [Coverage and admission](<../ASTRA — Coverage & Orphans.md>) records the whole allocation; [Contradiction Register](<../ASTRA — Contradiction Register.md>) preserves unresolved decisions. Existing parent criteria still apply. **HELD means do not dispatch; unallocated means no checkbox exists.** Study acceptance does not approve a policy amendment or another Delivery slot.

| Sheet | Reconciliation | Canonical queue owner | Admission / completion boundary |
|---|---|---|---|
| ASTRA-SCH-2 | DOCKS → E-09; EXTENDS → existing capture safety | SCH-7 | Next blocker; refuse unsupported recurrence, no new engine |
| ASTRA-SCH-1 | EXTENDS → SCH-4.3b | SCH-4.3b | Existing parent; dispatch only this M adapter slice, not L parent |
| ASTRA-SCH-3 | DOCKS → E-04/E-08/E-22 | Unallocated; Schedule owns | HELD until adapter proof; then allocate only if admitted; coordinate HUB-41/45 |

## Plan reconciliation

| Sheet | Mapping | Parent status |
|---|---|---|
| ASTRA-SCH-2 | EXTENDS → SCH-1b.4/SCH-1c.2; DOCKS → E-09 | Recurring capture remains unsupported; no full NLP completion |
| ASTRA-SCH-1 | EXTENDS → SCH-4.2/SCH-4.3b | Calendar/Week/other loops and action UI remain open |
| ASTRA-SCH-3 | DOCKS → E-04/E-08/E-22 | Read parity only; briefing delivery elsewhere |
| time_window DoD | CONFLICTS → checklist optional SCH-4.4 vs unconditional D2 | Phase5 records conditional criterion recommendation |
| Google projection | DOCKS → E-02/E-04 | No duplicate scheduler or connector |

## Execution contract

These sheets are specifications, **NOT RUN**. Copy this block with an individually dispatched sheet. S ≤ half a session; M ≤ one 2–4h session. Study IDs allocate no campaign integers; Phase 5 landing above records the canonical queue. A partial child never closes an incomplete parent.

**Common gates:** named regressions execute nonzero cases and pass; `pnpm typecheck`, `pnpm lint`, `pnpm pm:lint` exit 0, with output and tested revision attached. The existing PM lint error for the missing DLV-77 migration path is a separately owned Phase-5 prerequisite, not permission to invent SQL. Tests use isolated fixtures and mocked clients; agents make no live DB calls. Owner-run DB/device evidence is separate from mocked tests.

**Forbidden in every sheet:** `src/components/ui/**`; `src/components/hub/HubPage.tsx` (no rider in these campaign sheets); `migrations/schema.sql` without the explicitly paired migration; every path outside the exact allowlist; git writes, production data access, new dependencies, new modules, a second queue/recurrence engine, and changes to existing `/era` layout. New paths are marked **[NEW]**. Relevant PM trace paths named in each sheet are future implementation permissions, not study edits.

| STOP | Condition — stop and leave a five-line evidence/handoff note |
|---|---|
| S1 | A file outside the allowlist needs editing. |
| S2 | A DB write is needed; hand the owner the manual runbook and await APPLIED evidence. |
| S3 | Test count decreases, a required check is red, or a targeted regression executes zero cases. |
| S4 | HubPage grows or a new import of its internals is required. |
| S5 | A new dependency is required. |
| S6 | Work cannot finish in one session; split before proceeding. |
| S7 | A visibility/permission symptom appears; obtain fresh owner DB-state evidence or Hard Rule 27's untruncated queries before route diagnosis. |
| S8 | Money/schedule semantics are ambiguous; ask one focused question rather than guessing. |
| S9 | An AI proposal would write without the required confirmation. |
| S10 | A second engine, queue, parser, regex family, toast system or aggregate for an existing concept is introduced. |
| S11 | Work enters D2's entirely excluded scope. |
| S12 | An existing `/era` element is moved or restyled. |

**NOT done, in every sheet:** migration written ≠ APPLIED; test file ≠ test in CI include; local success ≠ evidence pasted; transport acceptance ≠ observed household outcome; child implementation ≠ parent completion.


**PM allowlist P:** `ERA Notes/10 - Project Management/Schedule/4 - Checklist.md`; `ERA Notes/10 - Project Management/Schedule/Schedule — Master Book.md`.

## ASTRA-SCH-2 · Refuse unsupported conversational recurrence · S · E · before new capture channels

**Outcome:** A recurring request cannot be acknowledged as recurring after creating a one-time reminder.

**Prereqs:** E-11a outcome contract coordinated if already landed; E-01 CI. No migration required APPLIED. E-09c owns subsequent nonrecurring capture cutover.

**Skills:** `start-task → fix-bug → recurrence-safety → finish-task`.

**Files:** `src/features/era/intents/resolvers/schedule.ts`; `src/features/era/intents/resolveIntent.test.ts`; `ERA Notes/03 - Junction Modules/AI Assistant/Overview.md`; plus P.

**Boundary:** Guard parsed recurrence before writeReminder and before an incomplete request becomes a pending turn; guard the pending answer too. Return existing structured-form handoff/refusal and unsuccessful outcome, with original input recoverable. No POST, no fake recurring success, no new recurrence parser. Preserve explicit one-time requests.

**DB change?** No.

**AI call added?** No.

**Money/schedule math?** Yes: “every Monday at9” → zero one-time rows, no false recurring receipt; “Monday at9” → one existing nonrecurring path. Pending-time response containing recurrence likewise writes zero.

**Gate:** `pnpm exec vitest run src/features/era/intents/resolveIntent.test.ts --reporter=verbose` → nonzero initial/pending recurrence and one-time control cases pass; mocked POST count0 for unsupported cases. Common gates; 390×844 capture preserves input and existing form door.

**PM:** Tick SCH-7 after both capture branches pass. Shipped Log: `- ✅ YYYY-MM-DD — **SCH-7** (ASTRA-SCH-2 guard) ERA refuses unsupported recurrence without a one-time write; initial/pending fixtures: <evidence>.` Keep full capture parents open.

**NOT done:** Refusal ≠ supported recurring capture; nonrecurring endpoint atomicity remains E-09c.

**STOP:** S1–S12 above.

## ASTRA-SCH-1 · Day adapter delegates canonical occurrence semantics · M · H · SCH-4.3b first slice

**Outcome:** Today and Planner preserve pauses, exceptions and valid midnight/flexible placements through one occurrence contract.

**Prereqs:** Existing occurrence/action dialects inventoried; E-01 CI. No migration required APPLIED; use supplied fixtures, not live rows. Owner approves compatibility semantics if the current tests conflict with locked skip/move rules.

**Skills:** `start-task → recurrence-safety → timezone-handling → finish-task`.

**Files:** `src/lib/utils/dayOccurrences.ts`; `src/lib/utils/dayOccurrences.test.ts`; `src/lib/schedule/expandOccurrences.ts`; `src/lib/schedule/expandOccurrences.test.ts`; `src/lib/schedule/materializeOccurrence.ts`; `ERA Notes/02 - Standalone Modules/Items & Reminders/Overview.md`; `ERA Notes/03 - Junction Modules/Plan My Day/Overview.md`; plus P.

**Boundary:** Retain dayOccurrences' caller API but replace its RRULE loop with the existing canonical expander. Add missing flexible placement and legacy one-off moved-action compatibility there, preserve handled-state rendering and occurrence origin. Same-day flexible slots remain distinct by placement identity. Use half-open calendar-day bounds, preserve00:30, and central timezone helpers. Fixtures must distinguish skipped origin, moved destination, active pause, edited override and DST. No view layout changes, data migration or blanket dialect deletion.

**DB change?** No.

**AI call added?** No.

**Money/schedule math?** Yes: daily09:00 seriesSep6–8, pauseSep7 → only6/8; moveSep6→Sep8 at11 → original6 absent, scheduled8 at09 and moved8 at11 have distinct identities. Sep7 at00 belongs onlySep7; flexible00:30 stays00:30. Preserve same-day distinct slots and origin-based completion.

**Gate:** `pnpm exec vitest run src/lib/schedule/ src/lib/utils/dayOccurrences.test.ts --reporter=verbose` → nonzero behavior cases pass, no test-count reduction. Source audit confirms adapter contains no independent RRULE expansion loop. Common gates; owner390×844 Today/Planner captures on same fixture agree.

**PM:** Partial Shipped Log: `- ✅ YYYY-MM-DD — **SCH-4.3b** (ASTRA-SCH-1 partial) Day adapter delegates canonical occurrence semantics; pause/move/flexible/DST fixtures: <evidence>.` SCH-4.2 broader per-view coverage and remaining engines/UI stay open.

**NOT done:** Adapter migration ≠ all calendar/Week consumers migrated, all moves rewritten or occurrence-sheet consolidation.

**STOP:** S1–S12 above.

## ASTRA-SCH-3 · ERA reads the planner's complete agenda inputs · M · E · after ASTRA-SCH-1

**Outcome:** ERA's day answer includes the same scheduled flexible work and due-state interpretation as the planner.

**Prereqs:** ASTRA-SCH-1, E-04a completeness and E-01 CI. No migration required APPLIED. Any permission-shaped symptom invokes S7 before source diagnosis.

**Skills:** `start-task → recurrence-safety → timezone-handling → cache-invalidation → finish-task`.

**Files:** `src/features/era/intents/resolvers/schedule.ts`; `src/features/era/intents/resolveIntent.test.ts`; `src/features/items/useFlexibleRoutines.ts`; `tests/era-schedule-parity.test.ts` **[NEW]**; `ERA Notes/03 - Junction Modules/AI Assistant/Overview.md`; plus P.

**Boundary:** Use existing fetchFlexibleRoutines with the selected date/per-item periods, feeding its scheduled placements into the day adapter. Keep bundle reads and existing household rules. Failed placements/actions/items must prevent a complete-agenda claim. Compute overdue from the same bounded occurrence/completion semantics, not active alert trigger_at. No second overdue engine: reuse the migrated range adapter and existing planner window policy. If no reusable boundary fits, stop and split rather than duplicate.

**DB change?** No.

**AI call added?** No.

**Money/schedule math?** Yes: fixed09:00 + flexible11:00 → two shared agenda entries; yesterday's completed occurrence with old active alert → zero overdue; failed placement fetch → unavailable, not one-item complete agenda. Weekly and monthly routines use their own periods.

**Gate:** `pnpm exec vitest run tests/era-schedule-parity.test.ts src/features/era/intents/resolveIntent.test.ts --reporter=verbose` → nonzero fixtures pass with mocked identical planner inputs, empty vsfailed distinction and scoped periods. Common gates; same-date ERA/Planner390×844 comparison.

**PM:** **HELD / UNALLOCATED** — HELD until adapter proof; then allocate only if admitted; coordinate HUB-41/45. Before any future dispatch, the owner admits this sheet and the owning campaign allocates a never-used ID after rechecking its entire history. Then use `- ✅ YYYY-MM-DD — **<new campaign ID>** (ASTRA-SCH-3) <Outcome above>; <all gate evidence>.` No parent is ticked for this held proposal.

**NOT done:** Read parity ≠ notifications sent, Google parity, a full week optimizer or verified RLS.

**STOP:** S1–S12 above.

## ASTRA 10× Findings

- **Leverage:** Fix shared semantics and supplied inputs separately; both are required for agreement.
- **Simplification:** Keep one facade during migration, then retire proven duplicate loops.
- **Uncomfortable:** A source-text guard can be green while complete agendas and recurrence receipts remain wrong.
