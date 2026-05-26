# Categories

**Type:** Standalone
**Routes:** part of `/expense` (`/expense/categories`); managed via dialogs
**Vault doc:** `ERA Notes/02 - Standalone Modules/Categories/`

## What it does

Categories and subcategories label a transaction. Each user has their own list (`user_categories`) with color + icon. Cross-user slug matching is the hard rule here (see vault doc) — household partners share a category space by slug.

## Files at a glance

- **Sub-route**: `src/app/expense/categories/`
- **UI**:
  - `src/components/expense/CategoryGrid.tsx`
  - `src/components/expense/SubcategoryGrid.tsx`
  - `src/components/expense/AddCategoryDialog.tsx`
  - `src/components/expense/NewCategoryDrawer.tsx`
  - `src/components/expense/NewSubcategoryDrawer.tsx`
  - `src/components/expense/CategoryManagerDialog.tsx`
  - `src/components/settings/CategoryManagement.tsx`
- **Hooks**:
  - `src/features/categories/useCategoriesQuery.ts`
  - `src/features/categories/useCategoryManagement.ts`
  - `src/features/categories/hooks.ts`
- **API routes**:
  - `src/app/api/categories/route.ts`
  - `src/app/api/user-categories/route.ts`
- **DB tables**: `user_categories`
- **Cache config**: `CATEGORIES = 1 h` staleTime

## Common edit scenarios

- **"Change the category grid look"** → `CategoryGrid.tsx` / `SubcategoryGrid.tsx`.
- **"Add a new category attribute (e.g. budget cap)"** → DB column → API zod → `useCategoriesQuery` → UI in grid + manager dialog.
- **"Manage categories in Settings"** → `src/components/settings/CategoryManagement.tsx`.

## Gotchas

- **Cross-user slug matching:** a partner's category with the same slug is treated as "the same category" for shared views. Changing a slug breaks that link.
- Theme colors come through the category's stored color value — but the rule against "no red on individual rows" applies (Hard Rule #3); container headers can use red/amber, not the row.

## Connected modules

- **Transactions** — every transaction picks one.
- **Statement Import** — merchant mappings target a category.
- **Budget Allocation** — envelopes are per-category.
- **Household Sharing** — slug matching makes categories shared across partners.
