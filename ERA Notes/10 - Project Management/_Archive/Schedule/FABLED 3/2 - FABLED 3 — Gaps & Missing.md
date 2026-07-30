---
created: 2026-07-18
type: deep-dive
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
predecessor: ../FABLED 2/2 - FABLED 2 — Gaps & Missing.md
tags:
  - pm/fabled3
  - module/schedule
---

# Schedule · FABLED 3.2 — Gaps & Missing

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

> **Inheritance (verified 2026-07-18):** v2's list stands. Delta and re-ranking only.

1. **The red suite is now a culture problem, not a test problem.** One guard failure (WebTodayView ↔ `is_flexible`) has kept `pnpm test` red for a month. Every session since has learned to read "1 failed" as normal — which is exactly how the *second* real failure slips through. Highest-leverage fix in the cluster; the diagnosis (real double-expansion bug vs stale guard list) is itself unresolved, which is the point.
2. **`MobileItemForm.tsx` — fourth-generation flag.** 49,943 dead bytes. At this point it's a monument; deleting it is a 2-minute `git rm` + typecheck.
3. **NEW — the reconcile cron exists but may never run.** `gcal-reconcile/route.ts` shipped 07-10 and is well-built (two-pass, idempotent, self-reporting via `last_synced_at`) — but `vercel.json` is absent and no scheduler trace exists in the repo. An unscheduled cron is indistinguishable from a scheduled one by reading code; the Domain Gotcha demands a last-run answer. Until `last_synced_at` is *observed advancing daily in prod*, treat the Google copy as silently diverging — and Healthcare medications (HLTH-9/10) plan to trust this layer.
4. **NEW — OAuth token lifecycle unobserved.** `google_calendar_connections` stores refresh tokens; there is no surfaced state for "refresh failed / connection dead" beyond warn-at-sync-time. A dead connection looks identical to a healthy idle one.
5. **Three diverging expansion engines** (carried, unchanged) — the target Google/Outlook model (PI&P 7) remains documented-not-built. Every new consumer (gcal now, Healthcare next) multiplies the eventual unification cost.
6. `day_plans.intent` captured-but-unconsumed; no `getWeekShape()` for ERA (carried, unchanged).
