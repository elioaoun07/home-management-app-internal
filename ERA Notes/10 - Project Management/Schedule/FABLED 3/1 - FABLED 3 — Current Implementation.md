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
  - module/schedule
---

# Schedule · FABLED 3.1 — Current Implementation

[_index](<_index.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

> **Inheritance (verified 2026-07-18):** [FABLED 2 file 1](<../FABLED 2/1 - FABLED 2 — Current Implementation.md>) remains normative for the item model, three-engine expansion reality, occurrence actions, day-plans, and household mechanics. Re-verified via `git diff --stat c561635..HEAD -- <schedule paths>` → 12 files, +727/−2, almost entirely the gcal layer. This file writes only the delta.

## The delta: Google Calendar sync (`2783b1d`, 2026-07-10)

First genuine outward bridge from the schedule cluster:

| Piece | Lines | Role |
|---|---|---|
| `src/app/api/gcal/connect/route.ts` | 41 | OAuth kickoff |
| `src/app/api/gcal/callback/route.ts` | 105 | token exchange + store |
| `src/app/api/gcal/connection/route.ts` | 79 | connection status / disconnect |
| `src/app/api/gcal/sync-item/route.ts` | 62 | push one item to Google |
| `src/lib/gcal/client.ts` | 60 | token refresh client |
| `src/lib/gcal/sync.ts` | 274 | item→event mapping + sync bookkeeping |
| `src/app/api/cron/gcal-reconcile/route.ts` | 87 | daily two-pass reconcile (shipped `9d867f8`, same day) |

DB (`migrations/2026-07-10_google-calendar-sync.sql`): new `google_calendar_connections` table + `items.google_synced_at` column. `useItems.ts` gained sync hooks (+30).

**Boundary verified:** `sync.ts` maps and pushes; it does **not** expand occurrences — the three-engine problem did not become a four-engine problem. **The reconcile cron exists and is exemplary** (correction over this file's first draft): Bearer `CRON_SECRET` + `supabaseAdmin()` + `maxDuration=60`, two passes (idempotent re-push of eligible items; deletion of Google events whose items became ineligible), and a written "how do I know it ran" answer (`google_calendar_connections.last_synced_at`). What does NOT exist is a **scheduler**: `vercel.json` is absent (verified 2026-07-18), so nothing in the repo invokes this cron — the Domain Gotcha about cron liveness applies in full (see [3.2](<2 - FABLED 3 — Gaps & Missing.md>)).

**Cross-module contract:** Healthcare Phase 2 (HLTH-9/10) builds on this layer with the recorded "warn-but-allow when Google disconnected" decision and will *extend* the existing reconcile cron (med items first).

## What did NOT change (load-bearing non-news)

- The suite-reddening guard failure (`expandOccurrences.test.ts` ↔ `WebTodayView.tsx`) — present at v2, present today; `WebTodayView.tsx` last touched 2026-06-16 (`5f7c064`).
- Dead `MobileItemForm.tsx` still on disk (49,943 bytes, unreferenced since the live form became `MobileReminderForm`).
- `useItems.ts` 2,665 LOC (+28 in window).
