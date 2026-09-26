---
created: 2026-09-10
updated: 2026-09-26
type: master-book
status: active
owner: Elio
---

# Kitchen — Master Book

[Backlog](<4 - Checklist.md>) · [PM home](../_index.md) · [Governance](../_Conventions.md)

## Purpose & ownership

Turn food and household references into useful, reversible daily actions. Campaign for Recipes, Inventory and Catalogue standalones plus Meal Planning/Shopping junctions.

## Current state & evidence

Recipes, cooking, stock, meal planning and Chef reads exist. Automatic low-stock shopping and ingredient consumption are incomplete. Catalogue is an existing module in this campaign, not a new campaign; its accepted Sep7 reference/execution separation is incorporated below.

Refactored 2026-09-10 against repository HEAD `8d952332b0d7917369ce074730cfe830a5c37a97` and dated source studies. This date records document reconciliation, not a fresh runtime, DB or device witness. The [pre-refactor record](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>) preserves detailed older narratives and receipts.

## Vision & Decisions

- Reuse the Hub shopping offline queue; do not introduce another queue or turn unknown quantities into zero. Stock/history and a genuine inverse must be verified before automation.
- Low-stock criteria and automatic addition remain DEC-03; ingredient identity/units and confirmation remain DEC-17. Older unconditional D1/D2 checkboxes are criteria of KIT-1/2 under these gates.
- A planned or cooked meal covers only the intended person, status and actual leftover interval. Existing Chef reads are reused; missing data is not proof of an empty plan.
- Catalogue stores reusable references; Recipes and Inventory own executable recipes and operational stock. Source privacy, lineage, revision checks and explicit promotions apply at every bridge. The accepted Catalogue final build plan (§10, Sep7) supersedes its earlier study alternatives.
- Chores/NFC execution belongs to Schedule. Trip cascade visibility is TRIP-7, including the former KIT-9 scope. Allergy knowledge remains Healthcare-owned; ingredient shape validity is not clinical safety.

Unresolved policy choices live in the [decision register](../_Decisions.md); original exploratory ideas live in [Research options](../Research/Options.md). A Later item is retained work, not automatic permission to start.

## Pain Inventory

🟠 **KIT-10** Validate ingredient payloads at every writer. See [acceptance](#kit-10) for the root cause, evidence and gate.

🟠 **KIT-4** Expose scoped meal coverage to ERA. See [acceptance](#kit-4) for the root cause, evidence and gate.

🟠 **KIT-11** Return the correct cooking count. See [acceptance](#kit-11) for the root cause, evidence and gate.

🟠 **KIT-12** Restore cooking and restock changes with real Undo. Dated source diagnosis; cause and witness limits are in [criteria](#kit-12) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **KIT-13** Separate estimated and measured cooking values. Dated source diagnosis; cause and witness limits are in [criteria](#kit-13) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **KIT-14** Revalidate the dormant stock-update ID path. Dated source diagnosis; cause and witness limits are in [criteria](#kit-14) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **KIT-18** Authorize document signing through its owning record. Dated source diagnosis; cause and witness limits are in [criteria](#kit-18) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **KIT-19** Preserve old document files through replacement and Undo. Dated source diagnosis; cause and witness limits are in [criteria](#kit-19) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **KIT-20** Patch catalogue metadata with revision checks. Dated source diagnosis; cause and witness limits are in [criteria](#kit-20) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **KIT-21** Preserve catalogue identity through delete and restore. Dated source diagnosis; cause and witness limits are in [criteria](#kit-21) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

The remaining retained defects, decisions and enhancements are indexed below and ordered once in the checklist. Historical study claims are not new production incidents.

## Acceptance Criteria Index

**Plan navigation:** Open items below carry embedded drafts under [item execution plans](../_Conventions.md#9-item-execution-plans). Read only the selected ID and its dependencies. Prepared 2026-09-26 against source HEAD `45b28899`; implementation review, owner SQL application and device acceptance remain separate. No plan is owner-reviewed or dispatched by this document update.

### KIT-10

**Outcome:** Validate ingredient payloads at every writer.

- **Acceptance:** ASTRA-KIT-3: enforce one ingredient schema across all four documented writers, validate external/AI values before storage and preserve unknown ingredient/allergy state. Reverify the current producer inventory.

**Retained contract — ASTRA-KIT-3:**

- **Outcome:** Invalid ingredient objects are rejected before they can corrupt recipe storage or its existing warning consumer.
- **Boundary:** One installed-Zod ingredient/step schema, with types derived where touched. Nonempty string name and existing string quantity/unit conventions, optional notes/section/optional preserved; do not guess numeric units or strip malformed ingredient rows into an apparently complete recipe. Validate at the four named persistence boundaries before writes; PATCH validates supplied fields without replacing omitted arrays. Model-generated data passes the same validation. External extraction/optimization/scale/substitution response validation is retained follow-up scope; storage validation catches their accepted payloads here. No medical keyword edits or new AI call.
- **Money/schedule math?:** No. Ingredient quantity remains source text; no stock or nutrition computation.
- **Gate:** `pnpm exec vitest run tests/recipe-ingredient-contract.test.ts src/lib/health/allergenMatch.test.ts --reporter=verbose` → nonzero cases pass: valid ingredient with optional metadata reaches the existing matcher; null/nonstring name and malformed arrays produce zero DB writes; partial PATCH preserves omitted fields; invalid model data cannot overwrite a recipe. Common gates pass.

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide (revalidated 2026-09-26):** The prior 2026-09-20 ten-writer count mixed readers and response-only producers with persistence. The four current persistence boundaries are `src/app/api/recipes/route.ts`, `recipes/[id]/route.ts`, `recipes/[id]/versions/route.ts` and `recipes/[id]/generate/route.ts`. The versions route must validate before deactivating existing versions. `extract-from-url`, `optimize`, `scale` and `substitute` produce responses; `meal-plans/add-to-shopping` consumes ingredients and the guest bot has a textual mention, not a recipe writer. Recheck the inventory before editing. Match the existing `src/types/recipe.ts` ingredient/step conventions, derive touched types from the shared Zod contract, and retain `src/lib/health/allergenMatch.ts` unknown-state behavior. Response-only hardening remains KIT-15.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** After creating the proposed boundary suite: `pnpm exec vitest run tests/recipe-ingredient-contract.test.ts src/lib/health/allergenMatch.test.ts --reporter=verbose`; then typecheck/lint. Require zero writes for malformed input, including version deactivation.

**Scope notes:** `src/lib/recipes/ingredientSchema.ts`: proposed. `tests/recipe-ingredient-contract.test.ts`: proposed.

```delivery-plan-v1
{
  "outcome": "Reject malformed ingredients and steps before any recipe persistence mutation.",
  "acceptance": [
    "One shared runtime schema protects recipe create, partial update, version creation/activation and AI generation.",
    "Valid optional metadata and text quantities survive; omitted PATCH arrays remain unchanged.",
    "Malformed model output cannot replace existing recipe data or deactivate an existing version."
  ],
  "scope": [
    "src/lib/recipes/ingredientSchema.ts",
    "src/types/recipe.ts",
    "src/app/api/recipes/route.ts",
    "src/app/api/recipes/[id]/route.ts",
    "src/app/api/recipes/[id]/versions/route.ts",
    "src/app/api/recipes/[id]/generate/route.ts",
    "tests/recipe-ingredient-contract.test.ts"
  ],
  "steps": [
    "Recheck the four persistence writers and existing RecipeIngredient/RecipeStep fields; distinguish response-only producers from storage boundaries.",
    "Define the shared installed-Zod schema and infer touched types; require a nonempty string name while retaining existing quantity/unit text and optional fields.",
    "Validate complete create/version/generated payloads before their first write; validate only supplied PATCH fields.",
    "Add route fixtures for all four writers, including invalid active-version input before deactivation and valid ingredients reaching the existing allergen matcher."
  ],
  "invariants": [
    "Unknown ingredients are rejected or remain unknown; never silently dropped to make a recipe appear complete.",
    "No stock deduction, unit conversion or clinical safety claim."
  ],
  "exclusions": [
    "KIT-15 response-only extraction/optimization/scaling/substitution hardening; unrelated version transaction redesign."
  ],
  "risks": [
    "Validation placed after version deactivation still corrupts the active state."
  ],
  "unknowns": [
    "Recheck legitimate legacy ingredient/step optional fields before finalizing the schema."
  ],
  "dependencies": [],
  "risk": "medium",
  "provenance": "2026-09-26 source read: four persistence writers above and src/types/recipe.ts; focused search disproved the older ten-writer claim. No endpoint or production data was exercised.",
  "checks": [],
  "ownerReviewed": false
}
```

### KIT-4

**Outcome:** Expose scoped meal coverage to ERA.

- **Acceptance:** Verify person, status and leftover interval coverage and distinguish unavailable from no planned meal. Chef already reads meal data; reuse that path. Complete the consumer adapter before HUB-45/HUB-56; a pure helper alone does not complete the meal surface.

**Retained contract — ASTRA-KIT-2:**

- **Outcome:** A meal's leftovers, status and intended person contribute consistently to calendar and ERA coverage.
- **Boundary:** Extract existing date expansion into a pure shared contract rather than introducing a competing expansion engine. Separate display membership from edible/planned coverage: skipped rows can stay visible but do not cover a meal; person-specific meals only cover that person, shared meals both. Use date-only local calendar semantics. Fetch actual interval overlap, replacing the arbitrary 14-day lookback and date-only origin read; keep existing auth/household filter. ERA's existing all-day gap remains an all-day gap, not an assertion all meal slots are filled. Preserve per-slot facts for E-08/E-22. Failed retrieval is unavailable, not zero meals. Do not create Items or change calendar layout.
- **Money/schedule math?:** Yes, calendar coverage: cooked Sep4, eats-through Sep7 → Sep6 covered; same row skipped → uncovered; partner-only → owner uncovered/partner covered. No extra schedule occurrences or stock deduction.
- **Gate:** `pnpm exec vitest run tests/meal-plan-coverage.test.ts src/features/era/intents/resolveIntent.test.ts --reporter=verbose` → nonzero cases pass for leftovers crossing query boundary, >14-day interval, status, person, leap/month boundary and Beirut DST. Mock route retrieval proves overlap without omitted older rows; empty complete versus failure differ. Common gates; 390×844 calendar capture preserves layout.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide (revalidated 2026-09-26):** The existing Chef reader is `resolveMealPlanGaps()` in `src/features/era/intents/resolvers/chef.ts`, which fetches the next seven days and builds a Set of `planned_date`; `src/lib/ai/context.ts` has no meal reader. This corrects the earlier context-assembler routing claim. Read that resolver, `src/app/api/meal-plans/route.ts`, the 14-day lookback in `src/features/meal-planning/hooks.ts`, and the calendar's current date expansion. Replace origin-only retrieval with interval overlap and share coverage semantics across the calendar and Chef. Preserve person/status/slot facts and unavailable versus successfully empty data. A helper without the existing consumer adapter does not complete KIT-4 or unblock HUB-45/HUB-56.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Create `tests/meal-plan-coverage.test.ts`, then run it with `src/features/era/intents/resolveIntent.test.ts`; typecheck/lint. Cases: >14-day leftovers, skipped/shared/person-only rows, empty versus unavailable, leap/month/DST edges; preserve the calendar at 390×844.

**Scope notes:** `src/lib/mealPlanCoverage.ts`: proposed. `tests/meal-plan-coverage.test.ts`: proposed.

```delivery-plan-v1
{
  "outcome": "Make the existing calendar and Chef gap answer agree on whose meals cover each local day.",
  "acceptance": [
    "Overlapping leftovers are retrieved even when cooked more than fourteen days earlier.",
    "Skipped meals cover nobody; person-specific meals cover their intended person; shared meals cover both.",
    "Chef reports unavailable retrieval separately from a successfully empty plan and retains its all-day gap meaning."
  ],
  "scope": [
    "src/lib/mealPlanCoverage.ts",
    "src/app/api/meal-plans/route.ts",
    "src/features/meal-planning/hooks.ts",
    "src/components/web/WebMealPlanCalendar.tsx",
    "src/features/era/intents/resolvers/chef.ts",
    "tests/meal-plan-coverage.test.ts",
    "src/features/era/intents/resolveIntent.test.ts"
  ],
  "steps": [
    "Read resolveMealPlanGaps and the calendar date expansion; define one local date-only coverage contract with status, intended person and per-slot facts.",
    "Replace the hook's fixed lookback and API origin-date-only filters with actual interval-overlap retrieval, retaining household authorization.",
    "Reuse the shared contract in the calendar and existing Chef resolver; obtain explicit viewer identity and retain complete/empty/unavailable status.",
    "Verify the Sep4-to-Sep7 leftover example on Sep6 for owner, partner and skipped variants; exercise route and consumer behavior together."
  ],
  "invariants": [
    "Calendar display membership differs from edible coverage; visible skipped rows need not disappear.",
    "No new expansion engine, Items records or claim that one meal fills every slot."
  ],
  "exclusions": [
    "Calendar redesign, stock consumption, nutrition advice and new AI generation."
  ],
  "risks": [
    "A correct helper still leaves Chef wrong if the existing consumer keeps its planned_date Set."
  ],
  "unknowns": [
    "Confirm the current authorized viewer identity seam before freezing the adapter signature."
  ],
  "dependencies": [],
  "risk": "medium",
  "provenance": "2026-09-26 read: meal-plans GET, meal-planning hooks and Chef resolveMealPlanGaps. src/lib/ai/context.ts has no meal reader; the older guide's proposed entry point is corrected below.",
  "checks": [],
  "ownerReviewed": false
}
```

### KIT-11

**Outcome:** Return the correct cooking count.

- **Acceptance:** Reproduce the documented HEAD/count response handling and use the actual count metadata. Verify zero/error/nonzero without treating absent body data as zero.
- **Touches:** `src/app/api/recipes/[id]/cooking-log/route.ts`

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** The defect is two adjacent lines, verified 2026-09-20 in `src/app/api/recipes/[id]/cooking-log/route.ts`: line ~118 queries `.select("id", { count: "exact", head: true })` — a HEAD request, so PostgREST returns the number in the response _metadata_ and `data` is null — and line ~124 then does `times_cooked: (countData as any)?.length ?? 1`, reading `.length` off that null and falling back to 1. Use the `count` field the same call already returns, and keep zero distinguishable from an error: an absent body is not zero. The `as any` is also a live instance of the type debt DLV-52 tracks. Consumer of the value: `times_cooked` in the list `select` of `src/app/api/recipes/route.ts` and the recipe cards.

```delivery-plan-v1
{
  "outcome": "The recipe's cooking count reflects the number of logs recorded for that recipe.",
  "acceptance": [
    "Posting a cooking log writes the number of logs the count query reported into the recipe's times_cooked.",
    "A reported count of zero is written as zero.",
    "A count that is not reported, or a count query that fails, leaves times_cooked unwritten rather than replacing it with an invented number.",
    "The log that was already written is still returned, so the caller does not retry into a second log.",
    "The rating average and the two timestamps written by the same call are unchanged."
  ],
  "scope": [
    "src/app/api/recipes/[id]/cooking-log/route.ts"
  ],
  "steps": [
    "Read the recipe statistics update at the end of the POST handler.",
    "Take the number from the count field that the existing head request already returns, instead of reading length off its empty body.",
    "Build the update payload so times_cooked is present only when a number was reported and the query did not fail.",
    "Leave the log insert, the rating average and both timestamps exactly as they are."
  ],
  "invariants": [
    "One log row is written per request.",
    "Exactly one recipe update per request.",
    "A reported zero is a value, not an absence.",
    "An unknown count never becomes a written number.",
    "No file is created, renamed or deleted, and no other file changes."
  ],
  "exclusions": [
    "The list route and the recipe cards that read the value.",
    "The GET handler in the same file.",
    "The shape of the log row and the response status.",
    "Repairing rows already stored as one.",
    "Wider type cleanup beyond the two lines in question."
  ],
  "checks": [
    "kit11-cooking-count"
  ],
  "risks": [
    "The count field and the response body are easy to confuse; reading the wrong one reproduces the defect unchanged."
  ],
  "unknowns": [],
  "dependencies": [],
  "risk": "low",
  "ownerReviewed": true,
  "provenance": "Prepared 2026-09-20 from the item's own reading guide and a line-by-line read of the route. The protected oracle separates the current code from a corrected control on a host checkout and inside the checker container."
}
```

### KIT-1

- **Retained campaign gate (D3):** After the actual loop/lifecycle witnesses pass, update the Master Book state and shipped evidence; documentation alone does not close this gate.

- **Retained campaign gate (D1):** Dropping an inventory item below threshold puts it on the shopping list automatically (without breaking the legacy queue).

**Outcome:** Add low-stock shopping from an agreed stock rule.

- **Acceptance:** DEC-03 must resolve quantity threshold versus run-out date and automatic-add consent. Then use one pure lowStockItems() reader; restock and the unique shopping backlink must commit together, repeated triggers must not duplicate, and the existing Hub shopping queue must remain compatible. Test failure/retry/offline and an actual below-threshold transition. Do not call the helper alone an end-to-end completion.
- **Depends on:** [KIT-24](<Kitchen — Master Book.md#kit-24>).

- **Acceptance:** dropping an inventory item below its threshold puts it on the shopping list automatically, without breaking the legacy localStorage queue.

**Retained contract — ASTRA-KIT-1:**

- **Outcome:** Concurrent restocks preserve the total quantity and one matching history record for each accepted increment.
- **Boundary:** Validate UUID and finite positive numeric quantity using Zod. Replace route-side read/add/write/history with the reviewed existing transaction seam. Derive the authorized owner from authenticated identity; never trust a freely supplied user ID. Within SQL lock the stock row before recording before/after values; handle absent stock through a verified unique owner/item contract, with no destructive dedupe. History failure rolls back the increment. Preserve existing runout behavior only after its current trigger is verified. Use safeFetch for the existing restock mutation; no new offline eligibility or retry queue. Repeated _distinct_ restocks are separate operations; request-idempotent replay remains outside this sheet and must precede automated replay.
- **Money/schedule math?:** No money/occurrence math. Stock example required: 5 units + concurrent 2 and 3 → 10; history forms 5→7→10 or 5→8→10. Failure inserting history leaves quantity unchanged. String `"2"`, infinity and negative input are rejected.
- **Gate:** `pnpm exec vitest run tests/inventory-restock.test.ts --reporter=verbose` → nonzero mocked route/auth/input cases pass. Owner's isolated SQL fixture proves concurrent increments, absent-row race, history rollback and cross-owner refusal; outputs attached. Common gates pass; migration APPLIED alone is insufficient.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Blocked on DEC-03 (quantity threshold vs run-out date, and whether adding is automatic) — record that before coding. The pieces already exist: `useLowStockItems(days)` and `useAddToShopping()` in `src/features/inventory/hooks.ts` over `src/app/api/inventory/low-stock/route.ts` and `inventory/add-to-shopping/route.ts`, with `useRestockItem()` and `src/app/api/inventory/restock/route.ts` on the write side. Note `useLowStockItems` is parameterised by _days_, which is one side of DEC-03 already baked in. The compatibility trap is explicit in CLAUDE.md: the Hub shopping list still uses the **legacy localStorage queue** in `SyncContext`, not the IndexedDB queue — `src/components/hub/ShoppingListView.tsx` is the consumer — so do not migrate it as a side effect. "Restock and the unique shopping backlink must commit together" plus "repeated triggers must not duplicate" means a unique constraint and 409 handling (Hard Rule #9). Depends on KIT-24.

**Execution plan — 2026-09-26**

**Readiness:** decision held.

**Verify:** Proposed `tests/inventory-restock.test.ts`: auth and finite positive input, zero writes on rejection. Owner-only isolated SQL witnesses: 5+2+3=10, absent-row race, history rollback, below-threshold transition and duplicate/offline replay.

**Scope notes:** `src/lib/lowStockItems.ts`: proposed. Name any proposed migration only after schema review; `migrations/` is the preliminary boundary. `tests/inventory-restock.test.ts`: proposed.

```delivery-plan-v1
{
  "outcome": "Add low-stock shopping under one approved rule while preserving stock, history and shopping identity.",
  "acceptance": [
    "DEC-03 defines threshold meaning and automatic-add consent before automation.",
    "Concurrent accepted restocks preserve total stock and matching before/after history; failures roll back together.",
    "A qualifying transition creates one shopping backlink and survives retries without breaking the existing Hub queue."
  ],
  "scope": [
    "src/app/api/inventory/restock/route.ts",
    "src/app/api/inventory/low-stock/route.ts",
    "src/app/api/inventory/add-to-shopping/route.ts",
    "src/features/inventory/hooks.ts",
    "src/lib/lowStockItems.ts",
    "migrations/",
    "migrations/schema.sql",
    "tests/inventory-restock.test.ts"
  ],
  "steps": [
    "Record DEC-03 and finish KIT-24; revalidate current stock uniqueness, trigger and queue contracts from owner evidence.",
    "Deliver the retained atomic-restock slice first: authenticated owner, row lock, positive finite quantity, stock increment and history in one transaction.",
    "After the rule is agreed, reuse one lowStockItems reader and add a stable shopping identity in the checked write boundary.",
    "Integrate qualifying transitions with existing shopping behavior; preserve the legacy localStorage queue and reject unsafe replay until request identity exists.",
    "Separate local tests, owner SQL application and the actual below-threshold witness; the restock slice alone does not complete this parent."
  ],
  "invariants": [
    "Unknown stock is not zero.",
    "Distinct restocks remain distinct; retrying the same operation cannot duplicate its effect."
  ],
  "exclusions": [
    "New offline queue, predictive cadence, guessed thresholds and owner-data repairs."
  ],
  "risks": [
    "The retained restock contract and shopping automation are separate slices inside this broad item."
  ],
  "unknowns": [
    "DEC-03; current trigger/unique-key evidence; automatic addition's inverse and replay identity."
  ],
  "dependencies": [
    "DEC-03",
    "KIT-24"
  ],
  "risk": "high",
  "provenance": "2026-09-26 planning from retained ASTRA-KIT-1, DEC-03 and Inventory/Shopping ownership docs. Revalidate write contracts before implementation; no DB state or end-to-end loop is certified.",
  "checks": [],
  "ownerReviewed": false
}
```

### KIT-2

- **Retained campaign gate (D3):** After the actual loop/lifecycle witnesses pass, update the Master Book state and shipped evidence; documentation alone does not close this gate.

- **Retained campaign gate (D2):** Completing a recipe in cooking mode deducts its ingredients from inventory.

**Outcome:** Deduct mapped ingredients when cooking completes.

- **Acceptance:** DEC-17 must settle ingredient↔stock mapping and unit conversion. Unknown mappings/units produce no invented deduction. Cooking confirmation, stock delta and a real Undo inverse are atomic/idempotent, including failure and replay; preserve the owner confirmation choice.

- **Acceptance:** completing a recipe in cooking mode deducts its ingredients from inventory, and that deduction can trigger KIT-1.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Blocked on DEC-17 (ingredient↔stock mapping and unit conversion); no mapping table exists to guess from. The two ends are `src/app/api/recipes/[id]/cooking-log/route.ts` (cooking completion) and `src/app/api/inventory/restock/route.ts` / `inventory/stock/[itemId]/route.ts` (stock delta), with `src/features/inventory/hooks.ts` on the client. "Unknown mappings/units produce no invented deduction" is the safety rule — the same unknown-stays-unknown discipline as KIT-10 and KIT-15. Atomic and idempotent across confirmation, delta and inverse means a SECURITY DEFINER RPC rather than sequential PostgREST calls (`.claude/skills/db-migration/SKILL.md`; Hard Rules #24/#26). The Undo inverse is KIT-12's scope — coordinate, do not duplicate. Preserve the owner confirmation choice: this must not become a silent write.

**Execution plan — 2026-09-26**

**Readiness:** decision held.

**Verify:** Propose cooking-consumption route/transaction fixtures once DEC-17 supplies exact examples. Verify known, missing and incompatible units; double submit; partial failure; Undo after a later stock change. SQL atomicity is an owner-run isolated witness.

**Scope notes:** Name any proposed migration only after schema review; `migrations/` is the preliminary boundary. `tests/cooking-consumption.test.ts`: proposed.

```delivery-plan-v1
{
  "outcome": "Deduct only explicitly mapped ingredient quantities when cooking is confirmed, with a checked inverse.",
  "acceptance": [
    "DEC-17 specifies ingredient identity, units and the user's confirmation choice.",
    "Confirmation, supported stock deltas and their inverse identity commit together; replay cannot consume twice.",
    "Unknown mappings or conversions cause no invented deduction; a qualifying deduction can feed KIT-1."
  ],
  "scope": [
    "src/app/api/recipes/[id]/cooking-log/route.ts",
    "src/components/web/RecipeCookingMode.tsx",
    "src/features/recipes/hooks.ts",
    "src/features/inventory/hooks.ts",
    "migrations/",
    "migrations/schema.sql",
    "tests/cooking-consumption.test.ts"
  ],
  "steps": [
    "Resolve DEC-17 with concrete mapped, unmapped and mixed-unit examples; verify the current cooking and stock schemas.",
    "Design the smallest receipt linking one confirmed cooking event, its exact stock deltas and expected inverse state; share KIT-12's inverse contract.",
    "Author an authenticated atomic command and manual migration runbook; validate mappings and conversions before any write.",
    "Connect the existing completion control to the command, preserving confirmation and a real Undo; invalidate recipe, stock/history and affected shopping queries.",
    "Exercise replay, failure and later-edit conflicts, then verify the KIT-1 trigger only under its approved rule."
  ],
  "invariants": [
    "AI never chooses unreviewed mappings or silently consumes stock.",
    "Undo targets this cooking event, preserving unrelated later stock operations."
  ],
  "exclusions": [
    "Pantry suggestion engine, estimated consumption, automatic unit guesses and separate competing Undo implementation."
  ],
  "risks": [
    "A cooking-log success followed by an independent stock call creates an unrecoverable partial action."
  ],
  "unknowns": [
    "DEC-17 mapping/conversion/confirmation policy; current DB atomic seam."
  ],
  "dependencies": [
    "DEC-17",
    "KIT-10",
    "KIT-1 for the shopping-trigger portion"
  ],
  "risk": "high",
  "provenance": "2026-09-26 docs-grounded follow-on from the retained cooking contract, DEC-17 and Recipes/Inventory docs. Current cooking-log count repair is separate and remains untouched.",
  "checks": [],
  "ownerReviewed": false
}
```

### KIT-18

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C01a. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Authorize document signing through its owning record.

- **Acceptance:** Catalogue C01a: authorize each private document via its source record before signing; reject arbitrary storage paths and cross-user access. Preserve valid shared-record access.
- **Depends on:** [HUB-62](<../Hub & ERA/Hub & ERA — Master Book.md#hub-62>).

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Catalogue C01a, and the hole is visible: `src/app/api/catalogue/document-image/signed-url/route.ts` takes a raw `?path=` query parameter, splits it on `/`, and authorizes by comparing the first segment against `household_links` before calling `.storage.from("documents").createSignedUrl(...)`. Authorization is therefore by path string, not by the owning record — which is exactly what "reject arbitrary storage paths" means. Fix by resolving the document's source row first (`src/app/api/catalogue/items/[id]/document-image/route.ts` is where the record↔file relation lives) and signing only what that row permits. Household expansion follows Hard Rule #13 (`src/app/api/accounts/route.ts` is the reference). Preserve valid shared-record access — this is a narrowing, not a lockout. Depends on HUB-62; KIT-19 and KIT-21 build on it.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Propose `tests/catalogue-document-signing.test.ts`; distinguish owner/shared/private/unlinked/deleted/replaced/forged paths and legacy valid paths. Run typecheck/lint; deployment privacy requires fresh owner policy/storage evidence.

**Scope notes:** `src/lib/catalogueAccess.ts`: proposed. `tests/catalogue-document-signing.test.ts`: proposed.

```delivery-plan-v1
{
  "outcome": "Sign a private Catalogue document only after authorizing its actual source record and current file.",
  "acceptance": [
    "New record-ID requests and the legacy path facade resolve an authorized live document before signing.",
    "Arbitrary, replaced and deleted paths fail without disclosing whether forbidden records exist.",
    "Legitimate shared-record access survives and pointer mutations cannot bypass authorization."
  ],
  "scope": [
    "src/app/api/catalogue/document-image/signed-url/route.ts",
    "src/app/api/catalogue/items/[id]/document-image/route.ts",
    "src/app/api/catalogue/items/route.ts",
    "src/app/api/catalogue/items/[id]/route.ts",
    "src/lib/catalogueAccess.ts",
    "tests/catalogue-document-signing.test.ts"
  ],
  "steps": [
    "Review HUB-62's shared source authorization contract and Catalogue C01a; enumerate signing callers and document-pointer writers.",
    "Extract the record-read predicate; resolve ID or legacy path to its current record/file association before creating a URL.",
    "Reject forbidden/deleted/replaced associations consistently; guard generic create/update pointer fields so a forged association cannot pass the signer.",
    "Use the accepted short-lived no-store URL contract and verify authorized legacy callers while updating new callers to record IDs."
  ],
  "invariants": [
    "A household path prefix alone never proves record access.",
    "Restore signing remains an explicit owner-only lifecycle operation."
  ],
  "exclusions": [
    "Storage migration, bucket-wide cleanup, document version platform and changing source-sharing policy."
  ],
  "risks": [
    "Already-issued long-lived URLs retain their expiry; application containment is not proof of deployed bucket policy."
  ],
  "unknowns": [
    "Fresh deployment grants/storage evidence; current HUB-62 interface and caller inventory."
  ],
  "dependencies": [
    "HUB-62",
    "Catalogue C00 evidence before release certification"
  ],
  "risk": "high",
  "provenance": "2026-09-26 rechecked the raw-path signer and document routes against accepted Catalogue §10 C01a. Plan authorizes local containment work only; no production privacy claim.",
  "checks": [],
  "ownerReviewed": false
}
```

### KIT-19

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C01b. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Preserve old document files through replacement and Undo.

- **Acceptance:** Catalogue C01b: replacement cannot delete the prior binary before commit/Undo eligibility; define cleanup after reference checks and test failed replacement and inverse.
- **Depends on:** [KIT-18](<Kitchen — Master Book.md#kit-18>).

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Catalogue C01b, depends on KIT-18. The replacement path is `src/app/api/catalogue/items/[id]/document-image/route.ts` — read what it does with the previous storage object before writing the new one; the failure mode is deleting the old binary before the new write commits or before Undo can still need it. Compare with the equivalent problem already solved in Outfits (`src/app/api/outfits/items/[id]/route.ts` DELETE also does storage cleanup) and with `src/features/recycle-bin/` for the app's retention model. Cleanup after reference checks means KIT-21's tombstone contract has to exist conceptually first, even though KIT-21 depends on this. Test the failed replacement and the inverse.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Propose `tests/catalogue-document-replacement.test.ts`; inject upload/swap/response-loss failures, concurrent replacements and stale Undo. Owner storage fixture proves prior bytes survive and cleanup never deletes retained references.

**Scope notes:** Name any proposed migration only after schema review; `migrations/` is the preliminary boundary. `tests/catalogue-document-replacement.test.ts`: proposed.

```delivery-plan-v1
{
  "outcome": "Replace a document without losing the previous file or the ability to undo the accepted replacement.",
  "acceptance": [
    "Upload or conditional pointer-swap failure leaves the previous document usable.",
    "Retry cannot overwrite a different upload; Undo restores the previous pointer only under its post-write precondition.",
    "Cleanup checks current/retained references and the accepted recovery window before removing bytes."
  ],
  "scope": [
    "src/app/api/catalogue/items/[id]/document-image/route.ts",
    "src/components/web/CatalogueItemDialog.tsx",
    "src/features/catalogue/hooks.ts",
    "migrations/",
    "migrations/schema.sql",
    "tests/catalogue-document-replacement.test.ts"
  ],
  "steps": [
    "Wait for KIT-18 authorization and KIT-20 revision CAS; reuse Catalogue §10's file contract and KIT-21 lifecycle guard.",
    "Upload to a unique request-derived immutable path with MIME/size validation; conditionally swap the authorized pointer.",
    "Retain the old binary and return a bounded actor/item/revision-bound inverse receipt; retry resolves the original upload result.",
    "Connect Undo to the guarded inverse and invalidate document URLs after success; on swap failure remove only the new orphan.",
    "Enable cleanup only after KIT-21 reference guards exist, initially respecting the accepted 30-day retention and any active inverse."
  ],
  "invariants": [
    "A caller cannot supply an arbitrary old path as Undo.",
    "The old file is never deleted before a successful swap or while retained references require it."
  ],
  "exclusions": [
    "A general file-version system, copying existing binaries and bucket-wide purge."
  ],
  "risks": [
    "KIT-21 depends on this file inverse, but cleanup must separately wait for KIT-21; do not create a circular block on the core replacement slice."
  ],
  "unknowns": [
    "Current storage failure behavior and inverse receipt seam; revalidate before implementation."
  ],
  "dependencies": [
    "KIT-18",
    "KIT-20",
    "KIT-21 only for cleanup activation"
  ],
  "risk": "high",
  "provenance": "2026-09-26 plan follows Catalogue C01b and §10.7, which adds KIT-20 beyond the shorter existing dependency line. No storage operation was performed.",
  "checks": [],
  "ownerReviewed": false
}
```

### KIT-20

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C02. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Patch catalogue metadata with revision checks.

- **Acceptance:** Catalogue C02: validate typed partial updates, preserve unrelated metadata and use revision preconditions for stale writes. Safe create/edit foundation precedes promotions and corrections.
- **Depends on:** [KIT-18](<Kitchen — Master Book.md#kit-18>).

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Catalogue C02, and it gates KIT-21/22/24, HLTH-23 and TRIP-33 — so it is the foundation item. The defect is concrete: `src/app/api/catalogue/items/[id]/route.ts` PATCH assigns `updates.metadata_json = body.metadata_json` wholesale, with no zod import in the file and no revision precondition. That means an untyped partial write clobbers unrelated metadata, and two concurrent edits silently last-write-wins. The typed metadata interfaces already exist in `src/types/catalogue.ts` (`DocumentItemMetadata` and siblings) — use them to verify the runtime field contract, then infer touched TypeScript types from Zod so the two cannot drift, per Hard Rule #12. A revision precondition needs a column and a conditional update (Hard Rules #24/#26); a stale write should surface as a conflict, not a 500. Client mutation: `useUpdateItem()` in `src/features/catalogue/hooks.ts`.

**Execution plan — 2026-09-26**

**Readiness:** split first.

**Verify:** Propose `tests/catalogue-patch.test.ts`: omitted/null/unset/false/zero, unknown keys, nested replacement, wrong collection, protected pointers and concurrent edit. Local route mocks plus owner isolated CAS witness; typecheck/lint.

**Scope notes:** Name any proposed migration only after schema review; `migrations/` is the preliminary boundary. `tests/catalogue-patch.test.ts`: proposed.

```delivery-plan-v1
{
  "outcome": "Apply typed partial Catalogue edits without erasing unrelated metadata or another device's changes.",
  "acceptance": [
    "Only changed fields are written; unknown untouched fields and legacy values survive.",
    "Revision comparison/increment are one DB operation; stale requests return conflict and preserve editor input.",
    "All authored writers participate in revision rules, with compatible old-client rollout."
  ],
  "scope": [
    "src/types/catalogue.ts",
    "src/app/api/catalogue/items/",
    "src/app/api/catalogue/sub-items/",
    "src/features/catalogue/hooks.ts",
    "src/components/web/CatalogueItemDialog.tsx",
    "src/components/web/CatalogueTaskItemDialog.tsx",
    "migrations/",
    "migrations/schema.sql",
    "tests/catalogue-patch.test.ts"
  ],
  "steps": [
    "Freeze the writer census and first slice: typed item PATCH plus revision CAS; map image, Inventory, promotion and sub-item follow-ons before dispatch.",
    "Author additive revision migration after C00 evidence; implement expected_revision with metadata_set/metadata_unset and explicit field-owner allowlists.",
    "Validate changed known keys, category/module ownership and set/unset conflicts; replace nested values at declared top-level keys without guessed deep merges.",
    "Have editors send differences and explicit clears, retain failed input and support conflict reapply; stage legacy non-destructive compatibility before strict precondition enforcement.",
    "Bring alternate writers and guarded inverses into the same contract, then verify complete acceptance; the first slice alone cannot close KIT-20."
  ],
  "invariants": [
    "Missing precondition and stale revision are distinct outcomes.",
    "Generic metadata writes cannot alter operational stock policy or authorized file pointers."
  ],
  "exclusions": [
    "Universal revision service, metadata normalization/backfill and taxonomy replacement."
  ],
  "risks": [
    "A safe main PATCH remains bypassable through unconverted writers or older queued clients."
  ],
  "unknowns": [
    "Current client/queue census; strict cutover timing requires evidence."
  ],
  "dependencies": [
    "KIT-18",
    "Catalogue C00 and compatible-client rollout"
  ],
  "risk": "high",
  "provenance": "2026-09-26 checked wholesale metadata_json replacement and Catalogue C02/§10.7. Broad accepted scope is retained as sequenced slices, not declared delivery-ready.",
  "checks": [],
  "ownerReviewed": false
}
```

### KIT-21

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C03. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Preserve catalogue identity through delete and restore.

- **Acceptance:** Catalogue C03: tombstone/restore preserve ID and backlinks; purge only after the retained-reference contract permits it. Exercise failed and repeated inverse operations.
- **Depends on:** [KIT-19](<Kitchen — Master Book.md#kit-19>), [KIT-20](<Kitchen — Master Book.md#kit-20>).

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Catalogue C03, depends on KIT-19 and KIT-20. Tombstone/restore preserving the ID is the crux — today `src/app/api/catalogue/items/[id]/route.ts` DELETE and `src/app/api/catalogue/[id]/disable/route.ts` are the two existing exits, and `useDeleteItem()` in `src/features/catalogue/hooks.ts` is the client. Read both before choosing, and compare with `src/features/recycle-bin/` and `src/app/api/recycle-bin/`, which is the app's existing soft-delete-and-restore model — a third model would be the wrong outcome. Backlinks that must survive are `source_catalogue_item_id` on `items` (see `src/app/api/items/[id]/promote/route.ts`) and whatever TRIP-33/TRIP-10 add. "Purge only after the retained-reference contract permits it" means a reference check before hard delete — which is also KIT-19's file-retention question. Exercise failed and repeated inverses; Hard Rule #1 for the toast.

**Execution plan — 2026-09-26**

**Readiness:** split first.

**Verify:** Propose `tests/catalogue-lifecycle.test.ts`: linked fixture round-trip, repeated/missing restore, later edit, parent deletion and each purge entry. Owner verifies constraints and retained bytes; typecheck/lint.

**Scope notes:** Name any proposed migration only after schema review; `migrations/` is the preliminary boundary. `tests/catalogue-lifecycle.test.ts`: proposed.

```delivery-plan-v1
{
  "outcome": "Delete, restore and purge Catalogue references without changing identity or destroying retained consumers.",
  "acceptance": [
    "Tombstone and restore preserve Catalogue, sub-item, stock, history and backlink IDs.",
    "Checked inverse restores only its authorized lifecycle state; failed or repeated restores are truthful.",
    "Referenced tombstones and binaries survive every permanent deletion or purge entry point."
  ],
  "scope": [
    "src/app/api/catalogue/",
    "src/features/catalogue/hooks.ts",
    "src/lib/recycleBin/registry.ts",
    "src/lib/recycleBin/scope.ts",
    "src/app/api/recycle-bin/restore/route.ts",
    "src/app/api/recycle-bin/empty/route.ts",
    "src/app/api/cron/purge-recycle-bin/route.ts",
    "migrations/",
    "migrations/schema.sql",
    "tests/catalogue-lifecycle.test.ts"
  ],
  "steps": [
    "After KIT-19/20, inventory item/module/category delete, bin-empty and cron-purge paths plus current FK behavior from owner evidence.",
    "First deliver Catalogue tombstone/restore through the existing Recycle Bin owner with revision/lifecycle checks and actual affected-row acknowledgment.",
    "Add reference guards to every destructive entry point; change only proven destructive constraints through a paired manual migration.",
    "Connect real Undo and preserve linked Schedule/Inventory ownership; test repeated restore and parent lifecycle conflicts.",
    "Verify the full linked fixture and purge matrix before enabling KIT-19 cleanup or completing this parent."
  ],
  "invariants": [
    "Archive does not cancel Schedule work; restore never allocates a replacement ID.",
    "Generic Recycle Bin permissions cannot broaden Catalogue edit rights."
  ],
  "exclusions": [
    "A second recycle system, cleanup by name, automatic backfill and unrelated domain purge changes."
  ],
  "risks": [
    "One unguarded parent delete or scheduled purge can bypass an otherwise correct tombstone route."
  ],
  "unknowns": [
    "Fresh FK/purge behavior and all retained-reference classes; source docs are not live DB evidence."
  ],
  "dependencies": [
    "KIT-19",
    "KIT-20",
    "Catalogue C00 evidence"
  ],
  "risk": "high",
  "provenance": "2026-09-26 docs-grounded from Catalogue C03 and existing deletion/restore reading guide. Revalidate every deletion entry point before dispatch; no deletion was executed.",
  "checks": [],
  "ownerReviewed": false
}
```

### KIT-22

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C09. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Browse and edit reference records.

- **Acceptance:** Catalogue C09: reference-only types get compact browsing/forms, typed metadata and permissions without execution controls. Keep executable masters in their owning modules.
- **Depends on:** [KIT-20](<Kitchen — Master Book.md#kit-20>).

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Catalogue C09, depends on KIT-20's typed-patch foundation. The distinction to hold: a reference-only type gets browsing and a form, but no execution controls — executable masters stay in their owning modules (a recipe is executed in Recipes, an item in Schedule). The category/type vocabulary is `src/types/catalogue.ts` (`CatalogueCategory` and its label/icon/colour maps); browsing is `src/app/catalogue/` with `src/features/catalogue/hooks.ts` (`useCatalogueModules`, `useCatalogueCategories`, `useCatalogueItems`, `useCatalogueItem`, `useCatalogueSubItems`). Compact forms and permissions are the deliverable; Hard Rules #5 (mobile-first), #15 (opaque floating panels) and #28 (no explanatory prose) all apply to the forms.

**Execution plan — 2026-09-26**

**Readiness:** split first.

**Verify:** Propose reference-form behavior coverage after choosing the first existing type. Verify title-only capture, unknown fields, explicit clear, first-use retry, no execution side effect; 390×844 and desktop; typecheck/lint and Atlas sync.

```delivery-plan-v1
{
  "outcome": "Browse and edit reusable references in the existing Catalogue without confusing them with domain execution.",
  "acceptance": [
    "Reference-only forms use typed metadata and source permissions; title-only loose capture still works.",
    "Saving a task/reference never schedules, funds or completes operational work.",
    "Legacy annotations remain readable and new document-kind choices do not silently reclassify old rows."
  ],
  "scope": [
    "src/components/web/WebCatalogue.tsx",
    "src/components/web/CatalogueItemDialog.tsx",
    "src/components/web/CatalogueItemDetailDialog.tsx",
    "src/components/web/CatalogueTaskItemDialog.tsx",
    "src/components/web/CatalogueModuleDialog.tsx",
    "src/app/api/catalogue/modules/route.ts",
    "src/types/catalogue.ts",
    "ERA Notes/04 - UI & Design/Page & Feature Atlas/"
  ],
  "steps": [
    "Use C09's existing-navigation design; choose one reference type as the first bounded slice and list remaining type parity before implementation.",
    "Wait for safe edit/lifecycle foundations, then separate descriptive controls from execution-owned actions without deleting retained legacy fields.",
    "Add compact document-kind selection for new records and owner-directed edit links; leave ambiguous legacy rows unchanged.",
    "Replace first-use GET initialization with an explicit idempotent bootstrap write, preserving empty/error/archived states.",
    "Expand the proven form pattern to remaining existing types; verify mobile and desktop discoverability and update Atlas."
  ],
  "invariants": [
    "Recipes and Schedule remain the only executable owners.",
    "UI labels/actions stay short; help is hidden behind an affordance when needed."
  ],
  "exclusions": [
    "New destination page, universal object model, duplicate executable recipes and automatic legacy classification."
  ],
  "risks": [
    "Hiding controls without changing write behavior can still schedule or reset hidden fields."
  ],
  "unknowns": [
    "Revalidate live reference-type inventory; usage/promoted controls wait for their own producer packets."
  ],
  "dependencies": [
    "KIT-18",
    "KIT-19",
    "KIT-20",
    "KIT-21",
    "Catalogue C08 for task usage; C12/C13 for promotion controls"
  ],
  "risk": "medium",
  "provenance": "2026-09-26 docs-grounded from Catalogue C09/§10.8, Feature Map and accepted ownership contract. C09 is broader than the short checklist title; first-type completion does not close the parent.",
  "checks": [],
  "ownerReviewed": false
}
```

### KIT-24

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C17. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Keep catalogue metadata separate from stock ownership.

- **Acceptance:** Catalogue C17: descriptive reference edits cannot overwrite Inventory quantity, unit or history. Require an explicit owner transition for operational stock changes.
- **Depends on:** [KIT-20](<Kitchen — Master Book.md#kit-20>).

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide (revalidated 2026-09-26):** Catalogue C17 governs field ownership within existing shared storage. `src/app/api/inventory/items/route.ts` reads and writes `catalogue_items.metadata_json`; `inventory_stock` and `inventory_restock_history` hold operational rows. This corrects the earlier claim that Catalogue and Inventory item stores are separate. Protect Inventory-owned unit/policy keys in generic Catalogue PATCH, route operational changes through Inventory validation, and reuse KIT-20 revision checks plus KIT-21 lifecycle guards. C17 does not move metadata or create a new item model. Start with these routes, `src/features/inventory/hooks.ts`, `src/features/catalogue/hooks.ts` and `src/types/inventory.ts`.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Propose `tests/catalogue-inventory-ownership.test.ts`: description change preserves stock/history; generic policy patch rejected; unit relabel refused; barcode identity and linked deletion guarded. Run typecheck/lint; owner evidence for database constraints.

**Scope notes:** `tests/catalogue-inventory-ownership.test.ts`: proposed.

```delivery-plan-v1
{
  "outcome": "Keep descriptive Catalogue edits from rewriting Inventory's operational stock meaning.",
  "acceptance": [
    "Description changes preserve stock quantity, unit policy, history and row identity.",
    "Generic Catalogue callers cannot mutate Inventory-owned policy fields or delete retained stock dependencies.",
    "An incompatible unit change is refused until an explicit Inventory conversion contract exists."
  ],
  "scope": [
    "src/app/api/catalogue/items/[id]/route.ts",
    "src/app/api/inventory/items/",
    "src/features/catalogue/hooks.ts",
    "src/features/inventory/hooks.ts",
    "src/components/inventory/InventoryItemDialog.tsx",
    "src/types/inventory.ts",
    "tests/catalogue-inventory-ownership.test.ts"
  ],
  "steps": [
    "Recheck the shared storage boundary: Inventory items already use catalogue_items metadata, while inventory_stock/history own operational rows.",
    "Build on KIT-20 allowlists and KIT-21 lifecycle guards; route descriptive fields through safe Catalogue patch and policy/unit fields through Inventory validation.",
    "Retain existing JSON placement and IDs; reject generic edits that reinterpret historical quantities or bypass stock ownership.",
    "Use before/after stock-history fixtures to verify descriptive edit, forbidden policy edit, unit-change refusal, barcode lookup and linked deletion.",
    "Expose any source-to-stock transition only as an explicit Inventory-owned action; do not enable KIT-1 automation in this packet."
  ],
  "invariants": [
    "Separate field ownership does not require physically separate Catalogue item tables.",
    "User-only inventory reads are never described as complete household stock."
  ],
  "exclusions": [
    "New SKU/lot/asset model, unit conversion engine and atomic restock implementation."
  ],
  "risks": [
    "The older guide described stores as separate; treating the shared metadata as purely descriptive would leave a bypass."
  ],
  "unknowns": [
    "Current protected metadata keys and all Inventory item writers must be frozen before editing."
  ],
  "dependencies": [
    "KIT-20",
    "KIT-21 lifecycle guard",
    "Catalogue C00 evidence"
  ],
  "risk": "medium",
  "provenance": "2026-09-26 verified inventory/items reads/writes catalogue_items.metadata_json and inventory_stock; accepted C17 defines field ownership. Planning only; stock state was not inspected.",
  "checks": [],
  "ownerReviewed": false
}
```

### KIT-3

**Outcome:** Meal plan budget estimate (gap 2c).

- **Acceptance:** Meal plan budget estimate (gap 2c) — show estimated grocery cost per plan. Coordinate with [Budget — Master Book](<../Budget/Budget — Master Book.md>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on ingredient data being trustworthy (KIT-10) and on a price source — check whether one exists before designing: `src/types/catalogue.ts` and the inventory item shape are where a price would live, and KIT-8 (barcode → catalogue price) is the parked item that would supply it. Plan data is `src/app/api/meal-plans/route.ts` and `src/features/meal-planning/hooks.ts`; the estimate surfaces on `src/components/web/WebMealPlanCalendar.tsx`. It is money on screen, so `.claude/skills/money-rules/SKILL.md` applies — and an _estimate_ must be labelled as one at the read boundary, which is the same basis-preservation problem as KIT-13. Coordinate with the Budget campaign.

**Execution plan — 2026-09-26**

**Readiness:** investigation first.

**Verify:** Use synthetic examples: two servings versus four, partial ingredient pricing, stale price, mixed currencies and incompatible units. Record expected estimate and coverage without calling a provider or reading production data; `pnpm pm:lint` and `pnpm pm:check-docs` validate the handoff.

```delivery-plan-v1
{
  "outcome": "Define a usable, honest meal-plan cost estimate before adding money to the calendar.",
  "acceptance": [
    "Identify an authorized price source, price date/currency/unit basis and the intended estimate: full ingredients or additional shopping.",
    "Specify serving scaling, pantry treatment and partial-coverage behavior with worked examples.",
    "The final feature must show an estimate without inventing prices or changing transactions; this investigation alone does not complete KIT-3."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/Kitchen/Kitchen — Master Book.md"
  ],
  "steps": [
    "Inspect existing Catalogue price-like metadata, Inventory units and recipe quantities; distinguish descriptive price ranges from usable unit prices.",
    "Ask the owner only for unresolved choices that change the result: estimate meaning and acceptable price input/source; KIT-8 is one option, not an automatic dependency.",
    "Write examples for a known unit price, a missing price and mixed-currency ingredients; require unknown/partial coverage instead of a fabricated total.",
    "Record the smallest read-only implementation slice, owning source fields, serving conversion rules and calendar placement after those choices are settled."
  ],
  "invariants": [
    "No money mutation, balance adjustment or automatic external price lookup.",
    "Ingredient mappings and currency basis must be explicit; LBP storage/display rules remain binding."
  ],
  "exclusions": [
    "Provider adoption, barcode rollout, checkout prediction and claiming stock equals measured consumption."
  ],
  "risks": [
    "A precise-looking total can hide missing ingredients, incompatible quantities or stale prices."
  ],
  "unknowns": [
    "Approved price source, estimate meaning, currency/FX policy and usable ingredient-unit coverage."
  ],
  "dependencies": [
    "KIT-10; KIT-2/DEC-17 if stock mappings are used",
    "Budget review of money basis"
  ],
  "risk": "medium",
  "provenance": "2026-09-26 reviewed Kitchen acceptance, Inventory metadata and Catalogue price-like fields at HEAD 45b28899. No canonical grocery unit-price contract was established; this is a bounded decision handoff.",
  "checks": [],
  "ownerReviewed": false
}
```

### KIT-5

**Outcome:** Pantry-aware recipe suggestions ("what can I make with what I have").

- **Acceptance:** Pantry-aware recipe suggestions ("what can I make with what I have").

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Needs the ingredient↔stock mapping that DEC-17 (KIT-2) settles; without it "what can I make" is keyword matching on free text, with the same false-confidence risk as allergen matching. Read `src/lib/health/allergenMatch.ts` for how this repo already does cautious ingredient text matching, then `src/features/inventory/hooks.ts` (`useInventoryItems`, `useInventoryStock`) and `src/app/api/recipes/route.ts` for the two data sets. Suggestions are advisory, never a guarantee.

**Execution plan — 2026-09-26**

**Readiness:** decision held.

**Verify:** Define fixture outcomes for complete stock, missing ingredient, unmapped ingredient, unknown quantity, optional ingredient and unavailable stock read. Validate the chosen ranking with the owner before implementation; no live AI call or stock write.

```delivery-plan-v1
{
  "outcome": "Specify pantry-aware recipe suggestions that expose what is known and what still needs checking.",
  "acceptance": [
    "Suggestions use approved ingredient-to-stock identity and compatible quantity/unit rules.",
    "Missing or unknown stock is distinguishable from a confirmed shortage; suggestions never promise allergen safety.",
    "The selected recipe remains a normal Recipes record and nothing is consumed or purchased by asking for suggestions."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/Kitchen/Kitchen — Master Book.md"
  ],
  "steps": [
    "Wait for DEC-17's mapping rules; inspect existing recipe and Inventory readers, including the difference between personal stock and household recipe visibility.",
    "Prepare a small fixture set covering known, missing and unknown ingredients; determine whether the intended answer is possible meals or ranked meals needing the fewest purchases.",
    "Ask for that remaining product choice only if it is unresolved, then record a deterministic first slice with explicit coverage and links to the recipe.",
    "Identify one existing Chef/Recipes entry point and the read-only integration seam; retain a manual fallback and reject an AI-dependent ranking until its benefit is accepted."
  ],
  "invariants": [
    "Text similarity alone is not ingredient identity, unit equivalence or clinical assurance.",
    "A read does not deduct stock or silently add shopping items."
  ],
  "exclusions": [
    "New recommendation service, recipe generation, medical safety inference and forecasting consumption."
  ],
  "risks": [
    "Private stock scope or stale counts can make a household-wide 'you have everything' claim false."
  ],
  "unknowns": [
    "DEC-17, minimum coverage for a suggestion and the intended ranking/entry point."
  ],
  "dependencies": [
    "DEC-17",
    "KIT-10",
    "KIT-24 field ownership"
  ],
  "risk": "medium",
  "provenance": "2026-09-26 docs-grounded from KIT-5 acceptance, Recipe/Inventory contracts and the shared-storage correction. Scope is the decision and bounded implementation brief; the feature remains open.",
  "checks": [],
  "ownerReviewed": false
}
```

### KIT-6

**Outcome:** Smarter per-item low-stock thresholds + restock cadence from usage history.

- **Acceptance:** Smarter per-item low-stock thresholds + restock cadence from usage history.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide (revalidated 2026-09-26):** `InventoryItemMetadata` in `src/types/inventory.ts` already has `minimum_stock` and `consumption_rate_days`; a per-item threshold does not inherently require a new column. The current `inventory/low-stock` route calls `get_low_stock_items` with a days threshold and has a run-out-date fallback. Read history event meanings in `inventory/history/route.ts` and `useRestockHistory()` before interpreting restock cadence as consumption. Resolve DEC-03 first and use synthetic or owner-supplied sanitized evidence; agents do not query production row counts. Reuse KIT-1's agreed reader and KIT-24 field ownership.

**Execution plan — 2026-09-26**

**Readiness:** investigation first.

**Verify:** Synthetic history cases: no observations, one restock, irregular purchases, explicit consumption versus purchase-only history and unit change. Compare proposed thresholds to DEC-03 and preserve current behavior until approved; PM checks validate documentation only.

```delivery-plan-v1
{
  "outcome": "Determine whether existing stock history can support better per-item thresholds without inventing usage.",
  "acceptance": [
    "Reuse the accepted low-stock rule and existing per-item metadata before proposing schema changes.",
    "Separate recorded stock consumption from restock cadence and estimated run-out dates.",
    "A proposed improvement has a clear minimum-evidence rule and deterministic fallback; investigation completion does not certify a predictor."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/Kitchen/Kitchen — Master Book.md"
  ],
  "steps": [
    "Resolve DEC-03 first and inspect InventoryItemMetadata.minimum_stock/consumption_rate_days, low-stock reader and history event meanings.",
    "Classify available fields using source and synthetic or owner-supplied sanitized examples; agents do not inspect production counts.",
    "Compare a small rule-based suggestion against the existing manual threshold on sparse and irregular histories; do not fit a model to restock dates as though they were consumption.",
    "Record whether the useful next slice is an editable per-item setting, an advisory cadence suggestion or no change; name its evidence threshold and inverse before implementation."
  ],
  "invariants": [
    "No new low-stock engine or automatic shopping activation outside KIT-1.",
    "Unknown stock/usage stays unknown; no automatic unit relabeling."
  ],
  "exclusions": [
    "Predictive ML, new telemetry collection, source-wide history repair and presumed schema expansion."
  ],
  "risks": [
    "Bulk buying and delayed restocking break the assumption that purchase spacing equals consumption rate."
  ],
  "unknowns": [
    "Meaningful consumption evidence and the minimum confidence the owner expects from a cadence suggestion."
  ],
  "dependencies": [
    "DEC-03",
    "KIT-1 approved rule",
    "KIT-24"
  ],
  "risk": "medium",
  "provenance": "2026-09-26 read src/types/inventory.ts and low-stock route: minimum_stock already exists in metadata; the current reader is run-out-days based. Earlier guide's mandatory-new-column claim is corrected.",
  "checks": [],
  "ownerReviewed": false
}
```

### KIT-7

**Outcome:** Meal Planning.

- **Acceptance:** Meal Planning → Schedule (planned meals on the calendar/today views).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Planned meals on the calendar and today views — a Meal Planning → Schedule bridge, so read both vault docs first (`ERA Notes/03 - Junction Modules/Meal Planning/` and `ERA Notes/02 - Standalone Modules/Items & Reminders/`) and remember a standalone feature dir cannot import another's; shared code goes in `src/components/` or `src/lib/`. Sources: `src/app/api/meal-plans/route.ts` + `src/features/meal-planning/hooks.ts` (note the 14-day leftover window in its comment); destinations: `src/app/reminders/` and the dashboard/today surfaces. Do not materialize meals as `items` rows — display them, or you create a fourth thing to keep in sync. KIT-4 supplies the scoped coverage this should reuse.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Propose `tests/meal-schedule-display.test.tsx` once the UI harness is confirmed. Cover leftover overlap, shared/person-only/skipped rows, unavailable reads and date/DST boundaries; prove zero Items writes. Check calendar and live today/planner at 390×844; typecheck/lint.

**Scope notes:** Proposed paths: `src/components/shared/MealPlanSummary.tsx`, `tests/meal-schedule-display.test.tsx`.

```delivery-plan-v1
{
  "outcome": "Display planned meals in existing calendar and today surfaces using the same Kitchen coverage facts.",
  "acceptance": [
    "Meals and leftovers appear on their applicable local days and for the intended person.",
    "Schedule surfaces distinguish unavailable meal data from an empty plan and open the owning meal/recipe detail.",
    "Meals remain Meal Planning records; no duplicate Items or recurrence engine is created."
  ],
  "scope": [
    "src/components/web/WebCalendar.tsx",
    "src/components/web/WebTodayView.tsx",
    "src/components/planner/WebDayPlanner.tsx",
    "src/components/shared/MealPlanSummary.tsx",
    "tests/meal-schedule-display.test.tsx"
  ],
  "steps": [
    "Revalidate which calendar/today components are actually mounted; use KIT-4's completed overlap/person/status contract rather than copying its date expansion.",
    "Introduce the proposed compact shared meal summary only where needed, using existing meal query keys and scoped readers.",
    "Render visible planned/cooked/skipped distinctions without counting skipped rows as meal coverage; preserve person-absolute colors.",
    "Link single-tap details to the current Meal Planning owner and test mutation refresh through its existing invalidation contract.",
    "Verify all agreed calendar/today surfaces; one surface alone does not complete the integration."
  ],
  "invariants": [
    "Display reads do not create schedule occurrences, alerts or stock deductions.",
    "Standalone feature directories do not import each other's internals; integration stays in shared/component surfaces."
  ],
  "exclusions": [
    "Calendar redesign, meal execution controls, new notification delivery and a new planner."
  ],
  "risks": [
    "Adding a summary to a legacy unmounted view can pass component tests while shipping no visible change."
  ],
  "unknowns": [
    "Current mounted surface list and existing component-test harness; freeze before dispatch."
  ],
  "dependencies": [
    "KIT-4"
  ],
  "risk": "medium",
  "provenance": "2026-09-26 mapped Schedule and Meal Planning entry points, with no current meal imports found in the three named surfaces. Shared summary/test paths are proposed; reread mount paths before implementation.",
  "checks": [],
  "ownerReviewed": false
}
```

### KIT-8

**Outcome:** Barcode.

- **Acceptance:** Barcode → catalogue price for cost tracking.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide (revalidated 2026-09-26):** `src/app/api/inventory/barcode/[barcode]/route.ts` already looks up an owner-scoped `catalogue_items.metadata_json.barcode`; it does not fetch a price. `InventoryItemMetadata` has no typed purchase-price contract, while Catalogue has other price-like fields whose meaning must be checked before reuse. This is a parked source/price-basis investigation, not permission to choose an external API or add a new product store. Coordinate the minimum useful price contract with KIT-3 and preserve explicit currency/pack/unit provenance.

**Execution plan — 2026-09-26**

**Readiness:** investigation first.

**Verify:** Use fixture barcodes for exact match, no match, duplicate local match and differing pack sizes/currencies. Compare read/write scope and provenance requirements; no external lookup or provider installation. Run PM checks on the resulting bounded brief.

```delivery-plan-v1
{
  "outcome": "Choose the smallest barcode-to-price workflow that fits existing Catalogue identity and cost tracking.",
  "acceptance": [
    "Identify whether the owner wants manual saved prices, an approved external lookup or both.",
    "A price has a source, observation date, currency and pack/unit meaning; unknown price is not zero.",
    "Barcode lookup preserves existing record identity and cannot silently overwrite stock policy or trusted prices."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/Kitchen/Kitchen — Master Book.md"
  ],
  "steps": [
    "Read the existing barcode route and useItemByBarcode; it already performs an owner-scoped catalogue_items metadata lookup.",
    "Inventory existing price-like metadata and clarify what KIT-3 needs; do not assume a display range is a grocery unit price.",
    "Ask the owner to choose the price acquisition/refresh policy before evaluating any external service; record provider access/cost/privacy constraints if external lookup is desired.",
    "Write the minimal proposed data/confirmation contract and fixture matrix, including barcode collisions, currency and pack-size changes; retain manual entry as the fallback."
  ],
  "invariants": [
    "A barcode identifies a product candidate, not a universal current price or stock quantity.",
    "No external provider is adopted and no automatic price write is authorized by this plan."
  ],
  "exclusions": [
    "Scanner rebuild, purchase automation, new product taxonomy and mandatory dependency from KIT-3 to an external API."
  ],
  "risks": [
    "The same product code can have different local prices and package representations."
  ],
  "unknowns": [
    "Price source, refresh cadence, collision behavior and whether household lookup is intended."
  ],
  "dependencies": [
    "KIT-24 field ownership",
    "Budget/KIT-3 price-basis agreement"
  ],
  "risk": "medium",
  "provenance": "2026-09-26 read inventory/barcode/[barcode]/route.ts and Inventory/Catalogue metadata. Existing local lookup is source-present; a usable price contract and external provider remain unadopted.",
  "checks": [],
  "ownerReviewed": false
}
```

### KIT-12

**Outcome:** Restore cooking and restock changes with real Undo.

- **Acceptance:** Replace cache-only undo with checked domain inverses for cooking/restock. Verify membership/stock/history, repeat/retry and partial failure; coordinate KIT-2 atomic deduction.
- **Depends on:** [KIT-2](<Kitchen — Master Book.md#kit-2>).

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide (revalidated 2026-09-26):** Both `useRestockItem()` in `src/features/inventory/hooks.ts` and `useCreateCookingLog()` in `src/features/recipes/hooks.ts` currently give Undo callbacks that only invalidate queries. The persisted effects therefore remain. Coordinate the actual receipt/inverse boundaries with KIT-1's atomic restock and KIT-2's cooking/stock command; do not copy another domain's inverse without its ownership and later-edit checks. Cover stock/history/log identity, repeat/retry, response loss and partial failure. The dormant useUpdateStock path remains KIT-14.

**Execution plan — 2026-09-26**

**Readiness:** split first.

**Verify:** Propose `tests/kitchen-undo.test.ts`; verify real persisted stock/history/log inverse, repeated Undo, response loss, foreign owner, later edit and rollback on partial failure. Owner isolated SQL fixtures prove atomicity; invalidation alone cannot pass.

**Scope notes:** Proposed paths: `tests/kitchen-undo.test.ts`. `migrations/` is a preliminary boundary; name the exact paired migration after current schema review. Owner application remains separate.

```delivery-plan-v1
{
  "outcome": "Make cooking and restock Undo reverse their actual domain effects without damaging later operations.",
  "acceptance": [
    "Cooking and restock mutations return an identity for the accepted operation and a checked domain inverse.",
    "Undo restores the correct stock/history/log relationships atomically and truthfully handles repeat/conflict/failure.",
    "All displayed consumers refresh from the committed result; cache-only invalidation never counts as undo."
  ],
  "scope": [
    "src/features/inventory/hooks.ts",
    "src/features/recipes/hooks.ts",
    "src/app/api/inventory/restock/route.ts",
    "src/app/api/recipes/[id]/cooking-log/route.ts",
    "migrations/",
    "migrations/schema.sql",
    "tests/kitchen-undo.test.ts"
  ],
  "steps": [
    "Coordinate KIT-2's cooking receipt/inverse and KIT-1's atomic restock boundary; first freeze the exact before/post-state and history retention rules for each action.",
    "Deliver one bounded restock inverse slice, then the cooking/consumption inverse through the same accepted owner commands; do not invent a competing receipt system.",
    "Author only required paired manual migrations with authenticated ownership, locking and checked affected rows; later independent stock changes must remain intact.",
    "Replace current cache-only Undo callbacks with safeFetch calls to those inverses and invalidate recipe/stock/history/shopping consumers after the authoritative result.",
    "Verify both slices including failure and replay before completing KIT-12; owner SQL application and phone acceptance stay separate."
  ],
  "invariants": [
    "Undo targets an operation, not today's total stock or an arbitrary cached snapshot.",
    "No automatic retry of a partially applied inverse."
  ],
  "exclusions": [
    "Shopping-list Undo redesign, receipt framework for unrelated modules and automatic historical repair."
  ],
  "risks": [
    "Deleting a cooking log without reversing its stock event, or restoring stock without its history, creates silent drift."
  ],
  "unknowns": [
    "Exact inverse/event retention policy supplied by KIT-1/2; current deployed transaction seams."
  ],
  "dependencies": [
    "KIT-2",
    "KIT-1 atomic restock slice"
  ],
  "risk": "high",
  "provenance": "2026-09-26 verified useRestockItem Undo only invalidates queries. Receipt/migration and test work is proposed; existing cached rollback is not a production inverse witness.",
  "checks": [],
  "ownerReviewed": false
}
```

### KIT-13

**Outcome:** Separate estimated and measured cooking values.

- **Acceptance:** Duration/difficulty defaults and prefilled values must not be presented as measured actuals. Preserve basis at write/read boundaries and use only observed values for calibration.

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide (revalidated 2026-09-26):** `src/components/web/RecipeCookingMode.tsx` initializes actual prep/cook feedback from recipe estimates and difficulty from `recipe.difficulty`, then submits them as feedback. `cooking_logs` stores those values without basis, and `src/app/api/recipes/[id]/optimize/route.ts` renders them as `Actual prep`/`Actual cook` in model context. Fix this entire write/read chain, including `src/types/recipe.ts` and the hooks, rather than only the form. Keep legacy ambiguity unknown; preserve zero separately from missing and leave KIT-11's count behavior intact.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Propose `tests/cooking-value-basis.test.ts`: untouched prefill, edited self-report, observed timer, genuine zero, missing/legacy unknown and mixed-basis logs. Verify optimize prompt excludes estimated/unknown values from actual calibration; typecheck/lint; owner migration separately.

**Scope notes:** Proposed paths: `tests/cooking-value-basis.test.ts`. `migrations/` is a preliminary boundary; name the exact paired migration after current schema review. Owner application remains separate.

```delivery-plan-v1
{
  "outcome": "Keep recipe estimates and observed cooking feedback distinguishable through storage and learning.",
  "acceptance": [
    "Untouched duration/difficulty defaults are not stored or presented as observed actuals.",
    "Each supplied value retains its explicit basis; legacy ambiguous records remain unknown.",
    "Optimization/calibration reads use only eligible observed values and do not relabel estimates as measurements."
  ],
  "scope": [
    "src/components/web/RecipeCookingMode.tsx",
    "src/features/recipes/hooks.ts",
    "src/types/recipe.ts",
    "src/app/api/recipes/[id]/cooking-log/route.ts",
    "src/app/api/recipes/[id]/optimize/route.ts",
    "migrations/",
    "migrations/schema.sql",
    "tests/cooking-value-basis.test.ts"
  ],
  "steps": [
    "Trace prefill→submit→cooking_logs→optimization context; choose the smallest per-field basis contract covering observed/self-reported, estimated and unknown values.",
    "Track whether feedback is explicitly confirmed or measured; preserve a legitimate zero separately from missing and retain the quick completion flow.",
    "Validate basis with values at the write boundary; author a paired additive migration only if persistence needs it, leaving legacy basis unknown rather than guessing.",
    "Filter/label the existing optimization history and relevant read displays so only observed inputs calibrate actual duration/difficulty.",
    "Test the full write/read path and preserve KIT-11's cooking-count behavior unchanged."
  ],
  "invariants": [
    "Recipe defaults remain estimates even when the user presses Done without changing them.",
    "No synthetic backfill can turn historical values into measured evidence."
  ],
  "exclusions": [
    "Changing recipe rating/count statistics, adding timers/telemetry and stock-consumption logic."
  ],
  "risks": [
    "Fixing the form alone leaves old ambiguous logs feeding 'Actual prep/cook' into the model."
  ],
  "unknowns": [
    "Final minimal persisted basis representation and whether explicit confirmation counts as observed self-report."
  ],
  "dependencies": [],
  "risk": "medium",
  "provenance": "2026-09-26 read RecipeCookingMode prefills, cooking_logs schema and optimize route's Actual prep/cook prompt construction. The source issue is demonstrated; no stored logs were inspected.",
  "checks": [],
  "ownerReviewed": false
}
```

### KIT-14

**Outcome:** Revalidate the dormant stock-update ID path.

- **Acceptance:** Determine whether useUpdateStock has any live caller; repair the documented wrong ID if reachable, otherwise retire with source evidence. A dormant hook is not a proven production incident.

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide (revalidated 2026-09-26):** A TypeScript-only search finds useUpdateStock only at its definition in `src/features/inventory/hooks.ts`; generated graph caches contain strings but are not callers. The helper currently places `stock_id` in `/api/inventory/stock/${stock_id}`, whose route is keyed by itemId. Recheck reachability before taking the bounded retirement branch; if a live caller has appeared, inspect its identity contract and update the reviewed scope before repair. No production incident is established by unused code.

**Execution plan — 2026-09-26**

**Readiness:** investigation first.

**Verify:** Re-run `rg -n 'useUpdateStock|updateStock' src -g '*.ts' -g '*.tsx' -g '!**/graphify-out/**'`; inspect route item_id predicates. After a bounded removal/fix, typecheck and lint the changed files; add behavior tests only if a live caller exists.

```delivery-plan-v1
{
  "outcome": "Resolve the dormant stock-update ID mismatch using current reachability evidence.",
  "acceptance": [
    "Document whether useUpdateStock has any live importer/caller rather than treating its presence as an incident.",
    "If unused, remove only the obsolete hook/helper and dead type usage; if reachable, pass the route's expected item identity.",
    "Existing restock and direct stock-route behavior remain unchanged."
  ],
  "scope": [
    "src/features/inventory/hooks.ts",
    "src/types/inventory.ts"
  ],
  "steps": [
    "Search executable TypeScript callers and exports, excluding generated graph caches; read updateStock and inventory/stock/[itemId] before editing.",
    "If the hook remains unused, retire it and its now-unused helper/type imports after confirming no public dynamic consumer.",
    "If a live caller appeared, freeze that caller's scope and repair the stock_id-versus-item_id contract before exposing it; add the caller path to the reviewed scope.",
    "Run typecheck/lint and document which branch was taken with exact source evidence; do not label dormant code a production outage."
  ],
  "invariants": [
    "No hook is made reachable merely to justify repairing it.",
    "No stock row or identifier is rekeyed; route identity remains explicit."
  ],
  "exclusions": [
    "Restock redesign, stock data migration, broad hook cleanup and live DB verification."
  ],
  "risks": [
    "Generated graph caches contain symbol strings and can falsely look like callers; search source files only."
  ],
  "unknowns": [
    "Recheck reachability immediately before dispatch because a new caller would change the branch."
  ],
  "dependencies": [],
  "risk": "low",
  "provenance": "2026-09-26 source search found only the hook definition; updateStock sends stock_id to the itemId URL. This revalidates the historical finding without proving runtime harm.",
  "checks": [],
  "ownerReviewed": false
}
```

### KIT-15

**Outcome:** Cover recipe AI and scaling boundaries.

- **Acceptance:** Test malformed ingredient/scale payloads, fallback/rate errors and explicit long-call timeouts using fixtures. Unknown conversions remain unknown; no invented allergen safety.
- **Depends on:** [KIT-10](<Kitchen — Master Book.md#kit-10>).

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide (revalidated 2026-09-26):** KIT-10 owns the four persistence boundaries; this item covers the response-only/AI/scaling edges around extraction, generation, optimization, substitution and scaling. Reuse its schemas and read the concrete callers in `src/features/recipes/hooks.ts`, where the current AI safeFetch calls lack explicit timeout overrides. Read current `safeFetch.ts` and Gemini quota/error types before assertions; use mocked provider responses and transport failures, never live AI calls. Unknown conversion and allergen state must remain unknown.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Create `tests/recipe-ai-boundaries.test.ts`; combine with the proposed KIT-10 suite and existing allergen matcher tests. Mock model/transport only: malformed JSON/rows, scale extremes, unsupported units, primary/fallback quotas, latency timeout and abort versus confirmed offline. Typecheck/lint.

**Scope notes:** Proposed paths: `tests/recipe-ai-boundaries.test.ts`.

```delivery-plan-v1
{
  "outcome": "Verify recipe AI and scaling boundaries without trusting model output or breaking slow-call connectivity.",
  "acceptance": [
    "Extraction, generation, optimization, scaling and substitution reject invalid responses through the shared ingredient/step contract where applicable.",
    "Unknown conversions remain unknown; malformed content cannot become an apparently valid or clinically safe recipe.",
    "AI callers use explicit long timeouts and preserve existing fallback/quota and genuine-offline behavior."
  ],
  "scope": [
    "src/app/api/recipes/extract-from-url/route.ts",
    "src/app/api/recipes/[id]/generate/route.ts",
    "src/app/api/recipes/[id]/optimize/route.ts",
    "src/app/api/recipes/[id]/scale/route.ts",
    "src/app/api/recipes/[id]/substitute/route.ts",
    "src/features/recipes/hooks.ts",
    "tests/recipe-ai-boundaries.test.ts"
  ],
  "steps": [
    "After KIT-10, enumerate the five response boundaries and their exact client callers; reuse shared schemas without duplicating storage validation.",
    "Add failing fixtures for malformed JSON, ingredient/step shapes, unsupported scale conversions and excessive/invalid input; preserve valid optional metadata.",
    "Verify primary/fallback and daily/per-minute quota responses with mocked provider errors; repair only demonstrated boundary defects.",
    "Add explicit long-call safeFetch timeouts at uncovered callers and assert timeout/abort cannot enqueue a duplicate mutation or mark connectivity lost by themselves.",
    "Run the combined boundary corpus and record unknown conversions as such; no live provider or medical inference is involved."
  ],
  "invariants": [
    "AI output is untrusted at both response and persistence boundaries.",
    "Zero test calls reach a real model or external recipe site."
  ],
  "exclusions": [
    "New model selection, prompt overhaul, shared connectivity redesign and automatic unit conversion."
  ],
  "risks": [
    "The recipe hooks currently contain AI safeFetch calls without visible timeout overrides; tests must exercise the caller, not only mocked routes."
  ],
  "unknowns": [
    "Revalidate current timeout defaults and existing error classes before assertions."
  ],
  "dependencies": [
    "KIT-10"
  ],
  "risk": "medium",
  "provenance": "2026-09-26 scoped review of recipe AI routes/hooks and existing Gemini fallback types. Named fixture suite is proposed; no tests or external calls ran during planning.",
  "checks": [],
  "ownerReviewed": false
}
```

### KIT-23

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C13. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Promote recipe clippings into one executable recipe.

- **Acceptance:** Catalogue C13: explicit promotion creates/links one Kitchen recipe with provenance and validated ingredients; repeated activation does not clone masters or overwrite later edits.
- **Depends on:** [KIT-10](<Kitchen — Master Book.md#kit-10>), [KIT-20](<Kitchen — Master Book.md#kit-20>).

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Follow accepted Catalogue C13 and §10.7: the clipping owns its proposed promoted_recipe_id/source-revision pointer; the earlier Items promotion route is a precedent, not the same recipe relation. Validate through KIT-10, guard pointer/replay through KIT-20/21 and use C10 authorized lookup. Explicitly choose import versus link and destination audience because existing recipe POST defaults can household-share. Same request and canonical input returns its established result; conflicting reuse is a conflict. Keep raw clipping material but only one executable Kitchen editor, including target delete/restore.

**Execution plan — 2026-09-26**

**Readiness:** implementation draft.

**Verify:** Propose `tests/catalogue-recipe-promotion.test.ts`: structured/free-text preview, malformed input, chosen audience, link-existing, retry/response loss, later Kitchen edit and source/destination delete-restore. Assert unchanged cooking/meal/stock counts; owner atomic/FK fixture separately.

**Scope notes:** Proposed paths: `tests/catalogue-recipe-promotion.test.ts`. `migrations/` is a preliminary boundary; name the exact paired migration after current schema review. Owner application remains separate.

```delivery-plan-v1
{
  "outcome": "Explicitly import or link a recipe clipping to one Kitchen master while preserving source material.",
  "acceptance": [
    "Promotion validates ingredient/step payloads and creates or links one authorized recipe with source revision and request identity.",
    "Repeated import returns the established result; later Kitchen edits are never overwritten by source refresh.",
    "The library opens the Kitchen editor while raw clipping/source remains inspectable and cannot act as a second executable recipe."
  ],
  "scope": [
    "src/components/web/CatalogueItemDialog.tsx",
    "src/components/web/CatalogueItemDetailDialog.tsx",
    "src/components/web/RecipeDialog.tsx",
    "src/app/api/catalogue/",
    "src/app/api/recipes/",
    "src/types/catalogue.ts",
    "src/types/recipe.ts",
    "migrations/",
    "migrations/schema.sql",
    "tests/catalogue-recipe-promotion.test.ts"
  ],
  "steps": [
    "Read accepted C13 and current C10 lookup; define explicit import-versus-link with selected source revision and destination audience.",
    "Reuse KIT-10 validation and KIT-20/21 revision/lifecycle guards; add the smallest checked junction command and paired manual migration for pointer/request identity.",
    "Create or link atomically, preserving raw source and existing recipe/version IDs; same request/input returns its established result, conflicting input returns conflict.",
    "Route promoted cards to Kitchen and prevent a deleted/restored target from re-enabling a shadow executable clipping editor.",
    "Verify privacy, replay and lifecycle fixtures plus zero cooking/meal/stock effects; one successful create alone is insufficient."
  ],
  "invariants": [
    "Existing recipe POST's automatic household sharing must not override explicit promotion audience.",
    "Promotion creates no meal, cooking log or stock deduction."
  ],
  "exclusions": [
    "Recipe scraping provider, bidirectional content synchronization and rekeying existing masters."
  ],
  "risks": [
    "Deleting the promotion pointer on target deletion can silently recreate a duplicate recipe later."
  ],
  "unknowns": [
    "Current receipt/lookup interfaces and owner migration state; tighten endpoint filenames after reading delivered dependencies."
  ],
  "dependencies": [
    "KIT-10",
    "KIT-20",
    "KIT-21",
    "Catalogue C10 authorized lookup"
  ],
  "risk": "high",
  "provenance": "2026-09-26 accepted Catalogue C13/§10.7 reviewed. This retains its fuller lifecycle/audience contract beyond the shorter acceptance line; new command, migration and tests are proposed.",
  "checks": [],
  "ownerReviewed": false
}
```

## Backlog reconciliation

- 2026-09-10 — **KIT-9** → TRIP-7. Scope is retained in the destination criteria; duplicate removed, not shipped.

## Shipped Log

- ✅ 2026-07-18 — inbound Healthcare bridge landed in recipe views (`RecipeAllergenWarning.tsx` consuming `useHouseholdAllergens`) — Kitchen gained a junction without gaining a commit
- ✅ 2026-09-26 — **KIT-11** Return the correct cooking count — [criteria](<Kitchen — Master Book.md#kit-11>)

## Delivery session log

- 2026-09-26 — **KIT-11** V2 run `r-fa5c81702ec7` · applied; integrated checks passed · codex gpt-5.6-luna <!-- v2-apply:app-d34c1586e1d3@applied -->
- 2026-09-26 — **KIT-11** V2 run `r-fa5c81702ec7` · rolled back; candidate still available · codex gpt-5.6-luna <!-- v2-apply:app-bbf1a8c1e241@rolled-back -->
- 2026-09-26 — **KIT-11** V2 run `r-fa5c81702ec7` · applied; integrated checks passed · codex gpt-5.6-luna <!-- v2-apply:app-bbf1a8c1e241@applied -->
- 2026-09-26 — **KIT-11** V2 run `r-fa5c81702ec7` · not applied; checks fail on current source · codex gpt-5.6-luna <!-- v2-apply:app-a99ce06c1b91@reassessment-failed -->
- 2026-09-26 — **KIT-11** V2 run `r-fa5c81702ec7` · candidate verified; not applied · codex gpt-5.6-luna <!-- v2:res-51697160b6fe@1 -->
_(Delivery runner appends dated progress bullets here automatically.)_

- 2026-09-26 — **KIT-11** V2 run `r-54d5cf10d995` · candidate verified; not applied · codex gpt-5.6-luna <!-- v2:res-3710e8238bc2@2 -->
- 2026-09-26 — **KIT-11** V2 run `r-54d5cf10d995` · not verified (criterion, disposition) · codex gpt-5.6-luna <!-- v2:res-3710e8238bc2@1 -->

## Successor Briefing

Read the checklist, the selected acceptance entry and its dependencies; then use the [Feature Map](<../../01 - Architecture/Feature Map/_index.md>) for source routing and the module architecture docs for invariants. Delta from the source cutoff before implementation. Use current owner-supplied DB evidence for access/application questions; agents never apply production SQL. Record code, applied migration and device/runtime acceptance separately.

Finish with the repository playbook and [governance](../_Conventions.md): update acceptance/evidence, sweep only completed work, and validate the canonical queue. A completed child does not complete its coordination parent.
