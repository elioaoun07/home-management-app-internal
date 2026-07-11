---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: NFC Tags
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# NFC Tags · Feature State

> [FABLED+ root](<../../../_index.md>) · **NFC Tags** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A distinctive physical-world interface with slug routes, state log, checklists, and prerequisite triggers, but a tap's identity, replay behavior, context, and physical reliability are not yet a visible user contract.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/standalone/nfc-tags.md`
- `ERA Notes/02 - Standalone Modules/NFC Tags/Overview.md`
- `src/features/nfc/hooks.ts`
- `src/app/nfc/[tag]`
- `src/app/nfc/nfc-admin-client.tsx`
- `src/app/api/nfc`
- `migrations/schema.sql`

Checked against the 2026-07-11 working tree; source wins over docs.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Tag, actor, state, checklist, and history can be captured. |
| **Interpret** | Slug configuration determines action. |
| **Propose** | Some flows show prompts before action. |
| **Commit** | Tap can trigger logs, checklist, transfer, or prerequisite effects. |
| **Verify** | Replay/idempotency and physical tag health are not consistently surfaced. |
| **Learn** | The system does not measure dead, confusing, or low-value tag placement. |

## Existing leverage

- Physical tap-to-action dramatically lowers capture cost.
- Slug URLs, state log, checklist completion, and prerequisites create a reusable trigger substrate.
- Admin and history surfaces support real deployment around the home.

## Feedback, friction, and risk

- Repeated taps, browser retries, two phones, and stale pages need one explicit action receipt and dedupe window.
- A tag's meaning may depend on place, mode, actor, or time, but context is mostly hidden configuration.
- Physical failures—damaged tag, moved object, confusing label—look like feature non-use.

## Study conclusion

**Inference:** Make every physical tap accountable: context preview, idempotent receipt, actor-aware scope, and evidence that the tag still earns its place.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/features/nfc/hooks.ts" "src/app/nfc/[tag]" "src/app/nfc/nfc-admin-client.tsx" "src/app/api/nfc"

Run focused tests and read mutating routes before implementation.

