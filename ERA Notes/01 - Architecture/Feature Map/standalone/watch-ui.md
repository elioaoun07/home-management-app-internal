# Watch UI

**Type:** Standalone
**Route:** `/watch`
**Vault doc:** `ERA Notes/02 - Standalone Modules/Watch UI/`

## What it does

A minimal Wear OS / smartwatch surface — primary action is voice entry; secondary is a glanceable face card.

## Files at a glance

- **Page entry**: `src/app/watch/page.tsx`, `src/app/watch/layout.tsx`
- **Components**:
  - `src/components/watch/WatchView.tsx`
  - `src/components/watch/SimpleWatchView.tsx`
  - `src/components/watch/WatchEraFace.tsx`
  - `src/components/watch/WatchVoiceEntry.tsx`
  - `src/components/watch/WatchErrorBoundary.tsx`
- **API routes**: shared with Transactions, AI Assistant
- **Related work-in-progress**: `docs/WEAR_OS_NATIVE_APP_IMPLEMENTATION.md` (root, untracked)

## Common edit scenarios

- **"Change the watch voice button"** → `WatchVoiceEntry.tsx`.
- **"Edit the watch face card"** → `WatchEraFace.tsx`.

## Gotchas

- Watch viewports are tiny — densest layout in the app. Mobile-first rule applies extra hard.
- Wraps every render in `WatchErrorBoundary.tsx` because crashes on a watch are very visible.

## Connected modules

- **AI Assistant** — voice intent.
- **Transactions** — voice entry creates a transaction (or draft).
