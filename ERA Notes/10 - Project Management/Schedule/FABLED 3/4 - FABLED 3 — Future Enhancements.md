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
  - module/schedule
---

# Schedule · FABLED 3.4 — Future Enhancements

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

> **Inheritance (verified 2026-07-18):** v2 file 4 carries forward with kill criteria intact; its outward-bridge family got its first shipment (gcal). Gen-3 additions:

- **E-new-1 — Two-way gcal sync** ⭐ · Impact high · Effort L · Seam: extends O3's reconcile cron to pull Google-side changes into drafts (AI-proposes/human-confirms — external edits are proposals too, never silent writes into items). Kill: **do not start before O3 (push reconcile) has run clean for 2 weeks** — pulling into a drifting push layer compounds drift; and never write Google changes directly to items.
- **E-new-2 — `getWeekShape()` for ERA** (carried from v2 bridges, re-scoped ⭐) · Impact high · Effort M · Seam: one read-only RPC-backed shape summary (busy blocks, free windows, flexible backlog) consumed by the briefing and Plan-My-Day; Hard Rule 21 pattern. Kill: if the Awakening briefing isn't consuming it within 30 days of shipping, it was speculative — fold into `get_schedule_bundle` instead.
- **E-new-3 — Sync-status chip on items** ⭐ · Impact low-medium · Effort S · Seam: `google_synced_at` vs `updated_at` renders a stale/synced/never chip on item detail. Kill: skip until O4 exists — a chip over unobserved state lies.
