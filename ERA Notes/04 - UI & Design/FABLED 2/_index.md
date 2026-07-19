---
created: 2026-07-02
type: index
status: baseline-frozen
superseded: 2026-07-18
owner: Elio
tags:
  - pm/fabled2
  - scope/ui-design
---

# UI & Design · FABLED 2 — Index

> ⚠️ **Frozen v2 baseline (2026-07-02)** — superseded 2026-07-18 by [`FABLED 3/`](<../FABLED 3/_index.md>) (model-generation handoff). Do not update; new history goes to the FABLED 3 delta ledger.


> The deep-dive audit of the **design system** — themes, iconography, layout rules, the Atlas, and the visual hard rules — as it actually holds up in the shipped app. Verified **2026-07-02**.

| # | File | Read it when… |
|---|---|---|
| 1 | [Current Implementation](<1 - FABLED 2 — Current Implementation.md>) | You want the design system's real inventory and which rules are honored where. |
| 2 | [Gaps & Missing](<2 - FABLED 2 — Gaps & Missing.md>) | You want the visual debt list — divergent languages, accessibility, unaudited rules. |
| 3 | [Optimization Plan](<3 - FABLED 2 — Optimization Plan.md>) | You want the consolidation moves. |
| 4 | [Future Enhancements](<4 - FABLED 2 — Future Enhancements.md>) | You want the design-infrastructure bets (tokens, visual regression, a11y). |

## Maturity scoreboard (2026-07-02)

| Dimension | Score | One-line justification |
|---|---|---|
| **Theming** | 8 | 4 themes on CSS vars + `data-theme`, query invalidation on switch, person-absolute color identity — coherent and documented. |
| **Rule codification** | 7 | The visual hard rules (undo toasts, no-red rows, opaque panels, header offsets, decimal inputs) encode real learned lessons. |
| **Rule verification** | 3 | Almost none are audited: Undo coverage, severity borders, reduced-motion, panel opacity — all "believed held." |
| **Consistency** | 4 | Two notification visual languages; two live dashboards (v2/v3); emoji vs Lucide vs futuristic SVG mixing per surface. |
| **Design infrastructure** | 3 | Atlas auto-regen is excellent; no tokens file, no component inventory, no visual regression, no a11y baseline. |
| **Overall** | **5.0** | Strong taste, strong rules, weak instruments — the system relies on the designer's memory being in the room. |

## The next 3 moves

1. **One notification design language** — with the campaign's density redesign ([Notifications FABLED 2.2 · G8](<../../10 - Project Management/Notifications & Alerts/FABLED 2/2 - FABLED 2 — Gaps & Missing.md>)).
2. **The visual-rule audit pass** — Undo/borders/motion/opacity, one checklist run ([file 3 · O1](<3 - FABLED 2 — Optimization Plan.md>)).
3. **Decide Review v2 vs v3** — two dashboards is a divergence engine ([Budget FABLED 2.3 · O8](<../../10 - Project Management/Budget/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)).
