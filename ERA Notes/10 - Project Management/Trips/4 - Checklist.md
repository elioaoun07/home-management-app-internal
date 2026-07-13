---
created: 2026-06-20
updated: 2026-07-13
type: checklist
status: active
owner: Elio
tags:
  - pm/checklist
  - scope/module
  - module/trips
---

# Trips · 4 — Checklist

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the single flat, checkable surface for Trips — every open actionable item as one checkbox, grouped **Now / Next / Later**, each with an ID, severity, and effort. The narrative *why* is [3 · Action Plan](<3 - Action Plan.md>). Completed items are cleared once done — see git history or [1 · Feature State](<1 - Feature State.md>) for the record.
>
> **Legend:** Sev 🔴 blocker · 🟠 friction · 🟡 annoyance · ⚪ parked. Effort S/M/H. Point at a line (e.g. _N1_), a group, or a phase.

---

## ▶️ Now — Verify the foundation

- [ ] **N1** Manual end-to-end verify — **household trip.** Activate a real household trip; confirm chores skip, recurring events pause via `recurrence_pauses`, one-time events cancel, meal plans skip, and the trip account is created. Then complete it and confirm **every** side-effect in `trip_side_effects` reverses cleanly. → [Trips / Overview](<../../03 - Junction Modules/Trips/Overview.md>). _(🔴 · S–M)_
- [ ] **N2** Manual end-to-end verify — **solo trip.** Confirm the traveler's items reassign to partner (`responsible_user_id` flip), meal planning is untouched, and completion reverses the reassignment. _(🔴 · S–M)_
- [ ] **N3** Confirm `recurring_payments` are **NOT** paused during a trip (deliberate rule — bills still due while travelling); guard against a future "pause everything" regression. _(🔴 · S)_

## ⏭️ Next — Make it legible

- [ ] **X1** Side-effect transparency view — a "trip impact" panel reading `trip_side_effects`: what this trip paused/cancelled/created/reassigned, and what completion will reverse. Doubles as a permanent verification tool. _(🟠 · M)_

## 🔜 Later — Make it richer

- [ ] **L1** Trip budget rollup / post-trip summary ("this trip cost X"). _(🟡 · M)_
- [ ] **L2** Per-cascade opt-out (choose which cascades fire per trip). _(🟡 · M)_
- [ ] **L3** Cascade visibility surfaced from the Schedule / Meal / Chores side. _(🟡 · M)_
- [ ] **L4** Richer template library (weekend / abroad / business) with cascade prefs. _(⚪ · M)_
- [ ] **L5** Trips → ERA re-entry briefing ("you're back tomorrow — N items resume"). _(🟡 · M)_

---

## ✅ Definition of done — this period

- [ ] **D1** A household trip and a solo trip have each been activated and completed with **every** cascade verified to fire and reverse.
- [ ] **D2** Confirmed `recurring_payments` stay active during a trip.
- [ ] **D3** [1 · Feature State](<1 - Feature State.md>) updated to drop the "cascades unverified" note once the round-trips pass.
