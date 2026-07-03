---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - module/kitchen
---

# Kitchen · FABLED 2.1 — Current Implementation

> **FABLED 2:** [_index](<_index.md>) · **1 · Implementation** · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>) · v1 baseline: [FABLED/1](<../FABLED/1 - FABLED — Current Implementation.md>)
>
> Verified 2026-07-02. v1's structural map is still exact (mount points, the AI recipe surface, inventory API anatomy, the sanctioned legacy-queue rule) — read it there. This file re-verifies the loop table and records what the *rest of the app* changed under Kitchen's feet.

---

## 1 · Loop-link state table (re-verified — the domain's report card)

| Link | v1 (06-10) | **2026-07-02** | Note |
|---|---|---|---|
| Recipe → Shopping | ✅ | ✅ | unchanged |
| Meal plan → Shopping | ✅ | ✅ | unchanged |
| Inventory → Shopping (manual) | ✅ | ✅ | unchanged |
| Low-stock detection | ✅ | ✅ | unchanged |
| Low-stock → Shopping **auto-add** | ❌ | ❌ | **the keystone, still one wiring step** |
| Cooking → Inventory deduction | ❌ | ❌ | unchanged |
| Buy (check off) → Restock | ❌ | ❌ | unchanged |
| Meal plan → Budget estimate | ❌ | ❌ | unchanged; price layer still absent |
| Meal plan → Schedule surfacing | ❌ | ❌ | unchanged — but now has a natural host (below) |

Zero rows changed state in three weeks. The domain's roadmap remains "turn ❌ into ✅," and every ❌ is now *cheaper* than when v1 wrote it.

## 2 · What the neighborhood built that Kitchen can now use

- **Plan My Day / `WebDayPlanner`** (Schedule, June): the selected-day surface where "Pasta tonight — defrost the sauce" belongs. The meal-plan projection (v1-O5's `getMealsForRange()`) now has an obvious consumer instead of a hypothetical one.
- **The `AnalysisReport` contract** (Budget, June): strict-JSON + deterministic-fallback + ephemeral dashboard — the exact recipe for a "pantry report" or "what can I make?" answer that never breaks on model drift ([Budget FABLED 2.1 §3](<../../Budget/FABLED 2/1 - FABLED 2 — Current Implementation.md>)).
- **`normalizeMerchant` + statement line parsing** (Budget, June): the normalization half of grocery price observations exists now; Kitchen's price layer (G3) no longer starts from zero.
- **Draft/proposal UX** (Hub bulk-convert + `DraftRemindersDrawer`, June): the reviewed-proposal pattern the low-stock auto-add should reuse — propose rows, user confirms, nothing silent.
- **Idempotent upsert pattern** (Schedule, June): `onConflict` upserts as the answer to double-fire — exactly the idempotency rule the auto-add trigger needs (drop-below-threshold twice ≠ two shopping items).

## 3 · Mount points & API (unchanged from v1 — quick confirms)

- Recipes: `features/recipes/hooks.ts` · `/recipe` · `api/recipes/*` incl. `extract-from-url` (21 KB), `[id]/generate|optimize|scale|substitute|versions|cooking-log`.
- Meal Planning: `features/meal-planning/` · `/meal-plan` · `api/meal-plans/*` (+`add-to-shopping`).
- Inventory: `features/inventory/hooks.ts` · mounted **inside Catalogue** (still no `/inventory` route — still undocumented as intentional).
- Shopping List: `components/hub/ShoppingListView.tsx` — **3,181 LOC** (stable since v1) · still the only sanctioned legacy-localStorage-queue user. The rule stands: gap-2a work goes through the existing shopping-add APIs, never a new queue path.

## 4 · Test reality

**Still zero tests in-domain** — now unique among campaign domains. The three cheapest wins remain exactly v1's list: recipe scale ratios (pure), low-stock threshold boundary (pins the keystone's semantics), extraction fixture corpus (pins prompt drift). None started.

## 5 · Size & risk map (unchanged)

| File | LOC | Risk |
|---|---|---|
| `components/hub/ShoppingListView.tsx` | 3,181 | Keystone work lands near it; extract add/dedupe logic first ([file 3 · O3](<3 - FABLED 2 — Optimization Plan.md>)). |
| `api/recipes/extract-from-url/route.ts` | ~21 KB | Parser + AI in one route, no fixtures. |
| `features/recipes/hooks.ts` | ~23 KB | All recipe client state. |
