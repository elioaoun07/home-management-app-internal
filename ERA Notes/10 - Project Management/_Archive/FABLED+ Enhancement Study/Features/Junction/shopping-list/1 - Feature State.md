---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Shopping List
module_type: Junction
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Shopping List · Feature State

> [FABLED+ root](<../../../_index.md>) · **Shopping List** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A highly developed collaborative list with groups, drag/drop, batch actions, item links, chat, comparison, offline pending state, and recipe/inventory bridges, but in-store coordination and substitution decisions remain message-level conventions.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/junction/shopping-list.md`
- `ERA Notes/03 - Junction Modules/Shopping List/Overview.md`
- `src/components/hub/ShoppingListView.tsx`
- `src/features/hub/hooks.ts`
- `src/features/hub/itemLinksHooks.ts`
- `src/app/api/hub/shopping-groups/route.ts`
- `src/app/api/inventory/add-to-shopping/route.ts`

Checked against the 2026-07-11 working tree; source wins over docs.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Items, groups, links, photos, chat, status, and actors are captured. |
| **Interpret** | Grouping and linked product data organize shopping. |
| **Propose** | Comparison and recipe/inventory bridges suggest candidates. |
| **Commit** | Add, edit, group, complete, and delete flows work. |
| **Verify** | Who is buying what and whether a substitution is acceptable remain informal. |
| **Learn** | Purchased substitutions, quantities, and unresolved items do not improve later lists. |

## Existing leverage

- Capture from Hub, recipes, inventory, and direct list actions is exceptionally broad.
- Groups, item chat, links, comparison, batch selection, presence, and offline state support real household use.
- Realtime household context is visible in the shopping surface.

## Feedback, friction, and risk

- Two people shopping concurrently can duplicate effort because claiming/picking states are not a clear protocol.
- A substitution decision needs constraints—brand, size, allergy, maximum price—not just chat.
- Completion says acquired, but actual variant/quantity/price and failed-to-find outcome are weakly captured.

## Study conclusion

**Inference:** Make shopping a live acquisition protocol: claim, constraints, substitution decision, receipt, and handoff—without turning the list into inventory bureaucracy.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/components/hub/ShoppingListView.tsx" "src/features/hub/hooks.ts" "src/features/hub/itemLinksHooks.ts" "src/app/api/hub/shopping-groups/route.ts"

Trace every connected standalone before implementation.

