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
  - module/trips
---

# Trips · FABLED 3.2 — Gaps & Missing

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

> **Inheritance (verified 2026-07-18):** [FABLED 2 file 2](<../FABLED 2/2 - FABLED 2 — Gaps & Missing.md>) G1–G8 all remain open and correctly ranked. Only the delta is written here.

1. **G1/G2 unchanged, now 7 weeks old.** Verification never run; RPC bodies never recovered. Third generation reporting this. The G8 fallback clause (freeze the module in writing) activates if generation 4 finds them unmoved.
2. **NEW — G9: sharing shipped below the verification waterline.** `b03b2bb` added partner read+write on places/packing of household trips — collaborative writes into a module whose cascade machinery has never been witnessed working. If a partner edits packing on a trip mid-activation, behavior is unspecified and untested. Severity: friction now, blocker the day two people actually use it on a real trip.
3. **NEW — G10: second mirrored-logic surface.** `tripAccess.ts` mirrors the `is_public` account pattern by hand; `getActiveHouseholdPartnerId` is shared, but the scope semantics are re-implemented. When account-sharing semantics move again (they moved in June), Trips drifts silently in two places now, not one.
4. G3–G8 (v2): unchanged, still open, still correctly ordered.
