---
created: 2026-05-30
updated: 2026-07-15
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
> **What this file is:** the single flat, checkable surface for Schedule — every open actionable item under **Now / Next / Later**. Grammar: [_Conventions](<../_Conventions.md>) (validated by `pnpm pm:lint`). The narrative *why + round-by-round history* lives in [3 · Action Plan](<3 - Action Plan.md>); completed items are cleared once done — see git history or [1 · Feature State](<1 - Feature State.md>) for the record.
>
> **Legend:** Sev blocker / friction / annoyance / parked. Effort S / M / L.
> **ID migration (2026-07-15):** phase IDs collapsed to `SCH-*`; the six carried "real-device check + Undo + console.error" round items (R3.5/R4.6/R6.7/R7.5/R8.2/5.5) merged into **SCH-5.5**; the "retire `task` type" note became a real item **SCH-6.1**.

---

## Now

- [ ] **SCH-4.2** (Phase 4) Universal placement-rule **guard test** — a forgotten skip+inject breaks flexible items everywhere. A first placement-rule test shipped; this is the broader per-view guard, which has a known gap against [WebTodayView.tsx](<../../../src/components/web/WebTodayView.tsx>) (see [1 · Feature State](<1 - Feature State.md>) Cluster 5). _(friction - M)_
- [ ] **SCH-4.3b** (Phase 4) Engine/UI recurrence unification — Stages 2–3 (one expansion engine + one occurrence-action sheet across all surfaces). → [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) _(friction - L)_
- [ ] **SCH-5.5** (Phase 5) Mobile-form cleanup carried from the R3–R8 rounds: add **Undo** to success toasts (Hard Rule #1), remove the stray `console.error` in the submit/speech handler (Hard Rule #22), drop the unused `missingFieldType` state, and do the real-device visual check across themes. → [MobileReminderForm.tsx](<../../../src/components/reminder/MobileReminderForm.tsx>) _(friction - S)_

> **⚠️ Reality note (2026-06-06):** the live mobile capture form is **[MobileReminderForm.tsx](<../../../src/components/reminder/MobileReminderForm.tsx>)** (mounted in TabContainer under the `reminder` tab) — **not** `MobileItemForm.tsx`, which is dead code (retire under SCH-5.3 below). Most of the old 1a/1b scope already existed; only the docs debt below remains from that slice.

- [ ] **SCH-1.9** (Phase 1a) Post-ship docs: [Items & Reminders Overview](<../../02 - Standalone Modules/Items & Reminders/Overview.md>) updated with the new capture behaviors. No new route/icon, so Atlas/Routes unchanged. _(friction - S)_

## Next

> **⚠️ Reality note (2026-06-06):** item NLP is **not** net-new — [smartTextParser.ts](<../../../src/lib/smartTextParser.ts>) (~1,420 LOC: type, dates, times, RRULE, priority, categories, confidence) already exists and is wired into the live form. Remaining 1b/1c work is incremental.

- [ ] **SCH-1b.4** (Phase 1b) Harden recurrence extraction — keep conservative; **gate behind the SCH-4.2 tests** before trusting RRULE writes from text. _(friction - M)_
- [ ] **SCH-1c.1** (Phase 1c) Wire one-line → structured item via **Gemini**; **pass `timeoutMs`** (Hard Rule #6 — AI calls exceed the 3 s default). → `src/lib/ai/gemini.ts` _(friction - M)_
- [ ] **SCH-1c.2** (Phase 1c) Reuse/extend the Hub create path ([AddReminderFromMessageModal.tsx](<../../../src/components/hub/AddReminderFromMessageModal.tsx>) · [messageActions.ts](<../../../src/features/hub/messageActions.ts>)) — confirm chip before commit. _(friction - M)_

## Later

**Phase 2 — Location + NFC-from-text** *(only after Phase 1 ships; no geofencing — routed through the existing arrive/leave-home NFC trigger)*

- [ ] **SCH-2.1** Parse "at home" / "when I get home" → set `location_context: "home"`. _(annoyance - S)_
- [ ] **SCH-2.2** Map the phrase "home" → the user's tag via `nfc_tags.label` → attach an `nfc_state_change` prerequisite (arrive-home). → `src/lib/prerequisites/evaluators/nfc-state.ts` _(annoyance - M)_
- [ ] **SCH-2.3** Pre-fill the existing `PrerequisitePicker` from parsed text (plumbing already wired in the form). _(annoyance - S)_

**Phase 3 — Confidence & clarification UX**

- [ ] **SCH-3.1** Lightweight **one-question** clarification for ambiguous phrases ("later" → Tonight / Tomorrow / Pick time); never block a simple save. _(annoyance - M)_
- [ ] **SCH-3.2** Compact, on-brand chip preview obeying the look-and-feel Hard Rules (`useThemeClasses()`, opaque panels via `tc.bgPage` #15, no hardcoded colors #10, futuristic SVG icons #4, Undo toast #1, `inputMode="decimal"` #19, mobile-first #5). _(annoyance - S)_

**Phase 4 — Foundational hardening (remainder)**

- [ ] **SCH-4.4** `time_window` prerequisite evaluator (one of the 4 inert) — optional, only if a feature needs it. _(parked - M)_
- [ ] **SCH-4.5** Split `useItems.ts` (~2,621 LOC) — only when a feature next forces you in, not "just because." _(parked - L)_

**Phase 5 — Surface consolidation & assignments** *(the "seven doors for one module" cleanup — mostly decisions before code)*

- [ ] **SCH-5.2** Give each surface **one job** per the surface map (Month / Week / Today / Form). → [1 · Feature State](<1 - Feature State.md>) _(friction - M)_
- [ ] **SCH-5.3** Investigate the [MobileReminderForm.tsx](<../../../src/components/reminder/MobileReminderForm.tsx>) vs [MobileItemForm.tsx](<../../../src/components/items/MobileItemForm.tsx>) **duplication** — decide keep/merge/retire. **No deletion without a decision.** _(friction - S)_
- [ ] **SCH-5.4** Reassignment **history / audit** trail — "who had it when" (W8). _(friction - M)_

**Phase 6 — Cross-cutting: retire the `task` type**

> User: "I don't want to see Task anymore." Deferred, cross-cutting. Still to do: DB merge (`task` rows → `reminder` or a `kind` flag), other surfaces (`WebEventFormDialog`, `ItemDetailModal`, `ItemsListView`, web calendars, `AddReminderFromMessageModal`, filters/sub-modes), the `ItemType` union, and every Schedule doc that names "Task".

- [ ] **SCH-6.1** Retire the `task` type end-to-end (DB + all surfaces + the `ItemType` union + docs). Do this as one dedicated slice before touching the DB. _(friction - L)_

## Definition of Done

- [ ] **D1** One expansion engine + one occurrence-action sheet across all surfaces (Stages 2–3 — not started; Stage 1 done 2026-06-19).
- [ ] **D2** `time_window` prerequisite evaluates correctly and is no longer a stub.
