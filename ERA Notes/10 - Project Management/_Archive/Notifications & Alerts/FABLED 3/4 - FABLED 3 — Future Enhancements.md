---
created: 2026-07-18
type: deep-dive
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
predecessor: ../FABLED 2/4 - FABLED 2 — Future Enhancements.md
tags:
  - pm/fabled3
  - module/notifications
---

# Notifications & Alerts · FABLED 3.4 — Future Enhancements

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

> **Inheritance (verified 2026-07-18):** [FABLED 2 file 4](<../FABLED 2/4 - FABLED 2 — Future Enhancements.md>) carries in full — E1 (delivery-policy engine) remains the cluster's 10×. One gen-3 addition:

- **E-new — Notification outcome loop** ⭐ · Impact medium-high · Effort M · Seam: the registry already declares per-type actions; log action-taken vs dismissed vs ignored per type (columns exist since the actions-route fix), then feed a per-type "usefulness score" into the future delivery-policy engine — types the household always ignores get demoted automatically. This is FABLED+'s "Learning" dimension applied to the one cluster with a natural feedback signal already flowing. Kill criterion: needs E1's policy engine as the consumer; if E1 isn't scheduled within 60 days, don't collect data nobody will read.
