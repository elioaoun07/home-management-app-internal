---
created: 2026-07-11
type: fabled-plus-feature-state
status: current
scope: feature
feature: Atlas
module_type: Cross-Cutting
evidence_cutoff: 2026-07-11
baseline: FABLED 2 plus current working-tree delta
---

# Atlas · Feature State

> [FABLED+ root](<../../../_index.md>) · **Atlas** · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)

## Current verdict

A generated in-app map of pages and features that improves discoverability, but many entries remain TODO-shaped and it models intended topology more strongly than runtime use, evidence freshness, and change impact.

## Verified footprint

- `ERA Notes/01 - Architecture/Feature Map/cross-cutting/atlas.md`
- `ERA Notes/04 - UI & Design/Page & Feature Atlas/_Index.md`
- `src/app/atlas/page.tsx`
- `src/features/atlas`
- `scripts/build-atlas.mjs`
- `scripts/seed-atlas.mjs`
- `public/atlas/atlas.json`

Checked against the 2026-07-11 working tree; source wins over docs.

## Outcome loop

| Stage | Current state |
|---|---|
| **Observe** | Pages/features and authored metadata are scanned. |
| **Interpret** | Builder creates nodes, parent/children, routes, and sections. |
| **Propose** | Atlas helps users/agents choose where to go. |
| **Commit** | Docs changes regenerate JSON. |
| **Verify** | TODO fields and stale source references are not a confidence score. |
| **Learn** | Runtime journeys and change impact do not refine the map. |

## Existing leverage

- Atlas generation makes new routes and features mechanically visible.
- Markdown source preserves human notes while JSON serves the app.
- The feature can connect navigation, docs, and implementation without another database.

## Feedback, friction, and risk

- A node can look authoritative while files, hooks, tables, or links are placeholders.
- Static parent/child structure does not show actual cross-feature flows or dependency blast radius.
- The Atlas cannot answer whether a route is used, abandoned, or inaccessible to one viewer/device.

## Study conclusion

**Inference:** Make Atlas an evidence-rated operational topology: what exists, how fresh the proof is, who can reach it, and what a change would affect.

## Re-verify

    git log --oneline --since="2026-07-02" -- "src/app/atlas/page.tsx" "src/features/atlas" "scripts/build-atlas.mjs" "scripts/seed-atlas.mjs"

Trace all consumers before implementation.

