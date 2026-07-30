---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - module/trips
---

# Trips · FABLED 2.1 — Current Implementation

> **FABLED 2:** [_index](<_index.md>) · **1 · Implementation** · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>) · v1 baseline: [FABLED/1](<../FABLED/1 - FABLED — Current Implementation.md>)
>
> Verified 2026-07-02. v1's X-ray (surface layout, lifecycle RPCs, side-effects ledger, cascade rules, template semantics) remains accurate line-for-line — the module hasn't changed. What this file adds is the **environmental drift**: what June changed in the modules Trips writes into.

---

## 1 · In-module state: frozen (verified)

- Surface unchanged: `features/trips/hooks.ts` · `/trips` + `/trips/[id]` · components incl. `TripPackingList` (~32 KB) · `api/trips/` CRUD + `activate`/`complete`/`clone`/`packing`/`places`.
- DB unchanged: `trips`, `trip_places`, `trip_packing_items`, `trip_side_effects` (all in `schema.sql`).
- **RPC bodies still absent from the repo:** `grep -o "activate_trip\|complete_trip" migrations/schema.sql` → zero matches (2026-07-02). No dated snapshot migration exists for them. Contrast: `get_schedule_bundle` **is** now in `schema.sql` — the recovery workflow is proven, just not applied here.
- Cascade rules as v1 documented: household (chores skipped · recurring paused via `recurrence_pauses` · one-time cancelled · meals skipped) vs solo (`responsible_user_id` flip); **`recurring_payments` deliberately NOT paused**; trip account via direct inserts, kept after completion; every mutation logged to `trip_side_effects`.

## 2 · Environmental drift — the part that makes "frozen" dangerous

| June change (elsewhere) | Why it touches Trips |
|---|---|
| **Accounts: `is_public` / `visible` semantics + RLS policy fix** (2026-06-26, Budget) | Trip-account creation mirrors the accounts route by copy. The original has new visibility semantics and a corrected RLS policy; the copy was written against the old ones. Nobody has re-diffed them. ([Budget FABLED 2.2 · G6](<../../Budget/FABLED 2/2 - FABLED 2 — Gaps & Missing.md>)) |
| **Schedule idempotent occurrence upserts + windowless completion state** (06-21) | The occurrence layer Trips' pauses mask against changed behavior; probably compatible, never checked. |
| **Schedule Stage 2 planned: one expansion engine** ([Schedule FABLED 2.3 · O3](<../../Schedule/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)) | Pause-masking will be consolidated into `expandOccurrences.ts`. If trip cascades are verified *before* Stage 2, pause bugs found later clearly belong to Stage 2; if not, every pause bug becomes a two-module archaeology dig. **This is the new deadline argument for G1.** |
| **`responsible_user_id` pass/take-back UI** (Schedule, 06-06) | Manual reassignment now coexists with solo-trip auto-reassignment. Completion's reversal assumes it owns the flip — what happens if the partner manually "returns" an item mid-trip and then `complete_trip` reverses a flip that's already been undone? Unknown; add to the verification checklist. |

## 3 · The blast-radius table (v1 §4, re-affirmed with FABLED 2 pointers)

| Touches | Via | Read first |
|---|---|---|
| Schedule | `recurrence_pauses`, cancel/reassign | [Schedule FABLED 2.1 §2](<../../Schedule/FABLED 2/1 - FABLED 2 — Current Implementation.md>) — the three-engine situation |
| Budget | trip account direct inserts | [Budget FABLED 2.1 §4](<../../Budget/FABLED 2/1 - FABLED 2 — Current Implementation.md>) — June's account semantics |
| Chores / Meal Planning | skip records | vault docs (Chores has an Overview now) |
| Layout | `/trips` in `ConditionalHeader`/`MobileNav` | unchanged |

## 4 · Test & verification reality

Unchanged from v1, which bears repeating verbatim because it is still true: **nothing is verified end-to-end; no unit tests; the activate→complete round-trip has never been exercised deliberately.** The module remains the app's riskiest combination — widest blast radius, newest code, core logic outside the repo — now with a fourth factor: the environment it cascades into has moved.
