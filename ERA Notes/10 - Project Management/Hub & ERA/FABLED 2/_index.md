---
created: 2026-07-02
type: index
status: living
owner: Elio
tags:
  - pm/fabled2
  - module/hub-era
---

# Hub & ERA · FABLED 2 — Index

> Second-generation deep-dive, superseding [FABLED v1](<../FABLED/_index.md>) (2026-06-10). Re-verified against the working tree **2026-07-02**. The flagship's paradox sharpened this month: the app's *best AI engineering* (the `AnalysisReport` contract) and its *worst structural debt* (`HubPage.tsx`, now 5,798 LOC) both live in this cluster — and the intent system that everything routes through still has zero tests.

| # | File | Read it when… |
|---|---|---|
| 1 | [Current Implementation](<1 - FABLED 2 — Current Implementation.md>) | You need the three-subsystem X-ray plus what June added (bulk convert, the Budget AI engine, a third conversation store). |
| 2 | [Gaps & Missing](<2 - FABLED 2 — Gaps & Missing.md>) | You want the re-ranked list — the untested router is still #1 and the reasons got stronger. |
| 3 | [Optimization Plan](<3 - FABLED 2 — Optimization Plan.md>) | You're touching Hub/ERA/Voice and want the test-first + decompose-with-a-feature path. |
| 4 | [Future Enhancements](<4 - FABLED 2 — Future Enhancements.md>) | You're planning the proactive era — the briefing composer remains the moat, and June shrank its cost. |

## Maturity scoreboard (2026-07-02)

| Dimension | Score | One-line justification |
|---|---|---|
| **Reactive chat (Hub)** | 7 | Threads, realtime, voice messages, shopping mode, bulk convert with draft review — daily-driver quality. |
| **Intent architecture** | 7 | The face/intent/resolver/formatter design is genuinely good — adding a capability = adding an intent. |
| **Test protection** | 1 | Zero tests across all three subsystems; `resolveIntent` has no fixtures; a misrouted money intent acts confidently. |
| **Proactive reach** | 2 | Briefings still read shallow slices; no composer, no signals registry, no delivery policy. |
| **Voice resilience** | 4 | Pipeline works; wake word still transcript-regex; dead code still shipped; degradation states unpinned; runbook unwritten. |
| **Code health** | 3 | `HubPage.tsx` 5,798 LOC (+292 in 3 weeks) — the decomposition debt now grows faster than features land. |
| **Overall** | **4.0** | A clean brain in an ever-heavier body, still speaking only when spoken to. |

## Delta since FABLED v1 — the headline

**Shipped:** Hub bulk convert ("Multi-add") with draft-item review + tightened auto-confirm rule (06-16) · the **Budget AI analysis engine** — `AnalysisReport` JSON contract, deterministic fallback, `ChatMarkdown` (fixing literal `**` on *every* assistant message), ephemeral dashboard, `ai_messages.analysis_report` persistence (06-27) · full-screen in-thread + edge-swipe-back.
**Stalled:** intent-routing fixtures (v1's #1) · HubPage decomposition (grew instead) · wake-word training (13 months of "one afternoon") · dead voice files still on disk (`sttCapture.ts`, `vadGate.ts` — verified today) · voice runbook · conversation-store consolidation — which June made *worse* by adding a third store.

## The next 3 moves

1. **Routing fixture table** — ~40 utterances → expected (face, intent); the single highest value-per-hour test file in the app ([file 3 · O1](<3 - FABLED 2 — Optimization Plan.md>)).
2. **Pick the canonical conversation store** — now three candidates; decide before a fourth appears ([file 2 · G8](<2 - FABLED 2 — Gaps & Missing.md>)).
3. **Extract the ERA action layer from HubPage** *as* the briefing card's substrate — the decomposition that pays for itself ([file 3 · O2](<3 - FABLED 2 — Optimization Plan.md>)).

**Sibling deep-dives:** [Budget](<../../Budget/FABLED 2/_index.md>) · [Schedule](<../../Schedule/FABLED 2/_index.md>) · [Kitchen](<../../Kitchen/FABLED 2/_index.md>) · [Trips](<../../Trips/FABLED 2/_index.md>) · [Notifications & Alerts](<../../Notifications & Alerts/FABLED 2/_index.md>) · [PM system](<../../FABLED 2/_index.md>)

## Delta — 2026-07-10

- Hub notification delivery now treats visibility as the choke point: private threads are excluded from both immediate push and cron fallback; every public purpose is eligible.
- Shopping child messages now participate in per-user receipts. `unread_reply_count` drives the item dot, opening the item thread marks replies read, and realtime restores the signal only for a newer partner reply.
- Evidence: `src/features/hub/chatNotificationPolicy.test.ts`, `npm test -- src/features/hub/chatNotificationPolicy.test.ts`, and `npm run typecheck`.
