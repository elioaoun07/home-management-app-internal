---
created: 2026-11-10
updated: 2026-11-10
type: study-index
status: active
owner: Elio
evidence_cutoff: "commit 8da80ae, 2026-11-10. Clean Linux container, no .env, no production access, no delivery run."
---

# Fable 2 — repository analysis and Command Center direction

[PM home](<../_index.md>) · [Conventions](<../_Conventions.md>) · [Method and evidence](<00 - Method & Coverage/Method and Evidence.md>) · [Coverage map](<00 - Method & Coverage/Coverage Map.md>)

**Owner commission, 2026-11-10.** A second whole-repository pass: cover what earlier passes missed or treated weakly, mark what needs a heavyweight model, and re-think the Command Center and Delivery so the owner can deliver locally, run UAT and ship with fewer restrictions. This folder is the analysis. The work it produced is in the campaign checklists and shows in the Command Center like any other item; the folder itself is not a queue and holds no checkboxes.

It is a named exception to `_Conventions.md` §3 and §8, which otherwise forbid new audit generations and model-named studies. **Retire it** to `_Archive/Studies/Fable 2/` when every item in the table at the bottom is shipped, cancelled or merged.

## Verdict

1. **The product's engineering is sound where it is recent** (ERA, Healthcare, Fitness, Transfers) and thin where it is oldest and matters most: the money core has almost no tests and half its routes take unvalidated input.
2. **The delivery tool is over-built for how it is used.** It confines an untrusted worker; the owner supervises a trusted one. Typecheck and the full test suite run on the host in under four minutes and CI is green, so a branch, a worktree, a scrubbed environment and an owner merge do the job. Design: the [Local lane](<10 - Project Management/Delivery/2 - Local Lane Design.md>).
3. **The real exposure is that production is the only environment**, and the rule that protects it is enforced by tool names that differ in cloud sessions.
4. **Analysis is not reaching the queue.** Fifteen defects found on 2026-11-04, four critical, were in no checklist. They are filed now.
5. **The backlog is growing, not draining:** 243 open before this filing, 5 shipped records in 14 days, none in the last 7.

## Findings and where each went

Labels `F2-n` are local to this folder. Every finding has one disposition.

| # | Finding | Evidence | Disposition |
|---|---|---|---|
| F2-01 | Delivery's confinement protects what git already recovers; production keys, paid APIs and `main` are the real assets | Read | [DLV-150](<../Delivery/Delivery — Master Book.md#dlv-150>), [DLV-152](<../Delivery/Delivery — Master Book.md#dlv-152>) |
| F2-02 | Eleven launch gates, pairing on loopback, expiring grants; three checks suffice for supervised use | Read, seen | [DLV-151](<../Delivery/Delivery — Master Book.md#dlv-151>) |
| F2-03 | The host suite is a sufficient independent checker (85 s typecheck, 134 s tests) | Measured | DLV-150 |
| F2-04 | Landing by frozen diff and integrator where a merge and a revert would do | Read | [DLV-153](<../Delivery/Delivery — Master Book.md#dlv-153>) |
| F2-05 | No non-production database exists | Read | [DLV-154](<../Delivery/Delivery — Master Book.md#dlv-154>) |
| F2-06 | About 35,000 lines of frozen or superseded tooling stay live (V1, confinement, two older UIs) | Measured | [DLV-155](<../Delivery/Delivery — Master Book.md#dlv-155>); existing DLV-103, R6 |
| F2-07 | Workers run without the repo's CLAUDE.md, skills and hooks | Read | DLV-150 |
| F2-08 | Home shows counts, not a next action; decisions are in an overflow menu; two vocabularies for one queue | Seen | [R86](<../PM Tooling/PM Tooling — Master Book.md#r86>) |
| F2-09 | Sprints still shows the week of 5 October as in play | Seen, read | [R87](<../PM Tooling/PM Tooling — Master Book.md#r87>) |
| F2-10 | Fifteen bug-sweep IDs existed only as text in a research file | Measured | Filed: BUD-89 to 94, HUB-118 to 122, NOTIF-22, NOTIF-23, R83, KIT-28 |
| F2-11 | `docs/era-research/` (70 files) is linked from nowhere in the vault and has no dispositions | Measured | [R85](<../PM Tooling/PM Tooling — Master Book.md#r85>) |
| F2-12 | Hard Rule 26's deny list names `mcp__claude_ai_Supabase__*`; cloud sessions expose `mcp__Supabase__*` | Read, seen | [R84](<../PM Tooling/PM Tooling — Master Book.md#r84>) |
| F2-13 | `GET /api/transactions` sends `public, s-maxage=60` on an authenticated response | Read | [BUD-95](<../Budget/Budget — Master Book.md#bud-95>) |
| F2-14 | 43 service-role routes each implement their own authorization; nothing enumerates them | Measured, sampled | [R90](<../PM Tooling/PM Tooling — Master Book.md#r90>) |
| F2-15 | The RLS snapshot is 97 days old; it shows RLS disabled on `guest_drinks` and `item_prerequisites` | Measured | Existing R43; owner refresh |
| F2-16 | 58% of test files cover tooling; 23 of 35 feature directories have none | Measured | Existing BUD-74; R90 |
| F2-17 | Lint cannot fail on a Hard Rule: 990 warnings, 0 errors | Measured | Existing R44, R47, R46, DLV-84; ratchet recommended |
| F2-18 | 101 of 215 mutating routes import no schema | Measured | Existing R46, BUD-94 |
| F2-19 | `pnpm typecheck` runs out of memory in a 15 GB container | Measured | [R91](<../PM Tooling/PM Tooling — Master Book.md#r91>) |
| F2-20 | 58 cited evidence paths are gitignored; 17 broken links; the docs check is not in CI | Measured | [R88](<../PM Tooling/PM Tooling — Master Book.md#r88>) |
| F2-21 | Reading rules cost 77,000 to 112,000 tokens before the first source file | Measured | [R89](<../PM Tooling/PM Tooling — Master Book.md#r89>) |
| F2-22 | Twelve items solve exactly-once separately | From the books and the sweep | Study H2, unadopted option |
| F2-23 | Backlog arrival exceeds departure; 34 items in Now | Seen | Owner recommendations in [Backlog health](<10 - Project Management/Portfolio/Backlog Health.md>) |
| F2-24 | The largest files (Hub page 5,972 lines) cap what lower tiers can edit | Measured | Routing constraint; existing BUD-9 |
| F2-25 | Six areas need a deeper read than this pass gave | Stated | Studies H1 to H6, unadopted options in [Research options](<../Research/Options.md#fable-2-heavyweight-studies>) |
| F2-26 | 7 of 29 Hard Rules have any mechanism behind them; 22 are text only | Read, measured | [R94](<../PM Tooling/PM Tooling — Master Book.md#r94>) |
| F2-27 | The setup differs per agent (Codex gets 2 of 18 skills, older hooks, machine-specific paths); 13 conflict classes are live | Measured | [R92](<../PM Tooling/PM Tooling — Master Book.md#r92>), [R93](<../PM Tooling/PM Tooling — Master Book.md#r93>) |
| F2-28 | Ordinary agent sessions leave no record, and every skill's inputs are prose | Read | [R95](<../PM Tooling/PM Tooling — Master Book.md#r95>), [R96](<../PM Tooling/PM Tooling — Master Book.md#r96>), [R98](<../PM Tooling/PM Tooling — Master Book.md#r98>); cockpit [R97](<../PM Tooling/PM Tooling — Master Book.md#r97>), [R99](<../PM Tooling/PM Tooling — Master Book.md#r99>) |

## Folder map

| Folder | Contents |
|---|---|
| [00 - Method & Coverage](<00 - Method & Coverage/Method and Evidence.md>) | How this was done, what was run, what earlier passes covered |
| 01 - Architecture | [Environments and data safety](<01 - Architecture/Environments and Data Safety.md>) · [Verification pyramid](<01 - Architecture/Verification Pyramid.md>) · [Agent context economy](<01 - Architecture/Agent Context Economy.md>) |
| 02 - Standalone Modules | [Evidence matrix](<02 - Standalone Modules/_Module Evidence Matrix.md>) · [Transactions cache header](<02 - Standalone Modules/Transactions/Shared-Cache Header on the Transactions Read.md>) · [Guest Portal exposure](<02 - Standalone Modules/Guest Portal/Guest Data Exposure Still Unqueued.md>) |
| 03 - Junction Modules | [Evidence matrix](<03 - Junction Modules/_Junction Evidence Matrix.md>) · [Service-role surface](<03 - Junction Modules/Household Sharing/Service-Role Authorization Surface.md>) · [Exactly-once](<03 - Junction Modules/Sync & Offline/Exactly-Once Remains Open.md>) |
| 04 - UI & Design | [Largest files and client-rule debt](<04 - UI & Design/Mega-Components.md>) |
| 10 - Project Management / Command Center | [Usability and visual review](<10 - Project Management/Command Center/1 - Usability and Visual Review.md>) · [Functional roadmap](<10 - Project Management/Command Center/2 - Functional Roadmap.md>) |
| 10 - Project Management / Delivery | [Diagnosis](<10 - Project Management/Delivery/1 - Diagnosis.md>) · [Local lane design](<10 - Project Management/Delivery/2 - Local Lane Design.md>) · [Gate disposition](<10 - Project Management/Delivery/3 - Gate Disposition.md>) · [Migration and retirement](<10 - Project Management/Delivery/4 - Migration and Retirement.md>) |
| 10 - Project Management / Portfolio | [Research-to-queue leak](<10 - Project Management/Portfolio/Research-to-Queue Leak.md>) · [Backlog health](<10 - Project Management/Portfolio/Backlog Health.md>) |
| Agentic OS | [Index](<Agentic OS/_index.md>): the plan to evolve the Command Center into PM.2 — setup registry, rule detectors, conflict check, flight recorder, scorecards, skill launchpad, cockpit design, roadmap (12 documents) |
| Model Tiers | [Routing rules](<Model Tiers/_Routing.md>) · [CLAUDE_HIGH](<Model Tiers/CLAUDE_HIGH/Work Packets.md>) · [CLAUDE_MID](<Model Tiers/CLAUDE_MID/Work Packets.md>) · [CLAUDE_LOW](<Model Tiers/CLAUDE_LOW/Work Packets.md>) · [CODEX](<Model Tiers/CODEX/Work Packets.md>) |

The folders mirror the vault's sections. Sections 05 to 07 have no folder because this pass produced nothing for them. `Model Tiers` and `Agentic OS` are topic folders with no vault counterpart.

## Read in this order

1. This page.
2. [Delivery diagnosis](<10 - Project Management/Delivery/1 - Diagnosis.md>) and [Local lane design](<10 - Project Management/Delivery/2 - Local Lane Design.md>).
3. [Environments and data safety](<01 - Architecture/Environments and Data Safety.md>).
4. [Research-to-queue leak](<10 - Project Management/Portfolio/Research-to-Queue Leak.md>) and [Backlog health](<10 - Project Management/Portfolio/Backlog Health.md>).
5. [Model tier routing](<Model Tiers/_Routing.md>) when handing an item to a session.
6. [Agentic OS](<Agentic OS/_index.md>) for the PM.2 direction.

## Items filed on 2026-11-10

Thirty-eight lines, in Next or Later, none in Now. Fifteen are the sweep's findings, fifteen are new from the analysis, eight are the Agentic OS roadmap steps.

| Campaign | Next | Later |
|---|---|---|
| Budget | BUD-89, BUD-90, BUD-91, BUD-92, BUD-93, BUD-95 | BUD-94 |
| Hub & ERA | HUB-118, HUB-119, HUB-120, HUB-121 | HUB-122 |
| Notifications & Alerts | NOTIF-22, NOTIF-23 | |
| Kitchen | | KIT-28 |
| PM Tooling | R84, R85, R86, R87, R88, R92 | R83, R89, R90, R91, R93 to R99 |
| Delivery | DLV-150, DLV-151, DLV-152, DLV-153 | DLV-154, DLV-155 |

Recommended for the owner to move into Now: **R84, HUB-118, BUD-95, BUD-89, BUD-90, HUB-119**, then **DLV-150**. For the Agentic OS, **R92, R93 and R94** are the smallest version worth having.
