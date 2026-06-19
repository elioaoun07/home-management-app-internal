---
created: 2026-05-30
updated: 2026-06-19
type: roadmap
status: living
owner: Elio
tags:
  - pm/roadmap
  - scope/module
  - module/schedule
---

# Schedule · 3 — Type Taxonomy & Capture Design

> **Command Center:** [_index](<_index.md>) · [1 · Feature State & Pains](<1 - Feature State & Pain Inventory.md>) · [2 · Vision & Decisions](<2 - Vision, Target Design & Decisions.md>) · [3 · Type & Capture Design](<3 - Type Taxonomy & Capture Design.md>) · [4 · Recurrence & Occurrence Actions](<4 - Recurrence & Occurrence Actions.md>) · [5 · Execution & Checklist](<5 - Execution Plan & Build Checklist.md>)
>
> **What this file is:** the design substrate under the capture-friction pain ([file 1, Cluster 3](<1 - Feature State & Pain Inventory.md>)). Two parts: **(Part 1)** the answer to "what *are* Task / Reminder / Event / Chore, and does the split make sense?" plus the concrete mobile-form refactor built on that answer; and **(Part 2)** the reconciliation of the **externally-authored** brief `0 - My Plan.MD` against this app's reality — resolving every ask into ✅ harmony / 🔧 reshaped / ⏳ deferred / ⛔ won't-act, then folding the survivors into the build queue. The form can't be simple until the types are crisp, and the NL/capture work can't start until the brief is reconciled — so both live here.
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

A **decision**, not a done call. Both documented; locked in [file 5](<5 - Execution Plan & Build Checklist.md>).

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

> **Lean (and decided):** **Option A** — ~90% of the simplicity of B with ~10% of the risk (no migration, types stay), and it keeps the vocabulary you think in. B is the fallback if A's inference still feels like too many questions. **Note (mobile-form UI, 2026-06-06):** the live form already went a step further toward B for *display* — it shows **Reminder | Event only** and coerces `task → reminder` in the UI (DB still has `task`). The global `task` retirement is a deferred cross-cutting work item — see [file 5, "Global — retire `task` type"](<5 - Execution Plan & Build Checklist.md>).

---

> **⚠️ Target correction (2026-06-06):** §4 below was written against [`MobileItemForm.tsx`](<../../../src/components/items/MobileItemForm.tsx>), but that file is **dead code** (zero importers). The **live** mobile capture form is [`MobileReminderForm.tsx`](<../../../src/components/reminder/MobileReminderForm.tsx>) (mounted in `TabContainer`), which was **already** single-page with smart NL input ([`smartTextParser.ts`](<../../../src/lib/smartTextParser.ts>)), inferred type, progressive disclosure, and voice — so most of this refactor already existed there. The genuine gaps (title-only save, quick date chips, At-Home/location_context/maps-link) shipped on the live form 2026-06-06. See [file 5, Phase 1a](<5 - Execution Plan & Build Checklist.md>). The §4 blueprint is preserved as the design intent.

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
5. **Alert off by default,** one tap to add — instead of an alert sub-flow every time. (Addresses the "events are easier than reminders/tasks" asymmetry in [file 1, Cluster 3](<1 - Feature State & Pain Inventory.md>): the alert decision is what makes reminders/tasks feel heavier.)
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

# Part 2 — `0 - My Plan.MD` Reconciliation & Harmonized Scope

> The bridge between the externally-authored brief [`0 - My Plan.MD`](<0 - My Plan.MD>) and *this* app's reality. The brief was generated by another AI with **no access to the database or codebase**, so several assumptions don't match what's built. This part resolves **every** ask into ✅ harmony / 🔧 reshaped / ⏳ deferred / ⛔ won't-act, each with a code-grounded reason, then folds the survivors into the existing campaign instead of forking a parallel plan.

## 0. The headline

`0 - My Plan.MD` is **~70% already planned** and **~30% in tension with the app**.

- The type-merge + form simplification it asks for is **already designed** in Part 1 (keep three types in data, **infer at save, never ask**, one capture screen + "More"). Nothing new to decide there — just build it.
- ~~Its biggest premise is false: there is no item NLP to "make 10× smarter."~~ **CORRECTION (2026-06-06):** this was **wrong**. Item NLP **already exists** — [`src/lib/smartTextParser.ts`](<../../../src/lib/smartTextParser.ts>) (1,420 lines: type, dates, times, RRULE recurrence, priority, categories) is wired into the **live** form [`MobileReminderForm.tsx`](<../../../src/components/reminder/MobileReminderForm.tsx>). The original grep only checked `src/lib/nlp/` (the *budget* parser) and missed it. So "make NLP smarter" is **incremental hardening**, not net-new. See [file 5, Phase 1b](<5 - Execution Plan & Build Checklist.md>).
- Its **location-trigger model doesn't exist** (no geofencing; `location_context` is a static flag) and is explicitly **out of scope** — but the *intent* ("remind me when I get home") maps cleanly onto the **NFC arrive/leave-home trigger that already exists**, deferred to Phase 2.

> **Decisions locked this session (2026-06-06):**
> 1. **Both capture lanes** — a natural-language box *in the mobile form* **and** Hub Chat ("a good test of Hub Chat").
> 2. **Engine split** — **rule-based** parser in the form (mirror `messageTransactionParser.ts`); **Gemini** in Hub Chat.
> 3. **No geofencing.** "When I get home" → set `location_context: home` **and** enable the existing **NFC arrive-home** trigger — **Phase 2**, not now.

---

## A. Verdict at a glance

| `0 - My Plan.MD` ask | Verdict | Where it lives now |
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
| "Remove duplicate/confusing mobile pages" (its Phase 6) | ⛔ won't act | §E — that's [file 5 **W9** = "Later"](<5 - Execution Plan & Build Checklist.md>); don't delete ad hoc |
| Cover *every* manual capability with NLP now | ⛔ won't act | §E / §G — inert prerequisites & untested recurrence gate this |

---

## B. In harmony — will act upon *(grounded in Part 1 §4)*

These need no new decision; `0 - My Plan.MD` and the campaign already agree. Build per Part 1 §4:

- **Kill the up-front type picker.** Keep `createMode` internally as the *inferred* result (or an optional FAB pre-seed) — never an up-front question.
- **Collapse the 5-step flow → one capture screen + a "More" disclosure.** The `confirm` step dies — Save is immediate (Undo toast covers mistakes, Hard Rule #1).
- **Title-only save.** Everything else optional; a title-only save = a dateless "someday" reminder.
- **Smart date chips** (`Today / Tomorrow / Pick… / No date`) as the primary date control; stepper under the chip.
- **Alert off by default**, one tap to add (kills the per-reminder alert sub-flow — the asymmetry in [file 1, Cluster 3](<1 - Feature State & Pain Inventory.md>)).
- **🏠 At-home as a single toggle** → `location_context: "home"`.
- **Description demoted** under "More"; advanced fields (recurrence, subtasks, responsible user, prerequisites, priority) all live under "More."

**Plus the new call:** **both capture lanes** — the form gains a quick-capture NL box *and* Hub Chat becomes a parsing surface. The form stays the **precision tool** (CLAUDE.md intent); the NL box is a fast on-ramp into it, not a replacement.

---

## C. Reshaped to fit the ecosystem *(the careful part — what changed and why)*

### C1. "Make NLP 10× smarter" → **harden the parser that already exists** *(corrected 2026-06-06)*
~~There is no item NLP today.~~ **Correction:** item NLP **already exists and ships** — [`src/lib/smartTextParser.ts`](<../../../src/lib/smartTextParser.ts>) (type, relative/absolute dates, times, RRULE recurrence, priority, categories, confidence scores) is used by the live [`MobileReminderForm.tsx`](<../../../src/components/reminder/MobileReminderForm.tsx>) with manual-override tracking and voice input. (The earlier claim came from only grepping `src/lib/nlp/` — the *budget* parser [`messageTransactionParser.ts`](<../../../src/lib/nlp/messageTransactionParser.ts>) — and missing `smartTextParser.ts`.) So "10×" is the wrong frame: the remaining work is **incremental** (recurrence hardening behind tests, broader phrase coverage), not building from zero.

### C2. The NL box is **layered on** the structured form, not the form's replacement
`0 - My Plan.MD` wants one NL box *as* the primary field. We keep "both lanes," but the form's **structured fields remain the source of truth** — the rule-based parser **pre-fills** them, surfaced as **editable chips**. The user always sees and can correct exactly what will be saved. This honors the "good test of Hub Chat" without turning the *precision* tool into an opaque parser. (Per CLAUDE.md: Hub = quick lane, form = precision tool — keep that spine.)

### C3. Engine split: **rule-based in the form, Gemini in Hub Chat**
- **Form** → rule-based parser, mirroring the *structure* of [`messageTransactionParser.ts`](<../../../src/lib/nlp/messageTransactionParser.ts>) (extractors + a confidence score). **Offline-capable** — no network on the hot capture path.
- **Hub Chat** → **Gemini** via [`src/lib/ai/gemini.ts`](<../../../src/lib/ai/gemini.ts>) (the established AI pattern: budget voice, `suggest-schedule`, ERA chat). **Must pass `timeoutMs`** on the call (Hard Rule #6 — AI calls exceed the 3 s default and would falsely flag offline).

### C4. The chip/preview UI must obey the ERA look-&-feel (so it stays on-brand)
`0 - My Plan.MD`'s "compact interpretation preview" is welcome, but built against the project's Hard Rules:
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
- **⛔ Ad-hoc deletion of "duplicate/confusing mobile pages"** (`0 - My Plan.MD` Phase 6). Surface consolidation is [file 5 **W9** = "Later"](<5 - Execution Plan & Build Checklist.md>) and the `/reminders` role is an open question ([file 2 Direction](<2 - Vision, Target Design & Decisions.md>)). **CONFIRMED 2026-06-06:** the live form is [`MobileReminderForm.tsx`](<../../../src/components/reminder/MobileReminderForm.tsx>) (mounted in `TabContainer`); [`MobileItemForm.tsx`](<../../../src/components/items/MobileItemForm.tsx>) is **dead code** (zero importers). Left in place per user decision — **do not delete**; track removal under [file 5 item 5.3](<5 - Execution Plan & Build Checklist.md>).
- **⛔ Lighting up the inert prerequisite evaluators** (`weather`, `time_window`, `schedule`, `custom_formula`) just to widen NLP coverage. [File 5 "Not now"](<5 - Execution Plan & Build Checklist.md>); [file 1 weak-link #3](<1 - Feature State & Pain Inventory.md>). Only `nfc_state_change` + `item_completed` are live.
- **⚠️ Will not feed an unproven parser into untested recurrence math** ([file 1 weak-link #1](<1 - Feature State & Pain Inventory.md>) — recurrence + occurrence-action math is the highest-risk, untested logic). Recurrence parsing stays **conservative** and is **gated behind tests** before it can write an RRule.

---

## F. Harmonized phased plan *(replaces `0 - My Plan.MD`'s 6 phases; aligned to [file 5](<5 - Execution Plan & Build Checklist.md>) Now/Next/Later & W6)*

| Phase | Goal | Maps to |
|---|---|---|
| **1 — Form foundation** | Infer type at save; one screen + "More"; title-only save; smart date chips; alert off by default; 🏠 toggle; Description under "More". **No schema change.** | Part 1 §4; refines [W6](<5 - Execution Plan & Build Checklist.md>) |
| **1b — Rule-based NL box (form)** | Extract title + date/time + *simple* recurrence → pre-fill structured fields as editable chips. Offline. | §C1–C3; **W10** |
| **1c — Hub Chat Gemini capture** | One line → structured item via `gemini.ts` (the "test of Hub Chat"). `timeoutMs` set. | §C3; **W11** |
| **2 — Location + NFC-from-text** | "at home"/"when I get home" → `location_context: home` + bind arrive/leave-home **NFC** prerequisite via existing `PrerequisitePicker`. | §D1; **W12** |
| **3+ — Confidence UX & recurrence hardening** | Minimal clarification for ambiguous phrases; recurrence parsing behind tests. | §D2, §E |

> **Sequencing note:** Phase 1 is the [file 5 "Next" slice](<5 - Execution Plan & Build Checklist.md>) (it *is* the form half of **W6**). 1b/1c can follow once the form skeleton is simplified. **Phase 2+ does not start until Phase 1 ships and is verified.**

---

## G. Corrected NLP capability matrix *(grounded in the real schema)*

`0 - My Plan.MD` asked for a capability matrix. Here it is re-grounded in what the app actually stores and what each lane can realistically parse.

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

- ✅ Reconciliation recorded; refined work items folded into [file 5](<5 - Execution Plan & Build Checklist.md>) as **W10** (form NL box), **W11** (Hub Gemini capture), **W12** (NFC-from-text, Phase 2) — recorded as **refinements of W6**, not replacements.
- **When Phase 1 ships:** Atlas entry for the form (#23), `App Routes and Icons.md`, and the [Items & Reminders vault docs](<../../02 - Standalone Modules/Items & Reminders/Overview.md>) must be updated in the same session.

---

→ Build order and "what's next" → [5 · Execution Plan & Build Checklist](<5 - Execution Plan & Build Checklist.md>). · The decisions these phases rest on → [2 · Vision, Target Design & Decisions](<2 - Vision, Target Design & Decisions.md>).
