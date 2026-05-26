# Household Sharing

**Type:** Junction
**Vault doc:** `ERA Notes/03 - Junction Modules/Household Sharing/`

## What it does

Pairs two users into a household so they see each other's data (accounts, transactions, items, chores, hub messages, etc.). Implemented as a single `household_links` row + `profiles` table. Most API routes apply the linking pattern transparently.

## Files at a glance

- **Components**:
  - `src/components/auth/LinkHouseholdDialog.tsx`
  - `src/components/auth/UserMenu.tsx`
  - `src/components/auth/UserMenuClient.tsx`
- **Hooks**: `src/features/hub/usePartnerId.ts`
- **API routes**: `src/app/api/household/`
- **DB tables**: `household_links`, `profiles`
- **Canonical reference for the pattern**: `src/app/api/accounts/route.ts:28-52`

## Common edit scenarios

- **"Add a new household-aware module"** → in the API route, fetch the active `household_links` partner and include their rows unless `ownOnly=true` is passed (Hard Rule #13). Use `accounts/route.ts` as the template.
- **"Edit the linking dialog"** → `LinkHouseholdDialog.tsx`.

## Gotchas

- **Color identity is person-absolute** (Hard Rule #14): blue-theme user is blue on both phones; pink-theme user is pink on both phones. Don't role-shift by viewer.
- The partner's data should be visible by default — only opt out with `ownOnly=true`.

## Connected modules

- Every standalone module — household linking applies broadly.
