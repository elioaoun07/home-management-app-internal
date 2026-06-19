---
created: 2026-05-30
updated: 2026-06-19
status: active
owner: Elio
type: action-plan
tags:
  - pm/action
  - scope/module
  - module/schedule
---

# Schedule · 5 — Execution Plan & Build Checklist

> **Command Center:** [_index](<_index.md>) · [1 · Feature State & Pains](<1 - Feature State & Pain Inventory.md>) · [2 · Vision & Decisions](<2 - Vision, Target Design & Decisions.md>) · [3 · Type & Capture Design](<3 - Type Taxonomy & Capture Design.md>) · [4 · Recurrence & Occurrence Actions](<4 - Recurrence & Occurrence Actions.md>) · [5 · Execution & Checklist](<5 - Execution Plan & Build Checklist.md>)
>
> **What this file is:** the **single driving surface** — the daily queue *and* the flattened build list. It carries: **(A)** the call + sequenced Now/Next/Later queue (a living queue, **not** a fixed Mon–Fri grid), **(B)** the candidate-work tables (every pain + enhancement as a work item), and **(C)** the **Master Build Checklist** — every *pending* item from the whole campaign flattened into phased, checkable bullets with work-item IDs, severity, effort, and source links. **Tell me a line (e.g. _1.3_), a group (e.g. _Phase 1_), or a phase, and I'll work it.**
>
> **Legend:** Sev 🔴 blocker · 🟠 friction · 🟡 annoyance · ⚪ parked. Effort S/M/H. ✅ items are **done**; they stay as the record (Hard Rule #25 — no orphan fixes).
>
> **Decisions already locked** (don't re-litigate): three types stay in data, **type inferred at save** ([file 3 Part 1](<3 - Type Taxonomy & Capture Design.md>)); **both capture lanes** — rule-based in the form, Gemini in Hub ([file 3 Part 2](<3 - Type Taxonomy & Capture Design.md>)); **no geofencing** ([file 3 §E](<3 - Type Taxonomy & Capture Design.md>)); Focus → per-item mode ([file 2 Decision 1](<2 - Vision, Target Design & Decisions.md>)); household co-edit + reassign both ways ([file 2 Decision 2](<2 - Vision, Target Design & Decisions.md>)); recurrence action model = Google/Outlook standard ([file 4 §4](<4 - Recurrence & Occurrence Actions.md>)).

---

## 📌 The call

**The pain is mapped ([file 1](<1 - Feature State & Pain Inventory.md>)). The directions are set ([file 2](<2 - Vision, Target Design & Decisions.md>)). The design substrate is ready ([file 3](<3 - Type Taxonomy & Capture Design.md>)). Now execute, foundation-first.**

Schedule is 🟢 Core and stable, so the danger isn't missing features — it's that its **trickiest logic (recurrence + occurrence actions + the flexible placement rule)** needed hardening, and four prerequisite evaluators are advertised but inert. The household-co-edit slice (the original highest-severity pain, two 🔴s) is **done**; the form-capture refactor is largely **shipped**. **The recurrence/occurrence-action correctness bug is fixed (2026-06-19)** — "Skip" no longer duplicates recurring occurrences (Stage 1 of [file 4](<4 - Recurrence & Occurrence Actions.md>) shipped). **The current top priority is now the one stub with the best value-for-effort (`time_window`)**, then engine unification (Stage 2), then make ERA read the time graph.

This mirrors the global theme ("Stabilize, then Connect") at the module level: harden the recurrence core, then connect Schedule outward.

> **Shipped ad-hoc, outside the original sequence:** "Plan My Day" (`/today`, now merged into `/reminders`) — a disrupted-day triage planner (push off / both-direction prepone / ad-hoc tasks / checkpoints), shipped 2026-06-16. Phase 1 only — hourly timeline + mood/energy optimizer deferred. See [2 · Vision](<2 - Vision, Target Design & Decisions.md>) Track A and [Plan My Day Overview](<../../03 - Junction Modules/Plan My Day/Overview.md>). Doesn't change the foundation-first call.
>
> - [x] **Fixed 2026-06-16:** the day-plan header (title/intent/notes/Private-Shared) and checkpoints were firing a full API call on every keystroke/click — worst case a `POST` per Private/Shared toggle. Replaced with a save-gated draft model: an unplanned day shows an editable form with one **Save**; a planned day shows a read-only **preview card** with **Edit**/**Delete**. No API calls during editing, only on Save/Delete (checkpoint done/undone toggle stays live by design). See [Plan My Day Overview](<../../03 - Junction Modules/Plan My Day/Overview.md>) "The save-gated draft model."

---

## 🎯 Candidate work

### Campaign work items *(every pain from [file 1](<1 - Feature State & Pain Inventory.md>), as work items)*

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

> **W10–W12 are refinements of W6** (the capture-path decision), scoped in [file 3 Part 2](<3 - Type Taxonomy & Capture Design.md>). They do not replace W6; the form refactor in [file 3 Part 1 §4](<3 - Type Taxonomy & Capture Design.md>) is the foundation they sit on. **W13** is the concrete form of the recurrence weak-link — see [file 4](<4 - Recurrence & Occurrence Actions.md>) for the staged plan.

### Foundational + enhancement candidates *(from [file 2 Track A/B](<2 - Vision, Target Design & Decisions.md>))*

| Candidate | Track | Impact | Effort | Foundation? |
|---|---|---|---|---|
| ~~Recurrence/occurrence correctness fix (Skip)~~ *(Stage 1 DONE 2026-06-19)* + engine unify (Stage 2, open) — [file 4](<4 - Recurrence & Occurrence Actions.md>) | A | High | M–H | ✅ yes (top) |
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

- [x] **Step 1 — Verify the ground truth (W4).** *(DONE 2026-06-06)* RPC body captured: returns `user_id = me OR (partner's AND is_public = true)`. W1 alone was enough — RLS policies already grant household co-edit. See [file 1, Cluster 1 myth correction](<1 - Feature State & Pain Inventory.md>).
- [x] **Step 2 — Align write auth (W1).** *(DONE 2026-05-31)* `canMutateItem()` helper in [src/app/api/items/[id]/route.ts](<../../../src/app/api/items/[id]/route.ts>) — creator OR responsible OR active partner. Partner can edit/delete shared items; strangers still get 403.
- [x] **Step 3 — Reassign both ways (W2).** *(DONE 2026-06-06)* `onReassign` prop on [ItemActionsSheet.tsx](<../../../src/components/items/ItemActionsSheet.tsx>); fetches household via `useHouseholdMembers`, "Pass to partner" when I'm responsible, "Take it back" when partner is. Wired with `useUpdateItem` + Undo toast (no dedicated endpoint — RLS covers it).
- [x] **Step 4 — Make handed-off items findable (W3).** *(DONE 2026-06-06)* "Assigned to me" / "Assigned out" collapsible sections in [StandaloneRemindersPage.tsx](<../../../src/components/reminder/StandaloneRemindersPage.tsx>) with one-tap "Return →" / "← Reclaim".
- [x] **Step 5 — Stop the repo lying (W5).** *(DONE 2026-06-06)* Table DDL, `get_schedule_bundle` RPC body, and all RLS policies appended to [migrations/schema.sql](<../../../migrations/schema.sql>).
- [x] **Focus → mode (W7).** *(DONE 2026-06-06)* Retired `/focus` + `FocusPage.tsx` + `FlexibleRoutinesPool.tsx` + `ScheduleRoutineSheet.tsx`. Added `onFocus` + Focus button (crosshair) to `ItemActionsSheet` → `ItemDetailModal`. Week view's "Flexible this week" strip handles routine assignment. Atlas, Feature Index, Routes doc, vault doc updated.
- [x] **Placement-rule guard test.** Asserts a flexible item is *not* placed via rrule and *is* placed from `item_flexible_schedules`. Prevents the "flexible item shows on activation day" class of bug across all 6+ views. → [Schedule Feature](<../../02 - Standalone Modules/Items & Reminders/Schedule Feature.md>) "Adding a New View" checklist.

### ✅ Now — Recurrence & occurrence-action correctness *(Stage 1 — [file 4](<4 - Recurrence & Occurrence Actions.md>) — SHIPPED 2026-06-19)*

- [x] **W13 / Stage 1 — kill the "Skip → next occurrence" trap.** *(DONE 2026-06-19)* Removed on **all four** surfaces found (`WebEvents.tsx`, `ItemActionsSheet.tsx`, `WebTabletMissionControl.tsx` — found during implementation, `ItemDetailModal.tsx` quick-action row — found during implementation); real **Skip this occurrence** wired (`handleSkip`/`useSkipItem`; `onSkip` on `ItemActionsSheet` + all 4 callers; Skip control on the calendar modal + tablet mission control); "Cancel" now appears only for one-off items; `calculateNextOccurrence` + the `next_occurrence` postpone type deleted from `useItemActions.ts`.
- [x] **`/reminders` show/hide-completed toggle** *(DONE 2026-06-19)* + collapsible "Completed (n)" section (default hide; persisted in `localStorage`) — [file 4 §5](<4 - Recurrence & Occurrence Actions.md>).
- [x] **Recurrence + occurrence-action unit tests.** *(DONE 2026-06-19)* [dayOccurrences.test.ts](<../../../src/lib/utils/dayOccurrences.test.ts>) covers the skip/complete/move repro + dedup against the engine `/reminders` & Today actually use, plus `isOccurrenceCompleted` per action type. Pure-logic, no Supabase mocks. Full RRULE-edge-case coverage still gated behind Stage 2 (engine unification). **Gates the recurrence-from-text parser (1b.4)** — unblocked for the cases now covered.

### ⏭️ Next — Foundation + first enhancement

- [ ] **Engine unification (W13 / [file 4](<4 - Recurrence & Occurrence Actions.md>) Stage 2–3).** Finish `schedule/expandOccurrences.ts` (flexible injection + postponed actions; converge moves onto `rescheduled_to`); migrate every surface onto it; delete `dayOccurrences.ts` + inline loops; one shared occurrence-action sheet (Stage 3). Lock with the expanded `expandOccurrences.test.ts`.
- [ ] **Capture path remaining (W6 → W11 / W12).** Form half + rule-based NL box already shipped/exist; remaining = **W11** Hub Chat Gemini capture; **Phase 2 (W12)** location/NFC-from-text. See the Master Build Checklist below.
- [ ] **Ship `time_window` prerequisite.** Smallest stub, highest demo value (meds/morning windows). Proves the conditional-automation engine end-to-end before tackling `schedule` / `custom_formula`.

### 🔜 Later — Connect outward

- [ ] **Schedule → briefing enrichment** (feed the full week's shape into Focus/ERA). _(global Track B)_
- [ ] **Schedule ↔ Budget due-date unify** — bigger; scope after the foundation/recurrence tests exist. _(global Track A / Cashflow)_
- [ ] **Reassignment history/audit (W8).**
- [x] **Surface consolidation — `/reminders` merged with Plan My Day (W9).** *(IMPLEMENTED 2026-06-17; toolbar tuned 2026-06-19)* `WebDayPlanner.tsx` hosts `/reminders` Focus tab; `StandaloneRemindersPage.tsx` deleted; `/today` → redirect. Three-state model (browsing/planning/preview); checklist replaces timed checkpoints; selected-day work is a primary panel with next-item focus, Today in the day navigator, Plan in the top action row, Overdue as its own opt-in section. *(Residual: settle the precise long-term `/reminders` role — 5.1 below.)*

---

## 🏗️ Master Build Checklist *(the flattened, checkable surface)*

> Every *pending* item from the campaign, phased. ✅ items are kept as the record. Point at a line, a group, or a phase.

### Phase 1a — Mobile form foundation 🟠 _(W6 · the capture refactor)_

> **⚠️ Reality correction (2026-06-06):** The live mobile capture form is **[MobileReminderForm.tsx](<../../../src/components/reminder/MobileReminderForm.tsx>)** (mounted in [TabContainer.tsx](<../../../src/components/layouts/TabContainer.tsx>) under the `reminder` tab) — **not** `MobileItemForm.tsx`, which is **dead code** (zero importers; the old 5-step drawer wizard [file 3 Part 1](<3 - Type Taxonomy & Capture Design.md>) described). The live form was already single-page with smart NL input, type inference, progressive disclosure, and voice — so most of 1a/1b already existed. Only **1.3, 1.4, 1.6** were genuine gaps; they shipped 2026-06-06. The dead `MobileItemForm` is parked under [5.3](#phase-5--surface-consolidation--assignments).

- [x] **1.1** ~~Kill the up-front type picker — infer type~~ *(already in live form: `parseSmartText` + `manualOverrides`; type is an editable tag, not a forced first choice)*
- [x] **1.2** ~~Collapse to one capture screen + "More"~~ *(already: single-page hero card + `showLocation`/`showDescription`/`showTriggers` disclosures)*
- [x] **1.3** Title-only save *(IMPLEMENTED 2026-06-06 — removed the forced-date "missing fields" gate for reminder/task in `handleSubmit`; events still need a span. Title-only → dateless reminder.)*
- [x] **1.4** Smart date chips `Today / Tomorrow / No date` *(IMPLEMENTED 2026-06-06 — `applyQuickDate()` + chip row above the date display; "Pick…" stays the existing date modal; honors `manualOverrides.dates`.)*
- [x] **1.5** ~~Alert off by default~~ *(already: `alertValue` defaults to off; `buildAlertInput` returns null when off)*
- [x] **1.6** At-Home / Place / Map-link location *(IMPLEMENTED 2026-06-06 — `selectLocationMode()` segmented control → `location_context: "home"` or `location_text`. **Bug fixed:** reminder/task location now writes the real `location_text` column instead of `metadata_json`.)*
- [x] **1.7** ~~Description + advanced under "More"~~ *(already via the disclosure toggles)*
- [x] **1.8** ~~Type inferred at Save~~ *(already: `itemType` inferred, used in `handleSubmit`)*
- [ ] **1.9** Post-ship docs: vault [Items & Reminders Overview](<../../02 - Standalone Modules/Items & Reminders/Overview.md>) updated with the new capture behaviors. Atlas/Routes unchanged (no new route/icon — edit to an existing surface). _(S)_

> **Pre-existing gaps noted, not fixed this slice (separate from 1a):** the live form's success toasts lack **Undo** (Hard Rule #1) and there's a stray `console.error` in `handleSubmit`/speech handler (Hard Rule #22), plus an unused `missingFieldType` state. Track under Phase 5 cleanup.

#### Round 2 — live-testing feedback (2026-06-06, UI-only on `MobileReminderForm`)

- [x] **R2.1 Retire "Task" in the mobile form** — type is now **Reminder or Event only**. Parser coerces `task → reminder`; Task removed from the type picker, parsed-chip, and the "Add Alert → Task" / "upgrade to Task" paths (alerts now stay on Reminder). **UI-only** — DB still has `task`; see [global retirement](#global--retire-task-type-deferred) below.
- [x] **R2.2 Categories on Events only** — the category header tag + the big category grid card are hidden for reminders; reminders no longer send `category_ids`. Parser only assigns categories for events.
- [x] **R2.3 Remove Description entirely** — dropped the Notes toggle + textarea + `description`/`showDescription` state; no `description` sent from this form.
- [x] **R2.4 De-clutter the form** *(2026-06-06)* — removed the hero "controls row" (location/triggers/recurrence/priority/privacy icons) and consolidated **all optional attributes into one "+ Add" chip** in the header (alert · repeat · priority · location · triggers · privacy). Hero is now just: smart input + voice, parsed chips, title preview, date chips, date row, Save. *(User chose the single "+ Add" approach over always-visible header chips. Flagged that a plain deletion would orphan Location/Triggers/Privacy — the "+ Add" prevents that.)*
- [x] **R2.5 NLP "when I get (back) home" → Location: Home** — added home-phrase detection in the form effect → `location_context: "home"` + a visible **🏠 Home** parsed chip; trailing "when I get home" clause stripped from the title. *(Deeper title cleanup + "home as location not category" belongs in the shared [smartTextParser.ts](<../../../src/lib/smartTextParser.ts>) with tests — Phase 1b/4.)*

##### Global — retire `task` type *(deferred, cross-cutting)*

> User: "check all MD files related to Schedule + fix globally **later** … I don't want to see Task anymore." Mobile-form UI is done (R2.1). **Still to do (later, separate session):** DB merge (`task` rows → `reminder` or a `kind` flag), other surfaces (`WebEventFormDialog`, `ItemDetailModal`, `ItemsListView`, web calendars, `AddReminderFromMessageModal`, filters/sub-modes), the `ItemType` union, and every Schedule MD that names "Task" ([file 3 taxonomy](<3 - Type Taxonomy & Capture Design.md>), Feature Map, vault docs, Atlas). Track as a dedicated work item before touching the DB.

#### Round 3 — quick-control redesign (2026-06-06)

> Story: *"As a user I want to add a schedule item fast, without staring at a screen."* User refined R2.4: **Priority, Privacy, Location = always-visible quick controls**; **Repeat + Triggers (+ Alert, Assign) = under "+ More"**.

- [x] **R3.1** Header chip row slimmed to a single always-visible quick bar: **Priority · Type · Privacy · Location · + More**. Removed the duplicate conditional tags (date/assign/category/repeat/alert).
- [x] **R3.2** Priority always-visible (was "only when non-default"); Privacy is a one-tap Shared/Private pill; Location pill toggles the At-Home/Place/Map panel.
- [x] **R3.3** "+ More" popover now holds only the **specific** options: Alert, Repeat, Triggers, and Assign (household partner only). Priority/Location/Privacy removed from it.
- [x] **R3.4** Hero card is now just: smart input + voice · parsed chips · date chips · date row · **Save**. Removed unused `RepeatIcon`/`TagIcon`/`describeRRule`/`recurrenceDisplayText`.
- [ ] **R3.5** *(not done — flagged)* Visual verification on a real mobile viewport still pending; pre-existing `missingFieldType` unused-warning + missing Undo on toasts (Hard Rule #1) + stray `console.error` (Hard Rule #22) remain for Phase 5 cleanup.

#### Round 4 — thumb-friendly quick-control redesign (2026-06-06)

> User tested R3 and disliked it: tiny text pills (bad for thumb), priority over-explained, wrong sharing default. Story reaffirmed: *add an item fast without staring at the screen.*

- [x] **R4.1 Default Private** — `isPrivate` now defaults to `true` (+ reset). Sharing is opt-in.
- [x] **R4.2 Privacy + Assign combined** — *(superseded by R5.1)* first attempt was a lock icon → popover (Private/Shared + `ResponsibleUserPicker`).
- [x] **R4.3 Big thumb-friendly icon row** — replaced the cramped top text-pill bar with **44px icon-only, color-coded** controls in the hero (thumb zone above Save): ⚑ Priority · 🔒/👥 Privacy · 📍 Location · ⋯ More.
- [x] **R4.4 Priority = color flag** — no text; tap → popover of 4 colored flags (blue/cyan/orange/red).
- [x] **R4.5 Slim header** — top bar is now just a **Reminder | Event** segmented toggle + ✕ clear (no more horizontal pill scroll). "+ More" holds Alert · Repeat · Triggers. Removed dead `ClipboardCheckIcon`.
- [ ] **R4.6** *(still pending)* Visual verification on a real mobile viewport; the Phase 5 cleanup items (Undo on toasts #1, stray `console.error` #22, `missingFieldType` unused) still open.

#### Round 5 — privacy reimagined as avatar assignment (2026-06-06)

> User wanted a *totally different* approach. Story: *"easy way to select shared items so I can assign to my partner."* The popover felt indirect.

- [x] **R5.1 Avatar assignment row** — *(superseded by R6.6 — avatars felt "a bit weird"; replaced with a Private⇄Shared toggle + Me/Partner/Both selector)* replaced the privacy popover with a one-tap **avatar row** under the icon controls (shown only when a partner is linked): **🔒 Private (default) · 〔Me〕 · 〔Partner initial〕 · Both**. Tapping an avatar shares the item **and** assigns in a single tap (`is_public=true` + `responsible_user_id`); "Both" sets `notify_all_household`. Me = cyan, Partner = pink (matches `ResponsibleUserPicker` colors + user color coding). Removed the now-unused `ResponsibleUserPicker` import.

#### Round 6 — field-by-field micro-optimization (2026-06-07, UI-only on `MobileReminderForm`)

> User: "much better now, but i still need to optimize it." Reminder|Event toggle, input + mic kept as-is. Per-field polish below.

- [x] **R6.1 Summary chips reworked** — the under-input chips are now **clickable buttons** (tap → jump to that field's editor), **readable** (solid `bg-bg-dark/50` pill, white text — not low-contrast gradients), and **SVG-iconed, no emoji** (#4): 🗓 date → date modal, 🕐 time → date modal, 🔁 repeat → custom-recurrence picker, 📍 home/map → location panel. Chips mirror **current form state**, not just the raw parse, so edits stay in sync.
- [x] **R6.2 Date quick-pick** — removed the **"No date"** chip; **Today/Tomorrow now toggle off** when re-tapped (that *is* the clear). Added a **Pick date…** chip (opens the precise modal, shows the chosen date when custom). Removed the redundant big "Date:" display row (chips cover it).
- [x] **R6.3 Time simplified** — challenged the time-wheel default: reminders now show **fuzzy time-of-day chips** (Morning 09:00 · Noon 12:00 · Afternoon 15:00 · Evening 19:00) once a day is set, plus an **Exact…** chip → time picker. Default = **no time** (all-day; submit falls back to noon). Tap the active slot again to clear. No forced 09:00 on date pick.
- [x] **R6.4 Low priority = light grey** — `low` flag recolored `blue-400 → gray-300` (trigger + popover); flag scale now grey → cyan → orange → red.
- [x] **R6.5 Location trimmed** — removed **Place** (free-text) mode; only **At Home** + **Map link** remain. NLP location detection now only auto-sets Home (no "at [place]" capture). `locationMode` type narrowed to `"none" | "home" | "map"`.
- [x] **R6.6 Privacy = Private⇄Shared toggle** — replaced the avatar row with a clear **Private | Shared** segmented toggle; choosing **Shared defaults to "Both" responsible**, then **Me / Partner / Both** can be picked. Borders are **person-absolute** (#14): "Me" wears the active theme accent, "Partner" wears the opposite (pink↔cyan via `themeClasses.isPink`); "Both" is neutral. Removed unused `User` import; added `Clock`/`Repeat`/`Users`.
- [ ] **R6.7** *(still pending)* Visual verification on a real mobile viewport (carries R4.6). Typecheck clean; lint clean except the pre-existing `missingFieldType` unused warning.

#### Round 7 — kill the date/time modal; go inline + native (2026-06-07, UI-only on `MobileReminderForm`)

> User: (1) load animation feels laggy/not smooth, (2) "pick date → open modal → set time" is ~5 steps just for day+time, (3) the date/time modal is too confusing — date/time + alert + end date all crammed together. *"Think and challenge."* Conclusion: **the modal itself was the problem.**

- [x] **R7.1 Snappier load (#1)** — removed the chips' `AnimatePresence` **height `0→auto` animation + per-chip stagger delay** (the classic reflow jank) and the title-preview motion; chips/labels render instantly (`transition-transform` only).
- [x] **R7.2 Inline + native day/time, no modal (#2)** — replaced "Pick date…/Exact… → modal" with **native `<input type="date|time">` fields next to the presets**. One tap opens the OS picker → done (2 taps for day+time vs ~6). Presets (Today/Tomorrow, Morning/Noon/Afternoon/Evening) and the native field stay in sync (both bound to the same state); filled fields get a purple highlight.
- [x] **R7.3 Modal deleted, concerns separated (#3)** — removed the ~250-line "Set Up Your…" modal entirely. The three things it crammed together now live where they belong: **date/time = inline**, **alert = the "More" popover** (already there), **end date = an inline "Ends" row** shown only for events (clean `Starts` / `Ends` labels, native fields). Reminder→event "Add End Date" upsell dropped (use the header toggle).
- [x] **R7.4 Cleanup** — deleted dead state (`showMissingFieldsModal`, `missingFieldType`, `dateModalIntent`, `editingDateField`, `showEndDateInModal`), the `openDateModal` callback, `formatDateDisplay`/`formatTimeDisplay` helpers, and unused imports (`Clock`, `getDateDescription`, `getTimeDescription`, `parse as dateParse`). Summary chips reduced to **Repeat + Location** (date/time are self-evident inline now). `handleSubmit` event-missing path → Undo-less error toast instead of opening a modal. **Lint now fully clean** (the long-standing `missingFieldType` warning is gone with the modal).
- [ ] **R7.5** *(still pending)* Visual verification on a real mobile viewport (carries R6.7) — especially native-picker styling under each theme.

#### Round 8 — unify the reminder time control (2026-06-07, UI-only on `MobileReminderForm`)

> User screenshot: time read as **two controls** — Morning/Noon/Afternoon/Evening chips on one row, then an orphaned `03:00 PM` native pill on the next row (both looked "active"). Standing signal: *"the whole reminder feature feels too complex for its purpose."*

- [x] **R8.1 One time value, one row** — removed the standalone native time pill for reminders. The exact time is now a single trailing **clock chip** in the same chip row: shows **"Exact"** (clock icon) by default, and the **picked time** (e.g. `3:30 PM`) once set. Tapping it opens the **OS time picker** via a hidden `<input type="time">` + `showPicker()` (try/catch → `.focus()` fallback). Picking a non-preset time highlights the clock chip and **deselects the presets**, so only one time is ever shown. Re-added the `Clock` import + `dueTimeRef`.
- [ ] **R8.2** *(carries)* Real-device visual check. **Watch:** the broader *"feels too complex"* sentiment — if it persists after the user tests, the next move is reducing always-visible controls (e.g., collapse Priority/Location/More into a single progressive "+ details"), not more per-field polish.

### Phase 1b — Rule-based NL parser 🟢 _(W10 — mostly ALREADY EXISTS)_

> **⚠️ Reality correction (2026-06-06):** item NLP is **not net-new** — [src/lib/smartTextParser.ts](<../../../src/lib/smartTextParser.ts>) (1,420 lines: type, relative/absolute dates, times, RRULE recurrence, priority, categories, title extraction, confidence) already exists and is wired into the live form. This **invalidates [file 3 Part 2](<3 - Type Taxonomy & Capture Design.md>)'s original "no item NLP today" claim** (only `src/lib/nlp/`, the budget parser, was checked). Remaining 1b work is incremental, not foundational.

- [x] **1b.1** ~~Build a rule-based parser~~ *(already: `parseSmartText` in `smartTextParser.ts`)*
- [x] **1b.2** ~~Extract title + date/time~~ *(already)*
- [x] **1b.3** ~~Editable chips~~ *(already: parsed-info chips + the editable header tags)*
- [ ] **1b.4** Harden recurrence extraction — keep conservative; **gate behind Phase 4 tests** before trusting RRULE writes from text. _(M)_
- [x] **1b.5** ~~Offline-capable~~ *(already: parser is pure client-side, no network)*

### Phase 1c — Hub Chat Gemini capture 🟠 _(W11 — [file 3 §C3](<3 - Type Taxonomy & Capture Design.md>))_

> The "good test of Hub Chat." One chat line → a structured item.

- [ ] **1c.1** Wire one-line → structured item via **Gemini** ([gemini.ts](<../../../src/lib/ai/gemini.ts>)); **pass `timeoutMs`** (Hard Rule #6 — AI calls exceed the 3 s default). _(M)_
- [ ] **1c.2** Reuse/extend the Hub create path ([AddReminderFromMessageModal.tsx](<../../../src/components/hub/AddReminderFromMessageModal.tsx>) · [messageActions.ts](<../../../src/features/hub/messageActions.ts>)) — confirm chip before commit. _(M)_

### Phase 2 — Location + NFC-from-text 🟡 _(W12 — [file 3 §D1](<3 - Type Taxonomy & Capture Design.md>))_

> **Only after Phase 1 ships.** No geofencing — routed through the existing arrive/leave-home NFC trigger.

- [ ] **2.1** Parse "at home" / "when I get home" → set `location_context: "home"`. _(S)_
- [ ] **2.2** Map the phrase "home" → the user's tag via `nfc_tags.label` → attach an `nfc_state_change` prerequisite (arrive-home). _(M · [nfc-state.ts](<../../../src/lib/prerequisites/evaluators/nfc-state.ts>), [prerequisites.ts:22](<../../../src/types/prerequisites.ts#L22>))_
- [ ] **2.3** Pre-fill the existing `PrerequisitePicker` from parsed text (plumbing already wired in the form). _(S)_

### Phase 3 — Confidence & clarification UX 🟡 _([file 3 §D2](<3 - Type Taxonomy & Capture Design.md>))_

- [ ] **3.1** Lightweight **one-question** clarification for ambiguous phrases ("later" → `Tonight` / `Tomorrow` / `Pick time`); never block a simple save. _(M)_
- [ ] **3.2** Compact, on-brand chip preview — obey look-&-feel Hard Rules: `useThemeClasses()`, opaque panels via `tc.bgPage` (#15), no hardcoded colors (#10), futuristic SVG icons (#4), Undo toast (#1), `inputMode="decimal"` (#19), mobile-first (#5). _(S)_

### Phase 4 — Foundational hardening 🟠 _(the recurrence/test foundation — [file 1 weak-links](<1 - Feature State & Pain Inventory.md>) · [file 4](<4 - Recurrence & Occurrence Actions.md>))_

> This *is* the "Now" slice above, listed here for the checklist. **1b.4 depends on 4.1.**

- [x] **4.1** Recurrence + occurrence-action **unit tests** (highest-risk, untested logic). *(DONE 2026-06-19 — [dayOccurrences.test.ts](<../../../src/lib/utils/dayOccurrences.test.ts>); covers skip/complete/move + dedup, not full RRULE edge cases — those wait on Stage 2.)* **Gates 1b.4** (now partially unblocked). _(M · [file 1 Cluster 5](<1 - Feature State & Pain Inventory.md>) · [file 4 Stage 1](<4 - Recurrence & Occurrence Actions.md>))_
- [ ] **4.2** Universal placement-rule **guard test** — a forgotten skip+inject breaks flexible items everywhere. _(M)_ *(Note: a first placement-rule test shipped — see "Shipped" above; 4.2 is the broader per-view guard. The existing guard test has a known pre-existing gap against `WebTodayView.tsx` — see [file 1 Cluster 5](<1 - Feature State & Pain Inventory.md>).)*
- [x] **4.3a** Recurrence/occurrence **correctness — Stage 1** (W13) — [file 4](<4 - Recurrence & Occurrence Actions.md>) Stage 1. *(DONE 2026-06-19 — see "Now" above.)*
- [ ] **4.3b** Engine/UI unification — Stages 2–3 — [file 4](<4 - Recurrence & Occurrence Actions.md>). _(M–H)_
- [ ] **4.4** `time_window` prerequisite evaluator (one of the 4 inert) — _optional, only if a feature needs it._ _(M)_
- [ ] **4.5** Split `useItems.ts` (~2,621 LOC) — **only when a feature next forces you in**, not "just because." _(H)_

### Phase 5 — Surface consolidation & assignments 🟠 _(W9 + W8 — [file 1 Cluster 2](<1 - Feature State & Pain Inventory.md>) · [file 2 Direction](<2 - Vision, Target Design & Decisions.md>))_

> The "seven doors for one module" cleanup. Mostly decisions before code — don't delete pages ad hoc.

- [ ] **5.1** Settle the **`/reminders` role** (open question): management view ("assignments + everything still open") **or** fold into Today. *(Largely answered by the Plan My Day merge; confirm the residual long-term role.)* _(M · [file 2 Direction](<2 - Vision, Target Design & Decisions.md>))_
- [ ] **5.2** Give each surface **one job** per the [surface map](<1 - Feature State & Pain Inventory.md>) (Month / Week / Today / Form). _(M)_
- [ ] **5.3** Investigate the [MobileReminderForm.tsx](<../../../src/components/reminder/MobileReminderForm.tsx>) vs [MobileItemForm.tsx](<../../../src/components/items/MobileItemForm.tsx>) **duplication** — decide keep/merge/retire. **No deletion without a decision.** _(S · [file 3 §E](<3 - Type Taxonomy & Capture Design.md>))_
- [ ] **5.4** Reassignment **history / audit** trail — "who had it when" (W8). _(M · [file 1 Cluster 1](<1 - Feature State & Pain Inventory.md>))_
- [ ] **5.5** Form cleanup carried from the rounds: add **Undo** to success toasts (#1), remove the stray `console.error` (#22), and the real-device visual check (R8.2). _(S)_

---

## ✅ Definition of done — by slice

**Household co-edit slice** *(all done)*
- [x] A household partner can **edit and delete** a shared item (no more creator-only 403). *(2026-05-31)*
- [x] I can **pass an item to my partner** and **take it back**, each in one tap, with Undo. *(2026-06-06)*
- [x] Items I've assigned out are **visible and reclaimable** from `/reminders`. *(2026-06-06)*
- [x] `get_schedule_bundle` RPC body + all RLS policies **captured in `migrations/schema.sql`**. *(2026-06-06)*
- [x] [File 1, Cluster 1](<1 - Feature State & Pain Inventory.md>) updated to mark resolved pains; the "RLS myth" note kept as the corrected record. *(2026-06-06)*

**Recurrence/foundation slice** *(Stage 1 done 2026-06-19; Stage 2/3 + time_window still open)*
- [x] Placement rule is covered by a test that fails if a view forgets the skip+inject pattern. *(Note: this guard test has a known pre-existing gap against `WebTodayView.tsx` — [file 1 Cluster 5](<1 - Feature State & Pain Inventory.md>).)*
- [x] Skip writes `skipped` (not `cancelled`) and creates **no** duplicate; the "next occurrence" trap is gone on all four surfaces found ([file 4 acceptance test](<4 - Recurrence & Occurrence Actions.md>)). *(DONE 2026-06-19)*
- [x] Completing an occurrence on `/reminders` moves it into a hideable Completed section. *(DONE 2026-06-19)*
- [x] Recurrence expansion + occurrence actions have unit coverage for the skip/complete/move repro; `pnpm test` green for the new + touched files (one unrelated pre-existing failure in `expandOccurrences.test.ts` vs `WebTodayView.tsx`, confirmed via `git stash` to predate this session). *(DONE 2026-06-19)*
- [ ] One expansion engine + one occurrence-action sheet across all surfaces. *(Stage 2/3 — not started)*
- [ ] `time_window` prerequisite evaluates correctly and is no longer a stub.
- [x] [File 1](<1 - Feature State & Pain Inventory.md>) updated to drop the "untested"/stub notes this work closes.

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

- ⚪ **Stats redesign** — zero current payoff ([file 1 Cluster 2](<1 - Feature State & Pain Inventory.md>)).
- ⚪ **`weather` prerequisite** — lowest value-for-effort of the four evaluators.
- ⚪ **Don't redesign Month / Week / Today** — these work; touch only what a phase above names.
- ⛔ **Geofencing / fire-on-arrival location triggers** — won't build; doesn't exist, PWA, decided ([file 3 §E](<3 - Type Taxonomy & Capture Design.md>)).
- ⛔ **Reuse budget NLP wholesale** / **light up inert evaluators just for NLP coverage** — see [file 3 §E](<3 - Type Taxonomy & Capture Design.md>).

---

## How to drive this

- Point at a **line** ("do 1.3"), a **group** ("Phase 1 chips: 1.4 + 1.5"), or a **phase** ("start Phase 1").
- **Recurrence correctness Stage 1 ([file 4](<4 - Recurrence & Occurrence Actions.md>) / Phase 4.1+4.3a) shipped 2026-06-19. The current top priority is `time_window` (4.4), then Stage 2 engine unification (4.3b).**
- I'll only start **Phase 2+** after **Phase 1** ships and is verified; **1b.4** is now partially unblocked by **4.1**.
- As items complete, they get checked here **and** marked in [file 1](<1 - Feature State & Pain Inventory.md>) (Hard Rule #25 — no orphan fixes).
