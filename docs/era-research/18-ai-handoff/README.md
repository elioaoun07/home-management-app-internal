---
created: 2026-11-04
updated: 2026-11-04
type: index
status: draft
owner: Elio
evidence_cutoff: "commit 1c586d0 (2026-11-04)"
---

# ERA AI Handoff (18)

A compact way for a future AI session to enter the ERA repository and to leave it. It points at existing sources instead of repeating them. No code, hook, skill, `CLAUDE.md`, mirror, schema, data or PM file was changed.

## Files

| File | Use it to |
|---|---|
| [ERA-BRIEFING.md](ERA-BRIEFING.md) | Learn what ERA is, the module map, shared foundations, the constraints that bite hardest, where each kind of decision belongs, what is stable versus what must be refreshed, and when to update. |
| [NAVIGATION-GUIDE.md](NAVIGATION-GUIDE.md) | Decide which sources are authoritative, historical, or proposals; find the documents and code entry points for 22 kinds of task; keep one fact in one place. |
| [HANDOFF-TEMPLATE.md](HANDOFF-TEMPLATE.md) | Hand work over with objective, scope, decisions, evidence, changed files, validation actually performed, unresolved questions and next action, plus a fictional example. |

## Reading order

New to ERA: `CLAUDE.md`, then the Briefing, then the Navigation Guide for your task, then `start-task`. Ending a session: the Handoff Template.

## Relationship to other sources

`CLAUDE.md`, the skills in `.claude/skills/`, the hooks and the vault remain the authority; where this folder disagrees with them, they win. Deeper research: [01-atlas](../01-atlas/README.md), [08-shared-data](../08-shared-data/README.md), [19-business-rules](../19-business-rules/README.md).

## Limits

Written at commit `1c586d0` from file listings and reading. Nothing was run (no `node_modules`), and no production database, device, scheduler or paid API was touched. The Briefing's snapshot table is the only part that is meant to go stale.
