---
created: 2026-06-12
type: index
status: living
owner: Elio
tags:
  - pm/index
  - pm/far
  - pm/execution
  - scope/cross-cutting
---

# FAR Execution Checklist

> **The "what do I do next" answer, in checkboxes and dates.** This folder turns the [Functional Architecture Review](<../Functional Architecture Review/_index.md>) (and the open commitments it inherited from the command center) into a single executable campaign: **13 weeks, Mon 2026-06-15 → Sun 2026-09-13.**

| # | File | Use it when... |
|---|---|---|
| 1 | [Master Checklist — By Priority](<1 - Master Checklist — By Priority.md>) | You want every item in one place, grouped P0→P3, with effort, due week, and dependencies. **The source of truth for scope.** |
| 2 | [Weekly Schedule — Jun 15 to Sep 13](<2 - Weekly Schedule — Jun 15 to Sep 13.md>) | It's Monday and you're planning the week — or Friday and you're checking it off. **The source of truth for time.** |

Same items, two views, linked by ID. Tick a box in either file; sync the other in the same sitting.

## How this folder relates to the rest of the command center

- **[4 · This Week](<../4 - This Week (Action Plan).md>) stays the daily driver.** Every Monday, copy the current week's block from file 2 into file 4 and re-draft it as days. This folder is the campaign map; file 4 is the trail.
- **[FAR](<../Functional Architecture Review/_index.md>) is the *why*.** Every item here carries its source ID (R/J/M/A/C from FAR, E/G from FABLED, or backlog numbers). If you find yourself questioning an item, follow the ID — don't re-litigate in the checklist.
- When an item ships, also do the Hard-Rule-25 sweep: tick it here, mark it in the relevant module PM folder, and note the date.

## Operating rhythm (the whole system, 25 min/week)

- **Monday (10 min):** open file 2 → copy this week's block into [4 · This Week](<../4 - This Week (Action Plan).md>) → pick the *"if you only do one thing"* item first.
- **Friday (15 min):** tick what's done in both files → anything unfinished moves to next week → log slippage in the week's Notes line.

## The three rules (read once, they prevent the usual failure modes)

1. **Order is the contract; dates are a pace proposal.** The schedule assumes **~2 focused project days per week**. If your real capacity is half that, double every date — but never reorder across a phase gate.
2. **Slip by re-dating, not by compressing.** If a week ends < 50% done, push *all* later weeks out by a week (edit the dates in file 2, note it). Compressing two weeks into one is how checklists die.
3. **The gate is absolute.** No Phase 2 (nervous-system) item starts before the Phase 1 exit gate is green — even if a Phase 2 item looks more fun on a given evening. *(The good news baked into this plan: the money-math unit tests already exist — 26 tests shipped 2026-05-29 — so the gate is already half-closed. What remains is intent fixtures + money API-route tests.)*

## Phase map

```
Phase 1 · TRUST            W1–W3    Jun 15 – Jul 5    decisions, fixtures, route tests, quick wins
Phase 2 · NERVOUS SYSTEM   W4–W8    Jul 6  – Aug 9    signals → composer → brief → policy → Hub card
Phase 3 · CLOSED LOOPS     W9–W13   Aug 10 – Sep 13   inbox pilot, anomaly push, learning, share-target
                                                       ↳ exit: ERA speaks first, correctly, ≥5×/week
```
