---
created: 2026-09-10
updated: 2026-09-19
type: master-book
status: active
owner: Elio
---

# Trips — Master Book

[Backlog](<4 - Checklist.md>) · [PM home](<../_index.md>) · [Governance](<../_Conventions.md>)

## Purpose & ownership

Plan travel and make real-trip side-effects understandable and reversible. Junction: Budget, Schedule, Kitchen, household and documents.

## Current state & evidence

Planner, packing, documents and account/FX work have shipped. Lifecycle SQL/application, household and solo round-trips still need current owner evidence. Packing acknowledgment is a separate known contract gap; prior shared-document repairs do not establish both-phone acceptance.

Refactored 2026-09-10 against repository HEAD `8d952332b0d7917369ce074730cfe830a5c37a97` and dated source studies. This date records document reconciliation, not a fresh runtime, DB or device witness. The [pre-refactor record](<../_Archive/2026-09-10 PM Refactor/Before/Trips/Trips — Master Book.md>) preserves detailed older narratives and receipts.

## Vision & Decisions

- Live cascade changes require current lifecycle contracts and household/solo round-trip evidence (TRIP-1/2/3). DEC-04 keeps inverse behavior after later user edits and panel-first sequencing unresolved.
- Planner-only itinerary, packing, documents and read-only account/audit work are exempt from the cascade enhancement gate (owner amendment 2026-08-03). They still require their own access/schema verification. The old blanket “nothing else starts” sentence is superseded.
- Recurring payments stay active while travelling. A solo trip reassigns the traveller’s items but leaves meal planning untouched; household cascades must match the owner-verified ledger contract.
- Read-only upcoming/re-entry signals are permitted once an actual briefing consumer exists. Budget owns statement audit/matching/report; Trips owns scope and entry point.
- Completion must not be marked merely because a transparency panel renders. No agent runs a production lifecycle experiment or assumes stale RPC bodies are live.
- **A trip's spend is not defined by its linked account.** Pre-trip costs (visa, flights, deposits) are paid from other accounts, often in another currency, and still belong to the trip. Trip membership is therefore a *tag* on the transaction (`transactions.trip_id`), independent of `account_id` and of the trip's date range. A trip's expenses are the **union** of its linked-account transactions and its tagged transactions, deduplicated by transaction id — a transaction in the trip account that is *also* tagged counts exactly once. *(Data model IMPLEMENTED 2026-09-19 — TRIP-34; the union/dedupe rollup itself is TRIP-5, the tagging UI is TRIP-35.)*

Unresolved policy choices live in the [decision register](<../_Decisions.md>); original exploratory ideas live in [Research options](<../Research/Options.md>). A Later item is retained work, not automatic permission to start.

## Pain Inventory

🔴 **TRIP-18** Verify packing schema application and checkpoint contract. See [acceptance](<#trip-18>) for the root cause, evidence and gate.

🔴 **TRIP-1** Verify the household trip lifecycle. See [acceptance](<#trip-1>) for the root cause, evidence and gate.

🔴 **TRIP-2** Verify the solo trip lifecycle. See [acceptance](<#trip-2>) for the root cause, evidence and gate.

🟠 **TRIP-29** Acknowledge checkpoint writes truthfully. Dated source diagnosis; cause and witness limits are in [criteria](<#trip-29>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

The remaining retained defects, decisions and enhancements are indexed below and ordered once in the checklist. Historical study claims are not new production incidents.

## Acceptance Criteria Index

### TRIP-18

**Outcome:** Verify packing schema application and checkpoint contract.

- **Acceptance:** Owner supplies current packing-checkpoint/recycle-bin schema and application evidence. Apply only missing reviewed SQL if required; the Aug4 failure does not establish present DB state. Verify owner and partner reads/writes and current rollback requirements.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Owner-supplied DB evidence, not code. Hard Rule #27 exists partly because of this family: on 2026-08-04 three documents asserted "no RLS on the trips family" and all three were wrong. **Read `migrations/db-state.json` before anything else** — it is the only repo artifact that is evidence about RLS, policies, cascades and SECURITY DEFINER bodies; `migrations/schema.sql` cannot answer this. The tables in scope are the packing family (`trip_packing_items`, its categories, the checkpoint snapshot table) and the recycle-bin path. Routes that read/write them: `src/app/api/trips/[id]/packing/` (`route.ts`, `bulk/`, `categories/`, `reorder/`, `deleted/`, `[itemId]/`, `[itemId]/restore/`) and `checkpoint/` + `checkpoint/revert/`. Agents never apply SQL (Hard Rule #26). TRIP-29 and TRIP-32 both depend on this landing first.

### TRIP-1

- **Retained campaign gate (D3):** After the actual loop/lifecycle witnesses pass, update the Master Book state and shipped evidence; documentation alone does not close this gate.

- **Retained campaign gate (D1):** A household trip and a solo trip have each been activated and completed with **every** cascade verified to fire and reverse.

**Outcome:** Verify the household trip lifecycle.

- **Acceptance:** Verify household activation/completion against a current owner-supplied contract and an isolated witness before relying on real-trip cascades. Keep the full household round-trip criteria; no agent production experiment and no inference from stale SQL.

- **Acceptance:** a real household trip activates with chores skipped, recurring events paused via `recurrence_pauses`, one-time events cancelled, meal plans skipped and the trip account created; completing it reverses **every** row in `trip_side_effects` with no residue.

**Retained contract — ASTRA-TRIP-1:**

- **Outcome:** The owner has a falsifiable account of what activation and completion change before relying on them.
- **Boundary:** Record function identity/version and auth contract; compare each historical predicate in F1 with the fresh definition. Supply an owner-run inspect/backup/fixture/verify/rollback plan covering household, solo, unlinked owner, unrelated household, pre-existing skip/pause, inactive alert, mid-trip human edit, repeat/concurrent activation, and final status-write failure. Stop at any failed prerequisite; record the smallest follow-on fix, not guessed replacement SQL.
- **Money/schedule math?:** Yes: daily chore Sep6–8 has exactly three exclusions and Sep5/9 remain; an initially inactive alert remains inactive after the round-trip; a distinct household loses zero meals; recurring-payment rows and balances remain unchanged. Account creation yields one zero-balance linked expense account and no duplicate on retry. Compare before/after row IDs and values, not just counts.
- **Gate:** Owner attaches dated, untruncated outputs for every matrix row, including before/after account balances, recurrence occurrences, ledger ownership and current function identity. Mark each PASS/FAIL/UNVERIFIED explicitly. Completion of this *study packet* requires the whole matrix and supported dispositions; TRIP-1/2/3 may be ticked only when their actual round-trip/guard criteria pass. `pnpm pm:lint` → exit 0; attach output. No new application test is claimed.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Verification against a live household trip; no code change, and explicitly no agent production experiment. The contract lives in two SECURITY DEFINER RPCs, not in the routes: `activate_trip` (called from `src/app/api/trips/[id]/activate/route.ts`) and `complete_trip` (`.../complete/route.ts`). Their bodies are in `migrations/db-state.json`, which is the only place the repo records them — read them there rather than inferring cascades from route code. `trip_side_effects` is the ledger every cascade must write and completion must reverse; note it appears nowhere in `src/` (verified 2026-09-20), so it is written entirely inside the RPCs. The five cascades to witness are chores skipped, recurring events paused via `recurrence_pauses`, one-time events cancelled, meal plans skipped, trip account created — the first three belong to Items/Schedule, so `.claude/skills/recurrence-safety/SKILL.md` applies to reading the pause semantics. UI entry points: `src/components/trips/TripActivateSheet.tsx` and `TripCompleteSheet.tsx`.

### TRIP-2

- **Retained campaign gate (D3):** After the actual loop/lifecycle witnesses pass, update the Master Book state and shipped evidence; documentation alone does not close this gate.

- **Retained campaign gate (D1):** A household trip and a solo trip have each been activated and completed with **every** cascade verified to fire and reverse.

**Outcome:** Verify the solo trip lifecycle.

- **Acceptance:** Manual end-to-end verify — **solo trip.** Confirm the traveler's items reassign to partner (`responsible_user_id` flip), meal planning is untouched, and completion reverses the reassignment.

- **Acceptance:** a real solo trip reassigns the traveller's items to the partner, leaves meal planning untouched, and reverses the reassignment on completion.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Same RPCs and same evidence rules as TRIP-1 — read that guide first. The solo-specific claim is a `responsible_user_id` flip on the traveller's items and *no* meal-planning change; both are decided inside `activate_trip`/`complete_trip`, so verify from `migrations/db-state.json` plus a real trip, not from `src/app/api/trips/[id]/activate/route.ts`, which only calls the RPC. `responsible_user_id` lives on `items` — see `src/features/items/` and `src/components/items/` for where it surfaces. Household-versus-solo is a property of the trip row; `src/lib/tripAccess.ts` (`AccessibleTrip`, `getAccessibleTrip`) is how the rest of the app decides scope.

### TRIP-3

- **Retained campaign gate (D2):** Confirmed `recurring_payments` stay active during a trip.

**Outcome:** Keep recurring payments active during trips.

- **Acceptance:** Confirm `recurring_payments` are **NOT** paused during a trip (deliberate rule — bills still due while travelling); guard against a future "pause everything" regression.

- **Acceptance:** `recurring_payments` rows are unchanged across a full activate→complete cycle, and a regression guard exists so a future "pause everything" change fails loudly.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** A guard, not a feature, and the deliberate rule is the point: bills stay due while travelling. Verify that `recurring_payments` rows are untouched across activate→complete — again from the RPC bodies in `migrations/db-state.json`, since nothing in `src/app/api/trips/` writes them. The module that owns those rows is `src/features/recurring/` and `src/app/api/recurring/`; `.claude/skills/recurrence-safety/SKILL.md` is explicit that recurring *payments* and item *recurrence* are two engines that share vocabulary — this item is about the first, while TRIP-1's `recurrence_pauses` cascade is about the second. The regression guard should fail loudly, so a test asserting non-mutation is the deliverable.

### TRIP-4

**Outcome:** Explain verified lifecycle side-effects.

- **Acceptance:** Side-effect transparency view reads the verified lifecycle contract; a panel cannot substitute for origin, scope and inverse evidence. Existing Planner-only work remains independent.
- **Depends on:** [TRIP-1](<Trips — Master Book.md#trip-1>), [TRIP-2](<Trips — Master Book.md#trip-2>), [TRIP-3](<Trips — Master Book.md#trip-3>).

- **Acceptance:** the trip impact panel lists every `trip_side_effects` row grouped by type, and states for each what completion will reverse.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on TRIP-1/2/3 producing a verified contract — the panel presents that contract, it does not establish it. The data source is `trip_side_effects`, reachable through `get_trip_bundle` (`src/app/api/trips/[id]/bundle/route.ts`) if it is included there; check the bundle's shape first, and widen the RPC rather than adding a second query (Hard Rule #21). Render in `src/components/trips/TripDetail.tsx` / `overview/OverviewTab.tsx` with hooks from `src/features/trips/hooks.ts` and keys from `queryKeys.ts`. Grouping by type and stating what completion reverses is the whole UI; Hard Rule #28 keeps it to labels, not explanations. Planner-only work stays independent.

### TRIP-28

**Outcome:** Open statement audit scoped to a trip.

- **Acceptance:** "Reconcile this trip" entry point — a post-trip action on a `completed` (or end-dated) trip that opens statement import in audit mode pre-scoped to that trip: date range widened by the posting-lag window, candidate accounts = the card account the statement belongs to **plus** the trip's own `trips.account_id`, and expected currency = `trips.currency`. Returns the BUD-28 exception report scoped to the trip and nothing else; result feeds the post-trip summary (TRIP-5) and the real-actuals card that replaces "Planned spend" (TRIP-11). → `src/app/trips/`
- **Depends on:** [BUD-26](<../Budget/Budget — Master Book.md#bud-26>), [BUD-27](<../Budget/Budget — Master Book.md#bud-27>), [BUD-28](<../Budget/Budget — Master Book.md#bud-28>).

- **Acceptance:** a completed trip offers "Reconcile this trip"; it opens statement import in audit mode with the trip's date window, both candidate accounts and `trips.currency` pre-applied, returns the exception report for that trip only, and finishes having created **zero** transactions.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** A composition of two existing modules, gated on BUD-26/27/28 landing audit mode in Statement Import. Read `src/features/statement-import/sessionModel.ts` (and its test) plus `hooks.ts` before designing the entry point — the pre-scoping is a session-model concern, not a Trips one. The trip-side inputs all exist on the trip row: `trips.account_id`, `trips.currency`, the date range, and the card account the statement belongs to; `src/lib/tripAccess.ts` `getAccessibleTrip()` is how you fetch it safely. Entry point goes in `src/app/trips/[id]/page.tsx` / `src/components/trips/TripDetail.tsx`, offered only on a completed or end-dated trip — phase logic is already in `src/features/trips/tripPhase.ts` (with `tripPhase.test.ts`). The acceptance's hardest clause is "creates **zero** transactions", so audit mode must be read-only end to end; `.claude/skills/money-rules/SKILL.md` applies.

### TRIP-29

**Outcome:** Acknowledge checkpoint writes truthfully.

- **Acceptance:** ASTRA-TRIP-2: failed or zero-row checkpoint writes cannot report success. Revalidate current route contract after owner schema evidence; this is independent of Planner-only features.
- **Depends on:** [TRIP-18](<Trips — Master Book.md#trip-18>).

**Retained contract — ASTRA-TRIP-2:**

- **Outcome:** Checkpoint restore reports success only when every requested target was actually updated.
- **Boundary:** Validate the complete stored snapshot, reject malformed entries instead of silently filtering, require returned target identity from each update, inspect every result, and refuse a success acknowledgment for missing/denied/failed rows. Preserve trip scoping and exclude soft-deleted targets. Return existing error handling on partial failure with structured server evidence; never label attempted count “applied.” This bounded repair exposes partial failure; it does not promise atomic rollback or repeat the updates automatically.
- **Money/schedule math?:** No. Packing fixture: three requested rows, middle update fails → no success response claiming three; all three returned IDs → applied 3.
- **Gate:** `pnpm exec vitest run tests/trip-checkpoint-revert.test.ts --reporter=verbose` → nonzero mocked route cases pass for success, malformed snapshot, SDK error, zero rows, wrong trip, soft-deleted row and unauthenticated caller. Common gates pass. Owner screenshot at 390×844 after an isolated failure shows existing error handling and no successful restore toast.

**Provenance:** [Trips — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/Trips — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on TRIP-18. The defect is a truthfulness one: `src/app/api/trips/[id]/packing/checkpoint/route.ts` POST reads the previous snapshot, collects items, then writes — and `checkpoint/revert/route.ts` applies one back. Read both and check what each does with Supabase's returned row count: a zero-row update is not an error in PostgREST, so a restore that matched nothing can currently return 200. The fix is to compare requested targets against actually-updated rows and report a partial or failed restore honestly. `getAccessibleTrip()` from `src/lib/tripAccess.ts` already guards access, so this is about the write acknowledgement, not authorization. Note RLS can also silently remove rows (Hard Rule #27) — which is why TRIP-18's evidence comes first. Client: `src/components/trips/TripPackingList.tsx`.

### TRIP-31

**Outcome:** Cover trip ownership predicates.

- **Acceptance:** Pure tripAccess tests cover owner, active partner, unlinked user and source-private attachments. Tests of repo predicates do not establish production RLS.

**Provenance:** [Trips — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/Trips — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Pure unit tests over one small file: `src/lib/tripAccess.ts` — `AccessibleTrip`, `getAccessibleTrip()` and `canAccessTrip()`. Its callers show the four cases worth covering: `src/app/api/transactions/[id]/route.ts` (partner-scope validation on `trip_id`), the documents routes (`[id]/documents/`, `documents/[docId]/`, `documents/signed-urls/`) for source-private attachments, and the packing routes for owner/partner reads. Household linking follows the `household_links` pattern in Hard Rule #13 (`src/app/api/accounts/route.ts` is the canonical example). The acceptance's caveat is the important one: these are tests of a repo predicate and prove nothing about production RLS — that is TRIP-18.

### TRIP-32

**Outcome:** Verify shared trip documents and money setup.

- **Acceptance:** Owner verifies partner Docs/upload, linked/shared account selection, trip currency/manual FX rounding and actuals against the current served revision. Preserve the Aug3 Inbox scope; do not rebuild already-shipped account-link/FX paths.
- **Depends on:** [TRIP-18](<Trips — Master Book.md#trip-18>).

**Provenance:** [Trips — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/Trips — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Owner verification against the served revision; do not rebuild shipped paths. Docs: `src/app/api/trips/[id]/documents/` (list/create), `documents/[docId]/` and `documents/signed-urls/` — all three guard through `getAccessibleTrip()` from `src/lib/tripAccess.ts`; client side is `src/components/trips/documents/DocumentsView.tsx` and `AddDocumentSheet.tsx` with `src/features/trips/documentQueries.ts` (which has its own test). Money setup: `trips.account_id` and `trips.currency`, set through `src/components/trips/TripFormSheet.tsx` and the trip routes; manual FX rounding is money math, so `.claude/skills/money-rules/SKILL.md` applies to any change. Depends on TRIP-18 for the partner-read evidence.

### TRIP-5

**Outcome:** Trip budget rollup / post-trip summary ("this trip cost X").

- **Acceptance:** Trip budget rollup / post-trip summary ("this trip cost X").
- **Acceptance (added 2026-09-19, TRIP-34):** The rollup reads the **union** of (a) transactions whose `account_id` is the trip's `account_id` and (b) transactions whose `trip_id` is this trip — any account, any date — deduplicated by transaction id so a row matching both is counted once. Cross-currency conversion is a separate open question (see the multi-currency note under "Out of scope" in the vault Overview); the union itself must be currency-agnostic.
- **Depends on:** TRIP-34 (shipped 2026-09-19).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on TRIP-34 (shipped 2026-09-19), which added `transactions.trip_id` — so the rollup finally has a real join. Today's Overview shows a placeholder: `src/components/trips/overview/OverviewTab.tsx` sums `places.reduce((sum, p) => sum + (p.cost ?? 0), 0)` under the `Planned spend` label. Actuals come from transactions tagged to the trip plus the trip's own account; read `src/lib/balance-utils.ts` for direction semantics (`expense`/`income`/`saving`) before summing anything, and `.claude/skills/money-rules/SKILL.md` requires a worked before/after example and a test. TRIP-11 replaces the placeholder itself; TRIP-28 feeds reconciled actuals in. Multi-currency trips make `trips.currency` load-bearing.

### TRIP-6

**Outcome:** Per-cascade opt-out (choose which cascades fire per trip).

- **Acceptance:** Per-cascade opt-out (choose which cascades fire per trip).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Per-trip cascade preferences, which means the choice has to reach `activate_trip` — read that RPC's body in `migrations/db-state.json` first, because the cascades are decided inside it and a UI toggle that the function ignores is the obvious failure. Expect a new column or a JSON preferences field on `trips` plus a parameter on the RPC (Hard Rules #24/#26: migration file, then `schema.sql`, then hand the SQL to the owner). The UI lands in `src/components/trips/TripActivateSheet.tsx` / `TripFormSheet.tsx`. Completion must reverse only what fired, which `trip_side_effects` already records. TRIP-1/2/3 should establish the current cascade set before you make it optional.

### TRIP-7

**Outcome:** Show trip cascades in Schedule and Kitchen.

- **Acceptance:** Show verified trip side-effects from Schedule, Meals/Chores and Kitchen packing contexts. Absorbs KIT-9. Read the actual lifecycle contract and link the source trip; do not invent cascade state or independently reverse it.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Presentation of an already-verified contract from three other modules' pages, and it absorbs KIT-9. Trips is a Junction module, so read `ERA Notes/03 - Junction Modules/Trips/` and the connected standalones' docs before importing anything — a standalone feature dir may not import another standalone's, so any shared reader belongs in `src/components/` or `src/lib/`. The surfaces are the schedule/chores views under `src/app/reminders/`, meal planning (`src/features/meal-planning/`, `src/components/web/WebMealPlanCalendar.tsx`) and Kitchen packing contexts. Source of truth is `trip_side_effects` via `get_trip_bundle`; the acceptance forbids inventing cascade state or independently reversing it — link back to the trip and let `complete_trip` do the inverse. Depends in practice on TRIP-4 having surfaced the contract once.

### TRIP-8

**Outcome:** Richer template library (weekend / abroad / business) with cascade prefs.

- **Acceptance:** Richer template library (weekend / abroad / business) with cascade prefs.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Parked. Templates today are the clone path — `src/app/api/trips/[id]/clone/route.ts` — plus whatever `TripFormSheet.tsx` offers at creation; read those before designing a library. Cascade prefs make it depend on TRIP-6 existing. No template data model exists yet, so the first step is deciding where templates live (a `catalogue` category is the app's existing answer for saved templates — see `src/features/catalogue/`) rather than inventing a Trips-only store.

### TRIP-9

**Outcome:** Trips.

- **Acceptance:** Trips → ERA re-entry briefing ("you're back tomorrow — N items resume").

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** A re-entry briefing ("you're back tomorrow — N items resume"), so it is an AI Assistant/proactive surface, not a Trips page. Read `ERA Notes/03 - Junction Modules/AI Assistant/` for the briefing model and its Focus-briefing cache hard rule, and `src/lib/ai/` for the generation path. The content is derivable from `trip_side_effects` (what completion will reverse) plus `trips.end_date`; `src/features/trips/tripPhase.ts` already computes trip phase. Whatever schedules it is a cron concern — there is no `vercel.json`, so nothing time-triggered can be assumed live.

### TRIP-10

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C16. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Select catalogue or stock references for packing.

- **Acceptance:** Catalogue C16: packing picker sends the correct catalogue_item_id or inventory_item_id, resolves display labels without leaking source-private data, and preserves manual packing. Clarify the distinction between a catalogue record and a stock row before writes; existing API fields alone do not prove UI completion.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Catalogue C16, and the acceptance's first demand is conceptual: a catalogue *record* and an inventory *stock row* are different things, and the picker must send the right id (`catalogue_item_id` versus `inventory_item_id`). Read `src/types/catalogue.ts` and `src/features/catalogue/`, then `src/features/inventory/`. The packing rows and their API fields are `src/app/api/trips/[id]/packing/route.ts` (+ `bulk/`, `[itemId]/`); the UI is `src/components/trips/TripPackingList.tsx`. "Existing API fields alone do not prove UI completion" — check whether the columns are actually written and read. Display labels must resolve without leaking source-private data, the same constraint TRIP-33 and HLTH-23 carry.

### TRIP-11

**Outcome:** Replace Overview's "Planned spend" placeholder (sums `trip_places.cost` only) with the trip account's real balance/transactions once actuals matter.

- **Acceptance:** Replace Overview's "Planned spend" placeholder (sums `trip_places.cost` only) with the trip account's real balance/transactions once actuals matter.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The placeholder is exact and verified 2026-09-20: `src/components/trips/overview/OverviewTab.tsx` computes `places.reduce((sum, p) => sum + (p.cost ?? 0), 0)` and labels it `Planned spend`. Replacing it means reading the trip account's real balance and the transactions tagged with `transactions.trip_id` (TRIP-34, shipped) — balance direction rules are in `src/lib/balance-utils.ts` and the `account_type` CHECK constraints in `migrations/schema.sql`. `.claude/skills/money-rules/SKILL.md` is mandatory here: a worked before/after example and a test. Prefer widening `get_trip_bundle` (`src/app/api/trips/[id]/bundle/route.ts`) over adding a second round trip (Hard Rule #21). Shares its outcome with TRIP-5.

### TRIP-30

**Outcome:** Repair trip lifecycle atomically under an agreed inverse.

- **Acceptance:** Held for DEC-04 and current owner lifecycle evidence. Preserve origin, scope, retry and inverse semantics through activation/completion; no blind reversal policy chosen by this refactor. Witness tasks TRIP-1/2/3 remain distinct.
- **Depends on:** [TRIP-1](<Trips — Master Book.md#trip-1>), [TRIP-2](<Trips — Master Book.md#trip-2>), [TRIP-3](<Trips — Master Book.md#trip-3>).

**Provenance:** [Trips — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/Trips — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Held for DEC-04 — record the decision before writing anything. The repair target is the pair of SECURITY DEFINER RPCs `activate_trip` / `complete_trip` (called from `src/app/api/trips/[id]/activate/route.ts` and `complete/route.ts`), whose bodies are only in `migrations/db-state.json`. "Atomically under an agreed inverse" means the ledger semantics of `trip_side_effects` — origin, scope, retry and inverse — must survive; a blind reversal policy is explicitly not authorized. `.claude/skills/data-repair/SKILL.md` is the discipline (inspect → backup → fix → verify → rollback) and its output is a runbook for the owner, never an executed script (Hard Rule #26). Depends on TRIP-1/2/3 having produced the falsifiable account first; those witnesses stay distinct from this repair.

### TRIP-33

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C14. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Attach a saved document snapshot to a trip.

- **Acceptance:** Catalogue C14: explicit selection copies a permitted immutable snapshot with lineage, keeps the trip readable after source changes and prevents source-private leakage.
- **Depends on:** [KIT-20](<../Kitchen/Kitchen — Master Book.md#kit-20>).

**Provenance:** [Trips — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/Trips — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Catalogue C14, depends on KIT-20. The word is *snapshot*: an immutable copy with lineage, so the trip stays readable after the source changes — the existing precedent for a lineage column is `source_catalogue_item_id` (see `src/app/api/items/[id]/promote/route.ts`). Trip documents already exist and are the surface to extend: `src/app/api/trips/[id]/documents/` (+ `[docId]/`, `signed-urls/`), `src/features/trips/documentQueries.ts`, `src/components/trips/documents/DocumentsView.tsx` and `AddDocumentSheet.tsx`, all guarded by `getAccessibleTrip()` from `src/lib/tripAccess.ts`. Source-private leakage is the failure mode TRIP-10 and HLTH-23 share — enforce it in the copy step and the type, not the UI.

### TRIP-35

**Outcome:** Tag a transaction to a trip from the expense form and the transaction editor.

- **Acceptance:** A transaction can be assigned to, and cleared from, an accessible trip (own trip, or the partner's household-scope trip) without changing its account, amount or date. The control is available when editing an existing transaction and when logging a new one. Clearing is reachable. No explanatory prose ships with it (Hard Rule #28).
- **Depends on:** TRIP-34 (shipped 2026-09-19 — column, validation and API support already exist; this is UI only).

**Provenance:** Owner request 2026-09-19 (Italy trip: visa and flights paid from the USD account while daily spend sits in the EUR trip account).

- **Reading guide:** UI only — TRIP-34 already shipped the column, validation and API. Verified 2026-09-20: `src/app/api/transactions/[id]/route.ts` accepts `trip_id`, treats `null`/`""` as clearing it, and validates any non-empty value with `canAccessTrip(supabase, user.id, trip_id)` from `src/lib/tripAccess.ts` (which is what makes a partner's household-scope trip assignable). **The create path does not accept it** — `src/app/api/transactions/route.ts` never mentions `trip_id` (verified 2026-09-20), so logging a new transaction with a trip needs that route widened with the same `canAccessTrip` validation, or a follow-up PATCH. Two client surfaces: logging is `src/components/expense/MobileExpenseForm.tsx` (the live mobile form) with shared state in `ExpenseFormContext.tsx`, and editing is `src/components/dashboard/TransactionDetailModal.tsx`. Trip options come from `src/features/trips/hooks.ts`. Clearing must be reachable, the control must not touch account/amount/date, and Hard Rule #28 forbids explanatory prose — a label and a picker.

## Backlog reconciliation

- 2026-09-10 — **KIT-9** → TRIP-7. Scope is retained in the destination criteria; duplicate removed, not shipped.

## Shipped Log

- ✅ 2026-09-19 — **TRIP-34** Trip membership decoupled from the trip's account at the data layer. Owner request: the Italy trip's daily spend sits in a dedicated EUR account, but the visa fee and flights were paid from the USD account and must still count toward the trip. Added `transactions.trip_id` — nullable `uuid`, FK to `trips(id)` **`ON DELETE SET NULL`** (deliberate: `DELETE /api/trips/[id]` hard-deletes the trip row, so `CASCADE` would destroy money rows and `NO ACTION` would block the delete; untagging is the only safe behavior), plus a partial index `idx_transactions_trip_id ... WHERE trip_id IS NOT NULL` for the future "all spend on trip X" lookup. Existing rows are untouched at `NULL`; no backfill. Backend support wired end-to-end for store + update: `CreateTransactionDTO`/`UpdateTransactionDTO`, the insert payload and the update field builder in `src/services/transaction.service.ts`; `PATCH /api/transactions/[id]`; `trip_id` added to the list-read select and mapping, and to the single-transaction GET response; client `Transaction`/input types in `useDashboardTransactions.ts` (the create/update mutations spread their payloads, so the field reaches the server and the offline queue with no further change). Access is validated on every write via new `canAccessTrip()` in `src/lib/tripAccess.ts`, reusing `getAccessibleTrip()`'s rule — own trip always, partner's trip only at `scope='household'` — so a transaction can never be tagged to a trip its author cannot see; an inaccessible id is rejected before any DB write (`Invalid trip_id` → 400). Tagging is explicitly **not** a balance event: `adjustAccountBalance()` is never called on a trip_id change, and `src/services/transaction.service.trip-tag.test.ts` (8 tests) pins that, plus store/untag/reject/absent-field behavior. **No RLS change** — `transactions` policies are row-level on `user_id`/`household_links` (verified in `migrations/db-state.json`, generated 2026-08-04), so a new column inherits them unchanged. Verification: `pnpm typecheck` clean; `pnpm lint` 0 errors (928 pre-existing warnings); 2,757 tests pass (the one full-suite failure, `tests/pm-ui/react-app-build.test.ts`, is an unrelated pre-existing 5s-timeout flake in uncommitted PM tooling — passes in isolation in 3.4s). **Migration `migrations/2026-09-19_transactions-trip-id.sql` is prepared but owner-run pending (Hard Rule #26); the API will 500 on `trip_id` writes until it is applied.** Out of scope by explicit request and not done: tagging UI (TRIP-35), the trip-expense rollup (TRIP-5), and currency conversion.
- ✅ 2026-08-06 — **TRIP-27** Partner trip documents no longer stay hidden behind a fresh bundle-primed empty cache: the Docs query revalidates whenever the tab mounts or the app regains focus, fetch failures render a retry action instead of a false empty vault, and `documentQueries.test.ts` proves a cached empty array is replaced from `/api/trips/[id]/documents`. DB-state review confirmed the existing household RLS and bundle RPC are already correct, so no migration was added. Verification: targeted regression + all 1,585 tests, typecheck, full lint (zero errors; existing warnings), and docs check clean; Trips PM grammar is clean, while global `pm:lint` remains blocked by the pre-existing Delivery reference to missing `migrations/2026-08-01_pm-commands-instant-gates.sql`. Live partner-device verification remains manual because the in-app browser backend was unavailable.
- ✅ 2026-08-04 — **TRIP-26** Follow-up packing-row compaction after TRIP-25 removed the sidebar and restored the full item canvas: moved `QtyControl`, the person-absolute `AssignChip`, and Delete into one fixed-width right-side control group on the same flex row as the item name. The name remains `flex-1 min-w-0`, so it owns the remaining width while controls stay aligned; the existing `break-words` behavior is preserved for unusually long labels. Removed the indented secondary row entirely and added a descriptive per-item delete `aria-label`. No mutation, assignment-cycle, drag, or packing-state behavior changed. Verification: typecheck, targeted ESLint, `docs:check`, and `git diff --check` clean; all 1,564 tests pass. Live viewport verification remains manual because the in-app browser backend was unavailable.
- ✅ 2026-08-04 — **TRIP-25** Full-screen packing category navigation redesigned after the owner flagged the sidebar and two competing top chevrons as confusing. Removed the persistent/collapsible `CategorySidebar` and its width tax entirely; category switching now lives in a full-width, horizontally scrollable `CategorySwitcher` with icon, name, and `packed/total` context per package. The active chip scrolls into view on open/switch. The header now has one semantic `ArrowLeft` action labelled “All packages”, replacing the rail-collapse chevron + content chevron + redundant close action. The oversized decorative category-icon row was folded into a compact title lockup, returning more vertical space to the actual packing items. The focus overlay now uses `useThemeClasses().bgPage` instead of a hardcoded surface. Existing TRIP-24 item-row wrapping/two-line controls are preserved. Verification: typecheck clean; targeted + full lint have zero errors (existing repo warnings remain); all 1,564 tests pass; `docs:check` and `git diff --check` clean; Trips PM checklist grammar clean (`pm:lint` still fails globally on a pre-existing missing Delivery migration path). In-app visual automation was unavailable in this session (no `iab` browser backend exposed), so the owner-provided 490×980 screenshot was the visual baseline and final live viewport confirmation remains manual.
- ✅ 2026-08-04 — **TRIP-24** Owner-reported regression + redesign ask on the full-screen packing view, `TripPackingList.tsx`, on a real mobile viewport (~390px): TRIP-23's `break-words` fix on `ItemRow`'s name span combined with the pre-existing squeeze layout (`CategorySidebar` as a flex sibling that pushed `CategoryFocusContent` narrower whenever expanded) to produce a genuine bug — the item-name column shrank to near-zero width, and `break-words` degraded to wrapping one character per line ("H/a/i/r/.../i/r/o/n"). Root cause was the squeeze layout, not the wrap CSS itself. Fix, not a patch: (1) `CategorySidebar` is now `absolute`-positioned with its own `z-20` instead of a flex sibling; a permanent `w-14` spacer reserves the collapsed rail's width in the flex flow so `CategoryFocusContent` is always full-width and never renegotiates when the rail expands — expanding it (now `w-56`, was `w-48`) floats it over content with a shadow and a tap-to-close backdrop (`bg-black/40`), a standard drawer pattern, rather than squeezing the item list into a sliver. (2) `ItemRow` split into two lines: primary row is drag handle + checkbox + name (now gets the full row width to itself, wraps normally, no more letter-stacking) + delete; secondary row (indented under the name) holds the qty stepper and assignment chip, which were the two elements most responsible for crowding the single-line version. (3) The content header's category title (`h2`) also had a stray `truncate` (visible as "Electr…" in the bug report) — changed to `break-words` to match TRIP-22/23. Verified: `pnpm typecheck`/`pnpm lint` clean; tested at a genuine 420px-wide viewport in a real browser (`resize_window` + fresh navigation, not just squeezed devtools) — "Hair iron or Dyson" now renders on one line, the sidebar overlay opens/closes (including backdrop tap) without ever squeezing the item list, and item rows read as two clean lines instead of one crowded one.
- ✅ 2026-08-04 — **TRIP-23** Two more owner-requested polish items on the full-screen packing view, `TripPackingList.tsx`: (1) item names (`ItemRow`'s name span) were also truncating with an ellipsis, same class of issue as TRIP-22's sidebar names — changed `truncate` to `break-words` there too. (2) Selecting a category in the expanded `CategorySidebar` left the sidebar expanded, covering more of the item list than necessary once the user had made their choice — `CategoryFocusPanel`'s `onSelect` now also calls `setSidebarOpen(false)` after `onFocusCategory(key)`, so picking a category auto-collapses the rail back to icon-only. Verified: `pnpm typecheck`/`pnpm lint` clean; confirmed in a real browser that selecting "Electronics" from an expanded sidebar switches the category and collapses the rail in the same click.
- ✅ 2026-08-04 — **TRIP-22** Owner-requested polish on the full-screen packing view's `CategorySidebar` (`TripPackingList.tsx`): (1) expanded rows were showing icon + name + a `packed/total` sub-line — three pieces of information per row, one more than the owner wanted — dropped the count line so expanded rows are icon + name only (collapsed rows were already icon-only, unchanged); the now-unused `byCategory` prop/packed/total computation was removed from `CategorySidebar` along with it. (2) Category names (`Documents & Wallet`, `Underwear & Swimwear`) were being truncated with an ellipsis in the expanded rail — changed `truncate` to `break-words` so long names wrap onto a second line instead of being cut off. Verified: `pnpm typecheck`/`pnpm lint` clean; opened the full-screen panel in a real browser, expanded the sidebar, and confirmed both long category names now wrap in full and every row reads icon+name with no count line.
- ✅ 2026-08-04 — **TRIP-21** *(app-wide, not Trips-specific — follow-up to TRIP-20, same entry point)* Owner confirmed TRIP-20's opacity fix worked, then flagged the checkpoint menu's font/spacing/background still didn't "abide by my application look and feel" and ignored theming entirely. Root cause: `src/components/ui/dropdown-menu.tsx` (the raw shadcn primitive) has zero theme awareness — every real consumer either shipped it unstyled (this checkpoint menu, `ItineraryView.tsx`, `TripDetail.tsx`) or hand-rolled the same `useThemeClasses()` className overrides per-file (`UserMenuClient.tsx`, pre-existing), which is exactly the kind of drift Hard Rule #15 exists to prevent but doesn't, since the primitive itself carries no defaults. Fix: added `src/components/shared/DropdownMenu.tsx`, a theme-aware drop-in replacement (`DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSeparator` — the exact set actually used app-wide, checked via grep) built directly on `@radix-ui/react-dropdown-menu` rather than editing `src/components/ui/dropdown-menu.tsx` (Hard Rule #11 / `ui-guardrails` §10 forbids editing `ui/`, PreToolUse-hook enforced). It reuses the same `useThemeClasses()` tokens `src/components/ui/select.tsx` already uses for its own theming (`selectContentBg`, `selectContentShadow`, `selectItemFocus`, `separatorBg`, `textMuted`) so dropdowns and selects read as one visual language across blue/pink/frost/calm, rather than inventing a parallel token set. All 4 real consumers (`TripPackingList.tsx`, `ItineraryView.tsx`, `TripDetail.tsx`, `UserMenuClient.tsx`) repointed their import from `@/components/ui/dropdown-menu` to `@/components/shared/DropdownMenu`; `UserMenuClient.tsx`'s manual per-item theme className overrides (duplicating what the shared component now provides by default) were also stripped, and its sign-out item now uses the new `variant="destructive"` prop instead of a hand-written red className. Verified: `pnpm typecheck`/`pnpm lint` clean on all 5 touched files; opened both the packing checkpoint menu and the user-avatar menu in a real browser — both now render as opaque, rounded, cyan-accented panels with themed hover states, matching the rest of the blue-theme UI. Pink/frost/calm were verified by reading `useThemeClasses.ts`'s token definitions (all 4 branches exist symmetrically for every token used) rather than a live visual pass in each theme, since switching the real theme requires a DB preference write this session didn't make. **Debugging note for future sessions:** while iterating, the dev server repeatedly served a stale JS/CSS module graph after edits — surviving a full page reload, a new browser tab, and even a full `pnpm dev` process restart. Root cause was `.next`'s persistent Turbopack cache surviving the restart; `Remove-Item -Recurse -Force .next` before relaunching cleared it. Separately, Chrome's own HTTP disk cache held stale compiled chunks that a plain reload didn't bypass — `Ctrl+Shift+R` **did** work, but only if given a couple of seconds after the keypress before re-checking; checking immediately gave a false "still stale" reading in TRIP-20's investigation.
- ✅ 2026-08-04 — **TRIP-20** *(app-wide, not Trips-specific — logged here because the owner found it via the Trips packing checkpoint dropdown)* Owner-reported: the checkpoint save/revert menu on the Packing tab rendered see-through, with the "Packing List / 0/141 packed" header and category tiles bleeding through the menu text. Root cause was in `src/app/globals.css`, not the component: a leftover duplicate "shadcn default" theme block (from an old scaffold, never cleaned up) sat *after* the app's real `blue`/`pink` theme definitions and silently re-declared `--popover`/`--card`/`--background`/`--primary`/etc. using the legacy Tailwind v3 bare-HSL-triple format (`222.2 84% 4.9%`) instead of a real CSS color. This file's `@theme inline` maps those straight through (`--color-popover: var(--popover)`, no `hsl()` wrapper), so the bare triple is an invalid CSS color and silently resolves to fully transparent. Because the duplicate block had equal-or-higher selector specificity than the correct block, it won the cascade for both light and dark mode of the **blue** theme (the app default) and the **pink** theme — meaning every shadcn/ui floating panel (DropdownMenu, Popover, Select, Command, Tooltip, Dialog) has been rendering transparent under those two themes since whenever that duplicate block was introduced, not just this one menu. `frost`/`calm` were unaffected (no duplicate block for them). Fix: converted every affected token in the four duplicate blocks (`:root[data-theme="blue"]`, `:root[data-theme="blue"].dark`, `:root[data-theme="pink"]`, `:root[data-theme="pink"].dark`) to literal hex, matching the convention already used by `frost`/`calm`/the rest of the file — `hsl(...)` wrapping was tried first and worked for `blue.dark` but was silently stripped back to an unwrapped (broken) triple by the Turbopack/Lightning CSS minifier specifically for the `pink.dark` block, so hex was used everywhere for reliability rather than depending on that pipeline. Added an inline warning comment in `globals.css` above the theme blocks so a future edit doesn't reintroduce a bare triple. Verified via the compiled `_next/static/chunks/*.css` (grepped for zero remaining bare-triple design tokens) and by opening the actual checkpoint menu in a real mobile-viewport browser tab — confirmed opaque with no bleed-through. **Owner asked to confirm in their own browser before this becomes a standing rule beyond Hard Rule #15** (which already existed but didn't catch this, since the defect was in the shared token definitions, not a component omission).
- ✅ 2026-08-04 — **TRIP-19** Packing UX pass, owner-requested (5 items): (1) larger item/input text (`text-sm`→`text-base`) in `ItemRow`/`InlineAddRow`/`QtyControl`/the focus-panel title for mobile readability — **live now, no migration needed**; (2) the full-screen category view (`CategoryFocusPanel`) restructured into a persistent overlay shell with a collapsible left `CategorySidebar` (icon rail collapsed, name+progress expanded) so switching categories no longer drops back to the grid — the per-category content (`CategoryFocusContent`) remounts on `key={focusedKey}` to reset its local drag-order state cleanly — **live now**; (3) a single-snapshot packing checkpoint (`trip_packing_checkpoints`, one row per trip) — Save/Revert in a header dropdown, both with a real Undo (save's Undo re-upserts the exact prior snapshot verbatim via a `restore` body on the same route, or deletes the row if there was no prior checkpoint — not just a client-side display tweak, which would have silently left the wrong snapshot as the source of truth for a later revert) — **migration-pending**; (4) packing-item DELETE changed from hard delete to soft delete (`trip_packing_items.deleted_at`), fixing a real pre-existing bug where the old Undo re-inserted a fresh row and silently dropped `packed_quantity`/`is_packed`/`position` — new `deleted`/`restore` routes back an in-context "Deleted items" sheet scoped to the current trip only (not the app-wide Recycle Bin) — **migration-pending**; (5) ownership display/filter (`user_id`-based Mine/Partner) was scoped out — the existing `assigned_to`-based chip/filter (shipped 2026-08-03) already covers it and the owner will set values directly in the DB. **Design note:** the checkpoint snapshot was deliberately *not* added as a column on `trips` — `migrations/db-state.json` (generated 2026-08-04T10:06:44Z) shows `trips` has only an owner-only `ALL` policy (`trips_owner`) plus a partner `SELECT`-only policy, no partner `UPDATE`; a column there would have silently no-op'd for the non-owner partner (the exact Hard Rule #27 failure class). Given its own child table (`trip_packing_checkpoints`) with a `trip_is_accessible()` policy instead, matching the `trip_packing_category` precedent. Migration `2026-08-04_trips-packing-checkpoint-recyclebin.sql` also updates `get_trip_bundle()` to exclude soft-deleted items from its `packing` array. Verified: `pnpm typecheck`/`pnpm lint` clean (zero new warnings in touched files); confirmed via direct `fetch()` against the live dev server that `/packing`, `/packing/checkpoint`, `/packing/deleted` currently 500 (`column trip_packing_items.deleted_at does not exist` / `table 'trip_packing_checkpoints' not found in schema cache`) pending the owner running the migration — see TRIP-18. Not yet click-tested end-to-end in-browser for that reason.
- ✅ 2026-08-04 — **TRIP-17** Inline packing capture no longer holds the previous name until its API response, which made the next line look like a duplicate and blocked rapid sequential adds. The input now clears and re-focuses synchronously with the hook's optimistic row; a failed request restores the submitted name only when the user has not begun another item. The submit control remains available for concurrent optimistic adds. Verified with `pnpm typecheck`.
- ✅ 2026-08-04 — **TRIP-16** Packing-item creation and presets returned 500 because all packing write routes still sent a removed legacy `trip_packing_items.category` field while `schema.sql` exposes `category_id` as the sole category column. Removed the field from single, bulk, and patch request schemas/writes, updated optimistic restore and category displays to use the lookup relation, and verified with `pnpm typecheck`.
- ✅ 2026-08-04 — **TRIP-15** Household trips were invisible to the partner. Owner-reported: a `scope='household'` trip (`Italy - August 2026`) never appeared in the partner's list. Root cause was **not** in the application code — `GET /api/trips` (`route.ts:25`), `getAccessibleTrip()` and `get_trip_bundle()` all implement partner access correctly. `trips`/`trip_places`/`trip_packing_items` have RLS **enabled** in the live DB with own-user-only policies, while the vault, the 2026-08-03 migration comment and this book's Pain Inventory all claimed the trips family had no RLS at all — so no household-aware policy was ever written. RLS stripped the owner's rows before the route's `.or()` filter ran: correct logic, zero rows, no error. Trip *detail* kept working because `get_trip_bundle()` is SECURITY DEFINER and bypasses RLS, which is why it hid for eight weeks. Fix: `migrations/2026-08-04_trips-household-rls.sql` adds two SECURITY DEFINER predicates (`is_household_partner`, `trip_is_accessible` — Hard Rule #20's preferred option, not an inline `EXISTS` on a child table), a permissive partner-SELECT policy on `trips` (writes stay owner-only), collaborative read+write policies on `trip_places`/`trip_packing_items`, and **enables RLS on `trip_packing_category` and `trip_documents`**, which had it off entirely and were readable/writable by any authenticated user through PostgREST. All policies permissive, so nothing that worked loses access. No application code changed. Evidence: `pg_class.relrowsecurity` + `pg_policies` output pasted by owner 2026-08-04. **Migration prepared, owner-run pending (Hard Rule #26).**
- ✅ 2026-08-04 — **TRIP-12** Packing-category lookup (`trip_packing_category` + nullable `trip_packing_items.category_id`), collaborative CRUD/query hooks, clone and bundle support, and legacy rendering during owner-run manual backfill. Migration `2026-08-04_trip-packing-category-lookup.sql` is prepared but not applied.
- ✅ 2026-08-04 — **TRIP-13** Packing category icon/color lookup reworked for the now-real `trip_packing_category` table (`TripPackingList.tsx`): exact-match dictionary extended with `Shoes`/`Bags`/`Swim`, a keyword-alias layer resolves compound names (e.g. "Documents & Wallet", "Bags & Travel Gear", "Underwear & Swimwear") to the right built-in look, and any category matching neither now hashes on its DB `id` (stable across renames) into a 6-entry rotating palette instead of collapsing to flat gray. Shoe glyph replaced with Tabler Icons' MIT `shoe` outline (attributed inline); swimwear glyph hand-drawn as a two-piece (no permissively-licensed swimwear glyph exists in Tabler/Lucide).
- ✅ 2026-08-04 — **TRIP-14** Packing category tiles lost their colour wash (owner-reported: Shoes and Underwear & Swimwear rendered flat/colourless while sibling tiles were fine). Root cause: the tile gradient was the one visual property still expressed as Tailwind class strings (`from-X/35 via-X/15 to-X/5`) inside a data lookup table, so it depended on the class surviving Tailwind's scanner and the dev-server CSS bundle staying fresh — `iconColor`/`borderColor` were already raw values and kept working, which is why only the wash disappeared. Verified via `npx @tailwindcss/cli` that the classes *do* compile, confirming a stale bundle rather than a source error. Fix: `gradient` (classes) → `gradientColor` (hex) + optional `gradientStops`, applied inline through a `categoryGradient()` helper at both render sites; zero Tailwind gradient classes remain in the file, so all 17 entries — including the six fallback-palette colours that were equally at risk — are now immune.

## Delivery session log

*(Delivery runner appends dated progress bullets here automatically.)*
- 2026-07-30 — **D2** delivery session `s-20260712-150339-7kw8` ended **cancelled** at CANCELLED. 0 file(s) changed. · ⚠ checklist line has changed since launch (out-of-range) — verify this still refers to the same item
- 2026-07-30 — **D2** delivery session `s-20260712-204625-4qym` ended **cancelled** at CANCELLED. 0 file(s) changed. · ⚠ checklist line has changed since launch (out-of-range) — verify this still refers to the same item

## Successor Briefing

Read the checklist, the selected acceptance entry and its dependencies; then use the [Feature Map](<../../01 - Architecture/Feature Map/_index.md>) for source routing and the module architecture docs for invariants. Delta from the source cutoff before implementation. Use current owner-supplied DB evidence for access/application questions; agents never apply production SQL. Record code, applied migration and device/runtime acceptance separately.

Finish with the repository playbook and [governance](<../_Conventions.md>): update acceptance/evidence, sweep only completed work, and validate the canonical queue. A completed child does not complete its coordination parent.
