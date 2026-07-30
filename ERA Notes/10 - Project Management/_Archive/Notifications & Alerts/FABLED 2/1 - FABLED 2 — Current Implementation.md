---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - module/notifications
---

# Notifications & Alerts · FABLED 2.1 — Current Implementation

> **FABLED 2:** [_index](<_index.md>) · **1 · Implementation** · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)
>
> Verified 2026-07-02. The campaign [Feature State](<../1 - Feature State.md>) holds the surface-by-surface tier table and pain inventory; the authoritative code map is the [Notifications Overview](<../../../03 - Junction Modules/Notifications/Overview.md>). This is the pipeline X-ray.

---

## 1 · The pipeline, end to end

```
producers                 store                    surfaces                  click routing
─────────                 ─────                    ────────                  ─────────────
cron/daily-reminder   →                        →  Web Push (pushSender)  →  sw.js notificationclick
cron/daily-items-     →   notifications table  →  Bell + badge (30s poll) →   → openApp() → postMessage(NAVIGATE)
  reminder                (unified; replaced    →  Drawer (NotificationModal)   → DeepLinkHandler
cron/item-reminders   →    hub_alerts +         →  /alerts page (HubPage        (setActiveTab / setPendingItemId)
in-app emitters       →    in_app_notifications)    alerts render path)      in-app: getActionRoute()
```

- **Types now honest (the June fix):** budget reminder = `daily_reminder` → `/expense` (correct, the reference); items summary = **`daily_items_summary`** (verified in the cron today) → reminders surface; per-item = `item_reminder`/`item_due` with `data.url` deep-link via `setPendingItemId` — the pattern to copy for any new notification type. Migration `2026-06-19_daily-items-summary-notification-type.sql` retyped history.
- **Type-based routing still wins over `action_url`** — `getActionRoute()` (`useNotifications.ts`) and the `sw.js` map are the two routers that must stay in sync by hand. This is the residual structural weakness ([file 2 · G2](<2 - FABLED 2 — Gaps & Missing.md>)).

## 2 · The data model is ahead of the product

`notifications` carries `notification_type`, `action_type/url/data`, **`group_key`** (set by crons for dedup, never used to collapse UI rows), `source`, `priority`, `severity`, `snoozed_until`, `expires_at` (inconsistent retention values), FK links (`item_id`, `transaction_id`, `recurring_payment_id`). `notification_preferences` stores `preferred_times` but no quiet-hours/mute surface exists. `push_subscriptions` tracks endpoint health; `pushLogger.ts`/`pushSender.ts` in `src/lib` do the sending. **Nothing reads delivery outcomes back** — sends are fire-and-forget, so nothing can ever learn ([file 4 · E3](<4 - FABLED 2 — Future Enhancements.md>)).

## 3 · The three surfaces and their jobs

| Surface | Job | State |
|---|---|---|
| Bell + badge (`NotificationBell.tsx`) | calm "something needs you" | perpetual 1s wobble + always-red badge + pulse ring; no reduced-motion guard; no calm caught-up state |
| Drawer (`NotificationModal.tsx` + `NotificationCenter.tsx`) | glanceable triage | over-described rows (2-line body + time + worded action pills + dismiss + dot); flat list despite `group_key`; open animation fixed 06-19 |
| `/alerts` page (HubPage alerts path, ~5,554–5,737) | the detailed view | word-dense, unsegmented, different visual language from the drawer (emoji + severity borders vs Lucide + theme) |

The drawer/page split is *conceptually correct* (fast vs detailed) — the failure is density and inconsistency, not architecture.

## 4 · Hygiene reality

The three cron routes remain among the heaviest `console.*` offenders (Hard Rule #22; app-wide count 594 in 162 files, verified today). Undo compliance on dismiss/snooze (Hard Rule #1) still unverified. Severity border colors on the alerts page still unaudited against Hard Rule #3 (no red on individual rows).

## 5 · What this module uniquely owns going forward

Every proactive ambition in the app ends its pipeline here: the ERA briefing composer, Budget forecast warnings, Kitchen low-stock proposals, Trips re-entry briefings — all become `notifications` rows and pushes. **This module's ceiling is the app's proactive ceiling.** That's why the delivery-policy engine ([file 4 · E1](<4 - FABLED 2 — Future Enhancements.md>)) outranks any single surface fix: without quiet hours, a push budget, and priority classes, the composer's first week of output will train the household to swipe notifications away — and the moat feature dies at delivery.
