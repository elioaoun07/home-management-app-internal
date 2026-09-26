---
created: 2026-09-10
updated: 2026-09-26
type: pm-index
status: active
owner: Elio
---

# Project Management

Start with a campaign checklist. The eleven checklists form **one backlog**, grouped by accountable owner; the PM Task board consolidates them. Each ID links to its acceptance and dependencies in that campaign’s Master Book.

[Inbox](<0 - Inbox.md>) · [Owner decisions](<_Decisions.md>) · [Conventions](<_Conventions.md>) · [Templates](<_Templates/README.md>) · [Archive](<_Archive/_index.md>)

## Active backlog and module homes

| Campaign | Owns | Pending | Canonical documents |
|---|---|---:|---|
| Budget | Accounts, transactions, imports, drafts, recurring payments, allocation, debts, analytics/dashboard, future purchases, money restore | 33 | [Backlog](<Budget/4 - Checklist.md>) · [Master Book](<Budget/Budget — Master Book.md>) |
| Schedule | Items/reminders, calendar, recurrence, chores, Focus mode, Plan My Day, prerequisites and NFC behavior | 31 | [Backlog](<Schedule/4 - Checklist.md>) · [Master Book](<Schedule/Schedule — Master Book.md>) |
| Kitchen | Recipes, Inventory, Catalogue, Meal Planning and Shopping List | 20 | [Backlog](<Kitchen/4 - Checklist.md>) · [Master Book](<Kitchen/Kitchen — Master Book.md>) |
| Trips | Planner, packing/documents, trip lifecycle and trip-side integrations | 19 | [Backlog](<Trips/4 - Checklist.md>) · [Master Book](<Trips/Trips — Master Book.md>) |
| Hub & ERA | Hub/ERA/Brain, household sharing, shared sync/offline, message actions, guest access, theme/person identity, AI usage/errors | 41 | [Backlog](<Hub & ERA/4 - Checklist.md>) · [Master Book](<Hub & ERA/Hub & ERA — Master Book.md>) |
| Notifications & Alerts | Notification policy, drawer/Alerts, push and Google alarm transport evidence | 12 | [Backlog](<Notifications & Alerts/4 - Checklist.md>) · [Master Book](<Notifications & Alerts/Notifications & Alerts — Master Book.md>) |
| Healthcare | Health profiles, allergies, medications and care-reference consumers | 17 | [Backlog](<Healthcare/4 - Checklist.md>) · [Master Book](<Healthcare/Healthcare — Master Book.md>) |
| Outfits | Personal wardrobe, outfit builder/plans and wear history | 12 | [Backlog](<Outfits/4 - Checklist.md>) · [Master Book](<Outfits/Outfits — Master Book.md>) |
| PM Tooling | PM desktop/static/mobile reading, task identity and governance; Atlas tooling | 17 | [Backlog](<PM Tooling/4 - Checklist.md>) · [Master Book](<PM Tooling/PM Tooling — Master Book.md>) |
| Delivery | V1 operation and V2 execution boundary/value trial | 12 | [Backlog](<Delivery/4 - Checklist.md>) · [Master Book](<Delivery/Delivery — Master Book.md>) |
| Native App | Native shell, device bridge, store distribution and watch options | 8 | [Backlog](<Native App/4 - Checklist.md>) · [Master Book](<Native App/Native App — Master Book.md>) |

Campaigns group related modules; they do not change the source code’s Standalone/Junction import rules. The [Feature Map](<../01 - Architecture/Feature Map/_index.md>) routes intent to code; module Overview docs remain authoritative for product architecture. Cross-module work has one owning task with linked prerequisites, never matching checkboxes in two campaigns.

## Plans, research and evidence

| Information | Source of truth |
|---|---|
| Pending work, priority and completion | Campaign `4 - Checklist.md`; only Now / Next / Later |
| Outcome criteria, dependencies, current PM state and lasting decisions | Owning Master Book |
| Per-item execution plans (all open work) | [Coverage and findings](<Plans/Now and Next Execution Plans.md>); plans stay inside each item's Master Book section |
| Unresolved cross-module policy choices | [_Decisions.md](<_Decisions.md>); related work stays in its campaign |
| Accepted proactive/native programme | [ERA Top Layer](<Plans/ERA Top Layer.md>); packet IDs map to campaign tasks |
| Accepted executor design and S0–S3 trial | [Delivery V2](<Plans/Delivery V2.md>); V1 operational constraints remain distinct |
| Accepted Command Center product direction and phases | [Command Center](<Plans/Command Center.md>); phases map to PM Tooling and Delivery IDs |
| Catalogue’s accepted reference/definition design | [Final build plan §10](<../../docs/Catalogue — ASTRA Deep Dive.md#10-final-build-plan--2026-09-07>); [packet ownership](<Research/Options.md#catalogue-packet-ownership>) |
| Unadopted ideas, experiments and alternatives | [Research options](<Research/Options.md>), linked to archived originals |
| Completed work and verification receipts | Master Book Shipped Log; detailed old narratives in the archive |
| Historical plans, studies and cancelled work | [_Archive](<_Archive/_index.md>); never a second queue |
| Rules and reusable shapes | [_Conventions](<_Conventions.md>) and [_Templates](<_Templates/README.md>) |

Code authored, migration applied, endpoint accepted and device outcome observed are separate states. The current document date certifies none of them. Only owner-supplied current DB evidence establishes production application/RLS; agents do not write production data.

## Add or finish work

1. Capture rough input in **Inbox → New**. For a well-defined task, add it directly to the owning checklist and its Master Book criteria.
2. Search current IDs, research dispositions and shipped history first. Reuse an existing outcome; never recycle an ID, including an archived one.
3. Choose one owner, a concise result, severity/effort and lane. Record dependencies/holds in criteria. A research commission does not approve its implementation.
4. Finish only when the criteria and required evidence pass. Sweep the checked item into the Shipped Log with its ID/date/evidence; update decisions. Merges point to a surviving ID and are never called shipped.
5. Run `pnpm pm:lint` and `pnpm pm:check-docs`. After changing PM content, rebuild the local static twin with `pnpm pm:dashboard`; do not publish as part of routine triage.

## Refactor record

[2026-09-10 reconciliation receipt](<_Archive/2026-09-10 PM Refactor/README.md>) records file dispositions, every original checklist/DoD outcome, recovered requirements, merges, reused-ID repairs and retained research. It is an audit record, not a document to keep extending for routine work.

`.pm/` contains runtime files and `_dashboard.html` is generated. Neither is a place to edit backlog state. Archived date targets remain historical comparisons, not newly promised delivery dates.
