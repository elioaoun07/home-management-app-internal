---
created: 2026-09-10
updated: 2026-09-10
type: checklist
status: active
owner: Elio
---

# Schedule — Checklist

[Master Book](<Schedule — Master Book.md>) · [All campaigns](<../_index.md>) · [Grammar](<../_Conventions.md>)

One checkbox per outcome. Follow the ID link for acceptance, dependencies, holds and its **Reading guide** (where to start in the code). Lane order is priority, not authorization; owner evidence and policy gates still apply.

## Now

- [ ] **SCH-4.2** Verify cross-view recurrence placement — [criteria](<Schedule — Master Book.md#sch-42>) _(friction - M)_
- [ ] **SCH-4.3b** Unify recurrence expansion and occurrence actions — [criteria](<Schedule — Master Book.md#sch-43b>) _(friction - L)_
- [ ] **SCH-7** Refuse unsupported recurrence before capture — [criteria](<Schedule — Master Book.md#sch-7>) _(blocker - S)_

## Next

- [ ] **SCH-5.5** Finish mobile reminder form cleanup and verification — [criteria](<Schedule — Master Book.md#sch-55>) _(friction - S)_
- [ ] **SCH-1.9** Document the shipped capture behavior — [criteria](<Schedule — Master Book.md#sch-19>) _(friction - S)_
- [ ] **SCH-1b.4** Harden conservative recurrence extraction — [criteria](<Schedule — Master Book.md#sch-1b4>) _(friction - M)_
- [ ] **SCH-1c.1** Parse one-line items through Gemini safely — [criteria](<Schedule — Master Book.md#sch-1c1>) _(friction - M)_
- [ ] **SCH-1c.2** Reuse Hub reminder creation with confirmation — [criteria](<Schedule — Master Book.md#sch-1c2>) _(friction - M)_
- [ ] **SCH-8** Unify canonical agenda consumer semantics — [criteria](<Schedule — Master Book.md#sch-8>) _(friction - M)_
- [ ] **SCH-9** Give online and replayed reminders equal alert semantics — [criteria](<Schedule — Master Book.md#sch-9>) _(friction - M)_
- [ ] **SCH-10** Verify prerequisite access against current RLS — [criteria](<Schedule — Master Book.md#sch-10>) _(friction - M)_
- [ ] **SCH-14** Preserve occurrence identity through every action — [criteria](<Schedule — Master Book.md#sch-14>) _(friction - M)_

## Later

- [ ] **SCH-2.1** Parse "at home" / "when I get home" — [criteria](<Schedule — Master Book.md#sch-21>) _(annoyance - S)_
- [ ] **SCH-2.2** Map the phrase "home" — [criteria](<Schedule — Master Book.md#sch-22>) _(annoyance - M)_
- [ ] **SCH-2.3** Pre-fill the existing `PrerequisitePicker` from parsed text (plumbing already wired in the form) — [criteria](<Schedule — Master Book.md#sch-23>) _(annoyance - S)_
- [ ] **SCH-3.1** Lightweight **one-question** clarification for ambiguous phrases ("later" — [criteria](<Schedule — Master Book.md#sch-31>) _(annoyance - M)_
- [ ] **SCH-3.2** Compact, on-brand chip preview obeying the look-and-feel Hard Rules (`useThemeClasses()`, opaque panels via `tc.bgPage` #15, no hardcoded colors #10,… — [criteria](<Schedule — Master Book.md#sch-32>) _(annoyance - S)_
- [ ] **SCH-4.4** `time_window` prerequisite evaluator (one of the 4 inert) — [criteria](<Schedule — Master Book.md#sch-44>) _(parked - M)_
- [ ] **SCH-4.5** Split `useItems.ts` (~2,621 LOC) — [criteria](<Schedule — Master Book.md#sch-45>) _(parked - L)_
- [ ] **SCH-5.2** Give each surface **one job** per the surface map (Month / Week / Today / Form) — [criteria](<Schedule — Master Book.md#sch-52>) _(friction - M)_
- [ ] **SCH-5.3** Investigate the [MobileReminderForm.tsx](<../../../src/components/reminder/MobileReminderForm.tsx>) vs… — [criteria](<Schedule — Master Book.md#sch-53>) _(friction - S)_
- [ ] **SCH-5.4** Reassignment **history / audit** trail — [criteria](<Schedule — Master Book.md#sch-54>) _(friction - M)_
- [ ] **SCH-6.1** Retire the task type across storage and surfaces — [criteria](<Schedule — Master Book.md#sch-61>) _(friction - L)_
- [ ] **SCH-11** Audit the arrive and leave NFC experience — [criteria](<Schedule — Master Book.md#sch-11>) _(friction - M)_
- [ ] **SCH-12** Separate estimated and observed schedule duration — [criteria](<Schedule — Master Book.md#sch-12>) _(friction - M)_
- [ ] **SCH-13** Project canonical recurrence into Google Calendar — [criteria](<Schedule — Master Book.md#sch-13>) _(friction - M)_
- [ ] **SCH-15** Activate reusable definitions atomically — [criteria](<Schedule — Master Book.md#sch-15>) _(friction - M)_
- [ ] **SCH-16** Promote definitions without rewriting executions — [criteria](<Schedule — Master Book.md#sch-16>) _(friction - M)_
- [ ] **SCH-17** Pause, stop and resume one activation coherently — [criteria](<Schedule — Master Book.md#sch-17>) _(friction - M)_
- [ ] **SCH-18** Apply reusable defaults only to future work — [criteria](<Schedule — Master Book.md#sch-18>) _(friction - M)_
- [ ] **SCH-19** Offer explicit updates to future activations — [criteria](<Schedule — Master Book.md#sch-19>) _(friction - M)_
