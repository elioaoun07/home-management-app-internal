---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: AI Assistant
module_type: Junction
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# AI Assistant · Feature State

> [FABLED+ root](<../../../_index.md>) · **AI Assistant** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A powerful junction with Gemini fallback, intent routing, faces, context, TTS, and analysis contracts, but its capability boundary is described by code paths rather than one enforceable contract for evidence, permission, uncertainty, inverse, and outcome.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/junction/ai-assistant.md`
- `ERA Notes/03 - Junction Modules/AI Assistant/Overview.md`
- `src/features/era`
- `src/lib/ai/gemini.ts`
- `src/lib/ai/analysisReport.ts`
- `src/app/api/ai-chat/route.ts`
- `src/components/ai/AIChatAssistant.tsx`

Checked against the 2026-07-11 working tree; source wins over docs.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Cross-module context and conversation are assembled. |
| **Interpret** | Intent routing and models infer need. |
| **Propose** | Reports, drafts, and answers are produced. |
| **Commit** | Some actions hand off to mutations, with uneven capability-specific safety. |
| **Verify** | Provenance and exact predicted effects are not universal. |
| **Learn** | Corrections, clarifications, and proposal outcomes do not calibrate each capability. |

## Existing leverage

- Intent resolvers and formatters separate some reasoning from presentation.
- Gemini fallback and deterministic AnalysisReport protect against malformed or unavailable model output.
- Draft/review patterns and ERA faces provide a strong trust and interaction vocabulary.

## Feedback, friction, and risk

- A capability cannot be inspected in one place for required evidence, permission, risk, timeout, fallback, inverse, and test fixtures.
- Confidence is not calibrated per intent and user; one global threshold would hide different money, schedule, and lookup risks.
- Multi-step reasoning cannot be safely rehearsed against current state before a user sees or confirms it.

## Study conclusion

**Inference:** Make ERA a compiler of bounded, inspectable capabilities: evidence in, typed plan out, shadow evaluation, human decision, deterministic commit, outcome receipt.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/features/era" "src/lib/ai/gemini.ts" "src/lib/ai/analysisReport.ts" "src/app/api/ai-chat/route.ts"

Trace every connected standalone before implementation.

