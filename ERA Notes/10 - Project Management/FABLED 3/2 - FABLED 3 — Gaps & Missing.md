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
  - pm/meta
---

# Project Management · FABLED 3.2 — Gaps & Missing

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

> **Inheritance (verified 2026-07-18):** v2's G-list mostly resolved or moved; this is a substantially new list. Ranked.

1. **The execution-slot failure survives its third generation** (v2 G-core). The two fixes shipped 2026-07-18 were shipped *by the audit session* — the system still has no recurring ritual that executes small flagged fixes without a generational event. Trips O1 (30 min, flagged since 06-10) is the standing counterexample.
2. **NEW — meta-work outweighed product work in the delta window.** Of 21 commits since 07-03, ~12 are PM/docs/tooling; product code got Healthcare (1 day), sharing tweaks, gcal. The Consultation's §3.2 warning is now *measurable* in the commit ratio. The PM machine improving itself faster than the product it manages is the failure mode FABLED exists to catch — it is catching itself.
3. **NEW — 7,156 LOC of untyped bespoke JS is now load-bearing.** The lint.mjs typecheck break (07-13→07-18) was the first tax payment. JSDoc typing exists on exactly one function.
4. **NEW — PWA/service-worker cache staleness risk.** `sw.js` caches the PM board; a stale SW serving an old board that *looks* current is a freshness regression dressed as a feature. No cache-busting/version assertion found in the manifest commit (`git show f0a8e19` — verify claim).
5. **Delivery Workspace is docs + UI ahead of its approval state.** The plan is DRAFT (owner overrides recorded: no git writes ever, no bypassPermissions), but `src/features/delivery/` UI already exists in the dashboard. Building UI for an unapproved plan is speculative work the Doctrine's Ten Questions would have flagged.
6. **Session-history surfaces ("all fable sessions", `11 - docs`) have no retention/index convention** — they will become the next "Updated 2026-05-30" zombies unless the radar covers them.
