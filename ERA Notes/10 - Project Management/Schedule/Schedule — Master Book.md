---
created: 2026-09-10
updated: 2026-09-10
type: master-book
status: active
owner: Elio
---

# Schedule — Master Book

[Backlog](<4 - Checklist.md>) · [PM home](<../_index.md>) · [Governance](<../_Conventions.md>)

## Purpose & ownership

One coherent time model from capture through occurrence completion. Standalone Items/Schedule with Prerequisites and Plan My Day junctions.

## Current state & evidence

Stage1 recurrence correctness and shared day delegation exist. Stages2–3 and all-consumer parity remain open; the old known-red WebTodayView claim is stale. The live capture form is MobileReminderForm; source-present parser behavior is not net-new NLP.

Refactored 2026-09-10 against repository HEAD `8d952332b0d7917369ce074730cfe830a5c37a97` and dated source studies. This date records document reconciliation, not a fresh runtime, DB or device witness. The [pre-refactor record](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>) preserves detailed older narratives and receipts.

## Vision & Decisions

- Focus is a per-item mode; household co-ownership permits mutual edit/reassign through the shared predicate. *(IMPLEMENTED 2026-06-06)*
- Capture first, classify last: title-only can save a dateless reminder; structured fields remain editable truth. Form parsing is rule-based/offline-capable; Hub uses Gemini with an explicit long-call timeout. Never reuse money NLP logic wholesale.
- The former three-type data decision is transitional: the accepted SCH-6.1 retirement supersedes it as the target; do not pretend the DB/type migration has shipped. The live form already presents Reminder/Event.
- Occurrence menu: Complete, Skip, Move to date, Edit occurrence, Edit/Delete series. Recurring Move uses rescheduled_to; no postpone-to-next-slot duplication. Cancel is for one-off items. Exactly-once actions remain mandatory.
- No geofencing. Arrive/leave uses existing NFC prerequisites. Do not activate inert evaluators to expand parser vocabulary. DEC-10 preserves the unresolved optional-versus-required time_window conflict.
- Do not redesign working Month/Week/Today surfaces or split useItems solely for size. Mobile form deletion requires SCH-5.3’s explicit keep/merge/retire decision.
- Reusable Catalogue definitions never replace execution ownership: Schedule owns activation, occurrence identity and history; edits to a definition do not silently rewrite instances.

Unresolved policy choices live in the [decision register](<../_Decisions.md>); original exploratory ideas live in [Research options](<../Research/Options.md>). A Later item is retained work, not automatic permission to start.

## Pain Inventory

🟠 **SCH-4.2** Verify cross-view recurrence placement. See [acceptance](<#sch-42>) for the root cause, evidence and gate.

🟠 **SCH-4.3b** Unify recurrence expansion and occurrence actions. See [acceptance](<#sch-43b>) for the root cause, evidence and gate.

🔴 **SCH-7** Refuse unsupported recurrence before capture. See [acceptance](<#sch-7>) for the root cause, evidence and gate.

🟠 **SCH-9** Give online and replayed reminders equal alert semantics. Dated source diagnosis; cause and witness limits are in [criteria](<#sch-9>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

The remaining retained defects, decisions and enhancements are indexed below and ordered once in the checklist. Historical study claims are not new production incidents.

## Acceptance Criteria Index

### SCH-4.2

**Outcome:** Verify cross-view recurrence placement.

- **Acceptance:** Verify broader per-view placement semantics; WebTodayView now delegates through the shared day path, so the old known-red-source claim is stale. This does not prove pause/exception/flexible parity or close broader coverage.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Verification across surfaces, and the stale-claim warning is real — check what each view actually imports before trusting any prior description. Verified 2026-09-20: `src/components/web/WebTodayView.tsx` and `src/components/planner/WebDayPlanner.tsx` import **both** `src/lib/utils/dayOccurrences.ts` and `src/lib/schedule/expandOccurrences.ts`; `src/components/web/WebTabletMissionControl.tsx` and `src/features/era/intents/resolvers/schedule.ts` import only `dayOccurrences`; and `src/components/web/WebCalendar.tsx` expands RRule inline (around its "find the RRule occurrence that falls on that date" block). Pause/exception/flexible parity is decided in `src/lib/schedule/materializeOccurrence.ts` (`isSkippedException`, `isRescheduledException`, `OVERRIDABLE_FIELDS`) and `alertResolution.ts` (`getSeriesAlert`, `getOccurrenceAlert`, `findExceptionForDate`) — flexible routines come from `item_flexible_schedules`, not rrule. Existing tests: `src/lib/schedule/expandOccurrences.test.ts`, `src/lib/utils/dayOccurrences.test.ts`. This item gates SCH-1b.4.

### SCH-4.3b

**Scope split:** this ID owns the shared day/range adapter, expansion core and shared action sheet. SCH-14 owns occurrence identity through side-effects; SCH-8 owns remaining consumer migrations/parity. The former all-surfaces obligation is complete only when all three pass. Execute the bounded adapter first; it is the predecessor meant by SCH-14/SCH-8, not completion of the entire original L-sized refactor.

- **Retained campaign gate (D1):** One expansion engine + one occurrence-action sheet across all surfaces (Stages 2–3 — not started; Stage 1 done 2026-06-19).

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C04a. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Unify recurrence expansion and occurrence actions.

- **Acceptance:** Engine/UI recurrence unification — Stages 2–3 (one expansion engine + one occurrence-action sheet across all surfaces).

- **Acceptance:** skipping a missed past occurrence marks it `skipped`, removes it from view, and creates **no** new or duplicate occurrence; completing an occurrence on `/reminders` moves it into the hideable Completed section; the same item renders identically on calendar, week, planner and today.
- **Acceptance:** exactly one expansion engine is imported by every surface; `dayOccurrences.ts` and the `WebCalendar` inline loop are gone.

**Retained contract — ASTRA-SCH-1:**

- **Outcome:** Today and Planner preserve pauses, exceptions and valid midnight/flexible placements through one occurrence contract.
- **Boundary:** Retain dayOccurrences' caller API but replace its RRULE loop with the existing canonical expander. Add missing flexible placement and legacy one-off moved-action compatibility there, preserve handled-state rendering and occurrence origin. Same-day flexible slots remain distinct by placement identity. Use half-open calendar-day bounds, preserve00:30, and central timezone helpers. Fixtures must distinguish skipped origin, moved destination, active pause, edited override and DST. No view layout changes, data migration or blanket dialect deletion.
- **Money/schedule math?:** Yes: daily09:00 seriesSep6–8, pauseSep7 → only6/8; moveSep6→Sep8 at11 → original6 absent, scheduled8 at09 and moved8 at11 have distinct identities. Sep7 at00 belongs onlySep7; flexible00:30 stays00:30. Preserve same-day distinct slots and origin-based completion.
- **Gate:** `pnpm exec vitest run src/lib/schedule/ src/lib/utils/dayOccurrences.test.ts --reporter=verbose` → nonzero behavior cases pass, no test-count reduction. Source audit confirms adapter contains no independent RRULE expansion loop. Common gates; owner390×844 Today/Planner captures on same fixture agree.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The big one, and the inventory above is its map: **three** expansion paths exist today — `expandOccurrencesForRange()` in `src/lib/schedule/expandOccurrences.ts`, `expandOccurrencesInRange()`/`getOccurrencesForDay()` in `src/lib/utils/dayOccurrences.ts`, and the inline RRule loop in `src/components/web/WebCalendar.tsx` — with two surfaces importing two of them at once. The acceptance's end state is literally "`dayOccurrences.ts` and the `WebCalendar` inline loop are gone". Read `.claude/skills/recurrence-safety/SKILL.md` **first**: skip ≠ postpone is the historical bug (skip was wired to postpone-next-occurrence and produced duplicates), and introducing a new engine is forbidden — this item removes two, it does not add a third. The occurrence contract is `materializeOccurrence.ts` + `alertResolution.ts`; the action sheet consumers are `/reminders` (`src/app/reminders/`), calendar, week, planner and today. SCH-8 and SCH-14 both depend on this landing.

### SCH-7

**Outcome:** Refuse unsupported recurrence before capture.

- **Acceptance:** Unsupported recurrence is refused before creating a one-time reminder or a misleading pending turn; blocks safe E-09 conversational capture.

**Retained contract — ASTRA-SCH-2:**

- **Outcome:** A recurring request cannot be acknowledged as recurring after creating a one-time reminder.
- **Boundary:** Guard parsed recurrence before writeReminder and before an incomplete request becomes a pending turn; guard the pending answer too. Return existing structured-form handoff/refusal and unsuccessful outcome, with original input recoverable. No POST, no fake recurring success, no new recurrence parser. Preserve explicit one-time requests.
- **Money/schedule math?:** Yes: “every Monday at9” → zero one-time rows, no false recurring receipt; “Monday at9” → one existing nonrecurring path. Pending-time response containing recurrence likewise writes zero.
- **Gate:** `pnpm exec vitest run src/features/era/intents/resolveIntent.test.ts --reporter=verbose` → nonzero initial/pending recurrence and one-time control cases pass; mocked POST count0 for unsupported cases. Common gates; 390×844 capture preserves input and existing form door.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** A refusal at the capture boundary, and the failure it prevents is specific: acknowledging a request as recurring after having written a one-time reminder. The parser is `src/lib/smartTextParser.ts` — `parseSmartText()` returns `ParsedItem`, and `getRecurrenceDescription(rrule)` is what turns a rule into the sentence that would lie. The write path is `src/app/api/items/route.ts` (see its "Recurrence rule" section). What "supported" means is defined by the expansion engine, so the supported-RRULE set must come from `src/lib/schedule/expandOccurrences.ts` and `src/lib/utils/date.ts` (`buildFullRRuleString`), not a second list. Refuse before creating anything; a partial create plus a correction is exactly the outcome the acceptance forbids. Blocks conversational capture (E-09).

### SCH-5.5

**Outcome:** Finish mobile reminder form cleanup and verification.

- **Acceptance:** Mobile-form cleanup carried from the R3–R8 rounds: add **Undo** to success toasts (Hard Rule #1), remove the stray `console.error` in the submit/speech handler (Hard Rule #22), drop the unused `missingFieldType` state, and do the real-device visual check across themes.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Four small, verified items in one file, `src/components/reminder/MobileReminderForm.tsx` (1,762 lines — the live form; `MobileItemForm.tsx` is dead, see SCH-5.3). (1) Undo: `toast.success("Event created!")` around line 724 and `toast.success("Reminder created!")` around line 764 have no Undo — the file contains **zero** occurrences of "Undo" (Hard Rule #1; use `ToastIcons` from `src/lib/toastIcons.tsx`). (2) `console.error` at ~line 385 in the speech-recognition handler and ~line 772 in the submit handler (Hard Rule #22 — client code, so both must go; the Error Logs module is the sanctioned sink). (3) `missingFieldType` — **it no longer exists in the file** (0 matches), so that sub-item is already done; say so rather than hunting. (4) Real-device visual check across all four themes on a mobile viewport (Hard Rules #5, #10).

### SCH-1.9

**Outcome:** Document the shipped capture behavior.

- **Acceptance:** Post-ship docs: [Items & Reminders Overview](<../../02 - Standalone Modules/Items & Reminders/Overview.md>) updated with the new capture behaviors. No new route/icon, so Atlas/Routes unchanged.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Docs only, and the target is named: `ERA Notes/02 - Standalone Modules/Items & Reminders/Overview.md`. To know what shipped, read `src/lib/smartTextParser.ts` (`parseSmartText`, `ParsedItem`, and the description helpers `getRecurrenceDescription`/`getTimeDescription`/`getDateDescription`) and the capture entry points in `src/components/reminder/MobileReminderForm.tsx`. No new route or icon, so the Atlas and `App Routes and Icons.md` stay unchanged — do not add entries. Several sibling items (SCH-5.3, SCH-6.1) turn on facts this doc should record, so write what is true now, not what was planned.

### SCH-1b.4

**Outcome:** Harden conservative recurrence extraction.

- **Acceptance:** Harden recurrence extraction — keep conservative; **gate behind the SCH-4.2 tests** before trusting RRULE writes from text.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Gated behind SCH-4.2's tests by the acceptance — do not trust RRULE writes from free text until cross-view placement is verified. The extractor is in `src/lib/smartTextParser.ts` (`parseSmartText`, with `getRecurrenceDescription` for the readback); rule construction is `buildFullRRuleString` in `src/lib/utils/date.ts`. "Conservative" is the design: when the phrase is ambiguous, produce no rule rather than a plausible one — SCH-7 is the refusal counterpart and SCH-3.1 is the one-question clarification alternative. Timezone and DST rules: `.claude/skills/timezone-handling/SKILL.md` and `ERA Notes/01 - Architecture/Timezone Handling.md`; a DTSTART in the wrong zone is the classic silent failure here.

### SCH-1c.1

**Outcome:** Parse one-line items through Gemini safely.

- **Acceptance:** Wire one-line → structured item via **Gemini**; **pass `timeoutMs`** (Hard Rule #6 — AI calls can exceed the current 8 s default). → `src/lib/ai/gemini.ts`

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** One AI call with one hard constraint. The model layer is `src/lib/ai/gemini.ts` — `generateContentWithFallback()` with `isDailyQuotaError()` for 429 discrimination — and **Hard Rule #6 is the acceptance**: pass `timeoutMs` (60_000) to `safeFetch()` from `src/lib/safeFetch.ts`, or the request aborts at the 8 s default; note a timeout is latency, not offline, and must not enqueue a duplicate mutation. The deterministic parser already exists (`parseSmartText()` in `src/lib/smartTextParser.ts`) and returns `ParsedItem` — make Gemini fill that same shape rather than a new one, and Zod-validate what comes back (Hard Rule #12). Standing rule: the model proposes, the human confirms — which is what SCH-1c.2 wires up.

### SCH-1c.2

**Outcome:** Reuse Hub reminder creation with confirmation.

- **Acceptance:** Reuse/extend the Hub create path ([AddReminderFromMessageModal.tsx](<../../../src/components/hub/AddReminderFromMessageModal.tsx>) · [messageActions.ts](<../../../src/features/hub/messageActions.ts>)) — confirm chip before commit.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Reuse, don't rebuild — the acceptance names both files. `src/features/hub/messageActions.ts` is the Message Actions junction that turns a hub message into a reminder, and `src/components/hub/AddReminderFromMessageModal.tsx` is the existing confirm-before-commit modal. Read the Hub Chat and Message Actions vault docs (`ERA Notes/03 - Junction Modules/`) before changing either, since both bridge Budget, Items and the Shopping List. The confirm chip is the proposal gate for SCH-1c.1's parse: nothing writes until the human accepts. Item creation lands in `src/app/api/items/route.ts`.

### SCH-8

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C04c. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Unify canonical agenda consumer semantics.

- **Acceptance:** ASTRA-SCH-3/C04c: after the bounded day adapter, verify pause/exception/flexible placement and consumer parity across agenda, ERA and calendar surfaces. No independent expansion engine.
- **Depends on:** [SCH-4.3b](<Schedule — Master Book.md#sch-43b>), [SCH-14](<Schedule — Master Book.md#sch-14>).

**Retained contract — ASTRA-SCH-3:**

- **Outcome:** ERA's day answer includes the same scheduled flexible work and due-state interpretation as the planner.
- **Boundary:** Use existing fetchFlexibleRoutines with the selected date/per-item periods, feeding its scheduled placements into the day adapter. Keep bundle reads and existing household rules. Failed placements/actions/items must prevent a complete-agenda claim. Compute overdue from the same bounded occurrence/completion semantics, not active alert trigger_at. No second overdue engine: reuse the migrated range adapter and existing planner window policy. If no reusable boundary fits, stop and split rather than duplicate.
- **Money/schedule math?:** Yes: fixed09:00 + flexible11:00 → two shared agenda entries; yesterday's completed occurrence with old active alert → zero overdue; failed placement fetch → unavailable, not one-item complete agenda. Weekly and monthly routines use their own periods.
- **Gate:** `pnpm exec vitest run tests/era-schedule-parity.test.ts src/features/era/intents/resolveIntent.test.ts --reporter=verbose` → nonzero fixtures pass with mocked identical planner inputs, empty vsfailed distinction and scoped periods. Common gates; same-date ERA/Planner390×844 comparison.

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on SCH-4.3b and SCH-14; it is consumer parity *after* the single engine exists, and the acceptance forbids an independent expansion engine — ERA must call the same one. The ERA-side consumer is `src/features/era/intents/resolvers/schedule.ts`, which today imports `src/lib/utils/dayOccurrences.ts` (one of the engines SCH-4.3b deletes), so this item is partly the migration of that resolver. Planner and agenda: `src/components/planner/WebDayPlanner.tsx`, `src/app/reminders/`. Due-state and flexible placement semantics live in `src/lib/schedule/materializeOccurrence.ts` and `alertResolution.ts`; flexible work comes from `item_flexible_schedules`, handled in `src/components/web/WebCalendar.tsx` today. KIT-4 is the same unavailable-vs-empty problem on the meals side.

### SCH-9

**Outcome:** Give online and replayed reminders equal alert semantics.

- **Acceptance:** UU-X2: online draft reminder creation and queued API replay must produce the same intended alerts. Documented online hook omitted the active alert that replay adds; cover retries and offline-to-online transitions.

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The asymmetry has a concrete home: `src/app/api/items/route.ts` creates alerts from `body.alerts` when present, and **otherwise** — `else if (body.due_at)` — auto-inserts a default `push` alert at `resolveAlertBaseTime(...)`. Replayed operations go through this route and get that default; an online client path that posts an explicit empty `alerts` array skips it. So read the online creation hook in `src/features/items/useItems.ts` and compare the body it sends with what the replay queue stores. Queue side: `src/lib/offlineQueue.ts` (`addToQueue`, `getAllPending`, `updateQueuedOperation`, `findPendingOperation`, `cancelCreateDeletePair`) and `src/lib/offlineSyncEngine.ts`; background in `ERA Notes/01 - Architecture/Sync and Offline.md`. Cover retries and the offline→online transition; the fix belongs at whichever layer makes both paths produce one intended alert set, not a second default.

### SCH-10

**Outcome:** Verify prerequisite access against current RLS.

- **Acceptance:** H-01 and Aug19 Inbox: owner supplies item_prerequisites and parent/child read-path RLS state. Preserve intended household access and choose an approved hot-child contract only from current evidence.

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Evidence-first, and Hard Rule #27's gate applies literally — this is a "who can read what" question, so **read `migrations/db-state.json` before any route code**; `schema.sql` cannot answer it and the repo has been wrong about the items family before. The tables are `item_prerequisites` plus the parent/child read path (`items` and its hot children `item_alerts`, `item_subtasks`, `reminder_details`, `event_details`, `item_recurrence_rules`, `recurrence_pauses`). Hard Rule #20 forbids an EXISTS-subquery policy on any of those; the two approved contracts are a SECURITY DEFINER bundle RPC (`get_schedule_bundle` is the canonical one) or a denormalized `user_id` with a trigger. Routes: `src/app/api/items/[id]/prerequisites/` and the evaluators in `src/lib/prerequisites/`. Preserve intended household access (Hard Rule #13); agents never apply SQL (#26).

### SCH-14

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C04b. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Preserve occurrence identity through every action.

- **Acceptance:** Catalogue C04b: one stable occurrence/slot identity across subtasks, alerts, completion, exceptions and replay. Verify existing series actions and DST boundaries, not just display dates.
- **Depends on:** [SCH-4.3b](<Schedule — Master Book.md#sch-43b>).

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on SCH-4.3b. "One stable occurrence/slot identity" is the missing primitive — today an occurrence is identified positionally by date, which is why subtasks, alerts, completion and exceptions can drift apart. Read `src/lib/schedule/materializeOccurrence.ts` (`materializeOccurrence`, `OVERRIDABLE_FIELDS`, `OverridePayload`, `isSkippedException`, `isRescheduledException`) and `alertResolution.ts` (`getSeriesAlert`, `getOccurrenceAlert`, `findExceptionForDate`) as the current contract, plus `recurrence_pauses` and the occurrence-action rows. `.claude/skills/recurrence-safety/SKILL.md` is mandatory. DST boundaries are the named trap, so `.claude/skills/timezone-handling/SKILL.md` too — verify the stored instant, not the rendered date. NOTIF-20 and SCH-15/19 all wait on this.

### SCH-2.1

**Outcome:** Parse "at home" / "when I get home".

- **Acceptance:** Parse "at home" / "when I get home" → set `location_context: "home"`.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Small parser addition with a field that already exists: `location_context?: "home" | "outside" | "anywhere" | null` is declared three times in `src/types/items.ts` (verified 2026-09-20), so nothing schema-side is needed — just set it. The parser is `parseSmartText()` in `src/lib/smartTextParser.ts`, whose `ParsedItem` interface is the shape to extend. Keep extraction conservative in the same spirit as SCH-1b.4. SCH-2.2 is the harder half (mapping the *phrase* to a tag); this item only sets the enum.

### SCH-2.2

**Outcome:** Map the phrase "home".

- **Acceptance:** Map the phrase "home" → the user's tag via `nfc_tags.label` → attach an `nfc_state_change` prerequisite (arrive-home). → `src/lib/prerequisites/evaluators/nfc-state.ts`

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends conceptually on SCH-2.1. The evaluator named in the acceptance exists: `src/lib/prerequisites/evaluators/nfc-state.ts`, registered in `src/lib/prerequisites/evaluators/index.ts`, with the prerequisite write path at `src/app/api/items/[id]/prerequisites/route.ts`. The mapping is phrase → `nfc_tags.label` → an `nfc_state_change` prerequisite, so read the NFC module first (`src/features/nfc/hooks.ts`, `src/app/api/nfc/`, `src/app/nfc/[tag]/`) — it has its own slug-URL hard rule in `ERA Notes/02 - Standalone Modules/NFC Tags/`. Prerequisites is a Junction module (`ERA Notes/03 - Junction Modules/Prerequisites/`): trace the dormant→pending activation cascade before writing. An unmatched label must attach nothing rather than guess a tag.

### SCH-2.3

**Outcome:** Pre-fill the existing `PrerequisitePicker` from parsed text (plumbing already wired in the form).

- **Acceptance:** Pre-fill the existing `PrerequisitePicker` from parsed text (plumbing already wired in the form).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Plumbing is already wired, so this is small. The component is `src/components/items/PrerequisitePicker.tsx`; the source of the parsed values is `ParsedItem` from `parseSmartText()` in `src/lib/smartTextParser.ts`; the form that hosts both is `src/components/reminder/MobileReminderForm.tsx`. Pre-fill means proposing a selection the user can change, not committing one — the same propose-then-confirm rule as SCH-1c.2. Depends in practice on SCH-2.1/2.2 producing something to pre-fill.

### SCH-3.1

**Outcome:** Lightweight **one-question** clarification for ambiguous phrases ("later".

- **Acceptance:** Lightweight **one-question** clarification for ambiguous phrases ("later" → Tonight / Tomorrow / Pick time); never block a simple save.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** A one-question clarification that must never block a simple save — that clause is the design constraint. The ambiguity is detected in `src/lib/smartTextParser.ts` (`parseSmartText`, and the readback helpers `getTimeDescription`/`getDateDescription` show what the app already knows how to say); the ask lands in `src/components/reminder/MobileReminderForm.tsx`. This is the softer alternative to SCH-7's refusal: use it for under-specification ("later"), not for unsupported recurrence. Hard Rule #28 — three chips, no explanatory sentence.

### SCH-3.2

**Outcome:** Compact, on-brand chip preview obeying the look-and-feel Hard Rules (`useThemeClasses()`, opaque panels via `tc.bgPage` #15, no hardcoded colors #10,….

- **Acceptance:** Compact, on-brand chip preview obeying the look-and-feel Hard Rules (`useThemeClasses()`, opaque panels via `tc.bgPage` #15, no hardcoded colors #10, futuristic SVG icons #4, Undo toast #1, `inputMode="decimal"` #19, mobile-first #5).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Pure UI, and the acceptance is a list of hard rules rather than a design. Read `.claude/skills/ui-guardrails/SKILL.md` first; it operationalizes all of them. The chips render in `src/components/reminder/MobileReminderForm.tsx` from `ParsedItem` (`src/lib/smartTextParser.ts`). The specific traps: `useThemeClasses()` for colours and `tc.bgPage` for any floating panel (#15 — never `neo-card` over page content), no hardcoded backgrounds (#10), person-absolute colour identity from `useTheme()` (#14), `type="text"` + `inputMode="decimal"` for any numeric field (#19), Undo on toasts (#1), and mobile-first verification (#5).

### SCH-4.4

- **Retained campaign gate (D2):** DEC-10 must resolve whether time_window is mandatory; the old unconditional DoD is not silently waived or falsely completed.

**Outcome:** `time_window` prerequisite evaluator (one of the 4 inert).

- **Acceptance:** `time_window` prerequisite evaluator (one of the 4 inert) — optional, only if a feature needs it.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Parked and explicitly optional — "only if a feature needs it", so confirm a caller exists before starting. Verified 2026-09-20: `src/lib/prerequisites/evaluators/time-window.ts` is a stub returning `{ met: false, reason: "Time window evaluation not yet implemented" }`, registered in `evaluators/index.ts` alongside `weather.ts` (also a stub), `nfc-state.ts`, `item-completed.ts`, `schedule.ts` and `custom-formula.ts`. Implementing it means deciding the timezone semantics of `{ start, end, days }` — `.claude/skills/timezone-handling/SKILL.md`, and remember the app's custom month-start/`startOfCustomMonth` convention lives in `src/lib/utils/date.ts`.

### SCH-4.5

**Outcome:** Split `useItems.ts` (~2,621 LOC).

- **Acceptance:** Split `useItems.ts` (~2,621 LOC) — only when a feature next forces you in, not "just because."

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Parked with an explicit trigger: split only when a feature forces you in, not on principle. Verified 2026-09-20 the file is `src/features/items/useItems.ts` at **2,670 lines** (the quoted ~2,621 is stale, and note it is under `src/features/items/`, not `src/hooks/`). Before splitting, read `.claude/skills/cache-invalidation/SKILL.md` and `src/features/items/queryKeys.ts` — the risk in a split is diverging query keys and invalidation, not the line count. `ERA Notes/01 - Architecture/Common Patterns.md` covers the optimistic-mutation and ID-only-state idioms it implements.

### SCH-5.2

**Outcome:** Give each surface **one job** per the surface map (Month / Week / Today / Form).

- **Acceptance:** Give each surface **one job** per the surface map (Month / Week / Today / Form).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Design/consolidation work over four surfaces: Month (`src/components/web/WebCalendar.tsx`), Week, Today (`src/components/web/WebTodayView.tsx`) and the Form (`src/components/reminder/MobileReminderForm.tsx`), plus the planner (`src/components/planner/WebDayPlanner.tsx`) and `/reminders` tabs (`src/app/reminders/`). The surface map lives in the Items & Reminders vault doc; read `ERA Notes/01 - Architecture/Design Doctrine.md` before deciding anything, since no playbook covers "give each surface one job". Overlaps heavily with SCH-4.3b — the duplicated expansion logic is part of why surfaces have blurred jobs — so sequence after it. Do not restructure a flagship UI beyond what the item asks.

### SCH-5.3

**Outcome:** Investigate the [MobileReminderForm.tsx](<../../../src/components/reminder/MobileReminderForm.tsx>) vs….

- **Acceptance:** Investigate the [MobileReminderForm.tsx](<../../../src/components/reminder/MobileReminderForm.tsx>) vs [MobileItemForm.tsx](<../../../src/components/items/MobileItemForm.tsx>) **duplication** — decide keep/merge/retire. **No deletion without a decision.**

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** An investigation with an explicit no-deletion-without-a-decision clause. The facts: `src/components/reminder/MobileReminderForm.tsx` is 1,762 lines and `src/components/items/MobileItemForm.tsx` is 1,363 (verified 2026-09-20), and **`MobileItemForm` has no importer anywhere in `src/`** — its only occurrence is its own file. That is strong evidence for "retire", but the acceptance wants the decision recorded, not inferred. Check `src/app/reminders/` and `src/components/items/` for any dynamic/lazy reference before concluding. Record the outcome in `_Decisions.md`; SCH-1.9 should then document it.

### SCH-5.4

**Outcome:** Reassignment **history / audit** trail.

- **Acceptance:** Reassignment **history / audit** trail — "who had it when" (W8).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** An audit trail for reassignment — "who had it when". The field is `responsible_user_id` on `items` (the same one Trips' solo-trip cascade flips, see TRIP-2), written through `src/app/api/items/[id]/route.ts` and `src/features/items/useItems.ts`. A history table is a DB change: Hard Rules #24 (migration file, then `schema.sql`), #26 (hand the SQL to the owner) and #27/#20 (give the child table a policy in the same migration, and never an EXISTS-subquery one). Colour the two people by Hard Rule #14 — person-absolute, derived from `useTheme()`, never role-relative.

### SCH-6.1

**Outcome:** Retire the task type across storage and surfaces.

- **Acceptance:** *(packet **M-09** of the [ERA Top Layer — Master Plan](<../_Archive/Plans/ERA Top Layer — Master Plan (2026-09-02).md>), Lane M while native waits; split M-09a DB+types / M-09b surfaces+docs)* Retire the `task` type end-to-end (DB + all surfaces + the `ItemType` union + docs). Do this as one dedicated slice before touching the DB.

- **Acceptance:** no `task` value remains in the `ItemType` union, any surface, or the DB; existing `task` rows are migrated with a paired migration file.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** A dedicated slice, split DB+types then surfaces+docs, and the acceptance says do the DB part alone first. The union is `ItemType = "reminder" | "event" | "task"` in `src/types/items.ts`; `"task"` also appears in `src/types/aiUsage.ts` (`item_type`) and three places in `src/types/catalogue.ts` (verified 2026-09-20) — grep the whole repo, because CLAUDE.md's enum rule requires DB + TS type + API route + UI + utilities to move together. Existing `task` rows need a paired migration (Hard Rules #24/#26: file first, `schema.sql` second, owner runs it). Surfaces to sweep: `src/app/reminders/`, `src/components/items/`, `src/components/web/`, `src/components/reminder/`. Chores are a separate module (`src/features/chores/`) — do not fold them in.

### SCH-11

**Outcome:** Audit the arrive and leave NFC experience.

- **Acceptance:** Preserve the NFC Inbox proposal: inspect both arrive/leave flows and their UI, then identify a bounded useful change. Schedule owns the behavior with Native consuming existing tags; no new campaign, geofencing or speculative revamp. Native bridge first.
- **Depends on:** [NAT-6](<../Native App/Native App — Master Book.md#nat-6>).

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** An audit that must stay bounded — the acceptance forbids a revamp, geofencing or a new campaign, and puts the native bridge (NAT-6) first. Read both flows before proposing anything: `src/app/nfc/[tag]/`, `src/app/nfc/nfc-admin-client.tsx`, `src/features/nfc/hooks.ts`, `src/app/api/nfc/`, and the arrive/leave semantics in `src/lib/prerequisites/evaluators/nfc-state.ts` with its registration in `evaluators/index.ts`. NFC Tags has its own slug-URL hard rule (`ERA Notes/02 - Standalone Modules/NFC Tags/`) and Prerequisites is a Junction module whose dormant→pending cascade you must trace (`ERA Notes/03 - Junction Modules/Prerequisites/`). Output is one identified bounded change, not a plan.

### SCH-12

**Outcome:** Separate estimated and observed schedule duration.

- **Acceptance:** PE-X1: defaulted/prefilled actual duration must not count as measured completion evidence. Preserve provenance through writes, reads and calibration; no invented backfill.

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The same provenance problem as KIT-13, on schedule durations: a defaulted or prefilled duration must not be readable later as measured completion evidence. Read the write boundary in `src/app/api/items/[id]/route.ts` and the duration fields in `migrations/schema.sql`, then the prefill sites in `src/components/reminder/MobileReminderForm.tsx` and the planner (`src/components/planner/WebDayPlanner.tsx`, which is where estimates drive placement). Carry a basis flag through write → read → calibration and use only observed values to calibrate. "No invented backfill" — existing rows whose basis is unknown stay unknown.

### SCH-13

**Outcome:** Project canonical recurrence into Google Calendar.

- **Acceptance:** After canonical Schedule parity, project supported recurrence/exception semantics without a second engine. NOTIF-6.6 proves delivery/credentials/device alarms and does not alone certify semantic projection.
- **Depends on:** [SCH-8](<Schedule — Master Book.md#sch-8>).

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on SCH-8 (canonical parity) — projecting recurrence before the app agrees with itself would export the disagreement. The sync layer is `src/lib/gcal/sync.ts` (`syncItemToGoogleCalendar`, `deleteItemFromGoogleCalendar`) over `src/lib/gcal/client.ts`, with drift healing in `src/app/api/cron/gcal-reconcile/route.ts`. "Without a second engine" is the constraint: the RRULE and exception set must come from the canonical expansion path (`src/lib/schedule/expandOccurrences.ts` after SCH-4.3b) and `materializeOccurrence.ts`'s exception vocabulary, translated for Google — not recomputed. NOTIF-6.6 proves credentials and delivery and says nothing about semantics, so the acceptance keeps them separate. DST is the failure mode: `.claude/skills/timezone-handling/SKILL.md`.

### SCH-15

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C05. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Activate reusable definitions atomically.

- **Acceptance:** Catalogue C05: explicit activation checks source rights and destination, commits one execution instance with lineage and handles replay through the existing queue. No phantom success or duplicate activation.
- **Depends on:** [SCH-14](<Schedule — Master Book.md#sch-14>), [HUB-46](<../Hub & ERA/Hub & ERA — Master Book.md#hub-46>), [KIT-20](<../Kitchen/Kitchen — Master Book.md#kit-20>).

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Catalogue C05, and the first of the definition/execution family (C05–C08 → SCH-15/16/17/18). Depends on SCH-14's stable occurrence identity, HUB-46 and KIT-20. The promotion/lineage precedent already exists: `src/app/api/items/[id]/promote/route.ts` writes `source_catalogue_item_id`, and `src/app/api/items/route.ts` accepts it on create — read both before designing activation. "Handles replay through the existing queue" means `src/lib/offlineQueue.ts` and `src/lib/offlineSyncEngine.ts`, so activation must be idempotent under replay: a unique constraint plus 409 (Hard Rule #9), not a best-effort check. "No phantom success" is the same truthfulness rule as TRIP-29 — a zero-row write is not a success.

### SCH-16

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C06. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Promote definitions without rewriting executions.

- **Acceptance:** Catalogue C06: promotion creates a reusable definition while existing execution IDs/history remain unchanged. Permission and revision preconditions apply.
- **Depends on:** [SCH-15](<Schedule — Master Book.md#sch-15>).

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Catalogue C06, depends on SCH-15. The invariant is that promotion creates a *definition* and leaves every existing *execution* row untouched — same IDs, same history. Read `src/app/api/items/[id]/promote/route.ts` (the existing item→catalogue promotion) and `src/features/catalogue/hooks.ts` (`useCreateItem`, `useUpdateItem`) for the destination. Revision preconditions are KIT-20's deliverable — do not invent a second staleness scheme here. Permission checks follow the household rules in Hard Rule #13.

### SCH-17

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C07. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Pause, stop and resume one activation coherently.

- **Acceptance:** Catalogue C07: preserve one activation’s history and future schedule intent through pause/stop/resume. Existing recurrence exceptions remain authoritative; no cloned execution to simulate resume.
- **Depends on:** [SCH-15](<Schedule — Master Book.md#sch-15>).

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Catalogue C07, depends on SCH-15. "No cloned execution to simulate resume" is the load-bearing clause: pause/stop/resume must move one activation through states, not create a second row. The existing pause machinery is `recurrence_pauses` plus the exception vocabulary in `src/lib/schedule/materializeOccurrence.ts` (`isSkippedException`, `isRescheduledException`) — the acceptance says existing recurrence exceptions stay authoritative, so resume must not overwrite them. `.claude/skills/recurrence-safety/SKILL.md` is mandatory; pausing and resuming is exactly where duplicate generation has bitten before. Trips' `activate_trip` also writes `recurrence_pauses` (TRIP-1) — check you are not fighting it.

### SCH-18

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C08. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Apply reusable defaults only to future work.

- **Acceptance:** Catalogue C08: future-only defaults, accurate usage and inverse-source reads preserve completed/past execution values and lineage.
- **Depends on:** [SCH-16](<Schedule — Master Book.md#sch-16>), [SCH-17](<Schedule — Master Book.md#sch-17>).

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Catalogue C08, depends on SCH-16 and SCH-17. "Future-only" means a definition edit changes what future activations inherit and never rewrites a completed or past execution — so the read path must resolve defaults at activation time and store the resolved values, or resolve-through-lineage without mutating history. The lineage column is `source_catalogue_item_id`; the catalogue metadata write path is `src/app/api/catalogue/items/[id]/route.ts` (which KIT-20 is making typed and revision-checked). "Accurate usage" means a count that reflects real activations, which is the same care `times_cooked` needed in KIT-11.

### SCH-19

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C18. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Offer explicit updates to future activations.

- **Acceptance:** Catalogue C18 P2 held: opt-in future updates only after C04–08 acceptance, with preview, rights and revision checks. Never rewrite existing history or silently propagate template edits.
- **Depends on:** [SCH-14](<Schedule — Master Book.md#sch-14>), [SCH-15](<Schedule — Master Book.md#sch-15>), [SCH-16](<Schedule — Master Book.md#sch-16>), [SCH-17](<Schedule — Master Book.md#sch-17>), [SCH-18](<Schedule — Master Book.md#sch-18>).

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Catalogue C18 P2, held until C04–C08 (SCH-14/15/16/17/18) are all accepted — so its guide is really theirs; read them first and do not start this early. The two prohibitions are the design: never rewrite existing history, and never silently propagate a template edit. That makes it opt-in with a preview, which means a diff between the current activation and what the definition now says — the nearest existing precedent for "show me what will change before I accept" is Delivery's plan-approval flow, and for rights/revision checks it is KIT-20's preconditions. Surfaces: `src/features/catalogue/` and `src/app/reminders/`.

## Shipped Log

- ✅ 2026-05-31 — partner-edit 403 fixed: the PATCH route ran its own creator-only check **stricter than the RLS policy underneath**; now uses `canMutateItem()` (creator OR responsible OR public+partner), matching `items_update`
- ✅ 2026-05-31 — DELETE shares the same `canMutateItem()` guard, matching `items_delete`
- ✅ 2026-05-31 — edit and "act" made consistent — the same household-aware predicate everywhere
- ✅ 2026-05-31 — **myth corrected**: RLS *is* enabled on `items` and every child table; the repo's `schema.sql` was stale because the Supabase export captures tables only (`migrations/_verify_schedule_rls.md`)
- ✅ 2026-06-06 — "Pass to partner" / "Take it back" one-tap actions in `ItemActionsSheet` with Undo toast (no new endpoint — RLS already permits it)
- ✅ 2026-06-06 — "Assigned to me" and "Assigned out" collapsible sections with one-tap Return/Reclaim
- ✅ 2026-06-06 — **Decision 1 shipped**: `/focus` page retired (`FocusPage`, `FlexibleRoutinesPool`, `ScheduleRoutineSheet` deleted); Focus becomes a per-item action; Week view's "Flexible this week" strip covers routine assignment
- ✅ 2026-06-06 — **Decision 3 shipped**: schema drift captured — table DDL, `get_schedule_bundle` body and all RLS policies now in `migrations/schema.sql`
- ✅ 2026-06-06 — capture friction addressed on the live form (`MobileReminderForm.tsx`): title-only "someday" save, quick date chips, At-Home/Place/Map location
- ✅ 2026-06-16 — **Plan My Day** shipped: `/today` triage page for one-time/recurring/flexible items landing on a day, push-off, both-direction prepone, ad-hoc tasks, checkpoints, persisted via `day_plans`
- ✅ 2026-06-16 — Plan My Day save-gated draft model replaced auto-save-per-keystroke (edit form + one Save vs read-only preview card with Edit/Delete)
- ✅ 2026-06-17 — **W9 surface consolidation**: `/reminders` merged with Plan My Day into `WebDayPlanner.tsx`; `StandaloneRemindersPage.tsx` deleted; `/today` redirects
- ✅ 2026-06-19 — **Recurrence Stage 1**: the "skip → next occurrence" trap removed from **four** surfaces (`WebEvents`, `ItemActionsSheet`, `WebTabletMissionControl`, `ItemDetailModal`); `calculateNextOccurrence` and the `next_occurrence` postpone type deleted
- ✅ 2026-06-19 — real **Skip this occurrence** wired everywhere (`onSkip` → `handleSkip`/`useSkipItem` on all 4 callers); Cancel is now one-off-only; `WebTabletMissionControl`'s misleadingly-named `handleSkip` renamed and branched correctly
- ✅ 2026-06-19 — `/reminders` show/hide-completed toggle (Eye/EyeOff in the FilterBar, default hide, `localStorage`-persisted) + collapsible "Completed (n)" section
- ✅ 2026-06-19 — occurrence-action unit tests (`src/lib/utils/dayOccurrences.test.ts`): the exact repro (skip a past occurrence → no duplicate), complete, move-to-date, postponed/next-occurrence collision dedup, `isOccurrenceCompleted` per action type
- ✅ 2026-06-21 — "Responsible: All Household" badge no longer hides the real assignee — `ResponsibleUserBadge` always renders, "Notifying household" becomes a supplementary badge
- ✅ 2026-06-21 — **All-Household reminders now buzz both phones**: the `item-reminders` cron used `.maybeSingle()` on `household_links`, which *errors* on >1 active row (re-linking leaves stale-but-active rows), silently falling back to creator-only. Now collects every owner/partner id across all active links into a deduped Set
- ✅ 2026-06-21 — a completed occurrence older than 30 days keeps its strikethrough — `useAllOccurrenceActions` filtered `item_occurrence_actions` by *occurrence* date, so old occurrences never reached `isOccurrenceCompleted`; the window was removed entirely
- ✅ 2026-06-21 — **Decision 4 shipped**: all four occurrence-action inserts are idempotent `.upsert(..., { onConflict: "item_id,occurrence_date,action_type" })`, ending the 500-then-retry-forever loop on double-tap/offline replay
- ✅ 2026-07-10 — **Google Calendar sync** (`2783b1d`, 12 files, +727): OAuth connect/callback/connection routes, `sync-item`, `google_calendar_connections` table, `items.google_synced_at`, and a two-pass idempotent `cron/gcal-reconcile` (migration `2026-07-10_google-calendar-sync.sql`)

## Delivery session log

*(Delivery runner appends dated progress bullets here automatically.)*

## Successor Briefing

Read the checklist, the selected acceptance entry and its dependencies; then use the [Feature Map](<../../01 - Architecture/Feature Map/_index.md>) for source routing and the module architecture docs for invariants. Delta from the source cutoff before implementation. Use current owner-supplied DB evidence for access/application questions; agents never apply production SQL. Record code, applied migration and device/runtime acceptance separately.

Finish with the repository playbook and [governance](<../_Conventions.md>): update acceptance/evidence, sweep only completed work, and validate the canonical queue. A completed child does not complete its coordination parent.
