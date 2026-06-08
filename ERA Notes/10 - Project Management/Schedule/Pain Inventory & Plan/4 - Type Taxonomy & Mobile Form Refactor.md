---
created: 2026-05-30
status: living
owner: Elio
type: roadmap
tags:
  - pm/roadmap
  - scope/module
  - module/schedule
---

# Schedule · 4 — Type Taxonomy & Mobile Form Refactor

> **Command Center:** [_index](<_index.md>) · [1 · Pain Inventory](<1 - Pain Inventory (Every Painful Thing).md>) · [2 · Target Design](<2 - Target Design & Decisions.md>) · [3 · Execution Plan](<3 - Execution Plan (Staged).md>) · [4 · Type Taxonomy & Form](<4 - Type Taxonomy & Mobile Form Refactor.md>) · [5 · My Plan Reconciliation](<5 - My Plan Reconciliation & Harmonized Scope.md>) · [6 · Master Checklist](<6 - Master Build Checklist.md>)
>
> **What this file is:** the answer to "what *are* Task / Reminder / Event / Chore, and does the split make sense?" — then a concrete refactor of the [Mobile Item Form](<../../../../src/components/items/MobileItemForm.tsx>) (`/expense`) built on that answer. This is **upstream of the capture-friction pain** ([file 1, Cluster 3](<1 - Pain Inventory (Every Painful Thing).md>)): the form can't be simple until the types are crisp.

---

## 1. What the code actually models *(ground truth, 2026-05-30)*

Before judging the mental model, here's what exists — because the schema already made some of these calls for us.

- **Three types, not four:** `ItemType = "reminder" | "event" | "task"`. → [src/types/items.ts:10](<../../../../src/types/items.ts#L10>)
- **Chore is a flag, not a type:** `is_chore?: boolean`, *denormalized from the catalogue template* and used to **exclude the item from schedule-overdue logic**. → [src/types/items.ts:60](<../../../../src/types/items.ts#L60>), [:286](<../../../../src/types/items.ts#L286>)
- **"At home" already exists as a flag too:** `location_context: "home" | "outside" | "anywhere"` applies to *all* types. → [src/types/items.ts:52-53](<../../../../src/types/items.ts#L52-L53>)
- **Crucial detail — Task and Reminder share ONE detail table.** Events have their own `event_details` (`start_at` / `end_at` / `all_day`). But **both** reminders *and* tasks hang off `reminder_details` (`due_at` / `completed_at` / `estimate_minutes`). The code already treats Task and Reminder as near-twins at the data layer. → `ReminderDetails` / `EventDetails` in [src/types/items.ts](<../../../../src/types/items.ts>); see [Schedule Feature](<../../../02 - Standalone Modules/Items & Reminders/Schedule Feature.md>) for the three placement strategies.

---

## 2. Does your mental model make sense?

Your definitions:

| Your type | Your definition | Verdict |
|---|---|---|
| **Chore** | "at home" | ✅ **Right instinct, already modelled** — but as `is_chore` + `location_context: "home"`, *not* a type. Keep it a flag. Chores are also genuinely simpler (complete / postpone / overdue only — you already split this logic out). |
| **Event** | "start and end date" | ✅ **Exactly the schema** (`event_details.start_at` / `end_at`). The one type with a true, distinct shape. |
| **Task** | "start date + an alert" | 🟡 **Real but thin.** |
| **Reminder** | "an alert at time" | 🟡 **Real but thin.** |

**The honest answer: it mostly makes sense, but it's slightly too complex — and the complexity is concentrated in exactly one place: Task vs. Reminder.**

- **Event is clearly distinct** — it occupies a span of time. Keep it.
- **Chore is correctly not a type** — it's "a reminder/task that lives at home and only needs complete/postpone." Your "Chore = home" maps to flags that already exist.
- **Task and Reminder are near-twins.** Both are "a thing due at a time, with a nudge." Your distinction ("Task has a *start* date, Reminder fires *at* time") is real, but it's a difference of *emphasis*, not of *kind* — and the schema proves it by storing both in the **same** `reminder_details` table. **This single fuzzy line is what forces the form to ask one extra up-front question and makes capture feel heavy.**

> **The diagnosis:** the taxonomy isn't *wrong*, it's *front-loaded*. You're asked to commit to a type before you've even said what the thing is. That's the friction — not the number of types.

---

## 3. Two ways to resolve the Task/Reminder fuzziness

This is a **decision to make**, not a done call. Both are documented; pick one in [file 3](<3 - Execution Plan (Staged).md>).

### Option A — Keep all three types, but **infer** the type from what you enter *(recommended)*

Don't ask "is this a Task or a Reminder?" up front. Ask **"what is it?"** then **"when?"**, and let the answer decide:

- You give it a **time + alert** → it's a **Reminder**.
- You give it a **start + a duration/estimate or subtasks** → it's a **Task**.
- You give it a **start AND end** → it's an **Event**.
- You toggle **"at home"** → `location_context: home` (+ `is_chore` if from a chore template).

The three types survive in the data (nothing to migrate), but the *user* never picks one — the form derives it. This directly attacks the capture pain without touching the schema.

### Option B — Collapse Task into Reminder (two visible types: **Reminder** + **Event**)

Since they already share `reminder_details`, merge them in the UI: everything time-due-with-a-nudge is a **Reminder**; "task-ness" becomes a sub-property (has subtasks / has an estimate). Only **Event** stays separate (it has a real distinct shape). Chore stays a flag.

- **Pro:** simplest possible mental model — "Reminder or Event," plus flags.
- **Con:** loses the word "Task" you like; a small data cleanup (re-label existing `task` rows or keep `type=task` internally while hiding it). Bigger change.

> **Lean:** **Option A.** It gets ~90% of the simplicity of B with ~10% of the risk (no migration, types stay), and it keeps the vocabulary you think in. B is the fallback if A's inference still feels like too many questions.

---

> **⚠️ Target correction (2026-06-06):** this section was written against [`MobileItemForm.tsx`](<../../../../src/components/items/MobileItemForm.tsx>), but that file is **dead code** (zero importers). The **live** mobile capture form is [`MobileReminderForm.tsx`](<../../../../src/components/reminder/MobileReminderForm.tsx>) (mounted in `TabContainer`), which was **already** single-page with smart NL input ([`smartTextParser.ts`](<../../../../src/lib/smartTextParser.ts>)), inferred type, progressive disclosure, and voice — so most of this refactor already existed there. The genuine gaps (title-only save, quick date chips, At-Home/location_context/maps-link) shipped on the live form 2026-06-06. See [file 6 Phase 1a](<6 - Master Build Checklist.md>).

## 4. How I'd refactor the Mobile Item Form (`/expense`)

**File:** [src/components/items/MobileItemForm.tsx](<../../../../src/components/items/MobileItemForm.tsx>). Today it branches on `createMode` (reminder/event/task chosen *first*) and walks **5 steps**: `title → datetime → details → priority → confirm` ([FormStep, line 172](<../../../../src/components/items/MobileItemForm.tsx#L172>)). That's the heaviness.

### Principle: **capture first, classify last.** One screen to log; everything else optional and deferred.

### Target flow (built on Option A)

```
┌─ ONE SCREEN ───────────────────────────────┐
│  "What do you need?"        [text input]    │  ← the only required field
│                                             │
│  When?   [Today ▸] [Tomorrow] [Pick…] [—]   │  ← chips; "—" = no date (someday)
│  ⏰ Alert  [off ▸]                           │  ← off by default; one tap to set
│  🏠 At home  ( )                            │  ← toggle → location_context: home
│                                             │
│            [ Save ]   ⌄ More                │  ← Save works with title alone
└─────────────────────────────────────────────┘
        ⌄ More  → expands: end-time (→ Event),
                  recurrence, subtasks (→ Task),
                  responsible user, category,
                  priority, prerequisites
```

**Type is inferred at Save, never asked:**

| What you entered | Inferred type | Detail row |
|---|---|---|
| title + (optional date) + optional alert | `reminder` | `reminder_details.due_at` |
| title + start + **end** | `event` | `event_details.start_at/end_at` |
| title + start + **estimate or subtasks** | `task` | `reminder_details` (+ subtasks) |
| any of the above + **🏠 at home** | same type, `location_context: home` (+ `is_chore` if chore template) | — |

### Concrete changes

1. **Kill the up-front type picker.** Remove "choose reminder/event/task first." Keep `createMode` internally only as the *inferred* result, or as an optional pre-seed when launched from a specific FAB.
2. **Collapse 5 steps → 1 default screen + a "More" disclosure.** Fold `datetime`, `details`, `priority` into one progressively-disclosed surface. The `confirm` step goes away — Save is immediate (Undo toast per Hard Rule #1 covers mistakes).
3. **Make only the title required.** Date, alert, everything else optional. A title-only save creates a dateless reminder ("someday") — capturing *something* beats capturing nothing.
4. **Smart date chips** (`Today / Tomorrow / Pick… / No date`) instead of a date/time stepper as the primary input. Stepper lives under the date chip when needed.
5. **Alert off by default,** one tap to add — instead of an alert sub-flow every time. (Addresses the "events are easier than reminders/tasks" asymmetry in [file 1, Cluster 3](<1 - Pain Inventory (Every Painful Thing).md>): the alert decision is what makes reminders/tasks feel heavier.)
6. **"At home" as a single toggle** → `location_context: "home"`. No separate location step for the common case.
7. **Everything advanced (recurrence, subtasks, responsible user, prerequisites, priority) lives under "More"** — present for the precision case, invisible for the 80% quick case. This is the form earning its "precision tool" role (per CLAUDE.md: forms are precision; the Hub is quick capture).

### What this is NOT

- Not a schema change (Option A). Reuses `reminder_details` / `event_details`, `is_chore`, `location_context` as-is.
- Not removing capability — every advanced field still reachable under "More."
- Not the Hub-capture decision — that's the *other* fast lane ([file 2, open question](<2 - Target Design & Decisions.md>)). This refactor makes the **form** the strong precision tool; Hub remains the quick lane. They're complementary.

---

## 5. Recommendation in one line

**Keep three types in the data, stop asking the user to pick one** (infer it), **make Chore/home flags not types**, and **rebuild the form as one capture screen + a "More" disclosure** — title-only save, type inferred at save. That removes the capture friction without a migration.

→ Sequenced as candidate **W6 (capture path)** and a new form-refactor work item in [3 · Execution Plan](<3 - Execution Plan (Staged).md>). The Task-vs-Reminder resolution (Option A vs. B) is the decision to lock there.
