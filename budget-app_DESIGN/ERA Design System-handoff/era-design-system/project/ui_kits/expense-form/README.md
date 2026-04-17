# Expense Form — UI Kit

High-fidelity recreation of ERA.AI's **New Expense Form** (`/app/expense/page.tsx`).

## Files

- `index.html` — interactive click-through. Four theme swatches in the corner.
- `ExpenseFormApp.jsx` — top-level flow: stepper state, success toast, reset.
- `ExpenseComponents.jsx` — atoms + molecules: header, balance row, category grid, step indicator, confirm card, bottom nav.
- `ios-frame.jsx` — starter iOS device chrome (unused inline; we render a trimmed bezel inside `index.html` for a tighter preview, but it's kept in case you want the full iOS keyboard treatment).

## Flow

1. **Amount** — focused numeric input with `$` prefix, calculator + mic icon buttons, five quick-amount chips, optional description.
2. **Category** — 3-col grid of colored tile buttons. Tapping a tile auto-advances (280ms).
3. **Subcategory** — (same component; in the real app a different dataset).
4. **Confirm** — hero-money review card, dual-currency ($+L.L.), confirm and save-draft buttons.
5. **Success** — glassy toast slides in from top, then resets.

## What's faithful to the codebase

- Color tokens lifted from `theme-colors.ts` (blue / pink / frost / calm).
- `useThemeClasses` glow strengths encoded in `colors_and_type.css`.
- Step-auto-advance, quick-amount chip row, and dual-currency display match `MobileExpenseForm.tsx`.
- Haptics / voice NLP / IndexedDB are **mocked** — this is a visual prototype.

## Known simplifications

- Icons are Lucide-style inline SVGs, standing in for `FuturisticIcons.tsx`.
- Framer Motion transitions replaced with CSS transitions.
- Calculator dialog and real mic listener are not wired up.
