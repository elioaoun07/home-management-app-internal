---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - module/schedule
---

# Schedule · FABLED 2.1 — Current Implementation

> **FABLED 2:** [_index](<_index.md>) · **1 · Implementation** · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>) · v1 baseline: [FABLED/1](<../FABLED/1 - FABLED — Current Implementation.md>)
>
> Verified 2026-07-02. v1's fundamentals hold (three placement strategies, `get_schedule_bundle` read path, `canMutateItem()` write truth) — this file records what June changed and pins the engine situation precisely, because it is the module's center of gravity now.

---

## 1 · Mount reality (June rewrite — v1 §1 is obsolete here)

- **`/reminders` is now a two-tab planner:** `Focus` tab = `WebDayPlanner` (`src/components/planner/`) — selected-day triage, Plan-My-Day editor, completed-items toggle (persisted, default-hidden), overdue collapsed; `Assign` tab = `MobileFlexibleAssignmentPage` — flexible catalogue-routine assignment for the period. **`StandaloneRemindersPage.tsx` is deleted**; `/today` redirects; Schedule Insights moved to `/dashboard`.
- **Live capture form:** still `src/components/reminder/MobileReminderForm.tsx` (1,762 LOC) — single-page, NL smart input, inferred type, progressive disclosure, voice, title-only "someday" save, quick date chips, At-Home/Place/Map location.
- **DEAD CODE, third flag:** `src/components/items/MobileItemForm.tsx` — 1,363 lines, zero importers, has already burned one full refactor pass. Still on disk 2026-07-02 (`ls src/components/items/MobileItemForm.tsx`). Do not touch it except to delete it.
- **Plan My Day:** `day_plans` table (migrations `2026-06-16/17`) — title/intent/notes/checklist/is_public; save-gated draft model (one Save, read-only preview after). ⚠️ `intent` is stored but **no optimizer reads it yet** — see [file 4 · E9](<4 - FABLED 2 — Future Enhancements.md>).

## 2 · The engine situation (pin this before any occurrence work)

Three expansion engines coexist; **the tested one is the least used**:

| Engine | Where | Handles | Used by | Tested |
|---|---|---|---|---|
| Inline expansion | `WebCalendar.tsx` (~326–569) | most complete: exceptions, pauses, rescheduled_to | Calendar month/week | ❌ |
| `dayOccurrences.ts` | `src/lib/utils/` | partial: actions yes; some exception/pause dialects unevenly | `/reminders` planner, Today, Mission Control | ✅ (`dayOccurrences.test.ts`, since 06-19) |
| `expandOccurrences.ts` | `src/lib/schedule/` | canonical design: exceptions, pauses, overrides | **nothing** | ✅ |

Two dialects still describe "move one occurrence": `item_occurrence_actions.postponed_to` (written by live UI) vs `item_recurrence_exceptions.override_payload_json.rescheduled_to` (understood by the canonical engine). Unification = Stage 2 of the 2026-06-19 decision (Google/Outlook model: Complete / Skip / Move / Edit-this / Edit-or-delete-series; Cancel only for one-offs). **Stage 1 shipped:** `next_occurrence` postpone deleted from all 4 surfaces; real Skip (`useSkipItem`) wired everywhere; skip vs cancel branched correctly in Mission Control.

## 3 · Write-path hardening that landed in June (the quiet wins)

- **Idempotent occurrence actions:** all four action inserts (complete/postpone/cancel/skip) are now `.upsert(..., { onConflict: "item_id,occurrence_date,action_type" })` — double-taps and offline replays no longer 500-loop (`complete/route.ts`, `actions/route.ts`, fixed 06-21).
- **Completion state is windowless:** `useAllOccurrenceActions` no longer filters to 30 days — completing a 2-month-old occurrence sticks, on all 11 consuming surfaces (06-21).
- **All-household alerts reach both phones:** the `item-reminders` cron collects every owner/partner id across **all** active `household_links` rows into a deduped set (the `.maybeSingle()` multi-row failure fixed, 06-21).
- **RLS truth:** unchanged from the 05-31 verification — policies grant household co-edit; `canMutateItem()` mirrors them. Re-verify via `migrations/_verify_schedule_rls.md` before auth work.

## 4 · Schema truth — the v1 blind spot is half-closed

`migrations/schema.sql` (1,638 lines) now contains **`get_schedule_bundle`'s body and 13 CREATE POLICY statements** (verified by grep 2026-07-02) — v1's "the RPC body is NOT in the repo" no longer applies to *this module*. Residuals: the known bundle blind spot (partner-private `responsible=me` items) is still in the shipped body, and **Trips' RPCs remain unrecovered** (`activate_trip`/`complete_trip` — zero matches in the repo; that risk lives in [Trips FABLED 2.2 · G2](<../../Trips/FABLED 2/2 - FABLED 2 — Gaps & Missing.md>) and interacts with this module through `recurrence_pauses`).

## 5 · Test reality (run 2026-07-02: 93 tests, 92 green, 1 failing)

| Surface | Coverage |
|---|---|
| Occurrence expansion (`expandOccurrences`) | ✅ green |
| Day-occurrence merge + skip/complete/move math (`dayOccurrences`) | ✅ green (new since v1) |
| Placement-rule guard | 🔴 **failing on main** — the guard asserts source text (`/recurrence_rule\??\.is_flexible/`) that `WebTodayView` no longer contains after delegating to `dayOccurrencesInRange`. Known-stale since 06-19; still red. |
| Occurrence-action route behavior (upsert idempotency, exception interplay) | ❌ none |
| `useItems` mutations / API routes | ❌ none |

The failing guard is a **suite-poisoning** problem, not a schedule bug — [file 2 · G2](<2 - FABLED 2 — Gaps & Missing.md>).

## 6 · Size & risk map (re-counted)

| File | LOC | Note |
|---|---|---|
| `src/features/items/useItems.ts` | 2,637 | +16 since v1; subtraction-only rule stands. |
| `src/lib/smartTextParser.ts` | 1,419 | Stable; the NL trust-UX chips remain unbuilt. |
| `src/components/reminder/MobileReminderForm.tsx` | 1,762 | The live form. |
| `src/components/items/MobileItemForm.tsx` | 1,363 | **Dead. Delete.** |
