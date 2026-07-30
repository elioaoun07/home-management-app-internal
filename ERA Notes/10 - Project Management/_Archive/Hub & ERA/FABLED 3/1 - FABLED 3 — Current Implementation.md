---
created: 2026-07-18
type: deep-dive
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
predecessor: ../FABLED 2/1 - FABLED 2 — Current Implementation.md
tags:
  - pm/fabled3
  - module/hub-era
---

# Hub & ERA · FABLED 3.1 — Current Implementation

[_index](<_index.md>) · [3.2 Gaps](<2 - FABLED 3 — Gaps & Missing.md>) · [3.3 Optimization](<3 - FABLED 3 — Optimization Plan.md>) · [3.4 Enhancements](<4 - FABLED 3 — Future Enhancements.md>) · [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>)

> **Inheritance (verified 2026-07-18):** [FABLED 2 file 1](<../FABLED 2/1 - FABLED 2 — Current Implementation.md>) remains normative for the three subsystems (Hub chat, intent architecture, voice pipeline) and the AnalysisReport engine. Re-verified via `git diff --stat c561635..HEAD -- <hub/era paths>` → 9 files, +886/−469, concentrated in one commit (`0f33396`). Delta only below.

## The delta: notification visibility policy + receipts (`0f33396`, 2026-07-10)

1. **`src/features/hub/chatNotificationPolicy.ts`** (33 lines, pure, **tested** — the cluster's first test file): visibility is the single choke point for delivery. Private threads are excluded from immediate push AND the cron fallback; every public purpose is eligible. The policy is a function, not a scatter of conditionals — copyable pattern.
2. **`hub/messages` route rework** (+243/−~150) and **`mark-read`** (+78): shopping child messages joined per-user receipts; `unread_reply_count` drives the item dot; opening an item thread marks replies read; realtime restores the dot only for a *newer* partner reply.
3. `useHubPersistence.ts` shrank (−27); `chat-notifications` cron simplified (−17) — the policy extraction actually removed code elsewhere, the first time this cluster's net complexity went down with a feature.
4. Vault docs updated in the same commit (Private Chats, Shopping List, Notifications) — doc-sync discipline held.

## Standing specs recorded in window (not code)

- **ERA Top View — Design Study (2026-07-17)**: Hub L-0 glance = the pull mouth of the Awakening briefing brain; one `get_era_topview_bundle()` RPC; drafts-only actions; WP-T1..T5 sequenced behind WP-03/04/11 with WP-04 always winning.
- Awakening Master Plan remains the execution contract; wake-word verdict (only openWakeWord viable) unchanged.

## Size reality (2026-07-18)

`HubPage.tsx` **5,978 LOC** — the app's largest file, +180 since v2. `ShoppingListView.tsx` 3,229. `src/features/era/` 28 files (largest feature dir), `voice-conversation` 15 files including the dead pair (`sttCapture.ts`, `vadGate.ts` — still present, verified today).
