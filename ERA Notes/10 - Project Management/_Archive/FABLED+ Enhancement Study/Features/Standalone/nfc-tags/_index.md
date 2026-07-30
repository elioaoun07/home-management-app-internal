---
created: 2026-07-11
type: fabled-plus-index
status: current
scope: feature
feature: NFC Tags
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# NFC Tags · FABLED+ Index

> [FABLED+ root](<../../../_index.md>) · **NFC Tags** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> **Verdict:** A distinctive physical-world interface with slug routes, state log, checklists, and prerequisite triggers, but a tap's identity, replay behavior, context, and physical reliability are not yet a visible user contract.

## Loop-readiness score

| Dimension | Score |
|---|---:|
| **Truth** | 3/5 |
| **Capture** | 4/5 |
| **Decision** | 2/5 |
| **Action safety** | 4/5 |
| **Learning** | 1/5 |
| **Partnership** | 2/5 |
| **Total** | **16/30** |

Loop readiness measures closed-loop value, not FABLED maturity.

## Pack

1. [Feature State](<1 - Feature State.md>)
2. [Vision & Roadmap](<2 - Vision & Roadmap.md>)
3. [Action Plan](<3 - Action Plan.md>)
4. [Checklist](<4 - Checklist.md>)

## Evidence anchors

- `ERA Notes/01 - Architecture/Feature Map/standalone/nfc-tags.md`
- `ERA Notes/02 - Standalone Modules/NFC Tags/Overview.md`
- `src/features/nfc/hooks.ts`
- `src/app/nfc/[tag]`
- `src/app/nfc/nfc-admin-client.tsx`
- `src/app/api/nfc`
- `migrations/schema.sql`

## Non-duplication boundary

House API, arrive-home triggers, and broad automation mining are prior ideas; this pack focuses on physical reliability and replay safety.

