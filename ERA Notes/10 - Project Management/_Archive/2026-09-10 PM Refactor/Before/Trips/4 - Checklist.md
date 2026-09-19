---
created: 2026-06-20
updated: 2026-09-06
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

- [ ] **TRIP-18** (ASTRA application-state correction) Owner verifies current packing-checkpoint/recycle-bin schema and migration application before deciding whether the existing runbook needs execution. The Aug 4 route failure is historical, not proof the migration remains unapplied. → [Verified delta](<ASTRA/Trips — ASTRA Book.md>) _(blocker - S)_
- [ ] **TRIP-1** (ASTRA-TRIP-1; M-02 sequencing decision pending) Verify household activation/completion against a current owner-supplied contract and an isolated witness before relying on real-trip cascades. Keep the full household round-trip criteria; no agent production experiment and no inference from stale SQL. → [Execution sheet](<ASTRA/Trips — ASTRA Packets.md>) _(blocker - M)_
- [ ] **TRIP-2** Manual end-to-end verify — **solo trip.** Confirm the traveler's items reassign to partner (`responsible_user_id` flip), meal planning is untouched, and completion reverses the reassignment. _(blocker - M)_
- [ ] **TRIP-3** Confirm `recurring_payments` are **NOT** paused during a trip (deliberate rule — bills still due while travelling); guard against a future "pause everything" regression. _(blocker - S)_

## Next

- [ ] **TRIP-4** (ASTRA M-02 conflict; held pending sequencing resolution) Side-effect transparency view reads the verified lifecycle contract; a panel cannot substitute for origin, scope and inverse evidence. Existing Planner-only work remains independent. → [Verified conflict](<ASTRA/Trips — ASTRA Book.md>) _(friction - M)_

**Post-trip reconciliation** *(workflow decision 2026-08-19)* — during a trip every card tap is logged manually on the expense form (foreign statement descriptors are unreadable weeks later); after returning, the home-bank statement is uploaded in **audit** mode to prove the manual log tallies. Engine work is [Budget · 4 · Checklist](<../Budget/4 - Checklist.md>) (BUD-26 mode, BUD-27 matching, BUD-28 exception report); Trips owns the entry point and the scoping contract. **Ungated** — read-only over `trips`/`accounts`/`transactions`, no `activate_trip`/`complete_trip`/`trip_side_effects` interaction, so the Planner-mode exemption applies.

- [ ] **TRIP-28** "Reconcile this trip" entry point — a post-trip action on a `completed` (or end-dated) trip that opens statement import in audit mode pre-scoped to that trip: date range widened by the posting-lag window, candidate accounts = the card account the statement belongs to **plus** the trip's own `trips.account_id`, and expected currency = `trips.currency`. Returns the BUD-28 exception report scoped to the trip and nothing else; result feeds the post-trip summary (TRIP-5) and the real-actuals card that replaces "Planned spend" (TRIP-11). → `src/app/trips/` _(friction - M)_

## Later

**ASTRA wave 1 (2026-09-06)** *(study: [ASTRA Book](<ASTRA/Trips — ASTRA Book.md>); sheets: [ASTRA Packets](<ASTRA/Trips — ASTRA Packets.md>))*

ASTRA-TRIP-1 refines the existing TRIP-1/2/3 evidence gate; no new lifecycle or audit engine is queued. ASTRA-TRIP-2 checkpoint acknowledgment is a recorded defect but stays unallocated until after the current contract gate. Read-only trip-date signals can dock into E-04/E-22 independently; Budget owns the audit engine behind TRIP-28. Blind reversal versus preservation of later edits remains an owner decision.

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
