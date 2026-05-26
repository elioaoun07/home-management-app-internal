# Theming

**Type:** Cross-cutting (system)

## What it does

Four themes: `blue` (default), `pink`, `frost`, `calm`. Switch via the user's `data-theme` attribute on `<html>`; CSS variables in `src/app/globals.css` re-resolve to the active theme. Hard Rule: theme changes invalidate **all** React Query caches (themed data may need re-fetch).

## Files at a glance

- **Tokens (source of truth)**:
  - `src/app/globals.css` (variables)
  - `colors_and_type.css` in the ERA Design System (portable copy)
- **Context**: `src/contexts/ThemeContext.tsx`
- **Class helper hook**: `useThemeClasses()` (exports `tc.bgPage`, etc.)
- **Animation on switch**: `src/components/ThemeTransition.tsx`
- **Provider**: `src/components/theme-provider.tsx`

## Common edit scenarios

- **"Add a new theme"** →
  1. New `[data-theme="name"]` block in `src/app/globals.css` with the full token set.
  2. Add to the picker in `src/app/settings/SettingsPage.tsx`.
  3. Update `useThemeClasses()` mapping.
- **"Change a color across all surfaces"** → edit the variable in `globals.css`; don't hunt for hardcoded hex values.

## Gotchas

- **Theme changes invalidate ALL queries** (Hard Rule #17). Don't rely on cached data surviving a theme switch.
- **Floating panels must be opaque** with `tc.bgPage`, not `neo-card` (Hard Rule #15).
- **Person-absolute color identity** (Hard Rule #14) — same person = same color across phones; the theme picker only changes the *current viewer's* surface tokens, not the partner's identity color.

## Connected modules

- **Preferences** — stores the theme choice.
- **ERAMark** — the mark's hue is themed too.
