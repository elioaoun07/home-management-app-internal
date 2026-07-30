---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - module/notifications
---

# Notifications & Alerts · FABLED 2.4 — Future Enhancements

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · **4 · Enhancements**
>
> The module's future is not "more notifications" — it's **fewer, better-timed, learnable ones**. Everything below serves that inversion.

---

## E1 — The delivery policy engine ⭐ (the module's 10×, and the composer's precondition)

**Impact: Highest (gates the app's whole proactive future) · Effort: M**

One policy layer every producer must pass through: **quiet hours** (per-user window) · **daily push budget** (e.g., 3/day; overflow → in-app only or digest) · **priority classes** (urgent bypasses budget; info never pushes, drawer-only) · **per-type mute** (user-facing, in `notification_preferences`). Seam: a single `deliver(notification)` function in `src/lib/notifications/` that crons and future producers call instead of `pushSender` directly — the policy lives in one place, and "who may interrupt you" becomes a product feature.
**Kill criterion:** none. FAR 2.5 already names this; the only mistake available is building the composer first.

## E2 — The Sunday digest

**Impact: High · Effort: S–M after E1** — the budget's overflow destination and the weekly review's spine: everything below-urgent batches into one composed Sunday notification (content from the briefing composer; policy from E1). One cron, one card.

## E3 — The learning loop (rides O4's data)

**Impact: Med–High · Effort: M, staged**

Stage 1: per-type engagement report (acted/dismissed/ignored rates — readable in the drawer's settings). Stage 2: auto-suggestions ("you dismiss the evening summary 90% of the time — mute it?"). Stage 3: timing adaptation (send when historically acted). Each stage ships alone; all impossible until [O4](<3 - FABLED 2 — Optimization Plan.md>) starts recording.
**Kill criterion:** for a 2-person household, stop at Stage 2 if Stage 1's data shows fewer than ~5 notification types in active use — timing adaptation needs volume you may simply not have.

## E4 — The action inbox convergence

**Impact: High coherence · Effort: M–H (design-led)**

Today "things needing me" scatter across: notifications, drafts (Budget), draft reminders (Schedule), low-stock proposals (Kitchen, future), briefing cards (future). These are all the same concept — **a reviewable proposal with provenance and one-tap resolution**. Converge them into one inbox surface (the alerts page's natural evolution), where every row shares the accept/edit/dismiss grammar the bulk-convert sheet proved. This is FAR R3/J8 with a concrete seam: the `notifications` table already has `action_type`/`action_data` — proposals are notifications with verbs.
**Kill criterion:** don't start until at least two proposal producers exist (drafts + one more); an inbox of one type is just the drawer renamed.

## E5 — Household-aware delivery

**Impact: Med · Effort: S–M** — the same event shouldn't buzz two phones identically: route by `responsible_user_id` (owner gets the action push, partner gets drawer-only awareness), respect the color-identity rule in rendering, and let "notify all household" be the explicit flag it already is in the data. The all-household cron fix (Schedule, 06-21) proved the targeting substrate works; this makes it a *policy*, not per-cron code.

## E6 — Notification → conversation

**Impact: Med · Effort: S after ERA E1** — every briefing/alert card gets "discuss" — tapping opens the Hub thread with the notification as context, ERA ready to act ("move it to Thursday" / "log it as $40"). Closes the loop between the two flagship junctions: notifications become conversation starters, not dead ends.

---

## Recommended order

```
E1 (before the composer ships — non-negotiable) → E2 (its overflow valve)
  → O4 data accrues → E3 stage 1 → E5 (policy-ize household targeting)
  → E4 when a second proposal producer exists → E6 after ERA's composer · E3 stages 2–3 later
```
