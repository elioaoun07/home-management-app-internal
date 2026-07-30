---
created: 2026-07-18
type: index
status: living
owner: Elio (authored by Claude Fable 5, handoff session)
generation: 3
trigger: model-generation-handoff
predecessor: ../FABLED 2/
tags:
  - pm/fabled3
  - module/hub-era
---

# Hub & ERA · FABLED 3 — Index

> Third-generation audit, created 2026-07-18 as part of a **model-generation handoff**. Verified against `f0a8e19`. The flagship's paradox persists in sharper form: notification delivery got a genuinely well-engineered visibility policy **with the cluster's first test**, while `HubPage.tsx` crossed 5,978 LOC and ERA — the app's namesake — still has never spoken first. The Top View design study (2026-07-17) now specifies exactly what proactive should look like; specification is not shipment.

| File | Read it when… |
|---|---|
| [3.1 Current Implementation](<1 - FABLED 3 — Current Implementation.md>) | delta since 07-02 — notification policy, receipts, private threads |
| [3.2 Gaps & Missing](<2 - FABLED 3 — Gaps & Missing.md>) | the ranked list |
| [3.3 Optimization Plan](<3 - FABLED 3 — Optimization Plan.md>) | ranked moves |
| [3.4 Future Enhancements](<4 - FABLED 3 — Future Enhancements.md>) | the proactive era, gated |
| [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>) | **you are a successor model about to touch Hub/ERA/voice — read this first** |

## Maturity scoreboard (2026-07-18)

| Dimension | Score | Δ vs 07-02 | Evidence |
|---|---|---|---|
| Reactive chat (Hub) | 7 | = | Private threads + per-user receipts shipped (`0f33396`) — polish, same tier |
| Intent architecture | 7 | = | Unchanged in window; still zero fixtures |
| Test protection | 2 | +1 | **First test in the cluster**: `chatNotificationPolicy.test.ts` (2 green, run 2026-07-18). Intent routing still untested |
| Proactive reach | 2 | = | Top View study (2026-07-17) specifies the pull mouth; nothing renders yet; briefing still unshipped |
| Voice resilience | 4 | = | No window changes; dead `sttCapture.ts` / `vadGate.ts` still on disk (verified 2026-07-18) |
| Code health | 3 | = | `HubPage.tsx` 5,978 LOC (+180 since v2 measured 5,798) — the debt still grows faster than it's paid |
| **Overall** | **4.2** | **+0.2** | One good policy shipped with a test; the body got heavier; the voice still waits |
| **Handoff readiness** | **3** | new | The untested intent router + 6k-line page make this the riskiest junction for lower-tier edits; message-actions cascade into money and items. Scoped UI work OK; routing/actions mid-tier+ |

## Delta ledger — inherited from FABLED 2 (verbatim)

### Delta — 2026-07-10

- Hub notification delivery now treats visibility as the choke point: private threads are excluded from both immediate push and cron fallback; every public purpose is eligible.
- Shopping child messages now participate in per-user receipts. `unread_reply_count` drives the item dot, opening the item thread marks replies read, and realtime restores the signal only for a newer partner reply.
- Evidence: `src/features/hub/chatNotificationPolicy.test.ts`, `npm test -- src/features/hub/chatNotificationPolicy.test.ts`, and `npm run typecheck`.

## Delta ledger (FABLED 3 era, append-only)

- **2026-07-18** (generation created): `0f33396` audited — `hub/messages` route rework (+243), `mark-read` receipts (+78), `chatNotificationPolicy.ts` (33 lines, tested). Test protection 1 → 2. ERA Top View study (2026-07-17) recorded as the standing spec for proactive; WP-04 priority rule inherited from the Awakening plan. Evidence cutoff `f0a8e19`.

## The next 3 moves

1. **Intent-routing fixtures** (carried from v1 AND v2 — third generation asking): `resolveIntent` in/out table tests. A misrouted money intent acts confidently; this is the cluster's cheapest catastrophic-risk reducer.
2. **HubPage decomposition, one extraction per session** — not a big-bang refactor; the policy file (33 lines + test) is the model: pull one concern out, test it, repeat.
3. **Ship briefing v0.5 per the Awakening WP queue / Top View study** — the pull mouth first (`get_era_topview_bundle()`), drafts-only actions. The spec exists; execute WP-04 before any new study.

**Siblings:** [Budget](<../../Budget/FABLED 3/_index.md>) · [Schedule](<../../Schedule/FABLED 3/_index.md>) · [Kitchen](<../../Kitchen/FABLED 3/_index.md>) · [Trips](<../../Trips/FABLED 3/_index.md>) · [Notifications](<../../Notifications & Alerts/FABLED 3/_index.md>) · [Healthcare](<../../Healthcare/FABLED 3/_index.md>) · [PM system](<../../FABLED 3/_index.md>)
