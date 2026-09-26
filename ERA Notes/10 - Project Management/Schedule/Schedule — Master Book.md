---
created: 2026-09-10
updated: 2026-09-26
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

All open items include [item execution plans](<../_Conventions.md#9-item-execution-plans>). Read only the chosen ID and its prerequisites. These are unreviewed implementation references; the checklist remains the sole queue and owner evidence remains separate.

### SCH-4.2

**Outcome:** Verify cross-view recurrence placement.

- **Acceptance:** Verify broader per-view placement semantics; WebTodayView now delegates through the shared day path, so the old known-red-source claim is stale. This does not prove pause/exception/flexible parity or close broader coverage.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide (rechecked 2026-09-26):** Today, Planner and ERA currently call `src/lib/utils/dayOccurrences.ts`; the old claim that Today/Planner also import the canonical expander is not current. That day helper expands through `getOccurrencesInRange` independently of `src/lib/schedule/expandOccurrences.ts`; Calendar also has local occurrence selection using date helpers. Compare actual behavior, including pause/exception materialization, handled state and `item_flexible_schedules` placement. Start with `src/lib/schedule/expandOccurrences.test.ts` and `src/lib/utils/dayOccurrences.test.ts`. This item gates SCH-1b.4; helper imports alone are not parity evidence.

**Execution plan — 2026-09-26**

**Readiness:** Investigation first; add behavioral evidence before recurrence changes. The 2026-09-20 import inventory needs correction.

**Verify:** `pnpm exec vitest run src/lib/schedule/expandOccurrences.test.ts src/lib/utils/dayOccurrences.test.ts` as baseline; add proposed shared per-view fixtures for pause, skip, move, override, midnight, DST and two same-day flexible placements. Capture the same fixture at 390×844.

```delivery-plan-v1
{
  "outcome": "Identify exactly where Schedule views disagree about placement and occurrence state.",
  "acceptance": [
    "One named fixture has explicit expected identities, times and handled state per applicable view.",
    "Differences are assigned to adapter, identity or consumer work; a passing Today path does not certify all views."
  ],
  "scope": [
    "src/lib/schedule/expandOccurrences.test.ts",
    "src/lib/utils/dayOccurrences.test.ts"
  ],
  "steps": [
    "Inventory actual callers of dayOccurrences, expandOccurrencesForRange and getOccurrencesInRange; record source paths rather than trusting historical import claims.",
    "Construct a compact fixture corpus covering fixed/one-off/flexible work, active pause, skipped origin, moved destination and completed origin.",
    "Run both current readers with the corpus and trace each view's inputs/filters; separate missing data from expansion defects.",
    "Record failing cases for SCH-4.3b, SCH-14 and SCH-8. Add per-view tests as a separately named scope extension before editing those consumers."
  ],
  "invariants": [
    "Verification must compare behavior, not merely imported function names.",
    "Skip creates no replacement occurrence; two placements are not one date-only identity."
  ],
  "exclusions": [
    "New recurrence engine.",
    "Layout changes.",
    "Claiming owner/device acceptance from unit tests."
  ],
  "checks": [],
  "risks": [
    "The day helper includes the next midnight and turns hour zero into nine.",
    "Calendar's helper use can still differ from canonical exception/paused semantics."
  ],
  "unknowns": [
    "Full per-view failure matrix has not been executed in this docs pass."
  ],
  "dependencies": [],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26: current day/core helpers and Today/Planner/Calendar/ERA caller references inspected at HEAD 45b2889; tests not run."
}
```

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

- **Reading guide (rechecked 2026-09-26):** Read recurrence-safety, the Scope split and Catalogue C04a before changing `dayOccurrences.ts`, `expandOccurrences.ts` or `materializeOccurrence.ts`. The retained all-surfaces deletion wording conflicts with ASTRA-SCH-1/C04a's instruction to preserve the day adapter API. Resolve that wording before dispatch; a compatibility adapter can remain while its independent expansion is removed. SCH-14 owns identity through effects, SCH-8 owns remaining consumer migration, and this ID still retains its shared-action-sheet obligation. No third engine and no skip-as-postpone.

**Execution plan — 2026-09-26**

**Readiness:** Split first. Execute C04a adapter/core repair first; shared action-sheet work needs its own bounded slice. Resolve the retained delete-helper wording against the newer compatibility contract before dispatch.

**Verify:** `pnpm exec vitest run src/lib/schedule/ src/lib/utils/dayOccurrences.test.ts` — explicit half-open day boundary, 00:30, DST, move onto another occurrence, pause/override and flexible slot cases; no test-count reduction. Compare Today/Planner mobile fixtures.

```delivery-plan-v1
{
  "outcome": "The existing day/range API delegates to one canonical occurrence engine without losing placement or origin.",
  "acceptance": [
    "The bounded adapter has no independent recurrence expansion and preserves its callers' handled-state needs.",
    "C04a completion is recorded separately from action-sheet work, SCH-14 identity and SCH-8 all-view parity."
  ],
  "scope": [
    "src/lib/utils/dayOccurrences.ts",
    "src/lib/schedule/expandOccurrences.ts",
    "src/lib/schedule/materializeOccurrence.ts",
    "src/lib/utils/dayOccurrences.test.ts",
    "src/lib/schedule/expandOccurrences.test.ts"
  ],
  "steps": [
    "Use SCH-4.2's matrix and Catalogue C04a to resolve half-open bounds, legacy moved actions and flexible inputs at the current helper boundary.",
    "Extend the canonical expander/materializer only where fixtures require it; preserve origin, materialized overrides, pause semantics and handled-state projection.",
    "Make dayOccurrences a compatibility adapter over that core, preserving midnight and distinct placements; do not delete its public API while consumers still import it.",
    "Run the fixture corpus and inspect every changed caller contract. Record the remaining shared-action-sheet slice under this ID and consumer migration under SCH-8."
  ],
  "invariants": [
    "No third engine or skip-as-postpone.",
    "No date-only collapse of distinct slots.",
    "UTC storage and established timezone helpers remain authoritative."
  ],
  "exclusions": [
    "Global helper deletion in the first slice.",
    "DB migration unless a separately reviewed bundle-input gap is proven.",
    "Redesigning Schedule views."
  ],
  "checks": [],
  "risks": [
    "Inclusive range callers can gain or lose midnight rows.",
    "Existing text both demands deletion and preserves the adapter API."
  ],
  "unknowns": [
    "Exact remaining action-sheet scope after the bounded core witness."
  ],
  "dependencies": [
    "SCH-4.2"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: day/core source and accepted Catalogue C04a/b/c inspected; old all-surfaces wording retained as campaign gate."
}
```

### SCH-7

**Outcome:** Refuse unsupported recurrence before capture.

- **Acceptance:** Unsupported recurrence is refused before creating a one-time reminder or a misleading pending turn; blocks safe E-09 conversational capture.

**Retained contract — ASTRA-SCH-2:**

- **Outcome:** A recurring request cannot be acknowledged as recurring after creating a one-time reminder.
- **Boundary:** Guard parsed recurrence before writeReminder and before an incomplete request becomes a pending turn; guard the pending answer too. Return existing structured-form handoff/refusal and unsuccessful outcome, with original input recoverable. No POST, no fake recurring success, no new recurrence parser. Preserve explicit one-time requests.
- **Money/schedule math?:** Yes: “every Monday at9” → zero one-time rows, no false recurring receipt; “Monday at9” → one existing nonrecurring path. Pending-time response containing recurrence likewise writes zero.
- **Gate:** `pnpm exec vitest run src/features/era/intents/resolveIntent.test.ts --reporter=verbose` → nonzero initial/pending recurrence and one-time control cases pass; mocked POST count0 for unsupported cases. Common gates; 390×844 capture preserves input and existing form door.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide (rechecked 2026-09-26):** The concrete boundary is `src/features/era/intents/resolvers/schedule.ts`: `resolveDraftReminder` and `resolvePendingReminderAnswer` pass parsed recurrence to `writeReminder`, whose POST omits recurrence while its receipt says recurring. Guard before pending-turn creation and before either write path; reuse the existing structured-form handoff and `ok: false`. `src/lib/smartTextParser.ts` supplies parsed recurrence; this item adds no parser or recurring writer. `src/features/era/intents/resolveIntent.test.ts` must assert zero POSTs for unsupported initial and pending inputs.

**Execution plan — 2026-09-26**

**Readiness:** Implementation draft; source inspection identifies the false-recurring-success path. Reproduce it with the named fixtures before editing.

**Verify:** `pnpm exec vitest run src/features/era/intents/resolveIntent.test.ts` — recurring initial input, recurring input without time, recurring pending answer and one-time control. Unsupported cases must make zero POSTs and return `ok: false`; mobile form handoff preserves input.

```delivery-plan-v1
{
  "outcome": "ERA refuses unsupported recurring capture before any one-time write or misleading pending turn.",
  "acceptance": [
    "Every unsupported recurring path writes nothing and preserves recoverable input.",
    "An ordinary one-time reminder continues through the existing creation path."
  ],
  "scope": [
    "src/features/era/intents/resolvers/schedule.ts",
    "src/features/era/intents/resolveIntent.test.ts",
    "src/features/era/intents/formatters/schedule.ts"
  ],
  "steps": [
    "Add failing resolver fixtures for initial recurrence with/without a due date and recurrence introduced while answering a pending time question.",
    "Check parsed recurrence before pending-turn creation and before writeReminder; apply the same guard to the pending-answer path, including retained original input.",
    "Return the existing recurring-form handoff/refusal with an unsuccessful outcome; clear or preserve pending state deliberately so a later answer cannot turn the rejected recurrence into one-time work.",
    "Verify zero API calls for refused inputs and the existing one-time success payload/receipt. Change formatter wording only if needed for the existing handoff."
  ],
  "invariants": [
    "Receipt semantics match the actual stored request.",
    "No model-generated direct write or new recurrence parser.",
    "Unsupported recurrence never silently downgrades to one-time."
  ],
  "exclusions": [
    "Implementing recurring creation in ERA.",
    "Changing form RRULE support.",
    "General pending-turn rerouting."
  ],
  "checks": [],
  "risks": [
    "Guarding only writeReminder leaves misleading pending turns alive.",
    "Guarding only the initial utterance misses a recurring pending answer."
  ],
  "unknowns": [],
  "dependencies": [],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26: schedule resolver lines 140–264 inspected: recurrence affects receipt but is absent from POST; existing resolver test file verified."
}
```

### SCH-5.5

**Outcome:** Finish mobile reminder form cleanup and verification.

- **Acceptance:** Mobile-form cleanup carried from the R3–R8 rounds: add **Undo** to success toasts (Hard Rule #1), remove the stray `console.error` in the submit/speech handler (Hard Rule #22), drop the unused `missingFieldType` state, and do the real-device visual check across themes.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Four small, verified items in one file, `src/components/reminder/MobileReminderForm.tsx` (1,762 lines — the live form; `MobileItemForm.tsx` is dead, see SCH-5.3). (1) Undo: `toast.success("Event created!")` around line 724 and `toast.success("Reminder created!")` around line 764 have no Undo — the file contains **zero** occurrences of "Undo" (Hard Rule #1; use `ToastIcons` from `src/lib/toastIcons.tsx`). (2) `console.error` at ~line 385 in the speech-recognition handler and ~line 772 in the submit handler (Hard Rule #22 — client code, so both must go; the Error Logs module is the sanctioned sink). (3) `missingFieldType` — **it no longer exists in the file** (0 matches), so that sub-item is already done; say so rather than hunting. (4) Real-device visual check across all four themes on a mobile viewport (Hard Rules #5, #10).

**Execution plan — 2026-09-26**

**Readiness:** Implementation draft; missingFieldType is already absent and is not work to recreate.

**Verify:** `rg -n 'console\.(log|warn|error)|missingFieldType|toast.success|Undo' src/components/reminder/MobileReminderForm.tsx`; `pnpm typecheck`. Verify Reminder and Event create→Undo with isolated data, failed submit, speech failure and four themes at 390×844; real-device confirmation stays owner UAT.

```delivery-plan-v1
{
  "outcome": "The live reminder form offers working Undo and finishes the documented client cleanup.",
  "acceptance": [
    "Both success paths expose an inverse that removes the created item and refreshes affected views.",
    "No stray client console errors remain in the named speech/submit paths; theme/device verification is recorded honestly."
  ],
  "scope": [
    "src/components/reminder/MobileReminderForm.tsx"
  ],
  "steps": [
    "Read each create result and existing delete mutation; capture the returned item identity before resetting the form.",
    "Add Undo to event and reminder success toasts using the established item inverse and ToastIcons, including queued-create cancellation behavior.",
    "Remove the two client console.error calls while retaining visible failure feedback or the existing structured error sink; confirm missingFieldType remains absent.",
    "Exercise creation, Undo and failure states across themes; record source/browser verification separately from the owner's physical-device result."
  ],
  "invariants": [
    "Undo targets the item created by that toast, never current form state.",
    "No duplicate create on timeout/retry.",
    "No explanatory UI prose."
  ],
  "exclusions": [
    "Deleting MobileItemForm.",
    "Refactoring the mega-form.",
    "Changing recurrence or capture policy."
  ],
  "checks": [],
  "risks": [
    "A toast closure can reference reset form state.",
    "Offline Undo must cancel a queued create rather than delete a nonexistent server ID."
  ],
  "unknowns": [
    "Existing create/delete hook inverse behavior needs focused confirmation before wiring."
  ],
  "dependencies": [],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26: both success toasts, two console.error calls and missingFieldType absence checked in the live form."
}
```

### SCH-1.9

**Outcome:** Document the shipped capture behavior.

- **Acceptance:** Post-ship docs: [Items & Reminders Overview](<../../02 - Standalone Modules/Items & Reminders/Overview.md>) updated with the new capture behaviors. No new route/icon, so Atlas/Routes unchanged.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Docs only, and the target is named: `ERA Notes/02 - Standalone Modules/Items & Reminders/Overview.md`. To know what shipped, read `src/lib/smartTextParser.ts` (`parseSmartText`, `ParsedItem`, and the description helpers `getRecurrenceDescription`/`getTimeDescription`/`getDateDescription`) and the capture entry points in `src/components/reminder/MobileReminderForm.tsx`. No new route or icon, so the Atlas and `App Routes and Icons.md` stay unchanged — do not add entries. Several sibling items (SCH-5.3, SCH-6.1) turn on facts this doc should record, so write what is true now, not what was planned.

**Execution plan — 2026-09-26**

**Readiness:** Implementation draft; documentation only, grounded in source-present behavior.

**Verify:** `pnpm docs:check` and `pnpm pm:check-docs`; review each new statement against MobileReminderForm, smartTextParser and the actual mount/router. No product tests are needed for a prose-only correction.

```delivery-plan-v1
{
  "outcome": "The Items overview describes the capture behavior that actually exists today.",
  "acceptance": [
    "Title-only save, parsed fields, structured overrides and live entry point are described accurately.",
    "Unimplemented recurrence/AI/retirement work remains explicitly separate from shipped behavior."
  ],
  "scope": [
    "ERA Notes/02 - Standalone Modules/Items & Reminders/Overview.md"
  ],
  "steps": [
    "Compare the overview's capture section with the live form's parse, submit and mount paths; use dated evidence rather than historical line counts.",
    "Describe title-only reminder capture, quick date choices, location choices and editable parsed fields in concise existing sections.",
    "Correct only stale capture references that source proves; retain SCH-5.3's undecided form-retirement status and SCH-6.1's pending storage/type migration.",
    "Check links and module indexes, then record this item's documentation evidence without inventing route, icon or feature additions."
  ],
  "invariants": [
    "Documentation describes current behavior, not intended future scope.",
    "A UI Reminder/Event choice does not prove task rows/types were migrated."
  ],
  "exclusions": [
    "New Atlas/route/icon entry.",
    "Source changes.",
    "Implementing Gemini, recurrence extraction or form retirement."
  ],
  "checks": [],
  "risks": [
    "Old overview tables still name retired containers and can misroute future agents."
  ],
  "unknowns": [],
  "dependencies": [],
  "risk": "low",
  "ownerReviewed": false,
  "provenance": "2026-09-26: overview, Feature Map and live capture parse/toast references reviewed; intended work is a bounded doc correction."
}
```

### SCH-1b.4

**Outcome:** Harden conservative recurrence extraction.

- **Acceptance:** Harden recurrence extraction — keep conservative; **gate behind the SCH-4.2 tests** before trusting RRULE writes from text.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Gated behind SCH-4.2's tests by the acceptance — do not trust RRULE writes from free text until cross-view placement is verified. The extractor is in `src/lib/smartTextParser.ts` (`parseSmartText`, with `getRecurrenceDescription` for the readback); rule construction is `buildFullRRuleString` in `src/lib/utils/date.ts`. "Conservative" is the design: when the phrase is ambiguous, produce no rule rather than a plausible one — SCH-7 is the refusal counterpart and SCH-3.1 is the one-question clarification alternative. Timezone and DST rules: `.claude/skills/timezone-handling/SKILL.md` and `ERA Notes/01 - Architecture/Timezone Handling.md`; a DTSTART in the wrong zone is the classic silent failure here.

**Execution plan — 2026-09-26**

**Readiness:** Implementation draft after SCH-4.2 passes; unsupported/ambiguous recurrence must remain a safe refusal.

**Verify:** `pnpm exec vitest run src/lib/utils/dayOccurrences.test.ts src/lib/schedule/expandOccurrences.test.ts src/features/era/intents/resolveIntent.test.ts`; add a proposed smartTextParser recurrence fixture with supported phrases, ambiguity, negation, weekdays, biweekly and DST anchors.

```delivery-plan-v1
{
  "outcome": "Text recurrence extraction produces only rules whose supported meaning can be demonstrated.",
  "acceptance": [
    "Supported phrases round-trip through the canonical occurrence fixture.",
    "Ambiguous or unsupported recurrence never silently becomes a one-time success."
  ],
  "scope": [
    "src/lib/smartTextParser.ts",
    "src/lib/utils/dayOccurrences.test.ts",
    "src/lib/schedule/expandOccurrences.test.ts"
  ],
  "steps": [
    "Use SCH-4.2's verified cases to list currently safe phrase→RRULE mappings and their expected dates; inventory parser branch order before adding vocabulary.",
    "Add a proposed parser test file with explicit positive/negative examples and pin its path before dispatch.",
    "Tighten the existing extractor conservatively, preserving original input/confidence when no safe rule can be emitted; reuse central rule/timezone helpers.",
    "Verify the form preview and SCH-7 refusal boundary together, including biweekly/weekday precedence and DST wall-clock stability."
  ],
  "invariants": [
    "No new expansion engine.",
    "No guessed anchor or rule for ambiguous text.",
    "Structured form edits remain the user's final truth."
  ],
  "exclusions": [
    "Broad natural-language feature expansion.",
    "Geofencing/time_window evaluation.",
    "Enabling recurring ERA writes."
  ],
  "checks": [],
  "risks": [
    "Generic weekly matching can swallow a more specific recurrence phrase.",
    "Dropping recurrence text without marking uncertainty can defeat SCH-7."
  ],
  "unknowns": [
    "Minimum supported phrase set needs fixture confirmation; no parser test file exists at the inspected cutoff."
  ],
  "dependencies": [
    "SCH-4.2"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: parser recurrence branches and current Schedule readers inspected; acceptance explicitly gates trusted writes on SCH-4.2."
}
```

### SCH-1c.1

**Outcome:** Parse one-line items through Gemini safely.

- **Acceptance:** Wire one-line → structured item via **Gemini**; **pass `timeoutMs`** (Hard Rule #6 — AI calls can exceed the current 8 s default). → `src/lib/ai/gemini.ts`

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** One AI call with one hard constraint. The model layer is `src/lib/ai/gemini.ts` — `generateContentWithFallback()` with `isDailyQuotaError()` for 429 discrimination — and **Hard Rule #6 is the acceptance**: pass `timeoutMs` (60_000) to `safeFetch()` from `src/lib/safeFetch.ts`, or the request aborts at the 8 s default; note a timeout is latency, not offline, and must not enqueue a duplicate mutation. The deterministic parser already exists (`parseSmartText()` in `src/lib/smartTextParser.ts`) and returns `ParsedItem` — make Gemini fill that same shape rather than a new one, and Zod-validate what comes back (Hard Rule #12). Standing rule: the model proposes, the human confirms — which is what SCH-1c.2 wires up.

**Execution plan — 2026-09-26**

**Readiness:** Implementation draft; pin the bounded server parse endpoint/proposal shape before dispatch. Keep the deterministic form parser offline-capable.

**Verify:** `pnpm exec vitest run src/lib/safeFetch.test.ts src/features/era/intents/resolveIntent.test.ts`; add proposed mocked Gemini parse tests for valid/invalid structured output, quota failure, slow response, abort and unsupported recurrence. No item POST occurs during parsing.

```delivery-plan-v1
{
  "outcome": "One-line Hub input can produce a validated editable item proposal through the existing Gemini layer.",
  "acceptance": [
    "The model returns a validated proposal in the existing parsed-item vocabulary.",
    "A slow call uses an explicit timeout; failure preserves input and never writes an item."
  ],
  "scope": [
    "src/lib/ai/gemini.ts",
    "src/lib/smartTextParser.ts",
    "src/components/hub/AddReminderFromMessageModal.tsx"
  ],
  "steps": [
    "Define the smallest structured proposal schema from ParsedItem, including uncertainty and unsupported recurrence; identify an existing suitable server endpoint or propose a named route before widening scope.",
    "Reuse generateContentWithFallback and structured output/Zod validation on the server; supply only required user text/timezone context.",
    "Call it with safeFetch timeoutMs:60000 from the selected Hub parse interaction; keep deterministic parsing/editing available when offline or inference fails.",
    "Return the proposal to SCH-1c.2's review gate and test malformed/late/repeated responses so none can commit or overwrite a newer user edit."
  ],
  "invariants": [
    "AI proposes; human confirms.",
    "Timeout is latency, not offline proof.",
    "No extra inference per render or keystroke."
  ],
  "exclusions": [
    "Replacing the offline form parser.",
    "Model-direct Schedule writes.",
    "A parallel Gemini client or recurrence engine."
  ],
  "checks": [],
  "risks": [
    "Multiple in-flight responses can overwrite current text.",
    "A loose proposal schema can smuggle unsupported recurrence into capture."
  ],
  "unknowns": [
    "Final parse route and proposal transport need a focused current endpoint audit."
  ],
  "dependencies": [
    "SCH-7"
  ],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26: Gemini fallback export, ParsedItem and Hub reminder entry points verified; endpoint shape remains proposed."
}
```

### SCH-1c.2

**Outcome:** Reuse Hub reminder creation with confirmation.

- **Acceptance:** Reuse/extend the Hub create path ([AddReminderFromMessageModal.tsx](<../../../src/components/hub/AddReminderFromMessageModal.tsx>) · [messageActions.ts](<../../../src/features/hub/messageActions.ts>)) — confirm chip before commit.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Reuse, don't rebuild — the acceptance names both files. `src/features/hub/messageActions.ts` is the Message Actions junction that turns a hub message into a reminder, and `src/components/hub/AddReminderFromMessageModal.tsx` is the existing confirm-before-commit modal. Read the Hub Chat and Message Actions vault docs (`ERA Notes/03 - Junction Modules/`) before changing either, since both bridge Budget, Items and the Shopping List. The confirm chip is the proposal gate for SCH-1c.1's parse: nothing writes until the human accepts. Item creation lands in `src/app/api/items/route.ts`.

**Execution plan — 2026-09-26**

**Readiness:** Implementation draft after the proposal contract; reuse the existing Hub modal and writer.

**Verify:** Add proposed modal/message-action tests for parse→edit→confirm, cancel, double tap, failed write, offline replay and unsupported recurrence. `pnpm exec vitest run src/features/era/intents/resolveIntent.test.ts` protects capture semantics; mobile review uses terse chips.

```delivery-plan-v1
{
  "outcome": "Hub reminder proposals stay editable and create an item only after explicit confirmation.",
  "acceptance": [
    "Before confirmation there are zero item/message-action writes.",
    "Successful confirmation preserves source-message linkage and has an honest inverse."
  ],
  "scope": [
    "src/components/hub/AddReminderFromMessageModal.tsx",
    "src/features/hub/messageActions.ts"
  ],
  "steps": [
    "Read the existing modal's useCreateReminder/useCreateEvent and message-action linkage, then consume SCH-1c.1's validated proposal as initial editable state.",
    "Show the compact confirm/edit affordance and preserve manual field edits when parsing returns late; a rejected proposal keeps the original message.",
    "Submit through the existing create path only once per confirmation, apply SCH-7 support checks before commit, and create source-message linkage only for actual success.",
    "Verify cancel, errors, retry and Undo keep item identity and message linkage coherent; route alert parity concerns to SCH-9 rather than duplicating alert logic."
  ],
  "invariants": [
    "Proposal is not a persisted reminder.",
    "A success receipt requires a real item identity.",
    "Existing offline queue remains the sole transport."
  ],
  "exclusions": [
    "A second reminder creation route.",
    "General Hub redesign.",
    "Additional inline explanation."
  ],
  "checks": [],
  "risks": [
    "Item creation and message-action linkage can partially succeed.",
    "A double-tap guard alone is insufficient for replay idempotency."
  ],
  "unknowns": [
    "Current linkage failure/replay handling must be checked and bounded before expanding this slice."
  ],
  "dependencies": [
    "SCH-1c.1",
    "SCH-7"
  ],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26: modal create hooks and linkage paths inspected; accepted confirm-chip contract retained."
}
```

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

**Execution plan — 2026-09-26**

**Readiness:** Split first after SCH-4.3b and SCH-14; execute consumer batches over one shared fixture without layout changes.

**Verify:** `pnpm exec vitest run src/lib/schedule/ src/lib/utils/dayOccurrences.test.ts src/features/era/intents/resolveIntent.test.ts`; retained `tests/era-schedule-parity.test.ts` is proposed, absent at this cutoff. Compare Calendar/Week/Planner/Today/ERA keys, times, status and empty-versus-failed reads.

```delivery-plan-v1
{
  "outcome": "Every agenda consumer uses the same canonical placement and due-state semantics.",
  "acceptance": [
    "ERA includes real flexible placements and uses occurrence/completion state for overdue.",
    "Applicable views agree on keys/times/status while retaining their intentional completed-item presentation."
  ],
  "scope": [
    "src/features/era/intents/resolvers/schedule.ts",
    "src/components/web/WebCalendar.tsx",
    "src/components/web/WebWeekView.tsx",
    "src/components/planner/WebDayPlanner.tsx",
    "src/components/web/WebTodayView.tsx",
    "src/components/web/WebTabletMissionControl.tsx",
    "src/components/activity/ItemsListView.tsx",
    "src/lib/ai/context.ts"
  ],
  "steps": [
    "Use Catalogue C04c and the completed core/identity contracts to split consumer migration into bounded batches; enumerate remaining day-expansion callers before finalizing scope.",
    "For ERA, fetch scheduled flexible placements for each item's selected period and pass them through the canonical reader; replace alert-trigger overdue counting with the shared bounded due/completion policy.",
    "Migrate each other consumer and remove its superseded expansion only after fixture parity; preserve visibility, handled-state controls and layouts.",
    "Fail incomplete item/action/placement reads truthfully. Run shared fixtures and mobile comparisons, then close only the verified consumer scope."
  ],
  "invariants": [
    "No independent overdue or recurrence engine.",
    "A failed placement read is not an empty complete agenda.",
    "Household/assignee filtering remains authorized."
  ],
  "exclusions": [
    "Google Calendar projection.",
    "Schedule layout redesign.",
    "Completing SCH-4.3b's remaining action-sheet work by implication."
  ],
  "checks": [],
  "risks": [
    "Consumers need different display filters over the same occurrence truth.",
    "Missing flexible periods can make a plausible but incomplete answer."
  ],
  "unknowns": [
    "Full day-expansion caller inventory and final batch scopes."
  ],
  "dependencies": [
    "SCH-4.3b",
    "SCH-14"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: ERA passes empty flexible inputs and counts overdue via alerts; Catalogue C04c and current consumer references reviewed."
}
```

### SCH-9

**Outcome:** Give online and replayed reminders equal alert semantics.

- **Acceptance:** UU-X2: online draft reminder creation and queued API replay must produce the same intended alerts. Documented online hook omitted the active alert that replay adds; cover retries and offline-to-online transitions.

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide (rechecked 2026-09-26):** Online `useCreateReminder` in `src/features/items/useItems.ts` writes via the browser SDK and explicitly suppresses alerts while `input.status === "draft"`. Offline creation queues the body to `src/app/api/items/route.ts`, whose alert branch uses `body.alerts?.length`, then `else if (body.due_at)`, without the same draft guard. An empty array does not skip that fallback. Trace draft confirmation before aligning the lifecycle: parity must not accidentally activate unreviewed drafts. Reuse the existing queue and verify exact resulting alerts under retry/replay.

**Execution plan — 2026-09-26**

**Readiness:** Investigation first; confirmed mismatch is draft-status handling, not the earlier empty-alert-array explanation.

**Verify:** Add proposed online-hook/API replay fixtures for draft with/without due_at, explicit/empty alerts, confirmed reminder, retry and offline→online. `pnpm exec vitest run src/lib/safeFetch.test.ts` protects timeout classification. Compare resulting item status and exact alert set, not request shape alone.

```delivery-plan-v1
{
  "outcome": "Online and replayed reminder creation follow one explicit status-aware alert contract.",
  "acceptance": [
    "The same logical creation produces the same intended alerts in both transports.",
    "Draft review and later confirmation neither fire prematurely nor lose the intended alert."
  ],
  "scope": [
    "src/features/items/useItems.ts",
    "src/app/api/items/route.ts",
    "src/lib/offlineSyncEngine.ts"
  ],
  "steps": [
    "Create the exact witness: online useCreateReminder suppresses all draft alerts, while queued body reaches an API branch that does not inspect draft status.",
    "Trace draft confirmation and establish one lifecycle rule from existing accepted behavior; preserve unconfirmed drafts as non-firing unless the owner adopts a different contract.",
    "Share or align alert construction/default rules at the smallest existing boundary, covering due_at, explicit alerts and no-date inputs; avoid teaching the queue separate alert policy.",
    "Verify retry/partial failures and confirmed connectivity transitions produce one intended alert set and a truthful result; narrow queue-file changes to transport evidence only if required."
  ],
  "invariants": [
    "No duplicate alert on replay.",
    "No default alert from a nonexistent due time.",
    "Timeout does not enqueue another logical create."
  ],
  "exclusions": [
    "Cron delivery overhaul.",
    "Adding another offline queue.",
    "Rewriting all item creation hooks."
  ],
  "checks": [],
  "risks": [
    "The direct SDK and API paths can disagree even with identical payloads.",
    "Aligning on the API's current behavior could accidentally enable premature draft alerts."
  ],
  "unknowns": [
    "Current confirmation/activation path must be traced before choosing where intended alert configuration is retained."
  ],
  "dependencies": [],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: useItems draft guards and API body.alerts/else-due_at branches inspected; earlier reading-guide explanation corrected."
}
```

### SCH-10

**Outcome:** Verify prerequisite access against current RLS.

- **Acceptance:** H-01 and Aug19 Inbox: owner supplies item_prerequisites and parent/child read-path RLS state. Preserve intended household access and choose an approved hot-child contract only from current evidence.

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Evidence-first, and Hard Rule #27's gate applies literally — this is a "who can read what" question, so **read `migrations/db-state.json` before any route code**; `schema.sql` cannot answer it and the repo has been wrong about the items family before. The tables are `item_prerequisites` plus the parent/child read path (`items` and its hot children `item_alerts`, `item_subtasks`, `reminder_details`, `event_details`, `item_recurrence_rules`, `recurrence_pauses`). Hard Rule #20 forbids an EXISTS-subquery policy on any of those; the two approved contracts are a SECURITY DEFINER bundle RPC (`get_schedule_bundle` is the canonical one) or a denormalized `user_id` with a trigger. Routes: `src/app/api/items/[id]/prerequisites/` and the evaluators in `src/lib/prerequisites/`. Preserve intended household access (Hard Rule #13); agents never apply SQL (#26).

**Execution plan — 2026-09-26**

**Readiness:** Owner evidence held. The committed snapshot is dated 2026-08-04; current prerequisite access cannot be certified from it.

**Verify:** `pnpm db:verify-rls` checks the owner-refreshed snapshot, not live production. Owner supplies full RLS enablement/policy bodies, bundle/function/grant evidence and owner/partner/nonhousehold read results for the complete prerequisite path.

```delivery-plan-v1
{
  "outcome": "Prerequisite reads preserve intended household access through an evidence-backed hot-child contract.",
  "acceptance": [
    "Current access behavior is explained by actual policy/function evidence.",
    "Any proposed fix uses the approved bundle or denormalized ownership pattern and is handed over as manual SQL."
  ],
  "scope": [],
  "steps": [
    "Request the current owner-generated db-state snapshot or complete Hard Rule #27 queries for item_prerequisites, items and each child in its read path; wait before diagnosing application code.",
    "Compare direct parent/child access with the SECURITY DEFINER bundle under owner, partner and unrelated users; record silent-empty versus missing-data outcomes.",
    "Only after evidence, trace prerequisite API/evaluator callers and select the smallest authorized bundle or denormalized-user contract; declare route/migration scope explicitly.",
    "If needed, prepare paired migration/schema SQL and isolated access tests, then hand application and two-user runtime verification to the owner."
  ],
  "invariants": [
    "No hot-child EXISTS-subquery policy.",
    "No per-table query fan-out replacing the bundle.",
    "Agent never queries or mutates production directly."
  ],
  "exclusions": [
    "Assuming old no-RLS state is current.",
    "Activating inert prerequisite evaluators.",
    "Speculative household permission expansion."
  ],
  "checks": [],
  "risks": [
    "Multiple permissive/restrictive policies can alter effective access.",
    "A correct-looking route cannot prove RLS safety."
  ],
  "unknowns": [
    "Current prerequisite/parent/child policy and SECURITY DEFINER state."
  ],
  "dependencies": [],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: db-state generated 2026-08-04 inspected; item_prerequisites was then RLS-disabled. No current-state or route conclusion inferred."
}
```

### SCH-14

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C04b. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Preserve occurrence identity through every action.

- **Acceptance:** Catalogue C04b: one stable occurrence/slot identity across subtasks, alerts, completion, exceptions and replay. Verify existing series actions and DST boundaries, not just display dates.
- **Depends on:** [SCH-4.3b](<Schedule — Master Book.md#sch-43b>).

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on SCH-4.3b. "One stable occurrence/slot identity" is the missing primitive — today an occurrence is identified positionally by date, which is why subtasks, alerts, completion and exceptions can drift apart. Read `src/lib/schedule/materializeOccurrence.ts` (`materializeOccurrence`, `OVERRIDABLE_FIELDS`, `OverridePayload`, `isSkippedException`, `isRescheduledException`) and `alertResolution.ts` (`getSeriesAlert`, `getOccurrenceAlert`, `findExceptionForDate`) as the current contract, plus `recurrence_pauses` and the occurrence-action rows. `.claude/skills/recurrence-safety/SKILL.md` is mandatory. DST boundaries are the named trap, so `.claude/skills/timezone-handling/SKILL.md` too — verify the stored instant, not the rendered date. NOTIF-20 and SCH-15/19 all wait on this.

**Execution plan — 2026-09-26**

**Readiness:** Split first after SCH-4.3b; current owner DB evidence and retained offline transport are prerequisites to key cutover.

**Verify:** `pnpm exec vitest run src/lib/schedule/ src/lib/utils/dayOccurrences.test.ts` plus proposed exact-key action/subtask/alert/replay fixtures. Isolated DB: two same-day/same-time slots, move/unplace/re-place, concurrent actions, dual reads and ambiguous legacy refusal.

```delivery-plan-v1
{
  "outcome": "One stable occurrence or placement identity survives actions, subtasks, alerts, movement and replay.",
  "acceptance": [
    "Acting on one slot never completes or suppresses another, even at the same date/time.",
    "Existing row IDs/history survive; ambiguous legacy actions remain unresolved rather than guessing."
  ],
  "scope": [
    "src/features/items/useFlexibleRoutines.ts",
    "src/features/items/useItemActions.ts",
    "src/features/items/useItems.ts",
    "src/types/items.ts",
    "src/app/api/items/",
    "src/app/api/cron/item-reminders/route.ts",
    "migrations/schema.sql"
  ],
  "steps": [
    "Read Catalogue §10.3/C04b and fresh owner indexes/functions; enumerate timestamp-only writers, onConflict targets, bundle readers and replay payloads before splitting the change.",
    "Prepare the nullable occurrence-key/unplaced_at migration with only unambiguous backfill; preserve all IDs and gate new keys until readers support them.",
    "Add dual-read/exact-key command behavior for completion, skip, move, Undo, placement and subtasks; reuse the shared transactional command boundary and retained queue.",
    "Carry identity into alert suppression and cron lookup, then migrate/gate direct SDK writers before replacing legacy uniqueness constraints.",
    "Run the full two-slot action/inverse matrix and isolated cutover tests; owner applies SQL before runtime/device acceptance."
  ],
  "invariants": [
    "Display date/time is not identity.",
    "No invented legacy mapping or new queue.",
    "Move retains origin/history and unrelated placements."
  ],
  "exclusions": [
    "Catalogue activation features.",
    "Global history rewrite.",
    "Certifying every consumer before SCH-8."
  ],
  "checks": [],
  "risks": [
    "Removing old uniqueness before writer migration breaks existing upserts.",
    "A cron missing the key can suppress both slots."
  ],
  "unknowns": [
    "Current live constraints, old-client transport compatibility and exact bounded migration batches."
  ],
  "dependencies": [
    "SCH-4.3b"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: Catalogue C04b, schema slot/action fields and source entry points reviewed; no live migration or concurrency evidence."
}
```

### SCH-2.1

**Outcome:** Parse "at home" / "when I get home".

- **Acceptance:** Parse "at home" / "when I get home" → set `location_context: "home"`.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Small parser addition with a field that already exists: `location_context?: "home" | "outside" | "anywhere" | null` is declared three times in `src/types/items.ts` (verified 2026-09-20), so nothing schema-side is needed — just set it. The parser is `parseSmartText()` in `src/lib/smartTextParser.ts`, whose `ParsedItem` interface is the shape to extend. Keep extraction conservative in the same spirit as SCH-1b.4. SCH-2.2 is the harder half (mapping the *phrase* to a tag); this item only sets the enum.

**Execution plan — 2026-09-26**

**Readiness:** Deferred; bounded parser/form addition. Location context alone must not promise an arrival trigger.

**Verify:** Add proposed smartTextParser fixtures for 'at home', 'when I get home', unrelated 'home' substrings and manual location override. `pnpm typecheck`; verify parsed preview/save sends location_context once with no new prerequisite.

```delivery-plan-v1
{
  "outcome": "Supported home phrases prefill the existing home location context.",
  "acceptance": [
    "Parsed home context reaches the editable live form and saved item.",
    "No date, tag, geofence or arrival alert is invented from the phrase."
  ],
  "scope": [
    "src/lib/smartTextParser.ts",
    "src/components/reminder/MobileReminderForm.tsx"
  ],
  "steps": [
    "Extend ParsedItem with the existing location_context vocabulary and add narrow positive/negative phrase fixtures.",
    "Extract supported home phrases conservatively while preserving useful title/original input; do not treat incidental 'home' text as a tag identity.",
    "Wire the parsed value into the form only when the user has not manually overridden location; reuse its current location_context payload.",
    "Verify title-only save, reparse and explicit location edits. Keep arrival-trigger mapping visible as SCH-2.2's separate prerequisite."
  ],
  "invariants": [
    "Location context is descriptive, not a trigger.",
    "Manual structured fields win.",
    "No schema field is invented; the item location enum already exists."
  ],
  "exclusions": [
    "NFC tag selection.",
    "Geofencing.",
    "Time-window evaluation."
  ],
  "checks": [],
  "risks": [
    "'When I get home' can imply a trigger that this slice alone does not create.",
    "Repeated parsing can overwrite a user's location choice."
  ],
  "unknowns": [
    "Exact phrase cleanup and preview need fixture confirmation before implementation."
  ],
  "dependencies": [],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26: ParsedItem lacks location context while the live form already submits it; existing item location types previously verified."
}
```

### SCH-2.2

**Outcome:** Map the phrase "home".

- **Acceptance:** Map the phrase "home" → the user's tag via `nfc_tags.label` → attach an `nfc_state_change` prerequisite (arrive-home). → `src/lib/prerequisites/evaluators/nfc-state.ts`

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends conceptually on SCH-2.1. The evaluator named in the acceptance exists: `src/lib/prerequisites/evaluators/nfc-state.ts`, registered in `src/lib/prerequisites/evaluators/index.ts`, with the prerequisite write path at `src/app/api/items/[id]/prerequisites/route.ts`. The mapping is phrase → `nfc_tags.label` → an `nfc_state_change` prerequisite, so read the NFC module first (`src/features/nfc/hooks.ts`, `src/app/api/nfc/`, `src/app/nfc/[tag]/`) — it has its own slug-URL hard rule in `ERA Notes/02 - Standalone Modules/NFC Tags/`. Prerequisites is a Junction module (`ERA Notes/03 - Junction Modules/Prerequisites/`): trace the dormant→pending activation cascade before writing. An unmatched label must attach nothing rather than guess a tag.

**Execution plan — 2026-09-26**

**Readiness:** Deferred; resolve only an authorized unambiguous home tag/state, with SCH-10 access evidence before diagnosing visibility.

**Verify:** Proposed mapping fixtures cover one matching active tag, zero matches, duplicate labels, different households, custom state names and deleted tag. `pnpm typecheck`; offline/unavailable tag reads must leave a proposal unresolved.

```delivery-plan-v1
{
  "outcome": "A home-arrival phrase proposes the user's actual NFC prerequisite when its tag and state are unambiguous.",
  "acceptance": [
    "The proposal uses a real authorized tag ID and configured arrival state.",
    "Unknown/ambiguous mapping creates no guessed prerequisite or active reminder."
  ],
  "scope": [
    "src/lib/smartTextParser.ts",
    "src/components/reminder/MobileReminderForm.tsx",
    "src/features/nfc/hooks.ts",
    "src/types/prerequisites.ts"
  ],
  "steps": [
    "Read authorized tag data and nfc-state evaluator config; identify home by the accepted label convention and configured states, not a hardcoded URL or assumed state string.",
    "Keep the parser's location intent separate from asynchronous tag resolution; prefer a shared proposal mapper if needed and pin its new path before dispatch.",
    "Resolve one matching active tag or present a compact explicit choice; preserve the original input when unavailable/offline.",
    "Pass a proposed nfc_state_change config to SCH-2.3's editable picker and verify save remains the only write gate."
  ],
  "invariants": [
    "Tag slugs remain generic and server-configured.",
    "No cross-user/private tag guessing.",
    "The existing evaluator owns activation semantics."
  ],
  "exclusions": [
    "Changing NFC tap behavior.",
    "New geolocation engine.",
    "Automatically choosing the first duplicate label."
  ],
  "checks": [],
  "risks": [
    "Label 'home' and state 'arriving' are conventions, not guaranteed values.",
    "A stale tag proposal can become unauthorized before save."
  ],
  "unknowns": [
    "Owner's label/alias and configured arrival-state mapping when more than one tag qualifies."
  ],
  "dependencies": [
    "SCH-2.1",
    "SCH-10"
  ],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26: nfc_tags label/states schema and evaluator's tag_id/target_state contract read; current household tag records not accessed."
}
```

### SCH-2.3

**Outcome:** Pre-fill the existing `PrerequisitePicker` from parsed text (plumbing already wired in the form).

- **Acceptance:** Pre-fill the existing `PrerequisitePicker` from parsed text (plumbing already wired in the form).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Plumbing is already wired, so this is small. The component is `src/components/items/PrerequisitePicker.tsx`; the source of the parsed values is `ParsedItem` from `parseSmartText()` in `src/lib/smartTextParser.ts`; the form that hosts both is `src/components/reminder/MobileReminderForm.tsx`. Pre-fill means proposing a selection the user can change, not committing one — the same propose-then-confirm rule as SCH-1c.2. Depends in practice on SCH-2.1/2.2 producing something to pre-fill.

**Execution plan — 2026-09-26**

**Readiness:** Deferred after SCH-2.1/2.2; the picker and form write plumbing already exist.

**Verify:** Proposed form tests cover parsed suggestion→picker, manual edit, repeated parse, remove suggestion, malformed config and cancel. `pnpm typecheck`; saving the accepted prerequisite yields intended dormant state without duplicate entries.

```delivery-plan-v1
{
  "outcome": "Resolved text prerequisites prefill the existing editable PrerequisitePicker.",
  "acceptance": [
    "The user can inspect, change or remove a proposed trigger before saving.",
    "Parsing never writes or duplicates prerequisite rows."
  ],
  "scope": [
    "src/components/reminder/MobileReminderForm.tsx",
    "src/components/items/PrerequisitePicker.tsx",
    "src/types/prerequisites.ts"
  ],
  "steps": [
    "Follow current form prerequisite state into PrerequisitePicker and the existing create payload; preserve its AND/OR grouping contract.",
    "Accept SCH-2.2's resolved proposal only when the user has not edited that prerequisite field; keep generated identity separate from durable rows.",
    "Deduplicate repeated parser results by their intended config without merging distinct manually chosen groups, and make removal persist across re-render.",
    "Verify dormant/pending outcome, unsupported/invalid proposal rejection and manual overrides with one reviewed save; use the existing writer."
  ],
  "invariants": [
    "Proposal state is local until save.",
    "Manual trigger choices remain authoritative.",
    "No inert evaluator becomes enabled by parser vocabulary."
  ],
  "exclusions": [
    "New prerequisite editor.",
    "Changing engine logic.",
    "Automatic NFC taps."
  ],
  "checks": [],
  "risks": [
    "Blind merging can turn OR groups into AND requirements.",
    "Reparsing can resurrect a trigger the user removed."
  ],
  "unknowns": [
    "Existing picker equality/group identity must be checked before implementing deduplication."
  ],
  "dependencies": [
    "SCH-2.1",
    "SCH-2.2"
  ],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26: live form prerequisites state, picker binding and create payload inspected; no missing UI plumbing was assumed."
}
```

### SCH-3.1

**Outcome:** Lightweight **one-question** clarification for ambiguous phrases ("later".

- **Acceptance:** Lightweight **one-question** clarification for ambiguous phrases ("later" → Tonight / Tomorrow / Pick time); never block a simple save.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** A one-question clarification that must never block a simple save — that clause is the design constraint. The ambiguity is detected in `src/lib/smartTextParser.ts` (`parseSmartText`, and the readback helpers `getTimeDescription`/`getDateDescription` show what the app already knows how to say); the ask lands in `src/components/reminder/MobileReminderForm.tsx`. This is the softer alternative to SCH-7's refusal: use it for under-specification ("later"), not for unsupported recurrence. Hard Rule #28 — three chips, no explanatory sentence.

**Execution plan — 2026-09-26**

**Readiness:** Deferred; a bounded ambiguity interaction, never a requirement to answer before simple save.

**Verify:** Proposed parser/form tests for 'later', explicit tomorrow/time, ignored clarification, chip edit and title-only save. `pnpm typecheck`; 390×844 keyboard open/closed and all themes, with at most one clarification row.

```delivery-plan-v1
{
  "outcome": "Ambiguous time phrasing offers one compact clarification without blocking capture.",
  "acceptance": [
    "The user can choose Tonight, Tomorrow or Pick time, or save simply without answering.",
    "Explicit dates/times are never replaced by the clarification flow."
  ],
  "scope": [
    "src/lib/smartTextParser.ts",
    "src/components/reminder/MobileReminderForm.tsx"
  ],
  "steps": [
    "Identify the narrow unsupported/ambiguous phrase signal in the existing parser and separate it from unsupported recurrence refusal.",
    "Show one optional chip row only when a meaningful date/time choice is unresolved; derive choices from the current local date using existing helpers.",
    "Apply a chosen chip to editable structured fields, preserve the original title/input and stop asking once the user has answered or dismissed.",
    "Verify a title-only/no-date save remains available and reparsing/manual edits do not reopen a clarification loop."
  ],
  "invariants": [
    "One question maximum per ambiguity.",
    "No guessed due time disguised as certainty.",
    "Unsupported recurrence follows SCH-7, not a time chip."
  ],
  "exclusions": [
    "General conversational slot engine.",
    "Mandatory wizard steps.",
    "Inline explanatory paragraphs."
  ],
  "checks": [],
  "risks": [
    "Parser defaults can make genuine ambiguity look resolved.",
    "A clarification loop raises capture cost."
  ],
  "unknowns": [
    "Exact 'later' behavior needs a fixture before adding the new signal; no current parser test is assumed."
  ],
  "dependencies": [],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26: existing parser/form routes and accepted one-question behavior reviewed; source has explicit tonight support, no verified later policy."
}
```

### SCH-3.2

**Outcome:** Compact, on-brand chip preview obeying the look-and-feel Hard Rules (`useThemeClasses()`, opaque panels via `tc.bgPage` #15, no hardcoded colors #10,….

- **Acceptance:** Compact, on-brand chip preview obeying the look-and-feel Hard Rules (`useThemeClasses()`, opaque panels via `tc.bgPage` #15, no hardcoded colors #10, futuristic SVG icons #4, Undo toast #1, `inputMode="decimal"` #19, mobile-first #5).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Pure UI, and the acceptance is a list of hard rules rather than a design. Read `.claude/skills/ui-guardrails/SKILL.md` first; it operationalizes all of them. The chips render in `src/components/reminder/MobileReminderForm.tsx` from `ParsedItem` (`src/lib/smartTextParser.ts`). The specific traps: `useThemeClasses()` for colours and `tc.bgPage` for any floating panel (#15 — never `neo-card` over page content), no hardcoded backgrounds (#10), person-absolute colour identity from `useTheme()` (#14), `type="text"` + `inputMode="decimal"` for any numeric field (#19), Undo on toasts (#1), and mobile-first verification (#5).

**Execution plan — 2026-09-26**

**Readiness:** Deferred; implement only the compact preview for accepted parse/clarification data.

**Verify:** `pnpm typecheck`; mobile 390×844 across blue/pink/frost/calm, long title, Arabic/English text, keyboard, expanded picker and chip edit/removal. Assert preview editing changes the actual submitted fields and Undo remains available.

```delivery-plan-v1
{
  "outcome": "Parsed item choices appear as concise editable chips consistent with existing themes and mobile controls.",
  "acceptance": [
    "Preview and structured fields share one state; no misleading separate summary.",
    "Floating panels are opaque and controls remain usable on mobile."
  ],
  "scope": [
    "src/components/reminder/MobileReminderForm.tsx"
  ],
  "steps": [
    "Inventory existing preview chips and select the smallest change required by the accepted parser/clarification behavior; avoid replacing the full form.",
    "Use useThemeClasses and person-absolute attribution; use tc.bgPage for popovers, concise labels and existing futuristic icons.",
    "Connect chip edits/removals to the same structured state used by submit; keep explicit manual choices stable across reparsing.",
    "Verify keyboard/touch layout, focus and theme contrast, and preserve Undo and text/decimal numeric controls."
  ],
  "invariants": [
    "No hardcoded panel background or glass overlay.",
    "No red individual task rows.",
    "No preview-only value that differs from the saved payload."
  ],
  "exclusions": [
    "New navigation.",
    "Form redesign.",
    "Explanatory banners or descriptions."
  ],
  "checks": [],
  "risks": [
    "Chips can overflow a phone or hide required editable values.",
    "Duplicated preview state drifts from submission."
  ],
  "unknowns": [
    "Final chip set follows whichever preceding parser changes are accepted at execution time."
  ],
  "dependencies": [],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26: live form and accepted UI constraints reviewed; visual design/real-device verification remains future work."
}
```

### SCH-4.4

- **Retained campaign gate (D2):** DEC-10 must resolve whether time_window is mandatory; the old unconditional DoD is not silently waived or falsely completed.

**Outcome:** `time_window` prerequisite evaluator (one of the 4 inert).

- **Acceptance:** `time_window` prerequisite evaluator (one of the 4 inert) — optional, only if a feature needs it.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Parked and explicitly optional — "only if a feature needs it", so confirm a caller exists before starting. Verified 2026-09-20: `src/lib/prerequisites/evaluators/time-window.ts` is a stub returning `{ met: false, reason: "Time window evaluation not yet implemented" }`, registered in `evaluators/index.ts` alongside `weather.ts` (also a stub), `nfc-state.ts`, `item-completed.ts`, `schedule.ts` and `custom-formula.ts`. Implementing it means deciding the timezone semantics of `{ start, end, days }` — `.claude/skills/timezone-handling/SKILL.md`, and remember the app's custom month-start/`startOfCustomMonth` convention lives in `src/lib/utils/date.ts`.

**Execution plan — 2026-09-26**

**Readiness:** Decision held — DEC-10. The evaluator remains a stub; no implementation without a real consumer and resolved requirement.

**Verify:** `pnpm exec vitest run src/lib/utils/date.test.ts`; if admitted, add proposed evaluator fixtures for same-day/overnight windows, boundary inclusivity, weekday selection, missing timezone and both DST transitions. No cron/provider call needed.

```delivery-plan-v1
{
  "outcome": "Resolve whether time_window is required, then define one bounded evaluator contract if a real feature needs it.",
  "acceptance": [
    "DEC-10 explicitly reconciles optional scope with the old campaign D2 requirement.",
    "Any admitted evaluator has clear timezone/boundary semantics and a named consumer."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/_Decisions.md",
    "ERA Notes/10 - Project Management/Schedule/Schedule — Master Book.md"
  ],
  "steps": [
    "Read the current time-window stub and prerequisite grouping semantics; identify the actual proposed consumer and expected trigger evaluation frequency.",
    "Ask the owner whether D2 remains mandatory or the evaluator stays conditional; record the decision before claiming progress beyond investigation.",
    "If admitted, specify start/end inclusivity, overnight weekday attribution and household timezone using worked DST cases; pin evaluator/test scope separately.",
    "Implement only after that contract is accepted, preserving deterministic no-network evaluation and the existing engine's AND/OR behavior."
  ],
  "invariants": [
    "A stub returning false is not implemented.",
    "No new scheduling engine.",
    "No evaluator activation merely to broaden parsing."
  ],
  "exclusions": [
    "Weather/custom-formula work.",
    "Automatic recurring timers.",
    "Inferring a timezone from fixed UTC offsets."
  ],
  "checks": [],
  "risks": [
    "Overnight windows can belong to two different weekday interpretations.",
    "A time condition alone may never be re-evaluated without a real trigger."
  ],
  "unknowns": [
    "DEC-10 decision, consumer and evaluation trigger cadence."
  ],
  "dependencies": [],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26: time-window stub read and DEC-10 reviewed; optional-versus-required conflict retained honestly."
}
```

### SCH-4.5

**Outcome:** Split `useItems.ts` (~2,621 LOC).

- **Acceptance:** Split `useItems.ts` (~2,621 LOC) — only when a feature next forces you in, not "just because."

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide (rechecked 2026-09-26):** Split only when a feature forces work in `src/features/items/useItems.ts`; historical line counts are not the trigger. The `itemsKeys` factory is exported from that same file — `src/features/items/queryKeys.ts` does not exist at this cutoff. Read cache-invalidation and Common Patterns before extraction; preserve query keys, exported hook contracts, optimistic rollback and replay behavior.

**Execution plan — 2026-09-26**

**Readiness:** Trigger held; split only when a real Schedule feature requires work in useItems.

**Verify:** `pnpm typecheck`; run the selected feature's tests and existing `src/lib/utils/dayOccurrences.test.ts` when its reader boundary changes. Inventory exported hook callers before and after; verify cache/offline/mutation behavior, not file size.

```delivery-plan-v1
{
  "outcome": "A needed Schedule change extracts one cohesive hook boundary without changing behavior.",
  "acceptance": [
    "Existing exports remain compatible for all callers.",
    "The motivating feature gains an independently testable boundary with unchanged cache/replay semantics."
  ],
  "scope": [
    "src/features/items/useItems.ts"
  ],
  "steps": [
    "Wait for the motivating feature, then map only its reader/mutation exports and callers through the current Feature Map.",
    "Select one cohesive extraction, preserve a compatibility export and declare proposed file paths before edits.",
    "Move implementation with the existing query-key factories, optimistic rollback, safe transport and source ownership; do not rewrite adjacent hooks.",
    "Verify affected views, offline replay and mutation invalidation; stop when the feature's boundary is complete."
  ],
  "invariants": [
    "No line-count-driven refactor.",
    "One Schedule read/occurrence contract.",
    "No new standalone cross-import violation."
  ],
  "exclusions": [
    "Splitting the whole file proactively.",
    "Changing RLS/read bundling.",
    "Recurrence-engine redesign."
  ],
  "checks": [],
  "risks": [
    "Shared module state and mutation closures can change behavior when moved.",
    "Re-export churn can hide lost consumers."
  ],
  "unknowns": [
    "Triggering feature and exact extraction boundary are intentionally deferred."
  ],
  "dependencies": [],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26: current useItems mutation/read structure and accepted trigger reviewed; historical line counts are not execution criteria."
}
```

### SCH-5.2

**Outcome:** Give each surface **one job** per the surface map (Month / Week / Today / Form).

- **Acceptance:** Give each surface **one job** per the surface map (Month / Week / Today / Form).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Design/consolidation work over four surfaces: Month (`src/components/web/WebCalendar.tsx`), Week, Today (`src/components/web/WebTodayView.tsx`) and the Form (`src/components/reminder/MobileReminderForm.tsx`), plus the planner (`src/components/planner/WebDayPlanner.tsx`) and `/reminders` tabs (`src/app/reminders/`). The surface map lives in the Items & Reminders vault doc; read `ERA Notes/01 - Architecture/Design Doctrine.md` before deciding anything, since no playbook covers "give each surface one job". Overlaps heavily with SCH-4.3b — the duplicated expansion logic is part of why surfaces have blurred jobs — so sequence after it. Do not restructure a flagship UI beyond what the item asks.

**Execution plan — 2026-09-26**

**Readiness:** Deferred design review after recurrence parity; choose one bounded surface overlap at a time.

**Verify:** Compare the same fixed/flexible/completed fixture in Month, Week, Today/Planner and Form at 390×844. `pnpm typecheck`; run existing occurrence tests for any changed consumer. Preserve deep links and common actions.

```delivery-plan-v1
{
  "outcome": "Month, Week, Today and Form each have a clear primary job without losing existing useful actions.",
  "acceptance": [
    "The owner accepts a short surface-role/action map.",
    "A selected redundant interaction is simplified while capture, planning and detail access remain intact."
  ],
  "scope": [
    "src/components/web/WebCalendar.tsx",
    "src/components/web/WebWeekView.tsx",
    "src/components/web/WebTodayView.tsx",
    "src/components/planner/WebDayPlanner.tsx",
    "src/components/reminder/MobileReminderForm.tsx"
  ],
  "steps": [
    "Read current route/view usage and the accepted surface intent; identify real duplicated decisions rather than inferring a redesign from component names.",
    "Present a concise Month/Week/Today/Form role map with current entry/action locations and one proposed bounded change.",
    "After owner direction, implement that single overlap using the canonical occurrence/action contract and preserve existing layout where it still serves its job.",
    "Verify navigation/deep links, capture taps, completed visibility and shared fixture parity; update Atlas only if actual navigation/tab meaning changes."
  ],
  "invariants": [
    "No new occurrence engine.",
    "A role cleanup cannot drop existing user workflows silently.",
    "Hub remains the quick-capture layer."
  ],
  "exclusions": [
    "Flagship Schedule redesign.",
    "Moving work based on old screenshots.",
    "Deleting forms under this item."
  ],
  "checks": [],
  "risks": [
    "Month/Week/Today share actions legitimately; removing them can add friction.",
    "Planner and Today names can mask the same routed surface."
  ],
  "unknowns": [
    "Owner-approved role map and the first concrete overlap worth changing."
  ],
  "dependencies": [
    "SCH-8"
  ],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26: existing route/view maps and current Schedule scope reviewed; this is a bounded design prerequisite, not authorized redesign."
}
```

### SCH-5.3

**Outcome:** Investigate the [MobileReminderForm.tsx](<../../../src/components/reminder/MobileReminderForm.tsx>) vs….

- **Acceptance:** Investigate the [MobileReminderForm.tsx](<../../../src/components/reminder/MobileReminderForm.tsx>) vs [MobileItemForm.tsx](<../../../src/components/items/MobileItemForm.tsx>) **duplication** — decide keep/merge/retire. **No deletion without a decision.**

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** An investigation with an explicit no-deletion-without-a-decision clause. The facts: `src/components/reminder/MobileReminderForm.tsx` is 1,762 lines and `src/components/items/MobileItemForm.tsx` is 1,363 (verified 2026-09-20), and **`MobileItemForm` has no importer anywhere in `src/`** — its only occurrence is its own file. That is strong evidence for "retire", but the acceptance wants the decision recorded, not inferred. Check `src/app/reminders/` and `src/components/items/` for any dynamic/lazy reference before concluding. Record the outcome in `_Decisions.md`; SCH-1.9 should then document it.

**Execution plan — 2026-09-26**

**Readiness:** Deferred investigation; no deletion before the keep/merge/retire decision is recorded.

**Verify:** `rg -n 'MobileItemForm|MobileReminderForm' src`; check lazy/dynamic/mount paths and route imports beyond symbol counts. Compare field/payload capabilities and capture routes; no product edits are required for the decision.

```delivery-plan-v1
{
  "outcome": "Determine whether the unused MobileItemForm should be kept, merged or retired.",
  "acceptance": [
    "The decision is supported by actual callers and any unique behavior.",
    "No file is deleted merely because a text search found no importer."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/Schedule/Schedule — Master Book.md"
  ],
  "steps": [
    "Recheck static, dynamic and indirect route mounts for both forms, and compare the live TabContainer/reminder entry.",
    "Inventory any unique fields/validation/offline behavior in MobileItemForm that the live form does not cover; distinguish dead functionality from desired capability.",
    "Record a concise keep/merge/retire recommendation and ask for the explicit decision required by acceptance.",
    "Only after that decision, name a separate bounded source/doc cleanup scope and verify no reachable entry or user data behavior is lost."
  ],
  "invariants": [
    "Investigation does not delete source.",
    "Unique desired behavior is not discarded by implication.",
    "The live form remains available."
  ],
  "exclusions": [
    "Combining both large forms preemptively.",
    "Task-type retirement.",
    "A new capture UI."
  ],
  "checks": [],
  "risks": [
    "Dynamic string imports or obsolete docs can hide a path that a symbol search misses.",
    "Dead code may contain an unported capability."
  ],
  "unknowns": [
    "Owner's keep/merge/retire decision and desired treatment of any unique behavior."
  ],
  "dependencies": [],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26: source search finds MobileItemForm only in its own file; this is evidence for review, not deletion authorization."
}
```

### SCH-5.4

**Outcome:** Reassignment **history / audit** trail.

- **Acceptance:** Reassignment **history / audit** trail — "who had it when" (W8).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** An audit trail for reassignment — "who had it when". The field is `responsible_user_id` on `items` (the same one Trips' solo-trip cascade flips, see TRIP-2), written through `src/app/api/items/[id]/route.ts` and `src/features/items/useItems.ts`. A history table is a DB change: Hard Rules #24 (migration file, then `schema.sql`), #26 (hand the SQL to the owner) and #27/#20 (give the child table a policy in the same migration, and never an EXISTS-subquery one). Colour the two people by Hard Rule #14 — person-absolute, derived from `useTheme()`, never role-relative.

**Execution plan — 2026-09-26**

**Readiness:** Deferred; split durable reassignment history from its minimal reader/UI.

**Verify:** Proposed route/history fixtures cover owner/assignee/partner rights, same-assignee no-op, competing edits, replay, Undo and automatic Trips reassignment. `pnpm typecheck`; isolated DB tests prove assignment/history commit together.

```delivery-plan-v1
{
  "outcome": "An item's reassignment history records who held responsibility and when.",
  "acceptance": [
    "Every actual responsibility change has authorized actor, old/new assignee and event time.",
    "Repeated/no-op updates do not invent history or lose the current assignment."
  ],
  "scope": [
    "src/app/api/items/[id]/route.ts",
    "src/features/items/useItems.ts",
    "src/types/items.ts",
    "migrations/schema.sql"
  ],
  "steps": [
    "Inventory responsible_user_id writers, including direct SDK and Trips lifecycle paths; decide the single shared history boundary from current owner DB evidence.",
    "Prepare an additive proposed history table/command migration with the approved hot-child access contract; preserve current item IDs and assignments.",
    "Commit assignment and audit row atomically, including explicit inverse events for Undo; migrate all identified writers rather than only one PATCH handler.",
    "Expose a concise history reader in a separately pinned detail component and verify person-absolute attribution without leaking private items."
  ],
  "invariants": [
    "History records observed changes, not invented backfill.",
    "Current ownership rules remain unchanged.",
    "Assignment and required history succeed together."
  ],
  "exclusions": [
    "Changing who may reassign.",
    "A global audit framework.",
    "Inferring past assignees from current rows."
  ],
  "checks": [],
  "risks": [
    "Trips or direct SDK writes may bypass a route-only audit.",
    "An Undo can overwrite a newer reassignment."
  ],
  "unknowns": [
    "Current complete writer inventory and DB history/access contract."
  ],
  "dependencies": [],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: current item PATCH responsibility field/guard verified; complete cross-module writer audit remains the first step."
}
```

### SCH-6.1

**Outcome:** Retire the task type across storage and surfaces.

- **Acceptance:** *(packet **M-09** of the [ERA Top Layer — Master Plan](<../_Archive/Plans/ERA Top Layer — Master Plan (2026-09-02).md>), Lane M while native waits; split M-09a DB+types / M-09b surfaces+docs)* Retire the `task` type end-to-end (DB + all surfaces + the `ItemType` union + docs). Do this as one dedicated slice before touching the DB.

- **Acceptance:** no `task` value remains in the `ItemType` union, any surface, or the DB; existing `task` rows are migrated with a paired migration file.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** A dedicated slice, split DB+types then surfaces+docs, and the acceptance says do the DB part alone first. The union is `ItemType = "reminder" | "event" | "task"` in `src/types/items.ts`; `"task"` also appears in `src/types/aiUsage.ts` (`item_type`) and three places in `src/types/catalogue.ts` (verified 2026-09-20) — grep the whole repo, because CLAUDE.md's enum rule requires DB + TS type + API route + UI + utilities to move together. Existing `task` rows need a paired migration (Hard Rules #24/#26: file first, `schema.sql` second, owner runs it). Surfaces to sweep: `src/app/reminders/`, `src/components/items/`, `src/components/web/`, `src/components/reminder/`. Chores are a separate module (`src/features/chores/`) — do not fold them in.

**Execution plan — 2026-09-26**

**Readiness:** Deferred and split first; confirm the task→replacement data mapping and compatible rollout before any manual DB change.

**Verify:** `rg -n 'ItemType|type.*task|task.*type' src migrations`; classify execution enums separately from ordinary task words and Catalogue definitions. Run `pnpm typecheck` plus current Schedule/intent tests; owner verifies before/after row counts and all old task IDs retained.

```delivery-plan-v1
{
  "outcome": "Retire the execution task type coherently across stored items, API/types, surfaces and docs.",
  "acceptance": [
    "Existing task items retain identity/history under the accepted replacement mapping.",
    "Final storage and execution contracts expose no retired task enum."
  ],
  "scope": [
    "src/types/items.ts",
    "src/app/api/items/",
    "src/components/items/",
    "src/components/reminder/",
    "src/features/items/",
    "migrations/schema.sql"
  ],
  "steps": [
    "Inventory stored task semantics and every execution-type producer/consumer, including AI and Catalogue bridges; do not replace unrelated English task labels mechanically.",
    "Agree destination type and treatment of task-only actual-duration/completion fields, then specify a compatible staged rollout that reconciles the DB-first packet with cross-layer enum consistency.",
    "Prepare the dated manual migration and schema end state, with count/identity/rollback evidence; owner applies only at the reviewed rollout stage.",
    "Update bounded API/types then surfaces/docs slices and test legacy queued payload handling until cutover completes; retire compatibility only with evidence."
  ],
  "invariants": [
    "No item, occurrence or history ID changes.",
    "No unsupported old queue payload silently discarded.",
    "Catalogue reusable-definition meaning remains distinct from execution type."
  ],
  "exclusions": [
    "New Tasks V2.",
    "Chores consolidation.",
    "Blind repository-wide text replacement."
  ],
  "checks": [],
  "risks": [
    "DB and old clients can disagree during rollout.",
    "Task-only duration behavior may be lost."
  ],
  "unknowns": [
    "Exact replacement mapping and compatibility policy for old/offline clients."
  ],
  "dependencies": [],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: current ItemType/task-duration consumers and accepted M-09 scope reviewed; no migration policy selected or applied."
}
```

### SCH-11

**Outcome:** Audit the arrive and leave NFC experience.

- **Acceptance:** Preserve the NFC Inbox proposal: inspect both arrive/leave flows and their UI, then identify a bounded useful change. Schedule owns the behavior with Native consuming existing tags; no new campaign, geofencing or speculative revamp. Native bridge first.
- **Depends on:** [NAT-6](<../Native App/Native App — Master Book.md#nat-6>).

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** An audit that must stay bounded — the acceptance forbids a revamp, geofencing or a new campaign, and puts the native bridge (NAT-6) first. Read both flows before proposing anything: `src/app/nfc/[tag]/`, `src/app/nfc/nfc-admin-client.tsx`, `src/features/nfc/hooks.ts`, `src/app/api/nfc/`, and the arrive/leave semantics in `src/lib/prerequisites/evaluators/nfc-state.ts` with its registration in `evaluators/index.ts`. NFC Tags has its own slug-URL hard rule (`ERA Notes/02 - Standalone Modules/NFC Tags/`) and Prerequisites is a Junction module whose dormant→pending cascade you must trace (`ERA Notes/03 - Junction Modules/Prerequisites/`). Output is one identified bounded change, not a plan.

**Execution plan — 2026-09-26**

**Readiness:** Deferred audit after NAT-6; identify one useful bounded change, without implementing a speculative revamp.

**Verify:** Owner/device evidence for arrive and leave on both phones: auth return, generic slug, chosen/auto-flipped state, repeated tap and prerequisite activation. Source audit checks existing /nfc/[tag] and tap/evaluator path; no production tapping by the agent.

```delivery-plan-v1
{
  "outcome": "An evidence-backed arrive/leave audit identifies the next bounded NFC improvement.",
  "acceptance": [
    "Both directions and Native handoff are reviewed against actual behavior.",
    "The result names one useful change or records that no change is justified."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/Schedule/Schedule — Master Book.md"
  ],
  "steps": [
    "Read NAT-6 acceptance and current NFC slug/state flow before examining the arrive/leave screen; keep native readiness separate from web behavior.",
    "Trace auth return, countdown/state override, tap logging and dormant-item activation for each direction.",
    "Compare source expectations with owner-supplied phone evidence, including duplicate taps and a changed configured state order.",
    "Record root cause, affected entry point and a bounded follow-up if evidence supports it; do not implement during the audit or create a new campaign."
  ],
  "invariants": [
    "No geofencing.",
    "Generic reusable NFC URLs remain configured server-side.",
    "State history is preserved."
  ],
  "exclusions": [
    "Full NFC redesign.",
    "New trigger engine.",
    "Changing Native bridge scope."
  ],
  "checks": [],
  "risks": [
    "Auto-flip order can make a repeated tap look like the opposite action.",
    "Browser/PWA/native handoff can obscure which flow actually ran."
  ],
  "unknowns": [
    "Current NAT-6/device acceptance and the owner's observed arrive/leave friction."
  ],
  "dependencies": [
    "NAT-6"
  ],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26: NFC Overview flow/gotchas and accepted audit boundary reviewed; real-device flow is not certified."
}
```

### SCH-12

**Outcome:** Separate estimated and observed schedule duration.

- **Acceptance:** PE-X1: defaulted/prefilled actual duration must not count as measured completion evidence. Preserve provenance through writes, reads and calibration; no invented backfill.

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide (rechecked 2026-09-26):** The actual prefill is in `src/components/items/ItemDetailModal.tsx`: task completion seeds `actualMinutesInput` from `reminder_details.estimate_minutes`. `src/features/items/useItemActions.ts` carries `actual_minutes` to `src/app/api/items/[id]/complete/route.ts`; the generic item PATCH handles the estimate, not this completion path. `migrations/schema.sql` defines `estimate_minutes` and `actual_minutes`. Trace every duration reader/calibration consumer, then preserve observed/estimated/unknown provenance through writes, reads and replay. Existing rows with unknown basis stay unknown; no invented backfill.

**Execution plan — 2026-09-26**

**Readiness:** Deferred; correct write-boundary inventory before designing provenance. The current prefill is in ItemDetailModal, not the capture form.

**Verify:** Proposed completion fixtures distinguish untouched estimate prefill, explicit observed entry, skipped time and unknown legacy rows. `pnpm exec vitest run src/lib/utils/dayOccurrences.test.ts`; verify read/calibration excludes non-observed durations and Undo preserves basis.

```delivery-plan-v1
{
  "outcome": "Schedule duration evidence distinguishes estimates/defaults from observed completion time.",
  "acceptance": [
    "Defaulted or prefilled actual_minutes never silently counts as observed.",
    "Basis survives writes, reads, replay and any calibration; old unknown rows stay unknown."
  ],
  "scope": [
    "src/components/items/ItemDetailModal.tsx",
    "src/features/items/useItemActions.ts",
    "src/app/api/items/[id]/complete/route.ts",
    "src/types/items.ts",
    "migrations/schema.sql"
  ],
  "steps": [
    "Trace actual_minutes from the task completion prompt through useItemActions and the complete route; inventory all readers/calibration consumers before changing its meaning.",
    "Define a minimal basis vocabulary and explicit input behavior so merely accepting a prefilled estimate is distinguishable from observed entry.",
    "Prepare additive schema/type/API changes and carry basis through online/replay completion and inverse history; never infer historical measured values.",
    "Update only proven consumers to calibrate from observed values and test unknown/estimated paths; coordinate with task-type retirement without bundling it."
  ],
  "invariants": [
    "No invented historical observation.",
    "Estimate and measurement remain distinct even when numerically equal.",
    "Occurrence identity and replay remain unchanged."
  ],
  "exclusions": [
    "Automatic timing/telemetry.",
    "Planner redesign.",
    "Recipe duration provenance KIT-13."
  ],
  "checks": [],
  "risks": [
    "A prefilled value can look deliberately entered.",
    "Unknown consumer/calibration code may treat every numeric actual as measured."
  ],
  "unknowns": [
    "Complete current duration-reader inventory and accepted basis names."
  ],
  "dependencies": [],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: ItemDetailModal prefill, useItemActions payload, complete route and schema estimate_minutes/actual_minutes verified."
}
```

### SCH-13

**Outcome:** Project canonical recurrence into Google Calendar.

- **Acceptance:** After canonical Schedule parity, project supported recurrence/exception semantics without a second engine. NOTIF-6.6 proves delivery/credentials/device alarms and does not alone certify semantic projection.
- **Depends on:** [SCH-8](<Schedule — Master Book.md#sch-8>).

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on SCH-8 (canonical parity) — projecting recurrence before the app agrees with itself would export the disagreement. The sync layer is `src/lib/gcal/sync.ts` (`syncItemToGoogleCalendar`, `deleteItemFromGoogleCalendar`) over `src/lib/gcal/client.ts`, with drift healing in `src/app/api/cron/gcal-reconcile/route.ts`. "Without a second engine" is the constraint: the RRULE and exception set must come from the canonical expansion path (`src/lib/schedule/expandOccurrences.ts` after SCH-4.3b) and `materializeOccurrence.ts`'s exception vocabulary, translated for Google — not recomputed. NOTIF-6.6 proves credentials and delivery and says nothing about semantics, so the acceptance keeps them separate. DST is the failure mode: `.claude/skills/timezone-handling/SKILL.md`.

**Execution plan — 2026-09-26**

**Readiness:** Deferred after SCH-8; semantic projection and credential/device delivery acceptance stay separate.

**Verify:** `pnpm exec vitest run src/lib/schedule/ src/lib/utils/date.test.ts`; add proposed pure Google payload fixtures for skip/move/override/pause, all-day dates and both DST transitions. Owner verifies supported series in an isolated calendar after NOTIF-6.6 delivery evidence.

```delivery-plan-v1
{
  "outcome": "Google Calendar reflects supported canonical Schedule recurrence and exception semantics.",
  "acceptance": [
    "Projection derives from the canonical Schedule contract and stable identities.",
    "Unsupported semantics remain explicit; delivery success alone does not certify parity."
  ],
  "scope": [
    "src/lib/gcal/sync.ts",
    "src/lib/gcal/client.ts",
    "src/app/api/cron/gcal-reconcile/route.ts"
  ],
  "steps": [
    "After canonical parity, inventory the current Google event projection against rule, exceptions, pauses, moved origins and flexible placements.",
    "Define a supported mapping using canonical occurrence/exception data; verify current official Google API semantics during implementation, without adding a recurrence engine.",
    "Implement idempotent projection/reconciliation using existing event IDs and recoverable post-commit status; changed/deleted instances must not duplicate events.",
    "Run pure payload/parity fixtures, then hand owner calendar/device checks over separately; report unsupported cases and external scheduler evidence explicitly."
  ],
  "invariants": [
    "Google remains a projection, never the Schedule source of truth.",
    "Sync failure cannot duplicate or roll back primary item creation.",
    "One canonical recurrence contract."
  ],
  "exclusions": [
    "Two-way sync.",
    "New calendar provider.",
    "Assuming cron is scheduled."
  ],
  "checks": [],
  "risks": [
    "Google series/instance exception identity can differ from display dates.",
    "All-day and DST conversions can shift a day or hour."
  ],
  "unknowns": [
    "Final supported projection subset and current provider credentials/scheduler/device evidence."
  ],
  "dependencies": [
    "SCH-8"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: current gcal sync rule payload and accepted separation from NOTIF-6.6 reviewed; no provider calls or external semantic claims."
}
```

### SCH-15

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C05. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Activate reusable definitions atomically.

- **Acceptance:** Catalogue C05: explicit activation checks source rights and destination, commits one execution instance with lineage and handles replay through the existing queue. No phantom success or duplicate activation.
- **Depends on:** [SCH-14](<Schedule — Master Book.md#sch-14>), [HUB-46](<../Hub & ERA/Hub & ERA — Master Book.md#hub-46>), [KIT-20](<../Kitchen/Kitchen — Master Book.md#kit-20>).

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Catalogue C05/§10.3 governs activation; SCH-14, HUB-46 and KIT-20 provide identity, transport and source revision prerequisites. Current source lineage is `items.source_catalogue_item_id`, but a link alone is not atomic activation. Same actor/kind/request plus identical canonical input returns the original committed item; changed input for that key returns 409. All Catalogue-derived callers, including browser SDK writes and offline replay, must converge on the checked command. Required children, provenance/history and receipt commit with the item; Google sync follows as a recoverable projection.

**Execution plan — 2026-09-26**

**Readiness:** Deferred and split first; C00/C02 evidence, source rights and HUB-46 transport must be ready before activation cutover.

**Verify:** Proposed C05 command fixtures inject failure after each required write and test same-key replay, changed-payload409, deliberate second activation, private source/shared destination, unlink and Google failure. `pnpm typecheck`; isolated DB proves receipt/effect atomicity.

```delivery-plan-v1
{
  "outcome": "Explicit Catalogue activation commits one complete Schedule execution and retains its identity through replay.",
  "acceptance": [
    "Required item/details/rule/subtasks/alerts/prerequisites/history/receipt commit together or not at all.",
    "Same request returns the first item; a deliberate different request may create another activation."
  ],
  "scope": [
    "src/app/api/items/route.ts",
    "src/features/items/useItems.ts",
    "src/components/items/CatalogueTemplatePicker.tsx",
    "src/components/web/AddFlexibleFromCatalogueDialog.tsx",
    "src/components/planner/MobileFlexibleAssignmentPage.tsx",
    "src/lib/offlineQueue.ts",
    "src/lib/offlineSyncEngine.ts",
    "migrations/schema.sql"
  ],
  "steps": [
    "Read Catalogue §10.3/C05 and completed transport/source-revision contracts; enumerate every Catalogue-derived API, browser SDK and replay writer.",
    "Pin the proposed /api/items/from-catalogue route/shared command path; reuse the existing atomic item writer/receipt when available rather than creating a competing mechanism.",
    "Prepare a checked migration that validates source revision/destination, commits required children/provenance and retains actor+kind+request outcome identity; failure aborts the whole effect.",
    "Migrate caller batches and the legacy payload facade, then verify conditional Undo and recoverable post-commit Google sync. Owner applies SQL at the compatible rollout stage."
  ],
  "invariants": [
    "No source-private data copied to an unauthorized audience.",
    "Fresh operational subtasks carry no completion state.",
    "Unknown outcome remains recoverable, never a new random activation."
  ],
  "exclusions": [
    "New activation table or universal command framework.",
    "Ordinary standalone create redesign.",
    "Inert prerequisite activation."
  ],
  "checks": [],
  "risks": [
    "Direct SDK writers can bypass an API-only fix.",
    "Item ID regeneration on replay creates duplicates."
  ],
  "unknowns": [
    "Current C00/C02 and E-09 transport acceptance; shared command/receipt location and final slice scopes."
  ],
  "dependencies": [
    "SCH-14",
    "HUB-46",
    "KIT-20"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: accepted C05/§10.3 and current create/caller paths reviewed; proposed command is not claimed present."
}
```

### SCH-16

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C06. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Promote definitions without rewriting executions.

- **Acceptance:** Catalogue C06: promotion creates a reusable definition while existing execution IDs/history remain unchanged. Permission and revision preconditions apply.
- **Depends on:** [SCH-15](<Schedule — Master Book.md#sch-15>).

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Catalogue C06, depends on SCH-15. The invariant is that promotion creates a *definition* and leaves every existing *execution* row untouched — same IDs, same history. Read `src/app/api/items/[id]/promote/route.ts` (the existing item→catalogue promotion) and `src/features/catalogue/hooks.ts` (`useCreateItem`, `useUpdateItem`) for the destination. Revision preconditions are KIT-20's deliverable — do not invent a second staleness scheme here. Permission checks follow the household rules in Hard Rule #13.

**Execution plan — 2026-09-26**

**Readiness:** Deferred after SCH-15 and C02/C03 source protection; reuse the checked command boundary.

**Verify:** Proposed promotion tests cover all supported item types, fixed/flexible/one-off, linked/unlinked retry, source already linked, field selection, child/history failure and Undo after definition reuse. `pnpm typecheck`; execution IDs/actions/children remain byte-equivalent.

```delivery-plan-v1
{
  "outcome": "Promotion creates one reusable definition from selected defaults without rewriting execution history.",
  "acceptance": [
    "Retries return the same definition, including keep_linked=false.",
    "Execution dates, actual/completed state and placement/firing identities never become template defaults."
  ],
  "scope": [
    "src/app/api/items/[id]/promote/route.ts",
    "src/components/items/PromoteToCatalogueDialog.tsx",
    "src/features/catalogue/hooks.ts",
    "migrations/schema.sql"
  ],
  "steps": [
    "Read C06 and the current promote route's insert→optional reverse link→history sequence; identify which required failures currently escape atomicity.",
    "Move promotion into SCH-15's checked command, reading the authorized source and deliberately selected defaults rather than trusting arbitrary client metadata.",
    "Preserve linked/unlinked modes; keep existing source provenance or offer explicit Save copy rather than repointing it. Commit definition/optional association/history/receipt together.",
    "Verify replay and conditional Undo after later edits/reuse, keeping the existing item, children and occurrence history unchanged; owner applies any paired migration."
  ],
  "invariants": [
    "Promotion creates a definition, not a replacement execution.",
    "No observed duration or completion state copied into defaults.",
    "Source lineage cannot silently change."
  ],
  "exclusions": [
    "Moving definitions into a new module.",
    "Recreating the item.",
    "Implicit future propagation."
  ],
  "checks": [],
  "risks": [
    "Unlinked promotion still needs durable replay identity.",
    "Undo could destroy a definition another execution now uses."
  ],
  "unknowns": [
    "Current C02/C03 acceptance and shared command's exact revision/inverse contract."
  ],
  "dependencies": [
    "SCH-15"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: promote route's separate insert/link/history stages and accepted C06 read; no atomicity claim inferred."
}
```

### SCH-17

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C07. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Pause, stop and resume one activation coherently.

- **Acceptance:** Catalogue C07: preserve one activation’s history and future schedule intent through pause/stop/resume. Existing recurrence exceptions remain authoritative; no cloned execution to simulate resume.
- **Depends on:** [SCH-15](<Schedule — Master Book.md#sch-15>).

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Catalogue C07, depends on SCH-15. "No cloned execution to simulate resume" is the load-bearing clause: pause/stop/resume must move one activation through states, not create a second row. The existing pause machinery is `recurrence_pauses` plus the exception vocabulary in `src/lib/schedule/materializeOccurrence.ts` (`isSkippedException`, `isRescheduledException`) — the acceptance says existing recurrence exceptions stay authoritative, so resume must not overwrite them. `.claude/skills/recurrence-safety/SKILL.md` is mandatory; pausing and resuming is exactly where duplicate generation has bitten before. Trips' `activate_trip` also writes `recurrence_pauses` (TRIP-1) — check you are not fighting it.

**Execution plan — 2026-09-26**

**Readiness:** Deferred and split first; requires accepted identity, consumer parity and protected source lifecycle as specified by C07.

**Verify:** Proposed lifecycle fixtures cover pause/resume/Undo, overlapping Trips pause, stopped fixed/flexible/one-off work, future completed history, two activations, retries and cron suppression. `pnpm exec vitest run src/lib/schedule/ src/lib/utils/dayOccurrences.test.ts`.

```delivery-plan-v1
{
  "outcome": "Pause, stop and resume target one activation without erasing its history or unrelated pause effects.",
  "acceptance": [
    "Resume reverses only its own pause; stop retains IDs and completed history.",
    "Multiple uses require an explicit activation selection, with truthful inverse/conflict behavior."
  ],
  "scope": [
    "src/app/api/items/[id]/pauses/route.ts",
    "src/app/api/catalogue/[id]/disable/route.ts",
    "src/components/web/DisableCatalogueItemDialog.tsx",
    "src/features/items/useItemActions.ts",
    "src/lib/schedule/expandOccurrences.ts",
    "migrations/schema.sql"
  ],
  "steps": [
    "Read C07/§10.3 and current disable/pauses paths; inventory callers that currently trust one linked_item_id or mutate rule end dates independently.",
    "Split pause ownership, stop boundary and selected-activation UI into bounded commands reusing SCH-15 receipts; preserve overlapping Trips pause records.",
    "Retain all placements/actions/completions and suppress pending future work through canonical readers/alert semantics; one-offs use the existing cancellation domain.",
    "Replace the legacy disable internals only when its target is unambiguous, otherwise require selection/409; verify no blanket alert reactivation and conditional Undo."
  ],
  "invariants": [
    "No cloned execution to resume.",
    "Stop never deletes future-dated completed history.",
    "The reusable source remains available for intentional new activation."
  ],
  "exclusions": [
    "Changing Trips reversal policy.",
    "Deleting occurrence history.",
    "New lifecycle tables unless accepted constraints require them."
  ],
  "checks": [],
  "risks": [
    "An inclusive stop boundary can suppress one extra occurrence.",
    "Resuming one source can accidentally cancel a Trips pause."
  ],
  "unknowns": [
    "Current protected-source/identity/consumer acceptance and command boundary compatibility."
  ],
  "dependencies": [
    "SCH-15",
    "SCH-14",
    "SCH-8"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: current disable route and accepted C07/overlap rules reviewed; complete lifecycle audit remains future work."
}
```

### SCH-18

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C08. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Apply reusable defaults only to future work.

- **Acceptance:** Catalogue C08: future-only defaults, accurate usage and inverse-source reads preserve completed/past execution values and lineage.
- **Depends on:** [SCH-16](<Schedule — Master Book.md#sch-16>), [SCH-17](<Schedule — Master Book.md#sch-17>).

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Catalogue C08, depends on SCH-16 and SCH-17. "Future-only" means a definition edit changes what future activations inherit and never rewrites a completed or past execution — so the read path must resolve defaults at activation time and store the resolved values, or resolve-through-lineage without mutating history. The lineage column is `source_catalogue_item_id`; the catalogue metadata write path is `src/app/api/catalogue/items/[id]/route.ts` (which KIT-20 is making typed and revision-checked). "Accurate usage" means a count that reflects real activations, which is the same care `times_cooked` needed in KIT-11.

**Execution plan — 2026-09-26**

**Readiness:** Deferred and split first; C08 rollout needs explicit future-effective baselines before template cadence/target editing is enabled.

**Verify:** Proposed C08 cases: definition20→30 with instance25 unchanged; target3→5 affects only new activation; unknown historical target remains unknown; two series/assignees counted once each; usage GET writes nothing. `pnpm exec vitest run src/lib/schedule/`.

```delivery-plan-v1
{
  "outcome": "Reusable defaults affect future activation choices while existing execution values and history remain stable.",
  "acceptance": [
    "Duration/cadence/chore/target edits do not rewrite current instances implicitly.",
    "Usage derives from real authorized activations and preserves unknown historical quota."
  ],
  "scope": [
    "src/app/api/catalogue/items/[id]/route.ts",
    "src/features/items/useFlexibleRoutines.ts",
    "src/components/planner/MobileFlexibleAssignmentPage.tsx",
    "src/components/web/CatalogueSidePanel.tsx",
    "src/components/web/WebCatalogue.tsx",
    "migrations/schema.sql"
  ],
  "steps": [
    "Read C08 flexible-target semantics and inventory live definition reads/propagation, including current is_chore fan-out and template-to-routine first-match assumptions.",
    "Prepare nullable rule target/effective-date storage and an explicit future baseline per active linked series; unresolved baselines block dependent default edits with input preserved.",
    "Capture defaults during activation, then remove implicit execution fan-out while preserving latest library suggestions for the unscheduled pool.",
    "Derive authorized usage from inverse source links and select the intended activation in Assign; compatibility flags are maintained by commands, never repaired by reads."
  ],
  "invariants": [
    "No fabricated past quota or conversion of one-offs into a series.",
    "One placement is not another activation for counting.",
    "Private consumers do not leak through usage counts."
  ],
  "exclusions": [
    "Opt-in updates to existing work SCH-19.",
    "Universal version store.",
    "Changing completed values."
  ],
  "checks": [],
  "risks": [
    "A live target lookup rewrites the meaning of old periods.",
    "Removing fan-out before capturing defaults can break active series."
  ],
  "unknowns": [
    "Current source revision/baseline acceptance and exact rollout/writer inventory."
  ],
  "dependencies": [
    "SCH-16",
    "SCH-17"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: current is_chore update fan-out and accepted C08/§10.3 inspected; rollout baselines not performed."
}
```

### SCH-19

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C18. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Offer explicit updates to future activations.

- **Acceptance:** Catalogue C18 P2 held: opt-in future updates only after C04–08 acceptance, with preview, rights and revision checks. Never rewrite existing history or silently propagate template edits.
- **Depends on:** [SCH-14](<Schedule — Master Book.md#sch-14>), [SCH-15](<Schedule — Master Book.md#sch-15>), [SCH-16](<Schedule — Master Book.md#sch-16>), [SCH-17](<Schedule — Master Book.md#sch-17>), [SCH-18](<Schedule — Master Book.md#sch-18>).

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Catalogue C18 P2, held until C04–C08 (SCH-14/15/16/17/18) are all accepted — so its guide is really theirs; read them first and do not start this early. The two prohibitions are the design: never rewrite existing history, and never silently propagate a template edit. That makes it opt-in with a preview, which means a diff between the current activation and what the definition now says — the nearest existing precedent for "show me what will change before I accept" is Delivery's plan-approval flow, and for rights/revision checks it is KIT-20's preconditions. Surfaces: `src/features/catalogue/` and `src/app/reminders/`.

**Execution plan — 2026-09-26**

**Readiness:** Held/deferred — C18 P2 only after C04–C08 are fully accepted. Initial delivery may stop before this feature.

**Verify:** Proposed future-update matrix covers selected/unselected activations, this/future boundary, 29th/31st rules, mid-period target changes, overrides, completed history, stale revisions and Undo after another edit. `pnpm exec vitest run src/lib/schedule/ src/lib/utils/date.test.ts`.

```delivery-plan-v1
{
  "outcome": "An explicit preview lets authorized users apply selected definition changes only to chosen future pending work.",
  "acceptance": [
    "Past/completed work and unselected/manual overrides remain unchanged.",
    "The selected effective scope and revision checks govern one replay-safe update and truthful inverse."
  ],
  "scope": [
    "src/components/web/CatalogueItemDetailDialog.tsx",
    "src/components/items/EditScopeDialog.tsx",
    "src/components/items/RecurringEditChoiceDialog.tsx",
    "src/features/items/useItemActions.ts",
    "migrations/schema.sql"
  ],
  "steps": [
    "Verify SCH-14/15/16/17/18 acceptance, then compare captured instance values with the selected source revision; do not expose this action from mere source edit.",
    "Build a concise field/activation diff preserving manual overrides and ask for explicit selection plus future effective scope.",
    "Reuse checked Schedule commands with rights/revision/request identity; add effective-dated target values only when that portion is enabled, keeping original item/occurrence identities.",
    "Test anchor/exception preservation and conditional Undo under later edits; owner applies reviewed SQL and runtime verification separately."
  ],
  "invariants": [
    "No silent template propagation.",
    "No cross-owner synchronization without authorization.",
    "Past target/history never rewritten."
  ],
  "exclusions": [
    "Automatic update-all.",
    "New Tasks page or universal version store.",
    "Enabling before C04–C08 evidence."
  ],
  "checks": [],
  "risks": [
    "Series splitting can drift anchors or orphan exceptions.",
    "A stale preview can overwrite newer manual adjustments."
  ],
  "unknowns": [
    "Final accepted future-scope UX and effective-dated target contract when prerequisites are ready."
  ],
  "dependencies": [
    "SCH-14",
    "SCH-15",
    "SCH-16",
    "SCH-17",
    "SCH-18"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26: accepted C18 and related §10.3 constraints reviewed; this remains a held plan, not a rollout commitment."
}
```

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
