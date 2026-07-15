---
created: 2026-06-20
updated: 2026-07-15
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
> **What this file is:** the single flat, checkable surface for Trips — every open actionable item under **Now / Next / Later**. Grammar: [_Conventions](<../_Conventions.md>) (validated by `pnpm pm:lint`). The narrative *why* is [3 · Action Plan](<3 - Action Plan.md>). Completed items are cleared once done — see git history or [1 · Feature State](<1 - Feature State.md>) for the record.
>
> **Legend:** Sev blocker / friction / annoyance / parked. Effort S / M / L.
> **ID migration (2026-07-15):** N1–N3→TRIP-1–TRIP-3, X1→TRIP-4, L1–L5→TRIP-5–TRIP-9.

---

## Now

- [ ] **TRIP-1** Manual end-to-end verify — **household trip.** Activate a real household trip; confirm chores skip, recurring events pause via `recurrence_pauses`, one-time events cancel, meal plans skip, and the trip account is created. Then complete it and confirm **every** side-effect in `trip_side_effects` reverses cleanly. → [Trips / Overview](<../../03 - Junction Modules/Trips/Overview.md>) _(blocker - M)_
- [ ] **TRIP-2** Manual end-to-end verify — **solo trip.** Confirm the traveler's items reassign to partner (`responsible_user_id` flip), meal planning is untouched, and completion reverses the reassignment. _(blocker - M)_
- [ ] **TRIP-3** Confirm `recurring_payments` are **NOT** paused during a trip (deliberate rule — bills still due while travelling); guard against a future "pause everything" regression. _(blocker - S)_

## Next

- [ ] **TRIP-4** Side-effect transparency view — a "trip impact" panel reading `trip_side_effects`: what this trip paused/cancelled/created/reassigned, and what completion will reverse. Doubles as a permanent verification tool. _(friction - M)_

## Later

- [ ] **TRIP-5** Trip budget rollup / post-trip summary ("this trip cost X"). _(annoyance - M)_
- [ ] **TRIP-6** Per-cascade opt-out (choose which cascades fire per trip). _(annoyance - M)_
- [ ] **TRIP-7** Cascade visibility surfaced from the Schedule / Meal / Chores side. _(annoyance - M)_
- [ ] **TRIP-8** Richer template library (weekend / abroad / business) with cascade prefs. _(parked - M)_
- [ ] **TRIP-9** Trips → ERA re-entry briefing ("you're back tomorrow — N items resume"). _(annoyance - M)_

## Definition of Done

- [ ] **D1** A household trip and a solo trip have each been activated and completed with **every** cascade verified to fire and reverse.
- [ ] **D2** Confirmed `recurring_payments` stay active during a trip.
- [ ] **D3** [1 · Feature State](<1 - Feature State.md>) updated to drop the "cascades unverified" note once the round-trips pass.
