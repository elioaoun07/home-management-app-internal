---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - codebase-audit
---

# Codebase Audit · FABLED 2.1 — Claims, Pinned to Numbers

> **FABLED 2:** [_index](<_index.md>) · **1 · Verification** · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)
>
> The audit (2026-07-01) spoke in qualitative terms ("widespread," "many"). One day later, the exact numbers — so the *next* delta can measure movement instead of re-estimating.

---

## Baseline numbers (working tree, 2026-07-02)

| Audit claim | Pinned baseline | Command |
|---|---|---|
| "Production `console.*` remains widespread" (P0) | **594 occurrences in 162 files** | `grep -rE "console\.(log|warn|error)" src --include="*.ts" --include="*.tsx" | wc -l` |
| "Client mutation paths still use raw `fetch()`" (P0) | **240 raw `fetch(` calls; ~99 with mutation methods nearby** | `grep -rE "\bfetch\s*\(" src ... | wc -l` |
| "9 test/spec files, mostly utility-level" | Confirmed: 8 under `src/lib` + 1 `tests/pm-mutations.test.ts` = **93 tests, 92 green, 1 failing** | `pnpm test` |
| Debug surface | `api/analytics/debug` + `api/debug/supabase` + `api/env-check` + `api/supabase-check` all shipped | `ls src/app/api/` |
| "Feature inventory drifts" | `docs:check` **passes** (Feature Index ↔ Feature Map aligned); the drift is in PM authority files, not the Map | `pnpm docs:check` |
| Orphan dirs | `src/features/blink/` + `src/features/today/` empty, present | `ls src/features/` |

## One correction the audit's own verification list needs

The audit's recommended verification command `pnpm test` **currently fails** — not because of remediation work, but because of the pre-existing stale placement-guard test (`expandOccurrences.test.ts:95`, known since 06-19, documented in the Schedule campaign). Anyone running the audit's verification loop today gets a red that has nothing to do with the audit's P0s. Fix tracked as [Schedule FABLED 2.3 · O1](<../../Schedule/FABLED 2/3 - FABLED 2 — Optimization Plan.md>) — it should be treated as a P0-adjacent item because it poisons every other verification run.

## Where each P0 already has an owner

| Audit P0 | Campaign owner |
|---|---|
| Console sweep + enforcement | app-wide; first slice = notification crons ([Notifications FABLED 2.3 · O7](<../../Notifications & Alerts/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)), then finance routes ([Budget FABLED 2.3 · O7](<../../Budget/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)) |
| Raw `fetch()` classification | Sync & Offline junction; hub/notification/watch surfaces named in the audit |
| Cache invalidation audit | transactions/hub/notifications hot paths; the cache-invalidation skill is the rulebook |
| Route/hook tests | per-campaign FABLED 2.3 files all sequence their slice |
| Feature classification (blink/today/memories/era/voice ownership) | the hygiene sweep + global Feature State refresh ([PM FABLED 2.3 · O1/O2](<../../FABLED 2/3 - FABLED 2 — Optimization Plan.md>)) |
