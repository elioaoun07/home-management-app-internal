---
created: 2026-05-29
type: index
status: living
tags:
  - pm/index
---

# 10 - Project Management - Command Center

> Your strategic overview. Start here when you're asking "what do I do next?" Audited against `main` on **2026-05-29**.
>
> **Scope:** the numbered files below are **whole-app** (cross-cutting). **Per-module PM lives in subfolders** in the same uniform format (see the Per-module PM table below — Budget, Schedule, Kitchen, Trips, Hub & ERA, Notifications & Alerts). Add a sibling folder per module you want to prioritize on its own.

| # | File | Read it when... |
|---|---|---|
| 1 | [Codebase & AI Setup Audit](<1 - Codebase & AI Setup Audit.md>) | You want to know what's wrong with how the project is built/steered: structure, AI guidance, hooks, tests, hygiene. |
| 2 | [Feature State - Current Reality](<2 - Feature State — Current Reality.md>) | You want the honest, no-hype status of every module. |
| 3 | [Future Vision & Roadmap](<3 - Future Vision & Roadmap.md>) | You want to dream: enhancements and net-new modules, prioritized. |
| 4 | [This Week (Action Plan)](<4 - This Week (Action Plan).md>) | Most days. The synthesis: exactly what to do next, day by day. |
| 5 | [P0 Automated Tests Implementation Notes](<5 - P0 Automated Tests Implementation Notes.md>) | You want the record of how the first automated test baseline was added. |
| 6 | [Optimized Claude Setup Structure](<6 - Optimized Claude Setup Structure.md>) | You want the target blueprint for the AI setup (instructions/knowledge/hooks/skills/memory/permissions) + the ranked gap list. Audited 2026-06-10. |

## Per-module PM

| Module | Folder |
|---|---|
| **Schedule** (Items & Reminders) | [Schedule/](<Schedule/_index.md>) |
| **Budget** (finance cluster) | [Budget/](<Budget/_index.md>) |
| **Kitchen** (Recipes · Meal · Inventory · Shopping) | [Kitchen/](<Kitchen/_index.md>) |
| **Trips** (lifecycle travel junction) | [Trips/](<Trips/_index.md>) |
| **Hub & ERA** (Hub Chat · AI Assistant · Voice) | [Hub & ERA/](<Hub & ERA/_index.md>) |
| **Notifications & Alerts** (bell · drawer · alerts page · system notifs) | [Notifications & Alerts/](<Notifications & Alerts/_index.md>) |

> Each module folder mirrors the same uniform set at module scope: `_index`, `1 - Feature State`, `2 - Vision & Roadmap`, `3 - Action Plan`, `4 - Checklist` — plus (where present) a **`FABLED/`** deep-dive folder: current implementation X-ray, ranked gaps, optimization plan, future enhancements. Files 1–3 carry the reality + strategy + narrative; **file 4 is the flat, checkable list — the daily driver**; FABLED holds the depth and is re-audited per campaign.

## Cross-cutting reviews

| Review | Folder | What it is |
|---|---|---|
| **Functional Architecture Review** (2026-06-12) | [Functional Architecture Review/](<Functional Architecture Review/_index.md>) | Whole-app review against the Proactive AI Assistant goal: strengths, enhancement map, junction leverage, missed/forgotten features, market lens, ten challenges, and a 90-day path. Start with its file 1 (the maturity verdict) and file 7 (the path). |
| **FAR Execution Checklist** (2026-06-12) | [FAR Execution Checklist/](<FAR Execution Checklist/_index.md>) | The FAR turned executable: master checklist by priority (P0–P3) + 13-week dated schedule (Jun 15 → Sep 13). **Feeds file 4 every Monday.** When lost on "what next," open this. |

## How to use this set

- **Daily driver:** file 4. Re-draft it every Monday.
- **Files 1-3 are living:** update them as the project moves; don't let them rot like the old backlog did.
- **Files 1-3 set the strategy; file 4 turns it into this week's checklist.**

## Top 3 risks right now (from file 1)

1. Red **Thin automated test baseline** on a financial app: first money/date tests exist; API and integration coverage still need expansion.
2. Orange **Hard Rule 22 violated 649x** (`console.*`) and not lint-enforced.
3. Orange **Docs lag code:** 5-6 shipping modules have no Overview doc; CLAUDE.md index was stale (now patched).

Fixed during the audit: AI mirrors (AGENTS/CODEX/Copilot) now auto-sync from CLAUDE.md; CLAUDE.md Feature Index updated with the 6 missing modules.
