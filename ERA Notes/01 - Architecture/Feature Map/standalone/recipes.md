# Recipes

**Type:** Standalone
**Route:** `/recipe`
**Vault doc:** `ERA Notes/02 - Standalone Modules/Recipes/`

## What it does

The recipe book — view, edit, cook. Recipes have ingredients, instructions (steps), cooking-mode for hands-free walkthrough, and version compare for tracking edits over time. This module owns the only "notebook" aesthetic in the app (dark-leather gradient, sticky notes, page-flip) — do not replicate elsewhere.

## Files at a glance

- **Page entry**: `src/app/recipe/page.tsx`, `src/app/recipe/layout.tsx`
- **Components (under `src/components/web/`)**:
  - `WebRecipes.tsx`
  - `RecipeDialog.tsx`
  - `RecipeDetailView.tsx`
  - `RecipeSidePanel.tsx`
  - `RecipeCookingMode.tsx`
  - `RecipeVersionCompare.tsx`
- **Hooks**: `src/features/recipes/hooks.ts`
- **API routes**: `src/app/api/recipes/route.ts`, `src/app/api/recipes/[id]/route.ts`
- **DB tables**: `recipes` (+ joined `recipe_ingredients`, `recipe_steps`, `recipe_versions` — confirm in `schema.sql`)

## Common edit scenarios

- **"Edit recipe cooking mode"** → `src/components/web/RecipeCookingMode.tsx`.
- **"Edit recipe form / fields"** → `src/components/web/RecipeDialog.tsx` + API zod in `src/app/api/recipes/route.ts`.
- **"Add an ingredient autosuggest"** → may already integrate with Catalogue ([./catalogue.md](./catalogue.md)); check `hooks.ts`.

## Gotchas

- **The notebook aesthetic is unique to this module.** Inset glow, bronze-shimmer rim, sticky notes — see root `README.md` "Backgrounds" + "Cards". Do not pull this look into other modules.
- Recipes use the Caveat handwriting font for sticky-note asides (`.era-hand`) — never elsewhere.

## Connected modules

- **Meal Planning** ([./meal-planning.md](./meal-planning.md)) — drops a recipe onto a day.
- **Shopping List** ([../junction/shopping-list.md](../junction/shopping-list.md)) — ingredients → list.
- **Inventory** ([./inventory.md](./inventory.md)) — pantry check before cooking.
- **Catalogue** ([./catalogue.md](./catalogue.md)) — saved item templates can back ingredients.
