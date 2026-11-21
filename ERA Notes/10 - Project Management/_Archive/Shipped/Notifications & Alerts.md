---
created: 2026-11-11
updated: 2026-11-21
type: archive
status: superseded
owner: Elio
---

# Notifications & Alerts — shipped work

> Written by `pnpm pm:ship`. Full receipts and acceptance criteria of completed Notifications & Alerts items, plus Master Book state-log entries older than the newest 3. The [Master Book](<../../Notifications & Alerts/Notifications & Alerts — Master Book.md>) keeps one dated line per item in its Shipped Log. Nothing under `_Archive/` is read by a PM tool.

## Shipped items

### 2026-07-10 · Google Calendar backup sync

- ✅ 2026-07-10 — **Google Calendar backup sync** (one-way, Calendar API not ICS) for Scheduled notifications, with three same-day fix passes — including catching its own "code-complete" claim being false when sync never fired from online mutations

### NOTIF-22

- ✅ 2026-11-21 — **NOTIF-22** Refuse cron calls when the secret is unset — [criteria](<../../Notifications & Alerts/Notifications & Alerts — Master Book.md#notif-22>) (Shared isCronAuthorized (unset/empty secret rejects all, timing-safe, per-call env read) gates all six cron routes; purge-recycle-bin and gcal-reconcile no longer accept Bearer undefined. cronAuth.test.ts (all handlers, red on the two routes before fix) + lib unit tests + HR-8 detector fixture/test; typecheck clean, 263 tests pass. Owner UAT on a Preview deployment pending.)

## State log
