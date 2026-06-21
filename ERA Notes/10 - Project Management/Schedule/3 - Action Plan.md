---
created: 2026-05-30
updated: 2026-06-20
type: action-plan
status: active
owner: Elio
tags:
  - pm/action
  - scope/module
  - module/schedule
---

# Schedule · 3 — Action Plan

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the *why, and in what order* — the call + the sequenced Now/Next/Later queue + the candidate-work tables. The flat, phased, checkable surface (the Master Build Checklist) is [4 · Checklist](<4 - Checklist.md>). **Tell me a line (e.g. _1.3_), a group, or a phase, and I'll work it.**
>
> **Legend:** Sev 🔴 blocker · 🟠 friction · 🟡 annoyance · ⚪ parked. Effort S/M/H.
>
> **Decisions already locked** (don't re-litigate — [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>)): three types stay in data, type inferred at save; **both capture lanes** (rule-based in the form, Gemini in Hub); **no geofencing**; Focus → per-item mode; household co-edit + reassign both ways; recurrence action model = Google/Outlook standard.

---

## 📌 The call

**The pain is mapped ([1 · Feature State](<1 - Feature State.md>)). The directions are set ([2 · Vision & Roadmap](<2 - Vision & Roadmap.md>)). The design substrate is ready ([file 3](<2 - Vision & Roadmap.md>)). Now execute, foundation-first.**

Schedule is 🟢 Core and stable, so the danger isn't missing features — it's that its **trickiest logic (recurrence + occurrence actions + the flexible placement rule)** needed hardening, and four prerequisite evaluators are advertised but inert. The household-co-edit slice (the original highest-severity pain, two 🔴s) is **done**; the form-capture refactor is largely **shipped**. **The recurrence/occurrence-action correctness bug is fixed (2026-06-19)** — "Skip" no longer duplicates recurring occurrences (Stage 1 of [file 4](<2 - Vision & Roadmap.md>) shipped). **The current top priority is now the one stub with the best value-for-effort (`time_window`)**, then engine unification (Stage 2), then make ERA read the time graph.

This mirrors the global theme ("Stabilize, then Connect") at the module level: harden the recurrence core, then connect Schedule outward.

> **Shipped ad-hoc, outside the original sequence:** "Plan My Day" (`/today`, now merged into `/reminders`) — a disrupted-day triage planner (push off / both-direction prepone / ad-hoc tasks / checkpoints), shipped 2026-06-16. Phase 1 only — hourly timeline + mood/energy optimizer deferred. See [2 · Vision](<2 - Vision & Roadmap.md>) Track A and [Plan My Day Overview](<../../03 - Junction Modules/Plan My Day/Overview.md>). Doesn't change the foundation-first call.
>
> - [x] **Fixed 2026-06-16:** the day-plan header (title/intent/notes/Private-Shared) and checkpoints were firing a full API call on every keystroke/click — worst case a `POST` per Private/Shared toggle. Replaced with a save-gated draft model: an unplanned day shows an editable form with one **Save**; a planned day shows a read-only **preview card** with **Edit**/**Delete**. No API calls during editing, only on Save/Delete (checkpoint done/undone toggle stays live by design). See [Plan My Day Overview](<../../03 - Junction Modules/Plan My Day/Overview.md>) "The save-gated draft model."

---

## 🎯 Candidate work

### Campaign work items *(every pain from [1 · Feature State](<1 - Feature State.md>), as work items)*

| # | Work item | From | Sev | Effort | Bounded? | Foundational? |
|---|---|---|---|---|---|---|
| ~~W1~~ ✅ | ~~Align PATCH/DELETE auth with household-aware check~~ | C1 | 🔴 | S | ✅ yes | — |
| ~~W2~~ ✅ | ~~"Pass to partner" / "take it back" reassign actions~~ | C1 | 🔴 | M | ✅ yes | — |
| ~~W3~~ ✅ | ~~"Assigned out" / "assigned to me" buckets in `/reminders`~~ | C1 | 🟠 | S–M | ✅ yes | — |
| ~~W4~~ ✅ | ~~Confirm RLS + `get_schedule_bundle` returns partner items~~ | C1/C4 | 🟠 | S | ✅ yes | ✅ unblocks W1–W3 |
| ~~W5~~ ✅ | ~~Re-export live schema (RPC + RLS) into `schema.sql`~~ | C4 | 🟠 | S | ✅ yes | ✅ stops repo lying |
| W6 | Decide capture path (A Hub / B form / both) → build it | C3 | 🟠 | M | partly | — |
| ~~W7~~ ✅ | ~~Focus → per-item mode; retire `/focus`; fold into Week view~~ | C2 | 🟠 | M–H | partly | — |
| W8 | Reassignment history / audit | C1 | 🟡 | M | ✅ yes | — |
| W9 | Surface consolidation (`/reminders` role; clarify each job) — *mostly done via Plan My Day merge; residual role open* | C2 | 🟠 | M | partly | — |
| W10 | Form NL quick-capture box (rule-based; pre-fills structured fields as chips) — *mostly already exists* | C3 | 🟠 | M | partly | — |
| W11 | Hub Chat Gemini capture (one line → structured item) | C3 | 🟠 | M | partly | — |
| W12 | NFC-from-text (Phase 2): "when I get home" → `location_context` + arrive-home prerequisite | C3 | 🟡 | M | partly | — |
| W13 | ~~**Recurrence/occurrence-action correctness fix** (Skip-duplicate 🔴)~~ *(Stage 1 DONE 2026-06-19)* + engine/UI unification (Stage 2–3, open) | C5 | ✅→🟠 | M–H | partly | ✅ top live foundation |

> **W10–W12 are refinements of W6** (the capture-path decision), scoped in [file 3 Part 2](<2 - Vision & Roadmap.md>). They do not replace W6; the form refactor in [file 3 Part 1 §4](<2 - Vision & Roadmap.md>) is the foundation they sit on. **W13** is the concrete form of the recurrence weak-link — see [file 4](<2 - Vision & Roadmap.md>) for the staged plan.

### Foundational + enhancement candidates *(from [file 2 Track A/B](<2 - Vision & Roadmap.md>))*

| Candidate | Track | Impact | Effort | Foundation? |
|---|---|---|---|---|
| ~~Recurrence/occurrence correctness fix (Skip)~~ *(Stage 1 DONE 2026-06-19)* + engine unify (Stage 2, open) — [file 4](<2 - Vision & Roadmap.md>) | A | High | M–H | ✅ yes (top) |
| Placement-rule guard test | A | High | S | ✅ yes |
| Recurrence / occurrence-action unit tests | A | High | M | ✅ yes |
| `time_window` prerequisite evaluator | A | High | S–M | — |
| Schedule → briefing enrichment | B | High | M | — |
| Schedule ↔ Budget due-date unify | B | High | H | — |
| Recurrence edit UX ("this / this-and-future / all") | A | Med | M | — |
| Bulk occurrence ops | A | Med | M | — |
| `schedule` / `custom_formula` prerequisites | A | Med | M each | — |

---

## 🗓️ Sequenced plan (Now / Next / Later)

### ✅ Shipped — Household co-edit + reassign *(the original first slice)*

- [x] **Step 1 — Verify the ground truth (W4).** *(DONE 2026-06-06)* RPC body captured: returns `user_id = me OR (partner's AND is_public = true)`. W1 alone was enough — RLS policies already grant household co-edit. See [file 1, Cluster 1 myth correction](<1 - Feature State.md>).
- [x] **Step 2 — Align write auth (W1).** *(DONE 2026-05-31)* `canMutateItem()` helper in [src/app/api/items/[id]/route.ts](<../../../src/app/api/items/[id]/route.ts>) — creator OR responsible OR active partner. Partner can edit/delete shared items; strangers still get 403.
- [x] **Step 3 — Reassign both ways (W2).** *(DONE 2026-06-06)* `onReassign` prop on [ItemActionsSheet.tsx](<../../../src/components/items/ItemActionsSheet.tsx>); fetches household via `useHouseholdMembers`, "Pass to partner" when I'm responsible, "Take it back" when partner is. Wired with `useUpdateItem` + Undo toast (no dedicated endpoint — RLS covers it).
- [x] **Step 4 — Make handed-off items findable (W3).** *(DONE 2026-06-06)* "Assigned to me" / "Assigned out" collapsible sections in [StandaloneRemindersPage.tsx](<../../../src/components/reminder/StandaloneRemindersPage.tsx>) with one-tap "Return →" / "← Reclaim".
- [x] **Step 5 — Stop the repo lying (W5).** *(DONE 2026-06-06)* Table DDL, `get_schedule_bundle` RPC body, and all RLS policies appended to [migrations/schema.sql](<../../../migrations/schema.sql>).
- [x] **Focus → mode (W7).** *(DONE 2026-06-06)* Retired `/focus` + `FocusPage.tsx` + `FlexibleRoutinesPool.tsx` + `ScheduleRoutineSheet.tsx`. Added `onFocus` + Focus button (crosshair) to `ItemActionsSheet` → `ItemDetailModal`. Week view's "Flexible this week" strip handles routine assignment. Atlas, Feature Index, Routes doc, vault doc updated.
- [x] **Placement-rule guard test.** Asserts a flexible item is *not* placed via rrule and *is* placed from `item_flexible_schedules`. Prevents the "flexible item shows on activation day" class of bug across all 6+ views. → [Schedule Feature](<../../02 - Standalone Modules/Items & Reminders/Schedule Feature.md>) "Adding a New View" checklist.

### ✅ Now — Recurrence & occurrence-action correctness *(Stage 1 — [file 4](<2 - Vision & Roadmap.md>) — SHIPPED 2026-06-19)*

- [x] **W13 / Stage 1 — kill the "Skip → next occurrence" trap.** *(DONE 2026-06-19)* Removed on **all four** surfaces found (`WebEvents.tsx`, `ItemActionsSheet.tsx`, `WebTabletMissionControl.tsx` — found during implementation, `ItemDetailModal.tsx` quick-action row — found during implementation); real **Skip this occurrence** wired (`handleSkip`/`useSkipItem`; `onSkip` on `ItemActionsSheet` + all 4 callers; Skip control on the calendar modal + tablet mission control); "Cancel" now appears only for one-off items; `calculateNextOccurrence` + the `next_occurrence` postpone type deleted from `useItemActions.ts`.
- [x] **`/reminders` show/hide-completed toggle** *(DONE 2026-06-19)* + collapsible "Completed (n)" section (default hide; persisted in `localStorage`) — [file 4 §5](<2 - Vision & Roadmap.md>).
- [x] **Recurrence + occurrence-action unit tests.** *(DONE 2026-06-19)* [dayOccurrences.test.ts](<../../../src/lib/utils/dayOccurrences.test.ts>) covers the skip/complete/move repro + dedup against the engine `/reminders` & Today actually use, plus `isOccurrenceCompleted` per action type. Pure-logic, no Supabase mocks. Full RRULE-edge-case coverage still gated behind Stage 2 (engine unification). **Gates the recurrence-from-text parser (1b.4)** — unblocked for the cases now covered.

### ⏭️ Next — Foundation + first enhancement

- [ ] **Engine unification (W13 / [file 4](<2 - Vision & Roadmap.md>) Stage 2–3).** Finish `schedule/expandOccurrences.ts` (flexible injection + postponed actions; converge moves onto `rescheduled_to`); migrate every surface onto it; delete `dayOccurrences.ts` + inline loops; one shared occurrence-action sheet (Stage 3). Lock with the expanded `expandOccurrences.test.ts`.
- [ ] **Capture path remaining (W6 → W11 / W12).** Form half + rule-based NL box already shipped/exist; remaining = **W11** Hub Chat Gemini capture; **Phase 2 (W12)** location/NFC-from-text. See the Master Build Checklist below.
- [ ] **Ship `time_window` prerequisite.** Smallest stub, highest demo value (meds/morning windows). Proves the conditional-automation engine end-to-end before tackling `schedule` / `custom_formula`.

### 🔜 Later — Connect outward

- [ ] **Schedule → briefing enrichment** (feed the full week's shape into Focus/ERA). _(global Track B)_
- [ ] **Schedule ↔ Budget due-date unify** — bigger; scope after the foundation/recurrence tests exist. _(global Track A / Cashflow)_
- [ ] **Reassignment history/audit (W8).**
- [x] **Surface consolidation — `/reminders` merged with Plan My Day (W9).** *(IMPLEMENTED 2026-06-17; toolbar tuned 2026-06-19)* `WebDayPlanner.tsx` hosts `/reminders` Focus tab; `StandaloneRemindersPage.tsx` deleted; `/today` → redirect. Three-state model (browsing/planning/preview); checklist replaces timed checkpoints; selected-day work is a primary panel with next-item focus, Today in the day navigator, Plan in the top action row, Overdue as its own opt-in section. *(Residual: settle the precise long-term `/reminders` role — 5.1 below.)*

---

> → The flat, phased, checkable build list for everything above (with IDs): **[4 · Checklist](<4 - Checklist.md>)**.

---

## 🚫 Not now

- ❌ **Stats redesign** — parked; zero current payoff.
- ❌ **Refactor `useItems.ts` (~2,621 LOC) "just because"** — only split when a feature next forces you in.
- ❌ **`weather` prerequisite** — lowest value-for-effort of the four evaluators.
- ❌ **Don't redesign the calendar views** — Month/Week/Today are the parts that *work*; touch only what a phase above names.
- ❌ **Don't open the Schedule↔Budget bridge before the recurrence tests exist** — a silent bridge bug would hide exactly there.

---

## ⏭️ Later / backlog

- Reassignment audit trail + "who had it when" timeline (W8 / 5.4).
- `/reminders` → unified assignments + open-items management view (5.1).
- Recurrence edit UX (this / this-and-future / all).
- Bulk occurrence operations (multi-select complete/postpone/reschedule).
- Smarter overdue handling (roll-forward suggestions, overdue triage view).
- Natural-language item entry — now scoped as **W10** (form, rule-based, mostly done) + **W11** (Hub, Gemini).
- `schedule` and `custom_formula` prerequisite evaluators.
- Smart alert timing + quiet hours + weekly digest. _(global Track B 7a/7b)_
- Debt → Schedule auto-reminder on collection date. _(global Track A 2e)_
- Trips → Schedule cascade visibility.
- NFC-from-text Phase 2 (W12) + confidence/clarification UX (Phase 3).
- **Global `task`-type retirement** (DB + all non-form surfaces + `ItemType` union + every Schedule MD naming "Task").

---

## Not now / Parked ⚪ _(deliberately out of the active queue)_

- ⚪ **Stats redesign** — zero current payoff ([file 1 Cluster 2](<1 - Feature State.md>)).
- ⚪ **`weather` prerequisite** — lowest value-for-effort of the four evaluators.
- ⚪ **Don't redesign Month / Week / Today** — these work; touch only what a phase above names.
- ⛔ **Geofencing / fire-on-arrival location triggers** — won't build; doesn't exist, PWA, decided ([file 3 §E](<2 - Vision & Roadmap.md>)).
- ⛔ **Reuse budget NLP wholesale** / **light up inert evaluators just for NLP coverage** — see [file 3 §E](<2 - Vision & Roadmap.md>).

---

## How to drive this

- Point at a **line** ("do 1.3"), a **group** ("Phase 1 chips: 1.4 + 1.5"), or a **phase** ("start Phase 1").
- **Recurrence correctness Stage 1 ([file 4](<2 - Vision & Roadmap.md>) / Phase 4.1+4.3a) shipped 2026-06-19. The current top priority is `time_window` (4.4), then Stage 2 engine unification (4.3b).**
- I'll only start **Phase 2+** after **Phase 1** ships and is verified; **1b.4** is now partially unblocked by **4.1**.
- As items complete, they get checked here **and** marked in [1 · Feature State](<1 - Feature State.md>) (Hard Rule #25 — no orphan fixes).

---

> **Appendix — Originating brief (verbatim).** The Codex initiative brief that kicked off this overhaul; its proposed type model is reconciled with app reality in [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) (Type Taxonomy & Capture Design section).

# Initiative / Story: Simplify Mobile Schedule Entry and Merge Tasks + Reminders UX

## Context

We currently have separate concepts and/or pages around Tasks, Reminders, Schedule, item entry, triggers, recurrence, and reminder views.

For budgeting, the mobile experience feels clearer:

- There is a clear place to input transactions.
- There is a clear activity/dashboard view to quickly see what happened.
- The interaction is fast and obvious.

For Schedule/Reminders, the mobile experience currently feels confusing:

1. Creating an item still feels too complex.
2. Viewing created items is also not clear enough.
3. There may be too many pages or concepts around Schedule and Reminders.
4. I am currently only focusing on **mobile forms**, not desktop/web views.

I agree with merging Tasks and Reminders in the UI.
I also agree with removing the forced “Type” selection from the user and making the system dynamic.

The main problem is that the mobile form does not yet feel like quick note-taking.

The target experience should feel like:

> “Remind me to call Samir tonight”

or:

> “Remind me when I get home to mop”

The user should be able to type naturally, and the system should intelligently understand the intent, date/time, recurrence, trigger, location, and action without forcing the user to manually configure everything.

---

## Main Goal

Redesign the **mobile Schedule/Reminder item creation flow** so it becomes a fast, smart, confidence-building input experience.

The mobile form should feel like a quick capture note:

- One main natural language input.
- Minimal manual fields.
- No forced Task vs Reminder choice.
- Smart NLP extraction.
- Clear but uncluttered feedback about what the system understood.
- Advanced options available only when needed.

---

## Scope

### In Scope

Focus only on **mobile creation/edit forms** for Schedule/Reminder/Task items.

Analyze and plan improvements for:

- Mobile item entry form.
- Task + Reminder UI merge.
- Removal or hiding of forced “Type” selection.
- NLP parsing improvements.
- NLP confidence/preview feedback.
- Location trigger handling.
- Recurrence handling.
- Trigger simplification.
- Reducing UI clutter.
- Making the form feel fast, natural, and intelligent.

### Out of Scope for Now

Do not focus on:

- Desktop/web views.
- Full dashboard redesign.
- Budgeting module.
- Hook dashboards.
- Large reporting/activity views unless directly needed to support the mobile item creation flow.
- Full implementation before the plan is validated.

---

## Product Direction

### 1. Merge Tasks and Reminders in the Mobile UI

The user should not need to decide whether something is a “task” or a “reminder”.

Instead, the system should infer behavior from the input.

Examples:

- “Buy milk”
  → Simple task / checklist item.

- “Remind me to buy milk tonight”
  → Reminder with due/reminder time.

- “Every Monday remind me to water the plants”
  → Recurring reminder/task.

- “Remind me when I get home to mop”
  → Location/trigger-based reminder.

Internally, the data model may still keep item type, trigger type, reminder details, recurrence, etc., but the mobile UI should not expose unnecessary complexity.

The user-facing concept should be closer to:

> “Item”
> “To-do”
> “Reminder”
> “Schedule item”

Codex should inspect the existing structure and propose the cleanest naming and abstraction.

---

### 2. Remove Forced Type Selection

The current form should not force the user to select Type upfront.

Instead:

- Default to a smart natural-language entry.
- Infer whether the item behaves like a task, reminder, recurring item, scheduled item, or trigger-based reminder.
- Show only the relevant extracted details.
- Allow the user to correct the interpretation without exposing too many fields.

Example:

Input:

> “Remind me to call Samir tonight”

System should infer:

- Action/title: Call Samir
- Reminder time: Tonight
- Item behavior: Reminder/task with scheduled reminder
- Type: inferred internally, not manually selected by user

---

### 3. Make NLP 10x Smarter

The NLP must cover every feature the user can manually configure.

Rule:

> Whatever the user can do manually in the item form, the NLP should eventually be able to understand from typing.

Codex should inspect the current item/reminder/task schema and list all supported capabilities.

Then create an NLP capability matrix.

Example matrix:

| Capability    | Manual Field Exists? | NLP Supports It? | Gap                           | Example              |
| ------------- | -------------------: | ---------------: | ----------------------------- | -------------------- |
| Title/action  |                  Yes |           Yes/No | Improve extraction            | “Call Samir”         |
| Due date      |                  Yes |           Yes/No | Parse date phrases            | “tomorrow”           |
| Reminder time |                  Yes |           Yes/No | Parse time phrases            | “tonight at 8”       |
| Recurrence    |                  Yes |           Yes/No | Parse recurring language      | “every Monday”       |
| Location      |                  Yes |           Yes/No | Parse known places            | “when I get home”    |
| Trigger       |                  Yes |           Yes/No | Infer trigger from language   | “when I arrive home” |
| NFC trigger   |                  Yes |           Yes/No | Map to configured NFC trigger | “tap NFC back home”  |
| Description   |                  Yes |           Yes/No | Decide if needed              | Long-form text       |
| Priority      |                Maybe |           Yes/No | Optional                      | “urgent”             |

The NLP should understand examples like:

- “Remind me to call Samir tonight”
- “Tomorrow morning remind me to send the report”
- “Every Sunday at 7 remind me to take out the trash”
- “Remind me when I get home to mop”
- “When I leave work remind me to buy groceries”
- “Remind me after lunch to check the invoice”
- “Pay Alfa bill every month on the 5th”
- “Doctor appointment next Tuesday at 4”
- “Clean room this weekend”
- “Tap NFC back home to remind me to mop”

---

### 4. Simplify Icon/Field Complexity

The current mobile form exposes too many options/icons:

- Location
- Description
- Trigger
- Recurrence

This creates cognitive load.

Direction:

#### Location

Location is useful and straightforward, but should be shown only when relevant or detected.

Example:

- User types: “when I get home”
- System shows a compact chip: `Home`
- User can tap to adjust.

#### Description

Description currently feels like extra complexity and bad UX for quick entry.

Direction:

- Do not show Description as a primary field in the default mobile form.
- Move it behind an “Add details” / expanded section.
- NLP may store extra text as notes only when clearly needed.
- Do not make description visually compete with the main input.

#### Trigger

Trigger is needed, but should be simplified.

Direction:

- Treat trigger simplification as an action plan for a later phase.
- For now, NLP should detect trigger intent and show a clear compact summary.
- Avoid exposing raw trigger configuration upfront.

Examples:

- “when I get home” → Trigger chip: `When home`
- “when I leave work” → Trigger chip: `Leaving work`
- “tap NFC back home” → Trigger chip: `NFC: Back Home`

#### Recurrence

Recurrence is useful and should remain supported.

Direction:

- Show recurrence only when detected or manually expanded.
- Use compact chips like:
  - `Every Monday`
  - `Monthly on the 5th`
  - `Every day at 8 PM`

---

## Desired Mobile UX

The default mobile form should roughly behave like this:

1. User opens Schedule/Reminder creation.
2. User sees one primary input:
   - Placeholder example: “Remind me to call Samir tonight”

3. User types naturally.
4. NLP immediately or after pause extracts structured meaning.
5. UI shows a compact interpretation preview.
6. User can save immediately.
7. User can tap any extracted chip to correct it.
8. Advanced fields are hidden unless needed.

Example UI behavior:

Input:

> “Remind me when I get home to mop”

Compact interpretation preview:

- Title: `Mop`
- Trigger: `When home`
- Location: `Home`
- Behavior: `Reminder`

But do not clutter the UI with a large debug-style NLP output.

The user should feel:

> “The app understood me.”

Not:

> “The app is dumping parser internals on the screen.”

---

## NLP Feedback / Confidence Interaction

There is currently no clear observation of what the system understood from the compact title.

We need a smart, minimal, confidence-building interaction.

Requirements:

- Do not show 1000 NLP outputs.
- Do not show technical parser JSON.
- Do not clutter the form.
- Show a human-readable summary of what will be saved.
- Use small editable chips or compact rows.

Good examples:

Input:

> “Remind me to call Samir tonight”

Preview:

`Call Samir` · `Tonight` · `Reminder`

Input:

> “Every Sunday remind me to clean the balcony”

Preview:

`Clean the balcony` · `Every Sunday` · `Reminder`

Input:

> “Remind me when I get home to mop”

Preview:

`Mop` · `When home` · `Home`

If NLP confidence is low, ask one lightweight clarification.

Example:

Input:

> “Call Samir later”

Preview:

`Call Samir` · `Later`

Clarification:

> “What does later mean?”
> Options: `Tonight`, `Tomorrow`, `Pick time`

Do not block simple saving unless required.

---

## Codex Plan Mode Instructions

Before coding, inspect the current codebase and produce a clear implementation plan.

Please analyze:

1. Current mobile routes/pages related to:
   - Schedule
   - Tasks
   - Reminders
   - Item creation
   - Item editing
   - Trigger setup
   - Recurrence setup

2. Current database/schema/model related to:
   - items
   - reminder details
   - event details
   - recurrence rules
   - alerts/triggers
   - location/NFC trigger data if available

3. Current NLP implementation:
   - Where parsing happens
   - What fields it extracts
   - What it misses
   - Whether parsing is local, server-side, rule-based, AI-based, or mixed

4. Current UI friction:
   - Forced type selection
   - Too many icons
   - Too many fields
   - Unclear save behavior
   - Unclear interpretation feedback

5. Data model risks:
   - Whether Tasks and Reminders can be merged safely at UI level without breaking backend logic
   - Whether Type is required by database constraints
   - Whether Type can be inferred and stored silently
   - Whether existing records remain compatible

---

## Expected Output From Codex Plan Mode

Do not jump directly into implementation.

First produce a plan with:

### A. Current-State Findings

List:

- Relevant files/components/routes.
- Current item creation flow.
- Current reminder/task split.
- Current NLP behavior.
- Current database constraints.
- Any risks or blockers.

### B. Proposed UX Architecture

Define the new mobile form structure:

- Primary natural-language input.
- Compact NLP preview.
- Editable chips.
- Hidden advanced section.
- Save behavior.
- Edit behavior.

### C. Proposed Data/Logic Architecture

Define:

- How Task/Reminder is merged at UI level.
- How internal type should be inferred.
- How NLP output maps to existing schema.
- How missing/ambiguous values are handled.
- How existing manual fields remain accessible.

### D. NLP Capability Matrix

Create a table of every supported feature and whether NLP currently supports it.

Include:

- title/action
- date
- time
- reminder time
- due date
- recurrence
- location
- trigger
- NFC
- description/notes
- priority/status if applicable
- responsible user if applicable
- household/shared assignment if applicable

### E. Phased Implementation Plan

Break implementation into safe phases:

#### Phase 1: UI Simplification Foundation

Goal:

- Remove forced type selection from mobile form.
- Create one quick-capture input-first form.
- Hide advanced fields.
- Preserve existing backend behavior.

Test scenario:

- User can create a simple item like “Buy milk”.
- No type selection is required.
- Item saves correctly.
- Existing web views are not broken.

#### Phase 2: NLP Preview Layer

Goal:

- Add compact interpretation preview.
- Show extracted title/date/time/type/recurrence/trigger as chips.
- Let user edit extracted values.

Test scenario:

- Input “Remind me to call Samir tonight”.
- UI previews `Call Samir` and `Tonight`.
- User can save without opening advanced options.

#### Phase 3: NLP Capability Expansion

Goal:

- Improve parser to cover all existing manual capabilities.
- Add missing extraction for recurrence, location, trigger, and NFC where supported.

Test scenario:

- Input “Every Monday at 8 remind me to water the plants”.
- System saves recurrence correctly.
- Preview is clear and compact.

#### Phase 4: Location and Trigger Intelligence

Goal:

- Parse “when I get home”, “when I leave work”, and configured trigger names.
- Map known places like Home/Work to stored location or trigger records.
- Do not overexpose raw trigger configuration.

Test scenario:

- Input “Remind me when I get home to mop”.
- System detects title `Mop`.
- System detects location/trigger `Home`.
- System saves a valid trigger-based reminder.

#### Phase 5: Confidence and Clarification UX

Goal:

- Add lightweight clarification for ambiguous phrases.
- Avoid clutter.
- Avoid technical NLP output.

Test scenario:

- Input “Call Samir later”.
- System asks a small clarification for “later”.
- User can choose `Tonight`, `Tomorrow`, or `Pick time`.

#### Phase 6: Cleanup and Regression

Goal:

- Remove duplicate/confusing mobile pages if safe.
- Keep or redirect old routes where needed.
- Ensure existing reminders/tasks still display and edit correctly.

Test scenario:

- Existing reminders still open.
- Existing tasks still open.
- New unified item form handles both.
- No broken navigation.

---

## Acceptance Criteria

The story is successful when:

1. Mobile item creation feels like quick note-taking.
2. User is not forced to select Task vs Reminder.
3. The form starts with one primary natural-language input.
4. Manual complexity is hidden by default.
5. NLP extracts every feature the form supports, or there is a documented gap.
6. The user sees a compact, human-readable summary of what the system understood.
7. The user can correct extracted values easily.
8. Location, trigger, and recurrence are not noisy icons by default.
9. Description is moved out of the primary flow.
10. Existing data remains backward-compatible.
11. Web/desktop views are not changed unless absolutely necessary.
12. Existing tasks/reminders continue to work.
13. The implementation is phased and testable.

---

## UX Principle

The mobile form should not feel like filling a database record.

It should feel like telling a smart assistant:

> “Remind me to do this, at this time, under this condition.”

The app should do the structuring in the background.

The user should only intervene when the system is unsure.

---

## Important Constraint

Do not remove backend fields or database concepts just because the UI is simplified.

This is primarily a mobile UX and interaction simplification initiative.

Keep internal structure stable unless a schema change is clearly justified and safely migrated.

---

## Final Deliverable Expected From Codex

Produce a detailed plan first.

The plan should include:

- Files to inspect.
- Files likely to change.
- UX changes.
- Logic changes.
- NLP changes.
- Risks.
- Migration concerns.
- Testing scenarios per phase.
- Recommended first implementation phase.

Do not implement until the plan is clear.
