---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: baseline-frozen
owner: Elio
---

> Archived study. Current ownership and execution criteria live in the [PM index](<../../../../_index.md>); unchecked boxes here are historical proposals.

# Kitchen — ASTRA Book

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../../../Plans/ERA Top Layer — Master Plan (2026-09-02).md>), not a replacement roadmap. Source cutoff `3106164`; deltas [Kitchen Master Book](<../../../../Kitchen/Kitchen — Master Book.md>) `updated: 2026-07-30`. [Packets](<Kitchen — ASTRA Packets.md>) specifies bounded prerequisites; Phase 4 does not implement them.

## Book delta

Feature Map and vault Overviews routed Recipes, Inventory, Meal Planning and Shopping List before source inspection. `git log --since=2026-07-30 --format="%h %ad %s" --date=short -- src/features/recipes src/features/meal-planning src/features/inventory src/features/catalogue src/features/chores src/components/inventory src/components/hub/ShoppingListView.tsx src/app/api/recipes src/app/api/inventory src/app/api/meal-plans` returns `95864ef 2026-08-01 red baseline`.

| Claim | Verified delta | Consequence |
|---|---|---|
| Meals remain invisible to ERA | HUB-20 added assignment and gap reads; `src/features/era/intents/resolvers/chef.ts:99,180` implements both. A direct meal-plan read remains accepted E-08a work. | Correct “no bridge” to “incomplete coverage semantics”; ASTRA-KIT-2. |
| Inventory is one wiring step from a closed loop | Stock arithmetic and shopping-link writes are nontransactional, and inventory consumption has no ingredient identity/unit contract (F1/F3). | M-03/M-05 need prerequisites; automatic side effects cannot be added safely as a callback alone. |
| Recipes use joined ingredient/step tables — Feature Map | `migrations/schema.sql:1097–1098` and `src/types/recipe.ts:9–16` use JSON ingredient/step arrays and string quantity/unit. | Protect that existing shape; do not invent a normalized ingredient table. |
| Domain is the safest practice campaign, with no special risks | Ingredient names feed household allergen matching; stock/date correctness and shared shopping are junction concerns. | A pure shape fixture is a suitable first task; automation is not equivalent risk. |
| Zero tests | Confirmed for the three feature directories: 0/0/0 `*.test.*`. `src/lib/health/allergenMatch.test.ts` exists outside them. | Preserve the narrower count; “no tests anywhere touching Kitchen” is false. |
| All data mechanisms must be written in the app | The **Aug4 snapshot only** contains `restock_inventory_item`, `get_low_stock_items`, and runout-trigger metadata. Current API performs its own restock arithmetic. | Investigate reuse after fresh owner evidence; no claim those bodies are current or safe to call. |
| Stock settings hook is a live user defect | `hooks.ts:118–119` sends stock ID to an item-ID route, but source-only caller search finds just the `useUpdateStock` declaration at :245. | Dormant contract defect; no invented current user symptom or priority inflation. |

## Re-scored maturity

Same six dimensions; provisional **3.2/10 (19/6)**, compared with booked 3.0. Scores measure inspected implementation, not deployment.

| Dimension | Book | ASTRA | Evidence / +1 condition |
|---|---:|---:|---|
| Individual tools | 7 | 6 | Existing views/CRUD; false inverse callbacks and cooking count defect remain. +1: mutation and derived-count failure fixtures pass. |
| Loop closure | 2 | 2 | Manual inventory→shopping exists; F1/F3 block reliable automation. +1: atomic stock/history and deduplicated shopping effect proved. |
| AI surface protection | 3 | 2 | JSON casts feed recipe data without ingredient validation. +1: ASTRA-KIT-3 rejects malformed ingredient shapes at every named writer. |
| Outward bridges | 2 | 4 | ERA assignment/gap and Healthcare warning bridges exist. +1: canonical date/person/leftover coverage, ASTRA-KIT-2. |
| Test protection | 1 | 1 | No feature tests; shared allergen tests are narrower than producer validation. +1: first route/contract regressions run in E-01 CI. |
| Handoff readiness | 4 | 4 | Strong routing, but “one wiring step” hides data prerequisites. +1: owner supplies current DB contracts and one primitive ships with evidence. |

## Findings

### F1 · Stock increments and history can disagree

`src/app/api/inventory/restock/route.ts:29–51` reads quantity then writes a new absolute value. Two requests observing 5 and adding 2/3 can finish at 7 or 8 rather than 10. History insertion at :85–93 is unchecked. A string quantity passes the current loose positivity check and can concatenate in `quantityBefore + quantity`. **Doctrine priority 2/3; ASTRA-KIT-1, EXTENDS → KIT-1/M-03 prerequisite.**

The Aug4 `db-state.json` snapshot's existing restock function uses an SQL increment and writes history, but its exposed user argument, before-value locking and create-if-absent race require review against fresh current bodies/grants. Reusing its name blindly would replace one defect with another.

### F2 · Kitchen and ERA disagree about a day being covered

ERA gaps builds a set of `planned_date` only (`chef.ts:192–195`). The calendar expands leftovers (`WebMealPlanCalendar.tsx:64–77`), while the weekly hook fetches an arbitrary 14-day lookback (`meal-planning/hooks.ts:23–34`) and the date hook fetches only the originating date (:37–41). Status and `for_user_id` matter as well. An earlier cooked meal can cover today in the calendar yet appear absent to ERA; a skipped row can hide a real gap. **Doctrine priority 1/2/5; ASTRA-KIT-2, DOCKS → E-08/E-22 and EXTENDS → KIT-4/KIT-7.**

### F3 · Automatic shopping/consumption lacks a stable effect identity

`inventory/add-to-shopping/route.ts:60–95` always inserts a message, then separately updates its stock backlink without checking that update. Concurrent calls can both insert. `recipes/[id]/cooking-log/route.ts:82–143` records cooking and statistics, with no source-side stock decrement. Recipe ingredients have name/quantity/unit strings but no inventory item ID (`types/recipe.ts:9–16`). “Cooked” is insufficient to decide which stock unit or how much to subtract.

**Doctrine priority 2/4; existing KIT-1/KIT-2 acceptance needs refinement.** Preserve the plan's explicit automatic low-stock outcome after dedupe is proved; do not silently change it to an AI suggestion. No arbitrary quantity threshold column is assumed: current low-stock read is runout-date based and filters `auto_add_to_shopping` (`low-stock/route.ts:28–59`). Before M-05, require explicit ingredient→stock mapping and compatible units; unknown/free-text quantities cause no decrement. Before automatic M-03, require one active shopping effect per owner/item/target thread and a checked backlink transaction. These are retained prerequisites, not work hidden inside the three sheets below.

### F4 · Valid JSON is weaker than the ingredient contract

Extraction casts JSON at `recipes/extract-from-url/route.ts:579`; generation casts then writes `generated.ingredients` at `recipes/[id]/generate/route.ts:126–137`; create/update/version writes likewise accept unchecked arrays. Matching calls `normalize(ingredientName)`, which invokes `toLowerCase()` (`src/lib/health/allergenMatch.ts:96,154,188`). A missing/nonstring name can break the warning path. **Doctrine priority 2; ASTRA-KIT-3.** This study addresses software contracts, not clinical completeness. Healthcare owns the separate missing-allergen-feed state.

### F5 · Recorded history is not necessarily a truthful derived summary or Undo

The cooking-log route requests `head:true,count:"exact"` but reads `data.length`, defaulting `times_cooked` to 1 (`:116–124`). Several recipe/inventory mutation Undo callbacks only invalidate queries (`src/features/recipes/hooks.ts:287–304`; `inventory/hooks.ts:224–239`). Refresh is not reversal. Record these as bounded follow-up defects in Phase 5; do not claim all standalone tools are fully proved. The canonical cooking log can replace duplicated counters once its write/read contract is protected.

## Enhancement catalog

| Rank / sheet | Outcome | Size / severity | Mapping / dependencies |
|---|---|---|---|
| 1 · ASTRA-KIT-1 | Concurrent restocks preserve stock and matching history together. | M / friction | EXTENDS → KIT-1; DOCKS → M-03 prerequisite; fresh owner DB contract first |
| 2 · ASTRA-KIT-3 | Malformed ingredient payloads cannot enter recipe storage through the named writers. | M / friction | NEW validation prerequisite to KIT-2; shared allergen fixture and E-01 CI |
| 3 · ASTRA-KIT-2 | Calendar and ERA use the same date/person/leftover coverage facts. | M / friction | DOCKS → E-08/E-22; EXTENDS → KIT-4/KIT-7; E-04 fact contract |

These refine prerequisites rather than replace KIT-1/2's unfinished automation. No budget estimate is trustworthy without quantity, unit, identity, price provenance and missing-data coverage. KIT-3/5/6/8/9 remain retained scope, not extra commitments.

## What ERA needs from this module

| Signal / capability | Existing source | Required contract |
|---|---|---|
| `lowStockItems` for E-22 | Stock, catalogue metadata and existing runout read | Owner/scope, item ID, quantity unit, runout date, observation time, complete/partial/unavailable; missing runout is unknown, not stocked. |
| Meal coverage / E-08 read | `meal_plans` status, assignment and leftover interval | ASTRA-KIT-2; distinguish meal coverage from a calendar display row. No fresh Schedule item per leftover day. |
| Cooking feedback | `cooking_logs` actual duration, substitutions, ratings, servings | Can inform future user-reviewed suggestions; the broken aggregate count is not authority. |
| Recipe search/assignment | Existing ERA registry/resolvers | Reuse confirmed execution and the E-11 outcome contract. No model-generated stock deduction. |

**NEW, parked frontier:** derive a household availability view from meal coverage plus verified stock mappings, so ERA can recommend from recorded facts without a new model call. Reopen only when a ten-case fixture covers leftovers, person-specific meals, skipped plans, missing quantities and stale stock with zero false “available” conclusions. This is factual availability, not a nutrition or allergen safety guarantee.

## Do not do

Do not migrate the legacy shopping queue, assume an empty RPC fallback means no low stock, use fuzzy ingredient names to decrement inventory, add a third quantity model, introduce meal copies in Items just for rendering, or run AI calls during verification. Do not delete `WebMealPlanner` merely because the newer calendar exists: it remains reachable from Recipes; parity and owner acceptance precede retirement. The repeated meal-date expansion can be consolidated without removing that view.

## Coverage note

Owns Recipes, Inventory, Meal Planning and Shopping List; Catalogue's stock-facing schema is shared infrastructure here. Meal Planning is labeled Standalone in the Feature Index but explicitly a Junction in the module-model list: use junction cascade analysis and shared `src/lib` contracts while preserving standalone import restrictions. Chores belongs to Schedule's execution semantics despite Kitchen's historical grouping. Healthcare owns household allergen retrieval and warning availability; Budget owns grocery price/money truth; Trips owns travel-side-effect origin and rollback.

UNVERIFIED: current inventory RPCs/triggers/policies, duplicate stock rows, live shopping delivery and physical UI behavior. Owner supplies fresh `migrations/db-state.sql` output, plus untruncated policies/constraints for `inventory_stock`, `inventory_restock_history`, `catalogue_items`, `hub_messages`, `hub_chat_threads`, `meal_plans`, `recipes`. No DB calls or feature tests were run in this study.

## ASTRA 10× Findings

- **Leverage 1 — EXTENDS → KIT-1:** review and reuse the existing restock transaction seam; remove duplicated client-style arithmetic before adding automatic effects (F1).
- **Leverage 2 — DOCKS → E-08/E-22:** one meal-coverage contract makes Calendar, ERA and future Schedule projections agree about leftovers and people (F2).
- **Leverage 3 — NEW / ASTRA-KIT-3:** validate the producer shape used by the existing allergen matcher, instead of treating a type assertion as validation (F4).
- **Simplification — EXTENDS → KIT-7:** consolidate meal-date coverage in shared code and project it where needed; avoid materializing another schedule record for every meal.
- **Frontier — NEW, parked:** the ten-case availability fixture above can turn existing stock/meal facts into dependable context without another AI call.
- **Uncomfortable — EXTENDS → KIT-1/KIT-2:** “built but disconnected” hides unproved quantities and effects. Connecting the pieces faster would propagate their ambiguity into shopping and the assistant.

