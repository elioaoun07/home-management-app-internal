---
created: 2026-07-11
type: fabled-plus-index
status: current
scope: feature
feature: Theming
module_type: Cross-Cutting
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Theming · FABLED+ Index

> [FABLED+ root](<../../../_index.md>) · **Theming** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

> **Verdict:** A mature identity system with blue, pink, frost, and calm themes, person-absolute colors, CSS variables, and theme classes, but visual preference, accessibility function, motion, and expensive global cache invalidation are coupled.

## Loop-readiness score

| Dimension | Score |
|---|---:|
| **Truth** | 4/5 |
| **Capture** | 4/5 |
| **Decision** | 2/5 |
| **Action safety** | 3/5 |
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

- `ERA Notes/01 - Architecture/Feature Map/cross-cutting/theming.md`
- `ERA Notes/01 - Architecture/Color Identity.md`
- `src/contexts/ThemeContext.tsx`
- `src/hooks/useThemeClasses.ts`
- `src/app/globals.css`
- `src/lib/queryInvalidation.ts`

## Non-duplication boundary

Theme contrast certification, accessibility floor, and density modes are existing roadmap items; this pack separates functional layers and validates invalidation cost.

