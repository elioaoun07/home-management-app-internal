---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Theming
module_type: Cross-Cutting
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Theming · Feature State

> [FABLED+ root](<../../../_index.md>) · **Theming** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A mature identity system with blue, pink, frost, and calm themes, person-absolute colors, CSS variables, and theme classes, but visual preference, accessibility function, motion, and expensive global cache invalidation are coupled.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/cross-cutting/theming.md`
- `ERA Notes/01 - Architecture/Color Identity.md`
- `src/contexts/ThemeContext.tsx`
- `src/hooks/useThemeClasses.ts`
- `src/app/globals.css`
- `src/lib/queryInvalidation.ts`

Checked against the 2026-07-11 working tree; source wins over docs.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Theme and user identity preferences are known. |
| **Interpret** | Context/classes select tokens. |
| **Propose** | Users choose themes. |
| **Commit** | Theme updates data-theme and invalidates queries. |
| **Verify** | Contrast/motion/accessibility are not continuously certified. |
| **Learn** | Usage context and reversals do not guide safer defaults. |

## Existing leverage

- Person-absolute color identity is a rare and thoughtful household UX rule.
- CSS variables and theme classes centralize many surfaces.
- Multiple themes support personal expression and environmental comfort.

## Feedback, friction, and risk

- Functional needs such as high contrast, low motion, night, and guest visibility are mixed with identity aesthetics.
- The hard rule that theme changes invalidate all queries protects identity correctness but makes presentation changes operationally expensive.
- Raw color/opacity usage across large components can bypass semantic intent despite theme classes.

## Study conclusion

**Inference:** Separate identity from function: person color remains absolute, while accessibility, motion, contrast, and environment become composable semantic layers.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/contexts/ThemeContext.tsx" "src/hooks/useThemeClasses.ts" "src/app/globals.css" "src/lib/queryInvalidation.ts"

Trace all consumers before implementation.

