---
created: 2026-06-10
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled
  - module/kitchen
---

# Kitchen · FABLED 1 — Current Implementation

> **FABLED:** [_index](<_index.md>) · **1 · Implementation** · [2 · Gaps](<2 - FABLED — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED — Future Enhancements.md>)
>
> How the food domain is *actually* built, verified against `main` 2026-06-10. Authoritative code maps stay in the vault docs; this is the domain-level X-ray — most importantly the **loop-link state table** (§4).

---

## 1 · Identity & mount points

Three standalones (Recipes, Meal Planning, Inventory) + one junction (Shopping List), all thin-hooks-over-API like the rest of the app:

| Piece | Hooks | UI | Page route | API |
|---|---|---|---|---|
| Recipes | `features/recipes/hooks.ts` (23 KB) | `src/app/recipe/` + recipe components | `/recipe` | `api/recipes/*` (rich — see §2) |
| Meal Planning | `features/meal-planning/` | `components/web/WebMealPlanCalendar.tsx` | `/meal-plan` | `api/meal-plans/*` |
| Inventory | `features/inventory/hooks.ts` | `components/inventory/` (`InventoryView`, `InventoryItemDialog`, `RestockDialog`) — **mounted inside the Catalogue surface; there is NO `/inventory` route** (Feature Index corrected 2026-06-10) | — | `api/inventory/*` |
| Shopping List | `features/hub/` (+ `useHubPersistence`) | `components/hub/ShoppingListView.tsx` (**107 KB**) | inside Hub | `api/hub/shopping-groups` |

## 2 · The under-appreciated asset: Recipes has a full AI surface

`api/recipes/` is much more than CRUD (sizes tell the story):

- `extract-from-url/route.ts` (**21 KB**) — paste a URL → structured recipe (the import path).
- `[id]/generate` (5 KB), `[id]/optimize` (**11 KB**), `[id]/scale` (6 KB), `[id]/substitute` (5 KB) — AI generation, optimization, scaling, and ingredient substitution per recipe.
- `[id]/versions` — version compare; `[id]/cooking-log` — records cooking events.

These are Gemini-backed long calls — Hard Rule 6 applies (`timeoutMs` on every `safeFetch`). **The chef face in ERA** (`features/era/intents/chef.ts` + `useChefSummary`) already exists as the conversational seam into this surface.

## 3 · Inventory API anatomy

`api/inventory/`: `items` (CRUD), `stock/[itemId]` (count mutation), `restock`, `history`, `low-stock` (the threshold query), `barcode/[barcode]` (lookup), `add-to-shopping` (push to list — **manually triggered**).

## 4 · Loop-link state table (the heart of this domain)

The vision is the closed loop: *cook → deplete → low-stock → shopping → buy → restock → plan*. Verified link-by-link:

| Link | State 2026-06-10 | Evidence |
|---|---|---|
| Recipe → Shopping (ingredients to list) | ✅ Built | meal-plans `add-to-shopping` + recipe paths |
| Meal plan → Shopping | ✅ Built | `api/meal-plans/add-to-shopping` |
| Inventory → Shopping (manual) | ✅ Built | `api/inventory/add-to-shopping` |
| Low-stock **detection** | ✅ Built | `api/inventory/low-stock` |
| Low-stock → Shopping **auto-add** | ❌ Missing (gap 2a) | detection + add exist; **no trigger connects them** — the keystone is one wiring step, not a build |
| Cooking → Inventory deduction | ❌ Missing (gap 2b) | `cooking-log` records the event; no deduction call into `stock/[itemId]` found — verify in cooking-mode UI before building |
| Buy (check off list) → Restock | ❌ Missing | restock is manual |
| Meal plan → Budget estimate | ❌ Missing (gap 2c) | no price source wired |
| Meal plan → Schedule surfacing | ❌ Missing | planned meals don't appear on calendar/today |

**Read this table before any Kitchen campaign** — the domain's whole roadmap is "turn ❌ rows into ✅."

## 5 · The Shopping List trap (repeat warning)

Shopping List is the **only sanctioned user of the legacy localStorage queue** in `SyncContext` — every other offline path uses IndexedDB (`lib/offlineQueue.ts`). This is *intentional*; do not migrate it as a side-effect of gap-2a work. New code touching shopping-adds from Inventory should go through the existing shopping-add APIs, not a new queue path.

## 6 · Size & risk map

| File | Size | Risk |
|---|---|---|
| `components/hub/ShoppingListView.tsx` | 107 KB (~3,181 LOC) | Shared Hub/Kitchen surface; the gap-2a work lands near it. |
| `api/recipes/extract-from-url/route.ts` | 21 KB | Parser + AI in one route; no fixtures. |
| `features/recipes/hooks.ts` | 23 KB | All recipe client state in one file. |

## 7 · Test reality

**Zero tests** in the domain. Most testable surfaces: recipe **scale** math (pure ratios), low-stock threshold logic, URL-extraction with fixture HTML.
