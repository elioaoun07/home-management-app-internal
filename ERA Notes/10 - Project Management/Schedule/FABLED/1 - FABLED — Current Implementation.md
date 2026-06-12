---
created: 2026-06-10
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled
  - module/schedule
---

# Schedule · FABLED 1 — Current Implementation

> **FABLED:** [_index](<_index.md>) · **1 · Implementation** · [2 · Gaps](<2 - FABLED — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED — Future Enhancements.md>)
>
> Verified against `main` 2026-06-10. The vault docs ([Overview](<../../../02 - Standalone Modules/Items & Reminders/Overview.md>), [Schedule Feature](<../../../02 - Standalone Modules/Items & Reminders/Schedule Feature.md>)) hold the file-level code map; this is the architecture X-ray with the traps marked.

---

## 1 · Mount reality (read this before editing ANY form — the trap that wasted a refactor)

- **Route:** `/reminders` (`src/app/reminders/`) → `StandaloneRemindersPage.tsx` (58 KB). **There is no `src/app/items/`** (Feature Index corrected 2026-06-10).
- **Live mobile capture form:** `src/components/reminder/MobileReminderForm.tsx` (66 KB) — dynamically mounted in `TabContainer.tsx` under the `reminder` tab.
- **DEAD CODE:** `src/components/items/MobileItemForm.tsx` (49 KB, **zero importers**) — the old 5-step wizard. It has already burned one full refactor pass (per memory). Delete it or don't touch it; never "improve" it.
- Desktop/full editing: `EditItemDialog.tsx` (41 KB), `ItemDetailModal`, `ItemActionsSheet`, `ItemsDashboard`, `CalendarView`, `MobileDayExpansionModal` — all in `src/components/items/`.

## 2 · The three placement strategies (the module's core idea)

Every item is placed on time surfaces by exactly one strategy:

1. **Fixed** — one-shot `reminder_details.due_at` / `event_details.start_at`.
2. **Recurring** — `item_recurrence_rules.rrule` expanded against `start_anchor` (DTSTART), wall-clock DST adjustment, bi-weekly phase detection. Exceptions in `item_recurrence_exceptions`; per-occurrence acts in `item_occurrence_actions`; pauses in `recurrence_pauses` (Trips uses these).
3. **Flexible** — "N times per period" via `item_flexible_schedules`. **Universal placement rule:** when `is_flexible`, every view must *skip the rrule loop and inject schedule rows* — forget it and the item lands on its activation day. Now guarded by a test (campaign file 3, checked ✅).

**Pure-logic extraction has begun:** `src/lib/schedule/` — `expandOccurrences.ts` (+ **`expandOccurrences.test.ts`**, in the green 28-test suite), `materializeOccurrence.ts`, `alertResolution.ts`. This is the pattern to continue (file 3 · O1).

## 3 · Read path — the canonical RPC

All hot reads go through **`get_schedule_bundle()`** (SECURITY DEFINER RPC) — the app-wide model for Hard Rules #20/21: one round-trip returns items + reminder/event details + subtasks + alerts + recurrence rules + pauses as JSON aggregates, instead of 7 PostgREST calls (~1.3 s floor saved). ⚠️ **The RPC body is NOT in the repo** — `schema.sql` exports tables only (see CLAUDE.md Database caveat). Known residual: the bundle doesn't surface `responsible=me` private partner items (parked, per RLS memory).

## 4 · Write path & auth truth

API: `api/items` (+ `[id]`, `[id]/actions`, `[id]/complete`, `[id]/pauses`, `[id]/prerequisites`, `[id]/promote`). Client mutations live in `useItems.ts` (**81 KB / ~2,621 LOC** — the module's mega-file) + `useItemActions.ts` (35 KB) + `useFlexibleRoutines.ts` (28 KB).

**RLS truth (verified live 2026-05-31, contra the stale repo schema):** RLS IS enabled on `items` + all child tables; `items_update/delete` grant household co-edit (`user_id = me OR responsible_user_id = me OR (is_public AND active partner)`). The app mirrors this in `canMutateItem()` (`api/items/[id]`) — keep helper and policy in lockstep. Re-verify via `migrations/_verify_schedule_rls.md` before any auth work.

## 5 · Capture UX — current direction (June 2026, UI-only so far)

Per the active campaign (file 6 = master checklist) and standing user signal:

- **Task type is being retired** — Reminder or Event only (DB still has `task`; global retirement deferred).
- **Reminders have NO categories and NO description**; categories are Events-only.
- Date/time = inline native inputs + presets; single clock chip via `showPicker()`; **no modal** for day/time (don't reintroduce one).
- NLP exists and is wired: `src/lib/smartTextParser.ts` (~1,420 lines — type, dates, times, RRULE, priority, categories) with `manualOverrides` tracking + voice. *(Distinct from the budget parser in `src/lib/nlp/`.)*
- Standing signal: capture still "feels too complex for its purpose" — next simplification = collapse always-visible controls into a progressive "+ details", **not** more per-field polish.

## 6 · Satellites

- **Alerts:** `SmartAlertPicker` → `item_alerts` → `item-reminders` cron; suppressions via `item_alert_suppressions`; soft-delete must deactivate alerts.
- **Prerequisites engine:** `src/lib/prerequisites/engine.ts` (7 KB) — NFC→item unlock works; `weather` / `time_window` / `schedule` / `custom_formula` evaluators are **stubs**.
- **Flexible routines ↔ Focus:** `useFlexibleRoutines` + `useFocusInsights` (AI briefing, 24 h cache) — the Focus module is this module's second face.
- **Recurrence edit scope:** `RecurringEditChoiceDialog.tsx` + `EditScopeDialog.tsx` exist — the "this / this-and-future / all" UX is at least partially built; audit actual coverage before scoping the file-2 "recurrence edit UX" enhancement.
- **Catalogue templates:** `source_catalogue_item_id` + `[id]/promote`.

## 7 · Test reality (2026-06-10)

| Surface | Coverage |
|---|---|
| Occurrence expansion (`expandOccurrences`) | ✅ tested (in the green suite) |
| Flexible placement rule | ✅ guard test (campaign ✅) |
| Occurrence **actions** (complete/postpone/skip + exceptions) | ❌ none — the top remaining risk |
| `useItems` mutations / API routes | ❌ none |
