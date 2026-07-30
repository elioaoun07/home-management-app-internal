---
created: 2026-07-18
type: deep-dive
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
predecessor: ../FABLED 2/1 - FABLED 2 — Current Implementation.md
tags:
  - pm/fabled3
  - module/notifications
---

# Notifications & Alerts · FABLED 3.1 — Current Implementation

[_index](<_index.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

> **Inheritance (verified 2026-07-18):** [FABLED 2 file 1](<../FABLED 2/1 - FABLED 2 — Current Implementation.md>) plus the index's 07-10 "What moved" record are **fully normative** — registry, unified alerts page, critical-alert gate, gcal backup sync (live-verified connect + sync + delete legs). `git log 9d867f8..HEAD -- src/app/api/notifications src/app/api/cron src/components/notifications src/app/alerts` → zero cluster commits. Affirmation generation.

## The one boundary note worth adding

The gcal machinery is *administratively homed* here (it shipped under this campaign, and F2 documents it), but its *code* lives in Schedule's paths (`src/lib/gcal/`, `src/app/api/gcal/`, `cron/gcal-reconcile`) and its consumers are items. Gen 3 records the ownership convention to prevent double-audit drift: **Schedule's FABLED 3 owns the sync layer's technical audit; this campaign owns its delivery/liveness story.** Cross-links exist in both directions.

## Census (2026-07-18)

Registry-driven types with per-type route/actions/icon/class/calendarSync/takeoverEligible/retention; `/api/notifications/in-app` as the single read source (bell + alerts page); push via `push_subscriptions` + `public/sw.js` (still registry-separate — documented, not closed); six crons under `src/app/api/cron/` (three item-reminder crons + chat-notifications + gcal-reconcile + purge-recycle-bin — the last owned by Recycle Bin, listed for census completeness).
