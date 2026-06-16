---
created: 2026-05-30
updated: 2026-06-16
type: action-plan
status: active
owner: Elio
tags:
  - pm/action
  - scope/module
  - module/schedule
---

# Schedule · 3 — Current — Action Plan

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State — Current Reality.md>) · [2 · Future Vision](<2 - Future Vision & Roadmap.md>) · [3 · Current Action Plan](<3 - Current — Action Plan.md>)
>
> **What this file is:** the living queue of what to actually do next on Schedule — **might be this week, might be later.** Not a fixed Mon–Fri grid. Re-order as priorities move; promote an item to "Now" when you pick it up.

---

## 📌 The call

**This period: plan the enhancement work, foundation-first.**

Schedule is 🟢 Core and stable, so the danger isn't missing features — it's that its **trickiest logic (recurrence + occurrence actions + the flexible placement rule) is untested**, and four prerequisite evaluators are advertised but inert. Before building enhancements that touch views or bridges, lock the foundation. Then ship the one stub with the best value-for-effort, then make ERA read the time graph.

This mirrors the global theme ("Stabilize, then Connect") at the module level: harden the recurrence core, then connect Schedule outward.

> **Shipped ad-hoc, outside this sequence:** "Plan My Day" (`/today`) — a disrupted-day triage planner (push off / both-direction prepone / ad-hoc tasks / checkpoints), shipped 2026-06-16. Phase 1 only — hourly timeline + mood/energy optimizer deferred. See [2 · Future Vision](<2 - Future Vision & Roadmap.md>) Track A and [Plan My Day Overview](<../../03 - Junction Modules/Plan My Day/Overview.md>). Doesn't change the foundation-first call above.
>
> - [x] **Fixed 2026-06-16:** the day-plan header (title/intent/notes/Private-Shared) and checkpoints were firing a full API call on every keystroke/click — worst case a `POST` per Private/Shared toggle. Replaced with a save-gated draft model: an unplanned day shows an editable form with one **Save**; a planned day shows a read-only **preview card** with **Edit**/**Delete**. No API calls during editing, only on Save/Delete (checkpoint done/undone toggle stays live by design). See [Plan My Day Overview](<../../03 - Junction Modules/Plan My Day/Overview.md>) "The save-gated draft model."

---

## 🎯 Candidate work (from [2 · Future Vision](<2 - Future Vision & Roadmap.md>))

| Candidate | Track | Impact | Effort | Foundation? |
|---|---|---|---|---|
| Placement-rule guard test | A | High | S | ✅ yes |
| Recurrence / occurrence-action unit tests | A | High | M | ✅ yes |
| `time_window` prerequisite evaluator | A | High | S–M | — |
| Schedule → briefing enrichment | B | High | M | — |
| Schedule ↔ Budget due-date unify | B | High | H | — |
| Recurrence edit UX ("this / this-and-future / all") | A | Med | M | — |
| Bulk occurrence ops | A | Med | M | — |
| `schedule` / `custom_formula` prerequisites | A | Med | M each | — |

---

## 🗓️ Sequenced plan

### Now — Foundation (do first)

- [x] **Placement-rule guard test.** One test that asserts a flexible item is *not* placed via rrule and *is* placed from `item_flexible_schedules`. Prevents the whole "flexible item shows on activation day" class of bug across all 6+ views. → see [Schedule Feature](<../../02 - Standalone Modules/Items & Reminders/Schedule Feature.md>) "Adding a New View" checklist.
- [ ] **Recurrence + occurrence-action unit tests.** Cover RRULE expansion against `start_anchor`, exception/skip (`item_recurrence_exceptions`), and per-occurrence complete/postpone/cancel (`item_occurrence_actions`). Pure-logic where possible (extract like `lib/recurring.ts` did) so no Supabase mocks are needed.

### Next — First enhancement

- [ ] **Ship `time_window` prerequisite.** Smallest stub, highest demo value (meds/morning windows). Proves the conditional-automation engine end-to-end before tackling `schedule` / `custom_formula`.

### Later — Connect outward

- [ ] **Schedule → briefing enrichment** (feed the full week's shape into Focus/ERA). _(global Track B)_
- [ ] **Schedule ↔ Budget due-date unify** — bigger; scope it after the foundation tests exist. _(global Track A / Cashflow)_

---

## ✅ Definition of done — this period

- [x] Placement rule is covered by a test that fails if a view forgets the skip+inject pattern.
- [ ] Recurrence expansion + occurrence actions have unit coverage; `pnpm test` green.
- [ ] `time_window` prerequisite evaluates correctly and is no longer a stub.
- [ ] File 1 (Feature State) updated to drop the "untested" / stub notes that this work closes.

---

## 🚫 Not now

- ❌ Don't refactor `useItems.ts` (~2,621 LOC) "just because" — only when you next touch it for a feature.
- ❌ Don't start `weather` prerequisite (lowest value-for-effort of the four).
- ❌ Don't open the Schedule↔Budget bridge before the recurrence tests exist — a silent bridge bug would hide exactly there.

---

## ⏭️ Later / backlog

- Recurrence edit UX (this / this-and-future / all).
- Bulk occurrence operations (multi-select complete/postpone/reschedule).
- Smarter overdue handling (roll-forward suggestions, overdue triage view).
- Natural-language item entry (full rrule + alert from one line).
- `schedule` and `custom_formula` prerequisite evaluators.
- Smart alert timing + quiet hours + weekly digest. _(global Track B 7a/7b)_
- Debt → Schedule auto-reminder on collection date. _(global Track A 2e)_
- Trips → Schedule cascade visibility.
