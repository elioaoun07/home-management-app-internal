---
created: 2026-05-29
updated: 2026-09-06
type: index
status: living
tags:
  - pm/index
---

# 10 · Project Management — Command Center

> **Start here when you ask "what do I do next?"** Two files at each campaign root, one job each; the supporting ASTRA pair lives one level down:
>
> 1. **Truth & direction** — `<Campaign> — Master Book.md`: current state with a scored maturity read, the shipped log, the pain inventory, the locked decisions, the acceptance criteria, and a **Successor Briefing** (task-tier map, trap registry, verification manifest) for AI sessions. Read the evidence cutoff and current corrections, then delta with `git log`; `updated:` records PM maintenance, not runtime or DB verification.
> 2. **Execution** — `4 - Checklist.md`, as **Now / Next / Later** lanes. One item grammar for all of them: [_Conventions](<_Conventions.md>), validated by `pnpm pm:lint`, seeded from [_Templates/](<_Templates/>).
>
> **View:** `pnpm pm` opens the consolidated Task board/table — every campaign's items with ID / severity / effort chips, filterable (`m:Budget s:blocker is:open`), click-through to the exact line.

---

## Campaigns

| Campaign | Prefix | Book | Queue | ASTRA study |
|---|---|---|---|---|
| **Budget** (finance cluster) | `BUD` | [Master Book](<Budget/Budget — Master Book.md>) | [Checklist](<Budget/4 - Checklist.md>) | [ASTRA Book](<Budget/ASTRA/Budget — ASTRA Book.md>) |
| **Schedule** (Items & Reminders) | `SCH` | [Master Book](<Schedule/Schedule — Master Book.md>) | [Checklist](<Schedule/4 - Checklist.md>) | [ASTRA Book](<Schedule/ASTRA/Schedule — ASTRA Book.md>) |
| **Kitchen** (Recipes · Meal · Inventory · Shopping) | `KIT` | [Master Book](<Kitchen/Kitchen — Master Book.md>) | [Checklist](<Kitchen/4 - Checklist.md>) | [ASTRA Book](<Kitchen/ASTRA/Kitchen — ASTRA Book.md>) |
| **Trips** (lifecycle travel junction) | `TRIP` | [Master Book](<Trips/Trips — Master Book.md>) | [Checklist](<Trips/4 - Checklist.md>) | [ASTRA Book](<Trips/ASTRA/Trips — ASTRA Book.md>) |
| **Hub & ERA** (Hub Chat · AI · Voice) | `HUB` | [Master Book](<Hub & ERA/Hub & ERA — Master Book.md>) | [Checklist](<Hub & ERA/4 - Checklist.md>) | [ASTRA Book](<Hub & ERA/ASTRA/Hub & ERA — ASTRA Book.md>) |
| **Notifications & Alerts** | `NOTIF` | [Master Book](<Notifications & Alerts/Notifications & Alerts — Master Book.md>) | [Checklist](<Notifications & Alerts/4 - Checklist.md>) | [ASTRA Book](<Notifications & Alerts/ASTRA/Notifications & Alerts — ASTRA Book.md>) |
| **Healthcare** | `HLTH` | [Master Book](<Healthcare/Healthcare — Master Book.md>) | [Checklist](<Healthcare/4 - Checklist.md>) | [ASTRA Book](<Healthcare/ASTRA/Healthcare — ASTRA Book.md>) |
| **Outfits** (wardrobe) | `OUT` | [Master Book](<Outfits/Outfits — Master Book.md>) | [Checklist](<Outfits/4 - Checklist.md>) | [ASTRA Book](<Outfits/ASTRA/Outfits — ASTRA Book.md>) |
| **PM Tooling** (the command centre itself) | `R` (no hyphen) | [Master Book](<PM Tooling/PM Tooling — Master Book.md>) | [Checklist](<PM Tooling/4 - Checklist.md>) | [ASTRA Book](<PM Tooling/ASTRA/PM Tooling — ASTRA Book.md>) |
| **Delivery** (agentic delivery sessions) | `DLV` | [Master Book](<Delivery/Delivery — Master Book.md>) | [Checklist](<Delivery/4 - Checklist.md>) | [ASTRA Book](<Delivery/ASTRA/Delivery — ASTRA Book.md>) |
| **Native App** (Capacitor, Phase 4 of the ERA Top Layer plan) | `NAT` | [Master Book](<Native App/Native App — Master Book.md>) | [Checklist](<Native App/4 - Checklist.md>) | [ASTRA Book](<Native App/ASTRA/Native App — ASTRA Book.md>) |

**Every campaign root holds exactly two files:** the Master Book and the checklist. The sanctioned `ASTRA/` subfolder holds its Book/Packets pair ([_Conventions §8](<_Conventions.md#8-astra-studies-sanctioned-2026-09-06>)). Superseded material lives in [_Archive/](<_Archive/_index.md>), which **no PM tool scans**.

## ASTRA landing — 2026-09-06

The studies are subordinate to the active ERA Top Layer plan. They record repository findings and proposed refinements; held sheets are not dispatch-approved, and finishing a child does not complete its broader parent. Canonical work remains in the eleven existing campaign queues. Delivery's two-real-product-completion freeze remains in force.

| Reference | Purpose |
|---|---|
| [10x Portfolio](<ASTRA — 10x Portfolio.md>) | Ten ranked decisions across the workstreams; not another roadmap or queue. |
| [Contradiction Register](<ASTRA — Contradiction Register.md>) | Claims, source evidence, consequences and explicit owner decisions; preserves locked-decision conflicts. |
| [Coverage & Orphans](<ASTRA — Coverage & Orphans.md>) | Ownership and depth across the existing campaign boundaries. |
| Proactive ERA: [Intelligence Model](<Proactive ERA/Proactive ERA — Intelligence Model.md>) · [Knowledge Graph](<Proactive ERA/Proactive ERA — Signal & Knowledge Graph.md>) · [Opportunities](<Proactive ERA/Proactive ERA — Opportunity Portfolio.md>) · [Silence & Trust](<Proactive ERA/Proactive ERA — Silence, Trust & Intervention.md>) · [Architecture](<Proactive ERA/Proactive ERA — Architectural Leverage.md>) · [Experiments](<Proactive ERA/Proactive ERA — Experiments.md>) | Owner-commissioned discovery of proactive household intelligence; source cutoff `83e44be`, no application implementation or new queue. |
| Top Layer: [Architecture](<Top Layer/Top Layer — ASTRA Architecture.md>) · [Experience](<Top Layer/Top Layer — ASTRA Experience.md>) · [Completion](<Top Layer/Top Layer — ASTRA Completion.md>) · [Packets](<Top Layer/Top Layer — ASTRA Packets.md>) | Cross-cutting study folder; no new campaign, checklist or prefix. |
| Command Center: [Architecture](<Command Center/Command Center — ASTRA Architecture.md>) · [Orchestration](<Command Center/Command Center — ASTRA Orchestration.md>) · [Experience](<Command Center/Command Center — ASTRA Experience.md>) · [Packets](<Command Center/Command Center — ASTRA Packets.md>) | Cross-cutting study folder; work stays under the existing owning campaigns. |

## Standing plans (read, don't execute from)

| Doc | What it is |
|---|---|
| [ERA Top Layer — Master Plan](<ERA Top Layer — Master Plan (2026-09-02).md>) | Sep 2 → Dec 31, 2026, 17-week program covering manual modules, reactive ERA, proactive ERA (scheduler → briefing → learning loop), voice, offline, security and native, in dated packets. **The active execution contract** — execute its E/M/N/H packet catalog (§5), don't re-plan it. |
| ~~ERA Awakening — Master Execution Plan~~ | *(superseded 2026-09-02 — G0/G1/G2 all missed; see its §14 for the scored delta and the plan above for the successor)* |
| ~~ERA Top View — Design Study~~ | *(superseded 2026-09-02 — folded into the Master Plan's E-10/E-14/E-15/E-20)* |
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
