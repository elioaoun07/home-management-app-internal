# ERAMark (animated brand mark)

**Type:** Cross-cutting (brand)

## What it does

ERA's signature brand object — a hue-morphing animated mark that shifts based on which face the user is in. Used in chips (20 px), headers (36–40 px), splash/empty states (96–160 px). It's the only element allowed to use the `--era-glow-*` glow tokens in normal product chrome.

## Files at a glance

- **In the budget-app repo**:
  - `src/components/shared/ERAMark.tsx`
  - `src/components/shared/EraAvatar.tsx`
- **Portable copies** (in this design system):
  - `assets/ERAMark.jsx` + `assets/ERAMark.css`
  - `src_ref/ERAMark.jsx`, `src_ref/ERAMark.css`, `src_ref/ERAMark-README.md`, `src_ref/ERAMark-demo.html`
- **Tokens (hues, glow, easing)**:
  - `colors_and_type.css` (portable)
  - `src/app/globals.css` (live)
- **Watch variant**: `src/components/watch/WatchEraFace.tsx`

## Common edit scenarios

- **"Change a face hue"** → edit the `--era-face-<name>` variable in `globals.css` (and `colors_and_type.css` for the portable copy).
- **"Edit the breathing animation"** → `ERAMark.css` — 4.2 s breathing loop, 1.8 s cross-fade between hues (`cubic-bezier(0.4, 0, 0.2, 1)`).

## Gotchas

- The 1.8 s cubic-bezier cross-fade is **the signature motion of the brand** — match its easing/duration for any other identity-morph (theme switch, face change). Do not invent new transitions.
- `prefers-reduced-motion`: keep color transitions; stop the perpetual loops.
- Glow is for the "lit object" only — **never more than one glowing element per viewport**.
- Never copy the mark's inset-glow + cyan-rim treatment to other surfaces (it's exclusive to the mark and the Recipes notebook).

## Connected modules

- **AI Assistant** ([../junction/ai-assistant.md](../junction/ai-assistant.md)) — primary user.
- **Watch UI** — watch-sized variant.
- **Theming** — hue is driven by face + theme tokens.
