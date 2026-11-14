---
created: 2026-09-10
updated: 2026-11-11
type: checklist
status: active
owner: Elio
---

# Notifications & Alerts — Checklist

[Master Book](<Notifications & Alerts — Master Book.md>) · [All campaigns](<../_index.md>) · [Grammar](<../_Conventions.md>)

**Now** is this week's sprint. **Next** is the ordered queue. **Later** is parked or conditional. Each ID links to its acceptance. Finish one with `pnpm pm:ship <ID>`.

## Now

- [ ] **NOTIF-22** Refuse cron calls when the secret is unset — [criteria](<Notifications & Alerts — Master Book.md#notif-22>) _(friction - S)_

## Next

**Needs you**

- [ ] **NOTIF-6.6** Live-verify Google Calendar sync once credentials are set — [criteria](<Notifications & Alerts — Master Book.md#notif-66>) _(friction - M)_

**Delivery correctness**

- [ ] **NOTIF-23** Claim an item alert before sending it — [criteria](<Notifications & Alerts — Master Book.md#notif-23>) _(friction - S)_
- [ ] **NOTIF-19** Centralize recipient delivery policy — [criteria](<Notifications & Alerts — Master Book.md#notif-19>) _(friction - M)_
- [ ] **NOTIF-21** Recover recipient-event delivery durably — [criteria](<Notifications & Alerts — Master Book.md#notif-21-1>) _(friction - M)_

**Surfaces**

- [ ] **NOTIF-2.1** Verify the bell and unread state on phones — [criteria](<Notifications & Alerts — Master Book.md#notif-21>) _(friction - S)_
- [ ] **NOTIF-3.1** Simplify and verify the notification drawer — [criteria](<Notifications & Alerts — Master Book.md#notif-31>) _(friction - M)_
- [ ] **NOTIF-3.2** Make drawer quick actions compact and icon-only — [criteria](<Notifications & Alerts — Master Book.md#notif-32>) _(friction - M)_

## Later

**Alerts and actions**

- [ ] **NOTIF-4.1** Simplify and verify Alerts cards — [criteria](<Notifications & Alerts — Master Book.md#notif-41>) _(friction - M)_
- [ ] **NOTIF-4.3** Tighten the transaction-reminder card copy — [criteria](<Notifications & Alerts — Master Book.md#notif-43>) _(friction - M)_
- [ ] **NOTIF-5.6** Provide real Undo for dismiss and snooze — [criteria](<Notifications & Alerts — Master Book.md#notif-56>) _(annoyance - S)_
- [ ] **NOTIF-5.8** Add bulk actions: snooze all, clear category — [criteria](<Notifications & Alerts — Master Book.md#notif-58>) _(annoyance - M)_

**Policy questions**

- [ ] **NOTIF-5.4** Resolve cron diagnostic policy — [criteria](<Notifications & Alerts — Master Book.md#notif-54>) _(annoyance - S)_
- [ ] **NOTIF-20** Resolve shortcut Done occurrence semantics — [criteria](<Notifications & Alerts — Master Book.md#notif-20>) _(friction - M)_
