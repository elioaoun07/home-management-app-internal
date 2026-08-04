---
created: 2026-06-20
updated: 2026-08-03
type: checklist
status: active
owner: Elio
tags:
  - pm/checklist
  - scope/module
  - module/trips
---

# Trips · 4 — Checklist

> **Campaign:** [Trips — Master Book](<Trips — Master Book.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the single flat, checkable surface for Trips — every open actionable item under **Now / Next / Later**. Grammar: [_Conventions](<../_Conventions.md>) (validated by `pnpm pm:lint`). The narrative *why* is [Trips — Master Book](<Trips — Master Book.md>). Completed items are swept into the Master Book's Shipped Log and the line deleted — git history is the rest of the archive.
>
> **Legend:** Sev blocker / friction / annoyance / parked. Effort S / M / L.
> **ID migration (2026-07-15):** N1–N3→TRIP-1–TRIP-3, X1→TRIP-4, L1–L5→TRIP-5–TRIP-9.
> **2026-08-03 note:** TRIP-1/2/3 (the gate) are untouched by this session's planner-mode work on purpose — see [Trips / Overview](<../../03 - Junction Modules/Trips/Overview.md>)'s new Planner vs Live split. TRIP-10/11 below are new, standalone, ungated.

---

## Now

- [ ] **TRIP-18** Run `migrations/2026-08-04_trips-packing-checkpoint-recyclebin.sql` in the Supabase SQL Editor — adds `trip_packing_items.deleted_at` (in-context packing recycle bin) + the `trip_packing_checkpoints` table (single-snapshot quick-save/revert of packed status) + updates `get_trip_bundle()` to exclude soft-deleted items. Packing GET/checkpoint/deleted routes return 500 until this runs (confirmed via direct fetch against the live dev server 2026-08-04). → [Trips / Overview](<../../03 - Junction Modules/Trips/Overview.md>) _(blocker - S)_
- [ ] **TRIP-1** Manual end-to-end verify — **household trip.** Activate a real household trip; confirm chores skip, recurring events pause via `recurrence_pauses`, one-time events cancel, meal plans skip, and the trip account is created. Then complete it and confirm **every** side-effect in `trip_side_effects` reverses cleanly. → [Trips / Overview](<../../03 - Junction Modules/Trips/Overview.md>) _(blocker - M)_
- [ ] **TRIP-2** Manual end-to-end verify — **solo trip.** Confirm the traveler's items reassign to partner (`responsible_user_id` flip), meal planning is untouched, and completion reverses the reassignment. _(blocker - M)_
- [ ] **TRIP-3** Confirm `recurring_payments` are **NOT** paused during a trip (deliberate rule — bills still due while travelling); guard against a future "pause everything" regression. _(blocker - S)_

## Next

- [ ] **TRIP-4** Side-effect transparency view — a "trip impact" panel reading `trip_side_effects`: what this trip paused/cancelled/created/reassigned, and what completion will reverse. Doubles as a permanent verification tool. _(friction - M)_

## Later

- [ ] **TRIP-5** Trip budget rollup / post-trip summary ("this trip cost X"). _(annoyance - M)_
- [ ] **TRIP-6** Per-cascade opt-out (choose which cascades fire per trip). _(annoyance - M)_
- [ ] **TRIP-7** Cascade visibility surfaced from the Schedule / Meal / Chores side. _(annoyance - M)_
- [ ] **TRIP-8** Richer template library (weekend / abroad / business) with cascade prefs. _(parked - M)_
- [ ] **TRIP-9** Trips → ERA re-entry briefing ("you're back tomorrow — N items resume"). _(annoyance - M)_
- [ ] **TRIP-10** Catalogue/inventory picker for packing items — `inventory_item_id`/`catalogue_item_id` are accepted by `POST/PATCH .../packing` and typed, but no UI sets them. _(annoyance - M)_
- [ ] **TRIP-11** Replace Overview's "Planned spend" placeholder (sums `trip_places.cost` only) with the trip account's real balance/transactions once actuals matter. _(annoyance - M)_

## Definition of Done

- [ ] **D1** A household trip and a solo trip have each been activated and completed with **every** cascade verified to fire and reverse.
- [ ] **D2** Confirmed `recurring_payments` stay active during a trip.
- [ ] **D3** [Trips — Master Book](<Trips — Master Book.md>) updated to drop the "cascades unverified" note once the round-trips pass.
