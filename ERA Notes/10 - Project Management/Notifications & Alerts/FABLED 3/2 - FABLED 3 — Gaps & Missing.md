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
  - module/notifications
---

# Notifications & Alerts · FABLED 3.2 — Gaps & Missing

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

> **Inheritance (verified 2026-07-18):** [FABLED 2 file 2](<../FABLED 2/2 - FABLED 2 — Gaps & Missing.md>) stands. Re-ranked view with the 07-18 lens:

1. **Cron liveness is unproven for every cron, not just gcal.** `vercel.json` absent; the five cron routes only run if an external scheduler calls them. The daily-summary/item-reminder crons *appear* to fire (user receives notifications), but no repo artifact proves scheduling. One `docs/ENV.md` or vault paragraph naming the actual scheduler would close a question three audit generations have re-asked.
2. **Bell calm-down (Phase 2)** — carried; the perpetual wobble + red badge is the cluster's oldest UX complaint.
3. **Delivery-policy engine absent while volume grows** — critical gate + gcal + chore/bureaucratic reminders all add sends; quiet hours and a daily budget still don't exist (E1).
4. **`public/sw.js` outside the registry** — carried; push rendering can drift from in-app rendering per type.
5. **Cron `console.*` sweep (5.4)** — carried; counts in the 2026-07-18 evidence snapshot (13/9/8 across the three item crons).
6. **Undo audit on dismiss/snooze (5.6)** — carried; Hard Rule 1 compliance unverified on quick actions.
