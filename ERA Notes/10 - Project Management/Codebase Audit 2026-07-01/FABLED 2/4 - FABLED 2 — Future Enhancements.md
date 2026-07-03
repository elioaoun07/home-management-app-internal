---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - codebase-audit
---

# Codebase Audit · FABLED 2.4 — Keeping the Audit Stream Alive

> **FABLED 2:** [_index](<_index.md>) · [1 · Verification](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · **4 · Enhancements**

---

## E1 — The monthly delta pass (30 minutes, calendar it)

Re-run [file 1's](<1 - FABLED 2 — Current Implementation.md>) command table, append a dated row per metric, check off promoted/completed items in the source checklist. An audit that gets a monthly 30-minute delta stays a tool; one that doesn't becomes archaeology by September. First pass due: **2026-08-01**.

## E2 — Fold the metrics into the PM reconciliation script

[PM FABLED 2.4 · E2](<../../FABLED 2/4 - FABLED 2 — Future Enhancements.md>) proposes claims-vs-reality reconciliation on the dashboard. This audit's command table is its first input set — when that script exists, E1's manual pass becomes a dashboard section and the monthly ritual shrinks to reading it.

## E3 — Ratchet rules instead of goals

For countable hygiene (console, raw fetch): a tiny CI/pre-commit check that fails if the count *increases* over the recorded baseline. Ratchets require no sprint, tolerate slow progress, and make regression impossible — better fit for a solo-maintained codebase than "sweep everything by Friday."

## E4 — Next full audit: trigger, not date

Re-run the full pack when any of: the P0 section fully clears · a second household onboards (threat model changes) · the proactive layer ships (new external surface: push, cron volume, AI actions). Until then, deltas over re-audits — the marginal insight of a fresh full audit is low while this one's P0s stand open.
