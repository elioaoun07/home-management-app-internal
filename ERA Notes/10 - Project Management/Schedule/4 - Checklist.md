---
created: 2026-05-30
updated: 2026-07-13
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
> **What this file is:** the single flat, phased, checkable surface for Schedule — every open actionable item as one checkbox, grouped by phase. Completed items are cleared once done — see git history or [1 - Feature State](<1 - Feature State.md>) for the record. The narrative *why + order* is [3 · Action Plan](<3 - Action Plan.md>). **Point at a line (e.g. _1.3_), a group, or a phase.**
>
> **Legend:** Sev 🔴 blocker · 🟠 friction · 🟡 annoyance · ⚪ parked. Effort S/M/H.

---

## 🏗️ Master Build Checklist *(the flattened, checkable surface)*

> Every open item from the campaign, phased. Point at a line, a group, or a phase.

### Phase 1a — Mobile form foundation 🟠 _(W6 · the capture refactor)_

> **⚠️ Reality correction (2026-06-06):** The live mobile capture form is **[MobileReminderForm.tsx](<../../../src/components/reminder/MobileReminderForm.tsx>)** (mounted in [TabContainer.tsx](<../../../src/components/layouts/TabContainer.tsx>) under the `reminder` tab) — **not** `MobileItemForm.tsx`, which is **dead code** (zero importers; the old 5-step drawer wizard [file 3 Part 1](<2 - Vision & Roadmap.md>) described). The live form was already single-page with smart NL input, type inference, progressive disclosure, and voice — so most of 1a/1b already existed. Only **1.3, 1.4, 1.6** were genuine gaps; they shipped 2026-06-06. The dead `MobileItemForm` is parked under [5.3](#phase-5--surface-consolidation--assignments).

- [ ] **1.9** Post-ship docs: vault [Items & Reminders Overview](<../../02 - Standalone Modules/Items & Reminders/Overview.md>) updated with the new capture behaviors. Atlas/Routes unchanged (no new route/icon — edit to an existing surface). _(S)_

> **Pre-existing gaps noted, not fixed this slice (separate from 1a):** the live form's success toasts lack **Undo** (Hard Rule #1) and there's a stray `console.error` in `handleSubmit`/speech handler (Hard Rule #22), plus an unused `missingFieldType` state. Track under Phase 5 cleanup.

##### Global — retire `task` type *(deferred, cross-cutting)*

> User: "check all MD files related to Schedule + fix globally **later** … I don't want to see Task anymore." Mobile-form UI is done. **Still to do (later, separate session):** DB merge (`task` rows → `reminder` or a `kind` flag), other surfaces (`WebEventFormDialog`, `ItemDetailModal`, `ItemsListView`, web calendars, `AddReminderFromMessageModal`, filters/sub-modes), the `ItemType` union, and every Schedule MD that names "Task" ([file 3 taxonomy](<2 - Vision & Roadmap.md>), Feature Map, vault docs, Atlas). Track as a dedicated work item before touching the DB.

#### Round 3 — quick-control redesign (2026-06-06)

> Story: *"As a user I want to add a schedule item fast, without staring at a screen."* User refined R2.4: **Priority, Privacy, Location = always-visible quick controls**; **Repeat + Triggers (+ Alert, Assign) = under "+ More"**.

- [ ] **R3.5** *(not done — flagged)* Visual verification on a real mobile viewport still pending; pre-existing `missingFieldType` unused-warning + missing Undo on toasts (Hard Rule #1) + stray `console.error` (Hard Rule #22) remain for Phase 5 cleanup.

#### Round 4 — thumb-friendly quick-control redesign (2026-06-06)

> User tested R3 and disliked it: tiny text pills (bad for thumb), priority over-explained, wrong sharing default. Story reaffirmed: *add an item fast without staring at the screen.*

- [ ] **R4.6** *(still pending)* Visual verification on a real mobile viewport; the Phase 5 cleanup items (Undo on toasts #1, stray `console.error` #22, `missingFieldType` unused) still open.

#### Round 6 — field-by-field micro-optimization (2026-06-07, UI-only on `MobileReminderForm`)

> User: "much better now, but i still need to optimize it." Reminder|Event toggle, input + mic kept as-is. Per-field polish below.

- [ ] **R6.7** *(still pending)* Visual verification on a real mobile viewport (carries R4.6). Typecheck clean; lint clean except the pre-existing `missingFieldType` unused warning.

#### Round 7 — kill the date/time modal; go inline + native (2026-06-07, UI-only on `MobileReminderForm`)

> User: (1) load animation feels laggy/not smooth, (2) "pick date → open modal → set time" is ~5 steps just for day+time, (3) the date/time modal is too confusing — date/time + alert + end date all crammed together. *"Think and challenge."* Conclusion: **the modal itself was the problem.**

- [ ] **R7.5** *(still pending)* Visual verification on a real mobile viewport (carries R6.7) — especially native-picker styling under each theme.

#### Round 8 — unify the reminder time control (2026-06-07, UI-only on `MobileReminderForm`)

> User screenshot: time read as **two controls** — Morning/Noon/Afternoon/Evening chips on one row, then an orphaned `03:00 PM` native pill on the next row (both looked "active"). Standing signal: *"the whole reminder feature feels too complex for its purpose."*

- [ ] **R8.2** *(carries)* Real-device visual check. **Watch:** the broader *"feels too complex"* sentiment — if it persists after the user tests, the next move is reducing always-visible controls (e.g., collapse Priority/Location/More into a single progressive "+ details"), not more per-field polish.

### Phase 1b — Rule-based NL parser 🟢 _(W10 — mostly ALREADY EXISTS)_

> **⚠️ Reality correction (2026-06-06):** item NLP is **not net-new** — [src/lib/smartTextParser.ts](<../../../src/lib/smartTextParser.ts>) (1,420 lines: type, relative/absolute dates, times, RRULE recurrence, priority, categories, title extraction, confidence) already exists and is wired into the live form. This **invalidates [file 3 Part 2](<2 - Vision & Roadmap.md>)'s original "no item NLP today" claim** (only `src/lib/nlp/`, the budget parser, was checked). Remaining 1b work is incremental, not foundational.

- [ ] **1b.4** Harden recurrence extraction — keep conservative; **gate behind Phase 4 tests** before trusting RRULE writes from text. _(M)_

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

- [ ] **4.2** Universal placement-rule **guard test** — a forgotten skip+inject breaks flexible items everywhere. _(M)_ *(Note: a first placement-rule test shipped — see "Shipped" above; 4.2 is the broader per-view guard. The existing guard test has a known pre-existing gap against `WebTodayView.tsx` — see [file 1 Cluster 5](<1 - Feature State.md>).)*
- [ ] **4.3b** Engine/UI unification — Stages 2–3 — [file 4](<2 - Vision & Roadmap.md>). _(M–H)_
- [ ] **4.4** `time_window` prerequisite evaluator (one of the 4 inert) — _optional, only if a feature needs it._ _(M)_
- [ ] **4.5** Split `useItems.ts` (~2,621 LOC) — **only when a feature next forces you in**, not "just because." _(H)_

### Phase 5 — Surface consolidation & assignments 🟠 _(W9 + W8 — [file 1 Cluster 2](<1 - Feature State.md>) · [file 2 Direction](<2 - Vision & Roadmap.md>))_

> The "seven doors for one module" cleanup. Mostly decisions before code — don't delete pages ad hoc.

- [ ] **5.2** Give each surface **one job** per the [surface map](<1 - Feature State.md>) (Month / Week / Today / Form). _(M)_
- [ ] **5.3** Investigate the [MobileReminderForm.tsx](<../../../src/components/reminder/MobileReminderForm.tsx>) vs [MobileItemForm.tsx](<../../../src/components/items/MobileItemForm.tsx>) **duplication** — decide keep/merge/retire. **No deletion without a decision.** _(S · [file 3 §E](<2 - Vision & Roadmap.md>))_
- [ ] **5.4** Reassignment **history / audit** trail — "who had it when" (W8). _(M · [file 1 Cluster 1](<1 - Feature State.md>))_
- [ ] **5.5** Form cleanup carried from the rounds: add **Undo** to success toasts (#1), remove the stray `console.error` (#22), and the real-device visual check (R8.2). _(S)_

---

## ✅ Definition of done — by slice

**Recurrence/foundation slice** *(Stage 1 done 2026-06-19; Stage 2/3 + time_window still open)*
- [ ] One expansion engine + one occurrence-action sheet across all surfaces. *(Stage 2/3 — not started)*
- [ ] `time_window` prerequisite evaluates correctly and is no longer a stub.

---
