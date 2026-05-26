# Catalogue

**Type:** Standalone
**Route:** `/catalogue`
**Vault doc:** `ERA Notes/02 - Standalone Modules/Catalogue/`

## What it does

A library of reusable templates — items, tasks, recipe ingredients, products. Promote a one-off item to a catalogue entry; instantiate items from a catalogue template; compare products.

## Files at a glance

- **Page entry**: `src/app/catalogue/page.tsx`, `src/app/catalogue/layout.tsx`
- **Components**:
  - `src/components/web/WebCatalogue.tsx`
  - `src/components/web/CatalogueSidePanel.tsx`
  - `src/components/web/CatalogueItemDialog.tsx`
  - `src/components/web/CatalogueItemDetailDialog.tsx`
  - `src/components/web/CatalogueTaskItemDialog.tsx`
  - `src/components/web/CatalogueCategoryDialog.tsx`
  - `src/components/web/CatalogueModuleDialog.tsx`
  - `src/components/web/DisableCatalogueItemDialog.tsx`
  - `src/components/web/AddFlexibleFromCatalogueDialog.tsx`
  - `src/components/items/CatalogueTemplatePicker.tsx`
  - `src/components/items/PromoteToCatalogueDialog.tsx`
  - `src/components/hub/ProductComparisonSheet.tsx`
- **Hooks**:
  - `src/features/catalogue/hooks.ts`
  - `src/features/catalogue/queryKeys.ts`
- **API routes**: `src/app/api/catalogue/`
- **DB tables**: `catalogue_items` (confirm in `schema.sql`)

## Common edit scenarios

- **"Edit catalogue item dialog"** → `src/components/web/CatalogueItemDialog.tsx`.
- **"Change the picker shown in the item entry form"** → `src/components/items/CatalogueTemplatePicker.tsx`.

## Connected modules

- **Items & Reminders** — promote-from / instantiate-from.
- **Recipes** — ingredients can reference catalogue entries.
- **Inventory** — stock rows can be linked to catalogue items.
- **Hub Chat** — product comparison sheet lives in `components/hub/`.
