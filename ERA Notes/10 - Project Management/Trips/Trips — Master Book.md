---
created: 2026-05-30
updated: 2026-08-03
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

**Source:** `src/features/trips/`, `src/app/trips/`, `src/app/api/trips/` (17 routes as of 2026-08-03, up from 9 — see Shipped Log), `src/components/trips/`, `src/lib/tripAccess.ts`. DB: `trips`, `trip_places`, `trip_packing_items`, `trip_documents`, `trip_side_effects`. Vault: [Trips / Overview](<../../03 - Junction Modules/Trips/Overview.md>) — **read before touching activation/completion logic**. The Overview doc now leads with a **Planner mode vs. Live mode** split (2026-08-03) — read that first, it changes how the rest of this book should be read.

## Current State (verified)

**Maturity 2.8 / 10 as of 2026-07-18 (FABLED 3) — unchanged across three consecutive generations.** The audit layer is not the bottleneck here; execution is. **This score describes the Live-mode cascade specifically and is still accurate after 2026-08-03** — the planner-mode session below deliberately did not touch it (see the new Planner vs. Live split in the Overview doc). Rescore Live mode only after the RPC bodies are recovered and TRIP-1/2/3 pass; don't let planner-mode progress read as cascade progress.

| Dimension | Score | Evidence |
|---|---|---|
| Design quality | 8 | `trip_side_effects` reversal ledger; `tripAccess.ts` sharing guard is clean and well-commented |
| Verification | 1 | activate→complete has never been exercised with witnesses — 7+ weeks deferred |
| Repo recoverability | 2 | `grep -rn "activate_trip" migrations/` → **zero hits** (re-verified 2026-08-03 — the new `get_trip_bundle()` RPC does NOT count; it's read-only and unrelated to the cascade) |
| Cross-module safety | 3 | the sharing guard *mirrors* `is_public` account logic — a second mirrored-logic drift surface |
| Test protection | 0→1 (cascade still 0) | `getTripPhase()`/`tripCountdown()` now have a real test file (`tripPhase.test.ts`, 14 assertions) — the module's first test, exactly as this book called for. It covers **planner-mode date math only**; the cascade (`activate_trip`/`complete_trip`) remains completely untested, so don't let this line read as progress on Verification above. |
| Handoff readiness | 2 | human-first for lifecycle/cascades; any-model ONLY for UI polish |

> **Escalation clause (recorded 2026-07-18):** if a fourth generation finds the three moves below still unmoved, honour the fallback — **freeze the module in writing** and stop pretending it is active. **Still unmoved as of 2026-08-03** — this session was scoped to planner mode specifically so as not to touch this clause.

| Sub-feature | Tier | Reality |
|---|---|---|
| Trip lifecycle (activate/complete) | 🟡 | `activate_trip()` / `complete_trip()` SECURITY DEFINER RPCs; completion reverses everything logged in `trip_side_effects`; `timeoutMs: 30_000` on both hooks. **Cascades unverified end-to-end; RPC bodies not in the repo.** |
| Side-effect ledger | 🟡 | `trip_side_effects` records every cascade so completion can reverse it — the heart of the module, with no test guarding log↔reverse symmetry |
| Household trip cascade | 🟡 | chores skipped, recurring events paused via `recurrence_pauses`, one-time events cancelled, meal plans skipped. **`recurring_payments` intentionally NOT paused** — bills are still due while travelling |
| Solo trip cascade | 🟡 | the traveller's items reassign to the partner (`responsible_user_id` flip); meal planning untouched |
| Auto trip account | 🟡 | created on activation via direct inserts mirroring accounts-route logic; **kept after completion** |
| Places / Packing / Templates | 🟢 *(was 🟡)* | `trip_places` now a day-by-day itinerary (times, confirmation codes, addresses, drag-reorder, Maps deep links); `trip_packing_items` has starter presets, persisted custom categories, per-person assignment, and drag-reorder. `is_template` trips cloned via `/api/trips/[id]/clone` — now reachable from the UI (Duplicate/Save as template/Start from template), previously fully-implemented dead code. **Manually verified 2026-08-03** against the real household trip in a running browser (see Shipped Log) — this is the one sub-feature in this table that has actually been clicked through, not just typechecked. |
| Documents vault | 🟡 *(new, 2026-08-03)* | `trip_documents` + private `trip-documents` storage bucket; passport/visa/ticket/insurance with pre-departure expiry warnings on Overview. Manually verified the empty-state render only — file upload was not exercised in the browser this session (see Successor Briefing note below). |
| Household sharing | 🟡 | `getAccessibleTrip()` (`b03b2bb`, 2026-07-11): owner always; partner only when `scope === "household"` and the active link matches. **Asymmetric by design** — places/packing are collaborative read+write, but edit/activate/complete/delete stay owner-only. `custom_packing_categories` (2026-08-03) deliberately extends this: collaborative via its own route despite living on the owner-only `trips` row. |

## Pain Inventory

- 🔴 **The cascades are unverified end-to-end.** activate→complete touches chores, recurring pauses, one-time cancellations, meal skips, item reassignment and account creation across modules, and none of it has been run through a real round-trip. A reversal bug would silently leave a household in a half-travelled state.
- 🔴 **`activate_trip` / `complete_trip` bodies exist only in the live Supabase database, not the repo.** You cannot verify what you would be changing. Recovering them is a 30-minute SQL Editor task — and has been for seven weeks.
- 🟠 **Sharing shipped below the verification waterline.** Partner read+write on places/packing of household trips landed on cascade machinery that has never been witnessed working. If a partner edits packing mid-activation, behaviour is unspecified and untested. Friction now; blocker the day two people use it on a real trip.
- 🟠 **Second mirrored-logic surface.** `tripAccess.ts` re-implements the `is_public` scope semantics by hand. Account-sharing semantics already moved once (June); Trips now drifts silently in two places, not one.
- 🟠 **Zero tests.** `tripAccess.ts` is a pure function taking a `SupabaseLike` — mockable by design and the cheapest test in the module.
- 🟡 One subtle rule is easy to forget: `recurring_payments` are intentionally *not* paused. A well-meaning "pause everything on travel" change would break a deliberate decision.
- 🟡 Sharing-under-lifecycle is unspecified — what *should* happen to partner edits when a trip activates or completes mid-edit has never been written down.
- 🟠 **Zero RLS now covers a 5th table.** `trip_documents` (2026-08-03) followed the existing app-layer-only pattern of `trips`/`trip_places`/`trip_packing_items`/`trip_side_effects` rather than fixing the gap, because the honest fix collides with two other rules: a naive `user_id = auth.uid()` policy breaks partner access to household trips, and the household-aware version needs an `EXISTS` subquery Hard Rule #20 forbids on child tables. Not decided unilaterally — flagged here for a real design pass.
- 🟡 **Two docs disagree about `trip_side_effects`.** The Overview doc says "DO NOT query this table for display — it is an internal rollback log only." This checklist's TRIP-4 says build a panel that reads it. Both predate 2026-08-03; neither was resolved by the planner-mode session. One has to give.

## Shipped Log

- ✅ 2026-05-30 — Trips junction module shipped (`e058192`): lifecycle RPCs, side-effect ledger, household and solo cascades, auto trip account, places, packing list, templates
- ✅ 2026-07-11 — household sharing layer (`b03b2bb`): `src/lib/tripAccess.ts` + scope gates on 6 routes, `scope` on `src/types/trips.ts`, partner badge / ownership state in `TripCard` and `TripDetail`
- ✅ 2026-08-03 — **Planner-mode upgrade** (standalone-first; Live mode / cascade untouched, gate unaffected): date-derived trip phase (`draft` no longer means "unusable" — `tripPhase.ts` + first unit test); day-by-day itinerary with times/confirmation codes/addresses/Maps links/drag-reorder (`itinerary/ItineraryView.tsx`, replaces the old flat `TripPlacesList.tsx`); packing presets, persisted custom categories, per-person assignment with person-absolute color identity (Hard Rule #14), drag-reorder, return sweep, and revived clone/template UI (previously dead code) (`TripPackingList.tsx`); `trip_documents` vault with pre-departure expiry warnings (`documents/DocumentsView.tsx`, private `trip-documents` storage bucket); Overview tab rebuilt from two static lines into six data-driven widgets (`overview/OverviewTab.tsx`); `get_trip_bundle()` read RPC (repo-resident, unlike the two lifecycle RPCs) + offline queueing for place/packing edits + trip data added to the app's offline persistence allowlist. Fixed 3 pre-existing bugs (wrong-place Undo restore, clone not resetting `packed_quantity`, hardcoded `$` ignoring trip currency). Migration `2026-08-03_trips-planner-upgrade.sql`, run by Elio same day.
  **Verification:** typecheck/lint/`pnpm test` clean throughout. Also manually verified in a running browser against the real household trip ("Italy - August 2026") after the owner ran the migration — countdown, itinerary day-strip, place add with time/address/confirmation-code, packing category open + assignment cycling (confirmed correct blue/pink identity), Docs tab empty state, and the new Activate-sheet cascade-unverified warning all confirmed working with zero console errors. One real bug was **found and fixed during this pass**: `ItineraryView.tsx`'s place row nested a `<button>`/`<a>` inside an outer `<button>`, an invalid HTML structure that Next.js flagged as a hydration error — fixed by changing the outer element to a `<div role="button">`. Packing document *upload* (the file-picker path) was not exercised in-browser this session — typecheck/lint clean but not click-tested.

## Delivery session log

*(Delivery runner appends dated progress bullets here automatically.)*
- 2026-07-30 — **D2** delivery session `s-20260712-150339-7kw8` ended **cancelled** at CANCELLED. 0 file(s) changed. · ⚠ checklist line has changed since launch (out-of-range) — verify this still refers to the same item
- 2026-07-30 — **D2** delivery session `s-20260712-204625-4qym` ended **cancelled** at CANCELLED. 0 file(s) changed. · ⚠ checklist line has changed since launch (out-of-range) — verify this still refers to the same item

## Vision & Decisions

### The gate (standing sequencing rule)

**Recover the RPC bodies → run the verification round-trips → commit the ledger-symmetry assertion.** Nothing else in this campaign starts before those land. Three generations of enhancement ideas now queue behind a 30-minute SQL Editor task.

The one exemption: a **read-only trip briefing signal** (an upcoming household-scope trip within 7 days surfaces one line in the ERA briefing with dates + packing completion %). No cascade interaction, so it is exempt from the gate — but it has nowhere to render until the Awakening briefing is live.

**Second exemption, added 2026-08-03 *(IMPLEMENTED)*:** the gate blocks *Track A enhancements to the cascade*, not standalone planner-mode work. The Overview doc now formalizes this as the **Planner mode / Live mode split** — itinerary, packing, documents, and any UI/data work touching only `trip_places`/`trip_packing_items`/`trip_documents`/`trips` is exempt from the gate and safe for any-model work; `activate_trip`/`complete_trip`/`trip_side_effects` stay exactly as gated as before. This is why the 2026-08-03 Shipped Log entry below exists without TRIP-1/2/3 having moved.

### Track A — internal enhancements (all gated)

| Enhancement | Today | The dream | Effort |
|---|---|---|---|
| Verify the cascades | fire but unverified | a proven activate→complete round-trip for household **and** solo, with a written checklist | S–M verify / M automate |
| Side-effect transparency view | `trip_side_effects` is internal | a "trip impact" panel: what this trip paused/cancelled/created/reassigned and what completion will reverse — doubles as a permanent verification tool | M |
| Per-cascade opt-out | rules are fixed | toggle which cascades fire per trip ("pause chores but keep meal plans") | M |
| Trip budget rollup | *(2026-08-03) Overview shows a "Planned spend" card summing place costs, explicitly labelled "not actuals"* | trip spend vs budget + a post-trip summary from the **real** trip account (TRIP-11) | M |
| Richer templates | *(2026-08-03) 4 packing presets (Abroad/Beach/Business/Weekend) + revived clone/save-as-template/start-from-template UI* | a full template library seeding places + packing + **cascade prefs** — the cascade-pref half is still gated | M |

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
| Places/packing/documents CRUD field changes | any-model | copy the existing route pattern (`itinerary/`, `documents/`, `TripPackingList.tsx`); keep `getAccessibleTrip` as the ONLY access decision |
| Testing `tripAccess.ts` or `tripPhase.ts` | any-model | pure functions, mockable — `tripPhase.test.ts` is the template |
| Reading trip state for display elsewhere | mid-tier+ | respect `scope`; never re-implement the access rule |
| `get_trip_bundle()` changes | any-model, but re-run the verification manifest | read-only, repo-resident, does not touch the cascade — still worth confirming it stays that way |
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
| RPC bodies still missing | `grep -rn "activate_trip\\|complete_trip" migrations/ \| wc -l` | 0 (any hit means recovery landed — rescore). `get_trip_bundle` IS in the repo by design — don't let that grep hit confuse you if you match too broadly. |
| 17 API routes (was 9 pre-2026-08-03) | `find src/app/api/trips -name route.ts \| wc -l` | 17 |
| One test file (planner-mode only; cascade still untested) | `find src tests -path "*trip*" -name "*.test.*" \| wc -l` | 1 (`tripPhase.test.ts`) — this is expected now, not a red flag; the cascade's test count is still 0 |
| Access rule is single-sourced | `grep -rln "scope === \"household\"" src \| wc -l` | **Corrected 2026-08-03 — the old "1" claim in this row was already stale before this session touched the file; re-verified against ground truth, not assumed.** Actual count is **7**: `tripAccess.ts` (the genuine access decision — this is the one that must stay singular) + `TripActivateSheet.tsx` + `TripDetail.tsx` (pre-existing UI *display-label* reads of `scope`, not access decisions — showing "Household" vs "Solo" text) + 4 hits in `src/app/api/recycle-bin/*` (unrelated module, its own `scope` concept, nothing to do with trips). `get_trip_bundle()` adds an 8th, SQL-side copy of the access *rule itself* (not a display read) that this grep can't see since it only scans `src/`. Re-run this and read every hit before trusting a bare count — a rising number is only a problem if a *new access decision* appears outside `tripAccess.ts`, not if unrelated modules or display code use the same string. |

## Pointers

- Working queue: [4 · Checklist](<4 - Checklist.md>) · conventions: [_Conventions](<../_Conventions.md>)
- Vault: [Trips / Overview](<../../03 - Junction Modules/Trips/Overview.md>) — the ledger, the RPCs, cascade rules, account creation, templates
- Connected module docs to read before changing a cascade: [Items & Reminders](<../../02 - Standalone Modules/Items & Reminders/Overview.md>) · [Meal Planning](<../../03 - Junction Modules/Meal Planning/Overview.md>) · [Accounts & Balance](<../../02 - Standalone Modules/Accounts & Balance/Overview.md>)
- Pre-consolidation originals: `../_Archive/Trips/`
