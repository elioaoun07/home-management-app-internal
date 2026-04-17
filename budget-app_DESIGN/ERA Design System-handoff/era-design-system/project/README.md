# ERA.AI Design System

A design system distilled from the **ERA.AI** personal finance + household management app. The system is specifically scoped around the **New Expense Form** (`/app/expense/page.tsx`) but the foundations apply to every surface of the product.

## What is ERA.AI?

ERA.AI (internal codename `home-manager`) is a mobile-first, offline-first household and finance companion. The New Expense Form is its flagship surface — a progressive, thumb-zone-optimized flow that lets two partners add expenses, track shared debts, split bills, and reconcile dual-currency transactions (USD + LBP) even without internet.

Signature product qualities:

- **Mobile-first, thumb-zone.** 48px min tap targets, bottom-sheet drawers, haptic feedback.
- **Offline-first.** Balance and categories read from IndexedDB; queued mutations sync later.
- **Multi-theme.** Four distinct themes — `blue` (default cyan/neon), `pink` (rose/amber glow), `frost` (light indigo), `calm` (warm stone, muted, tablet-friendly). A user's theme is their *identity* — it persists across both partners' phones.
- **Progressive, multi-step form.** Amount → Account → Category → Subcategory → Confirm. Each step auto-advances.
- **Voice + calculator entry.** Mic button pipes audio into Gemini NLP; calculator dialog fills the amount field.

## Source references

| Source | Path |
|---|---|
| App codebase | `budget-app/` (Next.js 16, React 19, Tailwind 4, shadcn/ui) |
| Canonical design guide | `budget-app/DESIGN_GUIDE_NEW_EXPENSE_FORM.md` |
| Focus surface | `budget-app/src/app/expense/page.tsx` → `MobileExpenseForm.tsx` |
| Theme colors | `budget-app/src/lib/theme-colors.ts` |
| Theme class helper | `budget-app/src/hooks/useThemeClasses.ts` |
| Icon library | `budget-app/src/components/icons/FuturisticIcons.tsx` |
| Global styles | `budget-app/src/app/globals.css` |

---

## Content fundamentals

**Voice & tone.** Direct, concise, friendly-but-operational. Labels are nouns (`Amount`, `Category`, `Balance`). Affirmations use exclamation energy without being cloying (`Expense added!`, `Split bill sent!`, `Future payment scheduled!`). Errors are plain and practical (`Failed to load balance. Please refresh.`, `You're offline — balance not updated.`).

**Case.**
- **Sentence case** for descriptions, toasts, and button copy (`Save draft`, `Add account`).
- **Title Case** sparingly — only for proper surface titles (`Account Balance`, `Future Payments`).
- **ALL CAPS + letter-spacing** for tiny labels above hero values (`ACCOUNT BALANCE`, `PENDING DRAFTS`).

**Pronouns.** Second person ("you") for system notices (`You're offline`); first-person never. System describes what *happened* rather than what the user did (`Expense added!`, not `You added an expense`).

**Numbers & money.** Tabular-nums, always `$X.XX` two-decimal. Dual-currency shown as `$` + `L.L.` with the LBP value stored in thousands. No thousands separators in input fields, yes in display.

**Emoji.** Minimal but deliberate — used in a few dev-facing docs (`✅`, `🚀`) but **NOT** in production UI. Don't invent new emoji usage; rely on Lucide + FuturisticIcons instead.

**Example copy:**
- Labels: `Amount`, `Category`, `Description (optional)`
- Toasts: `Expense added!` / `Income added!` / `Saved offline!`
- Descriptions: `$12.50 for Groceries`
- Empty/offline: `0 pending offline transactions`, `Cached`
- Destructive confirmation: two-step — first tap asks, second tap deletes.

---

## Visual foundations

### Color

Four themes. Each is a complete identity (bg + surface + primary + accent + state colors). The default is `blue`. See `colors_and_type.css` for full tokens.

| Theme | Vibe | Primary | Accent | Page bg |
|---|---|---|---|---|
| **blue** | Cyberpunk neon, dark marine | `#3b82f6` | `#06b6d4` / `#38bdf8` | `#0a1628` |
| **pink** | Rose-gold glow, dark burgundy | `#ec4899` | `#f472b6` / `#fbbf24` | `#1a0a14` |
| **frost** | Clean indigo light mode | `#6366f1` | `#8b5cf6` | `#f8fafc` |
| **calm** | Warm muted stone, tablet-friendly | `#78716c` | `#d6cfc7` / `#84a98c` | `#1c1917` |

Colors drive **identity**, not role: if the user's theme is `blue`, they are always the blue one, everywhere. Pair theme with partner's theme for split-bill displays.

### Typography

The app uses the Next.js default system font stack with two Google-font accents:

- **Caveat** — signature flourish (book-index titles, "handwritten" headings).
- **Handlee** — handwriting notes font (utility class `.font-handwriting`).

I don't have the exact Geist/Inter font files committed in the repo, so `colors_and_type.css` loads **Geist + Geist Mono + Caveat + Handlee from Google Fonts**. If you're packaging this for offline use, drop `.woff2` files in `fonts/` and swap the `@import` for a local `@font-face`.

Scale is tight and mobile-minded:
- Hero amount: `text-2xl` ~ 24px, `font-bold`, `tabular-nums`, gradient fill.
- Section label: `text-base` 16px `font-semibold`.
- Micro-label (uppercase tracker): `text-[10px]` with `tracking-wider`.
- Input: `text-lg` 18px `font-semibold`.

### Spacing & layout

- Page padding: `px-4 py-6` (16/24).
- Card padding: `p-4` (16). Compact balance card: `p-2.5` (10).
- Gap between stacked items: `gap-3` (12).
- Button height: `h-12` (48) primary, `h-11` (44) secondary — thumb-friendly.
- Grid: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` for category/subcategory pickers.
- Layout floor: bottom fixed nav, content has `pb-[MOBILE_NAV_HEIGHT]`.

### Shape & elevation

- **Radii:** subtle — `rounded-md` (6) for inputs, `rounded-lg` (8) for buttons, `rounded-xl` (12) for cards, `rounded-full` for chips and icon buttons.
- **Borders:** inset box-shadow rings (`shadow-[0_0_0_1px_rgba(...)_inset]`) are preferred over real borders because they don't affect layout width. Focus state doubles the ring and adds a glow.
- **Cards:** `neo-card` pattern — solid or translucent bg + inset ring + outer glow shadow. Never use `neo-card` on floating panels (use a solid bg).

### Glow / shadow

Signature look. In `blue`, every interactive surface has a subtle cyan halo. Three strengths:
- `drop-shadow-[0_0_6px_rgba(6,182,212,0.5)]` — icon glow.
- `shadow-[0_0_20px_rgba(6,182,212,0.2)]` — card ambient glow.
- `shadow-[0_0_30px_rgba(6,182,212,0.5)]` — primary button hover.

`calm` theme **disables all glows** — replaced with soft matte shadows (`drop-shadow-none`, `shadow-[0_2px_8px_rgba(28,25,23,0.3)]`). Design must degrade gracefully across themes.

### Gradients

- **Title gradient** — used on hero values (balance, amount). `linear-gradient` clipped to text. Blue: `from-cyan-400 via-teal to-cyan-300`. Pink: `from-pink-400 via-amber-400 to-pink-300`.
- **Primary button gradient** — `from-[#3b82f6] to-[#06b6d4]` (blue) / `from-pink-500 to-amber-500` (pink). Frost uses indigo→violet. Calm uses a flat muted stone — **no gradient**.
- Avoid purple/bluish-purple gradients; stay on-theme.

### Backgrounds

- Solid theme-specific hex on `<body>` (`#0a1628`, `#1a0a14`, `#f8fafc`, `#1c1917`).
- Noise/paper-grain textures via inline SVG-in-CSS for notebook/book-page surfaces.
- No photographic or illustration backgrounds.
- The flipbook (`stf__*`) classes introduce a very heavy aged-leather aesthetic used *only* for the handwritten notes module — not core UI.

### Transparency & blur

- Card bg tokens at 50–80% opacity stacked on themed bg.
- `backdrop-blur-md` appears on pink theme dialogs and glassy overlays — used sparingly.

### Animation

- **Transitions:** `transition-all duration-300` is the default for icons; `duration-200` for hover bg.
- **Easing:** `cubic-bezier(0.4, 0, 0.2, 1)` (Tailwind default) for most; `cubic-bezier(0.68, -0.55, 0.265, 1.55)` spring for entry pops.
- **Framer Motion** drives step transitions, reorder, and list insertions.
- **Tap feedback:** `active:scale-95` + `hover:scale-105` on tappable cards.
- **Shimmer** keyframe (2.5s loop) for loading/skeleton states.
- **No bouncy loading spinners or Lottie.** Just the shimmer and the built-in cyan spinner icon.

### Hover / press states

- Hover: brighter text + brighter inset ring + soft glow bloom (blue/pink). Calm: slightly lighter bg.
- Press: `active:scale-95` (buttons), `scale-105` for entry.
- Haptics: `navigator.vibrate(50)` on long-press; triple-pulse `[5,5,5]` on step-back.

### Fixed elements

Sticky app header + bottom mobile nav. The expense form measures its own header with a `ResizeObserver` and offsets content dynamically — don't hardcode top offsets.

### Color vibe of imagery

N/A — the app has no photography or illustration. All visual richness comes from glow, gradient-clipped text, and category colors (each category carries its own hex).

---

## Iconography

ERA.AI uses two stacked icon systems:

1. **FuturisticIcons.tsx** — a custom in-repo SVG library (~3400 lines, ~100 icons) with a consistent geometric neon look: `24×24`, `stroke="currentColor"`, `strokeWidth="2"`, `strokeLinecap="round"`, `strokeLinejoin="round"`, wrapped in `transition-all duration-300`. Used for brand-critical moments (DollarSign, Calculator, Mic, Save, Calendar, Plus, X, Check, ArrowRight, Refresh, ChevronLeft, Edit2).

2. **lucide-react** — for everything else (Calendar, GripVertical, FolderTree, Lightbulb, Check, MinusCircle, MapPin, Eye, EyeOff, X, PenLine, WifiOff). Imported on-demand.

**Category icons** come from `getCategoryIcon(name)` — a Lucide-backed mapping with `FolderTree` fallback. Each category carries its own hex `color`.

**Glow rules.** Every FuturisticIcon gets a theme-aware `drop-shadow` from `useThemeClasses().glow` / `iconGlow` / `iconGlowStrong`. `calm` theme disables all glows.

**Emoji?** Not in production UI. Dev-facing docs only.

**Substitutions.** I wasn't able to copy the entire `FuturisticIcons.tsx` file (too large for the card format), so the UI kit here uses **Lucide React via CDN** as a stand-in for the Futuristic set. The PWA icons, app-tile icons, and category SVGs in `assets/` are lifted **directly from the codebase** — those are the real brand marks.

**Flagged substitutions.**
- `Geist` / `Geist Mono` → pulled from Google Fonts (Next.js would normally inline them); swap in local `.woff2` for offline parity.
- `FuturisticIcons.*` → replaced by near-equivalent Lucide icons in the UI kit. Replace with the real set for production.

---

## Index

| File / Folder | What it is |
|---|---|
| `README.md` | You are here. |
| `colors_and_type.css` | CSS custom properties for all four themes + semantic type styles. Import first. |
| `SKILL.md` | Agent-Skill-compatible entry point. |
| `assets/` | Real PNG + SVG icons lifted from `budget-app/public/`. |
| `preview/` | Design System tab cards — swatches, type specimens, components. |
| `ui_kits/expense-form/` | High-fidelity React/JSX recreation of the New Expense Form. |
| `fonts/` | (empty placeholder) — drop Geist `.woff2` files here when available. |

---

## Open questions / caveats

1. **Font files not available.** Geist + Geist Mono are loaded from Google Fonts. Confirm if you want local `.woff2` copies.
2. **FuturisticIcons.tsx is 3,400 lines** — not bulk-copied. The UI kit approximates with Lucide. Want me to port the real set into `assets/icons/`?
3. Only the `blue` theme is wired up in the UI kit. The tokens for all four are defined in CSS — I can wire a theme-switcher if useful.
4. **No photography / illustration** was found in the codebase — if ERA has marketing assets elsewhere (Figma, Notion, Linear), share a link.
