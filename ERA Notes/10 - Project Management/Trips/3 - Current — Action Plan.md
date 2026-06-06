---
created: 2026-05-30
updated: 2026-05-30
type: action-plan
status: active
owner: Elio
tags:
  - pm/action
  - scope/module
  - module/trips
---

# Trips · 3 — Current — Action Plan

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State — Current Reality.md>) · [2 · Future Vision](<2 - Future Vision & Roadmap.md>) · [3 · Current Action Plan](<3 - Current — Action Plan.md>)
>
> **What this file is:** the living queue of what to actually do next on Trips — **might be this week, might be later.** Not a fixed Mon–Fri grid. Re-order as priorities move; promote an item to "Now" when you pick it up.

---

## 📌 The call

**This period: verify before you build.**

Trips is 🟡 New/Thin and just committed — so the danger isn't missing features, it's that its **cascades are unverified end-to-end**. activate→complete reaches into chores, recurring pauses, one-time cancellations, meal skips, item reassignment, and account creation, and a reversal bug would silently leave the household half-travelled. The whole module sits on unverified foundations, so the first job is to prove them — not to add to them.

This is the deferred item from the global plan, surfaced to the module level: **do the manual end-to-end verify of activate/complete cascades** before any enhancement.

---

## 🎯 Candidate work (from [2 · Future Vision](<2 - Future Vision & Roadmap.md>))

| Candidate | Track | Impact | Effort | Foundation? |
|---|---|---|---|---|
| Verify activate→complete (household) | A | High | S–M | ✅ yes |
| Verify activate→complete (solo) | A | High | S–M | ✅ yes |
| Confirm `recurring_payments` NOT paused | A | High | S | ✅ yes |
| Side-effect transparency view | A | High | M | — |
| Per-cascade opt-out | A | Med | M | — |
| Trip budget rollup / post-trip summary | A/B | High | M | — |
| Cascade visibility → Schedule | B | High | M | — |
| Richer trip templates | A | Med | M | — |

---

## 🗓️ Sequenced plan

### Now — Verify the foundation (do first)

- [ ] **Manual end-to-end verify — household trip.** Activate a real household trip; confirm chores skip, recurring events pause via `recurrence_pauses`, one-time events cancel, meal plans skip, and the trip account is created. Then complete it and confirm **every** side-effect in `trip_side_effects` reverses cleanly. → [Trips / Overview](<../../03 - Junction Modules/Trips/Overview.md>).
- [ ] **Manual end-to-end verify — solo trip.** Confirm the traveler's items reassign to partner (`responsible_user_id` flip), meal planning is untouched, and completion reverses the reassignment.
- [ ] **Confirm `recurring_payments` are NOT paused** during a trip (deliberate rule — bills are still due while travelling). Guard against a future "pause everything" regression.

### Next — Make it legible

- [ ] **Side-effect transparency view.** A "trip impact" panel reading `trip_side_effects`: what this trip paused/cancelled/created/reassigned, and what completion will reverse. Doubles as a permanent verification tool.

### Later — Make it richer

- [ ] **Trip budget rollup / post-trip summary** ("this trip cost X"). _(Budget bridge)_
- [ ] **Per-cascade opt-out** (choose which cascades fire per trip).

---

## ✅ Definition of done — this period

- [ ] A household trip and a solo trip have each been activated and completed with **every** cascade verified to fire and reverse.
- [ ] Confirmed `recurring_payments` stay active during a trip.
- [ ] File 1 (Feature State) updated to drop the "cascades unverified" note once the round-trips pass.

---

## 🚫 Not now

- ❌ Don't build any enhancement (transparency view, opt-out, templates, budget rollup) before the cascade verify passes — they'd sit on unverified foundations.
- ❌ Don't change the cascade rules (e.g. start pausing `recurring_payments`) — that's a deliberate decision, not an oversight.
- ❌ Don't touch activation/completion without reading the `trip_side_effects` ledger section of the Overview first.

---

## ⏭️ Later / backlog

- Side-effect transparency / "trip impact" panel.
- Per-cascade opt-out per trip.
- Trip budget rollup + post-trip cost summary.
- Cascade visibility surfaced from the Schedule / Meal / Chores side.
- Richer template library (weekend / abroad / business) with cascade prefs.
- Trips → ERA re-entry briefing ("you're back tomorrow — N items resume").
