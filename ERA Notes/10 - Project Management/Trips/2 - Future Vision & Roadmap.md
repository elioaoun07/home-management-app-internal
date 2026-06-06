---
created: 2026-05-30
type: roadmap
status: living
owner: Elio
tags:
  - pm/roadmap
  - scope/module
  - module/trips
---

# Trips · 2 — Future Vision & Roadmap

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State — Current Reality.md>) · [2 · Future Vision](<2 - Future Vision & Roadmap.md>) · [3 · Current Action Plan](<3 - Current — Action Plan.md>)
>
> **What this file is:** the *ambitious* Trips file — where the module could go. Enhancements to what exists **and** richer connections to the rest of the app. This is allowed to dream; [1 · Feature State](<1 - Feature State — Current Reality.md>) is the sober reality. Ladders up to the global [3 · Future Vision](<../3 - Future Vision & Roadmap.md>).

---

## The strategic thesis

Trips is the household's **context-switch engine** — when you travel, *everything else* should adapt: chores pause, routines suspend, meals stop being planned, a dedicated budget appears, and on return it all snaps back. It's the most ambitious junction in the app because it's the only one that *reaches into every other module and reverses itself*. Its untapped value:

1. **It's the proof that the app is one graph, not many apps.** A trip rippling correctly across Budget, Schedule, Chores, and Meal is the most convincing demonstration of the household-ecosystem thesis — *if it's trustworthy*.
2. **Trust is the whole game.** Until the cascades are verified, every enhancement sits on unverified foundations. The roadmap is "make it trustworthy" → then "make it richer".

**The vision in one line:** *Turn Trips from a feature that fires cascades into a context-switch you can trust — every module adapts when you leave and restores when you return, visibly and reversibly.*

---

## Track A — Internal enhancements (within the module)

| Enhancement | Today | The dream | Effort |
|---|---|---|---|
| **Verify the cascades** | activate/complete fire but unverified end-to-end | A proven activate→complete round-trip for both household & solo, with a written test/checklist | S–M (verify) / M (automate) |
| **Side-effect transparency view** | `trip_side_effects` is internal | A "trip impact" panel: what this trip paused/cancelled/created/reassigned, and what completion will reverse | M |
| **Per-cascade opt-out** | Cascade rules are fixed (e.g. chores always skipped) | Toggle which cascades fire per trip ("pause chores but keep meal plans") | M |
| **Trip budget rollup** | Auto trip account exists | Show trip spend vs budget, and a post-trip summary ("this trip cost X") | M |
| **Richer templates** | `is_template` clone via API | Template library (weekend / abroad / business) seeding places + packing + cascade prefs | M |

---

## Track B — Bridges out of Trips (cross-module)

Trips is *all* bridges by nature — these make the existing cascades legible from the other side. Each ladders up to the global [3 · Future Vision](<../3 - Future Vision & Roadmap.md>).

- **Trips → Schedule (cascade visibility).** Make it legible from the Schedule side which items a trip paused/cancelled/created. *(global Trips row; mirror of [Schedule · 2](<../Schedule/2 - Future Vision & Roadmap.md>))*
- **Trips → Budget.** The trip account + spend feeds the money graph; surface trip cost in Analytics. *(Budget bridge)*
- **Trips → Meal Planning.** Household trips skip meal plans; make the skip visible and undo-able from the meal calendar.
- **Trips → Chores.** Skipped chores should be clearly marked "paused: travelling", not silently absent.
- **Trips → ERA briefing.** "You're back tomorrow — 3 chores and 2 routines resume" — proactive re-entry briefing. *(global Track B · briefing enrichment)*

---

## Prioritization matrix

```
  IMPACT
   ▲
H  │  Verify the cascades (A)         Side-effect transparency view (A)
   │  Cascade visibility → Schedule(B) Per-cascade opt-out (A)
   │                                  Trip budget rollup (A/B)
   ├──────────────────────────────────────────────────────────
M  │  Chores "paused: travelling" (B)  Richer templates (A)
   │  Meal-skip visibility (B)         Trips→ERA re-entry briefing (B)
   │
   ├──────────────────────────────────────────────────────────
L  │  (—)                             (—)
   │
   └──────────────────────────────────────────────────────────►
        LOW EFFORT             MED EFFORT             HIGH EFFORT
```

---

## 🎯 The bets (my recommendation)

If you point the next stretch at Trips:

1. **Bet 1 — Verify the cascades end-to-end.** Nothing else matters until activate→complete is proven for both household and solo trips, with the `trip_side_effects` log↔reverse symmetry confirmed. This is the deferred item from file 1; it's the foundation everything else stands on.
2. **Bet 2 — Side-effect transparency view.** Once verified, make it *visible*: a panel showing what a trip changed and what completion will restore. Turns the riskiest module into the most legible one and doubles as a manual verification tool.
3. **Bet 3 — Per-cascade opt-out.** Once trustworthy and transparent, give control: choose which cascades fire per trip.

> Resist every enhancement until Bet 1 lands. Building on unverified cascades means a reversal bug could hide under new features and surface as a half-travelled household — the worst-feeling class of bug in the app.

→ This period's concrete actions: [3 · Current Action Plan](<3 - Current — Action Plan.md>).
