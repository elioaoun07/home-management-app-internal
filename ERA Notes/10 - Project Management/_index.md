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
> **Scope:** the numbered files below are **whole-app** (cross-cutting). **Per-module PM lives in subfolders** in the same format — currently [Schedule/](<Schedule/_index.md>) (the Items & Reminders module). Add a sibling folder per module you want to prioritize on its own.

| # | File | Read it when... |
|---|---|---|
| 1 | [Codebase & AI Setup Audit](<1 - Codebase & AI Setup Audit.md>) | You want to know what's wrong with how the project is built/steered: structure, AI guidance, hooks, tests, hygiene. |
| 2 | [Feature State - Current Reality](<2 - Feature State — Current Reality.md>) | You want the honest, no-hype status of every module. |
| 3 | [Future Vision & Roadmap](<3 - Future Vision & Roadmap.md>) | You want to dream: enhancements and net-new modules, prioritized. |
| 4 | [This Week (Action Plan)](<4 - This Week (Action Plan).md>) | Most days. The synthesis: exactly what to do next, day by day. |
| 5 | [P0 Automated Tests Implementation Notes](<5 - P0 Automated Tests Implementation Notes.md>) | You want the record of how the first automated test baseline was added. |

## Per-module PM

| Module | Folder |
|---|---|
| **Schedule** (Items & Reminders) | [Schedule/](<Schedule/_index.md>) |

> Each module folder mirrors this set at module scope: `1 - Feature State`, `2 - Future Vision & Roadmap`, `3 - Current — Action Plan`, `_index`.

## How to use this set

- **Daily driver:** file 4. Re-draft it every Monday.
- **Files 1-3 are living:** update them as the project moves; don't let them rot like the old backlog did.
- **Files 1-3 set the strategy; file 4 turns it into this week's checklist.**

## Top 3 risks right now (from file 1)

1. Red **Thin automated test baseline** on a financial app: first money/date tests exist; API and integration coverage still need expansion.
2. Orange **Hard Rule 22 violated 649x** (`console.*`) and not lint-enforced.
3. Orange **Docs lag code:** 5-6 shipping modules have no Overview doc; CLAUDE.md index was stale (now patched).

Fixed during the audit: AI mirrors (AGENTS/CODEX/Copilot) now auto-sync from CLAUDE.md; CLAUDE.md Feature Index updated with the 6 missing modules.
