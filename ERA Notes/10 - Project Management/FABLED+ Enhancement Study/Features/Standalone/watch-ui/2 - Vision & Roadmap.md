---
created: 2026-07-11
type: fabled-plus-vision-roadmap
status: current
scope: feature
feature: Watch UI
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Watch UI · Vision & Roadmap

> [FABLED+ root](<../../../_index.md>) · **Watch UI** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Enhancement thesis

Design the watch as an interruption-budgeted companion: glance, micro-confirm, haptic truth, and seamless handoff—never a compressed full app.

## Business and household value

The watch earns value through seconds saved in the right moments. A small reliable surface strengthens capture habit; a broad unreliable one damages trust.

Measure attention returned, conflict avoided, and outcomes improved—not engagement.

## Roadmap

1. Now — define watch action classes and their offline/haptic truth states.
2. Next — implement resumable phone handoff for uncertain captures.
3. Later — retain only interactions proven faster and safer than reaching for the phone.

## New opportunity set

### V1 — Haptic truth vocabulary

- **Mechanism:** Use distinct accessible patterns for accepted locally, synced, needs review, and failed.
- **Smallest proof:** Prototype four states with visual fallback.
- **Success measure:** Users identify state correctly without reading text in most trials.
- **Kill criterion:** Use two patterns plus text if four are confusing.
- **Invariant:** Accepted locally is never signaled as server-synced.

### V2 — Resumable capture handoff

- **Mechanism:** Send an incomplete/uncertain draft to the phone with exact context and cursor state.
- **Smallest proof:** Handoff one low-confidence voice expense.
- **Success measure:** Completion on phone takes under 15 seconds with no re-entry.
- **Kill criterion:** Keep watch capture to high-confidence actions if handoff is rarely finished.
- **Invariant:** Uncertain money remains a draft.

### V3 — Glance budget

- **Mechanism:** Limit watch surfaces to information actionable within a configured number of seconds.
- **Smallest proof:** Time current interactions and remove one over-budget path.
- **Success measure:** Median useful interaction stays under ten seconds.
- **Kill criterion:** Use the watch only for capture if glance data has no decisions.
- **Invariant:** Urgency and privacy are preserved on the lock/glance surface.

## Existing-roadmap boundary

Voice personas, wake word, and generic deep links are prior ideas; this pack defines watch-specific truth and handoff.

## Strategy guardrail

Start read-only or in shadow mode; earn persistence, notification, and automation.

