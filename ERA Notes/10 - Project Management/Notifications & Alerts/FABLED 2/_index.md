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

## Maturity scoreboard (2026-07-10)

| Dimension | Score | One-line justification |
|---|---|---|
| **Data model** | 8 | + `google_calendar_connections` table, `items.google_synced_at`; the notification registry (`registry.tsx`) formalizes the type system that the table already supported. |
| **Delivery correctness** | 8 | + fixed a real bug: `/api/notifications/actions` was writing to non-existent columns (`dismissed_at`/`action_taken_at`/`read_at`/`snooze_count`) — every quick-action button (Done/Snooze/Confirm/Dismiss) was silently failing. Now correct. |
| **UX calm** | 4 | Alerts page unified onto the bell's data source (was two disagreeing endpoints), live via realtime, date-grouped, filterable, `group_key`-deduped. Bell itself (perpetual wobble, red badge) still untouched. |
| **Intelligence** | 4 | `group_key` grouping now rendered (alerts page). New: full-screen critical-alert takeover gate (3rd "catch my attention" layer) and one-way Google Calendar backup sync (scheduled items only) — both proactive-surfacing wins. |
| **Hygiene** | 5 | `console.*` stripped from `/api/notifications/in-app` and `/api/notifications/actions`; the three cron routes (`daily-reminder`, `daily-items-reminder`, `item-reminders`) are still un-swept (5.4 not done). |
| **Overall** | **~5.8** | Foundation work: one registry instead of three hand-synced tables, a real bug fixed, the alerts page's core complaint ("never up to date," "messy") addressed. Bell calm-down and drawer density (Phases 2–3) still open. |

## What moved since 2026-07-02 → 2026-07-10

**Shipped this session** (user contract: fix Notifications & Alerts weakness with a full-screen catch-all + Google Calendar backup + two-type taxonomy):
- ✅ **Notification Registry** (`src/lib/notifications/registry.tsx`) — single source of truth per `notification_type` (route, quick actions, icon, `class`, `calendarSync`, `takeoverEligible`, retention). Closes gap G2 partially (registry unifies TS-side consumers; `public/sw.js` still separate — documented, not closed).
- ✅ **Alerts page unified onto `/api/notifications/in-app`** (same source as the bell), realtime via `useNotificationsRealtime()`, date-grouped + collapsible + `group_key`-deduped, filter chips (System/Scheduled/Unread) — this closes most of Phase 4 (4.1, 4.2 already true, 4.4 not live-verified) and Phase 5's 5.1/5.2/5.5.
- ✅ **Bug fix:** `/api/notifications/actions` column-name mismatch (quick actions were silently broken).
- ✅ **Critical Alert Gate** — new full-screen takeover for unacted high/urgent takeover-eligible alerts, mounted globally. Not in the original checklist — a new capability per the user's "for sure catch my viewpoint" ask.
- ✅ **Google Calendar one-way backup sync** — new capability, not in the original checklist. `src/lib/gcal/`, `/api/gcal/*`, `/api/cron/gcal-reconcile`, migration `2026-07-10_google-calendar-sync.sql`. Code-complete; **not live-tested** (needs user-provided `GOOGLE_CLIENT_ID`/`SECRET`/`REDIRECT_URI`).
- Still open: bell calm-down (Phase 2), drawer density (Phase 3), cron `console.*` sweep (5.4), Undo audit on dismiss/snooze (5.6), delivery-policy engine (E1).

## The next 3 moves

1. **Live-verify the Google Calendar sync** once `GOOGLE_CLIENT_ID`/`SECRET`/`REDIRECT_URI` are set — connect, create a reminder, confirm the event appears and a native alarm fires.
2. **Calm the bell** — finite ring + severity-aware badge + `prefers-reduced-motion` ([file 3 · O1](<3 - FABLED 2 — Optimization Plan.md>)). Still untouched.
3. **Write the delivery-policy skeleton** — quiet hours + daily push budget; now doubly relevant since the critical-alert gate and Google Calendar sync both add delivery volume. ([file 4 · E1](<4 - FABLED 2 — Future Enhancements.md>)).

**Sibling deep-dives:** [Budget](<../../Budget/FABLED 2/_index.md>) · [Schedule](<../../Schedule/FABLED 2/_index.md>) · [Kitchen](<../../Kitchen/FABLED 2/_index.md>) · [Hub & ERA](<../../Hub & ERA/FABLED 2/_index.md>) · [Trips](<../../Trips/FABLED 2/_index.md>) · [PM system](<../../FABLED 2/_index.md>)
