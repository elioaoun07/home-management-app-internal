---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: Items & Reminders
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Items & Reminders · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **Items & Reminders** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Make schedule truth semantic, not merely temporal: what is protected, what can move, why it matters, and what the system learned from the outcome.

## Business and household value

A schedule that protects promises and learns realistic effort returns daily attention. Reliability here compounds across notifications, chores, trips, Calendar, and ERA.

Measure attention returned, conflict avoided, and outcomes improved—not engagement.

## Roadmap

1. Now — repair and generalize the cross-view recurrence contract, then define commitment semantics in TypeScript.
2. Next — capture estimated versus actual duration and completion context on one workflow.
3. Later — let plans adapt in shadow mode from repeated postponement and duration evidence.

## New opportunity set

### V1 — Commitment grammar

- **Mechanism:** Add must/should/could/if-context semantics separate from priority and recurrence.
- **Smallest proof:** Classify one week of items without changing ordering.
- **Success measure:** Disruption decisions become faster and fewer protected items move accidentally.
- **Kill criterion:** Keep only protected/flexible if four levels add hesitation.
- **Invariant:** Grammar never changes due dates without confirmation.

### V2 — Duration calibration

- **Mechanism:** Compare estimated and actual active time, using coarse buckets when exact timers are inappropriate.
- **Smallest proof:** Track ten repeated routines.
- **Success measure:** Median planning error drops after one adjustment cycle.
- **Kill criterion:** Use manual defaults if capture costs more attention than it saves.
- **Invariant:** Missing completion time is unknown, never zero.

### V3 — Completion evidence modes

- **Mechanism:** Let selected items close by acknowledgement, photo/NFC evidence, external calendar state, or dependent result.
- **Smallest proof:** Trial one chore and one external appointment.
- **Success measure:** Completion meaning is unambiguous without burdening routine tasks.
- **Kill criterion:** Limit evidence to high-value templates if ignored.
- **Invariant:** Evidence mode is configured; the app never fabricates proof.

## Existing-roadmap boundary

Week-shape, overdue roll-forward, recurrence edit scopes, bulk occurrence actions, pressure index, and generic intent-aware planning already exist in prior roadmaps.

## Strategy guardrail

Start read-only or in shadow mode. Persist, notify, or automate only after a real proof passes its gate.

