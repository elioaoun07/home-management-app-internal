---
created: 2026-09-10
updated: 2026-09-26
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

**Plan navigation:** Open items below carry embedded drafts under [item execution plans](../_Conventions.md#9-item-execution-plans). Read only the selected ID and its dependencies. Prepared 2026-09-26 against source HEAD `45b28899`; implementation review, owner SQL application and device acceptance remain separate. No plan is owner-reviewed or dispatched by this document update.

### TRIP-18

**Outcome:** Verify packing schema application and checkpoint contract.

- **Acceptance:** Owner supplies current packing-checkpoint/recycle-bin schema and application evidence. Apply only missing reviewed SQL if required; the Aug4 failure does not establish present DB state. Verify owner and partner reads/writes and current rollback requirements.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Owner-supplied DB evidence, not code. Hard Rule #27 exists partly because of this family: on 2026-08-04 three documents asserted "no RLS on the trips family" and all three were wrong. **Read `migrations/db-state.json` before anything else** — it is the only repo artifact that is evidence about RLS, policies, cascades and SECURITY DEFINER bodies; `migrations/schema.sql` cannot answer this. The tables in scope are the packing family (`trip_packing_items`, its categories, the checkpoint snapshot table) and the recycle-bin path. Routes that read/write them: `src/app/api/trips/[id]/packing/` (`route.ts`, `bulk/`, `categories/`, `reorder/`, `deleted/`, `[itemId]/`, `[itemId]/restore/`) and `checkpoint/` + `checkpoint/revert/`. Agents never apply SQL (Hard Rule #26). TRIP-29 and TRIP-32 both depend on this landing first.

**Execution plan — 2026-09-26**

**Readiness:** owner evidence.

**Verify:** Owner refreshes `migrations/db-state.json`; run `pnpm db:verify-rls` after receiving it. Record schema/policy/application results and owner/partner checkpoint save, revert, delete and restore as PASS/FAIL/UNVERIFIED; no agent production call.

**Scope notes:** `migrations/db-state.json`: owner-supplied refresh. Name any proposed migration only after schema review; `migrations/` is the preliminary boundary. `migrations/schema.sql`: only with a paired migration.

```delivery-plan-v1
{
  "outcome": "Establish the current packing/checkpoint deployment and access contract before relying on its writes.",
  "acceptance": [
    "Current owner evidence identifies packing/category/checkpoint schemas, policies, functions and applied migration state.",
    "Owner and active partner can perform permitted collaborative packing operations; partners cannot access solo trips and unrelated users are denied.",
    "Only genuinely missing reviewed SQL is handed to the owner; rollback and remaining failures are explicit."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/Trips/Trips — Master Book.md",
    "migrations/db-state.json",
    "migrations/",
    "migrations/schema.sql"
  ],
  "steps": [
    "Request a fresh untruncated db-state.sql export and current served revision; the committed snapshot is dated 2026-08-04.",
    "Compare trip_packing_items, trip_packing_category, trip_packing_checkpoints, trips and the existing in-trip deleted-items path with the authored migration contract.",
    "Prepare only missing reviewed SQL and owner-run inspect/backup/fixture/verify/rollback steps; never execute it or infer application from its presence.",
    "Collect owner/partner isolated save/revert/delete/restore results and record exact row identities, policies and outcome; separate schema application from runtime acceptance."
  ],
  "invariants": [
    "A correct route cannot prove RLS permits the write.",
    "The packing deleted-items sheet is not the global Recycle Bin."
  ],
  "exclusions": [
    "Automatic migration application, production experiments and TRIP-29 acknowledgment repair."
  ],
  "risks": [
    "Stale or truncated policy evidence can make a silent zero-row write appear authorized."
  ],
  "unknowns": [
    "Current packing-checkpoint deployment, policies, grants and device build are unverified."
  ],
  "dependencies": [],
  "risk": "high",
  "provenance": "2026-09-26 checked the snapshot date and Trips packing documentation. The 2026-08-04 snapshot is historical evidence only; no application route was used to certify current access.",
  "checks": [],
  "ownerReviewed": false
}
```

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

**Execution plan — 2026-09-26**

**Readiness:** owner evidence.

**Verify:** Use the retained household fixture matrix: exact row IDs/values before and after, daily Sep6–8 exclusions only, initially inactive alerts, independent edits, retry/concurrency and final status-write failure. Owner supplies untruncated outputs; `pnpm pm:lint` validates the record only.

**Scope notes:** `migrations/db-state.json`: owner-supplied refresh.

```delivery-plan-v1
{
  "outcome": "Give the owner a falsifiable household activation/completion contract and complete round-trip evidence.",
  "acceptance": [
    "Current activate_trip/complete_trip identity, authorization and side-effect ownership are recorded.",
    "The household round-trip witnesses chores, recurrence pauses, one-time events, meals and one zero-balance linked expense account.",
    "Completion reverses the appropriate ledger-owned changes without foreign-household residue; failures remain explicit."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/Trips/Trips — Master Book.md",
    "migrations/db-state.json"
  ],
  "steps": [
    "Obtain current RPC definitions, grants and schema evidence before comparing historical cascade claims; inspect route-side account/status writes as part of the full boundary.",
    "Prepare the retained inspect/backup/isolated-fixture/verify/rollback matrix, including unlinked/unrelated users, pre-existing skips/pauses, inactive alerts and human edits during travel.",
    "Have the owner run the matrix on a suitable isolated fixture; compare exact ledger, occurrence, meal, account and balance values rather than counts alone.",
    "Record PASS/FAIL/UNVERIFIED for each case and the smallest evidence-backed follow-up; do not choose DEC-04's inverse policy or silently repair the functions.",
    "Close this item only when its actual household round-trip passes; a completed runbook or panel is insufficient."
  ],
  "invariants": [
    "Recurring payments and existing balances remain unchanged.",
    "No agent runs activation/completion against production."
  ],
  "exclusions": [
    "Lifecycle replacement SQL, guessed reversal semantics and trip impact UI."
  ],
  "risks": [
    "Account creation/status writes outside the RPC can fail independently; checking only the RPC body misses the full operation."
  ],
  "unknowns": [
    "Fresh function bodies, deployment identity, owner witness and DEC-04 behavior after later edits."
  ],
  "dependencies": [
    "Current owner lifecycle evidence; DEC-04 for any changed inverse policy"
  ],
  "risk": "high",
  "provenance": "2026-09-26 retained ASTRA-TRIP-1 and Trips lifecycle docs reviewed; source cutoff has no scoped lifecycle delta. Historical snapshot and prose are not current runtime certification.",
  "checks": [],
  "ownerReviewed": false
}
```

### TRIP-2

- **Retained campaign gate (D3):** After the actual loop/lifecycle witnesses pass, update the Master Book state and shipped evidence; documentation alone does not close this gate.

- **Retained campaign gate (D1):** A household trip and a solo trip have each been activated and completed with **every** cascade verified to fire and reverse.

**Outcome:** Verify the solo trip lifecycle.

- **Acceptance:** Manual end-to-end verify — **solo trip.** Confirm the traveler's items reassign to partner (`responsible_user_id` flip), meal planning is untouched, and completion reverses the reassignment.

- **Acceptance:** a real solo trip reassigns the traveller's items to the partner, leaves meal planning untouched, and reverses the reassignment on completion.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Same RPCs and same evidence rules as TRIP-1 — read that guide first. The solo-specific claim is a `responsible_user_id` flip on the traveller's items and *no* meal-planning change; both are decided inside `activate_trip`/`complete_trip`, so verify from `migrations/db-state.json` plus a real trip, not from `src/app/api/trips/[id]/activate/route.ts`, which only calls the RPC. `responsible_user_id` lives on `items` — see `src/features/items/` and `src/components/items/` for where it surfaces. Household-versus-solo is a property of the trip row; `src/lib/tripAccess.ts` (`AccessibleTrip`, `getAccessibleTrip`) is how the rest of the app decides scope.

**Execution plan — 2026-09-26**

**Readiness:** owner evidence.

**Verify:** Owner-run solo round-trip: traveller/partner/unrelated users, exact responsible_user_id values, unchanged meals and payments, retry, absent partner and later-edit cases. Reuse TRIP-1 evidence format and record unresolved inverse results honestly.

**Scope notes:** `migrations/db-state.json`: owner-supplied refresh.

```delivery-plan-v1
{
  "outcome": "Verify that a solo trip reassigns only the traveller's intended work and leaves meal planning unchanged.",
  "acceptance": [
    "Activation changes eligible traveller assignments to the active partner under the current verified contract.",
    "Meals and unrelated users' items remain unchanged.",
    "Completion reverses the trip-owned reassignments, with repeat/failure and human-edit outcomes recorded."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/Trips/Trips — Master Book.md",
    "migrations/db-state.json"
  ],
  "steps": [
    "Reuse TRIP-1's current function identity and authenticated scope evidence; do not infer solo behavior from the route's RPC call.",
    "Prepare a solo-specific fixture with traveller-owned, partner-owned and unrelated items, existing assignees, meals and no-partner variation.",
    "Have the owner capture before/activation/completion values and ledger ownership, including replay and a human reassignment during travel.",
    "Compare each result against the accepted solo contract and DEC-04 boundary; record the smallest failing predicate for later repair.",
    "Keep the real solo acceptance pending until all required witnesses pass, independently of household verification."
  ],
  "invariants": [
    "A solo trip never changes meal planning or recurring payments.",
    "Partner visibility does not grant activation/completion ownership."
  ],
  "exclusions": [
    "New assignment policy, lifecycle repair, household trip certification and agent production experiments."
  ],
  "risks": [
    "A count-only comparison can miss reassignment of the wrong person's item."
  ],
  "unknowns": [
    "Current solo RPC predicates, no-partner behavior and inverse behavior after an independent edit."
  ],
  "dependencies": [
    "TRIP-1 current-contract evidence can be reused; household pass is not a substitute for solo proof"
  ],
  "risk": "high",
  "provenance": "2026-09-26 plan from the retained solo acceptance and Trips ownership docs. Current source has no new lifecycle delta; owner runtime evidence remains absent.",
  "checks": [],
  "ownerReviewed": false
}
```

### TRIP-3

- **Retained campaign gate (D2):** Confirmed `recurring_payments` stay active during a trip.

**Outcome:** Keep recurring payments active during trips.

- **Acceptance:** Confirm `recurring_payments` are **NOT** paused during a trip (deliberate rule — bills still due while travelling); guard against a future "pause everything" regression.

- **Acceptance:** `recurring_payments` rows are unchanged across a full activate→complete cycle, and a regression guard exists so a future "pause everything" change fails loudly.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** A guard, not a feature, and the deliberate rule is the point: bills stay due while travelling. Verify that `recurring_payments` rows are untouched across activate→complete — again from the RPC bodies in `migrations/db-state.json`, since nothing in `src/app/api/trips/` writes them. The module that owns those rows is `src/features/recurring/` and `src/app/api/recurring/`; `.claude/skills/recurrence-safety/SKILL.md` is explicit that recurring *payments* and item *recurrence* are two engines that share vocabulary — this item is about the first, while TRIP-1's `recurrence_pauses` cascade is about the second. The regression guard should fail loudly, so a test asserting non-mutation is the deliverable.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Propose `tests/trip-recurring-payment-guard.test.ts` after identifying the complete current lifecycle write contract. Owner isolated activate→complete fixture compares recurring-payment row IDs and values; mocked or static checks alone do not prove live non-mutation.

**Scope notes:** `tests/trip-recurring-payment-guard.test.ts`: proposed.

```delivery-plan-v1
{
  "outcome": "Keep bills active throughout travel and make a future payment-pausing regression visible.",
  "acceptance": [
    "Recurring-payment rows remain unchanged through both household and solo activation/completion.",
    "An automated guard fails when the verified lifecycle boundary gains a recurring-payment mutation.",
    "Item recurrence pauses remain independently supported."
  ],
  "scope": [
    "tests/trip-recurring-payment-guard.test.ts",
    "ERA Notes/10 - Project Management/Trips/Trips — Master Book.md"
  ],
  "steps": [
    "Use the current owner-supplied lifecycle definitions from TRIP-1/2; enumerate route-side and RPC writes before choosing the guard seam.",
    "Add the narrow regression fixture/assertion over that complete contract; include a deliberately payment-mutating negative control so the guard is not vacuous.",
    "Have the owner compare complete recurring-payment rows before, during and after isolated household and solo cycles.",
    "Record automated source-contract evidence separately from live row evidence; report any mutation as a lifecycle defect rather than changing the payments engine."
  ],
  "invariants": [
    "Item recurrence and recurring payments are separate systems.",
    "Travel does not pause, cancel or reschedule a bill."
  ],
  "exclusions": [
    "Recurring-payment redesign, cron changes and broad trip lifecycle repair."
  ],
  "risks": [
    "A test that only searches route files misses mutations inside SECURITY DEFINER functions."
  ],
  "unknowns": [
    "The appropriate executable guard seam depends on refreshed function evidence."
  ],
  "dependencies": [
    "TRIP-1 and TRIP-2 current lifecycle contracts"
  ],
  "risk": "medium",
  "provenance": "2026-09-26 docs-grounded from retained D2 and recurrence rules. No new guard exists from this planning session; its proposed file and negative control are implementation work.",
  "checks": [],
  "ownerReviewed": false
}
```

### TRIP-4

**Outcome:** Explain verified lifecycle side-effects.

- **Acceptance:** Side-effect transparency view reads the verified lifecycle contract; a panel cannot substitute for origin, scope and inverse evidence. Existing Planner-only work remains independent.
- **Depends on:** [TRIP-1](<Trips — Master Book.md#trip-1>), [TRIP-2](<Trips — Master Book.md#trip-2>), [TRIP-3](<Trips — Master Book.md#trip-3>).

- **Acceptance:** the trip impact panel lists every `trip_side_effects` row grouped by type, and states for each what completion will reverse.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on TRIP-1/2/3 producing a verified contract — the panel presents that contract, it does not establish it. The data source is `trip_side_effects`, reachable through `get_trip_bundle` (`src/app/api/trips/[id]/bundle/route.ts`) if it is included there; check the bundle's shape first, and widen the RPC rather than adding a second query (Hard Rule #21). Render in `src/components/trips/TripDetail.tsx` / `overview/OverviewTab.tsx` with hooks from `src/features/trips/hooks.ts` and keys from `queryKeys.ts`. Grouping by type and stating what completion reverses is the whole UI; Hard Rule #28 keeps it to labels, not explanations. Planner-only work stays independent.

**Execution plan — 2026-09-26**

**Readiness:** decision held.

**Verify:** After gates clear, propose impact-response/UI fixtures for every verified ledger type, missing/failed retrieval, owner/partner visibility and completed-trip state. Check 390×844; typecheck/lint; never treat a rendering test as lifecycle proof.

**Scope notes:** Name any proposed migration only after schema review; `migrations/` is the preliminary boundary. `tests/trip-impact.test.ts`: proposed.

```delivery-plan-v1
{
  "outcome": "Show the verified effects of a trip and what completion can reverse.",
  "acceptance": [
    "The panel groups every authorized effect by its verified type and inverse behavior.",
    "Origin, scope and unavailable data remain explicit; no guessed cascade state.",
    "The view consumes the verified contract without independently reversing effects."
  ],
  "scope": [
    "src/app/api/trips/[id]/bundle/route.ts",
    "src/features/trips/hooks.ts",
    "src/features/trips/queryKeys.ts",
    "src/types/trips.ts",
    "src/components/trips/overview/OverviewTab.tsx",
    "migrations/",
    "migrations/schema.sql",
    "tests/trip-impact.test.ts"
  ],
  "steps": [
    "Resolve DEC-04's panel sequencing and the documented conflict: Overview forbids displaying the internal ledger while this acceptance requests it.",
    "After TRIP-1/2/3 proof, define the smallest authorized projection and completed-trip behavior; never expose raw private rollback preimages.",
    "Extend the existing bundle contract if it lacks the projection, using one read path and an owner-run paired migration where needed.",
    "Render grouped labels and concise inverse state; preserve error/unavailable handling and link to owning records when authorized.",
    "Verify complete type coverage and both viewers without mutating or independently undoing any effect."
  ],
  "invariants": [
    "A panel cannot establish lifecycle correctness.",
    "UI text remains compact; no raw rollback JSON or sensitive preimages."
  ],
  "exclusions": [
    "Activation/completion repairs, opt-outs and Schedule/Kitchen cascade surfaces."
  ],
  "risks": [
    "Completion may remove ledger rows, so post-trip display cannot be invented from an empty result."
  ],
  "unknowns": [
    "DEC-04; raw ledger display prohibition; authorized projection and retention after completion."
  ],
  "dependencies": [
    "DEC-04",
    "TRIP-1",
    "TRIP-2",
    "TRIP-3"
  ],
  "risk": "high",
  "provenance": "2026-09-26 compared the Master Book acceptance, decision register and Trips Overview trip_side_effects prohibition. The conflict is preserved as a gate, not resolved by this plan.",
  "checks": [],
  "ownerReviewed": false
}
```

### TRIP-28

**Outcome:** Open statement audit scoped to a trip.

- **Acceptance:** "Reconcile this trip" entry point — a post-trip action on a `completed` (or end-dated) trip that opens statement import in audit mode pre-scoped to that trip: date range widened by the posting-lag window, candidate accounts = the card account the statement belongs to **plus** the trip's own `trips.account_id`, and expected currency = `trips.currency`. Returns the BUD-28 exception report scoped to the trip and nothing else; result feeds the post-trip summary (TRIP-5) and the real-actuals card that replaces "Planned spend" (TRIP-11). → `src/app/trips/`
- **Depends on:** [BUD-26](<../Budget/Budget — Master Book.md#bud-26>), [BUD-27](<../Budget/Budget — Master Book.md#bud-27>), [BUD-28](<../Budget/Budget — Master Book.md#bud-28>).

- **Acceptance:** a completed trip offers "Reconcile this trip"; it opens statement import in audit mode with the trip's date window, both candidate accounts and `trips.currency` pre-applied, returns the exception report for that trip only, and finishes having created **zero** transactions.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** A composition of two existing modules, gated on BUD-26/27/28 landing audit mode in Statement Import. Read `src/features/statement-import/sessionModel.ts` (and its test) plus `hooks.ts` before designing the entry point — the pre-scoping is a session-model concern, not a Trips one. The trip-side inputs all exist on the trip row: `trips.account_id`, `trips.currency`, the date range, and the card account the statement belongs to; `src/lib/tripAccess.ts` `getAccessibleTrip()` is how you fetch it safely. Entry point goes in `src/app/trips/[id]/page.tsx` / `src/components/trips/TripDetail.tsx`, offered only on a completed or end-dated trip — phase logic is already in `src/features/trips/tripPhase.ts` (with `tripPhase.test.ts`). The acceptance's hardest clause is "creates **zero** transactions", so audit mode must be read-only end to end; `.claude/skills/money-rules/SKILL.md` applies.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Extend existing `src/features/trips/tripPhase.test.ts` and Statement Import session-model tests after reading their current contracts. Verify both candidate accounts, posting-lag boundary, currency, inaccessible trip, refresh/back navigation and zero transaction writes; typecheck/lint.

**Scope notes:** `src/features/statement-import/hooks.ts`: only if handoff requires it.

```delivery-plan-v1
{
  "outcome": "Open a completed or end-dated trip's statement audit with the correct scope and no money writes.",
  "acceptance": [
    "The entry point applies the trip's date window plus approved posting lag, trip account, statement card account and expected currency.",
    "Only this trip's BUD-28 exception report is returned.",
    "The entire audit creates zero transactions and does not alter balances."
  ],
  "scope": [
    "src/components/trips/TripDetail.tsx",
    "src/components/trips/overview/OverviewTab.tsx",
    "src/features/trips/tripPhase.test.ts",
    "src/features/statement-import/sessionModel.ts",
    "src/features/statement-import/sessionModel.test.ts",
    "src/features/statement-import/hooks.ts"
  ],
  "steps": [
    "Wait for Budget BUD-26/27/28 and read their current session-model input/output contract; reuse it instead of creating a Trips audit engine.",
    "Build an authorized trip handoff with dates, currency and trip account; obtain the statement's card account explicitly rather than treating it as a trip column.",
    "Offer a short Reconcile action only for completed/end-dated trips and initialize audit mode with the approved posting-lag rule.",
    "Return the scoped exception report through the existing audit surface and expose the result seam for later TRIP-5/11.",
    "Verify account/date/currency restoration across refresh and cancellation, and assert zero transaction creation through every completion branch."
  ],
  "invariants": [
    "Tag membership and account membership remain distinct.",
    "The report cannot broaden to unrelated trips or create missing transactions automatically."
  ],
  "exclusions": [
    "Budget matching logic, actual-spend rollup and currency conversion policy."
  ],
  "risks": [
    "A stale imported session may silently reuse the previous account or mode unless initialization replaces the full scope."
  ],
  "unknowns": [
    "Budget's final audit handoff and posting-lag settings."
  ],
  "dependencies": [
    "BUD-26",
    "BUD-27",
    "BUD-28"
  ],
  "risk": "medium",
  "provenance": "2026-09-26 plan from existing Trips/Statement Import contracts and accepted cross-campaign ownership. Next work must revalidate Budget's delivered session API before edits.",
  "checks": [],
  "ownerReviewed": false
}
```

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

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Create `tests/trip-checkpoint-revert.test.ts`; test valid snapshot, malformed entry, SDK error, zero rows, wrong trip, deleted target and unauthenticated caller. Three requested with middle failure must never claim applied=3. Typecheck/lint; owner failure screenshot at 390×844.

**Scope notes:** `tests/trip-checkpoint-revert.test.ts`: proposed.

```delivery-plan-v1
{
  "outcome": "Acknowledge a packing checkpoint restore only when the requested targets were actually updated.",
  "acceptance": [
    "The entire stored snapshot validates before writes; malformed entries are never silently filtered.",
    "Every update returns and matches the intended nondeleted target ID.",
    "Failed or missing writes return truthful failure/partial evidence, never an attempted-count success."
  ],
  "scope": [
    "src/app/api/trips/[id]/packing/checkpoint/route.ts",
    "src/app/api/trips/[id]/packing/checkpoint/revert/route.ts",
    "tests/trip-checkpoint-revert.test.ts"
  ],
  "steps": [
    "After TRIP-18 owner schema/access evidence, read both save and revert handlers and freeze their current response/error contract.",
    "Validate the full snapshot and preserve trip/nondeleted predicates; request the target identity back from each mutation.",
    "Inspect every returned result, matching requested and updated IDs; return existing error handling for failure and structured server evidence without sensitive payloads.",
    "Test all-success and middle-failure sequences, including zero-row SDK success, and verify the client cannot display a successful restore toast."
  ],
  "invariants": [
    "An attempted update is not an applied update.",
    "No automatic replay of a partially applied restore."
  ],
  "exclusions": [
    "Atomic rollback, new checkpoint schema, packing redesign and RLS repair without evidence."
  ],
  "risks": [
    "PostgREST zero-row updates may have no error; checking only error reproduces the defect."
  ],
  "unknowns": [
    "Current checkpoint schema/access must be supplied under TRIP-18 before implementation."
  ],
  "dependencies": [
    "TRIP-18"
  ],
  "risk": "medium",
  "provenance": "2026-09-26 docs-grounded from retained ASTRA-TRIP-2 and packing contract. Source route behavior must be revalidated after fresh owner evidence; tests are proposed, not passed.",
  "checks": [],
  "ownerReviewed": false
}
```

### TRIP-31

**Outcome:** Cover trip ownership predicates.

- **Acceptance:** Pure tripAccess tests cover owner, active partner, unlinked user and source-private attachments. Tests of repo predicates do not establish production RLS.

**Provenance:** [Trips — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/Trips — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Pure unit tests over one small file: `src/lib/tripAccess.ts` — `AccessibleTrip`, `getAccessibleTrip()` and `canAccessTrip()`. Its callers show the four cases worth covering: `src/app/api/transactions/[id]/route.ts` (partner-scope validation on `trip_id`), the documents routes (`[id]/documents/`, `documents/[docId]/`, `documents/signed-urls/`) for source-private attachments, and the packing routes for owner/partner reads. Household linking follows the `household_links` pattern in Hard Rule #13 (`src/app/api/accounts/route.ts` is the canonical example). The acceptance's caveat is the important one: these are tests of a repo predicate and prove nothing about production RLS — that is TRIP-18.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Propose `src/lib/tripAccess.test.ts` and source-private document-route fixtures; run them with `src/services/transaction.service.trip-tag.test.ts`. Cases: owner, both active-link directions, solo partner, inactive/unlinked/unrelated user, missing row and DB error.

**Scope notes:** `src/lib/tripAccess.test.ts`: proposed. `tests/trip-document-access.test.ts`: proposed.

```delivery-plan-v1
{
  "outcome": "Protect trip access and source-private document boundaries with focused executable tests.",
  "acceptance": [
    "Owner access succeeds; active partners access household trips only; unlinked/unrelated users fail.",
    "Trip ownership stays distinct from collaborative child access.",
    "Private document-source authorization remains separately enforced; helper tests do not certify production RLS."
  ],
  "scope": [
    "src/lib/tripAccess.test.ts",
    "tests/trip-document-access.test.ts"
  ],
  "steps": [
    "Read getAccessibleTrip/canAccessTrip and their document/transaction callers; identify which predicate owns source privacy separately from trip access.",
    "Build a small Supabase fixture covering both household-link directions, solo/household scopes, missing rows and query errors.",
    "Assert isOwner remains false for a partner and owner-only lifecycle actions cannot treat accessible as owned.",
    "Add document-boundary fixtures proving accessible trip membership does not authorize arbitrary source-private files; run existing trip-tag tests as a consumer regression.",
    "If a test exposes a real predicate defect, record its exact bounded repair before expanding the tests-only scope."
  ],
  "invariants": [
    "Solo trips stay private.",
    "Tests of repository predicates prove neither current RLS nor deployed storage policies."
  ],
  "exclusions": [
    "Policy migrations, household model redesign and source snapshot promotion."
  ],
  "risks": [
    "Putting source-file privacy assertions only in tripAccess would test logic that the helper does not own."
  ],
  "unknowns": [
    "Revalidate the actual document authorization seam and existing fixture helpers before choosing test doubles."
  ],
  "dependencies": [],
  "risk": "medium",
  "provenance": "2026-09-26 read src/lib/tripAccess.ts and inspected the transaction service consumer. Next-step route fixtures remain proposed; no live access attempt was made.",
  "checks": [],
  "ownerReviewed": false
}
```

### TRIP-32

**Outcome:** Verify shared trip documents and money setup.

- **Acceptance:** Owner verifies partner Docs/upload, linked/shared account selection, trip currency/manual FX rounding and actuals against the current served revision. Preserve the Aug3 Inbox scope; do not rebuild already-shipped account-link/FX paths.
- **Depends on:** [TRIP-18](<Trips — Master Book.md#trip-18>).

**Provenance:** [Trips — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/Trips — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Owner verification against the served revision; do not rebuild shipped paths. Docs: `src/app/api/trips/[id]/documents/` (list/create), `documents/[docId]/` and `documents/signed-urls/` — all three guard through `getAccessibleTrip()` from `src/lib/tripAccess.ts`; client side is `src/components/trips/documents/DocumentsView.tsx` and `AddDocumentSheet.tsx` with `src/features/trips/documentQueries.ts` (which has its own test). Money setup: `trips.account_id` and `trips.currency`, set through `src/components/trips/TripFormSheet.tsx` and the trip routes; manual FX rounding is money math, so `.claude/skills/money-rules/SKILL.md` applies to any change. Depends on TRIP-18 for the partner-read evidence.

**Execution plan — 2026-09-26**

**Readiness:** owner evidence.

**Verify:** Owner verifies served revision on both phones: partner Docs upload/read, failed read→retry, shared account selection, currency and a worked manual-FX rounding example, then actuals. Reuse `src/features/trips/documentQueries.test.ts` locally; it cannot replace device proof.

```delivery-plan-v1
{
  "outcome": "Verify already-shipped shared trip documents and money setup on the current served build.",
  "acceptance": [
    "Both phones can use permitted trip documents without stale-empty success or private-source leakage.",
    "Account linking, currency and manual FX rounding match the accepted trip/money contract.",
    "Actuals and deployment evidence are recorded without rebuilding already-shipped paths."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/Trips/Trips — Master Book.md"
  ],
  "steps": [
    "Wait for TRIP-18 access/application evidence and obtain the served revision/device identity before interpreting failures.",
    "Prepare a concise owner checklist for create/upload/read/reopen on both phones, including unavailable/retry and owner-versus-partner rights.",
    "Add linked/shared-account selection, currency and explicit FX input/output examples; compare actuals with the owning Budget records.",
    "Record each result and evidence date; separate cache, app predicate, deployment and RLS hypotheses rather than guessing a repair.",
    "Route any demonstrated engineering defect to the smallest canonical follow-up; leave unperformed owner checks pending."
  ],
  "invariants": [
    "A prior shared-document repair is not both-phone acceptance.",
    "Money values require a worked expected result, not visual plausibility."
  ],
  "exclusions": [
    "Rebuilding account-link/FX paths, lifecycle activation and agent production writes."
  ],
  "risks": [
    "An outdated served build can make a correct local fix appear absent."
  ],
  "unknowns": [
    "Current phone results, served revision and owner-applied schema status."
  ],
  "dependencies": [
    "TRIP-18"
  ],
  "risk": "medium",
  "provenance": "2026-09-26 retained Aug3 verification scope and shipped documentQueries evidence reviewed. This is owner acceptance planning; no device or production result was obtained.",
  "checks": [],
  "ownerReviewed": false
}
```

### TRIP-5

**Outcome:** Trip budget rollup / post-trip summary ("this trip cost X").

- **Acceptance:** Trip budget rollup / post-trip summary ("this trip cost X").
- **Acceptance (added 2026-09-19, TRIP-34):** The rollup reads the **union** of (a) transactions whose `account_id` is the trip's `account_id` and (b) transactions whose `trip_id` is this trip — any account, any date — deduplicated by transaction id so a row matching both is counted once. Cross-currency conversion is a separate open question (see the multi-currency note under "Out of scope" in the vault Overview); the union itself must be currency-agnostic.
- **Depends on:** TRIP-34 (shipped 2026-09-19).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on TRIP-34 (shipped 2026-09-19), which added `transactions.trip_id` — so the rollup finally has a real join. Today's Overview shows a placeholder: `src/components/trips/overview/OverviewTab.tsx` sums `places.reduce((sum, p) => sum + (p.cost ?? 0), 0)` under the `Planned spend` label. Actuals come from transactions tagged to the trip plus the trip's own account; read `src/lib/balance-utils.ts` for direction semantics (`expense`/`income`/`saving`) before summing anything, and `.claude/skills/money-rules/SKILL.md` requires a worked before/after example and a test. TRIP-11 replaces the placeholder itself; TRIP-28 feeds reconciled actuals in. Multi-currency trips make `trips.currency` load-bearing.

**Execution plan — 2026-09-26**

**Readiness:** split first.

**Verify:** Propose `tests/trip-spend.test.ts`: same row matching account+tag counts once; tagged pre-trip/off-account rows count; unrelated rows/transfer flows excluded; private source access and unavailable reads. Worked example: USD account spend20 plus tagged USD30 =50, overlap unchanged; EUR10 stays separate until FX agreed.

**Scope notes:** Proposed paths: `src/lib/tripSpend.ts`, `tests/trip-spend.test.ts`. `migrations/` is a preliminary boundary; name the exact paired migration after current schema review. Owner application remains separate.

```delivery-plan-v1
{
  "outcome": "Build one authorized trip-spend rollup and post-trip summary without double-counting or mixed-currency arithmetic.",
  "acceptance": [
    "Membership is the union of trip-account transactions and transactions tagged to the trip, any account/date, deduplicated by transaction ID.",
    "Amounts follow canonical transaction/refund/transfer semantics and retain currency/basis.",
    "The summary separates actuals from planned place costs; no combined converted total is invented before its FX contract is agreed."
  ],
  "scope": [
    "src/lib/tripSpend.ts",
    "src/app/api/trips/[id]/bundle/route.ts",
    "src/components/trips/overview/OverviewTab.tsx",
    "src/types/trips.ts",
    "migrations/",
    "migrations/schema.sql",
    "tests/trip-spend.test.ts"
  ],
  "steps": [
    "After TRIP-34 application evidence, first freeze an authorized membership and dedupe fixture; readable trip membership must not bypass source-account privacy.",
    "Implement the proposed shared rollup with per-currency facts and explicit coverage, reusing Budget direction/refund/transfer rules; keep reads side-effect-free.",
    "Resolve the outstanding multi-currency presentation/FX basis before producing a single converted headline; preserve original currencies and rate provenance.",
    "Expose the read result through the existing trip bundle where appropriate, with a paired owner-run migration only if its RPC changes.",
    "Use the same result for post-trip summary and TRIP-11; integrate TRIP-28's audit evidence without equating audited coverage to total completeness."
  ],
  "invariants": [
    "Tag/account overlap contributes once; balances and transactions are never changed.",
    "Missing source data is unavailable or partial, not zero spend."
  ],
  "exclusions": [
    "Writing missing transactions, lifecycle activation and an independent Trips FX engine."
  ],
  "risks": [
    "A single trip currency does not imply every tagged transaction has that currency."
  ],
  "unknowns": [
    "Cross-currency presentation/rate policy; current bundle and source-account visibility contracts."
  ],
  "dependencies": [
    "TRIP-34 source/application evidence",
    "Budget money semantics",
    "TRIP-28 for audited exception linkage only"
  ],
  "risk": "high",
  "provenance": "2026-09-26 accepted union contract and Overview placeholder rechecked at HEAD45b28899. Shared rollup/tests are proposed; transaction data and FX rates were not queried.",
  "checks": [],
  "ownerReviewed": false
}
```

### TRIP-6

**Outcome:** Per-cascade opt-out (choose which cascades fire per trip).

- **Acceptance:** Per-cascade opt-out (choose which cascades fire per trip).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Per-trip cascade preferences, which means the choice has to reach `activate_trip` — read that RPC's body in `migrations/db-state.json` first, because the cascades are decided inside it and a UI toggle that the function ignores is the obvious failure. Expect a new column or a JSON preferences field on `trips` plus a parameter on the RPC (Hard Rules #24/#26: migration file, then `schema.sql`, then hand the SQL to the owner). The UI lands in `src/components/trips/TripActivateSheet.tsx` / `TripFormSheet.tsx`. Completion must reverse only what fired, which `trip_side_effects` already records. TRIP-1/2/3 should establish the current cascade set before you make it optional.

**Execution plan — 2026-09-26**

**Readiness:** decision held.

**Verify:** After gates clear, propose lifecycle opt-out fixtures: each cascade alone, all enabled/disabled, household/solo, retry and completion after preference change. Owner isolated DB witness verifies only fired ledger effects reverse; no production activation.

**Scope notes:** Proposed paths: `tests/trip-cascade-options.test.ts`. `migrations/` is a preliminary boundary; name the exact paired migration after current schema review. Owner application remains separate.

```delivery-plan-v1
{
  "outcome": "Allow per-trip cascade choices while retaining a complete, reversible record of what actually ran.",
  "acceptance": [
    "The owner selects supported cascades before activation under a verified lifecycle contract.",
    "Disabled cascades have zero effects; enabled cascades retain existing scope, idempotency and inverse rules.",
    "Completion reverses recorded effects, not whatever preferences currently say."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/Trips/Trips — Master Book.md",
    "src/components/trips/TripActivateSheet.tsx",
    "src/components/trips/TripFormSheet.tsx",
    "src/app/api/trips/[id]/activate/route.ts",
    "src/types/trips.ts",
    "migrations/",
    "migrations/schema.sql",
    "tests/trip-cascade-options.test.ts"
  ],
  "steps": [
    "Wait for TRIP-1/2/3 and DEC-04; agree defaults, supported toggles and whether active-trip changes are disallowed or future-only.",
    "Map each choice to the verified transaction boundary, including route-side account setup; do not assume every effect lives in activate_trip.",
    "Add the smallest versioned per-trip options contract with explicit compatibility for existing trips and paired owner-run migration.",
    "Expose compact pre-activation controls and enforce the choices server-side; record the selected contract and actual fired effects together.",
    "Verify the opt-out/inverse matrix through isolated owner fixtures and local tests before enabling the controls."
  ],
  "invariants": [
    "Recurring payments remain active regardless of cascade options.",
    "No retroactive preference edit can erase an existing ledger obligation."
  ],
  "exclusions": [
    "New cascades, template-library rollout, blind reversal policy and agent-run production experiments."
  ],
  "risks": [
    "A UI-only toggle or RPC-only change leaves route-side account creation running despite opt-out."
  ],
  "unknowns": [
    "DEC-04, exact defaults and which effects are safely optional under the verified lifecycle."
  ],
  "dependencies": [
    "TRIP-1",
    "TRIP-2",
    "TRIP-3",
    "DEC-04",
    "TRIP-30 if verification identifies required lifecycle repair"
  ],
  "risk": "high",
  "provenance": "2026-09-26 read activate/complete route boundaries and current decision register. Proposed code/migration/test scope is conditional on the decision and fresh lifecycle evidence.",
  "checks": [],
  "ownerReviewed": false
}
```

### TRIP-7

**Outcome:** Show trip cascades in Schedule and Kitchen.

- **Acceptance:** Show verified trip side-effects from Schedule, Meals/Chores and Kitchen packing contexts. Absorbs KIT-9. Read the actual lifecycle contract and link the source trip; do not invent cascade state or independently reverse it.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide (revalidated 2026-09-26):** Read TRIP-4's accepted projection before adding cross-module badges. The existing documented `get_trip_bundle` shape contains trip/places/packing/documents, not an established effect projection; do not assume raw trip_side_effects is already exposed. TRIP-4 also carries the unresolved internal-ledger/display conflict. Reuse its eventual authorized contract in mounted Schedule/Chores/Meals surfaces and the agreed Kitchen packing context, with origin links and no local inverse. Shared/component integration may bridge standalones; feature-directory cross-imports remain forbidden.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Propose `tests/trip-effect-surfaces.test.tsx`: authorized owner/partner effects, solo privacy, unavailable/partial reads, completed inverse and source link. Verify Schedule/Chores/Meals at 390×844 and no extra per-row read or mutation; typecheck/lint.

**Scope notes:** Proposed paths: `src/components/shared/TripEffectSummary.tsx`, `tests/trip-effect-surfaces.test.tsx`.

```delivery-plan-v1
{
  "outcome": "Show verified trip effects where affected Schedule and Kitchen records are used.",
  "acceptance": [
    "Applicable Schedule, Meals/Chores and Kitchen packing contexts display the real trip origin and effect state.",
    "Every visible effect links to its authorized trip and uses the same verified contract as TRIP-4.",
    "No consumer invents cascade state or independently undoes it."
  ],
  "scope": [
    "src/components/shared/TripEffectSummary.tsx",
    "src/components/planner/WebDayPlanner.tsx",
    "src/components/web/WebTodayView.tsx",
    "src/components/web/WebMealPlanCalendar.tsx",
    "src/components/trips/TripPackingList.tsx",
    "tests/trip-effect-surfaces.test.tsx"
  ],
  "steps": [
    "After TRIP-4 settles its projection and DEC-04 conflict, identify the currently mounted target surfaces, including the intended Kitchen packing context.",
    "Reuse the authorized projection in a proposed compact shared component; do not query raw rollback preimages from each card.",
    "Attach origin/effect labels and trip links without changing local item, meal or packed state; preserve person-absolute identity.",
    "Use existing scoped cache keys and invalidation from activation/completion so all consumers agree after a verified transition.",
    "Verify each accepted surface and both viewers; freeze any additional Chores-specific file in scope before dispatch."
  ],
  "invariants": [
    "The existing get_trip_bundle shape is not assumed to contain effects until TRIP-4 supplies them.",
    "Cross-module rendering stays in shared/component integration surfaces."
  ],
  "exclusions": [
    "Cascade repair, new pauses/skips, standalone-feature cross-imports and independent inverse controls."
  ],
  "risks": [
    "Rendering a guessed 'paused by trip' badge after the source row was edited can misstate current responsibility."
  ],
  "unknowns": [
    "Final TRIP-4 read projection and exact live Chores/Kitchen packing surfaces."
  ],
  "dependencies": [
    "TRIP-4",
    "TRIP-1",
    "TRIP-2",
    "TRIP-3"
  ],
  "risk": "medium",
  "provenance": "2026-09-26 Trips and connected Feature Maps reviewed. Proposed component/tests and conditional consumer list must be tightened after TRIP-4; existing bundle is not certified to expose a ledger.",
  "checks": [],
  "ownerReviewed": false
}
```

### TRIP-8

**Outcome:** Richer template library (weekend / abroad / business) with cascade prefs.

- **Acceptance:** Richer template library (weekend / abroad / business) with cascade prefs.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide (revalidated 2026-09-26):** An existing template model is present: `trips.is_template`, `src/types/trips.ts` and cloneSchema.as_template in `src/app/api/trips/[id]/clone/route.ts`. The older assertion that no template model exists was wrong. Review that clone's field copying, date/packed-state resets and category remapping before designing presets. Keep the current model unless evidence justifies change; a Catalogue category is not an automatic replacement. Cascade preference reuse waits for TRIP-6.

**Execution plan — 2026-09-26**

**Readiness:** investigation first.

**Verify:** Review clone fixtures for source-template flags, packed-state reset, category remapping, dates, private documents and absent side effects. Record the chosen weekend/abroad/business defaults as examples; no new template storage or lifecycle execution.

```delivery-plan-v1
{
  "outcome": "Define a small reusable trip-template library around the existing template/clone model.",
  "acceptance": [
    "Decide which planning fields and approved cascade preferences a template should capture.",
    "Reuse existing trips.is_template/as_template behavior unless evidence proves it inadequate.",
    "A future template creates a draft with independent planning state and no account, activation or private-document disclosure."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/Trips/Trips — Master Book.md"
  ],
  "steps": [
    "Read the current clone route and trip list/form behavior; inventory its is_template flag, copied places/packing/category mapping and reset omissions.",
    "Ask which three initial template presets are actually useful and which fields should inherit; separate reusable defaults from sensitive trip-specific details.",
    "Treat cascade preferences as a follow-on to TRIP-6; do not synthesize that schema or opt-out policy in the template study.",
    "Record the smallest preset/clone improvement, privacy/retry requirements and failure fixtures; keep existing template IDs rather than creating a competing Catalogue store by assumption."
  ],
  "invariants": [
    "Instantiation begins in draft and never activates travel side effects.",
    "Template editing cannot mutate an already-created trip."
  ],
  "exclusions": [
    "Automatic template catalogue migration, cloning money/accounts, copying private travel files and implementing cascades."
  ],
  "risks": [
    "Current clone uses multiple writes and copies row fields broadly; adding presets cannot silently certify atomicity or correct reset behavior."
  ],
  "unknowns": [
    "Owner's desired preset content, clone failure/replay policy and final TRIP-6 option contract."
  ],
  "dependencies": [
    "TRIP-6 for cascade preferences",
    "TRIP-18 access/schema evidence for later packing changes"
  ],
  "risk": "medium",
  "provenance": "2026-09-26 read cloneSchema.as_template, inserted is_template and src/types/trips.ts. This corrects the older 'no template model exists' claim; work remains a bounded design investigation.",
  "checks": [],
  "ownerReviewed": false
}
```

### TRIP-9

**Outcome:** Trips.

- **Acceptance:** Trips → ERA re-entry briefing ("you're back tomorrow — N items resume").

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Trips owns the re-entry source contract; HUB-56 owns Kitchen/Trips/Healthcare signal integration and the existing ERA consumer owns briefing delivery. Reuse those seams before considering any scheduler change. Distinguish a date-only planner return from verified live effects that completion will reverse, using `src/features/trips/tripPhase.ts` plus TRIP-4's authorized projection when available. Preserve unknown coverage and existing Focus briefing cache/recipient policy; a cron file or end_date alone never proves delivery or resumption.

**Execution plan — 2026-09-26**

**Readiness:** investigation first.

**Verify:** Build fixture re-entry signals for active versus planner-only trips, tomorrow in local time, unavailable effects, changed end date, cancelled/completed trip and repeated evaluation. Verify deterministic wording never promises unverified resumed counts; PM checks for this first slice.

```delivery-plan-v1
{
  "outcome": "Define a Trips re-entry signal that the existing ERA briefing can consume honestly.",
  "acceptance": [
    "A re-entry signal uses authorized trip dates and the verified effect/inverse projection with coverage and provenance.",
    "Planner-only travel cannot imply schedule effects will resume, and unknown effects cannot become a count of zero.",
    "The adopted consumer delivers one appropriate situation under existing recipient/delivery policy; this adapter investigation does not certify scheduled delivery."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/Trips/Trips — Master Book.md"
  ],
  "steps": [
    "Inspect HUB-56's current signal contract and the existing stored-briefing consumer; reuse them rather than adding a Trips notifier or cron.",
    "Use tripPhase and local date semantics to define the re-entry window, then distinguish planner return information from verified active-trip resumption.",
    "Specify a small signal carrying source trip, eligible recipient, evidence time, coverage and stable identity; determine what completion actually reverses after TRIP-1/2/3/4.",
    "Record refresh/retraction behavior when dates, status or effects change, plus the consumer and operational last-run witness required before activation."
  ],
  "invariants": [
    "No live cascade is run merely to generate a briefing.",
    "Quiet hours, recipient choices and Focus briefing cache policy remain with their existing owners."
  ],
  "exclusions": [
    "New notification queue, new scheduled job, independent AI prompt loop and an assumed external scheduler."
  ],
  "risks": [
    "A countdown alone cannot establish how many items resume; completion may remove ledger evidence."
  ],
  "unknowns": [
    "Delivered HUB-56 interface, re-entry window preference and verified retained effect projection."
  ],
  "dependencies": [
    "HUB-56",
    "TRIP-4 for effect claims",
    "TRIP-1",
    "TRIP-2",
    "TRIP-3",
    "NOTIF-19 for proactive delivery"
  ],
  "risk": "medium",
  "provenance": "2026-09-26 reviewed Trips phase/briefing constraints and HUB-56 ownership. Source dates/effects do not establish any running scheduler; this scope prepares the bounded adapter contract only.",
  "checks": [],
  "ownerReviewed": false
}
```

### TRIP-10

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C16. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Select catalogue or stock references for packing.

- **Acceptance:** Catalogue C16: packing picker sends the correct catalogue_item_id or inventory_item_id, resolves display labels without leaking source-private data, and preserves manual packing. Clarify the distinction between a catalogue record and a stock row before writes; existing API fields alone do not prove UI completion.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Catalogue C16, and the acceptance's first demand is conceptual: a catalogue *record* and an inventory *stock row* are different things, and the picker must send the right id (`catalogue_item_id` versus `inventory_item_id`). Read `src/types/catalogue.ts` and `src/features/catalogue/`, then `src/features/inventory/`. The packing rows and their API fields are `src/app/api/trips/[id]/packing/route.ts` (+ `bulk/`, `[itemId]/`); the UI is `src/components/trips/TripPackingList.tsx`. "Existing API fields alone do not prove UI completion" — check whether the columns are actually written and read. Display labels must resolve without leaking source-private data, the same constraint TRIP-33 and HLTH-23 carry.

**Execution plan — 2026-09-26**

**Readiness:** decision held.

**Verify:** Propose `tests/trip-packing-reference.test.ts` after ID semantics are proven: correct/wrong kind and scope, legacy ambiguous ID, source deletion, packed-state preservation, retry and Undo. Assert zero stock/history changes; owner FK fixture separately.

**Scope notes:** Proposed paths: `tests/trip-packing-reference.test.ts`. `migrations/` is a preliminary boundary; name the exact paired migration after current schema review. Owner application remains separate.

```delivery-plan-v1
{
  "outcome": "Select permitted Catalogue or Inventory references for packing without confusing their identities.",
  "acceptance": [
    "The picker writes the agreed catalogue_item_id or inventory_item_id and preserves manual packing.",
    "Display labels reveal only authorized source data; packing quantity/state remains Trip-owned.",
    "Source edits/deletion and repeated selection do not corrupt stock, backlinks or packing identity."
  ],
  "scope": [
    "src/components/trips/TripPackingList.tsx",
    "src/app/api/trips/[id]/packing/route.ts",
    "src/app/api/trips/[id]/packing/bulk/route.ts",
    "src/app/api/trips/[id]/packing/[itemId]/route.ts",
    "src/types/trips.ts",
    "src/features/trips/hooks.ts",
    "migrations/",
    "migrations/schema.sql",
    "tests/trip-packing-reference.test.ts"
  ],
  "steps": [
    "Before enabling Inventory choices, establish what existing inventory_item_id values mean using current schema and owner-supplied sanitized evidence; never infer stock versus Catalogue identity by name.",
    "Reuse C10's authorized lookup and KIT-21/24 ownership/lifecycle contracts; freeze permitted kinds and destination audience.",
    "Add compact selection alongside manual entry, validate source ID/kind/scope server-side and preserve Trip-owned quantity/packed state.",
    "Add only evidence-required protective FKs through a paired owner-run migration; retain unresolved legacy links without guessing or rekeying.",
    "Verify source/target deletion, repeat request and packing Undo through the real client/API path."
  ],
  "invariants": [
    "Selecting stock as a reference does not consume, reserve or restock it.",
    "Source-private labels are not made household-visible merely because the destination trip is shared."
  ],
  "exclusions": [
    "Garment bridge, stock allocation and trip lifecycle cascades."
  ],
  "risks": [
    "The API accepting both UUID fields does not prove their existing semantic meaning or safe source authorization."
  ],
  "unknowns": [
    "Legacy inventory_item_id meaning and explicit source-to-shared-trip disclosure contract."
  ],
  "dependencies": [
    "TRIP-18",
    "KIT-21",
    "KIT-24",
    "Catalogue C00 evidence and C10 lookup"
  ],
  "risk": "high",
  "provenance": "2026-09-26 read packing input schema and schema columns, then accepted Catalogue C16. New constraint/test work is conditional on owner evidence; existing UUIDs were not inspected.",
  "checks": [],
  "ownerReviewed": false
}
```

### TRIP-11

**Outcome:** Replace Overview's "Planned spend" placeholder (sums `trip_places.cost` only) with the trip account's real balance/transactions once actuals matter.

- **Acceptance:** Replace Overview's "Planned spend" placeholder (sums `trip_places.cost` only) with the trip account's real balance/transactions once actuals matter.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The placeholder is exact and verified 2026-09-20: `src/components/trips/overview/OverviewTab.tsx` computes `places.reduce((sum, p) => sum + (p.cost ?? 0), 0)` and labels it `Planned spend`. Replacing it means reading the trip account's real balance and the transactions tagged with `transactions.trip_id` (TRIP-34, shipped) — balance direction rules are in `src/lib/balance-utils.ts` and the `account_type` CHECK constraints in `migrations/schema.sql`. `.claude/skills/money-rules/SKILL.md` is mandatory here: a worked before/after example and a test. Prefer widening `get_trip_bundle` (`src/app/api/trips/[id]/bundle/route.ts`) over adding a second round trip (Hard Rule #21). Shares its outcome with TRIP-5.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Reuse TRIP-5 rollup tests; propose `tests/trip-actuals-card.test.tsx` for zero/unknown/partial, no linked account, account+tag overlap, pre-trip expenses and mixed currencies. Check 390×844; typecheck/lint; prove the UI performs no financial writes.

**Scope notes:** Proposed paths: `tests/trip-actuals-card.test.tsx`.

```delivery-plan-v1
{
  "outcome": "Replace the Overview planned-cost headline with trustworthy actual trip spending and account information.",
  "acceptance": [
    "The card consumes TRIP-5's authorized union/deduplicated actuals rather than resumming place estimates.",
    "Account balance and spending remain distinct values; currency and data coverage are preserved.",
    "Unavailable data never displays as zero actual spend and planned costs retain an explicit estimated meaning if still shown."
  ],
  "scope": [
    "src/components/trips/overview/OverviewTab.tsx",
    "src/features/trips/hooks.ts",
    "src/types/trips.ts",
    "tests/trip-actuals-card.test.tsx"
  ],
  "steps": [
    "Wait for TRIP-5's tested read contract and the agreed cross-currency display; do not implement a second aggregation in the card.",
    "Replace the current places.reduce headline with the shared actuals projection, using existing account readers only for their distinct balance purpose.",
    "Handle no-account, no-transactions, partial and failed reads independently; keep the action/label count minimal on mobile.",
    "Ensure tagged spending from other accounts and outside travel dates appears without duplicate counting or changing the transaction list.",
    "Verify the card after tag edits and transaction changes through existing query invalidation, including both household viewers."
  ],
  "invariants": [
    "Account balance is not total trip spend; place costs are not booked actuals.",
    "A read never writes a transaction, FX rate or balance."
  ],
  "exclusions": [
    "Building TRIP-5's engine again, setting exchange rates, statement matching and lifecycle changes."
  ],
  "risks": [
    "Replacing the old number while retaining its planned label, or using balance as spend, yields a plausible but false headline."
  ],
  "unknowns": [
    "Final TRIP-5 response and currency presentation; current UI test harness."
  ],
  "dependencies": [
    "TRIP-5",
    "TRIP-34 deployment evidence"
  ],
  "risk": "medium",
  "provenance": "2026-09-26 rechecked OverviewTab's places.reduce and Planned spend label. Proposed UI suite is future work; no money totals were obtained from production.",
  "checks": [],
  "ownerReviewed": false
}
```

### TRIP-30

**Outcome:** Repair trip lifecycle atomically under an agreed inverse.

- **Acceptance:** Held for DEC-04 and current owner lifecycle evidence. Preserve origin, scope, retry and inverse semantics through activation/completion; no blind reversal policy chosen by this refactor. Witness tasks TRIP-1/2/3 remain distinct.
- **Depends on:** [TRIP-1](<Trips — Master Book.md#trip-1>), [TRIP-2](<Trips — Master Book.md#trip-2>), [TRIP-3](<Trips — Master Book.md#trip-3>).

**Provenance:** [Trips — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/Trips — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide (revalidated 2026-09-26):** The atomicity boundary is wider than the two RPCs. `activate/route.ts` creates the account, categories and zero balance before activate_trip, then writes status/account_id afterward; `complete/route.ts` writes completed status after complete_trip. Fresh owner function evidence and TRIP-1/2/3 witnesses must cover these route-side effects too. Resolve DEC-04 before selecting inverse semantics, then repair only evidence-backed predicates with an owner-run inspect/backup/fix/verify/rollback migration. Agents never execute it.

**Execution plan — 2026-09-26**

**Readiness:** decision held.

**Verify:** After DEC-04, local route contract fixtures plus owner isolated transactional matrix: account/category failure, repeat/concurrent activation, side-effect failure, final status failure, pre-existing pauses and later human edits. Compare exact rows/balances; never execute the runbook as an agent.

**Scope notes:** Proposed paths: `tests/trip-lifecycle-atomic.test.ts`. `migrations/` is a preliminary boundary; name the exact paired migration after current schema review. Owner application remains separate.

```delivery-plan-v1
{
  "outcome": "Repair the full trip activation/completion boundary under an agreed checked inverse.",
  "acceptance": [
    "Origin, authorization, scope and retry identity cover route-side account/status writes as well as cascade RPC effects.",
    "Activation/completion either commit the complete agreed result or leave an explicit recoverable outcome without duplicate accounts/effects.",
    "Inverse behavior preserves later human edits under DEC-04 and the independent TRIP-1/2/3 witnesses pass."
  ],
  "scope": [
    "src/app/api/trips/[id]/activate/route.ts",
    "src/app/api/trips/[id]/complete/route.ts",
    "migrations/",
    "migrations/schema.sql",
    "tests/trip-lifecycle-atomic.test.ts"
  ],
  "steps": [
    "Obtain fresh lifecycle functions/grants and TRIP-1/2/3 failure evidence; resolve DEC-04 before authoring inverse behavior.",
    "Freeze the smallest demonstrated repair across account creation/default categories/balance seed, effect ledger and trip status; do not treat the RPC call alone as atomic activation.",
    "Author the checked authenticated transaction/idempotency contract with row locking and conditional inverse, plus inspect/backup/verify/rollback SQL for the owner.",
    "Replace route-side partial writes only under the reviewed contract, preserving owner-only lifecycle actions and keeping recurring payments unchanged.",
    "Run local contract tests, then have the owner apply and witness the isolated full matrix; application alone cannot complete lifecycle certification."
  ],
  "invariants": [
    "No broad rollback overwrites unrelated later state.",
    "No agent production SQL, activation or data repair."
  ],
  "exclusions": [
    "Opt-outs/templates, guessed replacement functions and blind reversal policy."
  ],
  "risks": [
    "Current routes create accounts and write final status outside the RPC, leaving multiple independent failure boundaries."
  ],
  "unknowns": [
    "DEC-04, current deployed functions and the exact evidence-backed failing predicates."
  ],
  "dependencies": [
    "DEC-04",
    "TRIP-1",
    "TRIP-2",
    "TRIP-3"
  ],
  "risk": "high",
  "provenance": "2026-09-26 read activate/complete routes: admin account/category/balance writes precede RPC and status writes follow it. This corrects the older RPC-only repair boundary; migrations/tests remain proposed.",
  "checks": [],
  "ownerReviewed": false
}
```

### TRIP-33

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C14. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Attach a saved document snapshot to a trip.

- **Acceptance:** Catalogue C14: explicit selection copies a permitted immutable snapshot with lineage, keeps the trip readable after source changes and prevents source-private leakage.
- **Depends on:** [KIT-20](<../Kitchen/Kitchen — Master Book.md#kit-20>).

**Provenance:** [Trips — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Trips/Trips — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Catalogue C14, depends on KIT-20. The word is *snapshot*: an immutable copy with lineage, so the trip stays readable after the source changes — the existing precedent for a lineage column is `source_catalogue_item_id` (see `src/app/api/items/[id]/promote/route.ts`). Trip documents already exist and are the surface to extend: `src/app/api/trips/[id]/documents/` (+ `[docId]/`, `signed-urls/`), `src/features/trips/documentQueries.ts`, `src/components/trips/documents/DocumentsView.tsx` and `AddDocumentSheet.tsx`, all guarded by `getAccessibleTrip()` from `src/lib/tripAccess.ts`. Source-private leakage is the failure mode TRIP-10 and HLTH-23 share — enforce it in the copy step and the type, not the UI.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Propose `tests/trip-document-snapshot.test.ts`: owner/private/shared source-target matrix, selected revision changes, identical copied-content hash, upload/DB failure, response-loss retry and source delete/replace. Owner storage/SQL witness separately; assert unchanged trip status/account/effects.

**Scope notes:** Proposed paths: `tests/trip-document-snapshot.test.ts`. `migrations/` is a preliminary boundary; name the exact paired migration after current schema review. Owner application remains separate.

```delivery-plan-v1
{
  "outcome": "Attach one explicitly selected saved document snapshot that remains readable independently of its Catalogue source.",
  "acceptance": [
    "Use saved authorizes the chosen record/revision and destination audience before copying bytes to the existing trip bucket.",
    "The persisted trip document retains source lineage and idempotent result identity, never a signed URL.",
    "Source replacement/deletion cannot alter the trip copy; retry and partial failure do not duplicate or leak files."
  ],
  "scope": [
    "src/components/trips/documents/DocumentsView.tsx",
    "src/components/trips/documents/AddDocumentSheet.tsx",
    "src/app/api/trips/[id]/documents/",
    "src/features/trips/documentQueries.ts",
    "src/types/trips.ts",
    "migrations/",
    "migrations/schema.sql",
    "tests/trip-document-snapshot.test.ts"
  ],
  "steps": [
    "After Catalogue file/revision/lifecycle foundations and authorized lookup, define explicit source revision and destination audience selection in Use saved.",
    "Implement a recoverable copy into trip-owned storage, preserving a content witness and stable request identity; revalidate source and target access at commit.",
    "Write lineage and the copy result using the existing trip-document owner; author only required additive migration after owner evidence.",
    "Resolve response loss through the same request, clean up only orphaned new copies and leave ordinary uploads unchanged.",
    "Verify source replacement/deletion, shared-destination consent and failure/retry with both viewers; no live-mode cascade gate is needed for this planner-only bridge."
  ],
  "invariants": [
    "Personal source access alone does not authorize disclosure to a household trip.",
    "Catalogue cleanup never owns the trip's copied binary."
  ],
  "exclusions": [
    "Live source synchronization, expiry reminders, trip activation and a universal document-version platform."
  ],
  "risks": [
    "Storage copy and DB insert span two systems; an ordinary DB transaction alone cannot guarantee cleanup or exactly-once copying."
  ],
  "unknowns": [
    "Current file receipt/lookup interfaces and owner storage/application evidence."
  ],
  "dependencies": [
    "KIT-18",
    "KIT-19",
    "KIT-20",
    "KIT-21",
    "TRIP-18",
    "Catalogue C10 lookup"
  ],
  "risk": "high",
  "provenance": "2026-09-26 reviewed accepted Catalogue C14 and Trips document ownership. Scope retains the full file/retry/privacy contract omitted by the short dependency line; new migration/tests are proposed.",
  "checks": [],
  "ownerReviewed": false
}
```

### TRIP-35

**Outcome:** Tag a transaction to a trip from the expense form and the transaction editor.

- **Acceptance:** A transaction can be assigned to, and cleared from, an accessible trip (own trip, or the partner's household-scope trip) without changing its account, amount or date. The control is available when editing an existing transaction and when logging a new one. Clearing is reachable. No explanatory prose ships with it (Hard Rule #28).
- **Depends on:** TRIP-34 (shipped 2026-09-19 — column, validation and API support already exist; this is UI only).

**Provenance:** Owner request 2026-09-19 (Italy trip: visa and flights paid from the USD account while daily spend sits in the EUR trip account).

- **Reading guide (revalidated 2026-09-26):** UI wiring remains the scope: `src/app/api/transactions/route.ts` POST passes the body to `SupabaseTransactionService.createTransaction()`, whose `trip_id` validation and insert already exist in `src/services/transaction.service.ts`; absence of a `trip_id` literal in the route did not mean unsupported creation. The earlier suggestion to widen that route or issue a follow-up PATCH was incorrect. Reuse current create/update support and `canAccessTrip()` validation. Surfaces: `src/components/expense/MobileExpenseForm.tsx`, `src/components/expense/ExpenseFormContext.tsx` and `src/components/dashboard/TransactionDetailModal.tsx`; authorized choices come from the existing Trips reader. Preserve account/amount/date, support explicit clearing, and run `src/services/transaction.service.trip-tag.test.ts`. TRIP-34's manual migration application is a separate owner evidence gate.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Run existing `src/services/transaction.service.trip-tag.test.ts`; add focused form/editor behavior coverage if needed. Create, assign, clear, reopen, inaccessible trip and offline payload preserve amount/account/date; check 390×844 and desktop; typecheck/lint.

**Scope notes:** `src/features/transactions/useDashboardTransactions.ts`: only if payload plumbing needs it. `tests/transaction-trip-picker.test.tsx`: proposed if existing harness supports it.

```delivery-plan-v1
{
  "outcome": "Assign or clear an accessible trip while creating or editing a transaction without changing its money fields.",
  "acceptance": [
    "New and existing transactions expose the same short trip picker and reachable clear action.",
    "Own trips and active partner household trips are selectable; private solo trips are excluded.",
    "Saving a tag preserves account, amount and date and retains existing offline mutation behavior."
  ],
  "scope": [
    "src/components/expense/MobileExpenseForm.tsx",
    "src/components/expense/ExpenseFormContext.tsx",
    "src/components/dashboard/TransactionDetailModal.tsx",
    "src/features/transactions/useDashboardTransactions.ts",
    "tests/transaction-trip-picker.test.tsx"
  ],
  "steps": [
    "Trace form state through the existing transaction create service and edit mutation; reuse current trip_id support rather than adding a second write.",
    "Load authorized choices from the existing Trips reader and add a compact optional picker plus clear action to both surfaces.",
    "Preserve trip_id through submit/reset/edit hydration and the existing offline payload; omit unchanged fields and send null when explicitly clearing.",
    "Verify own/partner/private options, saved-state reopening and unchanged money fields using existing service tests plus form checks.",
    "Confirm owner application of the TRIP-34 migration before claiming deployment acceptance."
  ],
  "invariants": [
    "Tagging is not a balance event or account transfer.",
    "No follow-up PATCH is needed merely to attach a trip during creation."
  ],
  "exclusions": [
    "Trip rollup, currency conversion, new backend validation and explanatory UI copy."
  ],
  "risks": [
    "Form reset or optimistic edit state may drop the tag even though the backend already supports it."
  ],
  "unknowns": [
    "Current UI test harness and deployed TRIP-34 migration application."
  ],
  "dependencies": [
    "TRIP-34 source shipped; owner migration application remains separate"
  ],
  "risk": "medium",
  "provenance": "2026-09-26 read transactions POST delegation and transaction.service.ts create/update trip_id validation. This corrects the older claim that no trip_id literal in the route means create lacks support.",
  "checks": [],
  "ownerReviewed": false
}
```

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
