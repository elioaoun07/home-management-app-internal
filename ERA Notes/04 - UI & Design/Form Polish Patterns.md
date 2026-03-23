---
tags:
  - type/ui
  - scope/cross-cutting
  - pattern/theme
---

# Form Polish Patterns

Reusable patterns established during the Mobile Expense Form polish. Apply these when building or polishing any multi-step form.

---

## 1. Theme Token Reference

Use `useThemeClasses()` from `src/hooks/useThemeClasses.ts` for all dynamic colors.

| Element Type | Token(s) | Never Use |
|---|---|---|
| Primary text (labels, names) | `themeClasses.text` | `text-cyan-400`, `text-secondary` |
| Highlighted text (selected values, input text) | `themeClasses.textHighlight` | `text-white` |
| Muted text (secondary info, hidden items) | `themeClasses.textMuted` | `text-slate-400` |
| Faint text (hints, prefixes, separators) | `themeClasses.textFaint` | `text-slate-500`, `text-slate-600` |
| Accent text (edit instructions) | `themeClasses.textAccent` | `text-cyan-400` |
| Hover text | `themeClasses.textHover` | `hover:text-white` |
| Borders (cards, dividers) | `themeClasses.border` | `border-slate-700/50` |
| Active borders | `themeClasses.borderActive` | hardcoded active colors |
| Focus borders (inputs) | `themeClasses.focusBorder` | `focus:border-cyan-500/40` |
| Focus-within borders (wrappers) | `themeClasses.focusWithinBorder` | `focus-within:border-cyan-*` |
| Input placeholders | `themeClasses.placeholder` | `placeholder:text-slate-500` |
| Hero card gradient | `themeClasses.heroCardBg` | `from-slate-800/60 via-slate-900/40` |
| Hero card accent | `themeClasses.heroCardAccent` | `from-cyan-500/5` |
| Hero card border | `themeClasses.heroCardBorder` | `border-slate-700/40` |
| Dashed "add new" border | `themeClasses.dashedBorder` | `border-slate-600` |
| Dashed hover border | `themeClasses.dashedBorderHover` | `hover:border-cyan-500/50` |
| Dashed hover bg | `themeClasses.dashedBgHover` | `hover:bg-cyan-500/5` |
| Pill/chip bg | `themeClasses.pillBg` | `bg-slate-800/80` |
| Pill hover bg | `themeClasses.pillBgHover` | `hover:bg-slate-700/80` |
| Modal/popover bg | `themeClasses.modalBg` | `bg-slate-900` |
| Modal border | `themeClasses.modalBorder` | `border-slate-700` |
| Surface bg (buttons in popovers) | `themeClasses.bgSurface` | `bg-slate-800` |
| Subtle hover bg | `themeClasses.hoverBgSubtle` | `hover:bg-slate-700` |

**Exception:** `text-white` is acceptable on colored-background icons (e.g., `bg-emerald-500 text-white`) and neo-gradient buttons.

---

## 2. Spacing Standards

| Element | Padding | Min Height |
|---|---|---|
| Selection grid cards (accounts, categories) | `p-3` | `min-h-[65px]` (categories), none (accounts) |
| Subcategory grid cards | `p-3` | `min-h-[55px]` |
| Edit-mode reorderable cards | `p-3` | — |
| Hidden item cards | `p-3` | — |
| "Add new" dashed buttons | `p-3` | matches adjacent cards |
| Grid gaps | `gap-2` | — |
| Section spacing | `space-y-3` or `space-y-4` | — |
| Step container | `space-y-4` | — |

---

## 3. Dynamic Header Pattern

Never use hardcoded pixel positions (`top-[205px]`) for content below a fixed header. Instead, measure the header dynamically:

```tsx
const headerRef = useRef<HTMLDivElement>(null);
const [headerHeight, setHeaderHeight] = useState(80);

useEffect(() => {
  const el = headerRef.current;
  if (!el) return;
  const ro = new ResizeObserver(([entry]) => {
    if (entry) setHeaderHeight(entry.contentRect.height + entry.target.getBoundingClientRect().top);
  });
  setHeaderHeight(el.getBoundingClientRect().bottom);
  ro.observe(el);
  return () => ro.disconnect();
}, []);

// On the header:
<div ref={headerRef} className="fixed top-0 ..." />

// On the content area:
<div style={{ top: `${headerHeight}px` }} className="fixed ..." />
```

This handles safe-area-inset changes, AccountBalance showing/hiding, and any future header height changes.

---

## 4. Color Rules

1. **Never use `text-white`** for text that should adapt to theme — use `themeClasses.textHighlight`
2. **Never hardcode `slate-*` or `cyan-*`** for interactive elements — always use a theme token
3. **Semantic colors are OK to keep:**
   - `text-emerald-400` for money/amounts (universal green = money)
   - `bg-purple-500/20` for dates (intentional semantic color)
   - `text-amber-400/500` for warnings/confirmations
   - `text-white` on colored-background circles (`bg-emerald-500`, `bg-amber-500`)
4. **Progress bars** should be at least `h-1` (4px) with a subtle track: `bg-bg-card-custom/60`
5. **Title text** should be `text-base` for mobile page headers (not `text-sm`)

---

## 5. Form Polish Checklist

Run through this when polishing any form:

- [ ] All text colors use `themeClasses` tokens (no hardcoded `slate-*`, `cyan-*`)
- [ ] All interactive borders use `themeClasses` tokens
- [ ] No hardcoded pixel positions for layout (use ResizeObserver pattern)
- [ ] "Add new" buttons use dashed theme tokens (`dashedBorder`, `dashedBorderHover`, `dashedBgHover`)
- [ ] Step labels are consistent (all use same token, e.g., `themeClasses.text`)
- [ ] Grid cards use standardized padding (`p-3`)
- [ ] Progress bars are at least 4px tall (`h-1`)
- [ ] Edit hints use `themeClasses.textFaint`
- [ ] Hold-to-edit hints use `themeClasses.textFaint`
- [ ] Hidden section headers use `themeClasses.textFaint` with `themeClasses.border` dividers
- [ ] Popover/modal backgrounds use `themeClasses.modalBg` and `themeClasses.modalBorder`
- [ ] Input placeholders use `themeClasses.placeholder` or CSS variable
- [ ] "None" / empty-state buttons have an icon for visual consistency
