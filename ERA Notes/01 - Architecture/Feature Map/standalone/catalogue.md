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
  - `src/components/web/RoomsDialog.tsx` — rename/delete/add rooms (Catalogue → Chores → Rooms)
  - `src/components/web/DisableCatalogueItemDialog.tsx`
  - `src/components/web/AddFlexibleFromCatalogueDialog.tsx`
  - `src/components/items/CatalogueTemplatePicker.tsx`
  - `src/components/items/PromoteToCatalogueDialog.tsx`
  - `src/components/hub/ProductComparisonSheet.tsx`
- **Hooks**:
  - `src/features/catalogue/hooks.ts`
  - `src/features/catalogue/queryKeys.ts`
- **Shared lib**:
  - `src/lib/catalogue/itemPatch.ts` — Zod schemas for item create/PATCH, key-level metadata patch, inverse, `diffMetadata` (KIT-20)
  - `src/lib/catalogue/moduleRoles.ts` — `isPlacesModule` / `pickPlacesModule` (ERA module roles)
- **API routes**: `src/app/api/catalogue/` (rooms: `rooms/route.ts`, `rooms/[id]/route.ts`)
- **DB tables**: `catalogue_modules`, `catalogue_categories`, `catalogue_items` (`revision` — KIT-20), `catalogue_sub_items`, `catalogue_item_calendar_history`, `home_rooms` (+ `catalogue_items.room_ids`) (confirm in `schema.sql`)
- **Tests**: `tests/catalogue-patch.test.ts`

## Common edit scenarios

- **"Edit catalogue item dialog"** → `src/components/web/CatalogueItemDialog.tsx` (per-module fields in `MODULE_FIELD_CONFIG`; Places uses `PLACES_FIELD_CONFIG`). Edits must go through `diffMetadata` — never send a whole `metadata_json`.
- **"Change the picker shown in the item entry form"** → `src/components/items/CatalogueTemplatePicker.tsx`.
- **"Catalogue → Chores section"** → `src/components/web/WebCatalogue.tsx` (`currentLevel === "chores"`); deep link `/catalogue?section=chores` read in `src/app/catalogue/page.tsx`.

## Connected modules

- **Items & Reminders** — promote-from / instantiate-from.
- **Recipes** — ingredients can reference catalogue entries.
- **Inventory** — stock rows can be linked to catalogue items.
- **Hub Chat** — product comparison sheet lives in `components/hub/`.
