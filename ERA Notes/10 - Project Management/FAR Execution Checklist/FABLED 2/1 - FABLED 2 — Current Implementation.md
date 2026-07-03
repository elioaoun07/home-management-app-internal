---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - pm/far
---

# FAR Checklist · FABLED 2.1 — The Week-3 Scoreboard

> **FABLED 2:** [_index](<_index.md>) · **1 · Scoreboard** · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)
>
> Plan (FAR 7 · Phase 1, weeks 1–3) vs verified reality (working tree, 2026-07-02).

---

## Phase 1 ("Trust") — item by item

| Step | Planned | Reality 2026-07-02 | Verdict |
|---|---|---|---|
| 1.1 P0 tests: money math | balance-utils, next-due, reconcile | Money suites green since 06-10; June *added* `budgetForecast` (9) + `anomalyDetection` | ✅ (mostly pre-dated the plan) |
| 1.1 P0 tests: ERA intent fixtures | "utterance → face/intent" table | **Not started** — zero ERA tests | ❌ |
| 1.2 Wake word afternoon | train `hey-era.table`, flip flag — or formally demote | **Not done, not demoted** — still regex | ❌ |
| 1.3 Gamification audit day | finish streak/feed emission or delete columns | No evidence of a session | ❌ |
| 1.4 Orphan sweep | `blink/`, `today/`, `temp/`, debug route | `temp/` gone; **`blink/`+`today/` remain; debug routes multiplied to 4** | ◐ (¼) |
| 1.5 Decisions in writing | C1–C3, C9 verdicts; A10 memories fate | Not found in the scoreboard file | ❌ |
| **Exit gate** | money tests green **in CI** · intent fixtures exist · scoreboard filled | tests green locally (suite red overall via stale guard); no CI evidence; no fixtures; no scoreboard | **Not met** |

## What happened instead (the unplanned month, from git + campaign logs)

26 commits since 06-10: the Budget analytics/reconciliation sprint (penny-exact spend, outlier engine, Review v3, AI allocations, Budget AI chat) · public/shared accounts + RLS fix · Schedule Stage 1 (Skip semantics) + idempotency + cron household fix · Notifications routing fix · NFC transfer flows · PM dashboard server (in flight). **None of it was in Phase 1; most of it was worth doing.** Several items even *serve* the FAR thesis (forecast substrate = A2's math; reviewed-proposal UX = the confirm card J4 wants).

## The one-line diagnosis

The FAR checklist assumed schedule-driven weeks; the project actually runs **pain-driven sessions** (live bugs and campaign pains win the day, and Hard Rule #25 documents them beautifully). The checklist was never re-drafted into file 4 on Mondays as designed — so plan and reality diverged silently from week 1.
