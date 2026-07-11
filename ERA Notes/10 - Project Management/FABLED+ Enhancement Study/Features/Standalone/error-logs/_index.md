---
created: 2026-07-11
type: fabled-plus-index
status: current
scope: feature
feature: Error Logs
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Error Logs · FABLED+ Index

> [FABLED+ root](<../../../_index.md>) · **Error Logs** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> **Verdict:** A persistent error viewer exists, but the codebase still contains hundreds of console calls and the mapped logger utility is absent, leaving operational knowledge split between structured records, browser noise, and silent catches.

## Loop-readiness score

| Dimension | Score |
|---|---:|
| **Truth** | 3/5 |
| **Capture** | 2/5 |
| **Decision** | 1/5 |
| **Action safety** | 2/5 |
| **Learning** | 2/5 |
| **Partnership** | 1/5 |
| **Total** | **11/30** |

Loop readiness measures closed-loop value, not FABLED maturity.

## Pack

1. [Feature State](<1 - Feature State.md>)
2. [Vision & Roadmap](<2 - Vision & Roadmap.md>)
3. [Action Plan](<3 - Action Plan.md>)
4. [Checklist](<4 - Checklist.md>)

## Evidence anchors

- `ERA Notes/01 - Architecture/Feature Map/standalone/error-logs.md`
- `ERA Notes/02 - Standalone Modules/Error Logs/Overview.md`
- `src/app/error-logs/page.tsx`
- `src/app/api/error-logs/route.ts`
- `migrations/schema.sql`
- `src/lib/safeFetch.ts`
- `src/features/voice-conversation/conversationEngine.ts`

## Non-duplication boundary

Generic error-log persistence already exists; this pack emphasizes causal grouping, recovery, and conversion into protection.

