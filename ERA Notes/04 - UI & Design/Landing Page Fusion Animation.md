---
tags:
  - type/ui
  - module/landing
  - status/active
---

# Landing Page — ERA Fusion & Portal Transition

## Vision

ERA is a **living being**. The landing page is not a menu — it is a moment of **metamorphosis**.

When a user selects a module, the central ERA Mark (in its resting Chat form) does not navigate away. It **transforms** — receiving the soul of the chosen module, metamorphosing visibly, then expanding into a portal that swallows the screen. The dashboard exists *inside* that void. The user doesn't navigate *to* a view; they *enter through* ERA.

> Every animation must be heading somewhere. Nothing moves without purpose.

---

## Animation Sequence (~3.8s total)

### Phase 0 — Idle
The ERA Mark Chat breathes gently (built-in `era-breathe` CSS animation, 4.2s loop). Four module cards are arranged below it in a 2×2 grid.

### Phase 1 — Gathering (T=0 → T=700ms)
User clicks a module card.

- **Cards**: the three non-clicked cards drift outward in their corner directions, fading to 0 opacity over 850ms.
- **Clicked card**: the whole button — border, background, label, ERAMark — dissolves as a unit (opacity → 0, scale → 0.6) over 500ms with a 180ms delay, so the ghost visibly "lifts off" the card before the source dissolves. No lingering border frame.
- **Ghost clone — FLIP-aligned flight**: the ghost is mounted at the **target** center at the **target** size (128px), then started offset+scaled-down at the source (68px). It animates `x/y → 0` and `scale → 1` over 700ms with bezier `[0.22, 1, 0.36, 1]`. On arrival it is a pixel-perfect twin of the center mark (same size → same aura/ring/core proportions → zero visual drift). Opacity fades at the 82% mark of the flight as the absorption recoil begins.
- **Background**: black overlay dims slowly (opacity 0 → 0.55 over 2s). Sets the mood without washing out the mark's color transform.

### Phase 2 — Absorption (T=700ms)
The ghost arrives at the center, pixel-aligned.

- The ghost dissolves into the central ERA Mark.
- The central mark **recoils then expands** (keyframes: scale `1 → 0.80 → 1.28 → 0.92 → 1.12 → 0.97 → 1.05 → 1` over 700ms). This is the body receiving a new soul — a gasp, then expansion.
- Simultaneously: `module` prop changes → **CSS `@property` transition fires** (1.8s on `--hue`, `--sat`, `--lum`). The aura, core, and ring shift from Chat's hue to the selected module's hue. The old cue fades out as the new cue fades in — both over 1.8s.

### Phase 3 — Transformation (T=700ms → T=2700ms)
ERA is metamorphosing. CSS transitions handle the visuals. The mark's `era-breathe` animation continues throughout.

At T=2200ms, ERA takes a **pre-zoom breath**: scale `1 → 1.08 → 1` over 500ms with bezier `[0.45, 0, 0.55, 1]`. The last inhale before the leap.

### Phase 4 — Portal (T=2700ms → T=3800ms)
The transformation is complete. ERA opens the portal.

**Two synchronized layers**, deliberately separated so the viewer *watches pixels get replaced* rather than *watches a crossfade*:

1. **Mark warp** (T=2700ms → T=3800ms): the central ERA Mark scales from `1 → 38` over 1100ms with aggressive easeIn `[0.55, 0, 0.78, 0]`. Deliberate start → explosive acceleration. The mark accelerates *into* the viewer.
2. **Void disk emergence** (T=2850ms → T=3800ms): a **dedicated pure-black circle** sits above the mark at `z-[40]` (the mark is `z-[30]`). Base 56px, animates `scale 0 → 70` (final size 3920px, edge-to-edge solid black at any viewport). Delay 150ms after the mark's warp begins, then grows with decisive easeOut `[0.22, 1, 0.36, 1]` over 950ms — fast start, gentle finish. The void decelerates *around* the viewer. **No opacity crossfade**; it appears and grows, full stop.

The curves are deliberately opposed. The mark's easeIn and the void's easeOut meet at the **swallow**: the void's leading edge moves faster than the mark's expansion for most of the animation, so it overtakes the mark and locks the viewport to solid black before onNavigate fires.

The void disk **replaces pixels**. When its leading edge sweeps past each part of the viewport, that region becomes unambiguously, permanently black. There is no translucent middle state.

### Phase 5 — Dashboard Reveal (T=3450ms → T=3800ms)
`onNavigate()` is called at T=3450ms — the moment the void disk has reached full viewport coverage.

- `setShowLanding(false)` in `WebViewContainer` triggers the landing overlay's exit
- The landing page overlay fades from opacity 1 → 0 over **350ms** (reduced from 600ms). Because the landing at this instant is already pure solid black (the void disk fills the viewport), the short fade is an emergence from the void, not a fade-out of the old view.
- The dashboard (already mounted beneath) is revealed into the gap.

---

## Why This Works

| Element | Purpose |
|---|---|
| FLIP-aligned ghost (mounted at target, scaled from source) | Pixel-perfect landing — ghost renders identically to the center mark on arrival. No drift, no size-proportion mismatch. |
| Whole-card dissolve (opacity + scale with 180ms delay) | No lingering border frame after the ghost leaves. Ghost visibly lifts off the card. |
| Ghost clone flight | Visible narrative: the module soul travels to ERA |
| Absorption recoil | ERA is a living body receiving impact — organic, not mechanical |
| CSS variable transition (1.8s) | Color transformation is gradual, not a snap |
| Cue crossfade (1.8s) | The old identity fades, new one emerges — metamorphosis |
| Natural breathing during transform | ERA lives during the transformation, not frozen |
| Pre-zoom breath | Tension before the leap — the universe holding its breath |
| easeIn warp zoom to scale 38 | Deliberate start → explosive acceleration — warp jump energy |
| Dedicated void disk above mark (z-40) | Pure black replaces pixels. Not a crossfade. Makes it feel like entering a void, not fading. |
| Void scale 70 (3920px) | Edge-to-edge guarantee at any viewport size — no colored aura peeking at corners at peak |
| Dashboard already mounted | No load delay — the world exists inside ERA's void |
| Short 350ms landing exit from solid-black state | Dashboard emerges *from* the void rather than the old view fading *to* the new one |

---

## Visual Structure During Zoom

At peak (T≈3790ms) with `overflow-hidden` on the page wrapper:

```
Viewport
│
├── era-mark (z-30, scale 38, still zooming)
│   ├── era-aura: 128 × 38 = 4864px — extends far off-screen
│   ├── era-ring (inset 10%): 128 × 0.8 × 38 = 3891px — off-screen
│   └── era-core (30% of mark): 128 × 0.3 × 38 = 1459px — fills center
│
└── void disk (z-40, scale 70) — 56 × 70 = 3920px of PURE BLACK
    Sits ABOVE the mark. Replaces pixels. Guarantees edge-to-edge solid.
    THIS is the void the user enters.
```

The user sees, in order: the mark gets huge → a dark disk emerges from its center → the disk accelerates outward and swallows everything → solid black → dashboard emerges.

The void disk is what made the biggest difference. Before: the mark's own colored aura reached the edges while a black overlay crossfaded over it at 0.96 opacity — a translucent blend that read as a "fade out". After: the void disk is an opaque element that *replaces* the viewport pixels as it grows, reading as a "swallow".

---

## Technical Notes

- `@property` declarations for `--hue`, `--sat`, `--lum` exist in `globals.css` — CSS variable transitions work
- `era-breathe` (4.2s) and `era-breathe-aura` run throughout — do not interrupt them
- Three `useAnimation` controls orchestrate the phases: `centerControls` (mark scale), `overlayControls` (atmospheric dim), `voidControls` (portal disk).
- `overflow-hidden` on the landing page wrapper clips the zoomed mark and void naturally.
- **Z-index stack** (bottom → top):
  - `z-[10]` — cards, greeting, watermark
  - `z-[20]` — atmospheric dim overlay (dims to 0.55, non-opaque)
  - `z-[30]` — center ERA mark
  - `z-[40]` — **void disk (pure black, opaque) — sits above the mark to replace pixels**
  - `z-[60]` — in-flight ghost (above everything while flying)
- **FLIP ghost**: positioned at the target center at target size (128px), with `initial={{ x: from-to, y: from-to, scale: from/to }}`. Arrival = zero-drift render of the center mark.
- `onNavigate` fires at T=3450ms — the moment the void disk dominates the viewport. The landing exit is short (350ms) and begins from an already-solid-black state, so the dashboard emerges *from* the void instead of the old view fading *to* the new one.
- `willChange: "transform, opacity"` on the ghost and `willChange: "transform"` on the void disk — keeps them on the compositor for smooth acceleration at large scale values.

---

## Files

| File | Role |
|---|---|
| `src/components/web/WebLandingPage.tsx` | Full animation implementation |
| `src/components/web/WebViewContainer.tsx` | Exit overlay timing (`duration: 0.6`) |
| `src/components/shared/ERAMark.tsx` | ERA mark component — read-only |
| `src/app/globals.css` | CSS transitions, `@property` declarations, `era-breathe` keyframes |
