---
created: 2026-09-10
updated: 2026-11-11
type: checklist
status: active
owner: Elio
---

# Schedule — Checklist

[Master Book](<Schedule — Master Book.md>) · [All campaigns](<../_index.md>) · [Grammar](<../_Conventions.md>)

**Now** is this week's sprint. **Next** is the ordered queue. **Later** is parked or conditional. Each ID links to its acceptance. Finish one with `pnpm pm:ship <ID>`.

## Now

## Next

**Recurrence correctness**

- [ ] **SCH-7** Refuse unsupported recurrence before capture — [criteria](<Schedule — Master Book.md#sch-7>) _(blocker - S)_
- [ ] **SCH-4.2** Verify cross-view recurrence placement — [criteria](<Schedule — Master Book.md#sch-42>) _(friction - M)_
- [ ] **SCH-4.3b** Unify recurrence expansion and occurrence actions — [criteria](<Schedule — Master Book.md#sch-43b>) _(friction - L)_
- [ ] **SCH-14** Preserve occurrence identity through every action — [criteria](<Schedule — Master Book.md#sch-14>) _(friction - M)_
- [ ] **SCH-8** Unify canonical agenda consumer semantics — [criteria](<Schedule — Master Book.md#sch-8>) _(friction - M)_
- [ ] **SCH-9** Give online and replayed reminders equal alert semantics — [criteria](<Schedule — Master Book.md#sch-9>) _(friction - M)_

**Capture**

- [ ] **SCH-1b.4** Harden conservative recurrence extraction — [criteria](<Schedule — Master Book.md#sch-1b4>) _(friction - M)_
- [ ] **SCH-1c.1** Parse one-line items through Gemini safely — [criteria](<Schedule — Master Book.md#sch-1c1>) _(friction - M)_
- [ ] **SCH-1c.2** Reuse Hub reminder creation with confirmation — [criteria](<Schedule — Master Book.md#sch-1c2>) _(friction - M)_
- [ ] **SCH-1.9** Document the shipped capture behavior — [criteria](<Schedule — Master Book.md#sch-19>) _(friction - S)_

**Forms and access**

- [ ] **SCH-5.5** Finish mobile reminder form cleanup and verification — [criteria](<Schedule — Master Book.md#sch-55>) _(friction - S)_
- [ ] **SCH-10** Verify prerequisite access against current RLS — [criteria](<Schedule — Master Book.md#sch-10>) _(friction - M)_

## Later

**Natural-language capture**

- [ ] **SCH-2.1** Parse "at home" and "when I get home" — [criteria](<Schedule — Master Book.md#sch-21>) _(annoyance - S)_
- [ ] **SCH-2.2** Map "home" to the user's NFC tag as an arrive-home prerequisite — [criteria](<Schedule — Master Book.md#sch-22>) _(annoyance - M)_
- [ ] **SCH-2.3** Pre-fill the prerequisite picker from parsed text — [criteria](<Schedule — Master Book.md#sch-23>) _(annoyance - S)_
- [ ] **SCH-3.1** Ask one clarifying question for ambiguous times — [criteria](<Schedule — Master Book.md#sch-31>) _(annoyance - M)_
- [ ] **SCH-3.2** Show a compact chip preview of the parsed item — [criteria](<Schedule — Master Book.md#sch-32>) _(annoyance - S)_

**Surfaces and cleanup**

- [ ] **SCH-5.2** Give each surface one job (Month / Week / Today / Form) — [criteria](<Schedule — Master Book.md#sch-52>) _(friction - M)_
- [ ] **SCH-5.3** Decide the MobileReminderForm and MobileItemForm duplication — [criteria](<Schedule — Master Book.md#sch-53>) _(friction - S)_
- [ ] **SCH-5.4** Keep a reassignment history — [criteria](<Schedule — Master Book.md#sch-54>) _(friction - M)_
- [ ] **SCH-6.1** Retire the task type across storage and surfaces — [criteria](<Schedule — Master Book.md#sch-61>) _(friction - L)_
- [ ] **SCH-28** Measure chore Unassign latency with 5 and 50 mocked assignments — [criteria](<Schedule — Master Book.md#sch-28>) _(annoyance - M)_
- [ ] **SCH-11** Audit the arrive and leave NFC experience — [criteria](<Schedule — Master Book.md#sch-11>) _(friction - M)_
- [ ] **SCH-12** Separate estimated and observed schedule duration — [criteria](<Schedule — Master Book.md#sch-12>) _(friction - M)_

**Calendar and reusable definitions**

- [ ] **SCH-13** Project canonical recurrence into Google Calendar — [criteria](<Schedule — Master Book.md#sch-13>) _(friction - M)_
- [ ] **SCH-15** Activate reusable definitions atomically — [criteria](<Schedule — Master Book.md#sch-15>) _(friction - M)_
- [ ] **SCH-16** Promote definitions without rewriting executions — [criteria](<Schedule — Master Book.md#sch-16>) _(friction - M)_
- [ ] **SCH-17** Pause, stop and resume one activation coherently — [criteria](<Schedule — Master Book.md#sch-17>) _(friction - M)_
- [ ] **SCH-18** Apply reusable defaults only to future work — [criteria](<Schedule — Master Book.md#sch-18>) _(friction - M)_
- [ ] **SCH-19** Offer explicit updates to future activations — [criteria](<Schedule — Master Book.md#sch-19-1>) _(friction - M)_

**Parked**

- [ ] **SCH-4.4** Add the time-window prerequisite evaluator (only if a feature needs it) — [criteria](<Schedule — Master Book.md#sch-44>) _(parked - M)_
- [ ] **SCH-4.5** Split the items hook into smaller units — [criteria](<Schedule — Master Book.md#sch-45>) _(parked - L)_
- [ ] **SCH-21** Move Chores off direct Items hook imports — [criteria](<Schedule — Master Book.md#sch-21-1>) _(parked - L)_
