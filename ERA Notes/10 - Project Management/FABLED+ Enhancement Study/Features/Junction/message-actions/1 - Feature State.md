---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Message Actions
module_type: Junction
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Message Actions · Feature State

> [FABLED+ root](<../../../_index.md>) · **Message Actions** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

An effective bridge from natural conversation to transactions, reminders, and items, but action safety is distributed across parsers, modals, drafts, APIs, and invalidations rather than one atomic plan and receipt.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/junction/message-actions.md`
- `ERA Notes/03 - Junction Modules/Message Actions/Overview.md`
- `src/features/hub/messageActions.ts`
- `src/lib/messageTransactionParser.ts`
- `src/app/api/hub/message-actions/route.ts`
- `src/components/hub`
- `src/lib/queryInvalidation.ts`

Checked against the 2026-07-11 working tree; source wins over docs.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Message text and thread context are captured. |
| **Interpret** | Parsers classify and extract candidate fields. |
| **Propose** | Structured review UI is shown. |
| **Commit** | Connected module mutations execute. |
| **Verify** | Receipts and idempotent multi-effect boundaries are inconsistent. |
| **Learn** | Edits, rejections, and Undo do not improve the parser/action contract broadly. |

## Existing leverage

- Messages can become structured records without opening precision forms.
- Human review modals preserve the proposal-before-action rule.
- Parsers and connected feature APIs provide reusable deterministic rails.

## Feedback, friction, and risk

- One message can imply multiple dependent actions, but partial success lacks a universal atomicity/compensation model.
- The same correction may be relearned separately by transaction, reminder, and item parsers.
- A user cannot always ask later what exact message created or changed a record and how to undo it.

## Study conclusion

**Inference:** Compile each message into a typed, idempotent action plan with explicit preconditions, effects, compensation, source receipt, and correction feedback.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/features/hub/messageActions.ts" "src/lib/messageTransactionParser.ts" "src/app/api/hub/message-actions/route.ts" "src/components/hub"

Trace every connected standalone before implementation.

