---
created: 2026-05-30
updated: 2026-09-06
type: master-book
status: active
owner: Elio
consolidates: "_index, 1 - Feature State, 2 - Vision & Roadmap, 3 - Action Plan, FABLED, FABLED 2, FABLED 3 (originals in ../_Archive/Kitchen/)"
tags:
  - pm/master-book
  - scope/module
  - module/kitchen
---

# Kitchen — Master Book

> **Campaign:** Kitchen · prefix `KIT` · working queue → [4 · Checklist](<4 - Checklist.md>)

> **ASTRA landing — 2026-09-06:** [Study](<ASTRA/Kitchen — ASTRA Book.md>) · [Packets](<ASTRA/Kitchen — ASTRA Packets.md>), subordinate to the active [ERA Top Layer plan](<../ERA Top Layer — Master Plan (2026-09-02).md>). Repository evidence is fixed at `3106164`; this landing changes documentation only. The dated study and current pain corrections supersede stale operational claims below; historical scores, shipped records and locked decisions are retained. Live DB state remains **UNVERIFIED** without fresh owner evidence.

## Identity & North Star

"Kitchen" is a convenience grouping of the household food domain — **Recipes** and **Inventory** (standalone), **Meal Planning** and **Shopping List** (junction), plus **Catalogue** in the same neighbourhood. **Chores are owned by Schedule**; their older placement here is historical grouping, not permission for cross-campaign work. The defining trait is that the tools are built but loosely connected.

Today the loop is **open**: you cook without inventory updating, you plan without knowing the budget, you run out without the list knowing.

**Vision in one line:** *turn Kitchen from four separate tools into one closed loop — what you cook, have, plan and buy stay in sync without you reconciling them by hand.*

**Source:** `src/features/{recipes,meal-planning,inventory,catalogue,chores}/`, `src/components/hub/ShoppingListView.tsx`, `src/app/{recipe,catalogue,meal-plan}/`. Vault docs: [Recipes](<../../02 - Standalone Modules/Recipes/Overview.md>) · [Inventory](<../../02 - Standalone Modules/Inventory/Overview.md>) · [Meal Planning](<../../03 - Junction Modules/Meal Planning/Overview.md>) · [Shopping List](<../../03 - Junction Modules/Shopping List/Overview.md>).

## Current State (verified)

**Maturity 3.0 / 10 as of 2026-07-18 (FABLED 3), unchanged since 2026-07-02 — `git log c561635..f0a8e19` over every Kitchen path returned zero commits.** This is an honest affirmation generation. The uncomfortable corollary: the gap between Kitchen and its siblings widened again, by standing still.

| Dimension | Score | Evidence |
|---|---|---|
| Individual tools | 7 | recipes, meal planning, inventory, shopping all work standalone |
| Loop closure | 2 | the keystone (low-stock → auto-add) is now **4+ months** flagged |
| AI surface protection | 3 | extract/optimize/scale/substitute still fixture-less |
| Outward bridges | 2 | planned meals still invisible to calendar/Today/ERA |
| Test protection | 1 | still the only campaign domain at **zero tests** |
| Handoff readiness | 4 | standalone CRUD/UI = any-model; the untested AI surface and loop wiring = mid-tier+; nothing is human-first — which makes Kitchen the best *practice campaign* for a smaller model to build its first tests |

| Sub-feature | Tier | Reality | Next step |
|---|---|---|---|
| Recipes | 🔵 | recipe book, ingredients, instructions, cooking mode, version compare, page-flip UI, AI surface (extract/optimize/scale/substitute) | connect to Inventory — cooking should know what's in stock (KIT-2) |
| Meal Planning | 🔵 | weekly planner, drag-drop, recipe→day, web calendar, add-to-shopping | add budget-impact estimate per plan (KIT-3) |
| Inventory | 🔵 | stock counts, restock, low-stock, barcode lookup, history, add-to-shopping. **Mounted inside Catalogue — there is no `/inventory` route** | auto-create shopping items on low stock (KIT-1) |
| Shopping List | 🔵 | Hub ↔ Recipes ↔ Inventory. Uses the **legacy localStorage queue in `SyncContext`** — intentional, the one sanctioned legacy-queue path | wire the low-stock auto-add (KIT-1) |
| Chores | 🔵 | real code lives in `src/app/reminders/` Chores tab + `src/components/chores/` (`src/app/chores/` is a redirect) | — |

**Inbound bridge (new, from Healthcare):** recipe detail views now render allergen warnings — `RecipeAllergenWarning.tsx` + `RecipeDetailView.tsx` consume `useHouseholdAllergens`, keyword-matched against ingredients via `src/lib/health/allergenMatch.ts`. **Kitchen's ingredient data is now safety-relevant input to another module** — changing ingredient shape or parsing has a health-warning blast radius.

## Pain Inventory

**ASTRA delta, 2026-09-06 — [study F1–F5](<ASTRA/Kitchen — ASTRA Book.md>):** stock functions in the 2026-08-04 catalog are recoverable historical contracts, not proof of today's deployed behavior. Recipe ingredients are JSON arrays with string quantities/units (`migrations/schema.sql:1097–1098`, `src/types/recipe.ts:9–16`), not normalized inventory links. This is not a safe automation practice campaign: quantity integrity, household scope and allergen consumers matter.

- 🔴 **Restock can lose increments, accept the wrong input type and lose history.** `src/app/api/inventory/restock/route.ts:29–51` reads and replaces an absolute quantity; concurrent 5+2/+3 can leave 7 or 8, and a string quantity passes loose positivity checks. History insertion errors are unchecked (`:85–93`). ASTRA-KIT-1 is an owner-contract-gated atomic-restock prerequisite to KIT-1/M-03, not completion of low-stock auto-add.
- 🟠 **Adding stock to shopping has no stable effect identity.** `src/app/api/inventory/add-to-shopping/route.ts:60–95` inserts a message before updating its backlink, without enforcing uniqueness or checking the backlink result; retries/concurrent calls can duplicate the entry. Keep automatic consumers held until idempotence and the existing legacy queue contract are proved.
- 🟠 **Meal coverage disagrees across Kitchen and ERA.** Chef counts a set of `planned_date` values (`src/features/era/intents/resolvers/chef.ts:192–195`), the calendar expands leftovers (`src/components/web/WebMealPlanCalendar.tsx:64–77`), and hooks use either a fixed 14-day look-back or origin-day selection (`src/features/meal-planning/hooks.ts:23–41`). Status and `for_user` must also agree. ASTRA-KIT-2 refines KIT-4/KIT-7 for E-08/E-22; it does not finish either whole parent.
- 🔴 **Persisted recipe ingredients can violate the allergen consumer's contract.** Extraction/generation accept unchecked shapes (`src/app/api/recipes/extract-from-url/route.ts:579`, `src/app/api/recipes/[id]/generate/route.ts:126–137`), while `src/lib/health/allergenMatch.ts:96,154,188` calls string methods on ingredient names. ASTRA-KIT-3 validates all four persistence writers; extraction-response checks remain held. This guards structural compatibility, not clinical completeness.
- 🟠 **Cooking totals and Undo can report effects they did not perform.** `src/app/api/recipes/[id]/cooking-log/route.ts:116–124` requests a head-only count but reads `data.length`, producing `times_cooked = 1`; cooking and restock Undo callbacks only invalidate queries (`src/features/recipes/hooks.ts:287–304`, `src/features/inventory/hooks.ts:224–239`). Count correction and genuine inverse actions remain held, recorded here rather than implied by an unrelated packet.
- 🟡 **A dormant stock-settings hook sends the wrong identifier.** `src/features/inventory/hooks.ts:118–119` sends the stock-row ID to a route keyed by inventory-item ID. `useUpdateStock` has no live caller at the evidence cutoff (`:245`); hold correction/deletion until its intended consumer is known, rather than describing a witnessed UI failure.

- 🟠 **Low-stock auto-add is not a single wiring step (KIT-1).** The implemented low-stock read is based on run-out date/auto-add settings (`src/app/api/inventory/low-stock/route.ts:28–59`), while acceptance says quantity threshold. Resolve that contract and the stock/shopping effect guarantees above before automation. The locked automatic-add outcome remains; a read-only signal does not complete it.
- 🟠 **Ingredient producer protection is missing.** The three feature directories have no tests at the cutoff, but `src/lib/health/allergenMatch.test.ts` already protects the shared consumer, so "zero tests across the whole domain" is false. Producer-shape fixtures must cover the actual four persistence boundaries, not merely mirror a type declaration.
- 🟡 The recipe AI surface (extract/optimize/scale/substitute) is fixture-less — prompt drift silently changes extractions with nothing to catch it.
- **Correction 2026-09-06:** ERA already has meal assignment and gap reads (`src/features/era/intents/resolvers/chef.ts:99,180`, HUB-20). The remaining work is consistent coverage semantics and the direct E-08 read contract, not inventing a Kitchen→ERA bridge.
- 🟡 **Cooking does not have a safe stock-consumption mapping (KIT-2/M-05).** `src/app/api/recipes/[id]/cooking-log/route.ts:82–143` records cooking and statistics without inventory deduction; ingredient names and string quantities/units do not identify stock rows or normalize amounts. Hold automatic deduction until explicit ingredient→inventory identity, units and an idempotent inverse are defined.
- ⚪ Shopping List rides the legacy localStorage queue **by design** — a correctness trap if someone "modernizes" it without knowing it's intentional.

## Shipped Log

*(No in-cluster commits between 2026-07-02 and 2026-07-18. Earlier history: the four tools were built and shipped before the campaign layer existed — see git history and the vault docs.)*

- ✅ 2026-07-18 — inbound Healthcare bridge landed in recipe views (`RecipeAllergenWarning.tsx` consuming `useHouseholdAllergens`) — Kitchen gained a junction without gaining a commit

## Delivery session log

*(Delivery runner appends dated progress bullets here automatically.)*

## Vision & Decisions

### Track A — internal enhancements

| Enhancement | Today | The dream | Effort |
|---|---|---|---|
| Recipe → Inventory awareness | recipes list ingredients; cooking mode is standalone | cooking mode shows in-stock vs missing; cooking deducts inventory | M |
| Meal plan budget estimate | plan a week; no cost signal | estimated grocery cost per plan from catalogue/inventory prices | M |
| Pantry-aware recipe suggestions | browse manually | "you have these 6 ingredients → here's what you can make" | M |
| Smarter low-stock thresholds | fixed flag | per-item thresholds + restock cadence from usage history | S–M |
| Barcode → catalogue price | barcode populates inventory | tie scanned items to catalogue prices for cost tracking | M |

### Track B — bridges out of Kitchen

- **Inventory low-stock → Shopping List auto-add** — the keystone; highest leverage (KIT-1).
- **Recipe → Inventory** — cooking deducts ingredients, which then feeds the low-stock trigger (KIT-2).
- **Meal Planning → Budget** — surface estimated grocery cost per plan (KIT-3, coordinate with Budget).
- **Meal Planning → Schedule** — a planned meal is a dated event; surface it on calendar/today (KIT-7).
- **Kitchen → ERA briefing** — "you're low on 3 staples and have nothing planned for Thursday" (KIT-4).
- **Trips → Kitchen** — make the trip meal/packing cascade legible from the Kitchen side (KIT-9).

### The bets, in order

1. **Inventory low-stock → Shopping List auto-add** — the single link that starts closing the loop, and the most-felt daily win.
2. **Recipe → Inventory deduction** — cooking actually changes what you have. With bet 1, the loop is half-automatic.
3. **Meal plan budget estimate** — bridges Kitchen ↔ Budget and makes meal planning a money decision.

Plus a designated cheap win: **the ingredient-shape contract test** (~30 lines) — it guards the Healthcare bridge from Kitchen-side drift *and* ends the zero-test status in one session. Explicitly delegable to a lower-tier model.

> The domain's payoff is the **loop**, not any single tool. Resist polishing one piece in isolation — every bet above is a link between two pieces. Adding more ideas to a stalled queue is meta-work.

### Not now

- ❌ Don't migrate Shopping List off the legacy localStorage queue — it's intentional.
- ❌ Don't polish a single tool in isolation while the loop stays open.
- ❌ Don't start barcode→catalogue pricing before the inventory→shopping link works.

## Acceptance Criteria Index

### KIT-1
- **Acceptance:** dropping an inventory item below its threshold puts it on the shopping list automatically, without breaking the legacy localStorage queue.

### KIT-2
- **Acceptance:** completing a recipe in cooking mode deducts its ingredients from inventory, and that deduction can trigger KIT-1.

## Successor Briefing

**Who should read this:** you are about to touch recipes, meal planning, inventory, catalogue, chores or the shopping list. Good news — **this is the safest campaign in the app**: standalone tools, house patterns, no money, no recurrence engines, nothing human-first. It is deliberately recommended as the practice ground for lower-tier models to ship their first Kitchen tests and loop wiring.

**First 10 minutes:**

```bash
git log --format="%h %ad %s" --date=short --since=2026-07-18 -- src/features/recipes src/features/meal-planning src/features/inventory src/features/catalogue src/features/chores
find src/features/recipes src/features/meal-planning src/features/inventory -name "*.test.*"   # empty as of 2026-07-18 — first hit means the zero-test era ended
```

**Task-tier map:**

| Task archetype | Tier | Route |
|---|---|---|
| Recipe/meal-plan/inventory/chores UI + CRUD | any-model | `add-feature` + `ui-guardrails`; standalone-import rule (no cross-feature imports) |
| **The ingredient-shape contract test** | any-model — **designated first task** | ~30 lines; fixture the shape `allergenMatch` consumes |
| Shopping-list logic | mid-tier+ | it's a Junction AND uses the legacy localStorage queue — don't migrate it, don't extend it |
| Recipe AI surface | mid-tier+ | zero fixtures exist; write the fixture for your path as part of any change; `timeoutMs` on all AI calls |
| Low-stock → auto-add keystone wiring | mid-tier+ | crosses Inventory→Shopping List; the design is written — execute, don't redesign |
| Ingredient data-shape changes | mid-tier+ | blast radius includes Healthcare allergen warnings — run `npx vitest run src/lib/health/allergenMatch.test.ts` after |

**Out-of-depth tells — stop if:** you're importing one standalone feature dir from another; you're adding to the legacy localStorage shopping queue; an AI recipe call writes anywhere without user confirmation.

**Trap registry:**

| Trap | Symptom | Guard |
|---|---|---|
| Inventory is mounted inside Catalogue | can't find the inventory page | `src/components/inventory/` renders within Catalogue — no `/inventory` route |
| Shopping list = legacy offline queue | offline edits behave differently | hub-only localStorage queue by design; new offline work uses `src/lib/offlineQueue.ts` |
| Recipe AI surface is fixture-less | prompt drift silently changes extractions | any AI-surface edit ships with its first fixture |
| Ingredients feed health warnings | a "harmless" shape refactor breaks allergen matching | the contract test; until it exists, manual check on both accounts |
| Chores live in Reminders' tab | editing `src/app/chores/` (a redirect) | real code: `src/app/reminders/` Chores tab + `src/components/chores/` |

**Verification manifest:**

| Claim | Command | Expected |
|---|---|---|
| Zero-test status | `find src/features/recipes src/features/meal-planning src/features/inventory -name "*.test.*" \| wc -l` | 0 → any hit means rescore Test protection |
| Allergen bridge intact | `grep -rln "useHouseholdAllergens" src/components/web \| wc -l` | ≥2 |
| Keystone still unwired | `grep -rn "low.stock\|lowStock" src/components/hub/ShoppingListView.tsx \| wc -l` | 0 = still unwired |

## Pointers

- Working queue: [4 · Checklist](<4 - Checklist.md>) · conventions: [_Conventions](<../_Conventions.md>)
- Offline note: Shopping List is the only feature still on the legacy localStorage queue — see [Sync & Offline](<../../03 - Junction Modules/Sync & Offline/Overview.md>)
- Pre-consolidation originals: `../_Archive/Kitchen/`
