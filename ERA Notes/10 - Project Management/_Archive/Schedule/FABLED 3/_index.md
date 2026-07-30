---
created: 2026-07-18
type: index
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
predecessor: ../FABLED 2/
tags:
  - pm/fabled3
  - module/schedule
---

# Schedule · FABLED 3 — Index

> Third-generation audit, created 2026-07-18 as part of a **model-generation handoff**. Verified against `f0a8e19`. Headline: the cluster grew its **first true outward bridge** — Google Calendar sync (`2783b1d`, 2026-07-10) — while its two oldest sores sat untouched: the source-guard test that turns the suite red has now been failing for a month, and the dead `MobileItemForm.tsx` survives its **fourth** generation of being flagged.

| File | Read it when… |
|---|---|
| [3.1 Current Implementation](<1 - FABLED 3 — Current Implementation.md>) | delta since 07-02 — the gcal sync layer |
| [3.2 Gaps & Missing](<2 - FABLED 3 — Gaps & Missing.md>) | the ranked list |
| [3.3 Optimization Plan](<3 - FABLED 3 — Optimization Plan.md>) | ranked moves |
| [3.4 Future Enhancements](<4 - FABLED 3 — Future Enhancements.md>) | ideas + kill criteria |
| [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>) | **you are a successor model about to touch schedule/recurrence code — read this first** |

## Maturity scoreboard (2026-07-18)

| Dimension | Score | Δ vs 07-02 | Evidence |
|---|---|---|---|
| Household semantics | 8 | = | No regressions in window; pass/take-back and idempotent occurrence actions hold |
| Engine correctness | 5 | = | Three expansion engines still diverge; gcal sync wraps items, doesn't add a fourth expander (verified `src/lib/gcal/sync.ts` — 274 lines, outbound mapping only) |
| Test protection | 5 | = | Suite STILL red: `expandOccurrences.test.ts` guard vs `WebTodayView.tsx` (no `is_flexible` reference since `5f7c064`, 2026-06-16). A red suite for a month trains everyone to ignore red |
| Capture UX | 7 | = | Live form + `smartTextParser` unchanged in window |
| Code health | 4 | = | `useItems.ts` 2,665 (+28); dead `MobileItemForm.tsx` (49,943 bytes) — **fourth flag, still on disk** |
| Outward bridges | 4 | +1 | **Google Calendar sync shipped**: OAuth connect/callback/connection routes + `sync-item` + `google_calendar_connections` table + `items.google_synced_at` |
| **Overall** | **5.5** | **+0.2** | One real bridge gained; the hygiene debts didn't move |
| **Handoff readiness** | **4** | new | Recurrence anywhere = mid-tier+ with `recurrence-safety` open; the red suite undermines the "run tests" safety ritual for lower tiers — fixing it is a handoff-readiness investment, not just hygiene |

## Delta ledger — inherited from FABLED 2 (verbatim)

*(FABLED 2 Schedule carried no delta entries — its ledger was empty at freeze.)*

## Delta ledger (FABLED 3 era, append-only)

- **2026-07-18** (generation created): gcal sync audited (`2783b1d` — 12 files, +727; migration `2026-07-10_google-calendar-sync.sql`). Warn-but-allow disconnect decision (per Healthcare plan) noted as the cross-module contract. Guard-test failure re-confirmed RED. Evidence cutoff `f0a8e19`.

## The next 3 moves

1. **Make the suite green** — either restore the `is_flexible` skip in `WebTodayView.tsx` (if it truly double-expands, this is a live duplicate-display bug) or update the guard's view list (if plan-day refactor moved expansion). One focused session with `recurrence-safety` open; the diagnosis IS the deliverable.
2. **Delete `MobileItemForm.tsx`.** Fourth flag. `git rm`, run typecheck, done.
3. **Prove gcal-reconcile actually runs** — the cron exists (`9d867f8`, 87 lines, exemplary template) but `vercel.json` is absent and no scheduler trace exists; verify `last_synced_at` advances daily or wire the scheduler. Healthcare Phase 2 (HLTH-10) extends this cron and inherits its liveness answer.

**Siblings:** [Budget](<../../Budget/FABLED 3/_index.md>) · [Kitchen](<../../Kitchen/FABLED 3/_index.md>) · [Trips](<../../Trips/FABLED 3/_index.md>) · [Hub & ERA](<../../Hub & ERA/FABLED 3/_index.md>) · [Notifications](<../../Notifications & Alerts/FABLED 3/_index.md>) · [Healthcare](<../../Healthcare/FABLED 3/_index.md>) · [PM system](<../../FABLED 3/_index.md>)
