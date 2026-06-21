---
created: 2026-05-30
updated: 2026-06-20
type: action-plan
status: active
owner: Elio
tags:
  - pm/action
  - scope/module
  - module/trips
---

# Trips · 3 — Action Plan

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the *why, and in what order* for Trips — the strategic call and the candidate work as narrative. The flat, checkable version of this plan is [4 · Checklist](<4 - Checklist.md>); tick the boxes there.

---

## 📌 The call

**This period: verify before you build.**

Trips is 🟡 New/Thin and just committed — so the danger isn't missing features, it's that its **cascades are unverified end-to-end**. activate→complete reaches into chores, recurring pauses, one-time cancellations, meal skips, item reassignment, and account creation, and a reversal bug would silently leave the household half-travelled. The whole module sits on unverified foundations, so the first job is to prove them — not to add to them.

This is the deferred item from the global plan, surfaced to the module level: **do the manual end-to-end verify of activate/complete cascades** before any enhancement.

---

## 🎯 Candidate work (from [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>))

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

## 🗺️ The sequence (narrative)

**Now — Verify the foundation.** Run a real household trip and a real solo trip through activate→complete; confirm every cascade fires and reverses cleanly via `trip_side_effects`, and confirm `recurring_payments` stay active (deliberate rule). → [Trips / Overview](<../../03 - Junction Modules/Trips/Overview.md>).

**Next — Make it legible.** Build the side-effect transparency "trip impact" panel reading `trip_side_effects` — what a trip paused/cancelled/created/reassigned, and what completion will reverse. Doubles as a permanent verification tool.

**Later — Make it richer.** Trip budget rollup / post-trip summary, then per-cascade opt-out — only once the cascades are verified and legible.

→ Every item above as a checkable line: [4 · Checklist](<4 - Checklist.md>).

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
