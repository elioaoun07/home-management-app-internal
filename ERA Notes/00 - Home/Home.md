---
created: 2026-03-23
updated: 2026-11-11
type: moc
tags:
  - type/moc
  - scope/home
---

# ERA Notes — Home

ERA is a household assistant: Hub Chat is the everyday interface, and the standalone pages (expense form, schedule, recipes, …) are the precision tools. This vault documents how it is built and tracks the work on it.

## Start from your question

| You want | Go to |
|---|---|
| What is being worked on, and what waits on me | [Project Management](<../10 - Project Management/_index.md>) |
| Which source files implement a feature | [Feature Map](<../01 - Architecture/Feature Map/_index.md>) |
| How a module is built, and why | The module's Overview, listed [below](#modules) |
| A rule that applies everywhere (state, offline, time zones, colors) | [Architecture](#architecture) |
| How to decide when no rule covers it | [Design Doctrine](<../01 - Architecture/Design Doctrine.md>) |
| Every page and route of the app | [App Routes and Icons](<../04 - UI & Design/App Routes and Icons.md>) · [Page & Feature Atlas](<../04 - UI & Design/Page & Feature Atlas/_Index.md>) |
| An idea that is not yet work | [Backlog & Ideas](#ideas) or the PM [Inbox](<../10 - Project Management/0 - Inbox.md>) |
| How to set something up | [Setup](#setup) |

## Map of the vault

| Folder | Holds | Rule |
|---|---|---|
| `00 - Home` | This page and the Dataview [Module Index](<Module Index.md>) | Navigation only |
| `01 - Architecture` | Cross-cutting rules, patterns and the Feature Map | One document per concern; update, never fork |
| `02 - Standalone Modules` | One folder per self-contained module | `Overview.md` first; extra guides beside it |
| `03 - Junction Modules` | One folder per module that bridges others | Same shape |
| `04 - UI & Design` | Routes, icons, design patterns, the Atlas | Atlas entries feed the in-app atlas |
| `05 - Performance` | Measured optimizations and the polish system | Record measurements, not intentions |
| `06 - Setup & Onboarding` | Setup guides and troubleshooting | [Vault Setup](<../06 - Setup & Onboarding/Vault Setup.md>) states where each kind of document belongs |
| `07 - Backlog & Ideas` | Vision and idea documents | Never a queue: work lives in Project Management |
| `08 - Sessions` | Wizard and session notes | Local only (gitignored) |
| `10 - Project Management` | The backlog: eleven campaigns, plans, research | See its index |
| `Templates` | Note templates | |
| `_Archive` | Superseded audits and notes | History; never current truth |

[Model Registry](<../Model-Registry.md>) maps tier aliases (`CLAUDE_MID`, …) to models for delivery plans.

## Modules

**Standalone**

| Area | Modules |
|---|---|
| Money | [Accounts & Balance](<../02 - Standalone Modules/Accounts & Balance/Overview.md>) · [Transactions](<../02 - Standalone Modules/Transactions/Overview.md>) · [Transfers](<../02 - Standalone Modules/Transfers/Overview.md>) · [Categories](<../02 - Standalone Modules/Categories/Overview.md>) · [Recurring Payments](<../02 - Standalone Modules/Recurring Payments/Overview.md>) · [Drafts](<../02 - Standalone Modules/Drafts/Overview.md>) · [Debts](<../02 - Standalone Modules/Debts/Overview.md>) · [Budget Allocation](<../02 - Standalone Modules/Budget Allocation/Overview.md>) · [Future Purchases](<../02 - Standalone Modules/Future Purchases/Overview.md>) · [Statement Import](<../02 - Standalone Modules/Statement Import/Overview.md>) · [Analytics](<../02 - Standalone Modules/Analytics/Overview.md>) · [Dashboard](<../02 - Standalone Modules/Dashboard/Overview.md>) |
| Schedule | [Items & Reminders](<../02 - Standalone Modules/Items & Reminders/Overview.md>) · [Chores](<../02 - Standalone Modules/Chores/Overview.md>) · [NFC Tags](<../02 - Standalone Modules/NFC Tags/Overview.md>) · [Focus](<../02 - Standalone Modules/Focus/Overview.md>) (retired page) |
| Kitchen | [Recipes](<../02 - Standalone Modules/Recipes/Overview.md>) · [Meal Planning](<../02 - Standalone Modules/Meal Planning/Overview.md>) · [Inventory](<../02 - Standalone Modules/Inventory/Overview.md>) · [Catalogue](<../02 - Standalone Modules/Catalogue/Overview.md>) |
| Personal | [Healthcare](<../02 - Standalone Modules/Healthcare/Overview.md>) · [Fitness](<../02 - Standalone Modules/Fitness/Overview.md>) · [Outfits](<../02 - Standalone Modules/Outfits/Overview.md>) |
| Platform | [Preferences](<../02 - Standalone Modules/Preferences/Overview.md>) · [Guest Portal](<../02 - Standalone Modules/Guest Portal/Overview.md>) · [Watch UI](<../02 - Standalone Modules/Watch UI/Overview.md>) · [Recycle Bin](<../02 - Standalone Modules/Recycle Bin/Overview.md>) · [Error Logs](<../02 - Standalone Modules/Error Logs/Overview.md>) · [AI Usage](<../02 - Standalone Modules/AI Usage/Overview.md>) |

**Junction**

| Area | Modules |
|---|---|
| Hub and assistant | [Hub Chat](<../03 - Junction Modules/Hub Chat/Overview.md>) · [ERA](<../03 - Junction Modules/ERA/Overview.md>) · [AI Assistant](<../03 - Junction Modules/AI Assistant/Overview.md>) · [Message Actions](<../03 - Junction Modules/Message Actions/Overview.md>) · [Shopping List](<../03 - Junction Modules/Shopping List/Overview.md>) |
| Shared layers | [Household Sharing](<../03 - Junction Modules/Household Sharing/Overview.md>) · [Sync & Offline](<../03 - Junction Modules/Sync & Offline/Overview.md>) · [Notifications](<../03 - Junction Modules/Notifications/Overview.md>) · [Activity Log](<../03 - Junction Modules/Activity Log/Overview.md>) |
| Schedule and travel | [Plan My Day](<../03 - Junction Modules/Plan My Day/Overview.md>) · [Prerequisites](<../03 - Junction Modules/Prerequisites/Overview.md>) · [Trips](<../03 - Junction Modules/Trips/Overview.md>) |

## Architecture

- [Design Doctrine](<../01 - Architecture/Design Doctrine.md>) — the Ten Questions, standing decisions, tradeoff order
- [Common Patterns](<../01 - Architecture/Common Patterns.md>) — data flow, optimistic mutations, modals
- [Sync and Offline](<../01 - Architecture/Sync and Offline.md>) · [Cache Invalidation](<../01 - Architecture/Cache Invalidation.md>) · [Timezone Handling](<../01 - Architecture/Timezone Handling.md>)
- [Database RLS Posture](<../01 - Architecture/Database RLS Posture.md>) — what the repo can and cannot know about the live database; agent access
- [Color Identity](<../01 - Architecture/Color Identity.md>) · [Standalone PWA Apps](<../01 - Architecture/Standalone PWA Apps.md>) · [Error Logging System](<../01 - Architecture/Error Logging System.md>)
- [Mutation Integrity Audit](<../01 - Architecture/Mutation Integrity Audit.md>) · [Live API Testing Protocol](<../01 - Architecture/Live API Testing Protocol.md>) · [Budget Reminder Merge](<../01 - Architecture/Budget Reminder Merge.md>)

## Setup

- [Vault Setup](<../06 - Setup & Onboarding/Vault Setup.md>) — structure, where documents go, Obsidian plugins
- [PM Relay Setup](<../06 - Setup & Onboarding/PM Relay Setup.md>) · [Authentication Troubleshooting](<../06 - Setup & Onboarding/Authentication Troubleshooting.md>)
- Agent setup (skills, hooks, mirrors): [Skills and Agents](<../../docs/Skills-and-Agents.md>); environment variables: [ENV](<../../docs/ENV.md>)

## Ideas

Vision and idea documents in `07 - Backlog & Ideas`. Nothing here is committed work until it becomes a checklist row.

- Vision: [Future Vision](<../07 - Backlog & Ideas/ERA - Future Vision.md>), volumes [2](<../07 - Backlog & Ideas/ERA - Future Vision Vol. 2.md>) · [3](<../07 - Backlog & Ideas/ERA - Future Vision Vol. 3.md>) · [4](<../07 - Backlog & Ideas/ERA - Future Vision Vol. 4.md>) · [5](<../07 - Backlog & Ideas/ERA - Future Vision Vol. 5.md>)
- Modules: [Module Map & New Module Ideas](<../07 - Backlog & Ideas/ERA - Module Map & New Module Ideas.md>) · [Feature Evolution Ladders](<../07 - Backlog & Ideas/Feature Evolution Ladders.md>)
- Features: [Feature Ideas](<../07 - Backlog & Ideas/Feature Ideas.md>) · [Innovative Feature Ideas](<../07 - Backlog & Ideas/Innovative Feature Ideas.md>) · [Feature Optimizations](<../07 - Backlog & Ideas/Feature Optimizations.md>) · [Proactive Life Optimization Ideas](<../07 - Backlog & Ideas/Proactive Life Optimization Ideas.md>) · [Dashboard V2 Instructions](<../07 - Backlog & Ideas/Dashboard V2 Instructions.md>) · [Ideas](<../07 - Backlog & Ideas/Ideas.md>)
