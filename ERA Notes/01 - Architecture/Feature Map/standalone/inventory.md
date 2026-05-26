# Inventory

**Type:** Standalone
**Route:** part of catalogue / dedicated dialog
**Vault doc:** `ERA Notes/02 - Standalone Modules/Inventory/`

## What it does

Pantry / household stock. Each item has a quantity; restocking writes a history entry.

## Files at a glance

- **Components**:
  - `src/components/inventory/InventoryView.tsx`
  - `src/components/inventory/InventoryItemDialog.tsx`
  - `src/components/inventory/RestockDialog.tsx`
  - `src/components/inventory/index.ts`
- **Hooks**: `src/features/inventory/hooks.ts`
- **API routes**: `src/app/api/inventory/`
- **DB tables**: `inventory` (confirm in `schema.sql`)

## Common edit scenarios

- **"Change restock flow"** → `src/components/inventory/RestockDialog.tsx`.
- **"Edit inventory item fields"** → `InventoryItemDialog.tsx` + API zod.

## Connected modules

- **Shopping List** ([../junction/shopping-list.md](../junction/shopping-list.md)) — buying restocks inventory.
- **Recipes** ([./recipes.md](./recipes.md)) — cooking can decrement inventory.
- **Catalogue** ([./catalogue.md](./catalogue.md)) — catalogue items can back inventory rows.
