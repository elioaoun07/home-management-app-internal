---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - pm/far
---

# FAR Checklist · FABLED 2.2 — Why the Plan Diverged

> **FABLED 2:** [_index](<_index.md>) · [1 · Scoreboard](<1 - FABLED 2 — Current Implementation.md>) · **2 · Gaps** · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)

---

## G1 — No feedback loop between the checklist and the week

The design said "feeds file 4 every Monday." No mechanism enforced it (the Stop hook enforces PM traces for *code changes*, not plan re-drafts), so the feed never ran. A plan without a re-planning ritual is a snapshot wearing a schedule's clothes.

## G2 — The checklist competes with livelier queues

Campaign pain inventories are vivid (evidence, severity, your own frustration); the 13-week schedule is abstract. Attention follows vividness. Any re-baseline that doesn't *merge into* the campaign system ([PM FABLED 2.3 · O4](<../../FABLED 2/3 - FABLED 2 — Optimization Plan.md>) precedence rule) will lose the same contest again.

## G3 — Phase 1's items were mostly non-feature work with no slot

Intent fixtures, wake-word afternoon, gamification audit, orphan sweep — exactly the class that the execution-slot failure eats ([PM FABLED 2.2 · G1](<../../FABLED 2/2 - FABLED 2 — Gaps & Missing.md>)). Phase 1 was, in effect, a hygiene sweep scheduled without the ritual that makes hygiene happen.

## G4 — Unplanned work is invisible until someone reconstructs it

It took a FABLED 2 recon (git log + five campaign files) to see that June was productive-but-elsewhere. The auto-delta report ([PM FABLED 2.4 · E3](<../../FABLED 2/4 - FABLED 2 — Future Enhancements.md>)) is the cheap fix: replacement becomes visible the Monday it happens.

## G5 — The exit gate had no evaluator

"Money tests green in CI" — there is no CI running tests visible from the repo scripts (vitest exists; no workflow was found in the recon). A gate nobody can mechanically evaluate is a wish. Either add the minimal CI (one GitHub Action running `pnpm test` + `docs:check`) or rewrite gates in locally-verifiable terms.
