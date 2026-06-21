---
created: 2026-05-30
type: status
status: living
owner: Elio
tags:
  - pm/status
  - scope/module
  - module/hub-era
---

# Hub & ERA · 1 — Feature State

> **Command Center:** [_index](<_index.md>) · [1 · Feature State](<1 - Feature State.md>) · [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>) · [3 · Action Plan](<3 - Action Plan.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the *honest, no-hype* state of every Hub & ERA sub-feature — what exists, how mature it is, and the single most useful next step. **No imagination here** (that's file 2).
>
> **Method & confidence:** a **structural** assessment derived from the modules' vault docs ([Hub Chat](<../../03 - Junction Modules/Hub Chat/Overview.md>), [AI Assistant](<../../03 - Junction Modules/AI Assistant/Overview.md>)), live route/API surface, and `src/features/hub/` + `src/features/era/`. It is **not** a line-by-line correctness audit. Treat tiers as "how battle-tested," not "bug-free."
>
> **Module identity:** "Hub & ERA" groups the conversational flagship — **Hub Chat** (the top-layer primary interface, per CLAUDE.md), **Message Actions**, the **ERA AI Assistant**, and **Voice Conversation**. At the app level (global [2 · Feature State](<../2 - Feature State — Current Reality.md>)) it spans **🟢 Core (Hub Chat)** down to **🟡 New/Thin (ERA, Voice)** — the most differentiated work in the app, and the **least protected**.

---

## Maturity tiers

| Tier | Meaning |
|---|---|
| 🟢 **Core** | Foundational, oldest, used daily, most battle-tested. Regressions here hurt most. |
| 🔵 **Established** | Fully built and shipping; less hammered than Core but stable. |
| 🟡 **New / Thin** | Recently shipped or lightly wired; expect rough edges. |
| 🟠 **Stub / Partial** | Exists but key paths are placeholders or known-incomplete. |
| ⚫ **Orphan / Debt** | Empty, dead, or misfiled. |

---

## Sub-features

| Sub-feature | Tier | Reality / known gaps | Next step |
|---|---|---|---|
| **Hub Chat** | 🟢 Core | The top-layer primary interface. Threads w/ purposes, realtime, voice messages, message actions, shopping mode. Full-screen in-thread (global header hidden), edge-swipe-back to thread list, and bulk convert ("Multi-add" → `BulkConvertReviewSheet`) with unconfirmed rows saved as **draft items** (`items.status='draft'`, reviewed via `DraftRemindersDrawer`) ✅ *(IMPLEMENTED 2026-06-16)*. Bulk-convert "complete transaction" rule tightened: a budget row only auto-confirms with Amount + Category + Subcategory (description = the chat message itself) — any missing field now forces draft, even if amount alone matched ✅ *(IMPLEMENTED 2026-06-16)*. `HubPage.tsx` is **5,506+ LOC** — the single largest file in the app, now larger. | Decompose `HubPage` before the next big change. |
| **Message Actions** | 🔵 Established | Hub message → transaction / reminder / item. The bridge that makes chat *do* things. | Expense-split from chat (gap 8a). |
| **AI Assistant (ERA)** | 🟡 New/Thin | **The flagship.** Intent router, faces, widgets, wake listener, budget submit, household context. Big surface (`features/era/`). Heavy recent work May 9–26. **No tests.** | Harden intent routing; expand proactive briefings (file 2). |
| **Voice Conversation** | 🟡 New/Thin | Azure STT/TTS/wake, conversation engine, intent classifier, greeting cache. Shipped May 2026. **External-dependency heavy → fragile**; wake-word still needs external setup (per memory). | Add graceful-degradation tests; document setup. |
| **Faces / widgets** | 🟡 New/Thin | ERA's visual responses (faces) and inline widgets surface module data in chat. | Verify widget data freshness vs cache. |
| **Proactive briefings** | 🟡 New/Thin | ERA surfaces briefings/alerts unprompted; reads Schedule + Budget context. Reactive parsing is solid; proactive reach is shallow. | Enrich with cross-module data (file 2; global Track B). |

---

## Related code (single source of truth)

Do **not** duplicate file-path tables here — they drift. The authoritative code maps live in:

- [Hub Chat / Overview](<../../03 - Junction Modules/Hub Chat/Overview.md>) (+ `Voice Conversation.md`, `Voice Messages.md`, `Private Chats.md`, `Chat to Transaction Quickstart.md`)
- [AI Assistant / Overview](<../../03 - Junction Modules/AI Assistant/Overview.md>) (+ `Gemini API Guidelines.md`) — intent router, faces, widgets, wake listener, household context.
- [Message Actions / Overview](<../../03 - Junction Modules/Message Actions/Overview.md>) — chat → transaction/reminder/item.
- AI generation calls must pass a long `timeoutMs` to `safeFetch` (CLAUDE.md Hard Rule 6) — the 3 s default would kill them and falsely flag offline.

---

## The honest weak-link summary

_(Updated 2026-05-30)_

1. **The most differentiated work is the least protected.** ERA and Voice are your *signature* features and your competitive moat — and they're 🟡 New/Thin with **no tests** and external-dependency fragility (Azure). The bugs that most damage the product's identity are hiding here.
2. **`HubPage.tsx` is 5,506 LOC — the largest file in the app.** Every Hub change is high-risk-of-regression; it should be decomposed before the next big feature, not after.
3. **Voice is external-dependency fragile.** Azure STT/TTS/wake + wake-word external setup means failures are often environmental, not code — graceful degradation and setup docs matter more than features here.
4. **ERA is strong reactively, shallow proactively.** It parses user messages well but its proactive briefings barely read the household graph — the biggest *felt* upgrade is making it read Schedule + Budget deeply (file 2).

→ The growth opportunities are in [2 · Vision & Roadmap](<2 - Vision & Roadmap.md>); the concrete next steps are in [3 · Action Plan](<3 - Action Plan.md>); the checkable list is [4 · Checklist](<4 - Checklist.md>).
