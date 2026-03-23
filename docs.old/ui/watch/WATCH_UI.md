# Watch UI

> **Page:** `src/app/expense/` (watch mode renders here) | **Module:** `src/components/watch/`
> **Status:** Active

## Overview

The Watch UI is a circular, WearOS-optimized interface for quick voice expense entry and balance checking. It activates when the user sets view mode to "Watch" in Settings. The view switcher stores the preference in `localStorage` (key: `app-view-mode`).

## View Switcher

Three view modes available in Settings → View tab:

| Mode | Description |
|---|---|
| **Mobile** (default) | Normal tab navigation, full UI |
| **Watch** | Watch interface at `/expense`, hides nav/header |
| **Web** | Desktop layout (coming soon) |

**Hook:** `src/hooks/useViewMode.ts` — manages `mobile` \| `web` \| `watch` state with localStorage persistence.

**Routing:** `src/components/layouts/TabContainer.tsx` checks view mode on load. Watch mode renders `WatchView` full-screen. MobileNav and ConditionalHeader are hidden in watch/web modes.

## Watch Interface (`SimpleWatchView`)

**File:** `src/components/watch/SimpleWatchView.tsx`

### Main screen

- Large balance display (amber→orange→pink gradient, 56px)
- Pending drafts badge (shows count + total amount when drafts exist)
- Projected balance after drafts: `Current Balance − Pending Drafts`
- 100px microphone button with scale animation on press
- Voice preview during recording
- Swipe hint labels

### Insights screen (swipe left)

- Today's total spending
- Transaction count
- Pending drafts count
- Swipe right to return

### Layout specs

- Circular container, `border-radius: 50%`, max 480px
- Padding: 2.5rem
- Border: 4px with glow
- Swipe threshold: 100px, transitions: 0.3s ease-out

## Error Handling

`src/components/watch/WatchErrorBoundary.tsx` wraps the watch view. Catches runtime errors and displays a circular error message with a reload button.

### CSS compatibility notes (watch browsers)

- **Removed**: `backdrop-filter` / `backdrop-blur` (not supported on all watch browsers)
- **Use instead**: `background: rgba(59, 130, 246, 0.4)` with plain border

### Loading states

1. Initial mount → show spinner (prevents SSR hydration issues — uses `isMounted` guard)
2. Data loading → spinner
3. No accounts configured → error message
4. Ready → main interface

## Key Files

- `src/hooks/useViewMode.ts` — view mode hook (localStorage)
- `src/components/watch/SimpleWatchView.tsx` — main watch interface
- `src/components/watch/WatchErrorBoundary.tsx` — error boundary
- `src/components/settings/SettingsDialog.tsx` — View tab with radio buttons
- `src/components/layouts/TabContainer.tsx` — view mode routing
- `src/components/layouts/MobileNav.tsx` — hidden in watch/web modes

## Gotchas

- Voice recognition requires Chrome/Edge; may not work on all watch browsers
- Watch view lives at `/expense` route — dashboard always shows the regular dashboard regardless of view mode
- Drafts created in watch view should be reviewed/confirmed in mobile view
- `balance_set_at` auto-refreshes every 5 seconds in watch mode
- Do NOT use `backdrop-filter` in watch-specific CSS — simplify to plain `rgba()` backgrounds
