---
created: 2026-07-30
type: index
status: superseded
owner: Elio
tags:
  - pm/archive
---

# _Archive — superseded PM material

> **Nothing here is scanned by any PM tool.** The skip lives in `scripts/pm/scan.mjs`, so the `pnpm pm` server, the static dashboard build, the mobile bridge and `pnpm pm:lint` all ignore this folder. Everything stays in git for history and `rg`; open a file directly to read it.
>
> **Archived 2026-07-30** during the Book + Checklist consolidation: every campaign was reduced to `<Campaign> — Master Book.md` + `4 - Checklist.md`, with the essence of the retired files merged into the book. What is here is the pre-consolidation record, not a second source of truth. **If the archive and a Master Book disagree, the book wins.**

## Per-campaign originals

Each `<Campaign>/` mirror holds that campaign's retired `_index.md`, `1 - Feature State.md`, `2 - Vision & Roadmap.md`, `3 - Action Plan.md`, and whatever FABLED generations it had.

| Folder | What survives here that the book condenses |
|---|---|
| `Budget/` | the full sub-feature table with inline change-history prose; FABLED v1 / v2 / v3 |
| `Schedule/` | the complete recurrence-and-occurrence-actions audit, the type-taxonomy design, and the externally-authored "Simplify Mobile Schedule Entry" brief with its full reconciliation; FABLED v1 / v2 / v3 |
| `Kitchen/` · `Trips/` · `Hub & ERA/` | the uniform four-file set + FABLED v1 / v2 / v3. `Hub & ERA/FABLED/ERAHUB.MD` is a raw pasted planning transcript kept only as a curiosity |
| `Notifications & Alerts/` | the five-cluster pain inventory and the MoSCoW backlog; FABLED v2 / v3 (this campaign started at generation 2) |
| `Healthcare/` | FABLED 3 only — the module post-dates FABLED 2 |
| `Outfits/` | the four-file set plus the parked Claude Design support runbook |
| `Native App/` | the six-doc plan pack: current-state audit, architecture decision, platform integration spec, distribution runbooks, roadmap, risk register |
| `PM Dashboard Refactor/` | the dashboard-rebuild campaign files (now the PM Tooling campaign) |
| `Delivery 10x/` | the `whdv` session postmortem with its forensic timeline and salvage runbook, the full design-debates file, and the Cost Anatomy analysis |
| `Delivery Workspace/` | the DW durable-memory campaign, shipped in full (prefix retired, IDs never reused) |
| `Agentic Delivery Workspace/` | the base delivery architecture: state machine, packet, classifier, drivers, security, dashboard UX, roadmap |

## Whole-app studies and audits

| Folder | Why it's here |
|---|---|
| `FABLED+ Enhancement Study/` | a 209-file, template-uniform loop-readiness study over 40 feature dirs. It was always a study queue rather than an execution authority, and it was already hidden from the board |
| `FABLED 2/` · `FABLED 3/` | the PM machine's own meta-audits — merged into the PM Tooling Master Book |
| `Functional Architecture Review/` | the 2026-06-12 whole-app review against the proactive-assistant goal. Still the strategic map the ERA Awakening plan cites |
| `FAR Execution Checklist/` | the 13-week campaign derived from that review; its window has fully elapsed |
| `Codebase Audit 2026-07-01/` | the eight-doc audit pack with its remediation checklist |

These are **audit events, not state**. Their conclusions that still matter were carried into the campaign books; their checkboxes were never on the board.

## Retired root docs

| File | Successor |
|---|---|
| `1 - Codebase & AI Setup Audit.md` | the Codebase Audit pack, then the campaign books |
| `2 - Feature State — Current Reality.md` | each campaign's Master Book › Current State |
| `3 - Future Vision & Roadmap.md` | each campaign's Master Book › Vision & Decisions |
| `4 - This Week (Action Plan).md` | the weekly-file ritual was retired in favour of the board's Now lanes |
| `5 - P0 Automated Tests Implementation Notes.md` | the per-campaign test-protection scores |
| `6 - Optimized Claude Setup Structure.md` | largely realized — see `.claude/` |
| `FABLE — Final Consultation (2026-07-06).md` | superseded by [FABLE — Testament](<../FABLE — Testament (2026-07-18).md>) |

## Restoring something

`git mv` it back into the campaign folder and add it to the Master Book's Pointers section. But prefer merging the content into the book — the whole point of the consolidation was that a campaign has one place to look.
