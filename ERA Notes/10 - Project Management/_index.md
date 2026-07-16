---
created: 2026-05-29
updated: 2026-07-15
type: index
status: living
tags:
  - pm/index
---

# 10 · Project Management — Command Center

> **Start here when you ask "what do I do next?"** Three surfaces, one job each:
>
> 1. **Current truth** — the **FABLED 2** layer (per-campaign `FABLED 2/_index.md`; whole-app [FABLED 2 Master Index](<../00 - Home/FABLED 2 Master Index.md>)). Scored maturity, delta ledgers, evidence-stamped claims. Trust it as of its stamp, then delta with `git log`.
> 2. **Execution** — each campaign's `4 - Checklist.md`, as **Now / Next / Later** lanes. One item grammar for all of them: [_Conventions](<_Conventions.md>), validated by `pnpm pm:lint`, seeded from [_Templates/](<_Templates/>).
> 3. **View** — `pnpm pm` opens the consolidated Task board/table: every campaign's items with ID / severity / effort chips, filterable (`m:Budget s:blocker is:open`), click-through to the exact line.

---

## Campaigns (the execution queues)

| Campaign | ID prefix | Checklist |
|---|---|---|
| **Budget** (finance cluster) | `BUD` | [Budget/4](<Budget/4 - Checklist.md>) |
| **Schedule** (Items & Reminders) | `SCH` | [Schedule/4](<Schedule/4 - Checklist.md>) |
| **Kitchen** (Recipes · Meal · Inventory · Shopping) | `KIT` | [Kitchen/4](<Kitchen/4 - Checklist.md>) |
| **Trips** (lifecycle travel junction) | `TRIP` | [Trips/4](<Trips/4 - Checklist.md>) |
| **Hub & ERA** (Hub Chat · AI · Voice) | `HUB` | [Hub & ERA/4](<Hub & ERA/4 - Checklist.md>) |
| **Notifications & Alerts** | `NOTIF` | [Notifications & Alerts/4](<Notifications & Alerts/4 - Checklist.md>) |
| **PM Dashboard Refactor** (tooling) | `R` | [PM Dashboard Refactor/4](<PM Dashboard Refactor/4 - Checklist.md>) |
| **Delivery Workspace** (tooling — durable Delivery memory) | `DW` | [Delivery Workspace/4](<Delivery Workspace/4 - Checklist.md>) |

Each campaign folder holds the uniform set — `_index`, `1 - Feature State`, `2 - Vision & Roadmap`, `3 - Action Plan`, `4 - Checklist` — plus the deep-dive layer **`FABLED 2/`** (current, scored, delta-ledgered) and, where present, the frozen **`FABLED/`** v1 baseline (2026-06-10). Files 1–3 carry reality + strategy + narrative; **file 4 is the live lane list**; FABLED 2 holds the depth.

## Planning & study layers (read, don't execute from)

| Layer | What it is |
|---|---|
| [FABLE — Final Consultation](<FABLE — Final Consultation (2026-07-06).md>) | Generational handoff (2026-07-06): product verdict, optimization frontiers, enhancement programs, 30-day sequence. |
| [ERA Awakening — Master Execution Plan](<ERA Awakening — Master Execution Plan (2026-07-06).md>) | The proactive-era contract (Jul 6 → Oct 4, 2026): scheduler → briefing → tested ERA brain → voice → learning loop. Feeds campaign Now lanes. |
| [FABLED+ Enhancement Study](<FABLED+ Enhancement Study/_index.md>) | Whole-codebase study (40 features + global lenses). A study queue, **not** a second execution authority — hidden from the `pnpm pm` board by default. |
| [Native App](<Native App/_index.md>) | Approved two-stage Capacitor plan (Android + iOS). Planned, not started. |
| [Agentic Delivery Workspace](<Agentic Delivery Workspace/_index.md>) | Dev-tooling: gated, provider-neutral agent delivery sessions (git reads only). See its own live status. |
| [Delivery Workspace](<Delivery Workspace/_index.md>) | Durable-memory enhancement on top of the above: full transcript, Q&A, timeline, pause/handoff/compaction. Own campaign + checklist (`DW`), not a study — see its Feature State for shipped slices. |
| [Functional Architecture Review](<Functional Architecture Review/_index.md>) · [FAR Execution Checklist](<FAR Execution Checklist/_index.md>) · [Codebase Audit 2026-07-01](<Codebase Audit 2026-07-01/_index.md>) | Whole-app reviews. Each carries a **`FABLED 2/`** delta layer — read the delta before treating the base as current. |
| [FABLED 2/](<FABLED 2/_index.md>) | The PM machine's own meta-audit (this folder's implementation, gaps, optimization). |

## Archived in place (historical — do not update)

Marked `status: superseded` / `baseline-frozen`; hidden from the `pnpm pm` board.

| File | Why / successor |
|---|---|
| [1 · Codebase & AI Setup Audit](<1 - Codebase & AI Setup Audit.md>) | 2026-05-29 audit → superseded by FABLED 2 + Codebase Audit 2026-07-01. |
| [2 · Feature State — Current Reality](<2 - Feature State — Current Reality.md>) | Global feature state → per-campaign `1 - Feature State` + FABLED 2 scores. |
| [3 · Future Vision & Roadmap](<3 - Future Vision & Roadmap.md>) | Global roadmap → per-campaign `2 - Vision & Roadmap` + FABLE Consultation. |
| [4 · This Week (Action Plan)](<4 - This Week (Action Plan).md>) | Weekly-file ritual retired → campaign **Now** lanes on the board. |
| [5 · P0 Automated Tests](<5 - P0 Automated Tests Implementation Notes.md>) | First test-baseline record → FABLED 2 test-protection scores. |
| [6 · Optimized Claude Setup Structure](<6 - Optimized Claude Setup Structure.md>) | Setup blueprint → largely realized; see `.claude/` + FABLED 2. |
| 5 × `<Campaign>/FABLED/` | Frozen v1 baselines (2026-06-10), kept for the generational audit protocol. |

---

## How to use this set

- **Daily:** open `pnpm pm`, work the **Now** lanes; single item detail is one click away.
- **Adding an item:** write it in canonical grammar ([_Conventions](<_Conventions.md>)) in the right campaign's `4 - Checklist.md`, then `pnpm pm:lint`.
- **Setting direction:** read the campaign's `FABLED 2/_index.md` (scored) → `2 - Vision & Roadmap` → drop concrete items into the lanes.
