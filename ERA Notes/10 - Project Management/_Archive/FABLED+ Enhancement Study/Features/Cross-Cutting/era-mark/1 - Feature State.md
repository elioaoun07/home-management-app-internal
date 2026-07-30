---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: ERA Mark
module_type: Cross-Cutting
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# ERA Mark · Feature State

> [FABLED+ root](<../../../_index.md>) · **ERA Mark** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A distinctive animated identity asset with futuristic visual language, but its motion and state are primarily decorative rather than a consistent, accessible contract for listening, thinking, offline, uncertain, and complete.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/cross-cutting/era-mark.md`
- `ERA Notes/04 - UI & Design/ERAMark`
- `src/components/era`
- `src/components/icons/FuturisticIcons.tsx`
- `src/app/globals.css`

Checked against the 2026-07-11 working tree; source wins over docs.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | UI/application state can drive variants. |
| **Interpret** | Components choose visual state. |
| **Propose** | The mark signals presence more than a decision. |
| **Commit** | No domain mutation. |
| **Verify** | Users may not know what each motion means. |
| **Learn** | No evidence shows which states help or distract. |

## Existing leverage

- The mark gives ERA a recognizable presence across surfaces.
- Animation can communicate state without additional text.
- The existing futuristic icon system supports visual consistency.

## Feedback, friction, and risk

- Similar glow/motion can imply listening, processing, success, or decoration inconsistently.
- Motion, color, reduced-motion, and screen-reader equivalents need one semantic grammar.
- Persistent animation can consume attention and battery on mobile/watch surfaces.

## Study conclusion

**Inference:** Turn the mark into calm system language: a small finite state grammar with redundant text/haptic cues, strict motion budget, and no false certainty.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/components/era" "src/components/icons/FuturisticIcons.tsx" "src/app/globals.css"

Trace all consumers before implementation.

