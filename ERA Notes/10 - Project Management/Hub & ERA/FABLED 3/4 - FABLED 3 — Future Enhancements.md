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
  - module/hub-era
---

# Hub & ERA · FABLED 3.4 — Future Enhancements

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

> **Inheritance (verified 2026-07-18):** v2 file 4 (the briefing composer as the moat) + the ERA Top View study (2026-07-17) + the Awakening WP queue jointly own this space. **Gen 3 deliberately adds almost nothing** — this cluster's enhancement backlog is over-supplied and under-executed; adding ideas here would be the exact meta-work failure the PM audit names. One addition:

- **E-new — Handoff-aware intent guardrail** ⭐ · Impact medium-high · Effort S · Seam: when `resolveIntent` confidence is below threshold OR the intent would mutate money/items, the formatter must route through the drafts/proposal pattern rather than acting — make this an *asserted invariant* in the O1 fixture table ("low-confidence money intent → draft, never direct"). This converts the intent system's biggest risk into a tested contract, which matters double when smaller models operate the Hub. Kill: if O1 fixtures don't exist yet, this is meaningless — it is a *row in that table*, not a separate project.
