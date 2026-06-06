---
created: 2026-05-30
type: status
status: living
owner: Elio
tags:
  - pm/status
  - scope/module
  - module/trips
---

# Trips · 1 — Feature State — Current Reality

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State — Current Reality.md>) · [2 · Future Vision](<2 - Future Vision & Roadmap.md>) · [3 · Current Action Plan](<3 - Current — Action Plan.md>)
>
> **What this file is:** the *honest, no-hype* state of every Trips sub-feature — what exists, how mature it is, and the single most useful next step. **No imagination here** (that's file 2).
>
> **Method & confidence:** a **structural** assessment derived from the module's vault doc ([Trips / Overview](<../../03 - Junction Modules/Trips/Overview.md>)), the DB schema (`trips`, `trip_places`, `trip_packing_items`, `trip_side_effects`), and `src/features/trips/`. It is **not** a line-by-line correctness audit — and crucially the **cascades have not been verified end-to-end** (verify deferred by choice). Treat tiers as "how battle-tested," not "bug-free."
>
> **Module identity:** Trips is a **Junction** module (committed `e058192`, 2026-05-30). At the app level (global [2 · Feature State](<../2 - Feature State — Current Reality.md>)) it is **🟡 New/Thin** — recently shipped, broad blast radius, and its activation/completion cascades are **unverified**. It connects Budget ↔ Items/Chores ↔ Meal Planning ↔ Catalogue.

---

## Maturity tiers

| Tier | Meaning |
|---|---|
| 🟢 **Core** | Foundational, oldest, used daily, most battle-tested. Regressions here hurt most. |
| 🔵 **Established** | Fully built and shipping; less hammered than Core but stable. |
| 🟡 **New / Thin** | Recently shipped or lightly wired; expect rough edges. |
| 🟠 **Stub / Partial** | Exists but key paths are placeholders or known-incomplete. |
| ⚫ **Orphan / Debt** | Empty, dead, or misfiled. |

---

## Sub-features

| Sub-feature | Tier | Reality / known gaps | Next step |
|---|---|---|---|
| **Trip lifecycle (activate/complete)** | 🟡 New/Thin | `activate_trip()` / `complete_trip()` SECURITY DEFINER RPCs; completion reverses everything logged in `trip_side_effects`. `timeoutMs: 30_000` on both hooks (slow RPC + account creation). **Cascades unverified end-to-end.** | Manual end-to-end verify of activate→complete (the deferred item). |
| **Side-effect ledger** | 🟡 New/Thin | `trip_side_effects` records every cascade so completion can reverse it — the heart of the module. Critical to understand before any change. | Add a verification view: "what did this trip create/pause/cancel?" |
| **Household trip cascade** | 🟡 New/Thin | Chores skipped, recurring events paused via `recurrence_pauses`, one-time events cancelled, meal plans skipped. **`recurring_payments` intentionally NOT paused** (bills still due while travelling). | Verify each cascade type fires and reverses cleanly. |
| **Solo trip cascade** | 🟡 New/Thin | Traveler's items reassigned to partner (`responsible_user_id` flip); meal planning untouched. | Verify the reassignment reverses on completion. |
| **Auto trip account** | 🟡 New/Thin | Created on activation via direct Supabase inserts (mirrors accounts-route logic); **kept after completion**. | Confirm balance direction + cleanup expectations match intent. |
| **Places** | 🟡 New/Thin | `trip_places` — itinerary/locations per trip. | — (verify alongside lifecycle) |
| **Packing list** | 🟡 New/Thin | `trip_packing_items` per trip. | — (verify alongside lifecycle) |
| **Templates** | 🟡 New/Thin | `is_template=true` trips; cloned via `/api/trips/[id]/clone`. | Confirm clone copies places/packing but not side-effects. |

---

## Related code (single source of truth)

Do **not** duplicate file-path tables here — they drift. The authoritative code map lives in:

- [Trips / Overview](<../../03 - Junction Modules/Trips/Overview.md>) — the `trip_side_effects` ledger, the activation/completion RPCs, household vs solo cascade rules, account creation, and templates. **Read this before touching activation/completion logic.**
- Connected modules whose docs you must read before changing a cascade: [Items & Reminders / Overview](<../../02 - Standalone Modules/Items & Reminders/Overview.md>), [Meal Planning / Overview](<../../03 - Junction Modules/Meal Planning/Overview.md>), [Accounts & Balance / Overview](<../../02 - Standalone Modules/Accounts & Balance/Overview.md>), Chores.

---

## The honest weak-link summary

_(Updated 2026-05-30)_

1. **The cascades are unverified end-to-end** — this is the defining gap. activate→complete touches chores, recurring pauses, one-time cancellations, meal skips, item reassignment, and account creation across multiple modules, and **none of it has been run through a real round-trip**. A reversal bug would silently leave a household in a half-travelled state. (Verify was **deferred by choice**, not closed.)
2. **Broad blast radius, brand new.** As a Junction module committed the same day, it has the widest cascade surface and the least battle-testing — the riskiest combination.
3. **The `trip_side_effects` ledger is a single point of correctness.** If a cascade fires without logging, completion can't reverse it. There's no test guarding the log↔reverse symmetry.
4. **One subtle rule is easy to forget:** `recurring_payments` are intentionally *not* paused. A well-meaning "pause everything on travel" change would break a deliberate decision.

→ The growth opportunities are in [2 · Future Vision](<2 - Future Vision & Roadmap.md>); the concrete next steps are in [3 · Current Action Plan](<3 - Current — Action Plan.md>).
