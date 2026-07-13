---
created: 2026-05-29
updated: 2026-07-13
type: weekly-plan
status: active
owner: Elio
week_of: 2026-06-01
tags:
  - pm/weekly
  - scope/cross-cutting
---

# 4 · This Week — Action Plan

> **Command Center:** [1 · Setup Audit](<1 - Codebase & AI Setup Audit.md>) · [2 · Feature State](<2 - Feature State — Current Reality.md>) · [3 · Future Vision](<3 - Future Vision & Roadmap.md>) · [4 · This Week](<4 - This Week (Action Plan).md>)
>
> **Week of Mon 1 Jun → Sun 7 Jun 2026** (drafted Fri 29 May, updated Sat 30 May). This is the synthesis of files 1–3 into "what I actually do next." Re-draft this file each week.

---

## 📌 The call

**Theme: "Stabilize, then Connect."**

You are not short of features — you're short of a _safety net_ and _documentation that matches your code_ (file 1). Shipping module #41 onto zero tests + drifted AI rules is the real risk. This week pivots toward **planning the Schedule (Items & Reminders) module enhancements** via a new per-module PM set, while the foundation work continues. Three items are **deferred** (Trips verify, console sweep, Inventory→Shopping bridge).

**Non-negotiable this week:** ~~verify Trips end-to-end~~ `[skipped — deferred]`. **This week's real focus → plan Schedule-module enhancements** (per-module PM now lives in [Schedule/](<Schedule/_index.md>)).

---

## 🟢 This weekend (29–31 May) — pre-flight status

- [ ] Skim files 1–3 so the week's plan makes sense.

---

## 🗓️ Day by day

### Mon — Lock down what's already built

- `[skipped — deferred]` ~~**Verify Trips end-to-end** (manual): create → activate (auto-account + schedule side-effects fire) → complete (RPC).~~ Deferred by choice — revisit in a later week. _Trips is a Junction touching Budget + Items + Chores — untested cascades are the scariest kind, so this is a real debt, just not this week's priority._
- **DoD:** orphan dirs gone; build green. _(Trips verify deferred.)_

### Thu — Enforce your own rules + close the doc gap

- `[skipped — deferred]` ~~**Console sweep, phase 1:** remove `console.*` from the worst offenders (`src/app/api`, `components/web`, `components/expense`).~~ Deferred — still a real debt (Hard Rule 22 / file 1 P1), just not this week. _(Don't enable the `no-console` lint rule until the sweep happens or it blocks every commit.)_
- **DoD:** 5 docs exist and are linked. _(Console sweep deferred.)_

### Fri — Plan Schedule enhancements + wrap

- `[skipped — deferred]` ~~**Ship Track A bridge #1: Inventory → Shopping List.**~~ Deferred to a later week. _(still on the global roadmap — file 3 / backlog 2a)_
- [ ] **Plan the Schedule (Items & Reminders) module enhancements.** Stand up the per-module PM set in [Schedule/](<Schedule/_index.md>) — Feature State, Roadmap, Action Plan — and sequence the foundation-first work (placement-rule test → recurrence tests → `time_window` prerequisite). → [Schedule/4 · Checklist](<Schedule/4 - Checklist.md>)
- [ ] Re-draft this file for next week (carry-over below).
- **DoD:** Schedule PM folder exists and its Action Plan has a sequenced "Now/Next/Later" queue.

---

## ✅ Definition of done — the week

- `[deferred]` ~~Trips **verified** through full activate/complete lifecycle.~~
- `[deferred]` ~~Console count materially down in the 3 worst dirs.~~
- `[deferred]` ~~One Track-A bridge shipped.~~
- [ ] Schedule per-module PM set created + sequenced.

---

## 🚫 Explicitly NOT this week

- ❌ No new module (Cashflow Forecast, Subscriptions, etc.) — that's _after_ the net exists. _(file 3)_
- ❌ Don't enable `no-console` as an ESLint **error** yet (sweep isn't finished → would block commits).
- ❌ Don't refactor `HubPage.tsx` / `MobileExpenseForm` "just because" — only when you next touch them.
- ❌ Don't chase the 522 `any`s — add a _warning_ later and chip away passively.

---

## ⏭️ Carry-over / next week preview

- **Deferred from this week** (still real debt): verify Trips lifecycle; console sweep phase 1 → then flip on `no-console` ESLint rule; Inventory→Shopping bridge (Track A #1).
- Execute the Schedule module plan — foundation-first: placement-rule test → recurrence/occurrence tests → `time_window` prerequisite. _(see [Schedule/4 · Checklist](<Schedule/4 - Checklist.md>))_
- Track A bridges #2–#4: Recipe↔Inventory, Recurring→Budget, Debt→Reminder. _(file 3 Track A)_
- Begin Track B: enrich the Focus/ERA briefing with cross-module data. _(file 3)_

---

## One-glance checklist

```
MON      [~] verify Trips lifecycle (deferred)
THU      [~] console sweep (deferred)
FRI      [~] Inventory→Shopping bridge (deferred)  [ ] plan Schedule PM  [ ] re-plan
```
