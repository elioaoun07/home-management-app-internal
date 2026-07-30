---
created: 2026-07-13
updated: 2026-07-13
type: index
status: living
owner: Elio
tags: [pm/index, tooling/pm-dashboard]
---

# PM Dashboard Refactor — Command Center

> Implementation trace for the Preact/esbuild rebuild of the owner’s Project Management dashboard. It reads the PM corpus and preserves the localhost-only mutation and Delivery contracts.

| # | File | Read it when... |
|---|---|---|
| 1 | [Feature State](<1 - Feature State.md>) | You need shipped reality and evidence. |
| 2 | [Vision & Roadmap](<2 - Vision & Roadmap.md>) | You need decisions and remaining polish. |
| 3 | [Action Plan](<3 - Action Plan.md>) | You need the implementation sequence. |
| 4 | [Checklist](<4 - Checklist.md>) | You are executing or validating a phase. |

## Scope contract

- Markdown semantics and the seven existing mutation operations stay unchanged.
- `scripts/delivery/*` remains the authoritative Delivery implementation.
- Static `_dashboard.html` stays offline and read-only.
- Git writes remain permanently out of scope.

