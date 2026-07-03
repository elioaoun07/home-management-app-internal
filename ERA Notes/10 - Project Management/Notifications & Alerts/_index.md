---
created: 2026-06-19
updated: 2026-06-19
type: index
status: living
owner: Elio
tags:
  - pm/index
  - scope/module
  - module/notifications
---

# Notifications & Alerts — Module PM Command Center

> Per-module strategic command center for **Notifications & Alerts** — the bell + badge in the header, the in-app notification side drawer, the full **View All Alerts** page, the two system notifications (daily budget reminder + daily items summary), and the click-routing/deep-link layer that decides where a notification takes you.
>
> **Scope:** this folder is **Notifications-only**. The root [10 - Project Management](<../_index.md>) set is **whole-app** scope. Sibling per-module folders use the same format — see [Schedule/](<../Schedule/_index.md>), [Budget/](<../Budget/_index.md>), [Kitchen/](<../Kitchen/_index.md>), [Hub & ERA/](<../Hub & ERA/_index.md>) (full list in the root [_index](<../_index.md>)).
>
> **Module type:** **Junction** (per CLAUDE.md) — it bridges **Items** (alerts), **Recurring** (payment reminders), **Budget** (spending alerts) and **Hub** (the alerts feed lives in `HubPage`). A change here can cascade across those standalones; trace them before editing.
>
> **Why this set exists:** the notification surface *works* but **feels wrong** — the bell rings perpetually and reads as an alarm, one system notification opens the wrong screen, the drawer is too wordy to glance at, and the alerts page is a wall of text. The ask was deliberate — *map every painful thing first, decide the target design, then run a focused overhaul.* This folder is that map plus the build queue. **Docs-first: nothing here is built yet** (created 2026-06-19).

| #   | File                                          | Read it when...                                                                                                          |
| --- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | [Feature State](<1 - Feature State.md>)       | You want the honest status of every notification surface **and** the full Pain Inventory (pain, root cause, severity).   |
| 2   | [Vision & Roadmap](<2 - Vision & Roadmap.md>) | You want where each pain is *heading* — target design + locked decisions + the best-practices brief + the MoSCoW backlog. |
| 3   | [Action Plan](<3 - Action Plan.md>)           | The call + sequenced Now/Next/Later queue + candidate-work table — the *why, and in what order*.                         |
| 4   | [Checklist](<4 - Checklist.md>)               | **Most days.** The flat, phased, checkable build list (IDs + severity + effort).                                         |
| F2  | [FABLED 2/](<FABLED 2/_index.md>)             | **The deep-dive layer (first generation for this module, verified 2026-07-02):** pipeline X-ray, scored maturity, ranked technical gaps, hardening plan, the delivery-policy-engine enhancement ladder. |

## How to use this set

1. **Read 1 first** — the four pain clusters (bell, routing, drawer density, alerts-page clutter) + the missed/optimization backlog. Ends with a ranked Top pains for instant scope.
2. **Read 2** — the target design per surface + the locked decisions (calm bell, items-summary → `/reminders`, concise drawer, scannable alerts page), plus the best-practices brief and the MoSCoW backlog that orders the work.
3. **Read 3** — the call + the Now/Next/Later queue + the candidate-work table (the *why, and in what order*).
4. **Work from 4** — the daily driver: the flat, phased build checklist. Point at a line, a group, or a phase.

## Where this fits

- **Up one level:** the global command center → [10 - Project Management/_index.md](<../_index.md>). Read that for whole-app priorities; the bell/animation cleanup also ladders into the global Hard-Rule-22 (`console.*`) hygiene line.
- **Implementation reality (read before coding):** [Notifications / Overview](<../../03 - Junction Modules/Notifications/Overview.md>) — the file-level source of truth. This folder is **strategy + audit + queue**, not a code map.
- **Connected modules' PM:** [Schedule/](<../Schedule/_index.md>) (the daily items summary should route into `/reminders`), [Budget/](<../Budget/_index.md>) (the daily budget reminder opens the mobile expense form).
