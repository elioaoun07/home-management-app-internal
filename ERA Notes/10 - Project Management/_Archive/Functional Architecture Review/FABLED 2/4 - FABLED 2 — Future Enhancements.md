---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - pm/far
---

# FAR · FABLED 2.4 — Toward FAR 2.0

> **FABLED 2:** [_index](<_index.md>) · [1 · Scoreboard](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · **4 · Enhancements**

---

## E1 — FAR 2.0 trigger (not a date)

Re-run the full review when **the first briefing has run for ≥4 weeks with feedback recorded** — that's the moment the app's identity claim ("proactive assistant") gets its first real data, and every FAR chapter (market lens, junction leverage, missed features) deserves re-examination against it. Re-running earlier just re-states this folder.

## E2 — New chapter for FAR 2.0: agent legibility

Add an eighth lens: how cheaply can an AI session go from intent → correct files → correct constraints? Measures: Feature-Map routing accuracy, dead-code trap count, authority-file freshness, decision findability ([PM FABLED 2.4 · E4](<../../FABLED 2/4 - FABLED 2 — Future Enhancements.md>)). June's costs (a refactor burned on `MobileItemForm`, stale Feature State claims) show this lens has real dollar weight in a codebase built *with* agents.

## E3 — New chapter: irreversibility register

A standing register of things that cannot be un-done or un-lost — RPC bodies outside the repo, unverified reversal cascades, behavioral trust (notification fatigue), data not being recorded (act/dismiss). Strategy reviews weight features well and irreversibility poorly; give it its own table with owners.

## E4 — Metrics plumbing before metrics claims

FAR 2.0 should refuse any metric without its measurement path named (Speaks-First Ratio → composer log; Hit Rate → act/dismiss rows; Regret → dismiss-within-minutes). The 1.0's metrics stayed aspirational for lack of this rule.

## E5 — Keep the challenge-letter format, add a deadline

FAR 6's ten challenges were the review's sharpest device — and the scoreboard went unfilled. 2.0's challenges each get a decide-by date and a default verdict on expiry ("undecided = rejected"), so silence becomes a decision instead of a debt.
