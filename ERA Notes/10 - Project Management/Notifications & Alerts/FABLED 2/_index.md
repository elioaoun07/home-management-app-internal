---
created: 2026-07-02
type: index
status: living
owner: Elio
tags:
  - pm/fabled2
  - module/notifications
---

# Notifications & Alerts · FABLED 2 — Index

> This campaign never had a FABLED v1 — FABLED 2 is its **first** deep-dive layer, built to the second-generation standard directly (verified against the working tree **2026-07-02**; scored, evidence-linked, kill-criteria'd). The campaign's own [Feature State](<../1 - Feature State.md>) (2026-06-19) carries the full pain inventory; this folder holds the architecture X-ray, the ranked technical gaps, the hardening plan, and the enhancement ladder.

| # | File | Read it when… |
|---|---|---|
| 1 | [Current Implementation](<1 - FABLED 2 — Current Implementation.md>) | You need the pipeline X-ray: crons → table → push/drawer/page → click routing, and what June fixed. |
| 2 | [Gaps & Missing](<2 - FABLED 2 — Gaps & Missing.md>) | You want the ranked technical absences behind the campaign's pains. |
| 3 | [Optimization Plan](<3 - FABLED 2 — Optimization Plan.md>) | You're touching the notification path and want the hardening order. |
| 4 | [Future Enhancements](<4 - FABLED 2 — Future Enhancements.md>) | You're planning the campaign — the delivery-policy engine is the module's 10×. |

## Maturity scoreboard (2026-07-02)

| Dimension | Score | One-line justification |
|---|---|---|
| **Data model** | 7 | Unified `notifications` table with types, `group_key`, priority/severity, snooze/expiry, FK links — richer than the UI uses. |
| **Delivery correctness** | 7 | The 🔴 mis-routing is fixed (`daily_items_summary` typed + migrated 06-19); per-item deep-links are the reference pattern. |
| **UX calm** | 3 | Perpetual bell wobble + red badge + no reduced-motion; drawer and alerts page over-dense; two visual languages. |
| **Intelligence** | 2 | No quiet hours, no grouping despite `group_key`, no digest, no act/dismiss learning. |
| **Hygiene** | 4 | Cron routes remain heavy `console.*` offenders; Undo compliance on dismiss/snooze unverified. |
| **Overall** | **4.6** | The pipes are sound and now route correctly; the product on top of them still shouts, repeats itself, and never learns. |

## What moved since the campaign audit (2026-06-19 → 2026-07-02)

✅ **The one true 🔴 is dead:** the daily items summary is typed `daily_items_summary` (verified in `daily-items-reminder/route.ts` today) with migration `2026-06-19_daily-items-summary-notification-type.sql` — it no longer opens the expense form. ✅ Drawer open animation fixed (06-19). Everything else in the pain inventory — bell, density, grouping, quiet hours — is still open.

## The next 3 moves

1. **Calm the bell** — finite ring + severity-aware badge + `prefers-reduced-motion` ([file 3 · O1](<3 - FABLED 2 — Optimization Plan.md>)).
2. **Use `group_key` in the drawer** — the schema already paid for grouping; render it ([file 3 · O3](<3 - FABLED 2 — Optimization Plan.md>)).
3. **Write the delivery-policy skeleton** — quiet hours + daily push budget; the composer ([Hub & ERA FABLED 2.4 · E1](<../../Hub & ERA/FABLED 2/4 - FABLED 2 — Future Enhancements.md>)) will need it the day it ships ([file 4 · E1](<4 - FABLED 2 — Future Enhancements.md>)).

**Sibling deep-dives:** [Budget](<../../Budget/FABLED 2/_index.md>) · [Schedule](<../../Schedule/FABLED 2/_index.md>) · [Kitchen](<../../Kitchen/FABLED 2/_index.md>) · [Hub & ERA](<../../Hub & ERA/FABLED 2/_index.md>) · [Trips](<../../Trips/FABLED 2/_index.md>) · [PM system](<../../FABLED 2/_index.md>)
