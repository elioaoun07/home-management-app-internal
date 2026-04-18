---
tags:
  - type/ui
  - module/landing
  - status/active
---

# Landing Page — ERA Fusion & Portal Transition

## Vision

ERA is a **living being**. The landing page is not a menu — it is a moment of **metamorphosis**.

When a user selects a module, the central ERA Mark (in its resting Chat form) does not navigate away. It **transforms** — receiving the soul of the chosen module, metamorphosing visibly, then expanding into a portal that swallows the screen. The dashboard exists _inside_ that void. The user doesn't navigate _to_ a view; they _enter through_ ERA.

> Every animation must be heading somewhere. Nothing moves without purpose.

---

## Animation Sequence (~4.0s total)

### Phase 0 — Idle

The ERA Mark Chat breathes gently (built-in `era-breathe` CSS animation, 4.2s loop). Four module cards are arranged below it in a 2×2 grid.

### Phase 1 — Gathering (T=0 → T=700ms)

User clicks a module card.

- **Cards**: the three non-clicked cards drift outward in their corner directions, fading to 0 opacity over 850ms.
- **Clicked card**: the whole button — border, background, label, ERAMark — dissolves as a unit (opacity → 0, scale → 0.6) over 500ms with a 180ms delay, so the ghost visibly "lifts off" the card before the source dissolves. No lingering border frame.
- **Ghost clone — Pure translation flight**: the ghost is mounted at its source position and kept at source size (68px) the entire flight. It animates only `x/y` deltas (no scale) over 700ms with bezier `[0.22, 1, 0.36, 1]`. This eliminates scale-induced stutter from running CSS keyframes. On arrival the 68px ghost sits inside the 128px center mark — reading as a merge. Opacity fades at 82% mark as absorption recoil begins.
- **Background**: black overlay dims slowly (opacity 0 → 0.55 over 2s). Sets the mood without washing out the mark's color transform.

### Phase 2 — Absorption (T=700ms)

The ghost arrives at the center, pixel-aligned.

- The ghost dissolves into the central ERA Mark.
- The central mark **recoils then expands** (keyframes: scale `1 → 0.80 → 1.28 → 0.92 → 1.12 → 0.97 → 1.05 → 1` over 700ms). This is the body receiving a new soul — a gasp, then expansion.
- Simultaneously: `module` prop changes → **CSS `@property` transition fires** (1.8s on `--hue`, `--sat`, `--lum`). The aura, core, and ring shift from Chat's hue to the selected module's hue. The old cue fades out as the new cue fades in — both over 1.8s.

### Phase 3 — Transformation (T=700ms → T=2700ms)

ERA is metamorphosing. CSS transitions handle the visuals. The mark's `era-breathe` animation continues throughout.

At T=2200ms, ERA takes a **pre-zoom breath**: scale `1 → 1.08 → 1` over 500ms with bezier `[0.45, 0, 0.55, 1]`. The last inhale before the leap.

### Phase 4 — Portal (T=2700ms → T=3750ms)

The transformation is complete. ERA opens the portal by revealing the void that lives at its heart.

**Two synchronized layers** that work in concert:

1. **Mark warp with fade** (T=2700ms → T=3750ms): the central ERA Mark scales from `1 → 8 → 40` and fades `opacity: 1 → 1 → 0` over 1200ms with easeIn `[0.55, 0, 0.78, 0]`. The mark expands massively while staying solid for 60% of the animation, then fades only in the final 40%. This makes ERA feel like it's pulling you through itself.
2. **Soft portal disk emergence** (T=2780ms → T=3750ms): a soft-edged radial gradient (solid black core, transparent edges) locked to the mark's center grows from 48px base to 5280px (scale 110). The gradient transitions: solid black 0–45%, darkening 45–65%, semi-transparent 65–85%, transparent 85–100%. Because edges are transparent, the mark's aura and ring remain visible AROUND the darkening core — the central dot literally opens into the void. The portal plateaus at 70% of duration, ensuring final 30% is unambiguous solid black.

The magic: the portal is absolutely-positioned inside the mark's wrapper, so it follows the mark's center perfectly as both grow together. The viewer experiences one continuous pull through the core, not a separate disk cutting in. The mark stays alive and solid the whole way down.

### Phase 5 — Dashboard Reveal (T=3750ms onward)

`onNavigate()` is called at T=3750ms — the moment the portal has fully plateaued and the mark has completely faded, leaving solid black.

- `setShowLanding(false)` in `WebViewContainer` triggers the landing overlay's exit
- The landing page overlay fades from opacity 1 → 0 over **350ms**. Because the landing at this instant is already pure solid black (the portal fills the viewport and the mark is invisible), the short fade is an emergence _from_ the void, not a fade-out of the old view.
- The dashboard (already mounted beneath) is revealed into the gap.

---

## Why This Works

| Element                                                | Purpose                                                                                                                                                               |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pure-translation ghost (fixed-position, no scale)      | GPU-composited smooth flight. Eliminates stutter from scaling a mark with running keyframes. Smaller ghost lands inside bigger center mark — reads as merge.          |
| Whole-card dissolve (opacity + scale with 180ms delay) | No lingering border frame after the ghost leaves. Ghost visibly lifts off the card.                                                                                   |
| Ghost clone flight                                     | Visible narrative: the module soul travels to ERA                                                                                                                     |
| Absorption recoil                                      | ERA is a living body receiving impact — organic, not mechanical                                                                                                       |
| CSS variable transition (1.8s)                         | Color transformation is gradual, not a snap                                                                                                                           |
| Cue crossfade (1.8s)                                   | The old identity fades, new one emerges — metamorphosis                                                                                                               |
| Natural breathing during transform                     | ERA lives during the transformation, not frozen                                                                                                                       |
| Pre-zoom breath                                        | Tension before the leap — the universe holding its breath                                                                                                             |
| Mark warp with late fade                               | The mark expands massively and stays solid for 60%, fades only at the tail. Feels like being pulled through ERA, not watching it fade.                                |
| Soft-edged portal gradient locked to mark              | Radial gradient with transparent edges, positioned inside mark's wrapper. Mark's aura/ring stay visible around darkening core. Central dot literally opens into void. |
| Portal plateaus at 70%                                 | Final 30% is unambiguous solid black. No transparent tail.                                                                                                            |
| Dashboard already mounted                              | No load delay — the world exists inside ERA's void                                                                                                                    |
| Short 350ms landing exit from solid-black state        | Dashboard emerges _from_ the void rather than the old view fading _to_ the new one                                                                                    |

---

## Visual Structure During Zoom

At peak (T≈3700ms) with `overflow-hidden` on the page wrapper:

```
Viewport
│
├── era-mark (z-30, scale 30–40, opacity fading 1→0)
│   ├── era-aura: 128 × 35 = 4480px — extends far off-screen, STILL COLORED
│   ├── era-ring: 128 × 0.8 × 35 = 3584px — off-screen, STILL VISIBLE
│   └── portal disk (z-[5] inside mark wrapper)
│       48 × 100 = 4800px soft-edged radial gradient
│       Solid black center → transparent edges
│       LOCKS to mark's center via absolute positioning
```

User's subjective experience:

1. Mark zooms with full color (aura glowing)
2. Dark veil grows from mark's center outward
3. Mark's aura/ring remain visible AROUND expanding darkness
4. Feel like standing inside ERA's core watching void open
5. Mark fades at tail — dissolves into void it opened
6. Viewport goes solid black → dashboard emerges

The soft-edged portal made the biggest difference. Before: pure-black disk cut in from above, feeling like a separate object eclipsing the mark. After: radial gradient locked to mark's center with transparent edges — mark's own aura frames the void. Central dot literally _opens_. Feels like entering _through_ ERA, not _past_ it.

---

## Technical Notes

- `@property` declarations for `--hue`, `--sat`, `--lum` exist in `globals.css` — CSS variable transitions work
- `era-breathe` (4.2s) and `era-breathe-aura` run throughout — do not interrupt them
- Three `useAnimation` controls: `centerControls` (mark scale + opacity), `overlayControls` (atmospheric dim), `portalControls` (portal scale).
- `overflow-hidden` on the landing page wrapper clips zoomed mark and portal naturally.
- **DOM structure**: Portal disk is absolutely-positioned child inside mark's scale-animated wrapper, so it follows mark's center perfectly.
- **Z-index stack** (bottom → top):
  - `z-[10]` — cards, greeting, watermark
  - `z-[20]` — atmospheric dim overlay (dims to 0.55, non-opaque)
  - `z-[30]` — center ERA mark wrapper (contains both mark and portal disk)
  - `z-[5]` (within mark wrapper) — **portal gradient disk (soft-edged, transparent edges)**
  - `z-[60]` — in-flight ghost (above everything while flying)
- **Ghost animation**: uses `position: fixed` with viewport-coords from `getBoundingClientRect()`. Animates only `x/y` deltas (no scale). Pure translation → GPU-composited → zero stutter. Source 68px merges into 128px center mark.
- **Portal gradient**: `radial-gradient(circle, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 45%, rgba(0,0,0,0.85) 65%, rgba(0,0,0,0.4) 85%, rgba(0,0,0,0) 100%)`. Reaches full scale at 70% of duration, then plateaus.
- `onNavigate` fires at T=3750ms — when portal has plateaued and mark has faded to opacity 0. Landing exit (350ms) begins from already-solid-black state, so dashboard emerges _from_ void.
- `willChange: "transform, opacity"` on ghost and `willChange: "transform"` on portal disk — keeps compositor fast at large scale values.

---

## Files

| File                                      | Role                                                               |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `src/components/web/WebLandingPage.tsx`   | Full animation implementation                                      |
| `src/components/web/WebViewContainer.tsx` | Exit overlay timing (`duration: 0.6`)                              |
| `src/components/shared/ERAMark.tsx`       | ERA mark component — read-only                                     |
| `src/app/globals.css`                     | CSS transitions, `@property` declarations, `era-breathe` keyframes |
