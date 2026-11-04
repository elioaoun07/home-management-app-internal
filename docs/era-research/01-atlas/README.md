---
created: 2026-11-04
updated: 2026-11-04
type: index
status: draft
owner: Elio
evidence_cutoff: "commit 53443c0 (2026-11-04 20:36 +0200)"
---

# ERA Atlas (01)

A capability and architecture atlas of the whole ERA repository: what exists, how it connects, how five real journeys run through it, and what a change would touch. Written from source, migrations and documents at commit `53443c0`. Nothing was run against production, a device or a paid API.

## Files

| File                                             | Use it to                                                                                                                                                                                                                                                                                |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [CAPABILITY-MAP.md](CAPABILITY-MAP.md)           | See every capability by life area, classified **Implemented / Partial / Documented-only / Unclear**, with entry points, persistence, AI features, integrations and background processes.                                                                                                 |
| [ARCHITECTURE.md](ARCHITECTURE.md)               | Understand the layers, data-access styles, caches and write contracts; read the findings (duplicated responsibilities, isolated modules, undocumented behaviour, stale docs), three proposals, and the owner decisions. Starts with the **reader guide for returning after six months**. |
| [CRITICAL-FLOWS.md](CRITICAL-FLOWS.md)           | Follow five journeys step by step (a spend on a weak connection, an ERA reminder, a shared shopping list, a medication course, a phone-approved Delivery), with failure cases and fictional acceptance examples.                                                                         |
| [CHANGE-IMPACT-GUIDE.md](CHANGE-IMPACT-GUIDE.md) | Before editing a shared component: its consumers, how a mistake would show up, which existing checks to run and which steps only the owner can take.                                                                                                                                     |

## Labels used throughout

- **CURRENT IMPLEMENTATION**: read in code or migrations at `53443c0`.
- **DOCUMENTED INTENT**: stated in repo documents, not fully confirmed in code.
- **PROPOSED DESIGN**: this atlas's suggestion; only in ARCHITECTURE §9.
- **UNKNOWN**: not answerable from the repo (deployment, applied migrations, live RLS, scheduler, devices, real use).
- **⛁**: needs a migration newer than the 2026-08-04 RLS snapshot; whether it was applied is unknown.

## Relationship to existing documents

This atlas does not replace the vault. It cites, and does not repeat, two same-day audits: [Major Bug Sweep](<../../../ERA Notes/10 - Project Management/Research/Major Bug Sweep.md>) (defect IDs such as `S1`, `M2`, `BUD-90`) and [Mutation Integrity Audit](<../../../ERA Notes/01 - Architecture/Mutation Integrity Audit.md>) ("Audit #n"). Plans, decisions and shipped work stay in each campaign's Master Book under `ERA Notes/10 - Project Management/`. No PM file was changed by this work: it is research documentation, not a product change.

## Limits

- Shallow clone: Git history before 2026-09-26 was not available.
- No `node_modules`: typecheck, lint and tests were not run for this atlas.
- `migrations/db-state.json` is 92 days old, so RLS and function claims are historical.
- External research: one web search corroborated the Next.js 16 `proxy` location; direct reads of `nextjs.org` and `vercel.com` were blocked by the session's network policy (checked 2026-11-04). Details in CAPABILITY-MAP §9.
- Usage, habits and deployed behaviour are not inferred from code anywhere in these files.
