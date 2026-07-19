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
  - module/notifications
---

# Notifications & Alerts · FABLED 3 — Index

> Third-generation audit, created 2026-07-18 as part of a **model-generation handoff**. Verified against `f0a8e19`. Special case: the FABLED 2 base here was **re-verified 2026-07-10** — only 8 days before this generation — and nothing in the cluster changed since (`git log 9d867f8..HEAD -- <notif paths>` → only the same-day Hub commit). This is therefore a near-affirmation generation: scores carry, and the file set exists chiefly to give the cluster its Successor Briefing and gen-3 ledger continuity.

| File | Read it when… |
|---|---|
| [3.1 Current Implementation](<1 - FABLED 3 — Current Implementation.md>) | affirmation + the one boundary note |
| [3.2 Gaps & Missing](<2 - FABLED 3 — Gaps & Missing.md>) | carried list, re-ranked |
| [3.3 Optimization Plan](<3 - FABLED 3 — Optimization Plan.md>) | carried moves |
| [3.4 Future Enhancements](<4 - FABLED 3 — Future Enhancements.md>) | carried ladder |
| [3.5 Successor Briefing](<5 - FABLED 3 — Successor Briefing.md>) | **you are a successor model about to touch notifications — read this first** |

## Maturity scoreboard (2026-07-18)

| Dimension | Score | Δ vs 07-10 | Evidence |
|---|---|---|---|
| Data model | 8 | = | Registry (`src/lib/notifications/registry.tsx`) + gcal tables — unchanged since re-verify |
| Delivery correctness | 8 | = | Actions-route column bug fixed; private-thread exclusion enforced on both push paths |
| UX calm | 4 | = | Bell wobble/red badge untouched (Phase 2 still open) |
| Intelligence | 4 | = | `group_key` grouping + critical-alert gate; no delivery-policy engine yet |
| Hygiene | 5 | = | Three cron routes still carry `console.*` (evidence snapshot 2026-07-18: `daily-items-reminder` 13, `item-reminders` 9, `daily-reminder` 8) |
| **Overall** | **5.8** | **=** | An 8-day-old verified base; nothing moved |
| **Handoff readiness** | **6** | new | The registry makes notification types mechanical to extend (any-model); cron/push delivery paths are mid-tier; the unscheduled-cron ambiguity is the one live danger |

## Delta ledger — inherited from FABLED 2 (verbatim)

### Delivery-correctness delta — 2026-07-10

- Immediate Hub push now enforces the same private-thread exclusion as the chat-notification cron, closing the owner-only visibility leak.
- The previous Budget/Reminder purpose allowlist was removed from both paths; all public purposes are eligible, including shopping-item replies.
- Shopping child-message receipts now provide durable unread/read state across the list dot, item chat, and thread unread total.

*(The full 07-02 → 07-10 movement record — registry, alerts-page unification, actions bug fix, critical-alert gate, gcal backup sync with its three same-day fix passes — lives in the frozen [FABLED 2 index §"What moved"](<../FABLED 2/_index.md>); it is the most evidence-dense audit entry in the vault and is inherited by reference.)*

## Delta ledger (FABLED 3 era, append-only)

- **2026-07-18** (generation created): no cluster changes since the 07-10 re-verify; affirmation generation. Standing open item re-confirmed: **reconcile cron scheduling** (F2's own "Remaining" note; `vercel.json` absent). Evidence cutoff `f0a8e19`.

## The next 3 moves (carried from FABLED 2, still exactly right)

1. **Schedule the gcal-reconcile cron and prove it runs** (`last_synced_at` advancing daily) — F2's remaining item, shared with [Schedule 3.3 · O3](<../../Schedule/FABLED 3/3 - FABLED 3 — Optimization Plan.md>).
2. **Calm the bell** — finite ring, severity-aware badge, `prefers-reduced-motion`.
3. **Delivery-policy skeleton** — quiet hours + daily push budget; volume grew (critical gate + gcal) while the budget still doesn't exist.

**Siblings:** [Budget](<../../Budget/FABLED 3/_index.md>) · [Schedule](<../../Schedule/FABLED 3/_index.md>) · [Kitchen](<../../Kitchen/FABLED 3/_index.md>) · [Trips](<../../Trips/FABLED 3/_index.md>) · [Hub & ERA](<../../Hub & ERA/FABLED 3/_index.md>) · [Healthcare](<../../Healthcare/FABLED 3/_index.md>) · [PM system](<../../FABLED 3/_index.md>)
