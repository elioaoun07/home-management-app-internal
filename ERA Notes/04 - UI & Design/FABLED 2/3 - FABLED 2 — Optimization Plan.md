---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/ui-design
---

# UI & Design · FABLED 2.3 — Optimization Plan

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · **3 · Optimization** · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)

---

## O1 — The visual-rule audit pass (fixes G1; one mobile-viewport session)

A checklist sweep across the main surfaces (expense form, dashboard, reminders, hub, notifications, catalogue): every toast → Undo present and working · row colors → no red on items · floating panels → opaque `tc.bgPage` · fixed headers → content offset · number inputs → `inputMode="decimal"` · animations → finite or reduced-motion-guarded. Log violations as pains in the owning campaigns (HR 25). The audit's P2 "mobile viewport audit" is this same session — do them together.

## O2 — Resolve the two divergences (fixes G2)

Notification language: one tokens decision (icon tier, severity palette honoring HR 3, spacing) applied during the campaign's density redesign. Dashboards: the v2/v3 merge decision with a date ([Budget FABLED 2.3 · O8](<../../10 - Project Management/Budget/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)).

## O3 — Write the motion policy (fixes G3's sharpest edge; one paragraph + one CSS block)

Rule: no infinite attention animations; arrival animations play once; everything respects `prefers-reduced-motion` via a global media-query block in `globals.css` that zeroes the app's keyframes. The bell fix ([Notifications FABLED 2.3 · O1](<../../10 - Project Management/Notifications & Alerts/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)) is its first application.

## O4 — Tokenize the top five ad-hoc values (fixes G4 incrementally)

Don't build a token system; promote the five most-reused magic values to named vars/classes as they're next touched: severity colors, standard blur (5px), sheet radii, standard durations, touch-target minimum. Each promotion happens *inside* a feature PR — zero dedicated refactor.

## O5 — Component inventory, Atlas-style (fixes G5; script-first)

A generated `Components.md` (name, file, one-line purpose, used-by count via import scan) using the same codegen culture as the Atlas builder. Regenerate in the same hook. Hand-curation only for the "prefer this over that" guidance column.

## O6 — One paragraph each for Watch + Guest (fixes G6)

Which hard rules bind on reduced surfaces; append to their vault docs.

---

### Sequencing

```
O1 (the audit — books the truth) → O3 (motion policy while fixing the bell)
  → O2 (the two decisions) → O4/O5/O6 opportunistic
```
