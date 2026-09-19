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

### SCH-7

**Outcome:** Refuse unsupported recurrence before capture.

- **Acceptance:** Unsupported recurrence is refused before creating a one-time reminder or a misleading pending turn; blocks safe E-09 conversational capture.

**Retained contract — ASTRA-SCH-2:**

- **Outcome:** A recurring request cannot be acknowledged as recurring after creating a one-time reminder.
- **Boundary:** Guard parsed recurrence before writeReminder and before an incomplete request becomes a pending turn; guard the pending answer too. Return existing structured-form handoff/refusal and unsuccessful outcome, with original input recoverable. No POST, no fake recurring success, no new recurrence parser. Preserve explicit one-time requests.
- **Money/schedule math?:** Yes: “every Monday at9” → zero one-time rows, no false recurring receipt; “Monday at9” → one existing nonrecurring path. Pending-time response containing recurrence likewise writes zero.
- **Gate:** `pnpm exec vitest run src/features/era/intents/resolveIntent.test.ts --reporter=verbose` → nonzero initial/pending recurrence and one-time control cases pass; mocked POST count0 for unsupported cases. Common gates; 390×844 capture preserves input and existing form door.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### SCH-5.5

**Outcome:** Finish mobile reminder form cleanup and verification.

- **Acceptance:** Mobile-form cleanup carried from the R3–R8 rounds: add **Undo** to success toasts (Hard Rule #1), remove the stray `console.error` in the submit/speech handler (Hard Rule #22), drop the unused `missingFieldType` state, and do the real-device visual check across themes.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### SCH-1.9

**Outcome:** Document the shipped capture behavior.

- **Acceptance:** Post-ship docs: [Items & Reminders Overview](<../../02 - Standalone Modules/Items & Reminders/Overview.md>) updated with the new capture behaviors. No new route/icon, so Atlas/Routes unchanged.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### SCH-1b.4

**Outcome:** Harden conservative recurrence extraction.

- **Acceptance:** Harden recurrence extraction — keep conservative; **gate behind the SCH-4.2 tests** before trusting RRULE writes from text.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### SCH-1c.1

**Outcome:** Parse one-line items through Gemini safely.

- **Acceptance:** Wire one-line → structured item via **Gemini**; **pass `timeoutMs`** (Hard Rule #6 — AI calls can exceed the current 8 s default). → `src/lib/ai/gemini.ts`

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### SCH-1c.2

**Outcome:** Reuse Hub reminder creation with confirmation.

- **Acceptance:** Reuse/extend the Hub create path ([AddReminderFromMessageModal.tsx](<../../../src/components/hub/AddReminderFromMessageModal.tsx>) · [messageActions.ts](<../../../src/features/hub/messageActions.ts>)) — confirm chip before commit.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

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

### SCH-9

**Outcome:** Give online and replayed reminders equal alert semantics.

- **Acceptance:** UU-X2: online draft reminder creation and queued API replay must produce the same intended alerts. Documented online hook omitted the active alert that replay adds; cover retries and offline-to-online transitions.

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

### SCH-10

**Outcome:** Verify prerequisite access against current RLS.

- **Acceptance:** H-01 and Aug19 Inbox: owner supplies item_prerequisites and parent/child read-path RLS state. Preserve intended household access and choose an approved hot-child contract only from current evidence.

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

### SCH-14

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C04b. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Preserve occurrence identity through every action.

- **Acceptance:** Catalogue C04b: one stable occurrence/slot identity across subtasks, alerts, completion, exceptions and replay. Verify existing series actions and DST boundaries, not just display dates.
- **Depends on:** [SCH-4.3b](<Schedule — Master Book.md#sch-43b>).

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

### SCH-2.1

**Outcome:** Parse "at home" / "when I get home".

- **Acceptance:** Parse "at home" / "when I get home" → set `location_context: "home"`.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### SCH-2.2

**Outcome:** Map the phrase "home".

- **Acceptance:** Map the phrase "home" → the user's tag via `nfc_tags.label` → attach an `nfc_state_change` prerequisite (arrive-home). → `src/lib/prerequisites/evaluators/nfc-state.ts`

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### SCH-2.3

**Outcome:** Pre-fill the existing `PrerequisitePicker` from parsed text (plumbing already wired in the form).

- **Acceptance:** Pre-fill the existing `PrerequisitePicker` from parsed text (plumbing already wired in the form).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### SCH-3.1

**Outcome:** Lightweight **one-question** clarification for ambiguous phrases ("later".

- **Acceptance:** Lightweight **one-question** clarification for ambiguous phrases ("later" → Tonight / Tomorrow / Pick time); never block a simple save.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### SCH-3.2

**Outcome:** Compact, on-brand chip preview obeying the look-and-feel Hard Rules (`useThemeClasses()`, opaque panels via `tc.bgPage` #15, no hardcoded colors #10,….

- **Acceptance:** Compact, on-brand chip preview obeying the look-and-feel Hard Rules (`useThemeClasses()`, opaque panels via `tc.bgPage` #15, no hardcoded colors #10, futuristic SVG icons #4, Undo toast #1, `inputMode="decimal"` #19, mobile-first #5).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### SCH-4.4

- **Retained campaign gate (D2):** DEC-10 must resolve whether time_window is mandatory; the old unconditional DoD is not silently waived or falsely completed.

**Outcome:** `time_window` prerequisite evaluator (one of the 4 inert).

- **Acceptance:** `time_window` prerequisite evaluator (one of the 4 inert) — optional, only if a feature needs it.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### SCH-4.5

**Outcome:** Split `useItems.ts` (~2,621 LOC).

- **Acceptance:** Split `useItems.ts` (~2,621 LOC) — only when a feature next forces you in, not "just because."

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### SCH-5.2

**Outcome:** Give each surface **one job** per the surface map (Month / Week / Today / Form).

- **Acceptance:** Give each surface **one job** per the surface map (Month / Week / Today / Form).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### SCH-5.3

**Outcome:** Investigate the [MobileReminderForm.tsx](<../../../src/components/reminder/MobileReminderForm.tsx>) vs….

- **Acceptance:** Investigate the [MobileReminderForm.tsx](<../../../src/components/reminder/MobileReminderForm.tsx>) vs [MobileItemForm.tsx](<../../../src/components/items/MobileItemForm.tsx>) **duplication** — decide keep/merge/retire. **No deletion without a decision.**

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### SCH-5.4

**Outcome:** Reassignment **history / audit** trail.

- **Acceptance:** Reassignment **history / audit** trail — "who had it when" (W8).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### SCH-6.1

**Outcome:** Retire the task type across storage and surfaces.

- **Acceptance:** *(packet **M-09** of the [ERA Top Layer — Master Plan](<../_Archive/Plans/ERA Top Layer — Master Plan (2026-09-02).md>), Lane M while native waits; split M-09a DB+types / M-09b surfaces+docs)* Retire the `task` type end-to-end (DB + all surfaces + the `ItemType` union + docs). Do this as one dedicated slice before touching the DB.

- **Acceptance:** no `task` value remains in the `ItemType` union, any surface, or the DB; existing `task` rows are migrated with a paired migration file.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### SCH-11

**Outcome:** Audit the arrive and leave NFC experience.

- **Acceptance:** Preserve the NFC Inbox proposal: inspect both arrive/leave flows and their UI, then identify a bounded useful change. Schedule owns the behavior with Native consuming existing tags; no new campaign, geofencing or speculative revamp. Native bridge first.
- **Depends on:** [NAT-6](<../Native App/Native App — Master Book.md#nat-6>).

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

### SCH-12

**Outcome:** Separate estimated and observed schedule duration.

- **Acceptance:** PE-X1: defaulted/prefilled actual duration must not count as measured completion evidence. Preserve provenance through writes, reads and calibration; no invented backfill.

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

### SCH-13

**Outcome:** Project canonical recurrence into Google Calendar.

- **Acceptance:** After canonical Schedule parity, project supported recurrence/exception semantics without a second engine. NOTIF-6.6 proves delivery/credentials/device alarms and does not alone certify semantic projection.
- **Depends on:** [SCH-8](<Schedule — Master Book.md#sch-8>).

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

### SCH-15

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C05. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Activate reusable definitions atomically.

- **Acceptance:** Catalogue C05: explicit activation checks source rights and destination, commits one execution instance with lineage and handles replay through the existing queue. No phantom success or duplicate activation.
- **Depends on:** [SCH-14](<Schedule — Master Book.md#sch-14>), [HUB-46](<../Hub & ERA/Hub & ERA — Master Book.md#hub-46>), [KIT-20](<../Kitchen/Kitchen — Master Book.md#kit-20>).

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

### SCH-16

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C06. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Promote definitions without rewriting executions.

- **Acceptance:** Catalogue C06: promotion creates a reusable definition while existing execution IDs/history remain unchanged. Permission and revision preconditions apply.
- **Depends on:** [SCH-15](<Schedule — Master Book.md#sch-15>).

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

### SCH-17

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C07. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Pause, stop and resume one activation coherently.

- **Acceptance:** Catalogue C07: preserve one activation’s history and future schedule intent through pause/stop/resume. Existing recurrence exceptions remain authoritative; no cloned execution to simulate resume.
- **Depends on:** [SCH-15](<Schedule — Master Book.md#sch-15>).

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

### SCH-18

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C08. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Apply reusable defaults only to future work.

- **Acceptance:** Catalogue C08: future-only defaults, accurate usage and inverse-source reads preserve completed/past execution values and lineage.
- **Depends on:** [SCH-16](<Schedule — Master Book.md#sch-16>), [SCH-17](<Schedule — Master Book.md#sch-17>).

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

### SCH-19

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C18. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Offer explicit updates to future activations.

- **Acceptance:** Catalogue C18 P2 held: opt-in future updates only after C04–08 acceptance, with preview, rights and revision checks. Never rewrite existing history or silently propagate template edits.
- **Depends on:** [SCH-14](<Schedule — Master Book.md#sch-14>), [SCH-15](<Schedule — Master Book.md#sch-15>), [SCH-16](<Schedule — Master Book.md#sch-16>), [SCH-17](<Schedule — Master Book.md#sch-17>), [SCH-18](<Schedule — Master Book.md#sch-18>).

**Provenance:** [Schedule — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Schedule/Schedule — Master Book.md>). The source is historical; this entry owns the retained outcome.

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
