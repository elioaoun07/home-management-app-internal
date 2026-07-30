---
created: 2026-07-11
type: fabled-plus-index
status: current
scope: feature
feature: AI Assistant
module_type: Junction
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# AI Assistant · FABLED+ Index

> [FABLED+ root](<../../../_index.md>) · **AI Assistant** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> **Verdict:** A powerful junction with Gemini fallback, intent routing, faces, context, TTS, and analysis contracts, but its capability boundary is described by code paths rather than one enforceable contract for evidence, permission, uncertainty, inverse, and outcome.

## Loop-readiness score

| Dimension | Score |
|---|---:|
| **Truth** | 3/5 |
| **Capture** | 4/5 |
| **Decision** | 4/5 |
| **Action safety** | 2/5 |
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

- `ERA Notes/01 - Architecture/Feature Map/junction/ai-assistant.md`
- `ERA Notes/03 - Junction Modules/AI Assistant/Overview.md`
- `src/features/era`
- `src/lib/ai/gemini.ts`
- `src/lib/ai/analysisReport.ts`
- `src/app/api/ai-chat/route.ts`
- `src/components/ai/AIChatAssistant.tsx`

## Non-duplication boundary

One assistant registry, proactive briefing, memory-grounded ERA, generic multi-turn flows, wake word, and AnalysisReport reuse are existing plans; this pack adds enforceable capability contracts and calibration.

