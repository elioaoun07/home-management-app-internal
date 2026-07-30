---
created: 2026-07-18
type: deep-dive
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
predecessor: ../FABLED 2/
tags:
  - pm/fabled3
  - module/kitchen
---

# Kitchen · FABLED 3.5 — Successor Briefing

[_index](<_index.md>) · [3.1 Current](<1 - FABLED 3 — Current Implementation.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>)

## Who should read this

You are an AI model about to touch recipes, meal planning, inventory, catalogue, chores, or the shopping list. Good news: **this is the safest campaign in the app for you** — standalone tools, house patterns, no money, no recurrence engines, nothing human-first. It is deliberately recommended as the practice ground for lower-tier models to ship their first Kitchen tests and loop wiring.

## First 10 minutes in this cluster

```bash
git log --format="%h %ad %s" --date=short --since=2026-07-18 -- src/features/recipes src/features/meal-planning src/features/inventory src/features/catalogue src/features/chores
find src/features/recipes src/features/meal-planning src/features/inventory -name "*.test.*"   # empty as of 2026-07-18 — first hit means the zero-test era ended; update _index
```

Then read: [FABLED 2 file 1](<../FABLED 2/1 - FABLED 2 — Current Implementation.md>) (fully current) → the vault docs for the specific tool you're touching.

## Task-tier map

| Task archetype | Tier | Route |
|---|---|---|
| Recipe/meal-plan/inventory/chores UI + CRUD | **any-model** | `add-feature` + `ui-guardrails`; standalone-import rule (no cross-feature imports) |
| **The ingredient-shape contract test (O-3.1)** | **any-model — designated first task** | ~30 lines; fixture the shape `allergenMatch` consumes; instructions in [3.3](<3 - FABLED 3 — Optimization Plan.md>) |
| Shopping-list logic | **mid-tier+** | it's a Junction (Hub + Recipes + Inventory) AND uses the legacy localStorage queue — don't migrate it, don't extend it |
| Recipe AI surface (extract/optimize/scale/substitute) | **mid-tier+** | zero fixtures exist; write the fixture for your path as part of any change; `timeoutMs` on all AI calls |
| Low-stock → auto-add keystone wiring (O1) | **mid-tier+** | crosses Inventory→Shopping List; the design is written in v2 file 3 — execute, don't redesign |
| Ingredient data-shape changes | **mid-tier+** | blast radius includes Healthcare allergen warnings ([3.1](<1 - FABLED 3 — Current Implementation.md>)) — run `npx vitest run src/lib/health/allergenMatch.test.ts` after |

**Out-of-depth tells — stop if:** you're importing one standalone feature dir from another (use `src/components`/`src/lib`); you're adding to the legacy localStorage shopping queue; an AI recipe call writes anywhere without user confirmation.

## Trap registry

| Trap | Symptom | Guard |
|---|---|---|
| Inventory is mounted inside Catalogue | can't find the inventory page | `src/components/inventory/` renders within Catalogue — there is no `/inventory` route |
| Shopping list = legacy offline queue | offline edits behave differently than other modules | hub-only localStorage queue by design; new offline work uses `src/lib/offlineQueue.ts` |
| Recipe AI surface is fixture-less | prompt drift silently changes extractions | any AI-surface edit ships with its first fixture (O2) |
| Ingredients feed health warnings | "harmless" shape refactor breaks allergen matching | O-3.1's contract test; until it exists, manual check on both accounts |
| Chores live in Reminders' tab | editing `src/app/chores/` (a redirect) | real code: `src/app/reminders/` Chores tab + `src/components/chores/` |

## Verification manifest

| Claim | Command | Expected |
|---|---|---|
| Zero-commit window claim | `git log --oneline c561635..f0a8e19 -- src/features/recipes src/features/meal-planning src/features/inventory src/features/catalogue \| wc -l` | 0 |
| Zero-test status (until O-3.1) | `find src/features/recipes src/features/meal-planning src/features/inventory -name "*.test.*" \| wc -l` | 0 → any hit means rescore Test protection |
| Allergen bridge intact | `grep -rln "useHouseholdAllergens" src/components/web \| wc -l` | ≥2 (warning + detail view) |
| Keystone still unwired | `grep -rn "low.stock\|lowStock" src/components/hub/ShoppingListView.tsx \| wc -l` | 0 = still unwired (O1 open) |

## What FABLED 2 got wrong here

Nothing — stasis is easy to audit. Its one blind spot was structural: it scored "Outward bridges 2" without a category for *inbound* bridges, so the Healthcare allergen consumer (which raises the stakes of Kitchen's data shapes) had no place to register. Gen 3 notes it in file 1; a future generation should score bridge risk bidirectionally.
