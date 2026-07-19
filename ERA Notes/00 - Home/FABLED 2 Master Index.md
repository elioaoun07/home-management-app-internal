---
created: 2026-07-06
type: index
status: superseded
superseded: 2026-07-18
owner: Elio (authored by Claude Fable 5, final session)
tags:
  - pm/fabled2
  - scope/vault
---

# FABLED 2 — Master Index (the whole X-ray on one page)

> ⚠️ **Superseded 2026-07-18** by [FABLED 3 Master Index](<FABLED 3 Master Index.md>) (model-generation handoff). This page remains the generation-2 score record. Do not update.


> **FABLED** is this repo's generational audit layer: deep-dives written by AI against the *verified* working tree, in four standard files per scope — `1 Current Implementation` · `2 Gaps & Missing` · `3 Optimization Plan` · `4 Future Enhancements`. **FABLED v1** (2026-06-10) is frozen as the historical baseline; **FABLED 2** (stamped 2026-07-02) is the living generation: scored maturity model, delta ledger vs v1, evidence commands on claims, kill criteria on enhancements.
>
> **How to use this layer:** trust a FABLED 2 file *as of its stamp date*, then delta it — `git log --oneline --since=2026-07-02` — and append what changed to the relevant `_index.md`. Never re-audit from scratch what a stamped audit covers; never trust a stamp older than the last major campaign without deltaing. (Full protocol: [Design Doctrine §7](<../01 - Architecture/Design Doctrine.md>).)

## Module campaigns (the product, by cluster)

Scores are each folder's self-assessed **Overall maturity** (0–2 absent · 3–4 fragile · 5–6 works-but-exposed · 7–8 solid · 9–10 hardened), harvested 2026-07-06.

| Campaign | Overall | Index |
|---|---|---|
| Notifications & Alerts | **5.8** *(2026-07-10)* | [Notifications & Alerts/FABLED 2](<../10 - Project Management/Notifications & Alerts/FABLED 2/_index.md>) |
| Budget | **5.4** | [Budget/FABLED 2](<../10 - Project Management/Budget/FABLED 2/_index.md>) |
| Schedule | **5.3** | [Schedule/FABLED 2](<../10 - Project Management/Schedule/FABLED 2/_index.md>) |
| Hub & ERA | **4.0** | [Hub & ERA/FABLED 2](<../10 - Project Management/Hub & ERA/FABLED 2/_index.md>) |
| Kitchen | **3.0** | [Kitchen/FABLED 2](<../10 - Project Management/Kitchen/FABLED 2/_index.md>) |
| Trips | **2.8** | [Trips/FABLED 2](<../10 - Project Management/Trips/FABLED 2/_index.md>) |
| PM system itself | **5.8** | [10 - Project Management/FABLED 2](<../10 - Project Management/FABLED 2/_index.md>) |

The shape to notice: **Notifications & Alerts moved from weakest-but-one to tied-strongest this session** (registry + unified alerts page + a real bug fix + two new capabilities) — the rest of the ranking still shows the money core strong and the junction-heavy clusters (Hub & ERA, Trips) weakest, exactly inverted from where the product's identity (proactive assistant, cross-module cascades) needs strength.

## Vault sections (the knowledge system, by folder)

| Section | Overall | Index |
|---|---|---|
| 02 - Standalone Modules | **6.2** | [02/FABLED 2](<../02 - Standalone Modules/FABLED 2/_index.md>) |
| 01 - Architecture | **5.8** | [01/FABLED 2](<../01 - Architecture/FABLED 2/_index.md>) |
| 06 - Setup & Onboarding | **5.3** | [06/FABLED 2](<../06 - Setup & Onboarding/FABLED 2/_index.md>) |
| 00 - Home | **5.0** | [00/FABLED 2](<FABLED 2/_index.md>) |
| 04 - UI & Design | **5.0** | [04/FABLED 2](<../04 - UI & Design/FABLED 2/_index.md>) |
| 09 - Patterns & Lessons ⚠ | **5.0** | [09/FABLED 2](<../09 - Patterns & Lessons/FABLED 2/_index.md>) |
| 05 - Performance | **4.5** | [05/FABLED 2](<../05 - Performance/FABLED 2/_index.md>) |
| Templates | **4.5** | [Templates/FABLED 2](<../Templates/FABLED 2/_index.md>) |
| 07 - Backlog & Ideas | **4.3** | [07/FABLED 2](<../07 - Backlog & Ideas/FABLED 2/_index.md>) |
| 03 - Junction Modules | **3.5** | [03/FABLED 2](<../03 - Junction Modules/FABLED 2/_index.md>) |

⚠ `09 - Patterns & Lessons/` is **gitignored** (personal) — its FABLED 2 folder exists only on this machine and does not travel with the repo. Agents reading a fresh clone will not see it; don't cite it as shared truth.

Same shape again: **junction documentation (03) is the weakest section** while standalone documentation (02) is the strongest — the docs mirror the code's risk profile.

## Review companions (unscored — they audit events, not state)

- [Codebase Audit 2026-07-01/FABLED 2](<../10 - Project Management/Codebase Audit 2026-07-01/FABLED 2/_index.md>)
- [Functional Architecture Review/FABLED 2](<../10 - Project Management/Functional Architecture Review/FABLED 2/_index.md>)
- [FAR Execution Checklist/FABLED 2](<../10 - Project Management/FAR Execution Checklist/FABLED 2/_index.md>)

## Reading paths

- **"What should I work on?"** → campaign table above, lowest score that matters to daily life → its `3 - Optimization Plan`.
- **"What is X really like right now?"** → that scope's `1 - Current Implementation`, then delta with git.
- **"What's the 10× idea here?"** → `4 - Future Enhancements` (every idea carries impact/effort **and a kill criterion** — respect them; they encode when *not* to build).
- **"Why does this feel stuck?"** → [PM system FABLED 2](<../10 - Project Management/FABLED 2/_index.md>) — the execution-coupling diagnosis (score 3/10) is the honest answer, and [Design Doctrine §6](<../01 - Architecture/Design Doctrine.md>) is the counter-protocol.

## Maintenance protocol

1. **Delta, don't rewrite.** Ship something significant in a cluster → append a dated delta line to that FABLED 2 `_index.md` (what shipped, commit, what score-dimension it moves). The 2026-07-06 Budget delta is the worked example.
2. **Scores move only with evidence** — cite the command or test that justifies the change, in the same edit.
3. **FABLED 3 is warranted** when a cluster's reality has drifted so far that deltas outweigh the base document (rule of thumb: >40% of file 1 would need rewriting, or ~6 months). Freeze 2 as v1 was frozen; carry the delta ledger forward.
4. **The harvest command** for this page's score tables:
   `find "ERA Notes" -path "*FABLED 2*" -name "_index.md" -exec grep -H "Overall" {} +`
5. This page was verified **2026-07-06**. If the SessionStart freshness radar sent you here, you are reading the right layer.
