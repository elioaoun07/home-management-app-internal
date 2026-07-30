---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Hub Chat
module_type: Junction
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Hub Chat · Feature State

> [FABLED+ root](<../../../_index.md>) · **Hub Chat** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

The true top-layer interface with private/shared threads, shopping, notes, item chat, message actions, voice, receipts, and recent notification-policy hardening, yet long-lived work is still encoded mainly as message chronology.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/junction/hub-chat.md`
- `ERA Notes/03 - Junction Modules/Hub Chat/Overview.md`
- `src/components/hub/HubPage.tsx`
- `src/features/hub/hooks.ts`
- `src/app/api/hub/messages/route.ts`
- `src/app/api/hub/mark-read/route.ts`
- `src/features/hub/chatNotificationPolicy.ts`

Checked against the 2026-07-11 working tree; source wins over docs.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Messages, receipts, typing, threads, items, media, and actions are captured. |
| **Interpret** | Thread type and parsers infer context. |
| **Propose** | Message actions and ERA can propose structured records. |
| **Commit** | Confirmed actions mutate connected modules. |
| **Verify** | Action/receipt state exists but workflow completion is fragmented. |
| **Learn** | Conversation corrections and abandoned workflows do not systematically improve orchestration. |

## Existing leverage

- Hub is already the highest-frequency capture and collaboration layer.
- Recent message/receipt changes and policy tests improve household notification correctness.
- Threads, item chat, shopping, notes, voice, and actions provide rich context for durable workflows.

## Feedback, friction, and risk

- A 5,978-line HubPage concentrates unrelated interaction policy and makes semantic changes risky.
- Chronology is a poor state model for interrupted decisions; users must reconstruct what is decided, pending, or blocked.
- Thread summaries can lose provenance or become stale unless they are tied to exact source messages and structured state.

## Study conclusion

**Inference:** Evolve Hub from a message feed into a resumable household workspace where decisions and workflows have explicit checkpoints while conversation remains natural.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/components/hub/HubPage.tsx" "src/features/hub/hooks.ts" "src/app/api/hub/messages/route.ts" "src/app/api/hub/mark-read/route.ts"

Trace every connected standalone before implementation.

