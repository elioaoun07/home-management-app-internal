---
created: 2026-09-10
updated: 2026-09-10
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

### KIT-10

**Outcome:** Validate ingredient payloads at every writer.

- **Acceptance:** ASTRA-KIT-3: enforce one ingredient schema across all four documented writers, validate external/AI values before storage and preserve unknown ingredient/allergy state. Reverify the current producer inventory.

**Retained contract — ASTRA-KIT-3:**

- **Outcome:** Invalid ingredient objects are rejected before they can corrupt recipe storage or its existing warning consumer.
- **Boundary:** One installed-Zod ingredient/step schema, with types derived where touched. Nonempty string name and existing string quantity/unit conventions, optional notes/section/optional preserved; do not guess numeric units or strip malformed ingredient rows into an apparently complete recipe. Validate at the four named persistence boundaries before writes; PATCH validates supplied fields without replacing omitted arrays. Model-generated data passes the same validation. External extraction/optimization/scale/substitution response validation is retained follow-up scope; storage validation catches their accepted payloads here. No medical keyword edits or new AI call.
- **Money/schedule math?:** No. Ingredient quantity remains source text; no stock or nutrition computation.
- **Gate:** `pnpm exec vitest run tests/recipe-ingredient-contract.test.ts src/lib/health/allergenMatch.test.ts --reporter=verbose` → nonzero cases pass: valid ingredient with optional metadata reaches the existing matcher; null/nonstring name and malformed arrays produce zero DB writes; partial PATCH preserves omitted fields; invalid model data cannot overwrite a recipe. Common gates pass.

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Reverify the producer inventory first — the documented "four writers" undercounts. Verified 2026-09-20, ten routes touch ingredients and **none of them imports zod**: `src/app/api/recipes/route.ts`, `recipes/[id]/route.ts`, `recipes/extract-from-url/route.ts`, `recipes/[id]/generate|optimize|scale|substitute|versions/route.ts`, plus `src/app/api/meal-plans/add-to-shopping/route.ts` and `src/app/api/guest-portal/bot/route.ts`. That is a Hard Rule #12 gap on every one. Define the schema once (a shared module under `src/types/` or `src/lib/`, derived with `z.infer<>`) and import it at each writer; the pattern is `.claude/skills/api-route/SKILL.md` with `src/app/api/accounts/route.ts` as the canonical route. The AI-sourced writers (`extract-from-url`, `generate`, `substitute`) are the ones the acceptance means by "external/AI values". "Preserve unknown ingredient/allergy state" ties to HLTH-21 — an unparseable ingredient must stay unknown, never become empty, because `matchRecipeIngredients()` in `src/lib/health/allergenMatch.ts` is the downstream consumer.

### KIT-4

**Outcome:** Expose scoped meal coverage to ERA.

- **Acceptance:** Verify person, status and leftover interval coverage and distinguish unavailable from no planned meal. Chef already reads meal data; reuse that path. Complete the consumer adapter before HUB-45/HUB-56; a pure helper alone does not complete the meal surface.

**Retained contract — ASTRA-KIT-2:**

- **Outcome:** A meal's leftovers, status and intended person contribute consistently to calendar and ERA coverage.
- **Boundary:** Extract existing date expansion into a pure shared contract rather than introducing a competing expansion engine. Separate display membership from edible/planned coverage: skipped rows can stay visible but do not cover a meal; person-specific meals only cover that person, shared meals both. Use date-only local calendar semantics. Fetch actual interval overlap, replacing the arbitrary 14-day lookback and date-only origin read; keep existing auth/household filter. ERA's existing all-day gap remains an all-day gap, not an assertion all meal slots are filled. Preserve per-slot facts for E-08/E-22. Failed retrieval is unavailable, not zero meals. Do not create Items or change calendar layout.
- **Money/schedule math?:** Yes, calendar coverage: cooked Sep4, eats-through Sep7 → Sep6 covered; same row skipped → uncovered; partner-only → owner uncovered/partner covered. No extra schedule occurrences or stock deduction.
- **Gate:** `pnpm exec vitest run tests/meal-plan-coverage.test.ts src/features/era/intents/resolveIntent.test.ts --reporter=verbose` → nonzero cases pass for leftovers crossing query boundary, >14-day interval, status, person, leap/month boundary and Beirut DST. Mock route retrieval proves overlap without omitted older rows; empty complete versus failure differ. Common gates; 390×844 calendar capture preserves layout.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** "Chef already reads meal data; reuse that path" is the instruction — find it before writing a helper. The AI context assembler is `src/lib/ai/context.ts`; read what it currently pulls for meals, then widen it rather than adding a parallel reader. Data side: `src/app/api/meal-plans/route.ts` and `src/features/meal-planning/hooks.ts`, whose window comment already notes it extends the range by 14 days to catch leftovers — that interval is the leftover-coverage logic you must not duplicate. Calendar surface: `src/components/web/WebMealPlanCalendar.tsx`. The distinguishing requirement matches HLTH-21's: unavailable must not read as "no planned meal", so carry query status through the adapter rather than defaulting to an empty array. A pure helper alone does not complete this; the consumer adapter must land before HUB-45/HUB-56.

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

### KIT-2

- **Retained campaign gate (D3):** After the actual loop/lifecycle witnesses pass, update the Master Book state and shipped evidence; documentation alone does not close this gate.

- **Retained campaign gate (D2):** Completing a recipe in cooking mode deducts its ingredients from inventory.

**Outcome:** Deduct mapped ingredients when cooking completes.

- **Acceptance:** DEC-17 must settle ingredient↔stock mapping and unit conversion. Unknown mappings/units produce no invented deduction. Cooking confirmation, stock delta and a real Undo inverse are atomic/idempotent, including failure and replay; preserve the owner confirmation choice.

- **Acceptance:** completing a recipe in cooking mode deducts its ingredients from inventory, and that deduction can trigger KIT-1.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Blocked on DEC-17 (ingredient↔stock mapping and unit conversion); no mapping table exists to guess from. The two ends are `src/app/api/recipes/[id]/cooking-log/route.ts` (cooking completion) and `src/app/api/inventory/restock/route.ts` / `inventory/stock/[itemId]/route.ts` (stock delta), with `src/features/inventory/hooks.ts` on the client. "Unknown mappings/units produce no invented deduction" is the safety rule — the same unknown-stays-unknown discipline as KIT-10 and KIT-15. Atomic and idempotent across confirmation, delta and inverse means a SECURITY DEFINER RPC rather than sequential PostgREST calls (`.claude/skills/db-migration/SKILL.md`; Hard Rules #24/#26). The Undo inverse is KIT-12's scope — coordinate, do not duplicate. Preserve the owner confirmation choice: this must not become a silent write.

### KIT-18

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C01a. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Authorize document signing through its owning record.

- **Acceptance:** Catalogue C01a: authorize each private document via its source record before signing; reject arbitrary storage paths and cross-user access. Preserve valid shared-record access.
- **Depends on:** [HUB-62](<../Hub & ERA/Hub & ERA — Master Book.md#hub-62>).

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Catalogue C01a, and the hole is visible: `src/app/api/catalogue/document-image/signed-url/route.ts` takes a raw `?path=` query parameter, splits it on `/`, and authorizes by comparing the first segment against `household_links` before calling `.storage.from("documents").createSignedUrl(...)`. Authorization is therefore by path string, not by the owning record — which is exactly what "reject arbitrary storage paths" means. Fix by resolving the document's source row first (`src/app/api/catalogue/items/[id]/document-image/route.ts` is where the record↔file relation lives) and signing only what that row permits. Household expansion follows Hard Rule #13 (`src/app/api/accounts/route.ts` is the reference). Preserve valid shared-record access — this is a narrowing, not a lockout. Depends on HUB-62; KIT-19 and KIT-21 build on it.

### KIT-19

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C01b. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Preserve old document files through replacement and Undo.

- **Acceptance:** Catalogue C01b: replacement cannot delete the prior binary before commit/Undo eligibility; define cleanup after reference checks and test failed replacement and inverse.
- **Depends on:** [KIT-18](<Kitchen — Master Book.md#kit-18>).

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Catalogue C01b, depends on KIT-18. The replacement path is `src/app/api/catalogue/items/[id]/document-image/route.ts` — read what it does with the previous storage object before writing the new one; the failure mode is deleting the old binary before the new write commits or before Undo can still need it. Compare with the equivalent problem already solved in Outfits (`src/app/api/outfits/items/[id]/route.ts` DELETE also does storage cleanup) and with `src/features/recycle-bin/` for the app's retention model. Cleanup after reference checks means KIT-21's tombstone contract has to exist conceptually first, even though KIT-21 depends on this. Test the failed replacement and the inverse.

### KIT-20

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C02. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Patch catalogue metadata with revision checks.

- **Acceptance:** Catalogue C02: validate typed partial updates, preserve unrelated metadata and use revision preconditions for stale writes. Safe create/edit foundation precedes promotions and corrections.
- **Depends on:** [KIT-18](<Kitchen — Master Book.md#kit-18>).

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Catalogue C02, and it gates KIT-21/22/24, HLTH-23 and TRIP-33 — so it is the foundation item. The defect is concrete: `src/app/api/catalogue/items/[id]/route.ts` PATCH assigns `updates.metadata_json = body.metadata_json` wholesale, with no zod import in the file and no revision precondition. That means an untyped partial write clobbers unrelated metadata, and two concurrent edits silently last-write-wins. The typed metadata interfaces already exist in `src/types/catalogue.ts` (`DocumentItemMetadata` and siblings) — derive the Zod schemas from them so the two cannot drift, per Hard Rule #12. A revision precondition needs a column and a conditional update (Hard Rules #24/#26); a stale write should surface as a conflict, not a 500. Client mutation: `useUpdateItem()` in `src/features/catalogue/hooks.ts`.

### KIT-21

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C03. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Preserve catalogue identity through delete and restore.

- **Acceptance:** Catalogue C03: tombstone/restore preserve ID and backlinks; purge only after the retained-reference contract permits it. Exercise failed and repeated inverse operations.
- **Depends on:** [KIT-19](<Kitchen — Master Book.md#kit-19>), [KIT-20](<Kitchen — Master Book.md#kit-20>).

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Catalogue C03, depends on KIT-19 and KIT-20. Tombstone/restore preserving the ID is the crux — today `src/app/api/catalogue/items/[id]/route.ts` DELETE and `src/app/api/catalogue/[id]/disable/route.ts` are the two existing exits, and `useDeleteItem()` in `src/features/catalogue/hooks.ts` is the client. Read both before choosing, and compare with `src/features/recycle-bin/` and `src/app/api/recycle-bin/`, which is the app's existing soft-delete-and-restore model — a third model would be the wrong outcome. Backlinks that must survive are `source_catalogue_item_id` on `items` (see `src/app/api/items/[id]/promote/route.ts`) and whatever TRIP-33/TRIP-10 add. "Purge only after the retained-reference contract permits it" means a reference check before hard delete — which is also KIT-19's file-retention question. Exercise failed and repeated inverses; Hard Rule #1 for the toast.

### KIT-22

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C09. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Browse and edit reference records.

- **Acceptance:** Catalogue C09: reference-only types get compact browsing/forms, typed metadata and permissions without execution controls. Keep executable masters in their owning modules.
- **Depends on:** [KIT-20](<Kitchen — Master Book.md#kit-20>).

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Catalogue C09, depends on KIT-20's typed-patch foundation. The distinction to hold: a reference-only type gets browsing and a form, but no execution controls — executable masters stay in their owning modules (a recipe is executed in Recipes, an item in Schedule). The category/type vocabulary is `src/types/catalogue.ts` (`CatalogueCategory` and its label/icon/colour maps); browsing is `src/app/catalogue/` with `src/features/catalogue/hooks.ts` (`useCatalogueModules`, `useCatalogueCategories`, `useCatalogueItems`, `useCatalogueItem`, `useCatalogueSubItems`). Compact forms and permissions are the deliverable; Hard Rules #5 (mobile-first), #15 (opaque floating panels) and #28 (no explanatory prose) all apply to the forms.

### KIT-24

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C17. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Keep catalogue metadata separate from stock ownership.

- **Acceptance:** Catalogue C17: descriptive reference edits cannot overwrite Inventory quantity, unit or history. Require an explicit owner transition for operational stock changes.
- **Depends on:** [KIT-20](<Kitchen — Master Book.md#kit-20>).

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Catalogue C17, depends on KIT-20, and it gates KIT-1. The invariant is an ownership boundary: a catalogue record is _descriptive_ metadata, an inventory row is _operational_ stock (quantity, unit, history). Today they are separate — catalogue writes go through `src/app/api/catalogue/items/[id]/route.ts`, stock through `src/app/api/inventory/items/route.ts`, `inventory/stock/[itemId]/route.ts`, `inventory/restock/route.ts` and `inventory/history/route.ts` — so the work is proving and enforcing that a catalogue edit cannot reach the second set, and defining the explicit owner transition when a reference becomes stocked. TRIP-10 needs the same distinction for its packing picker. `src/features/inventory/hooks.ts` and `src/features/catalogue/hooks.ts` are the two client sides.

### KIT-3

**Outcome:** Meal plan budget estimate (gap 2c).

- **Acceptance:** Meal plan budget estimate (gap 2c) — show estimated grocery cost per plan. Coordinate with [Budget — Master Book](<../Budget/Budget — Master Book.md>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on ingredient data being trustworthy (KIT-10) and on a price source — check whether one exists before designing: `src/types/catalogue.ts` and the inventory item shape are where a price would live, and KIT-8 (barcode → catalogue price) is the parked item that would supply it. Plan data is `src/app/api/meal-plans/route.ts` and `src/features/meal-planning/hooks.ts`; the estimate surfaces on `src/components/web/WebMealPlanCalendar.tsx`. It is money on screen, so `.claude/skills/money-rules/SKILL.md` applies — and an _estimate_ must be labelled as one at the read boundary, which is the same basis-preservation problem as KIT-13. Coordinate with the Budget campaign.

### KIT-5

**Outcome:** Pantry-aware recipe suggestions ("what can I make with what I have").

- **Acceptance:** Pantry-aware recipe suggestions ("what can I make with what I have").

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Needs the ingredient↔stock mapping that DEC-17 (KIT-2) settles; without it "what can I make" is keyword matching on free text, with the same false-confidence risk as allergen matching. Read `src/lib/health/allergenMatch.ts` for how this repo already does cautious ingredient text matching, then `src/features/inventory/hooks.ts` (`useInventoryItems`, `useInventoryStock`) and `src/app/api/recipes/route.ts` for the two data sets. Suggestions are advisory, never a guarantee.

### KIT-6

**Outcome:** Smarter per-item low-stock thresholds + restock cadence from usage history.

- **Acceptance:** Smarter per-item low-stock thresholds + restock cadence from usage history.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on usage history existing and being meaningful: `src/app/api/inventory/history/route.ts` and `useRestockHistory()` in `src/features/inventory/hooks.ts` are the source — check how many rows actually exist before fitting anything to them. The current threshold model is the `days` parameter on `useLowStockItems(days)` / `src/app/api/inventory/low-stock/route.ts`, which DEC-03 (KIT-1) is already deciding the shape of — settle that first so this does not become a third rule. Per-item thresholds mean a column on the inventory item (Hard Rules #24/#26).

### KIT-7

**Outcome:** Meal Planning.

- **Acceptance:** Meal Planning → Schedule (planned meals on the calendar/today views).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Planned meals on the calendar and today views — a Meal Planning → Schedule bridge, so read both vault docs first (`ERA Notes/03 - Junction Modules/Meal Planning/` and `ERA Notes/02 - Standalone Modules/Items & Reminders/`) and remember a standalone feature dir cannot import another's; shared code goes in `src/components/` or `src/lib/`. Sources: `src/app/api/meal-plans/route.ts` + `src/features/meal-planning/hooks.ts` (note the 14-day leftover window in its comment); destinations: `src/app/reminders/` and the dashboard/today surfaces. Do not materialize meals as `items` rows — display them, or you create a fourth thing to keep in sync. KIT-4 supplies the scoped coverage this should reuse.

### KIT-8

**Outcome:** Barcode.

- **Acceptance:** Barcode → catalogue price for cost tracking.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Parked. The read path already exists — `src/app/api/inventory/barcode/[barcode]/route.ts` and `useItemByBarcode()` in `src/features/inventory/hooks.ts` — so the missing half is a price on the catalogue record and an external lookup, neither of which exists. Deciding the price source (and whether an external barcode API is authorized at all) is the first step, not a detail. Feeds KIT-3.

### KIT-12

**Outcome:** Restore cooking and restock changes with real Undo.

- **Acceptance:** Replace cache-only undo with checked domain inverses for cooking/restock. Verify membership/stock/history, repeat/retry and partial failure; coordinate KIT-2 atomic deduction.
- **Depends on:** [KIT-2](<Kitchen — Master Book.md#kit-2>).

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on KIT-2. The acceptance's phrase "cache-only undo" is the diagnosis: check the mutation hooks in `src/features/inventory/hooks.ts` (`useRestockItem`, `useUpdateStock`) and the cooking path around `src/app/api/recipes/[id]/cooking-log/route.ts` for toasts whose Undo rolls back the TanStack cache rather than issuing a real inverse write. Hard Rule #1 requires the Undo button; this item requires it to mean something. The model to copy is `src/components/notifications/CriticalAlertGate.tsx`, which does a checked domain inverse. What must be verified on inverse: membership, stock quantity and the history row — so the inverse has to be atomic with KIT-2's deduction, not a second best-effort call. Cover repeat, retry and partial failure.

### KIT-13

**Outcome:** Separate estimated and measured cooking values.

- **Acceptance:** Duration/difficulty defaults and prefilled values must not be presented as measured actuals. Preserve basis at write/read boundaries and use only observed values for calibration.

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** A provenance problem, not a UI one: defaults and prefilled durations/difficulties are currently indistinguishable from measured actuals once written. Read the write boundary — `src/app/api/recipes/[id]/cooking-log/route.ts` — and the recipe fields it updates (`times_cooked`, `last_cooked_at`, `average_rating`, and the duration/difficulty columns in `migrations/schema.sql`). The fix is to carry a basis flag from write through read so calibration uses only observed values; that is the same estimate-versus-measured separation Delivery made for token counters and KIT-3 needs for cost. Prefill sites: the cooking-mode UI under `src/features/recipes/` and `src/app/recipe/`.

### KIT-14

**Outcome:** Revalidate the dormant stock-update ID path.

- **Acceptance:** Determine whether useUpdateStock has any live caller; repair the documented wrong ID if reachable, otherwise retire with source evidence. A dormant hook is not a proven production incident.

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Answer the question before repairing anything. Verified 2026-09-20: `useUpdateStock()` at `src/features/inventory/hooks.ts:245` has **no caller anywhere in `src/`** — its only occurrence is its own definition. So the documented wrong-ID bug is unreachable, and the acceptance's own words apply: a dormant hook is not a proven production incident. The live stock writers are `useRestockItem()` in the same file over `src/app/api/inventory/restock/route.ts`, and the route `src/app/api/inventory/stock/[itemId]/route.ts`. Either retire the hook citing that evidence, or — if you make it reachable — fix the ID first.

### KIT-15

**Outcome:** Cover recipe AI and scaling boundaries.

- **Acceptance:** Test malformed ingredient/scale payloads, fallback/rate errors and explicit long-call timeouts using fixtures. Unknown conversions remain unknown; no invented allergen safety.
- **Depends on:** [KIT-10](<Kitchen — Master Book.md#kit-10>).

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Depends on KIT-10 landing the schema; these are the boundary tests over it. The AI recipe routes are `src/app/api/recipes/extract-from-url/route.ts`, `recipes/[id]/generate/route.ts`, `optimize/`, `substitute/` and `scale/` — all currently zod-free. The model layer is `src/lib/ai/gemini.ts` (`generateContentWithFallback`, `isDailyQuotaError` for the daily-versus-per-minute 429 discrimination) and `src/lib/ai/rateLimit.ts`. "Explicit long-call timeouts" is Hard Rule #6: an AI call must pass `timeoutMs` to `safeFetch()` or it aborts at 8 s, and a timeout must not be classified as offline. Use fixtures, not live calls. Two invariants to assert rather than assume: an unknown unit conversion stays unknown, and nothing here may invent allergen safety.

### KIT-23

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C13. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Promote recipe clippings into one executable recipe.

- **Acceptance:** Catalogue C13: explicit promotion creates/links one Kitchen recipe with provenance and validated ingredients; repeated activation does not clone masters or overwrite later edits.
- **Depends on:** [KIT-10](<Kitchen — Master Book.md#kit-10>), [KIT-20](<Kitchen — Master Book.md#kit-20>).

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Catalogue C13, depends on KIT-10 (validated ingredients) and KIT-20 (safe typed patch). The promotion precedent already exists and should be read first: `src/app/api/items/[id]/promote/route.ts` promotes an item to a catalogue record and writes `source_catalogue_item_id` as lineage — this is the reverse direction over the same relation. Recipe creation is `src/app/api/recipes/route.ts`; catalogue reads are `src/features/catalogue/hooks.ts`. The two failure modes named in the acceptance map to one rule: promotion is explicit and idempotent, so repeated activation must find the existing link rather than cloning the master or overwriting later edits — a unique constraint plus 409 (Hard Rule #9). Ingredients arriving from a clipping are external input and must go through KIT-10's schema before storage.

## Backlog reconciliation

- 2026-09-10 — **KIT-9** → TRIP-7. Scope is retained in the destination criteria; duplicate removed, not shipped.

## Shipped Log

- ✅ 2026-07-18 — inbound Healthcare bridge landed in recipe views (`RecipeAllergenWarning.tsx` consuming `useHouseholdAllergens`) — Kitchen gained a junction without gaining a commit

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
