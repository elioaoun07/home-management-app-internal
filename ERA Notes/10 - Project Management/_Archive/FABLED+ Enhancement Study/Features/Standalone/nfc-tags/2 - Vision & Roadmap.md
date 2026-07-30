---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: NFC Tags
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# NFC Tags · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **NFC Tags** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Make every physical tap accountable: context preview, idempotent receipt, actor-aware scope, and evidence that the tag still earns its place.

## Business and household value

NFC is a rare moat because it turns the home into an interface. Reliability and legibility, not more tag actions, determine whether it becomes habit.

Measure attention returned, conflict avoided, and outcomes improved—not engagement.

## Roadmap

1. Now — define tap identity, dedupe, and receipt semantics for each action class.
2. Next — add context preview and a physical deployment health review.
3. Later — allow bounded context profiles only after replay safety is proven.

## New opportunity set

### V1 — Tap receipt

- **Mechanism:** Return actor, tag, intended action, effect, dedupe key, time, and Undo/inverse in one compact receipt.
- **Smallest proof:** Implement read-only receipts for three existing tag types.
- **Success measure:** Repeated taps are explainable and produce no duplicate effects.
- **Kill criterion:** Use silent success for pure navigation tags.
- **Invariant:** A retry with the same identity cannot repeat a mutation.

### V2 — Context-bound tag

- **Mechanism:** Allow a tag to select among predeclared profiles by actor or household mode, with preview before material action.
- **Smallest proof:** Use one tag with home/trip or mine/shared profiles.
- **Success measure:** One physical tag replaces duplicate placement without surprising action.
- **Kill criterion:** Keep one-tag-one-action if preview adds friction.
- **Invariant:** Context never broadens permissions beyond tag policy.

### V3 — Physical utility audit

- **Mechanism:** Track successful taps, cancellations, errors, and last-seen to flag dead or confusing tags.
- **Smallest proof:** Review all deployed tags after four weeks.
- **Success measure:** At least one tag is moved, relabeled, or retired based on evidence.
- **Kill criterion:** Use manual audit if telemetry is too sparse.
- **Invariant:** No location tracking beyond explicit tag interactions.

## Existing-roadmap boundary

House API, arrive-home triggers, and broad automation mining are prior ideas; this pack focuses on physical reliability and replay safety.

## Strategy guardrail

Start read-only or in shadow mode; earn persistence, notification, and automation.

