---
name: ui-guardrails
description: "UI/UX hard rules for this app operationalized: theming via CSS variables, person-absolute color identity, opaque floating panels, fixed-header offsets, decimal inputs, Undo toasts, click semantics, mobile-first verification. Use when creating or editing ANY component, page, style, or toast."
---

# /ui-guardrails — UI Rules That Are Bugs If Broken

> **Contract:** these are not style preferences — each rule below encodes a shipped bug or a household-UX decision. Before writing a new component, open a **sibling component in the same module** and match its idioms (theme classes, spacing, motion). You are extending a design system, not authoring one.

## 1. Theming — never hardcode a background

- Backgrounds come from the theme system: `--theme-bg` CSS variable + `data-theme` attribute. Components use `useThemeClasses()` (`src/hooks/useThemeClasses.ts`) → `tc.*` classes, or existing theme-aware utility classes found in sibling components.
- Never write `bg-black`, `bg-slate-900`, `bg-[#0a0a0a]`, etc. on page/panel surfaces.
- Theme switching invalidates ALL queries (Hard Rule 10) — don't cache theme-derived values outside React state.
- Themes: blue / pink / frost / calm. Verify anything visual in at least the current + one other theme.

## 2. Color identity — person-absolute, never role-relative (Hard Rule 14)

The blue-theme user renders `blue-400/500` on BOTH phones, always; the pink-theme user renders `pink-400/500` on both, always. Colors follow the **person**, not the viewer:

```ts
const { theme } = useTheme();
// theme === "pink" → current user = pink, partner = blue; otherwise reversed
const currentUserColor = theme === "pink" ? "pink" : "blue";
const partnerColor     = theme === "pink" ? "blue" : "pink";
```

Full doc: `ERA Notes/01 - Architecture/Color Identity.md`. If you're coloring rows/avatars/badges by owner, derive from `user_id` + this mapping — never "mine = theme color".

## 3. Red policy (Hard Rule 3)

- Individual task/item **rows**: never red — use theme colors (pink/cyan).
- Container **headers**: red/amber allowed.
- Overdue date labels: `text-white/40`, not red.
- Destructive-action toasts use `ToastIcons.delete` (amber) — red is reserved for `ToastIcons.error`.

## 4. Floating panels must be opaque (Hard Rule 15)

Dropdowns, popovers, command palettes, autocomplete panels — anything overlaying page content — use `tc.bgPage` from `useThemeClasses()` as the background. **Never `neo-card`** (semi-transparent glass) on floating panels: text behind bleeds through. `neo-card` is only for non-overlaid, in-flow cards.

## 5. Fixed/sticky headers must not eat content (Hard Rule 16)

- `fixed`/`sticky` header of height `h-14` ⇒ the content below gets `pt-14`. Always paired.
- Standalone/isolated pages that render their own layout (NFC, guest portal, …): confirm the root layout's `ConditionalHeader` and `MobileNav` are configured to hide on that route — otherwise the global fixed header overlaps your page.
- Verify on the mobile viewport; that's where the overlap bites.

## 6. Number inputs (Hard Rule 19)

Never `type="number"`. Always:

```tsx
<input type="text" inputMode="decimal" ... />
```

(`type="number"` triggers the iOS scroll-wheel value-change bug and inconsistent decimal parsing.)

## 7. Toasts — every mutation toast has Undo (Hard Rule 1)

Verified pattern (`src/features/trips/hooks.ts`):

```ts
toast.success("Thing created", {
  icon: ToastIcons.create,   // from src/lib/toastIcons.tsx: .create .update .delete .error
  duration: 4000,
  action: { label: "Undo", onClick: undo },
});
toast.error("Failed to create thing", { icon: ToastIcons.error }); // errors: no Undo needed
```

The `undo` closure performs the inverse mutation and re-invalidates. If an action is genuinely not undoable (e.g. sending a notification), say so in your report instead of shipping a fake Undo.

## 8. Click semantics (Hard Rule 2)

Single click/tap = open detail view. Double click/tap = toggle pin/favorite. Don't rebind these per feature.

## 9. Drag & motion (Common Patterns doc)

Never mix `<motion.div>` (Framer Motion) with HTML5 `draggable`/drag events on the same element — pick one system per interaction. dnd-kit is in the dependency set for sortable lists; check what the sibling components in the module already use and match it.

## 10. Boundaries

- **Never edit `src/components/ui/`** — enforced by a PreToolUse hook. Wrap or compose instead.
- Icons: use the futuristic SVG set where one exists (toasts: `ToastIcons`); otherwise `lucide-react` like the rest of the app.
- Pages stay thin; interactive logic lives in feature components/hooks.

## 11. Mobile-first verification (Hard Rule 5) — do this before "done"

1. `pnpm dev`, open the changed screen at a phone viewport (~390 × 844).
2. Check: nothing under the header (rule 5 above), no horizontal scroll, FAB/bottom-nav don't cover your action buttons, touch targets ≥ ~40 px, decimal keyboard appears on amount fields.
3. Re-check in a second theme (rule 1) if you touched colors/surfaces.

## 12. Fast-capture flows (expense entry, hub quick actions)

The app's core promise is near-effortless capture — CLAUDE.md's interaction model makes Hub Chat the high-frequency path and forms the precision tools. When touching any capture surface (expense form, quick-add, hub actions):

- **Never add a blocking confirmation dialog** to a capture flow — the pattern is act immediately + Undo toast (§7). Confirmations are for destructive bulk actions only.
- **Defaults do the work**: preselect the user's usual account/category/payment method where the module already computes suggestions — don't add a required field to a capture path without questioning it.
- **Count the taps** before/after your change; a capture-flow change that adds taps needs explicit justification in your report.
- Amount fields: decimal keyboard via §6, auto-focused where the flow expects immediate typing.

## 13. If you added a page or route

Atlas entry + `App Routes and Icons.md` update are mandatory — handled in `finish-task` (Hard Rule 23). Flag it in your slice plan now so it isn't forgotten.
