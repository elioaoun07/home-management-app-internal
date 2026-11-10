---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit 8da80ae, 2026-11-10."
---

# Coverage map — what earlier passes covered and what this one adds

[Fable 2 index](<../_index.md>) · [Method and evidence](<Method and Evidence.md>)

## Earlier analysis in the repository

| Body of work | Date | Where | Depth in this pass |
|---|---|---|---|
| FABLE consultation and testament | 2026-07-06, 2026-07-18 | `_Archive/` | Testament read |
| FABLED, FABLED 2, FABLED 3 audit generations | to 2026-07-18 | Vault sections `01`, `06`, `07`, `Templates`; campaign copies in `_Archive/` | One index read (Architecture FABLED 3); the rest listed |
| PM refactor and campaign Master Books | 2026-09-10 onward | Eleven campaign folders | Delivery and PM Tooling checklists read; Delivery book state, decisions and pains skimmed; Budget book searched; others counted |
| Command Center product plan, Delivery V2 plan | 2026-09-11 onward | `Plans/` | Outlines read; readiness contract read |
| ASTRA studies (Command Center V2, proactive ERA, unknown unknowns, catalogue) | September | `docs/` | Outline of one read |
| Delivery consumption and UAT documents | September–October | `Research/`, `docs/Delivery-*` | `docs/Delivery-Requests.md` read; the rest listed |
| ERA research packs, 14 folders | 2026-11-04 to 11-07 | `docs/era-research/` | Synthesis entry page read; the rest listed |
| Major Bug Sweep | 2026-11-04 | `Research/Major Bug Sweep.md` | Summary, fixes and dispositions read; S1 re-verified in source |

## How each was covered before, and what Fable 2 adds

| Topic | Before | Weakness found | Fable 2 |
|---|---|---|---|
| Delivery | Very deep on making the confined path correct | Never asked whether the confinement matches how the owner works | [Diagnosis](<../10 - Project Management/Delivery/1 - Diagnosis.md>), [Local lane](<../10 - Project Management/Delivery/2 - Local Lane Design.md>), [gate table](<../10 - Project Management/Delivery/3 - Gate Disposition.md>), [migration](<../10 - Project Management/Delivery/4 - Migration and Retirement.md>) |
| Command Center | Product plan and phases; many UI items | No review of the running app as a user meets it | [Usability and visual review](<../10 - Project Management/Command Center/1 - Usability and Visual Review.md>), [roadmap](<../10 - Project Management/Command Center/2 - Functional Roadmap.md>) |
| Environments | Hard Rule 26 forbids production writes | No document notes that production is the only environment, or that the deny list is name-specific | [Environments and data safety](<../01 - Architecture/Environments and Data Safety.md>) |
| Testing | Item-level test requests (BUD-74 and others) | No whole-repo picture of where tests are | [Verification pyramid](<../01 - Architecture/Verification Pyramid.md>), [module matrix](<../02 - Standalone Modules/_Module Evidence Matrix.md>) |
| Agent cost | Token studies of Delivery runs | Nothing on the cost of the repo's own reading rules | [Agent context economy](<../01 - Architecture/Agent Context Economy.md>) |
| Money defects | Thorough (Budget book, sweep) | Sweep findings never filed; one cache header missed | [Research-to-queue leak](<../10 - Project Management/Portfolio/Research-to-Queue Leak.md>), [cache header](<../02 - Standalone Modules/Transactions/Shared-Cache Header on the Transactions Read.md>) |
| Household access | Item-level (HUB-121, BUD-91) | No inventory of the service-role surface | [Service-role surface](<../03 - Junction Modules/Household Sharing/Service-Role Authorization Surface.md>) |
| Exactly-once | Twelve separate items | No shared contract | [Exactly-once](<../03 - Junction Modules/Sync & Offline/Exactly-Once Remains Open.md>) |
| Portfolio | Conventions and lint | No look at arrival versus departure | [Backlog health](<../10 - Project Management/Portfolio/Backlog Health.md>) |
| Model choice | Registry of aliases | No per-item routing | [Model tiers](<../Model Tiers/_Routing.md>) |
| Agent setup | Skills, hooks and rules written and listed in `docs/Skills-and-Agents.md` | No view of the whole, no per-agent parity, no deterministic evaluation of sessions | [Agentic OS](<../Agentic OS/_index.md>) |

## Still not covered by anyone

These need their own sessions; the first four are specified as studies in the [high-tier packets](<../Model Tiers/CLAUDE_HIGH/Work Packets.md>).

- Balance invariant across all write paths (H1).
- Household visibility model against a fresh RLS snapshot (H3).
- The two recurrence engines (H4).
- AI data egress by provider and data class (H5).
- Product rendering: accessibility, performance, bundle size, mobile layout.
- Push delivery and cron scheduling in production (existing HUB-38 owns liveness).
- The native app shell and Wear OS.
- The phone relay and the classic Command Center UI.
