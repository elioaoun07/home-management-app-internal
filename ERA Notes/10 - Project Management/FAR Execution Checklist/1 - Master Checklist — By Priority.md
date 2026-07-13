---
created: 2026-06-12
type: checklist
status: living
owner: Elio
tags:
  - pm/far
  - pm/execution
  - scope/cross-cutting
---

# Execution · 1 — Master Checklist — By Priority

> **Folder:** [_index](<_index.md>) · **1 · Master Checklist** · [2 · Weekly Schedule](<2 - Weekly Schedule — Jun 15 to Sep 13.md>)
>
> Every item: `ID — what · effort · due week (delivery Sunday) · source · depends on`. Effort: **S** ≤ half day · **M** 1–2 days · **L** 3+ days. Priorities map to phases on purpose — the phases *are* the priority order. Tick here **and** in file 2.

---

## 🔴 P0 — Trust & Gates (Phase 1 · W1–W3 · Jun 15 – Jul 5)

*Cheap, unblocking, and mostly decisions. Everything below P0 is built on these.*

- [ ] **D1 — Fill the C1–C10 scoreboard** (accept/reject/modify, with dates) · S (1–2 h) · **W1 (Jun 21)** · [FAR 6](<../Functional Architecture Review/6 - Market Lens & Challenge Letter.md>) — *C3 (personal-first) is the verdict that simplifies every later debate; do it first.*
- [ ] **D2 — Decide `features/memories/` fate** (promote when E6 starts / delete now) · S (30 min) · **W1** · FAR A10
- [ ] **Q1 — Wake word: train `hey-era.table` + enable flag + test on phone** · S (one afternoon) · **W1** · C5 / E3 / G4 — *or formally demote voice on the scoreboard; either way it stops lingering.*
- [ ] **Q2 — Orphan sweep:** delete `features/blink/`, `features/today/`, `app/temp/`; guard or remove `analytics/debug`; move `features/navigation/` prefetch util to `src/lib/prefetch/` · S · **W1** · file 2 ⚫ list
- [ ] **T1 — ERA intent fixtures:** utterance → face/intent table tests for the hot intents + unit tests for the pure resolvers/formatters; pin the low-confidence fallback path · M (1–2 d) · **W2 (Jun 28)** · FABLED G1 — **the open half of the C8 gate**
- [ ] **Q3 — Gamification audit day:** trace `hub_user_stats` / `hub_feed` emission on the write paths → *finish or delete, no third option* · M (1 d) · **W2** · C6 / A5
- [ ] **T2 — Money API-route tests** (mocked Supabase): transaction create + recurring confirm → posts correctly, 23505→409, household scoping · M · **W3 (Jul 5)** · file 5 follow-up
- [ ] **T3 — Placement-rule guard:** confirm `expandOccurrences` tests cover "flexible items never land on activation day"; add the guard if not · S · **W3** · Schedule Bet 1

**⛩ PHASE 1 EXIT GATE (Jul 5):** D1–D2 decided in writing · T1 + T2 green in CI · Q1–Q3 closed. *Nothing in P1 starts before this line is fully ticked.*

---

## 🟠 P1 — The Nervous System (Phase 2 · W4–W8 · Jul 6 – Aug 9)

*One spine, built once. This is the quarter's point: by Aug 9, ERA speaks first.*

- [ ] **N1 — `insights` + `proposals` schema** (migration + `schema.sql`): source, scope, severity, payload, period, **audience**, **provenance**, feedback · M · **W4 (Jul 12)** · R2 / R3 / R8 / J6
- [ ] **N2 — Resolve the conversation split-brain** (`era_*` vs `ai_*`): document as layers or merge — decide and write it down · M (1 d) · **W4** · FABLED G8
- [ ] **N3 — `getBriefingSignals()` — Schedule:** week shape, overdue, per-person assignments · M · **W5 (Jul 19)** · E1 / R4 · *needs N1*
- [ ] **N4 — `getBriefingSignals()` — Budget:** pace vs envelopes, auto-posts due, low-balance check (reuse forecast-widget math, FAR A2) · M · **W5** · E1 / R4 · *needs N1*
- [ ] **N5 — `get_briefing_bundle()` RPC** — server-side context assembly (SECURITY DEFINER, Hard Rules 20–21) · M · **W6 (Jul 26)** · FAR 1 §4 · *needs N3–N4*
- [ ] **N6 — Briefing composer:** rank signals → compose text → cache the AI phrasing (Focus 24 h rule), compose fresh · M · **W6** · E1 · *needs N5*
- [ ] **N7 — Morning brief, pushed:** cron → composer → web push (policy-gated), per-person via `audience` · M–L · **W7 (Aug 2)** · E1 / J5 · *needs N6, N8*
- [ ] **N8 — Delivery Policy v1:** quiet hours + **3 pushes/person/day budget** + priority classes (interrupt / batch / feed-only) · M · **W7** · C7 / J5
- [ ] **N9 — HubPage decomposition, step 1:** extract thread-view / message-list / composer seams — *the briefing card is the vehicle* · M–L · **W8 (Aug 9)** · C10 / G2
- [ ] **N10 — Brief as Hub card:** the morning brief renders as a rich card in a hub thread (push = headline, card = detail) · M · **W8** · J3 · *needs N6, N9*
- [ ] **N11 — Sunday digest:** weekly horizon on the same composer; batched non-urgent signals land here · S–M · **W8** · 7b / E5 · *needs N6, N8*

**⛩ PHASE 2 EXIT GATE (Aug 9):** ERA initiates ≥ 1 correct briefing/day within the notification budget · **Speaks-First Ratio > 0** for the first time.

---

## 🟡 P2 — First Closed Loops (Phase 3 · W9–W13 · Aug 10 – Sep 13)

- [ ] **CL1 — Action Inbox v1 + pilot:** `proposals` UI (badge in Hub, accept/edit/reject/undo, provenance) with **inventory low-stock → shopping proposal** as first producer · M–L · **W9 (Aug 16)** · R3 / J8 / backlog 2a · *needs N1*
- [ ] **CL2 — Anomaly → intervention:** run `anomalyDetection.ts` server-side on new transactions → signal → policy-gated push · M · **W10 (Aug 23)** · A1 / R4 · *needs N8*
- [ ] **CL3 — Engagement loop opens:** start *reading* `push_event_logs`; record acted/dismissed per notification into the feedback field · M · **W10** · R5.2 / A9
- [ ] **CL4 — Merchant memory everywhere:** manual entry learns corrections + pre-fills category/account from `merchant_mappings` · M · **W11 (Aug 30)** · R5.1 / backlog 1b
- [ ] **CL5 — Kitchen signals join the brief:** low-stock staples, tonight's plan + missing ingredients · M · **W11** · E1 stage 2 · *needs N6*
- [ ] **CL6 — `time_window` prerequisite evaluator ships** (meds/morning windows — first stub down) · M · **W12 (Sep 6)** · J1 / backlog 3a
- [ ] **CL7 — Briefing feedback:** 👍/👎 on every brief/insight card → `insights.feedback` · S · **W12** · R5.3
- [ ] **CL8 — Share-target capture v1:** manifest `share_target` + receiver route → shared text (bank SMS) parses to a transaction **proposal** in the inbox · M–L · **W13 (Sep 13)** · M2 / C9 / R1 · *needs CL1*

**⛩ PHASE 3 EXIT / 90-DAY RETRO (Sep 13):** fill the KPI scorecard in [file 2](<2 - Weekly Schedule — Jun 15 to Sep 13.md>) · one loop runs end-to-end without you (low stock → proposal → accept → buy → restock) · re-plan next quarter from FAR's "beyond 90 days" list.

---

## 🟢 P3 — Stretch (only into a week that runs light; never displaces P0–P2)

- [ ] **S1 — Spoken brief:** wire `briefingToSpeech` to first app-open of the day · S · target W7+ · A6
- [ ] **S2 — `custom_formula` evaluator as alert rules** ("checking < $500 → tell me") · M–L · target W12+ · J1 / 3c
- [ ] **S3 — Conversational money flow:** expense-split (E2) *or* affordability dialogue (M5) on the generic confirm card · L · target W13+ · J4
- [ ] **S4 — Trips re-entry signal** in the brief · S–M · **blocked by** Trips cascade verification (Trips Bet 1) — unblock there first

## ⛔ Parked — do not start this quarter (unlock condition in parentheses)

ICS calendar bridge M1 (next quarter, after digest proves delivery) · Price Book M3 (after CL4 builds price observations) · People & Dates M4 · Weekly Review ritual M6 (rides N11) · Modes engine J2 (**after** Trips verify) · Hybrid tool-calling J10/C4 (when intent count nears 2×) · Goals/payoff M7 · Year in Review M9 (December task) · new standalone modules (**frozen until October — C2**) · open-banking anything (C9: replaced by CL8 stack) · Capacitor shell (existing trigger conditions per memory).
