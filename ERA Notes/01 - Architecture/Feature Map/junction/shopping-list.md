# Shopping List

**Type:** Junction
**Vault doc:** `ERA Notes/03 - Junction Modules/Shopping List/`

## What it does

A live, household-shared list of things to buy. Items can come from a recipe (ingredient → list), from inventory (depleted stock), or directly typed in Hub Chat. Buying a shopping list item can restock inventory.

## Files at a glance

- **Main view**: `src/components/hub/ShoppingListView.tsx`
- **Dialogs**:
  - `src/components/web/AddToShoppingDialog.tsx`
- **Hooks**: `src/features/hub/hooks.ts` (shopping data lives in hub)
- **API routes**: `src/app/api/hub/` (under shopping endpoints — confirm)
- **DB tables**: hub-related (see Hub Chat module)
- **Legacy offline queue**: `src/contexts/SyncContext.tsx` (localStorage; **only** for the shopping list)

## Common edit scenarios

- **"Edit the shopping list UI"** → `src/components/hub/ShoppingListView.tsx`.
- **"Add a category badge per row"** → also extend `AddToShoppingDialog.tsx`.

## Gotchas

- This is the **only** place that still uses the legacy localStorage offline queue. Don't add to that pattern — new code uses `src/lib/offlineQueue.ts` (IndexedDB).
- Shared state with the partner — every mutation goes through realtime via `supabaseBrowser()`.

## Connected modules

- **Hub Chat** ([./hub-chat.md](./hub-chat.md)) — host surface.
- **Recipes** ([../standalone/recipes.md](../standalone/recipes.md)) — ingredient → list.
- **Inventory** ([../standalone/inventory.md](../standalone/inventory.md)) — buy → restock.
