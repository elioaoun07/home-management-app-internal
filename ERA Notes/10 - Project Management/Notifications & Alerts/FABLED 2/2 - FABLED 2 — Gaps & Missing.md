---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - module/notifications
---

# Notifications & Alerts · FABLED 2.2 — Gaps & Missing

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · **2 · Gaps** · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)
>
> Ranked technical absences (the campaign [Feature State](<../1 - Feature State.md>) Part B owns the UX pain inventory — not duplicated here).

---

## 🔴 G1 — No delivery policy layer exists at all

No quiet hours, no per-day push budget, no priority classes, no per-type mute. Today this is tolerable (three cron producers). The moment the briefing composer or any proposal engine ships, it becomes the app's #1 churn risk: unbounded proactive sends with no policy is how households disable notifications permanently. The gap must close **before** the composer's first push, not after ([file 4 · E1](<4 - FABLED 2 — Future Enhancements.md>)).

## 🟠 G2 — Two hand-synced routers

`getActionRoute()` (in-app) and the `sw.js` `notificationclick` map (push) each hardcode type → destination. The June fix had to patch both; the next type will too, and the failure mode (silently diverging in-app vs push behavior) is exactly the class of bug that took the items summary weeks to notice. One routing table, two consumers ([file 3 · O2](<3 - FABLED 2 — Optimization Plan.md>)).

## 🟠 G3 — Delivery outcomes are write-only

Sends are logged (`pushLogger`) but nothing reads outcomes: no acted/dismissed/ignored feedback, no per-type engagement rates. Consequence: the system can never learn timing, never auto-mute a type the user always swipes away, and the FAR's "Notification Regret < 20%" metric is unmeasurable. Start *recording* act/dismiss now — learning can come later, but data lost now is gone ([file 4 · E3](<4 - FABLED 2 — Future Enhancements.md>)).

## 🟠 G4 — Grouping infrastructure unused

Crons set `group_key` for dedup; the drawer renders a flat list. Five item reminders = five full rows. The schema already paid for the fix; only the render is missing ([file 3 · O3](<3 - FABLED 2 — Optimization Plan.md>)).

## 🟡 G5 — Retention policy is accidental

`expires_at` varies by producer (items summary 24h; others ad-hoc). No documented retention intent, no cleanup verification. One decision + one paragraph.

## 🟡 G6 — Undo compliance unverified (Hard Rule #1)

Dismiss/snooze on drawer + alerts page: do their toasts carry Undo? Unaudited since the campaign flagged it. 15-minute check; either compliant or a quick fix.

## 🟡 G7 — Cron `console.*` density (Hard Rule #22)

The three notification crons remain top offenders; they're also the app's only unattended writers, i.e., exactly where structured Error-Logs entries would actually be read. Sweep them first when the global cleanup runs.

## ⚪ G8 — No notification design language

Drawer (Lucide + theme classes) vs alerts page (emoji + severity borders) — two visual systems for one stream. Unify when the campaign's density redesign lands (one tokens file: icon set, severity palette honoring Hard Rule #3, spacing).
