---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: AI Usage
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# AI Usage · Feature State

> [FABLED+ root](<../../../_index.md>) · **AI Usage** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A rare built-in model/session usage surface that makes AI consumption visible, but it measures supply—models, sessions, tokens—more than delivered value, privacy exposure, or fallback quality.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/standalone/ai-usage.md`
- `ERA Notes/02 - Standalone Modules/AI Usage/Overview.md`
- `src/features/ai-usage/hooks.ts`
- `src/components/ai-usage`
- `src/app/api/ai-usage`
- `src/lib/ai/gemini.ts`
- `migrations/schema.sql`

Checked against the 2026-07-11 working tree; source wins over docs.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Model/session usage metadata is captured. |
| **Interpret** | The UI groups usage by model and session type. |
| **Propose** | Little guidance exists on where AI earns its cost. |
| **Commit** | Settings/metadata change, not household state. |
| **Verify** | Fallback and outcome quality are not consistently joined to a call. |
| **Learn** | Accepted, corrected, ignored, and failed outcomes do not drive an intelligence budget. |

## Existing leverage

- Models and session types have explicit persisted concepts.
- The Gemini layer already distinguishes quota failure and deterministic fallback paths.
- Usage can become an operational gauge without a third-party analytics vendor.

## Feedback, friction, and risk

- Token/call counts cannot say whether a feature saved attention or caused correction work.
- Users cannot see which household context left the app for a model call.
- Quota degradation is engineered but not rehearsed as a visible product contract per feature.

## Study conclusion

**Inference:** Turn AI usage into an accountability ledger: value delivered, data exposed, fallback used, outcome observed, and degradation promised.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/features/ai-usage/hooks.ts" "src/components/ai-usage" "src/app/api/ai-usage" "src/lib/ai/gemini.ts"

Run focused tests and inspect consumers before implementation.

