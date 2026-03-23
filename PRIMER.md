# PRIMER.md

> **This file rewrites itself at the end of every session.** It is the single source of "where are we right now" — read this first, always.

**Last updated:** 2026-03-23  
**Last session:** Obsidian vault migration — moved all docs from `docs/` → `ERA Notes/`, rewrote `CLAUDE.md`, added Obsidian templates and frontmatter

---

## Active Projects

| Project              | Status           | Branch / Area             | Notes                                                      |
| -------------------- | ---------------- | ------------------------- | ---------------------------------------------------------- |
| Obsidian vault setup | Just completed   | `ERA Notes/`              | Full vault structure, templates, all feature docs migrated |
| Recurring Payments   | Recently shipped | `src/features/recurring/` | Recurrence exceptions, recurring payments setup finalized  |
| Expense Entry        | Recently shipped | `src/app/expense/`        | Entry flow finalized ~9 days ago                           |

## Last Completed

- **Obsidian vault migration** — Created full `ERA Notes/` structure with 80+ docs, templates (Session - Feature/Bug Fix/Refactor, Feature Doc, Pattern), Dashboard MOC, Module Index. Moved legacy `docs/` → `docs.old/`.
- **CLAUDE.md rewrite** — Comprehensive project guide with Module Model (Standalone vs Junction), Hard Rules, Feature Index, vault workflow, environment variables.
- Typecheck passes clean (`pnpm tsc --noEmit` → exit 0).

## Exact Next Step

Pick one and go:

1. **Dashboard V2** — Analytics dashboard with widgets (expense/income graphs, category breakdowns, 50/30/20 split, forecasting). Spec in `ERA Notes/07 - Backlog & Ideas/Dashboard V2 Instructions.md`.
2. **Recurring Payment Notifications** — Monthly confirmation flow for auto-pay subscriptions. Spec in `ERA Notes/07 - Backlog & Ideas/Ideas.md`.
3. **AI Assistant safety rules** — Define mutation boundaries, confirmation requirements, action safety. Notes in `AI_Assistant_later.md`.

## Open Blockers

- None currently. Typecheck clean, no lint errors.

## Tech Debt / Warnings

- `docs.old/` still exists — can be deleted once confident all content is in `ERA Notes/`.
- `AI_Assistant_later.md` has unintegrated notes about AI action safety rules — should be folded into `ERA Notes/03 - Junction Modules/AI Assistant/` when AI module is next touched.

## Session Handoff Protocol

At the **end of every session**, rewrite this file with:

1. **Last updated** — today's date
2. **Last session** — one-line summary of what was done
3. **Active Projects** — table of in-flight work with status
4. **Last Completed** — bullet list of what shipped this session
5. **Exact Next Step** — numbered list, most urgent first, with file/doc references
6. **Open Blockers** — anything preventing progress (empty = "None")
7. **Tech Debt / Warnings** — non-urgent issues to be aware of

Keep it **brutally concise**. This file should be readable in 30 seconds.
