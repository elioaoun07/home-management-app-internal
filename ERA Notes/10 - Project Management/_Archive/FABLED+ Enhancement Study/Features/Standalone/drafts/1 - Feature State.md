---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Drafts
module_type: Standalone
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Drafts · Feature State

> [FABLED+ root](<../../../_index.md>) · **Drafts** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

The product's strongest trust pattern—AI proposes and a human commits—implemented as a usable inbox, but proposal quality, expiry, risk, shared approval, and post-commit learning remain implicit.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/standalone/drafts.md`
- `ERA Notes/02 - Standalone Modules/Drafts/Overview.md`
- `src/features/drafts/useDrafts.ts`
- `src/components/drafts/DraftsDrawer.tsx`
- `src/app/api/drafts/route.ts`
- `src/app/api/drafts/[id]/route.ts`
- `src/features/hub/messageActions.ts`

Checked against the 2026-07-11 working tree; current source wins over documentation.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Proposed payloads and their source context are captured. |
| **Interpret** | The user reviews a structured proposal. |
| **Propose** | This is the module's primary job and a distinctive product strength. |
| **Commit** | Confirmation hands off to trusted mutation paths. |
| **Verify** | Post-commit effect and expiry/risk are not consistently summarized. |
| **Learn** | Accept, edit, reject, expire, and Undo outcomes are not systematically used to improve proposals. |

## Existing leverage

- Drafts are the app's consent layer for AI and parsed actions.
- Human confirmation separates uncertain interpretation from money/schedule mutation.
- A shared pattern can serve multiple modules without granting the model direct authority.

## Feedback, friction, and risk

- Drafts can look equivalent even when one is low-risk categorization and another changes money or schedule.
- A stale proposal may remain actionable after its source facts changed.
- Shared proposals need clear owner, required approvers, objections, and expiry rather than a generic inbox.

## Study conclusion

**Inference:** Evolve drafts into a universal proposal contract: provenance, risk, preconditions, predicted effects, consent, expiry, receipt, and learning outcome.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/features/drafts/useDrafts.ts" "src/components/drafts/DraftsDrawer.tsx" "src/app/api/drafts/route.ts" "src/app/api/drafts/[id]/route.ts"

Re-read every mutating route and run focused tests before implementation.

