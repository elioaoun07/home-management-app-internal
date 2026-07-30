---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - module/notifications
---

# Notifications & Alerts · FABLED 2.3 — Optimization Plan

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · **3 · Optimization** · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)
>
> Hardening + calm. The campaign's file 3 owns the UX redesign sequencing; this file owns the plumbing that should land under it.

---

## O1 — Calm the bell (the campaign's top felt fix; small)

Finite ring (2–3 wobbles on *new arrival*, then still) · badge color by highest severity present, not always-red (Hard Rule #3 spirit) · `prefers-reduced-motion` guard on ring + pulse keyframes · a deliberate caught-up state (subtle check / dimmed bell). All in `NotificationBell.tsx` + `globals.css`.

## O2 — One routing table, two consumers (fixes G2)

A single `notificationRoutes.ts` map (`type → { route, tabTarget, deepLinkKind }`) imported by `getActionRoute()` and — since `sw.js` can't import TS — **generated into** the service worker at build (the atlas build script pattern already proves codegen into `public/` works here). Adding a type becomes one-line; in-app and push can no longer diverge. Include a unit test: every `notification_type` the crons emit has a route entry.

## O3 — Render `group_key` grouping in the drawer (fixes G4)

Collapse rows sharing `group_key` into one summary row ("4 item reminders") expanding on tap. Schema untouched; one render change + a count badge. Do it with the campaign's density pass so rows are redesigned once.

## O4 — Record act/dismiss outcomes (fixes G3's data half)

On every quick-action, dismiss, snooze, and notification click: one row/update capturing (type, action, timestamp). Cheapest form: reuse the existing logging path (`pushLogger`) or add `acted_at`/`dismissed_at` columns to `notifications` (migration per Hard Rule #24). No consumer yet — the point is to stop losing the data the learning loop will need.

## O5 — Undo + severity-border audit (fixes G6 + the Hard Rule #3 check)

15 minutes each: dismiss/snooze toasts carry Undo with a working restore; `getBorderColor(severity)` never paints an individual row red (container headers only).

## O6 — Retention decision (fixes G5)

One rule, e.g.: actionable types expire when acted or after 7 days; summaries after 24h; everything hard-deleted after 30. Write it in the Overview doc; align the crons' `expires_at`; verify cleanup actually runs.

## O7 — Cron console sweep (fixes G7; do first among Hard-Rule-22 work)

The three crons → Error Logs entries for real failures, delete the rest. They're the unattended paths where structured logs pay off most.

---

### Sequencing

```
O1 (felt immediately) → O3 (with the density redesign) → O2 (before any new type ships)
O4 now (data starts accruing) · O5/O6 quick passes · O7 first slice of the global sweep
```

Kill criterion for O2's codegen: if generating into `sw.js` fights the PWA build, fall back to a checked unit test asserting the two maps agree — weaker, but keeps the one-source property testable.
