---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: Hub Chat
module_type: Junction
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Hub Chat · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **Hub Chat** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Evolve Hub from a message feed into a resumable household workspace where decisions and workflows have explicit checkpoints while conversation remains natural.

## Business and household value

Resumability turns chat into operational memory. Fewer repeated explanations and lost decisions increase partner adoption and make Hub the genuine top layer.

Measure attention returned, risk reduced, and outcomes improved—not engagement.

## Roadmap

1. Now — define a thread workflow snapshot read-only and extract one behavioral seam only with this feature rider.
2. Next — add resumable checkpoints to one real decision flow.
3. Later — compact long threads into source-linked state only when retrieval pain is measured.

## New opportunity set

### V1 — Workflow checkpoint

- **Mechanism:** Represent current goal, confirmed facts, open question, owner, and next safe action as a source-linked snapshot.
- **Smallest proof:** Use one shopping or planning thread for two weeks.
- **Success measure:** An interrupted workflow resumes without rereading the full thread.
- **Kill criterion:** Keep pinned messages if structured checkpoints add maintenance.
- **Invariant:** Every fact links to a source message or record.

### V2 — Decision thread state

- **Mechanism:** Distinguish proposed, discussed, agreed, executed, superseded, and expired decisions inside a thread.
- **Smallest proof:** Track one shared purchase or meal decision.
- **Success measure:** Both users identify the current decision and why in under 30 seconds.
- **Kill criterion:** Use a single decision card if state transitions are too formal.
- **Invariant:** Read receipt is never agreement.

### V3 — Source-bound thread compaction

- **Mechanism:** Compress older conversation into claims with citations and invalidation when source records change.
- **Smallest proof:** Compact one long item-chat thread manually/ deterministically.
- **Success measure:** Context size drops while every claim remains auditable.
- **Kill criterion:** Retain search if summaries need frequent correction.
- **Invariant:** Uncertain claims remain marked; original messages are preserved.

## Existing-roadmap boundary

Household daily log, proactive briefing, richer widgets, memory, generic multi-turn flows, and notification→conversation are prior ideas; this pack targets durable workspace state.

## Strategy guardrail

Start read-only or shadowed; use existing proposal and mutation owners; earn automation.

