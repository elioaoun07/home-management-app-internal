# UI Polish & Animation System

> **Key files:** `src/app/globals.css`, `src/components/ui/button.tsx`, `src/app/layout.tsx`
> **Status:** Active

## Overview

Design system constants and CSS utility classes for consistent premium interactions across the app.

## Design System Constants

### Shadow Hierarchy

```css
shadow-sm   → Subtle elements (default resting state)
shadow-md   → Hovered cards/elements
shadow-lg   → Important CTAs, focused inputs
shadow-xl   → Primary actions
shadow-2xl  → Hero elements, modals, headers
```

### Animation Timing

```css
duration-200 → Buttons, micro-interactions (standard)
duration-300 → Cards, panel transitions
duration-700 → Page-level entrances
```

### Glassmorphism Levels

```css
backdrop-blur-sm  → Subtle depth (cards)
backdrop-blur-md  → Navigation bar
backdrop-blur-xl  → Sticky headers, modals
```

## CSS Utility Classes (`globals.css`)

| Class | Effect | Usage |
|---|---|---|
| `.shimmer` | 2.5s animated light sweep | Headers, stat cards, feature cards |
| `.glow-pulse-primary` | 2s pulsing box-shadow (blue) | Primary buttons, progress bars, CTA |
| `.spring-bounce` | 0.6s spring entrance (scale 0.8→1.05→1) | Stat cards, action buttons, toggles |
| `.transform-3d` | `preserve-3d` + `perspective: 1000px` | Feature cards with depth hover |

## Haptic Feedback Patterns

```typescript
navigator.vibrate(10);        // Standard tap — nav buttons, category select
navigator.vibrate(5);         // Quick light tap — view toggles
navigator.vibrate([5, 5, 5]); // Triple premium pulse — back button in expense form
```

Always guard with `if (navigator.vibrate)` — progressive enhancement only.

## GPU Acceleration

Applied globally in `globals.css` base layer:

```css
[class*="animate"], [class*="transition"] {
  will-change: transform, opacity;
  backface-visibility: hidden;
  transform: translateZ(0);
}
```

Prioritize `transform` and `opacity` over layout properties (`top`, `margin`, `width`) — compositor-only, no reflow.

## Layout Baseline (`layout.tsx`)

```tsx
<html className="scroll-smooth">
<body className="overflow-x-hidden">
```

## Hover Interaction Patterns

```css
/* Lift effect (buttons, cards) */
hover:-translate-y-0.5   → Subtle 0.5px lift (buttons)
hover:-translate-y-1     → 1px lift (cards)

/* Scale */
hover:scale-105          → Cards, icons
active:scale-95          → Button press feedback

/* Shadow enhancement on hover */
hover:shadow-lg          → Secondary actions
hover:shadow-xl          → Primary CTAs
```

## Key Component Patterns

**Staggered card entrance** — use animation delays `0ms, 100ms, 200ms, 300ms` for natural flow.

**Progress bars** — add `.glow-pulse-primary` to make them feel dynamic.

**Top-ranked items** (e.g. highest spending category) — `.glow-pulse-primary` draws attention without being intrusive.

## Accessibility

- All animations respect `prefers-reduced-motion` (native CSS behavior — no JS needed)
- Haptic feedback is progressive enhancement (never required for functionality)
- Color contrast maintained alongside glow effects
- All animations non-essential — enhance, don't block

## Gotchas

- `backdrop-filter: blur()` not supported on older watch/embedded browsers — always provide solid color fallback (see [WATCH_UI.md](../ui/watch/WATCH_UI.md))
- `.shimmer` uses a `::after` pseudo-element — ensure parent has `position: relative; overflow: hidden`
- `will-change: transform` on too many elements can increase VRAM usage — apply globally only on animate/transition classes, not all elements
