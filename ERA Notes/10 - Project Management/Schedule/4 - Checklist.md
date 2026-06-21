---
created: 2026-05-30
updated: 2026-06-20
type: checklist
status: active
owner: Elio
tags:
  - pm/checklist
  - scope/module
  - module/schedule
---

# Schedule · 4 — Checklist

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the single flat, **phased**, checkable surface — every pending (and shipped ✅) item with IDs, severity, effort, and source links. The narrative *why + order* is [3 · Action Plan](<3 - Action Plan.md>). **Point at a line (e.g. _1.3_), a group, or a phase.**
>
> **Legend:** Sev 🔴 blocker · 🟠 friction · 🟡 annoyance · ⚪ parked. Effort S/M/H. ✅ items stay as the record (Hard Rule #25 — no orphan fixes).

---

## 🏗️ Master Build Checklist *(the flattened, checkable surface)*

> Every *pending* item from the campaign, phased. ✅ items are kept as the record. Point at a line, a group, or a phase.

### Phase 1a — Mobile form foundation 🟠 _(W6 · the capture refactor)_

> **⚠️ Reality correction (2026-06-06):** The live mobile capture form is **[MobileReminderForm.tsx](<../../../src/components/reminder/MobileReminderForm.tsx>)** (mounted in [TabContainer.tsx](<../../../src/components/layouts/TabContainer.tsx>) under the `reminder` tab) — **not** `MobileItemForm.tsx`, which is **dead code** (zero importers; the old 5-step drawer wizard [file 3 Part 1](<2 - Vision & Roadmap.md>) described). The live form was already single-page with smart NL input, type inference, progressive disclosure, and voice — so most of 1a/1b already existed. Only **1.3, 1.4, 1.6** were genuine gaps; they shipped 2026-06-06. The dead `MobileItemForm` is parked under [5.3](#phase-5--surface-consolidation--assignments).

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

> User: "check all MD files related to Schedule + fix globally **later** … I don't want to see Task anymore." Mobile-form UI is done (R2.1). **Still to do (later, separate session):** DB merge (`task` rows → `reminder` or a `kind` flag), other surfaces (`WebEventFormDialog`, `ItemDetailModal`, `ItemsListView`, web calendars, `AddReminderFromMessageModal`, filters/sub-modes), the `ItemType` union, and every Schedule MD that names "Task" ([file 3 taxonomy](<2 - Vision & Roadmap.md>), Feature Map, vault docs, Atlas). Track as a dedicated work item before touching the DB.

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

> **⚠️ Reality correction (2026-06-06):** item NLP is **not net-new** — [src/lib/smartTextParser.ts](<../../../src/lib/smartTextParser.ts>) (1,420 lines: type, relative/absolute dates, times, RRULE recurrence, priority, categories, title extraction, confidence) already exists and is wired into the live form. This **invalidates [file 3 Part 2](<2 - Vision & Roadmap.md>)'s original "no item NLP today" claim** (only `src/lib/nlp/`, the budget parser, was checked). Remaining 1b work is incremental, not foundational.

- [x] **1b.1** ~~Build a rule-based parser~~ *(already: `parseSmartText` in `smartTextParser.ts`)*
- [x] **1b.2** ~~Extract title + date/time~~ *(already)*
- [x] **1b.3** ~~Editable chips~~ *(already: parsed-info chips + the editable header tags)*
- [ ] **1b.4** Harden recurrence extraction — keep conservative; **gate behind Phase 4 tests** before trusting RRULE writes from text. _(M)_
- [x] **1b.5** ~~Offline-capable~~ *(already: parser is pure client-side, no network)*

### Phase 1c — Hub Chat Gemini capture 🟠 _(W11 — [file 3 §C3](<2 - Vision & Roadmap.md>))_

> The "good test of Hub Chat." One chat line → a structured item.

- [ ] **1c.1** Wire one-line → structured item via **Gemini** ([gemini.ts](<../../../src/lib/ai/gemini.ts>)); **pass `timeoutMs`** (Hard Rule #6 — AI calls exceed the 3 s default). _(M)_
- [ ] **1c.2** Reuse/extend the Hub create path ([AddReminderFromMessageModal.tsx](<../../../src/components/hub/AddReminderFromMessageModal.tsx>) · [messageActions.ts](<../../../src/features/hub/messageActions.ts>)) — confirm chip before commit. _(M)_

### Phase 2 — Location + NFC-from-text 🟡 _(W12 — [file 3 §D1](<2 - Vision & Roadmap.md>))_

> **Only after Phase 1 ships.** No geofencing — routed through the existing arrive/leave-home NFC trigger.

- [ ] **2.1** Parse "at home" / "when I get home" → set `location_context: "home"`. _(S)_
- [ ] **2.2** Map the phrase "home" → the user's tag via `nfc_tags.label` → attach an `nfc_state_change` prerequisite (arrive-home). _(M · [nfc-state.ts](<../../../src/lib/prerequisites/evaluators/nfc-state.ts>), [prerequisites.ts:22](<../../../src/types/prerequisites.ts#L22>))_
- [ ] **2.3** Pre-fill the existing `PrerequisitePicker` from parsed text (plumbing already wired in the form). _(S)_

### Phase 3 — Confidence & clarification UX 🟡 _([file 3 §D2](<2 - Vision & Roadmap.md>))_

- [ ] **3.1** Lightweight **one-question** clarification for ambiguous phrases ("later" → `Tonight` / `Tomorrow` / `Pick time`); never block a simple save. _(M)_
- [ ] **3.2** Compact, on-brand chip preview — obey look-&-feel Hard Rules: `useThemeClasses()`, opaque panels via `tc.bgPage` (#15), no hardcoded colors (#10), futuristic SVG icons (#4), Undo toast (#1), `inputMode="decimal"` (#19), mobile-first (#5). _(S)_

### Phase 4 — Foundational hardening 🟠 _(the recurrence/test foundation — [file 1 weak-links](<1 - Feature State.md>) · [file 4](<2 - Vision & Roadmap.md>))_

> This *is* the "Now" slice above, listed here for the checklist. **1b.4 depends on 4.1.**

- [x] **4.1** Recurrence + occurrence-action **unit tests** (highest-risk, untested logic). *(DONE 2026-06-19 — [dayOccurrences.test.ts](<../../../src/lib/utils/dayOccurrences.test.ts>); covers skip/complete/move + dedup, not full RRULE edge cases — those wait on Stage 2.)* **Gates 1b.4** (now partially unblocked). _(M · [file 1 Cluster 5](<1 - Feature State.md>) · [file 4 Stage 1](<2 - Vision & Roadmap.md>))_
- [ ] **4.2** Universal placement-rule **guard test** — a forgotten skip+inject breaks flexible items everywhere. _(M)_ *(Note: a first placement-rule test shipped — see "Shipped" above; 4.2 is the broader per-view guard. The existing guard test has a known pre-existing gap against `WebTodayView.tsx` — see [file 1 Cluster 5](<1 - Feature State.md>).)*
- [x] **4.3a** Recurrence/occurrence **correctness — Stage 1** (W13) — [file 4](<2 - Vision & Roadmap.md>) Stage 1. *(DONE 2026-06-19 — see "Now" above.)*
- [ ] **4.3b** Engine/UI unification — Stages 2–3 — [file 4](<2 - Vision & Roadmap.md>). _(M–H)_
- [ ] **4.4** `time_window` prerequisite evaluator (one of the 4 inert) — _optional, only if a feature needs it._ _(M)_
- [ ] **4.5** Split `useItems.ts` (~2,621 LOC) — **only when a feature next forces you in**, not "just because." _(H)_

### Phase 5 — Surface consolidation & assignments 🟠 _(W9 + W8 — [file 1 Cluster 2](<1 - Feature State.md>) · [file 2 Direction](<2 - Vision & Roadmap.md>))_

> The "seven doors for one module" cleanup. Mostly decisions before code — don't delete pages ad hoc.

- [x] **5.1** Settle the **`/reminders` role** *(IMPLEMENTED 2026-06-19)*: `Focus` is selected-day planning/open work; `Assign` is mobile flexible catalogue routine assignment; Schedule Insights moved to `/dashboard`. _(M · [file 2 Direction](<2 - Vision & Roadmap.md>))_
- [x] **5.1a** Correct mobile Assign scope *(IMPLEMENTED 2026-06-19)*: Assign is catalogue-first, listing flexible task templates not yet planned for the selected period and adding one selected day/time slot, matching the Web Week calendar flow. _(S · [file 2 Direction](<2 - Vision & Roadmap.md>))_
- [ ] **5.2** Give each surface **one job** per the [surface map](<1 - Feature State.md>) (Month / Week / Today / Form). _(M)_
- [ ] **5.3** Investigate the [MobileReminderForm.tsx](<../../../src/components/reminder/MobileReminderForm.tsx>) vs [MobileItemForm.tsx](<../../../src/components/items/MobileItemForm.tsx>) **duplication** — decide keep/merge/retire. **No deletion without a decision.** _(S · [file 3 §E](<2 - Vision & Roadmap.md>))_
- [ ] **5.4** Reassignment **history / audit** trail — "who had it when" (W8). _(M · [file 1 Cluster 1](<1 - Feature State.md>))_
- [ ] **5.5** Form cleanup carried from the rounds: add **Undo** to success toasts (#1), remove the stray `console.error` (#22), and the real-device visual check (R8.2). _(S)_

---

## ✅ Definition of done — by slice

**Household co-edit slice** *(all done)*
- [x] A household partner can **edit and delete** a shared item (no more creator-only 403). *(2026-05-31)*
- [x] I can **pass an item to my partner** and **take it back**, each in one tap, with Undo. *(2026-06-06)*
- [x] Items I've assigned out are **visible and reclaimable** from `/reminders`. *(2026-06-06)*
- [x] `get_schedule_bundle` RPC body + all RLS policies **captured in `migrations/schema.sql`**. *(2026-06-06)*
- [x] [File 1, Cluster 1](<1 - Feature State.md>) updated to mark resolved pains; the "RLS myth" note kept as the corrected record. *(2026-06-06)*

**Recurrence/foundation slice** *(Stage 1 done 2026-06-19; Stage 2/3 + time_window still open)*
- [x] Placement rule is covered by a test that fails if a view forgets the skip+inject pattern. *(Note: this guard test has a known pre-existing gap against `WebTodayView.tsx` — [file 1 Cluster 5](<1 - Feature State.md>).)*
- [x] Skip writes `skipped` (not `cancelled`) and creates **no** duplicate; the "next occurrence" trap is gone on all four surfaces found ([file 4 acceptance test](<2 - Vision & Roadmap.md>)). *(DONE 2026-06-19)*
- [x] Completing an occurrence on `/reminders` moves it into a hideable Completed section. *(DONE 2026-06-19)*
- [x] Recurrence expansion + occurrence actions have unit coverage for the skip/complete/move repro; `pnpm test` green for the new + touched files (one unrelated pre-existing failure in `expandOccurrences.test.ts` vs `WebTodayView.tsx`, confirmed via `git stash` to predate this session). *(DONE 2026-06-19)*
- [ ] One expansion engine + one occurrence-action sheet across all surfaces. *(Stage 2/3 — not started)*
- [ ] `time_window` prerequisite evaluates correctly and is no longer a stub.
- [x] [File 1](<1 - Feature State.md>) updated to drop the "untested"/stub notes this work closes.
- [x] Occurrence-action writes (complete/postpone/cancel/skip) are idempotent — re-completing/replaying no longer 500s or retries forever. *(DONE 2026-06-21 — [file 1 Cluster 5](<1 - Feature State.md>), [file 2 Decision 4](<2 - Vision & Roadmap.md>))*
- [x] "Responsible:" badge always shows the real `responsible_user_id`, never replaced by the "All Household" notify flag. *(DONE 2026-06-21 — [file 1 Cluster 1](<1 - Feature State.md>), [file 2 Decision 4](<2 - Vision & Roadmap.md>))*
- [x] A completed occurrence shows its green strikethrough **whenever it is visible, at any age** — `useAllOccurrenceActions` no longer drops completion state older than 30 days, so a 2-month-old completed occurrence no longer re-renders as an active, un-done event across all 11 schedule surfaces. *(DONE 2026-06-21 — [file 1 Cluster 5](<1 - Feature State.md>))*

---
