# ERA Mark — Implementation Guide for Claude Code

This package gives you **one job**: put the animated `ERAMark` at the top of every module's header in the app, and have it transition smoothly when the user navigates between modules.

---

## What you get

| File | Purpose |
|------|---------|
| `ERAMark.jsx` | Drop-in React component. Self-contained. |
| `ERAMark.css` | All styles + keyframes. Scoped to `.era-mark`. |
| `demo.html` | Standalone preview — open in a browser to see it. |
| `README.md` | This file. |

---

## The only two animations

When the `module` prop changes on `<ERAMark>`, **two things happen in parallel over 1.8 seconds**:

1. **Core color bleeds** — the center dot's hue slowly morphs from the old module's color to the new one. Driven by CSS transitions on `--hue`, `--sat`, `--lum`.
2. **Cue layers cross-fade** — the previous module's cue (dots, hands, vapor, EKG…) fades out while the new one fades in. Both keep animating during the fade, so they *overlap* and dissolve into each other.

That's it. No flashes, no bursts, no scale jumps.

---

## Where to use it

**In every module's header, on the left side, at ~40px.** The mark is how the user knows which module they're in, and the animation provides continuity when they switch.

### Example header

```jsx
import { ERAMark } from './ERAMark';

function ModuleHeader({ currentModule, title }) {
  return (
    <header className="app-header">
      <ERAMark module={currentModule} size={40} />
      <h1>{title}</h1>
      {/* …nav, actions, user menu */}
    </header>
  );
}
```

**`currentModule` must be one of:** `financial`, `recipe`, `schedule`, `health`, `home`, `trip`, `fitness`, `outfit`, `chat`, `memory`.

### How to drive the transition

Just pass the current module's key to `<ERAMark module={...}>`. When the route / active-module state changes, React re-renders with the new prop, and the CSS transitions do the rest. **Do not remount the component** — that would kill the animation. Keep the same `<ERAMark>` instance mounted and only change the `module` prop.

```jsx
// ✅ RIGHT — same component, new prop, animation plays.
<ERAMark module={currentModule} size={40} />

// ❌ WRONG — unmount/remount kills the transition.
{currentModule === 'health' && <ERAMark module="health" />}
{currentModule === 'fitness' && <ERAMark module="fitness" />}
```

Typical wiring:

```jsx
// App.jsx
const currentModule = useModuleFromRoute(); // 'health', 'fitness', etc.

return (
  <>
    <AppHeader currentModule={currentModule} />
    <Outlet />
  </>
);
```

Because `AppHeader` lives above the router, the `<ERAMark>` inside it stays mounted across navigation and the transition runs.

---

## Integration steps

1. **Copy both files** into your components folder:
   - `src/components/ERAMark/ERAMark.jsx`
   - `src/components/ERAMark/ERAMark.css`
2. **Import once** in the component that renders your app-wide header.
3. **Pass `module`** — the key of the currently-active module. Must match one of the keys in `ERA_MODULES` (see `ERAMark.jsx`).
4. **Keep it mounted across route changes.** Put it in a layout / shell component, not inside each page.

---

## Props

```ts
<ERAMark
  module={ModuleKey}      // required: 'financial' | 'recipe' | 'schedule' | 'health' | 'home' | 'trip' | 'fitness' | 'outfit' | 'chat' | 'memory'
  size={number}           // optional: px. Default 40. Recommended 32–56 in headers.
  className={string}      // optional: for layout/margin tweaks.
/>
```

---

## Sizing guidance

| Context | Size |
|---------|------|
| Compact top bar | 32–36 px |
| Standard module header | **40 px** (default) |
| Spacious header / landing | 48–56 px |
| Splash / empty state | 96–160 px |

The internal cues scale proportionally.

---

## Module → hue reference

| Module     | Hue  | Feel |
|------------|------|------|
| Financial  | 175° | teal / prosperity |
| Recipe     |  28° | warm orange / flame |
| Schedule   | 256° | violet / time |
| Health     | 352° | rose / vitality |
| Home       | 205° | sky / shelter |
| Trip       | 155° | green / direction |
| Fitness    |  40° | amber / exertion |
| Outfit     | 325° | magenta / fabric |
| Chat       | 190° | cyan / listening |
| Memory     | 220° | blue / recall |

All palette values live in one place — `ERA_MODULES` at the top of `ERAMark.jsx`. Adjust there if design tweaks the colors.

---

## Accessibility

- The root element has `aria-label="ERA {ModuleName}"`.
- `prefers-reduced-motion` is respected — perpetual cue animations stop, but the color transition between modules still plays (it's slow and informational, not decorative).

---

## Do / Don't

✅ **Do** keep one `<ERAMark>` instance mounted above the router.
✅ **Do** change only the `module` prop when navigation happens.
✅ **Do** put it on the left of every module header.

❌ **Don't** remount per route — it kills the transition.
❌ **Don't** wrap it in a `<AnimatePresence>` or motion library — the animation is CSS-driven and self-contained.
❌ **Don't** change colors locally — edit `ERA_MODULES` in `ERAMark.jsx` so every surface stays in sync.

---

## Quick smoke test

Open `demo.html` in a browser. Click the module chips. You should see:
- The center dot color slowly bleed between hues.
- The cue animations (dots / line / hands / vapor) overlap and dissolve as they swap.
- No flashes, no jumps, no scale pops.

If the demo looks right, the integration is correct.
