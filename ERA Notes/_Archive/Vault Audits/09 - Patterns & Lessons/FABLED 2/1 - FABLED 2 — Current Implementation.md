---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/patterns
---

# Patterns & Lessons · FABLED 2.1 — Current Implementation

> **FABLED 2:** [_index](<_index.md>) · **1 · Implementation** · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)

---

## 1 · How patterns actually flow in this project (the real pipeline)

```
pain (bug/discovery)
  → campaign Implemented Note (Hard Rule #25 — always happens, mechanically enforced)
    → [sometimes] vault doc gotcha section
      → [the best ones] CLAUDE.md Hard Rule (25 today) or a skill (3 today)
```

`09 - Patterns & Lessons/` was designed as the middle shelf of that pipeline (with `Templates/Pattern.md` as its form). In practice the middle shelf is **bypassed**: lessons jump from campaign logs straight to hard rules, or stall in the logs. The proof of both ends working: HR 20/21 (RPC bundling) and the three skills all originated as lived pain — and the shelf itself sits nearly empty.

## 2 · Where June's lessons actually live today

Scattered across: Budget's Implemented Notes (~20 dated entries), Schedule's Cluster 5 table, commit messages, and two AI memory files. All recoverable *today*; progressively expensive to recover every week that passes. [File 2](<2 - FABLED 2 — Gaps & Missing.md>) extracts the six worth keeping.

## 3 · What makes this directory worth fixing rather than deleting

The skills system gives patterns a *mechanical* distribution path (auto-invoke on file triggers) — but skills are expensive-form (procedures). The hard rules give them authority — but CLAUDE.md space is scarce and rules must stay few to stay read. The middle shelf is where a pattern matures from "note" to "rule-candidate" with evidence accumulating. That's a real job; it just needs the capture habit ([file 3](<3 - FABLED 2 — Optimization Plan.md>)).
