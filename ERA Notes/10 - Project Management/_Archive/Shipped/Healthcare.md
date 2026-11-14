---
created: 2026-11-11
updated: 2026-11-11
type: archive
status: superseded
owner: Elio
---

# Healthcare — shipped work

> Written by `pnpm pm:ship`. Full receipts and acceptance criteria of completed Healthcare items, plus Master Book state-log entries older than the newest 3. The [Master Book](<../../Healthcare/Healthcare — Master Book.md>) keeps one dated line per item in its Shipped Log. Nothing under `_Archive/` is read by a PM tool.

## Shipped items

### HLTH-28

- ✅ 2026-10-12 — **HLTH-28** Fitness module: PT plan import (contract/schema/examples/AI prompt), weekly flexible Schedule slots, workout logging + rest timer + offline queue, deterministic rewards/quests/badges/records/ranks, shared owner-private measurements + BMI, partner opt-in summary ([criteria](#hlth-28); PGlite 16/16, unit tests, typecheck + lint; `migrations/2026-10-12_fitness-module.sql` **code-complete, not yet run** — HLTH-29)

**Outcome:** Fitness module — imported PT plans, workout logging, recovery and gamified progress.

**Kind:** feature

**Implementation:** done

- **Acceptance:** PTPlanV1 import with field-path validation, review drafts and duplicate detection; versioned plans; activation into weekly flexible Schedule slots bounded by duration; one authoritative completion across Fitness and Schedule with Undo; exactly-once deterministic rewards with replay-safe receipts; offline workout logging with held conflicts; shared owner-private measurements with dated BMI; partner opt-in summary; four tabs + focused workout at 390 px and desktop in all themes with reduced motion.
- **Evidence, 2026-10-12:** `src/lib/fitness/fitness.database.test.ts` 16/16 (PGlite, real SCH-24 + Fitness migrations: atomic import/replay/duplicate, draft gating, activation shape and duration bound, pause/resume/archive/restore, versioning without history rewrite, finish/Undo across Schedule, daily XP cap, quests, Schedule-created minimal session + enrichment + revert, skip earns nothing, conflict, records by exercise/equipment/load, DST week mapping, partner privacy). Unit: `ptPlan.test.ts` 15, `progress.test.ts`, `offline.test.ts`, `measurements.test.ts`, `OfflineSyncEngine.fitness.test.ts`. Typecheck/lint clean. Fixture screenshots (CDP device emulation, 390×844 blue + frost, 1280 pink). Deployment and phone acceptance: HLTH-29.

### HLTH-24

- ✅ 2026-09-26 — **HLTH-24** Medications: list (dose, full course / as needed, food timing, dose times, course length), day-by-day taken checklist, one urgent recurring Schedule reminder per dose time synced both ways with the checklist (`migrations/2026-09-26_healthcare-medications.sql` — **code-complete, migration not yet run**, HLTH-25; PGlite fixtures 31/31, `medicationSchedule.test.ts` 14/14, typecheck + lint clean) [Owner UAT draft, 2026-10-25](<../../../../docs/Delivery-UAT-Product-Followups-2026-10-25.md#health--medication-checklist-and-schedule>); historical result unchanged.

### HLTH-8

- ✅ 2026-09-26 — **HLTH-8** Idempotent medication storage and materialization — delivered inside HLTH-24 (same evidence; migration pending HLTH-25)

**Outcome:** Define idempotent medication storage and materialization.

- **Status 2026-09-26:** delivered as code by HLTH-24 (see Shipped Log) — `health_medications`, `health_medication_logs` with the slot-keyed unique index, `items.source_medication_id` (+ partial index, ON DELETE CASCADE), the occurrence-action mirror triggers and the save / delete / dose / rebuild RPCs. Deviation: edits hard-delete and recreate reminder items (children cascade) rather than archiving; history stays in logs. Application is HLTH-25. The plan below is historical.

- **Acceptance:** *(packet **M-07a** of the [ERA Top Layer — Master Plan](<../Plans/ERA Top Layer — Master Plan (2026-09-02).md>); plan sacrifice #3 if a gate is missed)* (Phase 2) Medications migration — `health_medications` + `health_medication_logs` (idempotent unique key), `items.source_medication_id` FK + partial index, occurrence-action mirror trigger, materialization RPCs
- **Depends on:** [HLTH-7](<../../Healthcare/Healthcare — Master Book.md#hlth-7>), [HLTH-19](<../../Healthcare/Healthcare — Master Book.md#hlth-19>).

**Provenance:** [4 - Checklist.md](<../2026-09-10 PM Refactor/Before/Healthcare/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Migration-first and blocked on HLTH-19. Read `migrations/schema.sql` for the `items` table and the existing health tables before designing `health_medications`/`health_medication_logs`; the idempotent unique key is the whole point, so read `.claude/skills/recurrence-safety/SKILL.md` before writing the materialization RPCs — this repo's historical failure mode is duplicate occurrence generation, and there are already two recurrence systems not to add a third to. `items.source_medication_id` follows the existing `source_catalogue_item_id` precedent (see `src/app/api/items/route.ts` and `src/app/api/items/[id]/promote/route.ts`). The occurrence-action mirror trigger has to agree with `src/lib/schedule/materializeOccurrence.ts` and `alertResolution.ts`. Hard Rules #20 (no EXISTS policies on hot child tables), #24 (migration file, then `schema.sql`) and #26 (hand the SQL to the owner; never apply it).

**Execution plan — 2026-09-26**

**Readiness:** split first.

**Verify:** Proposed isolated SQL fixtures cover two dose times, duplicate operation, simultaneous materialization, dependent profile, cross-owner refusal and rollback after child failure. Owner applies reviewed SQL separately; run `pnpm typecheck` and relevant schema/type checks after local changes.

```delivery-plan-v1
{
  "outcome": "Medication storage materializes one reminder per dose time and records each dose action once.",
  "acceptance": [
    "Provide medications/logs, item linkage, partial index, action mirror and transactional materialization RPCs.",
    "Dose log identity includes medication, occurrence date and dose time; repeated actions do not duplicate records."
  ],
  "scope": [
    "migrations/schema.sql",
    "src/features/healthcare/types.ts"
  ],
  "steps": [
    "Wait for HLTH-7 current privacy evidence and HLTH-19 safety rules; read current items/health schema and occurrence-action contracts.",
    "Specify dose units, local-time/occurrence identity, authorization and archive/recreate edit behavior before choosing constraints.",
    "Write a proposed dated migration first, then schema end-state and types; reuse existing item recurrence and efficient access enforcement.",
    "Exercise transactional/race fixtures in isolation and prepare owner inspect/apply/verify instructions; record application separately."
  ],
  "invariants": [
    "No third recurrence/alert engine.",
    "Medication, dose-time reminders and required links commit atomically.",
    "Schedule edits preserve adherence history; nullable dependent user_id is valid."
  ],
  "exclusions": [
    "Routes/calendar delivery HLTH-9, UI HLTH-11, stock/refill features or agent-applied SQL."
  ],
  "risks": [
    "A unique key missing dose time merges distinct daily doses; a non-atomic materializer leaves orphan reminders."
  ],
  "unknowns": [
    "Exact medication columns, dose-unit contract and current occurrence trigger semantics require the safety/design pass."
  ],
  "dependencies": [
    "HLTH-7",
    "HLTH-19"
  ],
  "risk": "high",
  "provenance": "2026-09-26 planning from Healthcare acceptance, vault model and Plans/ERA Top Layer.md. Medication implementation is pending; source/schema and prerequisite evidence must be revalidated at dispatch.",
  "checks": [],
  "ownerReviewed": false
}
```

### HLTH-2

- ✅ 2026-07-17 — **HLTH-2** core DB: `health_profiles` / `health_allergies` / `health_conditions` / `health_vaccines`, owner-only RLS + `managing_user_id` sync trigger, `get_health_bundle()` + `get_household_allergens()` RPCs (`migrations/2026-07-17_healthcare-core.sql` — **code-complete, migration not yet run**)

### HLTH-26

- ✅ 2026-09-27 — **HLTH-26** Cover three medication dosing instructions: course morning/evening, eight-hour as-needed gap, and one Morning plus one Evening as-needed opportunity ([criteria](#hlth-26); isolated PGlite and schedule tests; evening upgrade pending owner application).

**UAT instructions:** [Delivered-slice owner wizard](<../../../../docs/Delivery-UAT-Product-Followups-2026-10-25.md#health--medication-checklist-and-schedule>) (drafted 2026-10-25; original results and remaining gates retained).

**Outcome:** Represent and enforce the owner's three medication instructions.

- **Acceptance:** A full course can store a two-pill dose at morning/evening times with any food timing; an as-needed stomach-pain medicine can store one pill, with food, and an eight-hour minimum gap; an as-needed medicine can store one pill, empty stomach, and one Morning plus one Evening opportunity per local day.
- **Evidence, 2026-09-27:** `node scripts/check-medication-prn.mjs` covers replay, gap, named slots, Undo, daily maximum and course regression in isolated PGlite; `medicationSchedule.test.ts` covers local-day slot state. This is not a live DB or phone witness.
- **Deployment:** Owner reports the earlier Morning/Noon PRN migration applied. Run `migrations/2026-09-27_medication-evening-upgrade.sql` to convert current options and preserve historical Noon logs. HLTH-25 retains phone acceptance.

### HLTH-27

- ✅ 2026-09-27 — **HLTH-27** Show doses as an interactive daily timeline — [criteria](#hlth-27)

**Outcome:** Show doses as an interactive daily timeline.

- **Acceptance:** Scheduled doses appear as connected circles in time order; tapping a circle toggles its Taken/Not taken state and updates the day progress. As-needed doses use circular Take controls; Morning and Evening opportunities show their individual states and can be untaken from the same control. Existing dose Undo and server limits remain in effect.
- **Evidence, 2026-09-27:** UI implemented in `MedicationsSection.tsx`; local typecheck, scoped lint and medication schedule tests passed. Phone visual and live medication acceptance remain in HLTH-25.

## State log
