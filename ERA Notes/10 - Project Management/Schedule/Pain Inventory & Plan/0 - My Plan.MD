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
