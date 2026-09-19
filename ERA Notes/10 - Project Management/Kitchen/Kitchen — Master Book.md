---
created: 2026-09-10
updated: 2026-09-10
type: master-book
status: active
owner: Elio
---

# Kitchen — Master Book

[Backlog](<4 - Checklist.md>) · [PM home](<../_index.md>) · [Governance](<../_Conventions.md>)

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

Unresolved policy choices live in the [decision register](<../_Decisions.md>); original exploratory ideas live in [Research options](<../Research/Options.md>). A Later item is retained work, not automatic permission to start.

## Pain Inventory

🟠 **KIT-10** Validate ingredient payloads at every writer. See [acceptance](<#kit-10>) for the root cause, evidence and gate.

🟠 **KIT-4** Expose scoped meal coverage to ERA. See [acceptance](<#kit-4>) for the root cause, evidence and gate.

🟠 **KIT-11** Return the correct cooking count. See [acceptance](<#kit-11>) for the root cause, evidence and gate.

🟠 **KIT-12** Restore cooking and restock changes with real Undo. Dated source diagnosis; cause and witness limits are in [criteria](<#kit-12>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **KIT-13** Separate estimated and measured cooking values. Dated source diagnosis; cause and witness limits are in [criteria](<#kit-13>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **KIT-14** Revalidate the dormant stock-update ID path. Dated source diagnosis; cause and witness limits are in [criteria](<#kit-14>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **KIT-18** Authorize document signing through its owning record. Dated source diagnosis; cause and witness limits are in [criteria](<#kit-18>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **KIT-19** Preserve old document files through replacement and Undo. Dated source diagnosis; cause and witness limits are in [criteria](<#kit-19>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **KIT-20** Patch catalogue metadata with revision checks. Dated source diagnosis; cause and witness limits are in [criteria](<#kit-20>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **KIT-21** Preserve catalogue identity through delete and restore. Dated source diagnosis; cause and witness limits are in [criteria](<#kit-21>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

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

### KIT-4

**Outcome:** Expose scoped meal coverage to ERA.

- **Acceptance:** Verify person, status and leftover interval coverage and distinguish unavailable from no planned meal. Chef already reads meal data; reuse that path. Complete the consumer adapter before HUB-45/HUB-56; a pure helper alone does not complete the meal surface.

**Retained contract — ASTRA-KIT-2:**

- **Outcome:** A meal's leftovers, status and intended person contribute consistently to calendar and ERA coverage.
- **Boundary:** Extract existing date expansion into a pure shared contract rather than introducing a competing expansion engine. Separate display membership from edible/planned coverage: skipped rows can stay visible but do not cover a meal; person-specific meals only cover that person, shared meals both. Use date-only local calendar semantics. Fetch actual interval overlap, replacing the arbitrary 14-day lookback and date-only origin read; keep existing auth/household filter. ERA's existing all-day gap remains an all-day gap, not an assertion all meal slots are filled. Preserve per-slot facts for E-08/E-22. Failed retrieval is unavailable, not zero meals. Do not create Items or change calendar layout.
- **Money/schedule math?:** Yes, calendar coverage: cooked Sep4, eats-through Sep7 → Sep6 covered; same row skipped → uncovered; partner-only → owner uncovered/partner covered. No extra schedule occurrences or stock deduction.
- **Gate:** `pnpm exec vitest run tests/meal-plan-coverage.test.ts src/features/era/intents/resolveIntent.test.ts --reporter=verbose` → nonzero cases pass for leftovers crossing query boundary, >14-day interval, status, person, leap/month boundary and Beirut DST. Mock route retrieval proves overlap without omitted older rows; empty complete versus failure differ. Common gates; 390×844 calendar capture preserves layout.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### KIT-11

**Outcome:** Return the correct cooking count.

- **Acceptance:** Reproduce the documented HEAD/count response handling and use the actual count metadata. Verify zero/error/nonzero without treating absent body data as zero.

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

### KIT-1

- **Retained campaign gate (D3):** After the actual loop/lifecycle witnesses pass, update the Master Book state and shipped evidence; documentation alone does not close this gate.

- **Retained campaign gate (D1):** Dropping an inventory item below threshold puts it on the shopping list automatically (without breaking the legacy queue).

**Outcome:** Add low-stock shopping from an agreed stock rule.

- **Acceptance:** DEC-03 must resolve quantity threshold versus run-out date and automatic-add consent. Then use one pure lowStockItems() reader; restock and the unique shopping backlink must commit together, repeated triggers must not duplicate, and the existing Hub shopping queue must remain compatible. Test failure/retry/offline and an actual below-threshold transition. Do not call the helper alone an end-to-end completion.
- **Depends on:** [KIT-24](<Kitchen — Master Book.md#kit-24>).

- **Acceptance:** dropping an inventory item below its threshold puts it on the shopping list automatically, without breaking the legacy localStorage queue.

**Retained contract — ASTRA-KIT-1:**

- **Outcome:** Concurrent restocks preserve the total quantity and one matching history record for each accepted increment.
- **Boundary:** Validate UUID and finite positive numeric quantity using Zod. Replace route-side read/add/write/history with the reviewed existing transaction seam. Derive the authorized owner from authenticated identity; never trust a freely supplied user ID. Within SQL lock the stock row before recording before/after values; handle absent stock through a verified unique owner/item contract, with no destructive dedupe. History failure rolls back the increment. Preserve existing runout behavior only after its current trigger is verified. Use safeFetch for the existing restock mutation; no new offline eligibility or retry queue. Repeated *distinct* restocks are separate operations; request-idempotent replay remains outside this sheet and must precede automated replay.
- **Money/schedule math?:** No money/occurrence math. Stock example required: 5 units + concurrent 2 and 3 → 10; history forms 5→7→10 or 5→8→10. Failure inserting history leaves quantity unchanged. String `"2"`, infinity and negative input are rejected.
- **Gate:** `pnpm exec vitest run tests/inventory-restock.test.ts --reporter=verbose` → nonzero mocked route/auth/input cases pass. Owner's isolated SQL fixture proves concurrent increments, absent-row race, history rollback and cross-owner refusal; outputs attached. Common gates pass; migration APPLIED alone is insufficient.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### KIT-2

- **Retained campaign gate (D3):** After the actual loop/lifecycle witnesses pass, update the Master Book state and shipped evidence; documentation alone does not close this gate.

- **Retained campaign gate (D2):** Completing a recipe in cooking mode deducts its ingredients from inventory.

**Outcome:** Deduct mapped ingredients when cooking completes.

- **Acceptance:** DEC-17 must settle ingredient↔stock mapping and unit conversion. Unknown mappings/units produce no invented deduction. Cooking confirmation, stock delta and a real Undo inverse are atomic/idempotent, including failure and replay; preserve the owner confirmation choice.

- **Acceptance:** completing a recipe in cooking mode deducts its ingredients from inventory, and that deduction can trigger KIT-1.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### KIT-18

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C01a. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Authorize document signing through its owning record.

- **Acceptance:** Catalogue C01a: authorize each private document via its source record before signing; reject arbitrary storage paths and cross-user access. Preserve valid shared-record access.
- **Depends on:** [HUB-62](<../Hub & ERA/Hub & ERA — Master Book.md#hub-62>).

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

### KIT-19

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C01b. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Preserve old document files through replacement and Undo.

- **Acceptance:** Catalogue C01b: replacement cannot delete the prior binary before commit/Undo eligibility; define cleanup after reference checks and test failed replacement and inverse.
- **Depends on:** [KIT-18](<Kitchen — Master Book.md#kit-18>).

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

### KIT-20

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C02. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Patch catalogue metadata with revision checks.

- **Acceptance:** Catalogue C02: validate typed partial updates, preserve unrelated metadata and use revision preconditions for stale writes. Safe create/edit foundation precedes promotions and corrections.
- **Depends on:** [KIT-18](<Kitchen — Master Book.md#kit-18>).

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

### KIT-21

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C03. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Preserve catalogue identity through delete and restore.

- **Acceptance:** Catalogue C03: tombstone/restore preserve ID and backlinks; purge only after the retained-reference contract permits it. Exercise failed and repeated inverse operations.
- **Depends on:** [KIT-19](<Kitchen — Master Book.md#kit-19>), [KIT-20](<Kitchen — Master Book.md#kit-20>).

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

### KIT-22

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C09. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Browse and edit reference records.

- **Acceptance:** Catalogue C09: reference-only types get compact browsing/forms, typed metadata and permissions without execution controls. Keep executable masters in their owning modules.
- **Depends on:** [KIT-20](<Kitchen — Master Book.md#kit-20>).

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

### KIT-24

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C17. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Keep catalogue metadata separate from stock ownership.

- **Acceptance:** Catalogue C17: descriptive reference edits cannot overwrite Inventory quantity, unit or history. Require an explicit owner transition for operational stock changes.
- **Depends on:** [KIT-20](<Kitchen — Master Book.md#kit-20>).

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

### KIT-3

**Outcome:** Meal plan budget estimate (gap 2c).

- **Acceptance:** Meal plan budget estimate (gap 2c) — show estimated grocery cost per plan. Coordinate with [Budget — Master Book](<../Budget/Budget — Master Book.md>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### KIT-5

**Outcome:** Pantry-aware recipe suggestions ("what can I make with what I have").

- **Acceptance:** Pantry-aware recipe suggestions ("what can I make with what I have").

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### KIT-6

**Outcome:** Smarter per-item low-stock thresholds + restock cadence from usage history.

- **Acceptance:** Smarter per-item low-stock thresholds + restock cadence from usage history.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### KIT-7

**Outcome:** Meal Planning.

- **Acceptance:** Meal Planning → Schedule (planned meals on the calendar/today views).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### KIT-8

**Outcome:** Barcode.

- **Acceptance:** Barcode → catalogue price for cost tracking.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### KIT-12

**Outcome:** Restore cooking and restock changes with real Undo.

- **Acceptance:** Replace cache-only undo with checked domain inverses for cooking/restock. Verify membership/stock/history, repeat/retry and partial failure; coordinate KIT-2 atomic deduction.
- **Depends on:** [KIT-2](<Kitchen — Master Book.md#kit-2>).

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

### KIT-13

**Outcome:** Separate estimated and measured cooking values.

- **Acceptance:** Duration/difficulty defaults and prefilled values must not be presented as measured actuals. Preserve basis at write/read boundaries and use only observed values for calibration.

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

### KIT-14

**Outcome:** Revalidate the dormant stock-update ID path.

- **Acceptance:** Determine whether useUpdateStock has any live caller; repair the documented wrong ID if reachable, otherwise retire with source evidence. A dormant hook is not a proven production incident.

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

### KIT-15

**Outcome:** Cover recipe AI and scaling boundaries.

- **Acceptance:** Test malformed ingredient/scale payloads, fallback/rate errors and explicit long-call timeouts using fixtures. Unknown conversions remain unknown; no invented allergen safety.
- **Depends on:** [KIT-10](<Kitchen — Master Book.md#kit-10>).

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

### KIT-23

**Accepted specification:** [Catalogue final build plan §10](<../../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>), packet C13. Its detailed data/rollout contract applies; earlier Object Memory/Tasks V2 alternatives were withdrawn.

**Outcome:** Promote recipe clippings into one executable recipe.

- **Acceptance:** Catalogue C13: explicit promotion creates/links one Kitchen recipe with provenance and validated ingredients; repeated activation does not clone masters or overwrite later edits.
- **Depends on:** [KIT-10](<Kitchen — Master Book.md#kit-10>), [KIT-20](<Kitchen — Master Book.md#kit-20>).

**Provenance:** [Kitchen — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Kitchen/Kitchen — Master Book.md>). The source is historical; this entry owns the retained outcome.

## Backlog reconciliation

- 2026-09-10 — **KIT-9** → TRIP-7. Scope is retained in the destination criteria; duplicate removed, not shipped.

## Shipped Log

- ✅ 2026-07-18 — inbound Healthcare bridge landed in recipe views (`RecipeAllergenWarning.tsx` consuming `useHouseholdAllergens`) — Kitchen gained a junction without gaining a commit

## Delivery session log

*(Delivery runner appends dated progress bullets here automatically.)*

## Successor Briefing

Read the checklist, the selected acceptance entry and its dependencies; then use the [Feature Map](<../../01 - Architecture/Feature Map/_index.md>) for source routing and the module architecture docs for invariants. Delta from the source cutoff before implementation. Use current owner-supplied DB evidence for access/application questions; agents never apply production SQL. Record code, applied migration and device/runtime acceptance separately.

Finish with the repository playbook and [governance](<../_Conventions.md>): update acceptance/evidence, sweep only completed work, and validate the canonical queue. A completed child does not complete its coordination parent.
