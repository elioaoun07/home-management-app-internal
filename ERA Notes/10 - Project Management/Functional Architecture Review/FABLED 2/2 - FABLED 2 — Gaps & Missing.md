---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - pm/far
---

# FAR · FABLED 2.2 — What the FAR's Frame Missed

> **FABLED 2:** [_index](<_index.md>) · [1 · Scoreboard](<1 - FABLED 2 — Current Implementation.md>) · **2 · Gaps** · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)
>
> Found by living with the FAR for three weeks — additions, not corrections.

---

## G1 — Delivery policy is a precondition, not a step

FAR 7 placed Delivery Policy at step 2.5, *after* the first briefings (2.4). The Notifications deep-dive inverted that: an unpoliced composer trains the household to dismiss pushes in its first week, and the damage is behavioral (trust), not technical — it doesn't roll back. **Policy engine before first proactive push** is the corrected ordering ([Notifications FABLED 2.4 · E1](<../../Notifications & Alerts/FABLED 2/4 - FABLED 2 — Future Enhancements.md>)).

## G2 — The FAR assumed its own execution mechanism would work

Its checklist presumed Monday re-drafts that never happened ([FAR Checklist FABLED 2.2](<../../FAR Execution Checklist/FABLED 2/2 - FABLED 2 — Gaps & Missing.md>)). A strategy review that doesn't audit the *planning system's* failure modes plans for a team that doesn't exist. The PM meta-audit ([PM FABLED 2](<../../FABLED 2/_index.md>)) now owns that layer.

## G3 — No risk lane for the unverified junction

The FAR sequenced Trips work ("Modes engine only after cascades verified") but treated verification as a waiting condition, not a scheduled item — so it aged five weeks without an owner. Irreversibility risks need their own lane in any strategy view, ranked with features, not below them ([Trips FABLED 2.2 · G8](<../../Trips/FABLED 2/2 - FABLED 2 — Gaps & Missing.md>)).

## G4 — The moat has a dependency the FAR never named: suite credibility

Every FAR phase gate says "tests green." The suite has been red for two weeks for a known-stale reason, and nothing in the FAR's frame notices that a *red-but-ignored* suite is worse than no suite ([Schedule FABLED 2.2 · G2](<../../Schedule/FABLED 2/2 - FABLED 2 — Gaps & Missing.md>)). Gate credibility is infrastructure.

## G5 — AI-agent legibility as an architectural force

The FAR analyzed the app for the household. Three weeks of session logs show a second constituency shaping outcomes: **AI coding agents**, who burned a refactor on dead code, need the Feature Map to route intent, and read PM files as ground truth. Dead files, stale authority docs, and unlinked decisions are *agent hazards* with real cost. A FAR 2.0 should treat agent legibility as a first-class architectural property ([file 4 · E2](<4 - FABLED 2 — Future Enhancements.md>)).
