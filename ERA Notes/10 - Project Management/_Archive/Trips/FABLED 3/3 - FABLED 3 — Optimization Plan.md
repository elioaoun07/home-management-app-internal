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
  - module/trips
---

# Trips · FABLED 3.3 — Optimization Plan

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

> **Inheritance (verified 2026-07-18):** [FABLED 2 file 3](<../FABLED 2/3 - FABLED 2 — Optimization Plan.md>) O1–O3 remain the plan, verbatim — including the ready-written G1 verification checklist. Nothing about the path changed; only the urgency did.

Delta additions:

1. **O1/O2/O3 as written in v2.** No re-litigation. O1 is 30 minutes in the Supabase SQL Editor; it has been 30 minutes for seven weeks.
2. **NEW — O4: test `tripAccess.ts` (S).** It's a pure function taking a `SupabaseLike` — mockable by design. Assert: owner always; partner only on `scope === "household"` with active link; solo trips invisible; lifecycle routes still owner-only. This is the cheapest test in the module and guards the newest surface.
3. **NEW — O5: sharing-under-lifecycle spec (S, docs).** One paragraph in `03 - Junction Modules/Trips/Overview.md`: what happens (should happen) to partner edits when a trip activates/completes mid-edit. Currently unspecified — specify before it's discovered in production.
4. **Sequencing rule for successors:** O1 → O2 gate everything. Do not build further Trips features (including [file 4](<4 - FABLED 3 — Future Enhancements.md>) items) on the unverified cascade core.
