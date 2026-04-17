---
name: era-ai-design
description: Use this skill to generate well-branded interfaces and assets for ERA.AI (home-manager), a mobile-first offline-first household & finance companion app. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping the New Expense Form and adjacent screens.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick orientation

- **Product:** ERA.AI — a personal finance + household management app used by two partners. Offline-first, mobile-first, PWA-installed.
- **Signature surface:** the New Expense Form (a progressive Amount → Category → Sub → Confirm flow).
- **Four themes:** `blue` (default), `pink`, `frost`, `calm`. Each is an identity — pick one and commit across a session.
- **Aesthetic:** neon cyan glow on dark marine surfaces (blue theme); inset-ring borders over real borders; gradient-clipped hero numbers; 48px min tap targets; tabular-nums money; dual-currency ($ + L.L.).
- **Critical don'ts:** no purple/bluish-purple gradients, no emoji in product UI, no photographic or illustrative backgrounds, no heavy drop-shadows on calm theme.

## Files in this skill

| File | What for |
|---|---|
| `README.md` | Foundations, voice/tone, content rules, visual rules, iconography, caveats. |
| `colors_and_type.css` | Drop-in stylesheet with all four themes + semantic type + primitive classes. |
| `assets/` | Real app icons (appicon, expense, dashboard, chat, catalogue, reminders — SVG + PNG). |
| `ui_kits/expense-form/` | Pixel-close recreation of the flagship surface — JSX components + interactive demo. |
| `preview/` | Small swatches/specimens cards. Useful as a quick visual reference. |

## When in doubt

Read `colors_and_type.css` first; nearly every token you need is named there with `--era-*` custom properties.
