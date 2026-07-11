---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: Layout & Navigation
module_type: Cross-Cutting
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Layout & Navigation · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **Layout & Navigation** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Shift navigation from places to continuity: preserve exact work state, keep one predictable action anchor, and make route isolation mechanically testable.

## Business and household value

Continuity reduces abandoned work and repeated capture. A predictable shell makes a large feature estate feel smaller.

Measure attention returned, risk reduced, accessibility, and outcomes—not engagement.

## Roadmap

1. Now — map top journeys and shell contracts by route/device.
2. Next — add a resumable continuation rail for one interrupted workflow.
3. Later — prune navigation from observed backtracking and dead ends.

## New opportunity set

### V1 — Continue rail

- **Mechanism:** Expose recent unfinished draft/workflow checkpoints with safe resume and discard.
- **Smallest proof:** Support statement review and item edit.
- **Success measure:** Users resume without reconstructing state and abandon fewer flows.
- **Kill criterion:** Use deep-link history if checkpoint persistence is unnecessary.
- **Invariant:** Sensitive state respects user/device scope and expiry.

### V2 — Context action anchor

- **Mechanism:** Reserve one stable location whose action changes with explicit label and preview, not icon drift.
- **Smallest proof:** Unify FAB behavior across three core modes.
- **Success measure:** Action find-time improves without accidental activation.
- **Kill criterion:** Keep fixed per-route actions if context switching confuses.
- **Invariant:** The label and target are always visible before commit.

### V3 — Route shell contract tests

- **Mechanism:** Assert header/nav visibility, content offsets, deep-link focus, and mobile safe areas per route class.
- **Smallest proof:** Test guest, NFC, expense, reminders, and Hub.
- **Success measure:** A seeded overlap/isolation bug fails automatically.
- **Kill criterion:** Keep a small critical-route matrix if full enumeration is costly.
- **Invariant:** Tests inspect behavior, not brittle snapshots alone.

## Existing-roadmap boundary

Density modes, widget deep links, and generated Atlas journeys are existing ideas; this pack centers continuation and shell contracts.

## Strategy guardrail

Preserve identity and trusted shell behavior; start read-only; earn broad enforcement.

