---
created: 2026-05-30
updated: 2026-07-30
type: master-book
status: active
owner: Elio
consolidates: "_index, 1 - Feature State, 2 - Vision & Roadmap, 3 - Action Plan, FABLED, FABLED 2, FABLED 3 (originals in ../_Archive/Trips/)"
tags:
  - pm/master-book
  - scope/module
  - module/trips
---

# Trips — Master Book

> **Campaign:** Trips · prefix `TRIP` · working queue → [4 · Checklist](<4 - Checklist.md>)

## Identity & North Star

Trips is a **Junction** module (committed `e058192`, 2026-05-30) and the household's **context-switch engine** — when you travel, everything else should adapt: chores pause, routines suspend, meals stop being planned, a dedicated budget appears, and on return it all snaps back. It is the most ambitious junction in the app because it is the only one that *reaches into every other module and reverses itself*.

Two consequences: it is the proof that the app is one graph rather than many apps — **and trust is the whole game**. Until the cascades are verified, every enhancement sits on unverified foundations.

**Vision in one line:** *turn Trips from a feature that fires cascades into a context-switch you can trust — every module adapts when you leave and restores when you return, visibly and reversibly.*

**Source:** `src/features/trips/`, `src/app/trips/`, `src/app/api/trips/` (9 routes, 3,251 LOC), `src/components/trips/`, `src/lib/tripAccess.ts`. DB: `trips`, `trip_places`, `trip_packing_items`, `trip_side_effects`. Vault: [Trips / Overview](<../../03 - Junction Modules/Trips/Overview.md>) — **read before touching activation/completion logic**.

## Current State (verified)

**Maturity 2.8 / 10 as of 2026-07-18 (FABLED 3) — unchanged across three consecutive generations.** The audit layer is not the bottleneck here; execution is.

| Dimension | Score | Evidence |
|---|---|---|
| Design quality | 8 | `trip_side_effects` reversal ledger; `tripAccess.ts` sharing guard is clean and well-commented |
| Verification | 1 | activate→complete has never been exercised with witnesses — 7+ weeks deferred |
| Repo recoverability | 2 | `grep -rn "activate_trip" migrations/` → **zero hits** (re-verified 2026-07-18) |
| Cross-module safety | 3 | the sharing guard *mirrors* `is_public` account logic — a second mirrored-logic drift surface |
| Test protection | 0 | `find src tests -path "*trip*" -name "*.test.*"` → nothing |
| Handoff readiness | 2 | human-first for lifecycle/cascades; any-model ONLY for UI polish |

> **Escalation clause (recorded 2026-07-18):** if a fourth generation finds the three moves below still unmoved, honour the fallback — **freeze the module in writing** and stop pretending it is active.

| Sub-feature | Tier | Reality |
|---|---|---|
| Trip lifecycle (activate/complete) | 🟡 | `activate_trip()` / `complete_trip()` SECURITY DEFINER RPCs; completion reverses everything logged in `trip_side_effects`; `timeoutMs: 30_000` on both hooks. **Cascades unverified end-to-end; RPC bodies not in the repo.** |
| Side-effect ledger | 🟡 | `trip_side_effects` records every cascade so completion can reverse it — the heart of the module, with no test guarding log↔reverse symmetry |
| Household trip cascade | 🟡 | chores skipped, recurring events paused via `recurrence_pauses`, one-time events cancelled, meal plans skipped. **`recurring_payments` intentionally NOT paused** — bills are still due while travelling |
| Solo trip cascade | 🟡 | the traveller's items reassign to the partner (`responsible_user_id` flip); meal planning untouched |
| Auto trip account | 🟡 | created on activation via direct inserts mirroring accounts-route logic; **kept after completion** |
| Places / Packing / Templates | 🟡 | `trip_places`, `trip_packing_items`, `is_template` trips cloned via `/api/trips/[id]/clone` |
| Household sharing | 🟡 | `getAccessibleTrip()` (`b03b2bb`, 2026-07-11): owner always; partner only when `scope === "household"` and the active link matches. **Asymmetric by design** — places/packing are collaborative read+write, but edit/activate/complete/delete stay owner-only |

## Pain Inventory

- 🔴 **The cascades are unverified end-to-end.** activate→complete touches chores, recurring pauses, one-time cancellations, meal skips, item reassignment and account creation across modules, and none of it has been run through a real round-trip. A reversal bug would silently leave a household in a half-travelled state.
- 🔴 **`activate_trip` / `complete_trip` bodies exist only in the live Supabase database, not the repo.** You cannot verify what you would be changing. Recovering them is a 30-minute SQL Editor task — and has been for seven weeks.
- 🟠 **Sharing shipped below the verification waterline.** Partner read+write on places/packing of household trips landed on cascade machinery that has never been witnessed working. If a partner edits packing mid-activation, behaviour is unspecified and untested. Friction now; blocker the day two people use it on a real trip.
- 🟠 **Second mirrored-logic surface.** `tripAccess.ts` re-implements the `is_public` scope semantics by hand. Account-sharing semantics already moved once (June); Trips now drifts silently in two places, not one.
- 🟠 **Zero tests.** `tripAccess.ts` is a pure function taking a `SupabaseLike` — mockable by design and the cheapest test in the module.
- 🟡 One subtle rule is easy to forget: `recurring_payments` are intentionally *not* paused. A well-meaning "pause everything on travel" change would break a deliberate decision.
- 🟡 Sharing-under-lifecycle is unspecified — what *should* happen to partner edits when a trip activates or completes mid-edit has never been written down.

## Shipped Log

- ✅ 2026-05-30 — Trips junction module shipped (`e058192`): lifecycle RPCs, side-effect ledger, household and solo cascades, auto trip account, places, packing list, templates
- ✅ 2026-07-11 — household sharing layer (`b03b2bb`): `src/lib/tripAccess.ts` + scope gates on 6 routes, `scope` on `src/types/trips.ts`, partner badge / ownership state in `TripCard` and `TripDetail`

## Delivery session log

*(Delivery runner appends dated progress bullets here automatically.)*
- 2026-07-30 — **D2** delivery session `s-20260712-150339-7kw8` ended **cancelled** at CANCELLED. 0 file(s) changed. · ⚠ checklist line has changed since launch (out-of-range) — verify this still refers to the same item
- 2026-07-30 — **D2** delivery session `s-20260712-204625-4qym` ended **cancelled** at CANCELLED. 0 file(s) changed. · ⚠ checklist line has changed since launch (out-of-range) — verify this still refers to the same item

## Vision & Decisions

### The gate (standing sequencing rule)

**Recover the RPC bodies → run the verification round-trips → commit the ledger-symmetry assertion.** Nothing else in this campaign starts before those land. Three generations of enhancement ideas now queue behind a 30-minute SQL Editor task.

The one exemption: a **read-only trip briefing signal** (an upcoming household-scope trip within 7 days surfaces one line in the ERA briefing with dates + packing completion %). No cascade interaction, so it is exempt from the gate — but it has nowhere to render until the Awakening briefing is live.

### Track A — internal enhancements (all gated)

| Enhancement | Today | The dream | Effort |
|---|---|---|---|
| Verify the cascades | fire but unverified | a proven activate→complete round-trip for household **and** solo, with a written checklist | S–M verify / M automate |
| Side-effect transparency view | `trip_side_effects` is internal | a "trip impact" panel: what this trip paused/cancelled/created/reassigned and what completion will reverse — doubles as a permanent verification tool | M |
| Per-cascade opt-out | rules are fixed | toggle which cascades fire per trip ("pause chores but keep meal plans") | M |
| Trip budget rollup | auto trip account exists | trip spend vs budget + a post-trip summary ("this trip cost X") | M |
| Richer templates | `is_template` clone | a template library (weekend / abroad / business) seeding places + packing + cascade prefs | M |

### Track B — bridges out of Trips

Trips is *all* bridges by nature; these make the existing cascades legible from the other side.

- **Trips → Schedule** — make it legible which items a trip paused/cancelled/created.
- **Trips → Budget** — the trip account + spend feeds the money graph; surface trip cost in Analytics.
- **Trips → Meal Planning** — make the meal-plan skip visible and undo-able from the meal calendar.
- **Trips → Chores** — skipped chores marked "paused: travelling", not silently absent.
- **Trips → ERA briefing** — "you're back tomorrow — 3 chores and 2 routines resume".

### Not now

- ❌ Don't build any enhancement before the cascade verify passes — it would sit on unverified foundations.
- ❌ Don't change the cascade rules (e.g. start pausing `recurring_payments`) — that's a deliberate decision, not an oversight.
- ❌ Don't touch activation/completion without reading the `trip_side_effects` ledger section of the Overview first.

## Acceptance Criteria Index

### TRIP-1
- **Acceptance:** a real household trip activates with chores skipped, recurring events paused via `recurrence_pauses`, one-time events cancelled, meal plans skipped and the trip account created; completing it reverses **every** row in `trip_side_effects` with no residue.

### TRIP-2
- **Acceptance:** a real solo trip reassigns the traveller's items to the partner, leaves meal planning untouched, and reverses the reassignment on completion.

### TRIP-3
- **Acceptance:** `recurring_payments` rows are unchanged across a full activate→complete cycle, and a regression guard exists so a future "pause everything" change fails loudly.

### TRIP-4
- **Acceptance:** the trip impact panel lists every `trip_side_effects` row grouped by type, and states for each what completion will reverse.

## Successor Briefing

**Who should read this:** **this is the most dangerous module in the app relative to its size.** Its cascade machinery (auto account creation, schedule pauses, side-effect reversal) has never been verified end-to-end, and half its DB logic exists only in the live database. Read this whole section before editing anything.

**First 10 minutes:**

```bash
git log --format="%h %ad %s" --date=short --since=2026-07-18 -- src/features/trips src/app/api/trips src/app/trips src/components/trips src/lib/tripAccess.ts
grep -rn "activate_trip\|complete_trip" migrations/    # if still 0 hits, the recovery task is still open — the danger stands
find src tests -path "*trip*" -name "*.test.*"          # if still empty, Test protection is still 0
```

Then read `src/lib/tripAccess.ts` (the sharing guard) → `src/app/api/trips/[id]/activate/route.ts` (the cascade caller).

**Task-tier map:**

| Task archetype | Tier | Route |
|---|---|---|
| UI polish (cards, badges, packing list layout) | any-model | `ui-guardrails`; no lifecycle interaction |
| Places/packing CRUD field changes | any-model | copy the existing route pattern; keep `getAccessibleTrip` as the ONLY access decision |
| Testing `tripAccess.ts` | any-model | pure function, mockable |
| Reading trip state for display elsewhere | mid-tier+ | respect `scope`; never re-implement the access rule |
| Activate / complete / clone logic; `trip_side_effects`; pause writing | human-first | RPC bodies are not in the repo — you cannot verify what you'd be changing. Propose; let Elio recover them first |
| Trip-account creation path | human-first | mirrors June-drifted accounts semantics (`money-rules` domain) |

**Out-of-depth tells — stop if:** you're about to call `supabase.rpc("activate_trip", …)` with changed arguments; you're adding a second place that decides trip visibility; you're writing schedule pauses from trip code without reading `recurrence-safety`.

**Trap registry:**

| Trap | Symptom | Guard |
|---|---|---|
| RPC bodies live only in Supabase | grep finds callers but no definition; changes look complete but aren't verifiable | recover the bodies before ANY lifecycle change |
| Sharing is asymmetric | partner can edit packing but activate returns owner-only errors | by design — the `tripAccess.ts` doc comment is the spec |
| Solo vs household scope | partner sees nothing for `scope: "solo"` | not a bug; check `scope` before debugging "missing" trips |
| Mirrored account logic ×2 | an accounts-semantics change silently breaks trip-account creation AND tripAccess assumptions | when touching `src/lib/accountAccess.ts` or `is_public`, grep for `tripAccess` and trip account creation |
| Unchanged scores ≠ healthy | three generations of identical numbers | read the escalation clause before assuming "stable" means "good" |

**Verification manifest:**

| Claim | Command | Expected |
|---|---|---|
| RPC bodies still missing | `grep -rn "activate_trip" migrations/ \| wc -l` | 0 (any hit means recovery landed — rescore) |
| 9 API routes | `find src/app/api/trips -name route.ts \| wc -l` | 9 |
| Zero tests | `find src tests -path "*trip*" -name "*.test.*" \| wc -l` | 0 (any hit means rescore) |
| Access rule is single-sourced | `grep -rln "scope === \"household\"" src \| wc -l` | 1 (`tripAccess.ts` only) |

## Pointers

- Working queue: [4 · Checklist](<4 - Checklist.md>) · conventions: [_Conventions](<../_Conventions.md>)
- Vault: [Trips / Overview](<../../03 - Junction Modules/Trips/Overview.md>) — the ledger, the RPCs, cascade rules, account creation, templates
- Connected module docs to read before changing a cascade: [Items & Reminders](<../../02 - Standalone Modules/Items & Reminders/Overview.md>) · [Meal Planning](<../../03 - Junction Modules/Meal Planning/Overview.md>) · [Accounts & Balance](<../../02 - Standalone Modules/Accounts & Balance/Overview.md>)
- Pre-consolidation originals: `../_Archive/Trips/`
