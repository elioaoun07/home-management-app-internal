---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Household Sharing
module_type: Junction
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Household Sharing · Feature State

> [FABLED+ root](<../../../_index.md>) · **Household Sharing** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A load-bearing two-person data architecture with household links, profiles, public/private flags, and person-absolute identity, but sharing semantics stop before negotiation, concurrent conflict, delegated stewardship, and auditable consent.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/junction/household-sharing.md`
- `ERA Notes/03 - Junction Modules/Household Sharing/Overview.md`
- `src/lib/accountAccess.ts`
- `src/app/api/household`
- `src/contexts/UserContext.tsx`
- `src/contexts/ThemeContext.tsx`
- `migrations/schema.sql`

Checked against the 2026-07-11 working tree; source wins over docs.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Links, profiles, ownership, visibility, and receipts are available in parts. |
| **Interpret** | APIs decide accessible household rows. |
| **Propose** | Few first-class shared decisions exist. |
| **Commit** | Each module mutates owned/shared data with varying semantics. |
| **Verify** | Cross-module partner visibility has little automated contract protection. |
| **Learn** | Conflicts, overrides, and consent outcomes do not improve sharing policy. |

## Existing leverage

- Exactly-two-person design is explicit rather than a late sharing bolt-on.
- Person-absolute colors stabilize identity across devices.
- Household-expanded reads and ownOnly/private semantics create a reusable access pattern.

## Feedback, friction, and risk

- Visibility is not consent: seeing a shared budget, meal, or task does not mean agreeing to its change.
- Concurrent edits and offline replay need explicit merge/conflict semantics per entity.
- One partner may steward a domain temporarily without owning all data; delegation is not a clear capability.

## Study conclusion

**Inference:** Advance from shared rows to household governance: explicit proposal, consent, conflict, delegation, expiry, and receipt—scoped to decisions that truly need them.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/lib/accountAccess.ts" "src/app/api/household" "src/contexts/UserContext.tsx" "src/contexts/ThemeContext.tsx"

Trace every connected standalone before implementation.

