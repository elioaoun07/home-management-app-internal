---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/ui-design
---

# UI & Design · FABLED 2.4 — Future Enhancements

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · **4 · Enhancements**

---

## E1 — Visual regression harness ⭐ (the design system's missing test layer)

**Impact: High (protects every future UI pass) · Effort: M**

Playwright screenshot tests over ~10 anchor screens × 4 themes × 2 viewports, diffed in CI. The app's UI churn rate (June: Review v3, chips, modals, blur) is exactly the profile where regressions slip — and where the June privacy-tooltip bug (amounts legible on hover despite blur) would have been caught by a hover-state screenshot. Start with 3 screens (dashboard, expense form, reminders); grow on each incident.
**Kill criterion:** if flake management costs more than one caught regression per month, freeze the screen set instead of growing it.

## E2 — The proposal card as a designed object

The junction layer's proposal grammar ([Junction FABLED 2.4 · E2](<../../03 - Junction Modules/FABLED 2/4 - FABLED 2 — Future Enhancements.md>)) needs its visual identity: provenance line, accept/edit/dismiss zones, undo affordance — designed once, before three producers improvise three cards. This is the design system's next *new* component family and its highest-stakes one (it carries the app's trust).

## E3 — Density modes

**Impact: Med · Effort: M** — the notification campaign's compact-row work generalizes: a `density` preference (comfortable/compact) driving row templates on the heavy list surfaces (drawer, alerts, reminders, transactions). One token, several templates — and the drawer/page density debate becomes a user choice instead of a design argument.

## E4 — Theme contrast certification

**Impact: Med · Effort: S** — run the four themes' core token pairs through a contrast checker; adjust the failures (white/40 on pastel is the suspect class); record the passing matrix in `Color Identity.md`. Turns "the calm theme feels washed out" from taste into numbers.

## E5 — The a11y floor

**Impact: Med · Effort: S–M** — after O3's motion policy: focus-visible on interactive elements, aria-labels on icon-only buttons (the futuristic-SVG surfaces are the risk), touch-target minimum written into the form patterns doc. A floor, not a WCAG program — this is a two-user app whose two users deserve the basics.

---

## Recommended order

```
E2 (design the proposal card before producers ship) → E1 (3-screen harness)
  → E4 (one afternoon) → E5 (rides O3) → E3 (when the density redesign lands)
```
