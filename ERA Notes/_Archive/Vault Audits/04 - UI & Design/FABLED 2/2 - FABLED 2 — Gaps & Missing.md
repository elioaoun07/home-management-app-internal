---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/ui-design
---

# UI & Design · FABLED 2.2 — Gaps & Missing

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · **2 · Gaps** · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)

---

## 🔴 G1 — The visual rules are unaudited beliefs

Undo-on-every-toast, no-red-on-rows, opaque panels, header offsets, reduced-motion — none has ever had a verification pass. The one surface that *was* audited (notifications, 06-19) immediately found violations of three of them (perpetual animation, possible border-color breach, unverified Undo). Extrapolate: the other surfaces hide similar drift. One audit checklist, run once, would convert the whole rulebook from belief to fact ([file 3 · O1](<3 - FABLED 2 — Optimization Plan.md>)).

## 🟠 G2 — Two visual languages for notifications, two dashboards for money

The two live divergences ([file 1 §3](<1 - FABLED 2 — Current Implementation.md>)). Both have owners and decisions pending; the design-system cost is that every week they coexist, new code picks a side at random.

## 🟠 G3 — No accessibility baseline at all

No `prefers-reduced-motion` policy (the bell proves it), no contrast check on the four themes (frost/calm pastels on white/40 text are suspect), no focus-visible audit, no touch-target minimum written down (the NFC modal did 44px-class targets by instinct, not by rule). For a two-user household app this is polish — but motion sensitivity and contrast affect *these* two users too.

## 🟡 G4 — Design tokens exist only as convention

`--theme-*` vars + `useThemeClasses()` are half a token system. Spacing, radii, animation durations, severity colors, blur values are ad-hoc per file. The cost shows at every "make it match X" request — matching means reverse-engineering the original instead of referencing a token.

## 🟡 G5 — No component inventory between `ui/` and features

`src/components/ui/` is protected; everything above it (34+ shared components in `components/`) has no catalog — which drawer, which sheet, which card variant to reuse is oral tradition. The Atlas covers *pages*; components have nothing similar.

## ⚪ G6 — Watch + guest surfaces are off-system

Watch UI and guest portal render their own reduced grammars (rightly), but nothing documents *which* rules still bind (color identity? undo? icon tier?). One paragraph each would prevent drift-by-assumption.
