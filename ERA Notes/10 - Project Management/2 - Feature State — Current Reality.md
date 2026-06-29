---
created: 2026-05-29
type: status
status: living
owner: Elio
tags:
  - pm/status
  - scope/cross-cutting
---

# 2 · Feature State — Current Reality

> **Command Center:** [1 · Setup Audit](<1 - Codebase & AI Setup Audit.md>) · [2 · Feature State](<2 - Feature State — Current Reality.md>) · [3 · Future Vision](<3 - Future Vision & Roadmap.md>) · [4 · This Week](<4 - This Week (Action Plan).md>)
>
> **What this file is:** the *honest, no-hype* state of every module — what exists, how mature it is, and the single most useful next step. **No imagination here** (that's file 3).
>
> **Method & confidence:** this is a **structural** assessment — derived from presence of an ERA Notes doc, live routes/API surface, feature-dir contents, and git recency. It is **not** a line-by-line correctness audit of each module (that requires running each feature). Where I'm inferring, I say so. Treat maturity tiers as "how battle-tested," not "bug-free."

---

## Maturity tiers

| Tier | Meaning |
|---|---|
| 🟢 **Core** | Foundational, oldest, used daily, most battle-tested. Regressions here hurt most. |
| 🔵 **Established** | Fully built and shipping; less hammered than Core but stable. |
| 🟡 **New / Thin** | Recently shipped or lightly wired; expect rough edges & missing docs. |
| 🟠 **Stub / Partial** | Exists but key paths are placeholders or known-incomplete. |
| ⚫ **Orphan / Debt** | Empty, dead, or misfiled — cleanup candidates (see file 1 §3). |

---

## Standalone modules

| Module | Tier | Has vault doc | Reality / known gaps | Next step |
|---|---|---|---|---|
| **Accounts & Balance** | 🟢 Core | ✅ | Multi-account, dynamic balance, history, default account, reconcile. The financial core. **Untested** — see file 1 P0. | Add unit tests for `balance-utils`. |
| **Transactions** | 🟢 Core | ✅ | Full CRUD, drafts, private, split-bill, category grid, voice entry. `MobileExpenseForm` is 2,890 LOC (change-risk). | Split the mega-form when next touched. |
| **Categories** | 🟢 Core | ✅ | Hierarchical, icons/colors, DnD reorder, cross-user slug matching. Solid. | — (stable) |
| **Recurring Payments** | 🟢 Core | ✅ | Schedule, auto next-due, confirm→transaction, exceptions. `recurring/page.tsx` 2,772 LOC. **Auto-post math untested.** | Unit-test next-due + add monthly "confirm paid" digest (backlog). |
| **Items & Reminders** | 🟢 Core | ✅ | Schedule/calendar, RRULE recurrence, subtasks, alerts, household assignment. `useItems.ts` 2,621 LOC. Uses the `get_schedule_bundle` RPC pattern. Now also supports a draft state (`status='draft'`) for unconfirmed Hub Chat bulk-convert reminders *(added 2026-06-16)*. | — (stable; watch perf) |
| **Catalogue** | 🟢 Core | ✅ | Modular "UI database" (contacts/tasks/notes/recipes/documents), categories, multi-link product comparison, calendar link. Documents now capture Arabic equivalents with English/Arabizi suggestions, usual cost, prerequisites, copy-vs-original requirement, and issuing location metadata. ✅ 2026-06-29. | — (stable) |
| **Preferences** | 🟢 Core | ✅ | LBP rate (thousands rule), theme, month-start day, section order, onboarding. | — (stable) |
| **Recipes** | 🔵 Established | ✅ | Recipe book, ingredients, instructions, cooking mode, version compare, page-flip UI. | Connect to Inventory (gap 2b). |
| **Meal Planning** | 🔵 Established | ✅ | Weekly planner, drag-drop, recipe→day, web calendar, add-to-shopping. | Add budget-impact estimate (gap 2c). |
| **Inventory** | 🔵 Established | ✅ | Stock counts, restock, low-stock, barcode lookup, history, add-to-shopping. | Auto-create shopping items on low stock (gap 2a). |
| **Debts** | 🔵 Established | ✅ | Owed-to / owed-by, settlement, standalone debts. | Auto-reminder on collection date (gap 2e). |
| **Future Purchases** | 🔵 Established | ✅ | Wishlist, target amount/date, allocation, spending analysis. | Link actual purchase → auto-complete (gap 2f). |
| **Budget Allocation** | 🔵 Established | ✅ | Envelope allocations per category. | Auto-suggest minimums from recurring (gap 2d). |
| **Statement Import** | 🔵 Established | ✅ | CSV/PDF parse, merchant→category mapping. Recently split ("split estatement import", May 28). | Feed merchant map into manual entry (gap 1b). |
| **Transfers** | 🔵 Established | ✅ | Between-account transfers w/ balance direction. | — (stable) |
| **Analytics** | 🔵 Established | ✅ | Net worth, mini-charts, world spend map. Has a `debug` route (clean up). | Build Dashboard V2 widgets + 50/30/20 (backlog). |
| **Drafts** | 🔵 Established | ✅ | Drafts drawer/badge/dialog for pending (voice) transactions. Sibling concept added for schedule items — draft reminders (`items.status='draft'`) from Hub Chat bulk convert, reviewed via `DraftRemindersDrawer` *(added 2026-06-16)*. | — (stable) |
| **Statement / Receipts** | 🔵 Established | ➖ | `receipts/` route exists. Scope unclear from docs. | Confirm purpose; add Atlas/doc entry. |
| **Guest Portal** | 🔵 Established | ✅ | Public `/g/[tag]` — WiFi, dos/don'ts, allergies, complaints, chat. `guest-portal-client.tsx` 2,602 LOC; chat is localStorage-based. | Move guest chat to DB if you want host visibility. |
| **NFC Tags** | 🔵 Established | ✅ | Slug routes, admin, tap/checklist/history APIs, PWA redirect banner. | Expense/inventory shortcuts (gap 6). |
| **Error Logs** | 🔵 Established | ✅ | Persistent structured error viewer + API. Your sanctioned logging path. | Route `console.*` here during the sweep. |
| **Watch UI** | 🔵 Established | ✅ | Wear OS surface — voice entry, simple face, watch login, AI chatbot. Shipped ~May 10. | Glanceable tiles + quick-action presets (gap 9). |
| **Dashboard** | 🟡 New/Thin | ❌ | Main landing — KPI cards, recent tx. Lives in `components/web/WebDashboard.tsx` (2,426 LOC); `features/dashboard/` is **prefetch-only**. "Dashboard view" reworked May 16. No vault doc. | Write Overview doc; execute V2 (file 3). |
| **Chores** | 🟡 New/Thin | ❌ | Household chores list, postpone, group, "up next" hero, check-in panel. Active work May 18–28. No vault doc. | Write Overview doc; verify check-in flow. |
| **Focus** | 🟡 New/Thin | ❌ (Feature Map only) | Flexible routines / focus page + AI briefing (cached 24h). "flexible" shipped May 4. No vault Overview. | Write doc; enrich briefing (gap 1c). |
| **AI Usage** | 🟡 New/Thin | ❌ | Token-usage tracking page, upcoming sessions. No vault doc. | Write doc; confirm it captures Gemini + Azure spend. |
| **Recycle Bin** | 🟡 New/Thin | ❌ | Soft-deleted items + restore. No vault doc. | Write doc; confirm coverage across modules. |
| **Memories** | 🟠 Stub/Partial | ❌ | `features/memories/` = `hooks.ts` + `types.ts` only (household label/value store). Referenced once — likely feeding ERA. Nascent. | Decide: promote to a real feature or fold into ERA. |

---

## Junction modules

| Module | Tier | Has vault doc | Reality / known gaps | Next step |
|---|---|---|---|---|
| **Hub Chat** | 🟢 Core | ✅ | The top-layer primary interface. Threads w/ purposes, realtime, voice messages, message actions, shopping mode, full-screen in-thread, edge-swipe-back, bulk convert ("Multi-add") with draft-item review *(IMPLEMENTED 2026-06-16)*. Bulk-convert completeness rule tightened — a row only auto-confirms with Amount + Category + Subcategory, else draft *(IMPLEMENTED 2026-06-16)*. `HubPage.tsx` **5,506+ LOC** — the single largest file, growing. | Decompose `HubPage` before next big change. |
| **Household Sharing** | 🟢 Core | ✅ | Partner linking, shared data via `household_links`+`profiles`, private tx. Underpins every module. ✅ 2026-06-25: fixed client partner lookup that queried non-existent `profiles.display_name/email`; now uses schema-valid `profiles.full_name` and household link email fallback. | — (stable; high blast radius) |
| **Sync & Offline** | 🟢 Core | ✅ | IndexedDB queue + `OfflineSyncEngine`, connectivity probing, `safeFetch`. | Audit raw-`fetch` mutation paths (file 1 P2). |
| **Notifications** | 🔵 Established | ✅ | Web Push + in-app, cron sends, snooze/dismiss/actions, subscription health. | Smart timing + weekly digest (gap 7). |
| **Message Actions** | 🔵 Established | ✅ | Hub message → transaction / reminder / item. | Expense-split from chat (gap 8a). |
| **Shopping List** | 🔵 Established | ✅ | Hub ↔ Recipes ↔ Inventory; legacy localStorage queue (intentional). | Wire Inventory auto-add (gap 2a). |
| **AI Assistant (ERA)** | 🟡 New/Thin | ✅ | **Your flagship.** Intent router, faces, widgets, wake listener, budget submit, household context. Big surface (`features/era/`). Heavy recent work May 9–26. Voice still needs external wake-word setup (per memory). | Harden intent routing; expand proactive briefings (file 3). |
| **Voice Conversation** | 🟡 New/Thin | ➖ (in AI Assistant doc) | Azure STT/TTS/wake, conversation engine, intent classifier, greeting cache. Shipped May 2026. External-dependency heavy → fragile. | Add graceful-degradation tests; document setup. |
| **Trips** | 🟡 New/Thin | ✅ | Committed (`e058192`, 2026-05-30). Lifecycle trips, auto-account, activation/completion RPCs, places, packing list. Connects Budget ↔ Items/Chores ↔ Meal ↔ Catalogue. **Cascades unverified** (verify _deferred by choice_ — not this week). | Manual end-to-end verify of activate/complete cascades (deferred). |
| **Prerequisites** | 🟠 Stub/Partial | ✅ | Engine works for NFC→item unlock, **but 4 evaluators are stubs**: `weather`, `time_window`, `schedule`, `custom_formula` (per backlog). | Ship `time_window` first (highest value, lowest effort). |

---

## Cross-cutting systems

| System | State |
|---|---|
| **Theming** (blue/pink/frost/calm) | 🟢 Solid — CSS vars + `data-theme`, invalidates queries on change. |
| **Color Identity** (person-absolute) | 🟢 Documented rule + `Color Identity.md`. |
| **Atlas** (in-app feature map) | 🟢 Auto-generated; healthy. |
| **Layout & Nav** (header/bottom-nav/FAB, standalone routes) | 🔵 Works; Trips just registered in `ConditionalHeader` + `MobileNav`. |
| **AI / Gemini layer** | 🟡 Powerful but underused as a *reactive chat* — file 3 argues it should be the brain. |

---

## ⚫ Orphan / debt (clean these — detail in file 1 §3)

| Path | What it is | Action |
|---|---|---|
| `src/features/blink/` | Empty. The **old** AI chat, replaced by `era/`. | Delete |
| `src/features/today/` | Empty. | Delete |
| `src/app/temp/page.tsx` | Scratch route shipped to the app. | Delete |
| `src/features/navigation/` | One prefetch util misfiled as a "feature". | Move to `src/lib/prefetch/` |
| `src/features/dashboard/` | Prefetch-only; real UI is in `components/web`. | Move util; keep `dashboard` as a real module via its new doc |
| `analytics/debug` route | Debug endpoint in prod surface. | Remove or guard |

---

## The honest weak-link summary

_(Updated 2026-05-30)_

1. **The newest, most differentiated work is the least protected.** ERA (AI Assistant), Voice, Chores, Focus, Dashboard — your *signature* features — are all 🟡 New/Thin, several with **no vault doc**, and **none covered by tests**. That's where bugs are hiding right now.
2. **Prerequisites is half-built** — 4 stubbed evaluators advertised but inert.
3. **Documentation lags the last ~3 weeks of code.** 5 shipping modules still have no Overview doc (Dashboard, Chores, Focus, AI Usage, Recycle Bin). Code is ahead of its own map.
4. ~~**Trips is uncommitted**~~ ✅ Committed `e058192`. Cascade verify still needed (activate → complete RPC) — **deferred by choice this week**, not closed.

→ The plan to address the top items is in [4 · This Week](<4 - This Week (Action Plan).md>). The growth opportunities per module are in [3 · Future Vision](<3 - Future Vision & Roadmap.md>).
