# Preferences

**Type:** Standalone
**Routes:** `/settings`
**Vault doc:** `ERA Notes/02 - Standalone Modules/Preferences/`

## What it does

User settings — theme, LBP exchange rate, custom month start day, date prefs, dashboard section order, onboarding state.

## Files at a glance

- **Page entry**: `src/app/settings/page.tsx`, `src/app/settings/SettingsPage.tsx`, `src/app/settings/layout.tsx`
- **Components**:
  - `src/components/settings/SettingsDialog.tsx`
  - `src/components/settings/CategoryManagement.tsx`
  - `src/components/settings/NotificationSettings.tsx`
  - `src/components/settings/SortableItem.tsx`
- **Hooks**:
  - `src/features/preferences/usePreferences.ts`
  - `src/features/preferences/useUserPreferences.ts`
  - `src/features/preferences/useLbpSettings.ts`
  - `src/features/preferences/useDatePreferences.ts`
  - `src/features/preferences/useSectionOrder.ts`
  - `src/features/preferences/useOnboarding.ts`
- **API routes**: `src/app/api/user-preferences/`
- **DB tables**: `user_preferences` (confirm in `schema.sql`)
- **Contexts**: `src/contexts/ThemeContext.tsx`

## Common edit scenarios

- **"Add a new user preference"** → DB column → API zod → matching hook in `src/features/preferences/` → UI in `SettingsPage.tsx`.
- **"Edit theme switching"** → `src/contexts/ThemeContext.tsx`. Remember Hard Rule #17: theme changes invalidate **all** queries.
- **"Reorder dashboard sections"** → `useSectionOrder.ts` + `SortableItem.tsx`.

## Gotchas

- **LBP is stored in thousands** per user pref (Hard Rule from Preferences vault doc). Never store the raw value.
- **Theme = `data-theme` attribute** on `<html>` + `--theme-bg` CSS variable. Never hardcode bg colors.

## Connected modules

- **Theming** ([../cross-cutting/theming.md](../cross-cutting/theming.md)).
- **Notifications** — preferences gate which alerts get sent.
- **Transactions / Budget Allocation** — custom month start day affects period math.
