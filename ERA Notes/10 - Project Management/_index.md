---
created: 2026-05-29
updated: 2026-07-30
type: index
status: living
tags:
  - pm/index
---

# 10 · Project Management — Command Center

> **Start here when you ask "what do I do next?"** Two files per campaign, one job each:
>
> 1. **Truth & direction** — `<Campaign> — Master Book.md`: current state with a scored maturity read, the shipped log, the pain inventory, the locked decisions, the acceptance criteria, and a **Successor Briefing** (task-tier map, trap registry, verification manifest) for AI sessions. Trust it as of its `updated:` stamp, then delta with `git log`.
> 2. **Execution** — `4 - Checklist.md`, as **Now / Next / Later** lanes. One item grammar for all of them: [_Conventions](<_Conventions.md>), validated by `pnpm pm:lint`, seeded from [_Templates/](<_Templates/>).
>
> **View:** `pnpm pm` opens the consolidated Task board/table — every campaign's items with ID / severity / effort chips, filterable (`m:Budget s:blocker is:open`), click-through to the exact line.

---

## Campaigns

| Campaign | Prefix | Book | Queue |
|---|---|---|---|
| **Budget** (finance cluster) | `BUD` | [Master Book](<Budget/Budget — Master Book.md>) | [Checklist](<Budget/4 - Checklist.md>) |
| **Schedule** (Items & Reminders) | `SCH` | [Master Book](<Schedule/Schedule — Master Book.md>) | [Checklist](<Schedule/4 - Checklist.md>) |
| **Kitchen** (Recipes · Meal · Inventory · Shopping) | `KIT` | [Master Book](<Kitchen/Kitchen — Master Book.md>) | [Checklist](<Kitchen/4 - Checklist.md>) |
| **Trips** (lifecycle travel junction) | `TRIP` | [Master Book](<Trips/Trips — Master Book.md>) | [Checklist](<Trips/4 - Checklist.md>) |
| **Hub & ERA** (Hub Chat · AI · Voice) | `HUB` | [Master Book](<Hub & ERA/Hub & ERA — Master Book.md>) | [Checklist](<Hub & ERA/4 - Checklist.md>) |
| **Notifications & Alerts** | `NOTIF` | [Master Book](<Notifications & Alerts/Notifications & Alerts — Master Book.md>) | [Checklist](<Notifications & Alerts/4 - Checklist.md>) |
| **Healthcare** | `HLTH` | [Master Book](<Healthcare/Healthcare — Master Book.md>) | [Checklist](<Healthcare/4 - Checklist.md>) |
| **Outfits** (wardrobe) | `OUT` | [Master Book](<Outfits/Outfits — Master Book.md>) | [Checklist](<Outfits/4 - Checklist.md>) |
| **PM Tooling** (the command centre itself) | `R` | [Master Book](<PM Tooling/PM Tooling — Master Book.md>) | [Checklist](<PM Tooling/4 - Checklist.md>) |
| **Delivery** (agentic delivery sessions) | `DLV` | [Master Book](<Delivery/Delivery — Master Book.md>) | [Checklist](<Delivery/4 - Checklist.md>) |
| **Native App** (Capacitor plan, not started) | — | [Master Book](<Native App/Native App — Master Book.md>) | *(no checklist yet — register `NAT` first)* |

**Every campaign folder holds exactly two files:** the Master Book and the checklist. Nothing else. Superseded material lives in [_Archive/](<_Archive/_index.md>), which **no PM tool scans**.

## Standing plans (read, don't execute from)

| Doc | What it is |
|---|---|
| [ERA Awakening — Master Execution Plan](<ERA Awakening — Master Execution Plan (2026-07-06).md>) | The proactive-era contract (Jul 6 → Oct 4, 2026): scheduler → briefing → tested ERA brain → voice → learning loop. Feeds campaign Now lanes. **The active execution contract** — execute its WP queue, don't re-plan it. |
| [ERA Top View — Design Study](<ERA Top View — Design Study (2026-07-17).md>) | The Hub L-0 glance surface as the pull mouth of the briefing brain. Sequenced *behind* the Awakening work packets. |
| [FABLE — Testament](<FABLE — Testament (2026-07-18).md>) | The operating doctrine for AI sessions: how to start, what to trust, what to hand on. |
| [0 - Inbox](<0 - Inbox.md>) | Raw capture. Triaged into canonical items by `/triage-inbox`. |

---

## How to use this set

- **Daily:** open `pnpm pm`, work the **Now** lanes; item detail is one click away.
- **Capturing a raw thought:** drop it in [0 - Inbox](<0 - Inbox.md>) (or the 💡 capture button in the dashboard topbar), then run `/triage-inbox` to elaborate it and have it filed as a canonical item.
- **Adding an item:** write it in canonical grammar ([_Conventions](<_Conventions.md>)) in the right campaign's `4 - Checklist.md`, then `pnpm pm:lint`.
- **Finishing an item:** tick `[x]`; at the next touch sweep it into the Master Book's **Shipped Log** with a dated stamp and delete the line (Hard Rule 25).
- **Setting direction:** read the campaign's Master Book — *Current State* for where it is, *Pain Inventory* for what hurts, *Vision & Decisions* for what's already been decided (don't re-litigate) — then drop concrete items into the lanes.
- **Starting a session as an AI model:** read the campaign's **Successor Briefing** section first. It tells you which tasks are safe at your tier, which traps are live, and how to verify the book is still true.
