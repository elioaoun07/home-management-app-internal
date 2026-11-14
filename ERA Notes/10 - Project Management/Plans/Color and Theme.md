---
created: 2026-11-12
updated: 2026-11-12
type: plan
status: active
owner: Elio
evidence_cutoff: commit 78245c60 plus working tree on fable2-pr5, 2026-11-12. Counts by ripgrep over src/. Contrast ratios computed (WCAG 2). Nothing observed on a device.
---

# Color and Theme

**Proposed, not yet accepted.** No checklist rows are filed. Answer the four [decisions](#owner-decisions), then the packets below get filed and become the queue.

Blue and pink stay as the two player colours. What changes:

1. **Consistency.** Colours are defined in five places today and the themes have drifted apart. They move to one token set where blue and pink share every step and differ only in hue.
2. **Revamp.** A new visual language on top of those tokens: opaque layered surfaces, readable ink, colour reserved for what is interactive or owned, one glow per view.

Consistency ships first. A revamp on top of five colour systems only adds a sixth.

## Contract and ownership

| | |
|---|---|
| Outcome | Every screen takes its colour from one token set. Pink and blue are symmetric. The new look can be switched on and off for the whole app until it is accepted. |
| In scope | Tokens, `useThemeClasses`, `globals.css` theme rules, hardcoded colour classes in components, shared primitives (card, field, button, chip, sheet), guard script, the rules and docs that describe theming. |
| Not in scope | Page layouts, flows and navigation. The theme-switch paint animation. The ERAMark and ERA shell ambient CSS. The Recipes notebook look. User-chosen category colours and chart palettes. Any database change. Removing the query invalidation on theme switch (Hard Rule 10). |
| Never edited | `src/components/ui/` (Hard Rule 11). Its 10 files that read `tc.*` and its shadcn variables are restyled from outside, through token values. |
| Own-styled, excluded from the guard | Guest Portal (`src/app/g/`), landing page, PM live, Watch UI. |
| Proposed owner | Hub & ERA for the foundation, each module's campaign for its sweep, PM Tooling for the guard. IDs are assigned on acceptance. |

## Evidence: what is wrong today

| # | Finding | Where |
|---|---|---|
| E1 | **The Balance history complaint.** In pink, `cardBg` is white glass (`bg-white/80 text-slate-900`) while text stays `pink-400`: 1.7:1 contrast. Fields inside are 50% plum over that white, which gives the grey-mauve boxes. Blue's card is solid navy. | `src/hooks/useThemeClasses.ts:313-319`, `:193-199`. Used by `ui/card.tsx` and 11 components, including `BalanceHistoryDrawer.tsx:125,383,446,824` |
| E2 | Pink and blue are each declared twice in `globals.css`, and the second declaration is a light palette. Unless `<html>` carries `.dark`, pink's `--muted`, `--accent`, `--secondary`, `--border`, `--input` are near-white and `--foreground` is near-black; blue's `--background`, `--card`, `--popover` are `#ffffff`. `.dark` follows the phone's OS dark-mode setting. 176 uses of these classes outside `ui/`, in 36 files. Read from the cascade; confirm on a phone in CT-0. | `globals.css:1274-1331` against `1575-1625`; `1394-1450` against `1502-1541`; `src/components/theme-provider.tsx:8-14`; `src/app/layout.tsx:136-147` |
| E3 | Five sources of truth for the same colours: shadcn variables, `--neo-*` / `--bg-*` / `--header-*` variables, 116 `tc` keys each a four-way ternary, `src/lib/theme-colors.ts`, and hex literals in `ThemeContext.tsx:44-51,153-158` and `layout.tsx:112,154`. | as listed |
| E4 | About 1,150 lines of `!important` rules rewrite hardcoded classes per theme (`.bg-[#0a1628]` becomes plum in pink, `.text-cyan-400` becomes indigo in frost). 309 `!important` in the file; 255 frost selectors, 95 pink, 28 calm, so each theme is patched to a different depth. | `globals.css:2441-3595` |
| E5 | Hardcoded colour in components: 312 arbitrary-hex classes in 34 files; 131 `isPink ?` ternaries in 31 files; raw hue classes `cyan-*` 682, `pink-*` 489, `blue-*` 289; `text-white/N` 2,275 and `bg-white/N` 1,047, which act as the neutral scale and only work on dark. | ripgrep |
| E6 | The themes are not symmetric. Pink's page is darker than blue's (OKLCH L 0.174 against 0.200) and its card step is nearly three times larger. Pink's "active" colour is amber, which is also the warning colour; blue's is teal. The variable named `--teal` holds amber in pink. | `useThemeClasses.ts:61-67,142-148`; `globals.css:1287` |
| E7 | Faint text misses AA (4.5:1): `textFaint` 3.3 in pink, 4.3 in blue; placeholders 2.7 and 3.4; `text-white/40` 3.8. | computed |
| E8 | `useThemeClasses` returns blue classes until mounted, so all 265 call sites render twice and pink shows blue for a frame. | `useThemeClasses.ts:8-22` |
| E9 | The anti-flash script knows only pink and blue, so frost and calm paint navy first. Root `themeColor` is indigo `#6366f1`. | `layout.tsx:68,111-112` |
| E10 | "Me or partner" colour is 73 inline `theme === "pink"` ternaries in 45 files. A frost or calm viewer is always shown as blue, so person-absolute colour only holds for a blue-plus-pink household. Already owned by [HUB-51](<../Hub & ERA/Hub & ERA — Master Book.md#hub-51>). | `ERA Notes/01 - Architecture/Color Identity.md` |
| E11 | Glow is on cards, inputs, dialogs, icons and titles (125 arbitrary glow shadows in 34 files, plus the `tc` glows). `.neo-card:hover` lifts and stays lifted after a tap on touch screens. | `globals.css:2315-2340` |

## Design

### Principles

1. **One ladder, two hues.** Blue and pink share every lightness and chroma step; only the hue angle differs. Drift becomes impossible, not merely discouraged.
2. **Components name roles, never colours.** `bg-surface-1`, `text-ink-muted`, `text-neon`, `bg-me-soft`. No hex, no `cyan-400`, no `isPink ?`.
3. **Colour is light, not paint.** Surfaces and ink are quiet. Hue marks what you can press, what is yours, and the number that matters.
4. **One glow per view.** Glow means "this is the lit object".
5. **Opaque by default.** Floating panels take their surface from a token, so Hard Rule 15 holds without anyone remembering it.

### Token set

Defined once in `src/styles/tokens.css`, one `[data-theme]` block per theme, exposed as Tailwind utilities through `@theme inline`.

| Group | Tokens | Used for |
|---|---|---|
| Surface | `stage`, `surface-1`, `surface-2`, `surface-3`, `scrim` | page · card or section · field, pill, nested row · sheet, popover, dialog |
| Ink | `ink`, `ink-muted`, `ink-faint`, `ink-ghost`, `ink-on-neon` | body · secondary · metadata · disabled or decorative · text on a filled button |
| Line | `line`, `line-strong`, `line-neon` | hairline · field edge · active edge |
| Neon | `neon`, `neon-strong`, `neon-soft`, `neon-2` | the lit colour · fills · tinted active background · gradient partner |
| Player | `me`, `me-soft`, `partner`, `partner-soft` | anything owned by a person. Fixed anchors: blue-400/500 and pink-400/500, unchanged |
| Status | `success`, `warning`, `danger`, `info`, each with `-soft` | same in every theme. Red stays off individual rows (Hard Rule 3) |
| Tone | `tone` | white on dark themes, slate on light. Replaces the `white/N` idiom one-for-one |
| Effect | `glow`, `shadow-1/2/3`, `ring-focus` | |
| Shape and type | radius 12 field · 16 card · 24 sheet · pill; type 11/13/15/18/22/28; amounts in Geist Mono, tabular | |

`neon` is deliberately not called `accent`: shadcn already uses `accent` for a hover background inside `ui/`. The shadcn variables become aliases, declared once: `--background` → stage, `--card` → surface-1, `--popover` → surface-3, `--muted` / `--secondary` / `--accent` → surface-2, `--foreground` → ink, `--muted-foreground` → ink-muted, `--border` → line, `--input` → line-strong, `--primary` / `--ring` → neon, `--destructive` → danger. `.dark` is derived from the app theme, never from the OS.

Hex values needed before CSS loads (anti-flash script, `themeColor`, the theme toast) come from one registry, `src/lib/theme/registry.ts`: id, label, stage colour, dark or light, me and partner colours.

### The new look (skin 2)

| Element | Today | Skin 2 |
|---|---|---|
| Card | blue: navy with a coloured glow; pink: white glass; `neo-card`: gradient, glow, hover lift | opaque `surface-1`, 1px `line`, no glow, no lift on touch, radius 16 |
| Field | half-transparent page colour, inset glow ring, 20px bloom on focus | opaque `surface-2`, 1px `line-strong`; focus is a 2px `neon` ring; radius 12 |
| Sheet, popover, dialog | three different backgrounds, 30–40px coloured glow | opaque `surface-3`, black `shadow-3`, 1px `line-strong` |
| Body text | the theme hue at 100 / 70 / 60% | `ink` ladder: near-white tinted toward the hue, AA on every surface |
| Where hue appears | everywhere | active tab or chip, links, the primary button, the key number, player marks |
| Primary button | white on a gradient with glow (3.5–3.7:1) | dark ink on a `neon` fill (6.9:1 pink, 10:1 blue). The one glow in the view. Press scales to 0.98 |
| Secondary, ghost | tinted fill with glow; inset glow ring | `surface-2` with hairline; plain `neon` text |
| Active state | teal in blue, amber in pink | `neon` in both. Amber means warning only |
| Glow | cards, inputs, dialogs, icons, titles | primary button, the selected item, ERAMark, completion moments |
| Gamified feel | ambient glow on everything | player colour on everything owned (avatars, split bars, rings, streaks); bursts when something is completed |

Starting values. The structure is the contract; the numbers get tuned in the theme lab.

| Token | OKLCH L / C | Blue, hue 255 | Pink, hue 350 | Contrast of `ink` on it |
|---|---|---|---|---|
| `stage` | 0.200 / 0.040 | `#0a1628` (unchanged) | `#230e19` (lifted from `#1a0a14` to match blue) | 15.9 |
| `surface-1` | 0.240 / 0.042 | `#112033` | `#2e1722` | 14.4 |
| `surface-2` | 0.285 / 0.045 | `#1a2b40` | `#3b212d` | 12.6 |
| `surface-3` | 0.330 / 0.048 | `#24364e` | `#482b39` | 10.7 |
| `line` | 0.36 / 0.05 | `#2b3e57` | `#513241` | |
| `line-strong` | 0.47 / 0.06 | `#445c7c` | `#754d60` | |
| `ink` | 0.955 / 0.012 | `#ebf1f8` | `#f7edf1` | |
| `ink-muted` | 0.80 / 0.035 | `#afbfd5` | `#d0b5c1` | 6.5 to 9.7 across surfaces |
| `ink-faint` | 0.70 / 0.04 | `#8ea0b8` | `#b395a2` | 4.6 to 6.8 |
| `ink-ghost` | 0.55 / 0.04 | `#627389` | `#846875` | 2.5 to 3.7, never for text that must be read |
| `neon` | | cyan-400 `#22d3ee` | pink-400 `#f472b6` | as text on stage: 10.0 and 6.9 |
| `neon-strong` | | blue-500 `#3b82f6` | pink-500 `#ec4899` | |
| `neon-2` | | blue-400 `#60a5fa` | see D1 | |

### How the switch stays safe

- **`tc` keeps its API.** `useThemeClasses()` keeps all 116 keys, so its 198 importing files and `ui/` keep working. The values become constant strings of token utilities: no ternaries, no mount flip. `isPink`, `isFrost`, `isCalm` stay exported until the sweeps remove their last readers.
- **Skin flag.** `data-skin="2"` on `<html>` (a local toggle in Settings, no database) swaps token values for the whole app. Skin 1 is today's look made consistent; skin 2 is the revamp. You can live with skin 2 on your own phone before it becomes the default, and go back instantly. The flag and skin 1 are deleted at cutover.
- **Theme lab.** One route, `/theme-lab`, renders every token and primitive in all four themes and both skins with a live contrast table. It is the approval surface and the regression check. It needs an Atlas entry (Hard Rule 23).
- **Ratchet guard.** `pnpm theme:check` counts arbitrary-hex colour classes, raw hue classes, `isPink ?`, `theme === "pink"`, `*-white/N` and `!important` in `globals.css`. A count may fall, never rise. Runs in pre-commit and CI. At close-out the tolerance becomes zero outside the excluded folders.

## Disposition and dependencies

Packet labels are local to this document. Sizes and tiers use the [Model Registry](<../../Model-Registry.md>) aliases at default effort unless stated.

| Packet | Outcome | Proposed owner | Size · tier | Done when |
|---|---|---|---|---|
| CT-0 | Theme lab exists; E2 confirmed or disproved on a phone with OS light mode; ratchet baseline recorded | Hub & ERA | S · `CLAUDE_MID` | Lab shows 4 themes; baseline file committed |
| CT-1 | Token file, one block per theme, shadcn aliases, registry; duplicate theme blocks and `.dark` forks deleted; OS setting no longer changes any colour; anti-flash covers all four themes | Hub & ERA | M · `CLAUDE_HIGH` | Toggling OS dark mode changes nothing in the lab; no first-paint flash in frost or calm |
| CT-2 | `tc` static on tokens; `theme-colors.ts` deleted. Fixes E1, E6, E8: pink cards go dark | Hub & ERA | M · `CLAUDE_HIGH` | Balance history in pink matches blue's structure; owner check on the pink phone |
| CT-3 | `pnpm theme:check` ratchet in pre-commit, CI and the finish-task greps | PM Tooling | S · `CLAUDE_MID` | A commit that adds `bg-[#...]` fails |
| CT-4 | Mechanical codemods: `*-white/N` → `*-tone/N`, stage and surface hexes → tokens. Each `!important` remap rule is deleted once a script proves no class in `src/` still matches it | Hub & ERA | L · `CLAUDE_MID` | `globals.css` remap section gone; frost and calm look unchanged in the lab |
| CT-5 | `me` / `partner` tokens replace the identity ternaries | Fold into [HUB-51](<../Hub & ERA/Hub & ERA — Master Book.md#hub-51>) | M · `CLAUDE_MID` | `theme === "pink"` count is zero outside the theme code |
| CT-6 | Module sweeps: raw hue classes and `isPink ?` → tokens. One packet per campaign (Budget, Schedule, Hub & ERA, Kitchen, Trips, Healthcare, Outfits, Notifications). Each use is judged: theme accent, player identity, or a real category colour that stays | Each campaign; depends on CT-2 | M each · `CLAUDE_MID` | That module's ratchet counts reach zero; its screens checked at 390 × 844 in blue and pink |
| CT-7 | Skin 2: values, primitives, glow budget. Authoring can start after CT-2; cutover needs CT-4 to CT-6 | Hub & ERA | L · `CLAUDE_HIGH` | Owner accepts skin 2 on both phones; skin 2 becomes default; flag and skin 1 deleted |
| CT-8 | Close-out: ui-guardrails §1–4, Hard Rules 3, 14, 15 wording, `Color Identity.md`, Feature Map `theming.md`, ERA Design System `colors_and_type.css`; guard tolerance to zero; archive this plan | PM Tooling | S · `CLAUDE_MID` | `pnpm sync:ai` and `pnpm docs:check` clean |

Order: CT-0 → CT-1 → CT-2 → CT-3, then CT-4, CT-5 and CT-6 in any order, then the CT-7 cutover, then CT-8. CT-0 to CT-2 are small and fix the bug you reported; the rest can wait behind the "close the critical holes" sprints.

Every packet: `pnpm typecheck`, `pnpm lint`, `pnpm theme:check`, the lab in four themes at phone width. No packet touches the database.

## Owner decisions

If one is left unanswered, the recommendation stands.

| # | Decision | Recommendation | Alternatives |
|---|---|---|---|
| D1 | Pink's second colour | Keep amber for the "sunset" gradient only (titles, hero moments). It stops being pink's active and selection colour, because amber also means warning | Fuchsia as an analogous pair, the way cyan pairs with blue · Keep amber as today |
| D2 | Body text | Tinted near-white `ink`. Hue moves to interactive and owned elements. This is the largest visible change | Keep body text in the theme hue and fix only the faint steps |
| D3 | Frost and Calm | Keep both as token-only themes, about 45 lines each, checked in the lab only. Blue and pink are the two verified on phones | Retire Frost (the one light theme, and the reason for 255 override rules) · Retire both |
| D4 | What "revamp the UI" covers | The skin: surfaces, ink, controls, glow, shape, type. Layouts, flows and existing animations stay as they are | Add named screens for a layout redesign as separate items |

## Risks

- **Deleting `!important` rules changes what wins the cascade.** Handled per rule: delete only after a script shows no consumer, then look at the lab.
- **Screens that are themed only by those rules will shift** when their hardcoded class is replaced. The module sweep, not the codemod, owns anything that needs judgment.
- **Opacity on variable colours** (`text-tone/40`) compiles to `color-mix`. Check it in the lab on the iPhone before CT-4.
- **Other agents work in the same tree.** Run a module sweep when that campaign is quiet; codemods touch many files.
- **`sonner.tsx` in `ui/` reads next-themes.** The provider stays, forced to the app theme.

## Retirement

Archive to `_Archive/Plans/` when CT-8 ships. The surviving rules live in `ui-guardrails`, `Color Identity.md` and the Feature Map; the token file is the source of truth for values.
