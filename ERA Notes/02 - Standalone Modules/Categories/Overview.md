---
created: 2026-03-23
type: overview
module: categories
module-type: standalone
tags:
  - type/overview
  - module/categories
---

# Categories

> **Source:** `src/features/categories/`
> **API:** `src/app/api/categories/`
> **DB Tables:** `user_categories`
> **Type:** Standalone

## Docs in This Module

- [[Category Customization]]
- [[Category Customization Quickstart]]

## Key Concepts

- Drag-drop reordering
- Custom colors applied to dashboard
- Unified `/api/categories/manage` endpoint
- **Cross-user category matching must use `slug`, never `name`** — `user_categories` has a `slug` column (auto-generated deterministic kebab from `name`, e.g. `"Food & Groceries"` → `"food-groceries"`). When resolving one user's category/subcategory in the context of another user's data (e.g. partner confirms a recurring payment, budget allocation merging), always match on `slug`. Name is display text and is cosmetic; slug is the stable canonical cross-user key. Fall back to name matching only when slug is null/absent (pre-existing data). Accounts have no slug column — name-based matching there is acceptable.

## See Also

- [[Common Patterns]]
