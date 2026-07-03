---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/standalone
---

# Standalone Modules · FABLED 2.1 — The Portfolio Map

> **FABLED 2:** [_index](<_index.md>) · **1 · Portfolio** · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)
>
> Verified 2026-07-02. The global [Feature State](<../../10 - Project Management/2 - Feature State — Current Reality.md>) holds per-module rows; this is the portfolio-level readout.

---

## 1 · Composition (32 feature dirs on disk)

- **Finance cluster (11):** accounts, transactions, categories, recurring, balance, budget, transfers, statement-import, debts, future-purchases, drafts → deep-dive: [Budget FABLED 2](<../../10 - Project Management/Budget/FABLED 2/_index.md>).
- **Schedule cluster (2):** items, day-plan → [Schedule FABLED 2](<../../10 - Project Management/Schedule/FABLED 2/_index.md>).
- **Kitchen cluster (3):** recipes, meal-planning, inventory → [Kitchen FABLED 2](<../../10 - Project Management/Kitchen/FABLED 2/_index.md>).
- **Independent standalones:** catalogue, analytics, preferences, nfc, chores, error-logs (+ pages: dashboard, focus, ai-usage, recycle-bin, watch UI in `components/watch/`, guest portal in `app/g/`).
- **Junction-owned dirs living here:** hub, era, voice-conversation, trips, memories (see [Junction FABLED 2](<../../03 - Junction Modules/FABLED 2/_index.md>)).
- **Debt:** blink (empty), today (empty), navigation (misfiled util), dashboard (prefetch-only).

## 2 · Coverage matrices (the portfolio's protection state)

| Protection | Covered | Not covered |
|---|---|---|
| **Vault doc** | Every shipping module (Dashboard, Chores, Focus, AI Usage, Recycle Bin all verified present today — the May gap closed) | `receipts` (unclassified), `memories` (undecided) |
| **Unit tests** | Finance math (6 suites) · Schedule expansion/day-occurrences · nothing else | Kitchen (zero), Catalogue, NFC, Chores, Preferences, Analytics client logic, Guest, Watch |
| **PM campaign** | Finance, Schedule, Kitchen, Trips, Hub/ERA, Notifications | Catalogue, NFC, Chores, Focus, Dashboard, Guest, Watch, Error Logs, Recycle Bin, Preferences, Analytics *(no campaign home — see [file 2 · G3](<2 - FABLED 2 — Gaps & Missing.md>))* |

## 3 · Health distribution (the honest histogram)

🟢 Core battle-tested: ~8 modules (finance core, items, categories, preferences, catalogue) · 🔵 Established stable-unprotected: ~12 · 🟡 New/thin: ~6 (dashboard, chores, focus, ai-usage, recycle-bin, watch extensions) · 🟠 Stub: memories, prerequisites-evaluators · ⚫ Debt: 4 dirs. The portfolio's shape is right for a personal app; the risk concentrates in the 🔵 band's *zero-test* uniformity — stable until the day it isn't, with no tripwire.

## 4 · June's portfolio-level lesson

The month's work clustered in already-strong modules (finance, items) — the portfolio's rich got richer while its 🔵 middle sat still. That's rational (pain-driven work follows usage), but it means **maturity now correlates with recency of attention, not with importance** — e.g., Preferences (LBP rate! month-start! theme!) underpins every money number yet has no tests and no campaign. Worth one deliberate pass ([file 3 · O3](<3 - FABLED 2 — Optimization Plan.md>)).
