---
created: 2026-07-18
type: deep-dive
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
predecessor: ../FABLED 2/3 - FABLED 2 — Optimization Plan.md
tags:
  - pm/fabled3
  - module/schedule
---

# Schedule · FABLED 3.3 — Optimization Plan

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

> **Inheritance (verified 2026-07-18):** v2 file 3's Stage-2 engine-unification path stands. Delta queue, ordered:

1. **O1 — Green the suite (S–M, diagnosis-first).** With `recurrence-safety` open: determine whether `WebTodayView.tsx` actually expands flexible RRULEs (open it, trace its occurrence source since the 06-16 plan-day refactor). If yes → restore the skip (it's a live duplicate-display bug). If it now delegates to a guarded path → update the guard's view list *with a comment naming the delegation*. Either way `pnpm test` returns to meaning something.
2. **O2 — `git rm src/components/items/MobileItemForm.tsx` (S).** Typecheck after. Fourth flag ends here.
3. **O3 — verify gcal-reconcile liveness (S, ops not code).** The cron is already written (`gcal-reconcile/route.ts`, 87 lines — correction: an earlier draft of this audit said it didn't exist). What's missing is proof anything invokes it: check the external scheduler / Vercel project config, then confirm `google_calendar_connections.last_synced_at` advances daily. If unscheduled, schedule it. Record the answer in the vault doc so the next audit doesn't re-ask.
4. **O4 — connection-health surface (S).** `connection/route.ts` already reports status; add `last_refresh_error` to `google_calendar_connections` (migration) and show a dead-connection badge in settings. Kills Gap #4 cheaply.
5. **Stage 2 unification** (carried) — unchanged priority: after O1, before any *new* occurrence consumer beyond gcal/Healthcare.
