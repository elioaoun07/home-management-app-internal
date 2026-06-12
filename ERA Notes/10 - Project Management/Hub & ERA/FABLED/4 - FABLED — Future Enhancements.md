---
created: 2026-06-10
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled
  - module/hub-era
---

# Hub & ERA · FABLED 4 — Future Enhancements

> **FABLED:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED — Current Implementation.md>) · [2 · Gaps](<2 - FABLED — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED — Optimization Plan.md>) · **4 · Enhancements**
>
> The 10× ideas with the *implementation seam* each would use. The face/intent architecture ([file 1 §3](<1 - FABLED — Current Implementation.md>)) is the extension point for nearly all of them: most enhancements are "add an intent + resolver + formatter," not "build a system."

---

## E1 — The proactive household briefing ⭐ (the product's moat)

**Impact: Highest in the app · Effort: M–H · Prereq: O1 routing tests, O3.2 context extraction**

ERA reads the **whole graph** and speaks first, on schedule and on trigger:

- **Morning briefing:** today's items by person (Schedule), auto-posts due (Budget), dinner plan + missing ingredients (Kitchen), active-trip status (Trips).
- **Trigger alerts:** forecasted overdraft (Budget E1), low-stock staples with no shopping trip planned, overdue routine streaks.
- **Seam:** each module exposes a `getBriefingSignals()`-style pure function (the per-face resolvers already prove the pattern); a briefing composer ranks/voices them; delivery via the existing Notifications junction + in-chat card. The 24 h Focus-briefing cache rule applies — briefings are *composed* fresh but expensive AI phrasing is cached.
- **Why it's the moat:** every other module folder's roadmap has this as its receiving end. Build the composer once, and every module's signals light up ERA.

## E2 — Conversational expense-split (gap 8a)

**Impact: Med–High · Effort: M**

"Split dinner with Racha, I paid 80" → budget face intent → reuse `useSplitBill` math + Message Actions transaction path → confirmation card in-thread. First real *multi-step* conversational action — design the confirm-before-commit pattern here and every later money intent inherits it.

## E3 — Hands-free wake ("Hey ERA")

**Impact: High (felt) · Effort: S (external) + S (code exists)**

The code path is built (`azureWake.ts`); what's missing is the 1-hour external step: train Custom Keyword at speech.microsoft.com → `public/voice/hey-era.table` → enable flag. Highest felt-magic-per-effort in the cluster. Do it during any quiet afternoon.

## E4 — Widget deep-links & richer in-chat widgets

**Impact: Med · Effort: M**

Balance, today-strip, low-stock, trip-countdown widgets rendered in-thread (the four `use*Summary` hooks are the start), each tapping through to its module page. Depends on O5 freshness audit so widgets never quote stale money.

## E5 — Smart notification timing + weekly digest

**Impact: Med–High · Effort: M**

Quiet hours + batching + a Sunday digest composed by the E1 briefing composer (same signals, weekly horizon). Kills daily notification noise — the most common reason households turn notifications off. *(Global Track B 7a/7b.)*

## E6 — Memory-grounded ERA (brain face grows up)

**Impact: High (long-term) · Effort: M–H**

The brain face + `features/memories/` (currently a stub: hooks + types) become ERA's long-term household memory: preferences ("Racha hates cilantro"), recurring facts ("gas bill is always ~$40"), referenced in resolvers before answering. Decide the `memories` module's fate first (global Feature State flags it as promote-or-fold).

## E7 — Multi-turn task flows

**Impact: Med · Effort: H**

Today's intents are mostly one-shot. The conversation engine's state machine could host short flows: "Plan Thursday dinner" → suggests from Recipes → adds missing to shopping → schedules prep reminder. Build *after* E2 proves the confirm pattern and O1 tests exist — this is where an untested router would hurt most.

## E8 — Voice personas / TTS expressiveness

**Impact: Low–Med · Effort: S–M**

Azure styles (cheerful/empathetic SSML) keyed to face + message type; greeting variants already prove the caching pattern. Pure polish — only after the resilience pass (O4).

---

## Recommended order

```
E3 (1-hour magic, do anytime)
  → O1 tests → E2 (confirm pattern) → E1 (the moat, staged: Schedule signals → Budget → Kitchen/Trips)
  → E5 (rides E1's composer) → E4 (rides O5)
  → E6 after the memories-module decision · E7/E8 later
```
