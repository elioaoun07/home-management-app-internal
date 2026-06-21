---
created: 2026-05-30
updated: 2026-06-20
type: roadmap
status: living
owner: Elio
tags:
  - pm/roadmap
  - scope/module
  - module/schedule
---

# Schedule · 2 — Vision & Roadmap

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the full design-of-record for Schedule — **(A)** the ambitious vision + roadmap, **(B)** the target design & decisions, plus the folded-in **Type Taxonomy & Capture Design** and **Recurrence & Occurrence Actions** deep-designs (formerly separate files 3 & 4, consolidated here 2026-06-20). [1 · Feature State](<1 - Feature State.md>) is the sober reality; [3 · Action Plan](<3 - Action Plan.md>) + [4 · Checklist](<4 - Checklist.md>) hold the sequencing.
>
> **Decision legend:** ✅ **Committed** · ❓ **Open** (choose in [3 · Action Plan](<3 - Action Plan.md>)) · 💭 **Direction**.

---

# Part A — Future Vision & Roadmap

## The strategic thesis

Schedule is the household's **time graph** — every dated obligation (reminders, events, recurring chores, flexible routines, payment due-dates) lives here. Today it is a strong *reactive* surface: you put things in, it shows them back on a calendar. Its untapped value is twofold:

1. **It is the spine ERA should read from.** The proactive assistant's briefings are only as smart as the time graph behind them. Enriching Schedule directly upgrades ERA.
2. **It already touches money, chores, and trips** — but mostly one-directionally. The biggest wins are tightening those connections so a due-date in Schedule and a payment in Budget are the *same fact*.

**The vision in one line:** *Turn Schedule from a calendar you read into a time graph that acts — surfacing the right item, at the right time, with the right context, before you go looking.*

---

## Track A — Internal enhancements (within the module)

| Enhancement | Today | The dream | Effort |
|---|---|---|---|
| **Finish Prerequisites evaluators** | NFC→item works; `time_window` / `schedule` / `custom_formula` / `weather` are stubs | `time_window` ("show meds 7–9am"), `schedule` ("after gym → log meal"), `custom_formula` — *conditional automation*, rare and powerful | M (per evaluator; `time_window` is S) |
| **Recurrence editor UX** | RRULE built via `CustomRecurrencePicker`; edits of a single occurrence vs the series are subtle | Clear "this / this-and-future / all" choice on every edit & delete, matching calendar-app expectations | M |
| **Bulk occurrence operations** | One-at-a-time complete/postpone/skip | Multi-select across the list/calendar → bulk complete / postpone / reschedule | M |
| **Smarter overdue handling** | Flexible overdue look-back ≤3 periods; fixed items just sit overdue | Roll-forward suggestions ("you missed Tue's workout — slot it Thu?"), and a single overdue triage view | M |
| **Natural-language item entry** | Quick form has smart text parsing | Full NL: "every other Thursday at 7", "remind me 2 days before rent" — parsed into rrule + alert in one line | M |
| **Test the placement rule** | Enforced by convention across 6+ views | One guard test so flexible items can never silently land on the activation day | S |
| **Plan My Day (disrupted-day planner)** | *(IMPLEMENTED 2026-06-16)* `/today` triage page — one-time/recurring/flexible items landing on a day, push off, both-direction prepone for flexible items, ad-hoc tasks, checkpoints, persisted via `day_plans`. *(FIXED 2026-06-16 same day)* save-gated draft model (edit form + Save vs. read-only preview card + Edit/Delete) replaced the original auto-save-per-keystroke header. | Hourly timeline canvas (drag items into time slots) + mood/energy "rest vs productivity" optimizer reading `day_plans.intent` | M (timeline) / M–H (optimizer) |

---

## Track B — Bridges out of Schedule (cross-module)

These connect Schedule to the rest of the household graph. Each ladders up to a track in the global [3 · Future Vision](<../3 - Future Vision & Roadmap.md>).

- **Schedule → Focus / ERA briefing enrichment.** The Focus briefing pulls Schedule items but could pull *the whole week's shape* — recurring due, overdue routines, household-assigned items by person. *(global Track B · briefing enrichment)*
- **Schedule ↔ Budget (due-dated payments).** A recurring payment's due-date and a Schedule reminder are often the same intent — unify them so confirming a payment closes the reminder and vice versa. *(global Track A · Recurring→Budget; Track C · Cashflow Forecast)*
- **Schedule ↔ Notifications (smart timing).** Alerts fire at fixed offsets today. Smart timing + quiet hours (no 2am pings) + a weekly digest instead of daily noise. *(global Track B · weekly digest 7a/7b)*
- **Trips → Schedule cascade.** Trip activation/completion already fires schedule side-effects; make the cascade legible and verifiable from the Schedule side (which items a trip created/closed). *(global Trips row)*
- **Debt → Schedule.** Auto-create a reminder on a debt's collection date. *(global Track A · Debt→Reminder 2e)*

---

## Prioritization matrix

```
  IMPACT
   ▲
H  │  Briefing enrichment (B)        Schedule↔Budget unify (B)
   │  time_window prereq (A)         Natural-language entry (A)
   │  Placement-rule test (A)        Cashflow tie-in (B/global C1)
   ├──────────────────────────────────────────────────────────
M  │  Smart alert timing (B)         Recurrence edit UX (A)
   │  Debt→Schedule (B)              Bulk occurrence ops (A)
   │  Smarter overdue (A)            schedule/custom_formula prereq (A)
   ├──────────────────────────────────────────────────────────
L  │  (—)                            weather prereq (A)
   │                                 Trips cascade visibility (B)
   └──────────────────────────────────────────────────────────►
        LOW EFFORT             MED EFFORT             HIGH EFFORT
```

---

## 🎯 The bets (my recommendation)

If you point the next stretch at Schedule:

1. **Bet 1 — Lock the foundation: placement-rule test + recurrence/occurrence unit tests.** Low effort, kills the highest-risk gaps from [1 · Feature State](<1 - Feature State.md>). Do this before any enhancement that touches views. *(The recurrence half is now concrete and urgent — see [file 4](<2 - Vision & Roadmap.md>).)*
2. **Bet 2 — Ship `time_window` prerequisite.** Smallest of the four stubs, highest demo value (meds/morning windows), and it proves out the conditional-automation engine.
3. **Bet 3 — Schedule → briefing enrichment.** The biggest *felt* upgrade: it makes ERA visibly smarter by reading the full time graph. Ladders straight into the global moat (Track B).

> Resist starting bridges before the foundation tests exist — the recurrence math is exactly where a silent bridge bug would hide.

---

# Part B — Target Design & Decisions

> Where each pain is *heading* — the target end-state, plus the calls already made. **Decisions live here; sequencing lives in [3 · Action Plan](<3 - Action Plan.md>).**

## ✅ Decision 1 — Focus becomes a per-item *mode*, not a page *(IMPLEMENTED 2026-06-06)*

**Call:** Retire the standalone `/focus` page. "Focus" becomes an **action you invoke on any item** that drops you into a focused view of *that* item. Flexible-routine assignment — the only real job the page did — **consolidates into the Week view**, where it already half-lives.

**Why:** The page is dull, redundant, and unused, and it duplicates the Week view's assignment flow ([file 1, Cluster 2](<1 - Feature State.md>)). A per-item mode matches how I actually think ("focus on *this*"), not "go to the focus place."

**Target shape (built):**

- Add a **Focus** action on the item surfaces — [ItemDetailModal.tsx](<../../../src/components/items/ItemDetailModal.tsx>) and [ItemActionsSheet.tsx](<../../../src/components/items/ItemActionsSheet.tsx>) — that enters a focus view for the selected item.
- Move flexible-routine assignment fully into [WebWeekView.tsx](<../../../src/components/web/WebWeekView.tsx>) (it already hosts the droppable day slots and the catalogue add-dialog).
- Retire [src/app/focus/page.tsx](<../../../src/app/focus/page.tsx>) and [FocusPage.tsx](<../../../src/components/focus/FocusPage.tsx>) (+ `ScheduleRoutineSheet` / `FlexibleRoutinesPool`).

**Cleanup obligations honored when this shipped (project Hard Rules):**

- **Atlas** (Hard Rule #23): remove/replace the Focus page entry in `ERA Notes/04 - UI & Design/Page & Feature Atlas/`; the `public/atlas/atlas.json` regen hook handles the JSON.
- **Feature Index**: update the **Focus** row in [CLAUDE.md](<../../../CLAUDE.md>) (auto-syncs to `AGENTS.md` / `CODEX.md` / copilot instructions); `pnpm docs:check` validates it against the Feature Map.
- **Routes/icons**: update `ERA Notes/04 - UI & Design/App Routes and Icons.md`.
- Note: `useFocusInsights` (the AI briefing) is **separate** from the Focus *page* — keep it; it feeds Today/ERA, not the retired page.

---

## ✅ Decision 2 — Household co-ownership model: shared = co-editable, reassign both ways *(IMPLEMENTED 2026-06-06)*

**Call:** For an item shared across the household, **any active partner can edit and act on it**, and **responsibility (`responsible_user_id`) is reassignable in both directions with a one-tap "take it back."**

**Why:** [File 1, Cluster 1](<1 - Feature State.md>) — the old creator-only edit lock contradicted the action routes (which already allow partner complete/postpone), so the same item had two different permission rules. Unified on the more permissive, household-aware one.

**Target rules (built):**

| Capability | Before | Now |
|---|---|---|
| Complete / postpone / cancel | Creator OR responsible OR active link ✅ | unchanged ✅ |
| **Edit (PATCH)** | ~~Creator only~~ → `canMutateItem()` ✅ | Creator OR responsible OR active link ✅ |
| **Delete** | ~~Creator only~~ → `canMutateItem()` ✅ | Creator OR responsible OR active link ✅ |
| **Reassign to partner** | ~~Via edit form only~~ → one-tap in `ItemActionsSheet` ✅ | One-tap "pass to partner" ✅ |
| **Reclaim ("take it back")** | ~~Not possible~~ → one-tap in `ItemActionsSheet` ✅ | One-tap "take it back" / "make it mine" ✅ |
| **See assigned-out / assigned-to-me** | ~~Implicit~~ → explicit buckets in `/reminders` ✅ | Explicit buckets ✅ |

**Pattern reused (don't reinvent):**

- **Auth shape:** the household-link resolution already in [complete/route.ts:84-104](<../../../src/app/api/items/[id]/complete/route.ts#L84-L104>) is copied into the PATCH/DELETE guard in [src/app/api/items/[id]/route.ts:36](<../../../src/app/api/items/[id]/route.ts#L36>). Same `household_links` `.or(...)` check the [accounts route](<../../../src/app/api/accounts/route.ts>) uses (Hard Rule #13).
- **Reassignment:** the Trips RPCs already flip `responsible_user_id` both ways (`activate_trip` → partner, `complete_trip` → back) in `migrations/schema.sql`. Mirrored for manual pass/reclaim. The picker UI already exists: [ResponsibleUserPicker.tsx](<../../../src/components/items/ResponsibleUserPicker.tsx>).
- **Buckets:** the mine/partner filter on `responsible_user_id` in [StandaloneRemindersPage.tsx](<../../../src/components/reminder/StandaloneRemindersPage.tsx>) was the seam for "assigned out (creator = me, responsible = partner)" and "assigned to me (responsible = me, creator = partner)".

> **Read-path caveat:** *(RESOLVED 2026-06-06)* `get_schedule_bundle` returns `user_id = me OR (partner's AND is_public = true)`. The "Pass to partner" action sets `is_public = true`, so assigned items are always visible to both parties. RPC body captured in `migrations/schema.sql`. Known edge case (parked): a private item assigned to me while `is_public = false` won't surface — assignment picker prevents this state today.

---

## ✅ Decision 3 — Capture the schema drift back into the repo *(IMPLEMENTED 2026-06-06)*

**Call:** Re-export the live Supabase schema — including `get_schedule_bundle`, any other Schedule RPCs, and whatever RLS actually exists — back into `migrations/schema.sql` so the repo stops lying about the read path.

**Why:** `schema.sql` is declared the single source of truth (CLAUDE.md, Database section), but the module's authoritative read RPC and the dated migrations CLAUDE.md cites weren't in it. Every read-side change was half-blind until this was fixed. Low effort, unblocked Decision 2's verification. **Done:** table DDL, `get_schedule_bundle` RPC body, and all RLS policies for items + child tables appended to `migrations/schema.sql`.

---

## ✅ Decision 4 — Occurrence-action writes must be idempotent (insert → upsert) *(IMPLEMENTED 2026-06-21)*

**Call:** All four `item_occurrence_actions` inserts (complete/postpone/cancel/skip, across both [complete/route.ts](<../../../src/app/api/items/[id]/complete/route.ts>) and [actions/route.ts](<../../../src/app/api/items/[id]/actions/route.ts>)) now `.upsert(..., { onConflict: "item_id,occurrence_date,action_type" })` instead of `.insert(...)`.

**Why:** a real production 500 (`duplicate key value violates unique constraint "item_occurrence_actions_item_id_occurrence_date_action_type_key"`) traced to a double-submit/retry of an already-completed recurring occurrence. The unique constraint itself is correct, but a plain `insert` makes any repeat throw — and the offline sync engine ([offlineSyncEngine.ts:255-287](<../../../src/lib/offlineSyncEngine.ts#L255-L287>)) treats a 500 as transient and **retries indefinitely**, eventually surfacing "max retries exceeded" for an action that had already succeeded. Upserting on the same key makes a repeat a no-op success instead of a permanent failure loop. Same root cause as the corrected display bug below — `responsible_user_id` is always a single real person, and per-occurrence action state should always converge to one row per `(item, occurrence, action_type)`, not error on the second write.

**Also fixed in the same pass:** the "Responsible: All Household" badge ([ItemDetailModal.tsx](<../../../src/components/items/ItemDetailModal.tsx>), [ItemsListView.tsx](<../../../src/components/activity/ItemsListView.tsx>)) was replacing the actual `responsible_user_id` badge whenever `notify_all_household` was true — implying shared/no-owner responsibility when the schema always has exactly one responsible person. Now always shows the real `ResponsibleUserBadge`, with "Notifying household" as a supplementary badge instead of a replacement. `ResponsibleUserPicker`'s own "All Household" trigger label is unchanged — that's an editing-mode toggle, not a misleading read-only display.

---

## 💭 Direction — Surface consolidation (proposed end-state)

Not a hard commit yet (sequenced in [3 · Action Plan](<3 - Action Plan.md>)), but the target each surface should converge toward — **one clear job each**:

| Surface | Target single job |
|---|---|
| **Calendar — Month** | See the shape of the month; tap a day to drill in / add. *(keep)* |
| **Calendar — Week** | The action surface: assign flexible items + Chores to days. **Absorbs Focus.** *(keep + grow)* |
| **Today** | "What's on me today" + overdue + briefing. *(keep)* |
| **Mobile Form** | **Precision** create/edit only — full field control. *(keep, but no longer the quick-capture path — see open question)* |
| **`/reminders` standalone** | ❓ Either becomes the **"assignments + everything still open"** management view (gains the assigned-out/to-me buckets) — giving it a reason to exist — or is folded into Today. *(Largely resolved 2026-06-17: merged with Plan My Day into `WebDayPlanner`; the precise residual role is [file 5 W9/5.1](<3 - Action Plan.md>).)* |
| **Focus page** | ❌ Retired (Decision 1). |
| **Stats** | ⚪ Parked — untouched this campaign. |

**2026-06-19 decision:** `/reminders` keeps a focused mobile job instead of being folded away: `Focus` = selected-day planning/open work, `Assign` = mobile assignment for flexible task catalogue templates that still need a slot in the selected period. Schedule Insights moves to `/dashboard`, where it fits the app-wide review/metrics habit.

---

## ❓→✅ Open question (now decided) — the low-friction capture path

The habit-killer ([file 1, Cluster 3](<1 - Feature State.md>)). Two directions were documented; **the 2026-06-06 decision was *both lanes*** (see [file 3 §0](<2 - Vision & Roadmap.md>)). The original trade-off table is kept for the record:

| | **A — Hub Chat quick-capture** | **B — Strip the Mobile Form** |
|---|---|---|
| **Idea** | Route everyday "remind me / add task" through Hub Chat; reserve the Mobile Form for precision. | Keep the form as the capture path but make it lightning-fast (fewer required fields, smart defaults, instant save). |
| **Fits CLAUDE.md?** | **Strongly** — CLAUDE.md says the Hub is the top-layer primary interface and forms are precision tools. This is the documented intent. | Neutral — keeps a known surface. |
| **Pro** | No new surface to learn; conversational = lowest friction; AI can parse one line into a full item. | Familiar; full structure available when wanted; no NLP parsing risk. |
| **Con** | Leans on Hub message-action parsing being reliable; Hub is a Junction (cross-module care). | Form will always be heavier than a chat line; risk of stripping a field someone needs. |
| **Effort** | M (wire item-create into Hub message actions) | S–M (UI rework) |

> **Decision (2026-06-06): both** — B (the form) as the precision tool with a quick-capture NL box on it (rule-based parser), **and** A (Hub Chat) as the conversational fast lane (Gemini). Detail + engine split in [file 3](<2 - Vision & Roadmap.md>).

---

→ The crisp type model + form blueprint these decisions rest on → [3 · Type Taxonomy & Capture Design](<2 - Vision & Roadmap.md>).
→ Turn these into ranked, checkbox steps and pick this week's slice → [5 · Execution Plan & Build Checklist](<3 - Action Plan.md>).


---

# Type Taxonomy & Capture Design

*(Folded in 2026-06-20 from the former file 3 — the crisp Task/Reminder/Event model + the mobile-form capture blueprint. The originating brief is the My Plan appendix in [3 · Action Plan](<3 - Action Plan.md>).)*

> **What this file is:** the design substrate under the capture-friction pain ([file 1, Cluster 3](<1 - Feature State.md>)). Two parts: **(Part 1)** the answer to "what *are* Task / Reminder / Event / Chore, and does the split make sense?" plus the concrete mobile-form refactor built on that answer; and **(Part 2)** the reconciliation of the **externally-authored** brief `3 - Action Plan.md` against this app's reality — resolving every ask into ✅ harmony / 🔧 reshaped / ⏳ deferred / ⛔ won't-act, then folding the survivors into the build queue. The form can't be simple until the types are crisp, and the NL/capture work can't start until the brief is reconciled — so both live here.
>
> **Method & confidence:** technical claims traced to real files from codebase reads on **2026-05-30** (Part 1) and **2026-06-06** (Part 2). Where the brief asserts a capability, it was checked against code before agreeing.

---

# Part 1 — Type Taxonomy & Mobile Form Refactor

## 1. What the code actually models *(ground truth, 2026-05-30)*

Before judging the mental model, here's what exists — because the schema already made some of these calls for us.

- **Three types, not four:** `ItemType = "reminder" | "event" | "task"`. → [src/types/items.ts:10](<../../../src/types/items.ts#L10>)
- **Chore is a flag, not a type:** `is_chore?: boolean`, *denormalized from the catalogue template* and used to **exclude the item from schedule-overdue logic**. → [src/types/items.ts:60](<../../../src/types/items.ts#L60>), [:286](<../../../src/types/items.ts#L286>)
- **"At home" already exists as a flag too:** `location_context: "home" | "outside" | "anywhere"` applies to *all* types. → [src/types/items.ts:52-53](<../../../src/types/items.ts#L52-L53>)
- **Crucial detail — Task and Reminder share ONE detail table.** Events have their own `event_details` (`start_at` / `end_at` / `all_day`). But **both** reminders *and* tasks hang off `reminder_details` (`due_at` / `completed_at` / `estimate_minutes`). The code already treats Task and Reminder as near-twins at the data layer. → `ReminderDetails` / `EventDetails` in [src/types/items.ts](<../../../src/types/items.ts>); see [Schedule Feature](<../../02 - Standalone Modules/Items & Reminders/Schedule Feature.md>) for the three placement strategies.

---

## 2. Does the mental model make sense?

The definitions:

| Type | Definition | Verdict |
|---|---|---|
| **Chore** | "at home" | ✅ **Right instinct, already modelled** — but as `is_chore` + `location_context: "home"`, *not* a type. Keep it a flag. Chores are also genuinely simpler (complete / postpone / overdue only — already split out). |
| **Event** | "start and end date" | ✅ **Exactly the schema** (`event_details.start_at` / `end_at`). The one type with a true, distinct shape. |
| **Task** | "start date + an alert" | 🟡 **Real but thin.** |
| **Reminder** | "an alert at time" | 🟡 **Real but thin.** |

**The honest answer: it mostly makes sense, but it's slightly too complex — and the complexity is concentrated in exactly one place: Task vs. Reminder.**

- **Event is clearly distinct** — it occupies a span of time. Keep it.
- **Chore is correctly not a type** — it's "a reminder/task that lives at home and only needs complete/postpone." "Chore = home" maps to flags that already exist.
- **Task and Reminder are near-twins.** Both are "a thing due at a time, with a nudge." The distinction ("Task has a *start* date, Reminder fires *at* time") is real, but it's a difference of *emphasis*, not of *kind* — and the schema proves it by storing both in the **same** `reminder_details` table. **This single fuzzy line is what forces the form to ask one extra up-front question and makes capture feel heavy.**

> **The diagnosis:** the taxonomy isn't *wrong*, it's *front-loaded*. You're asked to commit to a type before you've even said what the thing is. That's the friction — not the number of types.

---

## 3. Two ways to resolve the Task/Reminder fuzziness

A **decision**, not a done call. Both documented; locked in [3 · Action Plan](<3 - Action Plan.md>).

### Option A — Keep all three types, but **infer** the type from what you enter *(recommended; this is the locked choice)*

Don't ask "is this a Task or a Reminder?" up front. Ask **"what is it?"** then **"when?"**, and let the answer decide:

- A **time + alert** → it's a **Reminder**.
- A **start + a duration/estimate or subtasks** → it's a **Task**.
- A **start AND end** → it's an **Event**.
- Toggle **"at home"** → `location_context: home` (+ `is_chore` if from a chore template).

The three types survive in the data (nothing to migrate), but the *user* never picks one — the form derives it. This directly attacks the capture pain without touching the schema.

### Option B — Collapse Task into Reminder (two visible types: **Reminder** + **Event**)

Since they already share `reminder_details`, merge them in the UI: everything time-due-with-a-nudge is a **Reminder**; "task-ness" becomes a sub-property (has subtasks / has an estimate). Only **Event** stays separate. Chore stays a flag.

- **Pro:** simplest possible mental model — "Reminder or Event," plus flags.
- **Con:** loses the word "Task"; a small data cleanup (re-label existing `task` rows or keep `type=task` internally while hiding it). Bigger change.

> **Lean (and decided):** **Option A** — ~90% of the simplicity of B with ~10% of the risk (no migration, types stay), and it keeps the vocabulary you think in. B is the fallback if A's inference still feels like too many questions. **Note (mobile-form UI, 2026-06-06):** the live form already went a step further toward B for *display* — it shows **Reminder | Event only** and coerces `task → reminder` in the UI (DB still has `task`). The global `task` retirement is a deferred cross-cutting work item — see [file 5, "Global — retire `task` type"](<3 - Action Plan.md>).

---

> **⚠️ Target correction (2026-06-06):** §4 below was written against [`MobileItemForm.tsx`](<../../../src/components/items/MobileItemForm.tsx>), but that file is **dead code** (zero importers). The **live** mobile capture form is [`MobileReminderForm.tsx`](<../../../src/components/reminder/MobileReminderForm.tsx>) (mounted in `TabContainer`), which was **already** single-page with smart NL input ([`smartTextParser.ts`](<../../../src/lib/smartTextParser.ts>)), inferred type, progressive disclosure, and voice — so most of this refactor already existed there. The genuine gaps (title-only save, quick date chips, At-Home/location_context/maps-link) shipped on the live form 2026-06-06. See [file 5, Phase 1a](<3 - Action Plan.md>). The §4 blueprint is preserved as the design intent.

## 4. The Mobile Item Form refactor (`/expense`) — design blueprint

**Original file:** [src/components/items/MobileItemForm.tsx](<../../../src/components/items/MobileItemForm.tsx>) (dead). The old design branched on `createMode` (reminder/event/task chosen *first*) and walked **5 steps**: `title → datetime → details → priority → confirm` (`FormStep`). That was the heaviness.

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
5. **Alert off by default,** one tap to add — instead of an alert sub-flow every time. (Addresses the "events are easier than reminders/tasks" asymmetry in [file 1, Cluster 3](<1 - Feature State.md>): the alert decision is what makes reminders/tasks feel heavier.)
6. **"At home" as a single toggle** → `location_context: "home"`. No separate location step for the common case.
7. **Everything advanced (recurrence, subtasks, responsible user, prerequisites, priority) lives under "More"** — present for the precision case, invisible for the 80% quick case. This is the form earning its "precision tool" role (per CLAUDE.md: forms are precision; the Hub is quick capture).

### What this is NOT

- Not a schema change (Option A). Reuses `reminder_details` / `event_details`, `is_chore`, `location_context` as-is.
- Not removing capability — every advanced field still reachable under "More."
- Not the Hub-capture decision — that's the *other* fast lane. This refactor makes the **form** the strong precision tool; Hub remains the quick lane. They're complementary.

---

## 5. Recommendation in one line

**Keep three types in the data, stop asking the user to pick one** (infer it), **make Chore/home flags not types**, and **rebuild the form as one capture screen + a "More" disclosure** — title-only save, type inferred at save. That removes the capture friction without a migration.

---

# Part 2 — `3 - Action Plan.md` Reconciliation & Harmonized Scope

> The bridge between the externally-authored brief [`3 - Action Plan.md`](<3 - Action Plan.md>) and *this* app's reality. The brief was generated by another AI with **no access to the database or codebase**, so several assumptions don't match what's built. This part resolves **every** ask into ✅ harmony / 🔧 reshaped / ⏳ deferred / ⛔ won't-act, each with a code-grounded reason, then folds the survivors into the existing campaign instead of forking a parallel plan.

## 0. The headline

`3 - Action Plan.md` is **~70% already planned** and **~30% in tension with the app**.

- The type-merge + form simplification it asks for is **already designed** in Part 1 (keep three types in data, **infer at save, never ask**, one capture screen + "More"). Nothing new to decide there — just build it.
- ~~Its biggest premise is false: there is no item NLP to "make 10× smarter."~~ **CORRECTION (2026-06-06):** this was **wrong**. Item NLP **already exists** — [`src/lib/smartTextParser.ts`](<../../../src/lib/smartTextParser.ts>) (1,420 lines: type, dates, times, RRULE recurrence, priority, categories) is wired into the **live** form [`MobileReminderForm.tsx`](<../../../src/components/reminder/MobileReminderForm.tsx>). The original grep only checked `src/lib/nlp/` (the *budget* parser) and missed it. So "make NLP smarter" is **incremental hardening**, not net-new. See [file 5, Phase 1b](<3 - Action Plan.md>).
- Its **location-trigger model doesn't exist** (no geofencing; `location_context` is a static flag) and is explicitly **out of scope** — but the *intent* ("remind me when I get home") maps cleanly onto the **NFC arrive/leave-home trigger that already exists**, deferred to Phase 2.

> **Decisions locked this session (2026-06-06):**
> 1. **Both capture lanes** — a natural-language box *in the mobile form* **and** Hub Chat ("a good test of Hub Chat").
> 2. **Engine split** — **rule-based** parser in the form (mirror `messageTransactionParser.ts`); **Gemini** in Hub Chat.
> 3. **No geofencing.** "When I get home" → set `location_context: home` **and** enable the existing **NFC arrive-home** trigger — **Phase 2**, not now.

---

## A. Verdict at a glance

| `3 - Action Plan.md` ask | Verdict | Where it lives now |
|---|---|---|
| Merge Task + Reminder in the UI | ✅ harmony | Part 1 §2–3 — already decided (Option A) |
| Remove the forced "Type" picker; infer type | ✅ harmony | Part 1 §4 — "type inferred at Save" |
| One screen, title-only save, advanced under "More" | ✅ harmony | Part 1 §4 |
| Smart date chips; alert off by default; 🏠 at-home toggle | ✅ harmony | Part 1 §4 |
| Description demoted out of the primary flow | ✅ harmony | Part 1 §4 |
| Keep backend fields/types; no destructive schema change | ✅ harmony | Part 1 §4–5 (Option A = no migration) |
| Natural-language box as the **primary** form field | 🔧 reshaped | §C — NL box **layered on** the structured form, not replacing it |
| "Make NLP **10× smarter**" | 🔧 reshaped | §C — false premise; the parser already exists → **incremental hardening** |
| Compact chip preview of what was understood | 🔧 reshaped | §C — yes, but built to ERA look-&-feel guardrails |
| Confidence / one-question clarification UX | ⏳ deferred | §D / Phase 3 |
| "Remind me when I get home" (location trigger) | ⏳ deferred | §D — via `location_context` + **NFC** arrive-home, Phase 2 |
| "Tap NFC back home" (NFC trigger from text) | ⏳ deferred | §D — text→`tag_id` mapping, Phase 2 |
| Geofencing / fire-on-arrival location triggers | ⛔ won't act | §E — doesn't exist; PWA; user said no |
| Reuse the existing NLP wholesale for items | ⛔ won't act | §E — budget parser is amount/category specific |
| "Remove duplicate/confusing mobile pages" (its Phase 6) | ⛔ won't act | §E — that's [file 5 **W9** = "Later"](<3 - Action Plan.md>); don't delete ad hoc |
| Cover *every* manual capability with NLP now | ⛔ won't act | §E / §G — inert prerequisites & untested recurrence gate this |

---

## B. In harmony — will act upon *(grounded in Part 1 §4)*

These need no new decision; `3 - Action Plan.md` and the campaign already agree. Build per Part 1 §4:

- **Kill the up-front type picker.** Keep `createMode` internally as the *inferred* result (or an optional FAB pre-seed) — never an up-front question.
- **Collapse the 5-step flow → one capture screen + a "More" disclosure.** The `confirm` step dies — Save is immediate (Undo toast covers mistakes, Hard Rule #1).
- **Title-only save.** Everything else optional; a title-only save = a dateless "someday" reminder.
- **Smart date chips** (`Today / Tomorrow / Pick… / No date`) as the primary date control; stepper under the chip.
- **Alert off by default**, one tap to add (kills the per-reminder alert sub-flow — the asymmetry in [file 1, Cluster 3](<1 - Feature State.md>)).
- **🏠 At-home as a single toggle** → `location_context: "home"`.
- **Description demoted** under "More"; advanced fields (recurrence, subtasks, responsible user, prerequisites, priority) all live under "More."

**Plus the new call:** **both capture lanes** — the form gains a quick-capture NL box *and* Hub Chat becomes a parsing surface. The form stays the **precision tool** (CLAUDE.md intent); the NL box is a fast on-ramp into it, not a replacement.

---

## C. Reshaped to fit the ecosystem *(the careful part — what changed and why)*

### C1. "Make NLP 10× smarter" → **harden the parser that already exists** *(corrected 2026-06-06)*
~~There is no item NLP today.~~ **Correction:** item NLP **already exists and ships** — [`src/lib/smartTextParser.ts`](<../../../src/lib/smartTextParser.ts>) (type, relative/absolute dates, times, RRULE recurrence, priority, categories, confidence scores) is used by the live [`MobileReminderForm.tsx`](<../../../src/components/reminder/MobileReminderForm.tsx>) with manual-override tracking and voice input. (The earlier claim came from only grepping `src/lib/nlp/` — the *budget* parser [`messageTransactionParser.ts`](<../../../src/lib/nlp/messageTransactionParser.ts>) — and missing `smartTextParser.ts`.) So "10×" is the wrong frame: the remaining work is **incremental** (recurrence hardening behind tests, broader phrase coverage), not building from zero.

### C2. The NL box is **layered on** the structured form, not the form's replacement
`3 - Action Plan.md` wants one NL box *as* the primary field. We keep "both lanes," but the form's **structured fields remain the source of truth** — the rule-based parser **pre-fills** them, surfaced as **editable chips**. The user always sees and can correct exactly what will be saved. This honors the "good test of Hub Chat" without turning the *precision* tool into an opaque parser. (Per CLAUDE.md: Hub = quick lane, form = precision tool — keep that spine.)

### C3. Engine split: **rule-based in the form, Gemini in Hub Chat**
- **Form** → rule-based parser, mirroring the *structure* of [`messageTransactionParser.ts`](<../../../src/lib/nlp/messageTransactionParser.ts>) (extractors + a confidence score). **Offline-capable** — no network on the hot capture path.
- **Hub Chat** → **Gemini** via [`src/lib/ai/gemini.ts`](<../../../src/lib/ai/gemini.ts>) (the established AI pattern: budget voice, `suggest-schedule`, ERA chat). **Must pass `timeoutMs`** on the call (Hard Rule #6 — AI calls exceed the 3 s default and would falsely flag offline).

### C4. The chip/preview UI must obey the ERA look-&-feel (so it stays on-brand)
`3 - Action Plan.md`'s "compact interpretation preview" is welcome, but built against the project's Hard Rules:
- `useThemeClasses()` for all colors; **never hardcode** backgrounds (#10).
- Any floating panel (chip editor, clarification popover) is **opaque** via `tc.bgPage`, never `neo-card` glass (#15).
- **Futuristic SVG icons** on chips/toasts (#4); **every toast has an Undo** (#1).
- Any numeric sub-input uses `type="text" inputMode="decimal"` (#19); **mobile-first**, verified on mobile viewport (#5).

---

## D. Deferred to Phase 2+ *(real, but not now)*

### D1. "Remind me when I get home" → `location_context` + **NFC**, not geofencing
The *intent* is valid and maps onto infrastructure that **already exists**:
- Set `location_context: "home"` (the flag — Part 1 §1).
- Attach an `nfc_state_change` **prerequisite** bound to the user's **arrive-home** tag. The model exists: `NfcStateChangeConfig { tag_id, target_state }` ([prerequisites.ts:22](<../../../src/types/prerequisites.ts#L22>)), evaluated by [`nfc-state.ts`](<../../../src/lib/prerequisites/evaluators/nfc-state.ts>) against `nfc_tags.current_state`. **The form already wires `PrerequisitePicker`.**
- **The only net-new piece** is the parser mapping the phrase "home" → the user's tag (via `nfc_tags.label`). That's **Phase 2** (form parser pre-fills the prerequisite the picker already builds).

### D2. Confidence / clarification UX — **Phase 3**
"Call Samir later" → one lightweight question (`Tonight` / `Tomorrow` / `Pick time`). Keep it minimal and on-brand (§C4). Never block a simple save.

---

## E. Will NOT act upon — contradicts the ecosystem *(explicit, as requested)*

- **⛔ Geofencing / fire-on-arrival location triggers.** No geolocation triggering exists in the app; it's a **PWA** (native geofencing deferred — see the Capacitor-shell decision), and the user explicitly said **no geofencing**. `location_context` is a *static flag*, not a trigger. The "when I get home" intent is served by the **NFC** route instead (§D1).
- **⛔ Reusing the budget NLP wholesale for items.** [`messageTransactionParser.ts`](<../../../src/lib/nlp/messageTransactionParser.ts>) is hard-wired to *amounts, currencies, and spend categories*. Reuse its **shape** (extractor functions + confidence score), **not its logic**.
- **⛔ Ad-hoc deletion of "duplicate/confusing mobile pages"** (`3 - Action Plan.md` Phase 6). Surface consolidation is [file 5 **W9** = "Later"](<3 - Action Plan.md>) and the `/reminders` role is an open question ([file 2 Direction](<2 - Vision & Roadmap.md>)). **CONFIRMED 2026-06-06:** the live form is [`MobileReminderForm.tsx`](<../../../src/components/reminder/MobileReminderForm.tsx>) (mounted in `TabContainer`); [`MobileItemForm.tsx`](<../../../src/components/items/MobileItemForm.tsx>) is **dead code** (zero importers). Left in place per user decision — **do not delete**; track removal under [file 5 item 5.3](<3 - Action Plan.md>).
- **⛔ Lighting up the inert prerequisite evaluators** (`weather`, `time_window`, `schedule`, `custom_formula`) just to widen NLP coverage. [File 5 "Not now"](<3 - Action Plan.md>); [file 1 weak-link #3](<1 - Feature State.md>). Only `nfc_state_change` + `item_completed` are live.
- **⚠️ Will not feed an unproven parser into untested recurrence math** ([file 1 weak-link #1](<1 - Feature State.md>) — recurrence + occurrence-action math is the highest-risk, untested logic). Recurrence parsing stays **conservative** and is **gated behind tests** before it can write an RRule.

---

## F. Harmonized phased plan *(replaces `3 - Action Plan.md`'s 6 phases; aligned to [3 · Action Plan](<3 - Action Plan.md>) Now/Next/Later & W6)*

| Phase | Goal | Maps to |
|---|---|---|
| **1 — Form foundation** | Infer type at save; one screen + "More"; title-only save; smart date chips; alert off by default; 🏠 toggle; Description under "More". **No schema change.** | Part 1 §4; refines [W6](<3 - Action Plan.md>) |
| **1b — Rule-based NL box (form)** | Extract title + date/time + *simple* recurrence → pre-fill structured fields as editable chips. Offline. | §C1–C3; **W10** |
| **1c — Hub Chat Gemini capture** | One line → structured item via `gemini.ts` (the "test of Hub Chat"). `timeoutMs` set. | §C3; **W11** |
| **2 — Location + NFC-from-text** | "at home"/"when I get home" → `location_context: home` + bind arrive/leave-home **NFC** prerequisite via existing `PrerequisitePicker`. | §D1; **W12** |
| **3+ — Confidence UX & recurrence hardening** | Minimal clarification for ambiguous phrases; recurrence parsing behind tests. | §D2, §E |

> **Sequencing note:** Phase 1 is the [file 5 "Next" slice](<3 - Action Plan.md>) (it *is* the form half of **W6**). 1b/1c can follow once the form skeleton is simplified. **Phase 2+ does not start until Phase 1 ships and is verified.**

---

## G. Corrected NLP capability matrix *(grounded in the real schema)*

`3 - Action Plan.md` asked for a capability matrix. Here it is re-grounded in what the app actually stores and what each lane can realistically parse.

| Capability | Manual field exists? | Storage | Parser engine / lane | Target phase |
|---|---|---|---|---|
| Title / action | ✅ | `items.title` | rule-based (form) · Gemini (Hub) | **1b / 1c** |
| Due date + time | ✅ | `reminder_details.due_at` | rule-based · Gemini | **1b / 1c** |
| Start + end (→ Event) | ✅ | `event_details.start_at/end_at` | rule-based (infer Event when both present) | 1b → later |
| Recurrence (RRule) | ✅ | `item_recurrence_rules` (`CreateRecurrenceInput`) | rule-based, **conservative, gated behind tests** | **3** |
| Alert offset | ✅ | `item_alerts` (`SmartAlertPicker`) | rule-based ("at 8", "30 min before") | **1b** |
| At-home / location flag | ✅ (🏠 toggle) | `items.location_context` | rule-based ("at home", "when I get home") | **1 / 2** |
| NFC trigger | ✅ (`PrerequisitePicker`) | `nfc_state_change` prerequisite | text → `tag_id` via `nfc_tags.label` | **2** |
| Priority | ✅ | `items.priority` | rule-based ("urgent", "high") | 1b → later |
| Description / notes | ✅ | `items.description` | overflow text → notes (under "More") | **1** |
| Responsible user | ✅ (`ResponsibleUserPicker`) | `items.responsible_user_id` | name → household member (defer; Gemini-friendly) | later |
| Categories | ✅ | item ↔ category link | keyword match (like budget category match) | later |
| Subtasks | ✅ | `item_subtasks` | — | later |
| Geofence location trigger | ❌ **does not exist** | — | — | ⛔ never (§E) |

---

## H. PM bookkeeping *(Hard Rule #25)*

- ✅ Reconciliation recorded; refined work items folded into [3 · Action Plan](<3 - Action Plan.md>) as **W10** (form NL box), **W11** (Hub Gemini capture), **W12** (NFC-from-text, Phase 2) — recorded as **refinements of W6**, not replacements.
- **When Phase 1 ships:** Atlas entry for the form (#23), `App Routes and Icons.md`, and the [Items & Reminders vault docs](<../../02 - Standalone Modules/Items & Reminders/Overview.md>) must be updated in the same session.

---

→ Build order and "what's next" → [5 · Execution Plan & Build Checklist](<3 - Action Plan.md>). · The decisions these phases rest on → [2 · Vision, Target Design & Decisions](<2 - Vision & Roadmap.md>).


---

# Recurrence & Occurrence Actions

*(Folded in 2026-06-20 from the former file 4 — the occurrence-action model, the three-engine problem, and the staged unification plan.)*

> **What this file is:** the deep, code-confirmed audit of *why "recurring items feel like a mess"* — the actual bug behind "Skip moved my occurrence to next week and duplicated it," plus the systemic reason different screens disagree. It ends in a **staged refactor plan**. This makes the abstract weak-link #1 ("occurrence-action math is untested," [file 1 Part A](<1 - Feature State.md>)) concrete.
>
> **Method & confidence:** every claim is traced to real files/lines from a codebase read on **2026-06-19**. The DB model was read from `migrations/schema.sql`. No code was changed for this doc — it is the map before the build.
>
> **Decision recorded (2026-06-19):** target action model = **Google/Outlook standard** (§4). "Postpone → next occurrence" is removed entirely.

---

## 0. The repro that triggered this

> Recurring item **every Sunday**. **Last** Sunday was missed. On Friday, cleaning up history, I opened **last Sunday's** occurrence and chose **"Skip."** Result: (1) it "moved" to **this** Sunday, and (2) this Sunday now showed **two** copies — the normal weekly one **plus** one tagged **"Postponed."** Marking it Done still left it visible on `/reminders`.

Two separate defects are hiding in that one story: a **mislabelled action** (§1) and a **`/reminders` that never hides completed items** (§5). Underneath both is a **structural duplication** problem (§3).

---

## 1. Root cause — "Skip" is secretly "postpone to next occurrence" 🔴

The control labelled **Skip** is wired to a **postpone-to-next-occurrence**, and postponing a recurring occurrence onto its own next slot **always** produces a duplicate, because the series already lands there.

**Calendar surface (what I actually touched)** — `src/components/web/WebEvents.tsx`:
- The calendar uses its **own** inline floating detail modal (`WebEvents.tsx:1238-1398`), *not* the shared sheet. Its Postpone button opens the **Postpone Options Dialog** (`:1842-2052`).
- The recurring-only button (`:1864-1880`) reads **"Skip to next occurrence — Cancel this time and wait for the next scheduled occurrence"** but calls `handlePostponeAction("next_occurrence")` (`:330-349`).
- `handlePostpone` ([useItemActions.ts:934-993](<../../../src/features/items/useItemActions.ts>)) computes `postponed_to = calculateNextOccurrence(lastSunday, rrule)` = `addWeeks(lastSunday, 1)` = **this Sunday**, then inserts an `item_occurrence_actions` row `action_type:"postponed", postponed_to:thisSunday`.
- The weekly series already lands on this Sunday → the calendar shows the normal occurrence **plus** the postponed copy (amber "Postponed to this day" section in `WebCalendar.tsx`) → **two occurrences**. Exact match.

**Planner / detail surface (same trap + a second bug)** — `src/components/items/ItemActionsSheet.tsx`:
- Postpone option `next_occurrence` (`:380-385`) is sub-labelled **"Skip this time, mark as incomplete"** → same `onPostpone("next_occurrence")` → same duplicate.
- The real **"Skip This Time"** button (`:758-780`) calls `handleCancelClick` → `onCancel` → records `action_type:"cancelled"`, **not** `"skipped"`. `ItemActionsSheet` has **no `onSkip` prop**; the correct `handleSkip`/`useSkipItem` path (which *does* write `skipped` + an `item_alert_suppressions` row) is dead code from every sheet.

**One-line root cause:** *"Postpone → next occurrence" is conceptually invalid for recurring items, and the UI mislabels it as "Skip." No true per-occurrence Skip is wired anywhere.* The fragile hand-rolled `calculateNextOccurrence` ([useItemActions.ts:93-120](<../../../src/features/items/useItemActions.ts>) — handles only FREQ DAILY/WEEKLY/MONTHLY/YEARLY, ignores BYDAY/COUNT/UNTIL) exists *solely* to feed this broken option.

---

## 2. The data model is fine — the mess is in the UI/expansion layers

The DB already supports correct semantics:
- `item_occurrence_actions.action_type CHECK IN ('completed','postponed','cancelled','skipped')` + `postponed_to`, `postpone_type`, `occurrence_date`, `metadata_json`.
- `item_recurrence_rules` (rrule + `start_anchor` + biweekly `phase_changed_at`/`previous_start_anchor` + `is_flexible`/`flexible_period`), `item_recurrence_exceptions` (`exdate` + `override_payload_json`), `item_flexible_schedules`, `item_alert_suppressions` (`reason CHECK IN ('cancelled','skipped','deleted','archived','manual')`), `recurrence_pauses`.

The skip API branch ([items/[id]/actions/route.ts:307-369](<../../../src/app/api/items/[id]/actions/route.ts>)) writes `skipped` + an alert suppression **correctly**. The plumbing is right — nothing calls it.

---

## 3. The systemic mess — duplicated, diverging implementations

Two layers are each implemented 2–3 times and the copies disagree. This is why the same item looks/acts differently on different screens — the real source of "messy."

### 3a. THREE occurrence-expansion engines

| Concern | `date.ts` + WebCalendar inline | `dayOccurrences.ts` (planner, today) | `schedule/expandOccurrences.ts` (canonical, **unused**) |
|---|---|---|---|
| RRULE + bi-weekly phase | ✅ | ⚠️ phase not passed through | ✅ |
| Recurrence exceptions (skip/override) | ✅ inline | ❌ | ✅ |
| `rescheduled_to` moves | ✅ inline | ❌ | ✅ |
| Pauses | ✅ inline | ❌ | ✅ |
| Per-occurrence field overrides | ✅ inline | ❌ | ✅ (`materializeOccurrence.ts`) |
| Completed/cancelled/skipped filter | ✅ | ✅ | ✅ |
| Postponed-action copy on new date | ✅ (separate section) | ✅ | ❌ |
| Flexible-schedule injection | ✅ | ✅ | ❌ |

- [`src/lib/utils/date.ts`](<../../../src/lib/utils/date.ts>) — `getOccurrencesInRange`, `adjustOccurrenceToWallClock` (DST wall-clock), `buildFullRRuleString`. Correct low-level primitive.
- [`src/lib/utils/dayOccurrences.ts`](<../../../src/lib/utils/dayOccurrences.ts>) — used by `WebDayPlanner` and `WebTodayView`. **Ignores exceptions, pauses, rescheduled_to, and per-occurrence overrides** → an edited/paused/rescheduled occurrence renders **wrong on `/reminders` & Today** but **right on the calendar**.
- [`src/lib/schedule/expandOccurrences.ts`](<../../../src/lib/schedule/expandOccurrences.ts>) (+ `materializeOccurrence.ts`) — the intended single source of truth, **already has tests** (`expandOccurrences.test.ts`), handles exceptions/pauses/overrides — but is **wired to nothing**, and lacks flexible injection + postponed-action handling.
- `WebCalendar.tsx:326-569` — the most complete behaviour, but bespoke and duplicated inline.

> ⚠️ **Wiring reality check.** [1 · Feature State](<1 - Feature State.md>) lists RRULE expansion as "unit-tested ✅ (`expandOccurrences.test.ts`)." True — but that engine **is not imported by any surface**. The screens run the *untested* inline/`dayOccurrences` paths. The test guards code nobody uses.

### 3b. TWO occurrence-action UIs
- **Calendar/week** (`WebEvents.tsx`): inline floating modal + inline Postpone dialog + inline custom-date picker.
- **Planner/detail/swipe** (`ItemActionsSheet.tsx` via `WebDayPlanner`, `ItemDetailModal`, `SwipeableItemCard`).

Different labels, different actions, and **both** shipped the "next occurrence" trap. `WebTodayView`/`WebTabletMissionControl` may add further variants.

### 3c. Two representations of "move one occurrence"
A single-occurrence move is modelled **two ways**: a `postponed` action (`postponed_to`) **and** a recurrence exception (`override_payload_json.rescheduled_to`). `materializeOccurrence`/the canonical engine speak the *exception* dialect; the live UI writes the *action* dialect. They must converge (§7 Stage 2).

---

## 4. Target design — Google/Outlook-standard occurrence actions *(decided 2026-06-19)*

**Recurring occurrence menu** (one shared sheet, identical on every surface):
- **Complete** — records `completed` (unchanged).
- **Skip this occurrence** — records `skipped` + `item_alert_suppressions`; occurrence disappears, **nothing rescheduled**. The correct cleanup for a missed past slot.
- **Move to a date** — *tomorrow* / *pick a specific date* only. **No "next occurrence."** Represented as a recurrence exception with `rescheduled_to` (Stage 2) so it flows through `materializeOccurrence` like any other per-occurrence edit.
- **Edit this occurrence** — exception override (unchanged).
- **Edit series / Delete series** — unchanged.

**One-off item menu:** Complete · Move to a date · **Cancel** (`items.status='cancelled'`) · Edit · Delete.

Consequences: delete `calculateNextOccurrence` and the `next_occurrence` postpone path; "Cancel" no longer appears on recurring occurrences (kills the skip/cancel ambiguity). Because flexible-routine overdue accounting keys specifically on `skipped` (`useFlexibleRoutines`), wiring real Skip also fixes silent overdue mis-counts.

---

## 5. The `/reminders` completed-items problem 🟡

`WebDayPlanner` builds `dayOccurrences` *including* completed ones and renders them dimmed/strikethrough with **no way to hide them** (`WebDayPlanner.tsx:1114-1205`, list at `:1845-1862`). The calendar already has the pattern: `showCompleted` + Eye/EyeOff toggle (`WebCalendar.tsx:167, 777-801`).

**Fix design:** add a hide/show-completed toggle (default **hide**; persist in `localStorage`) in the `/reminders` FilterBar `extraActions` next to Plan-day / Overdue ([reminders/page.tsx:200-248](<../../../src/app/reminders/page.tsx>)), passed into `WebDayPlanner` as a `showCompleted` prop (mirrors `showOverdue`). Split the day list into open items + a collapsible **"Completed (n)"** section gated by the toggle.

---

## 6. Other fragile / poorly-implemented areas (queued, not yet built)

1. **Hand-rolled RRULE math** (`calculateNextOccurrence`) — ignores BYDAY/COUNT/UNTIL; delete with the next-occurrence option.
2. **Engine divergence (§3a)** — central cause of "messy"; `/reminders` & Today silently ignore exceptions/pauses/rescheduled/overrides.
3. **Action-UI divergence (§3b)** — calendar vs planner differ; both shipped the trap.
4. **Skip vs Cancel overlap** — "Skip This Time" writes `cancelled`, breaking flexible overdue accounting that keys on `skipped`.
5. **Completed visibility inconsistent** — calendar has a toggle, `/reminders` has none (§5).
6. **Dual move representation (§3c)** — postponed-action vs rescheduled-exception.
7. **Auto-archive 1-month window** duplicated as a constant in two routes + a manual backfill migration (`migrations/2026-06-19_fix-historic-auto-archived-completed-items.sql`) — drift risk (already flagged in code comments).
8. **`useItems.ts` ~2,621 LOC** hotspot (weak-link #4) — split when next touched, not for its own sake.
9. **`WebDayPlanner` optimistic-complete** resets the whole set on any `occurrenceActions` change (`:1105-1108`) — minor flash.

---

## 7. Staged refactor plan

**Stage 1 — Correctness (small, high-value, no schema change)**
- Remove the "skip/postpone → next occurrence" button on **both** surfaces (`WebEvents.tsx:1864-1880`, `ItemActionsSheet.tsx:380-385`).
- Add a real **Skip this occurrence** action (wire `handleSkip`/`useSkipItem`; add `onSkip` to `ItemActionsSheet`; add a Skip control to the calendar modal). Make "Cancel" appear only for one-off items.
- Delete `calculateNextOccurrence` and the `next_occurrence` postpone type usage.
- Add the `/reminders` show/hide-completed toggle + collapsible Completed section (§5).
- Add unit tests for skip/complete/move occurrence math (weak-link #1).

**Stage 2 — Unify the engine (the real fix for "messy")**
- Finish `schedule/expandOccurrences.ts` to also inject flexible schedules and (for one-off items) postponed actions; converge recurring single-occurrence **moves** onto `rescheduled_to` exceptions so the engine needs only one move dialect.
- Migrate every surface (WebCalendar, WebWeekView, WebDayPlanner, WebTodayView, WebTabletMissionControl, ItemsListView, RemindersInsightsPage) onto it; delete `dayOccurrences.ts` and the inline loops in WebCalendar.
- Lock behaviour with the expanded `expandOccurrences.test.ts`.

**Stage 3 — Unify the action UI**
- One shared occurrence-action sheet used by calendar, week, planner, today; delete the inline calendar dialog. One labelling, one code path.

**Acceptance test (the original repro):** skipping a missed past occurrence marks it `skipped`, removes it from view, and creates **no** new/duplicate occurrence; completing an occurrence on `/reminders` moves it into the (hideable) Completed section.

---

## 8. Stage 1 — shipped 2026-06-19

All five Stage 1 bullets done:
- **Next-occurrence trap removed everywhere.** Audit during implementation found it on **four** surfaces, not the two originally scoped: `WebEvents.tsx` postpone dialog, `ItemActionsSheet.tsx` postpone options, `WebTabletMissionControl.tsx` postpone dialog (its own separate inline implementation, not previously audited here), and `ItemDetailModal.tsx`'s "⏭ Next Time" quick-action button. `calculateNextOccurrence` and the `next_occurrence` member of `PostponeType` are deleted from `useItemActions.ts`.
- **Real Skip wired on every surface.** `ItemActionsSheet` gained an `onSkip` prop (wired to `handleSkip`/`useSkipItem` in all 4 callers); for recurring items the sheet now shows "Skip this occurrence" instead of "Cancel" (Cancel is one-off-only, per §4's target design). `WebTabletMissionControl`'s `handleSkip` — which actually called `itemActions.handleCancel` despite its name — renamed to `handleCancelOrSkip` and now genuinely branches real skip (recurring) vs cancel (one-off). `WebEvents.tsx`'s calendar action bar does the same branch.
- **`/reminders` completed toggle.** Eye/EyeOff toggle in the FilterBar (default hide, `localStorage`-persisted), `showCompleted` prop threaded into `WebDayPlanner`, day list split into open items + a collapsible "Completed (n)" section.
- **Unit tests added** — [dayOccurrences.test.ts](<../../../src/lib/utils/dayOccurrences.test.ts>) covers the exact §0 repro (skip a past occurrence → no duplicate on the next occurrence), complete, move-to-a-date, and the postponed/next-occurrence-collision dedup case, plus `isOccurrenceCompleted` per action type. Pure logic, no Supabase mocks, `pnpm test` green for this file.
- **Found but explicitly NOT fixed this slice** (logged in [1 · Feature State](<1 - Feature State.md>) Cluster 5): the placement-rule guard test (`expandOccurrences.test.ts`) has a pre-existing failure against `WebTodayView.tsx` — confirmed via `git stash` to predate this session. Unrelated to recurrence/skip correctness; a source-text-regex guard gap, not a flexible-placement bug.

Stage 2 (engine unification) and Stage 3 (shared action UI) are still open — see §7 above.

---

→ Heading/decisions context → [2 · Vision, Target Design & Decisions](<2 - Vision & Roadmap.md>).
→ Where this slots in the build queue → [5 · Execution Plan & Build Checklist](<3 - Action Plan.md>).

