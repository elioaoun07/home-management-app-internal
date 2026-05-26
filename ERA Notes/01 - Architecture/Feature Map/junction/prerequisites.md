# Prerequisites

**Type:** Junction
**Vault doc:** `ERA Notes/03 - Junction Modules/Prerequisites/`

## What it does

An item can be **dormant** until its prerequisites are met (typically an NFC tap at a specific location, or another item being completed). The trigger engine flips dormant → pending when the prerequisite fires.

## Files at a glance

- **Engine**: `src/lib/prerequisites/` (trigger evaluation)
- **API route**: `src/app/api/items/[id]/prerequisites/route.ts`
- **UI**: `src/components/items/PrerequisitePicker.tsx`
- **DB tables**: item prerequisite rows (see `schema.sql`)
- **Hooks**: tied to `useItems.ts` / `useItemActions.ts`

## Common edit scenarios

- **"Add a new prerequisite type (e.g. time-of-day)"** →
  1. Extend the engine in `src/lib/prerequisites/` to evaluate the new type.
  2. Update DB enum/column.
  3. Add to `PrerequisitePicker.tsx`.
- **"Edit the picker UI"** → `src/components/items/PrerequisitePicker.tsx`.

## Gotchas

- Trigger evaluation must be cheap — runs on every NFC tap and on item completes.
- Use the schedule-bundle RPC pattern when reading the parent item + prerequisite rows together (Hard Rule #21).

## Connected modules

- **NFC Tags** ([../standalone/nfc-tags.md](../standalone/nfc-tags.md)) — most common trigger.
- **Items & Reminders** ([../standalone/items-and-reminders.md](../standalone/items-and-reminders.md)) — owns the items.
