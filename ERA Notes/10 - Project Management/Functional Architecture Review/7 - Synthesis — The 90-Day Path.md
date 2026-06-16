---
created: 2026-06-12
type: roadmap
status: living
owner: Elio
tags:
  - pm/far
  - pm/roadmap
  - scope/cross-cutting
---

# FAR 7 · Synthesis — The 90-Day Path

> **FAR:** [_index](<_index.md>) · [1 · North Star](<1 - North Star — The Goal Revisited.md>) · [2 · Strengths](<2 - Where the App Stands Strong.md>) · [3 · Enhancements](<3 - Enhancement Map — Sharpen What Exists.md>) · [4 · Junctions](<4 - Junction Leverage — Compound Advantages.md>) · [5 · Missed](<5 - Missed & Forgotten — The Blind Spots.md>) · [6 · Market & Challenges](<6 - Market Lens & Challenge Letter.md>) · **7 · Synthesis**
>
> Everything above, in build order. Compatible with the global [3 · Future Vision](<../3 - Future Vision & Roadmap.md>) bets — this sharpens *sequence and shape*, it doesn't replace them. Weekly granularity belongs in [4 · This Week](<../4 - This Week (Action Plan).md>).

---

## The strategy in one sentence

**Stop adding rooms; install the nervous system** — wire the intelligence you already own (sense → reason) to a heartbeat, a mouth, a permission system, and a memory (compose → deliver → approve → learn), and gate it all on money-math you can trust.

---

## Phase 1 — Trust (weeks 1–3)

*Nothing proactive ships on an untested core. This phase is the C8 gate plus loose ends that erode trust.*

| Step | What | From |
|---|---|---|
| 1.1 | **P0 tests:** `balance-utils` directions, recurring next-due, reconcile; ERA intent fixtures ("utterance → face/intent") | C8, R9, FABLED G1, Budget Bet 1 |
| 1.2 | **Wake word afternoon** — train `hey-era.table`, flip flag — or formally demote voice | C5, E3 |
| 1.3 | **Gamification audit day** — finish streak/feed emission or delete the columns | C6, A5 |
| 1.4 | **Orphan sweep** — `blink/`, `today/`, `temp/`, debug route (file 2's ⚫ list) | hygiene |
| 1.5 | **Decisions in writing:** C1–C3, C9 verdicts on the [scoreboard](<6 - Market Lens & Challenge Letter.md>); A10 memories fate | C-series |

**Exit gate:** money tests green in CI · intent fixtures exist · scoreboard filled.

## Phase 2 — The Nervous System: L3 (weeks 4–8)

*One spine, built once, that every module lights up.*

| Step | What | From |
|---|---|---|
| 2.1 | **Insights/signals schema** — one `insights` + `proposals` store, with `audience` and provenance required | R2, R8, J6 |
| 2.2 | **Signals Registry v1** — `getBriefingSignals()` for Schedule + Budget first (week-shape, due auto-posts, pace vs envelopes — reusing forecast math A2) | E1, R4, Schedule/Budget Bets |
| 2.3 | **Context Assembler** — server-side `get_briefing_bundle()` RPC so the server thinks without the client | FAR 1 §4 |
| 2.4 | **Morning brief + Sunday digest** — cron-composed, pushed; in-Hub card as the rich view; TTS via A6 on first open | E1, 7b, A6, J3 |
| 2.5 | **Delivery Policy v1** — quiet hours, 3-push/day budget, priority classes; start *reading* `push_event_logs` + record act/dismiss | C7, J5, R5.2 |
| 2.6 | **HubPage decomposition, vehicle: the briefing card** — extract the seams the card needs; no big-bang refactor | C10, G2 |
| 2.7 | **Action Inbox v1, pilot: inventory low-stock → shopping proposal** | R3, J8, 2a |

**Exit gate:** ERA speaks first ≥ once/day, correctly, within the notification budget. **Speaks-First Ratio > 0.**

## Phase 3 — First Closed Loops: L4 seeds (weeks 9–13)

| Step | What | From |
|---|---|---|
| 3.1 | **Anomaly → intervention** — `anomalyDetection.ts` server-side on new transactions → signal → policy-gated push | A1, R4 |
| 3.2 | **Merchant memory everywhere** — manual entry learns + pre-fills | R5.1, 1b |
| 3.3 | **Prerequisites promotion** — ship `time_window`; then `custom_formula` as the alert-rules backend ("checking < $500 → tell me") | J1, 3a–c |
| 3.4 | **Kitchen + Trips signals join the brief** (low stock, re-entry briefing) | E1 stage 2 |
| 3.5 | **One conversational money flow** — expense-split (E2) *or* affordability dialogue (M5) — proving the confirm card as the generic proposal card | E2/M5, J4 |
| 3.6 | **Capture upgrade** — PWA share-target: bank-SMS / receipt / URL → parsed proposal | M2, R1 |
| 3.7 | **Briefing feedback** — 👍/👎 on every card into the insights store | R5.3 |

**Exit gate:** Proactive Hit Rate ≥ 5/week at ≥ 80% 👍 · Notification Regret < 20% · one full loop runs without you (low stock → proposal → accept → list → restock → inventory).

## Beyond 90 days (pre-sequenced, not now)

ICS bridge phase 2 (M1) → Price Book (M3) → People & Dates (M4) → Weekly Review ritual (M6, rides the digest) → Modes engine (J2, only after Trips cascades verified) → hybrid tool-calling (J10/C4, when intent count nears double) → goals/payoff (M7) → Year in Review (M9, December) → horizon items (M11–M14).

## Explicitly not doing (the anti-roadmap)

- **No new standalone modules until October** (C2) — Documents/Vehicle/Health stay parked in Track C.
- **No two-way calendar sync** — ICS publish/subscribe only (M1 scope fence).
- **No open-banking work** (C9) — the SMS/receipt stack replaces it.
- **No Capacitor shell** until the existing trigger (NFC daily habit) or an iOS-push blocker fires (per memory + Track D).
- **No new gamification** beyond finishing what exists (C6).
- **No multi-tenant/onboarding investment** while C3 = personal-first.

## The definition of done (a normal Tuesday, ~October 2026)

> **7:15** — phone buzzes once: *"Morning. 3 things: gym at 6 needs the bag tonight; the internet auto-post hits today — checking covers it; you're low on labneh and Thursday's plan needs it — added a proposal."* Spoken aloud at first app-open.
> **12:40** — Hub card, no push (budget spent): *"Spinneys was 2.3× your usual — split with Racha or recategorize?"* One tap, done.
> **18:05** — NFC tap on the door tag; "arriving home" fires; tonight's prep checklist unlocks.
> **21:00** — nothing. Quiet hours. The two remaining signals wait in Sunday's digest.
> **Sunday 10:00** — the digest opens the 10-minute review: scorecard, anomalies, next week's shape, meal plan, one accept-all on four proposals.
>
> Every touch: provenance on tap, undo within reach, 👍/👎 recorded. **That** is the app CLAUDE.md already claims to be — and after Phase 3, it's true.

---

*Adopting an item here = promote it into [3 · Future Vision](<../3 - Future Vision & Roadmap.md>) / [4 · This Week](<../4 - This Week (Action Plan).md>) and mark it here. Rejecting one = strike it here with a date and reason. This file is living, like the rest of the command center.*
