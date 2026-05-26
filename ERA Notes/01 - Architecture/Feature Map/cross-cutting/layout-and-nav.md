# Layout & Navigation

**Type:** Cross-cutting (system)

## What it does

The app shell — fixed header at the top, fixed bottom nav (mobile) or rail (desktop), a floating FAB, and the content scroll area between them. The shell hides itself on isolated routes (`/g/[tag]`, `/nfc/[tag]`, etc.).

## Files at a glance

- **Layouts**:
  - `src/app/layout.tsx` (root)
  - `src/app/providers.tsx`
  - `src/components/layouts/ConditionalHeader.tsx` ← hides on isolated routes
  - `src/components/layouts/MobileNav.tsx`
  - `src/components/layouts/TabContainer.tsx`
  - `src/components/layouts/ExpenseShell.tsx`
  - `src/components/layouts/GuestHeader.tsx`
- **Navigation**:
  - `src/components/navigation/AppModeToggle.tsx`
  - `src/components/navigation/SemiDonutFAB.tsx`
- **Web variant**:
  - `src/components/web/WebBottomNav.tsx`
  - `src/components/web/WebViewContainer.tsx`
- **Contexts**:
  - `src/contexts/TabContext.tsx` (active tab, deep-link routing)
  - `src/contexts/AppModeContext.tsx` (`"budget"` vs `"items"` mode)
- **Prefetch helpers**: `src/features/navigation/prefetchTabs.ts`
- **Deep-link handler**: `src/components/DeepLinkHandler.tsx`

## Common edit scenarios

- **"Change the bottom nav order / icons"** → `src/components/layouts/MobileNav.tsx`.
- **"Add a new tab"** → add to `TabContext` enum, `MobileNav` items, `prefetchTabs` mapping, and the matching `/<route>` page.
- **"Hide the header on a new isolated route"** → `ConditionalHeader.tsx` — add the route prefix to the skip list. Also update `MobileNav` (Hard Rule #16).
- **"Edit the FAB"** → `SemiDonutFAB.tsx`. `AppMode` decides what it targets (budget vs items).

## Gotchas

- **Fixed/sticky headers** must have matching content top padding (Hard Rule #16). `h-14` header → `pt-14` on content. If you forget, the header overlaps content on isolated routes.
- **Mobile nav reserves 72 px** (`MOBILE_NAV_HEIGHT`) — content must reserve bottom padding for it.
- The shell is mobile-first; the desktop rail kicks in at `md:` (224–256 px wide).

## Connected modules

- Every page renders inside this shell except isolated routes (`/g/*`, `/nfc/[tag]`, `/welcome`, `/login`, `/offline`).
