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
  - module/notifications
---

# Notifications & Alerts · FABLED 3.3 — Optimization Plan

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

> **Inheritance (verified 2026-07-18):** [FABLED 2 file 3](<../FABLED 2/3 - FABLED 2 — Optimization Plan.md>) O1–On carry unchanged. Gen-3 ordering:

1. **O-3.1 — Answer the scheduler question once (S, ops/docs).** Identify what actually invokes the five crons (Vercel project config / external scheduler), write it into `docs/ENV.md` + the vault Notifications doc with a "how to check last run" line per cron. Add gcal-reconcile to that scheduler. This single page closes Gap #1 for every future audit.
2. **O-3.2 — Bell calm-down** (carried O1): finite animation, severity-aware badge, `prefers-reduced-motion`. `ui-guardrails` applies.
3. **O-3.3 — console.* sweep of the three item crons (S)** (carried 5.4): Hard Rule 22; counts are in the evidence snapshot.
4. **O-3.4 — Undo audit on quick actions (S)** (carried 5.6): every dismiss/snooze toast needs a working Undo (Hard Rule 1); test via the actions route.
5. **O-3.5 — Delivery-policy skeleton** (carried E1→plan): quiet hours + daily budget consulted by both push paths; the `chatNotificationPolicy` pure-function pattern is the template.
