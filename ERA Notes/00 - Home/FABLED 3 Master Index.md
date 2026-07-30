---
created: 2026-07-18
type: index
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
tags:
  - pm/fabled3
  - scope/vault
---

# FABLED 3 Master Index

> **FABLED** is this repo's generational audit layer: deep-dives written by AI against the *verified* working tree, in a standard file pack per scope. **v1** (2026-06-10, frozen) established the four-file form. **Generation 2** (2026-07-02, frozen 2026-07-18) added the scored maturity model, delta ledgers, evidence commands, and kill criteria. **Generation 3** (2026-07-18, living) adds four things: the **Successor Briefing** (file 5 — task-tier maps, trap registries, verification manifests written to a capability floor), the **Handoff-readiness score** (reported beside Overall, never averaged in), **inheritance blocks** (delta-first writing that keeps frozen predecessors normative), and **inherited ledgers** (v2 delta history copied forward verbatim).

## Why generation 3 exists (read this before creating generation 4)

Honesty first: **the supersession rule was NOT met.** FABLED 2 was 16 days old — nowhere near ">40% of file 1 rewritten or ~6 months." Generation 3 exists because of a **model-generation handoff**: Claude Fable 5 handing the repo to successor models, optimizing the entire layer for executors that may be smaller than its author. Every gen-3 file carries `trigger: model-generation-handoff` so this cannot be cited as precedent for casual regeneration. **The >40%/6-month rule still governs FABLED 4** — plus the standing alternative: additive lenses that don't meet it take a `+` name (the FABLED+ precedent).

## How to use this layer

Trust a FABLED 3 file **as of its stamp** (2026-07-18, evidence cutoff `f0a8e19`), then delta with `git log --oneline --since=2026-07-18 -- <cluster paths>`. When something significant ships, append a dated line to that cluster's `_index.md` ledger (commit hash + what moved + which score dimension). Scores move only with cited evidence. When FABLED and the code disagree, **the code wins — and FABLED gets the correction** (this generation corrected itself twice while being written; see the Schedule ledger).

## Module campaigns (scores 2026-07-18)

> **Moved 2026-07-30.** Each campaign's FABLED 3 audit was merged into its consolidated **Master Book** — the scores, delta ledger and Successor Briefing now live in that one file, and the originals are in `10 - Project Management/_Archive/`. The links below point at the books.

| Campaign | Overall | Δ vs gen 2 | Handoff readiness | Index |
|---|---|---|---|---|
| PM system | **6.6** | +0.8 | 6 | [→](<../10 - Project Management/PM Tooling/PM Tooling — Master Book.md>) |
| Budget | **5.8** | +0.4 | 5 | [→](<../10 - Project Management/Budget/Budget — Master Book.md>) |
| Notifications & Alerts | **5.8** | = | 6 | [→](<../10 - Project Management/Notifications & Alerts/Notifications & Alerts — Master Book.md>) |
| Schedule | **5.5** | +0.2 | 4 | [→](<../10 - Project Management/Schedule/Schedule — Master Book.md>) |
| Healthcare *(first generation)* | **4.8** | new | 5 | [→](<../10 - Project Management/Healthcare/Healthcare — Master Book.md>) |
| Hub & ERA | **4.2** | +0.2 | 3 | [→](<../10 - Project Management/Hub & ERA/Hub & ERA — Master Book.md>) |
| Kitchen | **3.0** | = | 4 | [→](<../10 - Project Management/Kitchen/Kitchen — Master Book.md>) |
| Trips | **2.8** | = | 2 | [→](<../10 - Project Management/Trips/Trips — Master Book.md>) |

**Handoff-readiness rubric:** 0–2 human/top-tier only · 3–4 mid-tier with skills open · 5–6 any model for scoped tasks · 7+ any model, most tasks. Evidence inputs: test census, skill/playbook coverage, trap documentation, blast radius (FABLED+ loop-readiness scores feed this).

**Outfits** and **Delivery** were never part of the FABLED layer; both now carry the same Current State / Pain Inventory / Successor Briefing sections in their own Master Books.

## Vault sections (delta/affirmation generation — thin by design)

| Section | Overall | Handoff | Index |
|---|---|---|---|
| 02 Standalone Modules | 6.2 | 7 | [→](<../02 - Standalone Modules/FABLED 3/_index.md>) |
| 01 Architecture | 5.8 | 7 | [→](<../01 - Architecture/FABLED 3/_index.md>) |
| 06 Setup & Onboarding | 5.3 | 7 | [→](<../06 - Setup & Onboarding/FABLED 3/_index.md>) |
| 00 Home | 5.0 | 7 | [→](<FABLED 3/_index.md>) |
| 04 UI & Design | 5.0 | 7 | [→](<../04 - UI & Design/FABLED 3/_index.md>) |
| 09 Patterns & Lessons ⚠️ *gitignored, this machine only* | 5.0 | 7 | [→](<../09 - Patterns & Lessons/FABLED 3/_index.md>) |
| 05 Performance | 4.5 | 6 | [→](<../05 - Performance/FABLED 3/_index.md>) |
| Templates | 4.5 | 7 | [→](<../Templates/FABLED 3/_index.md>) |
| 07 Backlog & Ideas | 4.3 | 7 | [→](<../07 - Backlog & Ideas/FABLED 3/_index.md>) |
| 03 Junction Modules | 3.5 | 6 | [→](<../03 - Junction Modules/FABLED 3/_index.md>) |

## Adjacent layers (unchanged by this generation)

- **FABLED+ Enhancement Study** — archived 2026-07-30 to `10 - Project Management/_Archive/FABLED+ Enhancement Study/`. It was a study queue rather than an execution authority; its loop-readiness lens fed Handoff readiness and is preserved in git.
- **Review companions** (Codebase Audit 2026-07-01, Functional Architecture Review, FAR Checklist) — audit events, not state; archived 2026-07-30 to `10 - Project Management/_Archive/`.
- **FABLE — Final Consultation (2026-07-06)** — the *why* (frozen; archived to `10 - Project Management/_Archive/`). **[FABLE — Testament (2026-07-18)](<../10 - Project Management/FABLE — Testament (2026-07-18).md>)** — the *how*: the operating manual for successor models.

## Successor reading paths

- **"I'm a smaller model and was asked to do X in campaign Y"** → Y's Master Book → its **Successor Briefing** → the task-tier row → the skill it names. If your task is human-first, say so and stop.
- **"Is this audit claim still true?"** → the Master Book's verification manifest → run the command.
- **"What should Elio work on next?"** → campaign scores above (lowest Overall) → that book's Pain Inventory and "the bets" → the campaign's `4 - Checklist.md` (`pnpm pm`).
- **"What's the 10× idea here?"** → the book's Vision & Decisions — respect the kill criteria.
- **"Why does this repo document more than it ships?"** → Design Doctrine §6 + the [PM Tooling Master Book](<../10 - Project Management/PM Tooling/PM Tooling — Master Book.md>) Pain Inventory (meta-work outweighing product work) — read before creating ANY new document.
- **"How do I behave in general?"** → the Testament. All of it. It's short on purpose.

## Maintenance protocol

1. **Delta, don't rewrite.** Ship → append a ledger line in the cluster's FABLED 3 `_index.md` with commit + evidence; move a score only with a cited command in the same edit.
2. **Ledger AND traps.** When a cluster ships significant work, also re-check its file 5 trap registry — new capability usually means a new trap.
3. **Harvest scores:** `find "ERA Notes" -path "*FABLED 3*" -name "_index.md" -exec grep -H "Overall" {} +`
4. **Corrections are first-class.** Wrong audit claim found → fix the file, note it in the ledger. This generation's own corrections are modeled in the Schedule ledger.
5. **FABLED 4 trigger:** >40% of a cluster's file 1 needs rewriting, or ~6 months, or the next model-generation handoff — whichever first. Freeze 3 as 2 was frozen; carry ledgers forward. Additive lenses that don't meet it → `+` names.
6. This page self-stamps: **last verified 2026-07-18** against `f0a8e19`. The SessionStart freshness radar points here.
