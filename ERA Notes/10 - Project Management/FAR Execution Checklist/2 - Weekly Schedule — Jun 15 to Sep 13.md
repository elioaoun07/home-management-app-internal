---
created: 2026-06-12
type: schedule
status: living
owner: Elio
tags:
  - pm/far
  - pm/execution
  - scope/cross-cutting
---

# Execution · 2 — Weekly Schedule — Jun 15 to Sep 13

> **Folder:** [_index](<_index.md>) · [1 · Master Checklist](<1 - Master Checklist — By Priority.md>) · **2 · Weekly Schedule**
>
> Thirteen weeks, Monday-to-Sunday; **delivery date = the Sunday**. Each Monday, copy the week's block into [4 · This Week](<../4 - This Week (Action Plan).md>). Capacity assumption: **~2 focused project days/week** — if reality is half that, re-date per the [slippage rules](<_index.md>). The ⭐ line is the *"if you only do one thing this week"* item.

---

## Phase 1 · TRUST

### W1 · Jun 15 – 21 — "Decide, then quick wins"
- [ ] **D1** Fill the C1–C10 scoreboard (start with C3: personal-first?)
- [ ] **D2** `features/memories/` — promote-later or delete
- [ ] **Q1** Wake-word afternoon: train → `public/voice/hey-era.table` → flag on → test on phone
- [ ] **Q2** Orphan sweep (`blink/`, `today/`, `temp/`, `analytics/debug`, navigation util)
- ⭐ **D1** — every later week gets easier once the verdicts exist.
- *Notes / slippage:*

### W2 · Jun 22 – 28 — "Pin the flagship's behavior"
- [ ] **T1** ERA intent fixtures: utterance→face/intent table + pure resolver/formatter tests + low-confidence fallback pinned
- [ ] **Q3** Gamification audit day: finish emission or delete the columns
- ⭐ **T1** — the open half of the C8 gate; everything proactive stands on it.
- *Notes / slippage:*

### W3 · Jun 29 – Jul 5 — "Close the gate"
- [ ] **T2** Money API-route tests (transaction create, recurring confirm; mocked Supabase; 23505→409)
- [ ] **T3** Placement-rule guard verified/added
- [ ] ⛩ **Phase 1 exit review** (30 min): all P0 boxes ticked? If not — re-date Phase 2 *now*, don't start it late.
- ⭐ **T2**
- *Notes / slippage:*

## Phase 2 · NERVOUS SYSTEM

### W4 · Jul 6 – 12 — "The spine's schema"
- [ ] **N1** Migration: `insights` + `proposals` (audience + provenance + feedback required fields)
- [ ] **N2** Conversation split-brain: merge or document (`era_*` vs `ai_*`)
- ⭐ **N1** — every Phase 2/3 item writes to or reads from it.
- *Notes / slippage:*

### W5 · Jul 13 – 19 — "The first two senses"
- [ ] **N3** `getBriefingSignals()` — Schedule (week shape, overdue, per person)
- [ ] **N4** `getBriefingSignals()` — Budget (pace vs envelopes, auto-posts due; reuse forecast math)
- ⭐ **N4** — money signals are the moat's heart.
- *Notes / slippage:*

### W6 · Jul 20 – 26 — "The server thinks alone"
- [ ] **N5** `get_briefing_bundle()` RPC — server-side assembly, no client in the loop
- [ ] **N6** Briefing composer (rank → compose → cache phrasing 24 h)
- ⭐ **N5** — the moment the L2 ceiling breaks ([FAR 1](<../Functional Architecture Review/1 - North Star — The Goal Revisited.md>)).
- *Notes / slippage:*

### W7 · Jul 27 – Aug 2 — "ERA speaks first" 🎯
- [ ] **N8** Delivery Policy v1: quiet hours, 3/day budget, priority classes
- [ ] **N7** Morning brief cron → push (policy-gated, per-person)
- [ ] *(stretch)* **S1** spoken brief on first open
- ⭐ **N7** — the first unprompted, correct, in-budget push. Screenshot it; that's the milestone.
- *Notes / slippage:*

### W8 · Aug 3 – 9 — "Give it a home in the Hub"
- [ ] **N9** HubPage decomposition step 1 (seams the card needs)
- [ ] **N10** Brief as rich Hub card (push = headline, card = detail)
- [ ] **N11** Sunday digest (same composer, weekly horizon, batched signals)
- [ ] ⛩ **Phase 2 exit review:** ≥1 correct brief/day · within budget · Speaks-First Ratio > 0
- ⭐ **N10**
- *Notes / slippage:*

## Phase 3 · CLOSED LOOPS

### W9 · Aug 10 – 16 — "Propose, don't act"
- [ ] **CL1** Action Inbox v1 + low-stock→shopping pilot (accept/edit/reject/undo + provenance)
- ⭐ **CL1** — the trust keystone; every later automation inherits it.
- *Notes / slippage:*

### W10 · Aug 17 – 23 — "Intervene + start listening"
- [ ] **CL2** Anomaly → policy-gated push (server-side z-score on new transactions)
- [ ] **CL3** Read `push_event_logs`; record acted/dismissed
- ⭐ **CL2** — the first L4 behavior.
- *Notes / slippage:*

### W11 · Aug 24 – 30 — "Learn + smell the kitchen"
- [ ] **CL4** Merchant memory in manual entry (learn corrections, pre-fill)
- [ ] **CL5** Kitchen signals join the brief (low stock, tonight's plan, missing ingredients)
- ⭐ **CL4** — the first time ERA visibly *gets better* from use.
- *Notes / slippage:*

### W12 · Aug 31 – Sep 6 — "Conditional automation + feedback"
- [ ] **CL6** `time_window` evaluator ships (first Prerequisites stub down)
- [ ] **CL7** 👍/👎 on every brief/insight card
- [ ] *(stretch)* **S2** `custom_formula` as alert rules
- ⭐ **CL6**
- *Notes / slippage:*

### W13 · Sep 7 – 13 — "Capture + retro"
- [ ] **CL8** Share-target v1: shared bank-SMS/text → parsed → proposal in inbox
- [ ] ⛩ **90-day retro:** fill the KPI scorecard below · verify one loop runs end-to-end without you · plan next quarter from FAR "beyond 90 days" + S-items
- ⭐ **CL8** — capture cost is the survival metric.
- *Notes / slippage:*

---

## KPI scorecard (fill at W8 and W13)

| KPI ([defined in FAR 1 §5](<../Functional Architecture Review/1 - North Star — The Goal Revisited.md>)) | Target | W8 (Aug 9) | W13 (Sep 13) |
|---|---|---|---|
| Speaks-First Ratio | > 0, then daily | | |
| Proactive Hit Rate (acted/👍 per week) | ≥ 5/wk at ≥ 80% | | |
| Notification Regret (dismissed w/o action) | < 20% | | |
| Time-to-Capture (median, routine spend) | < 5 s | | |

## Slippage ledger

| Date | What slipped | Weeks re-dated? | Why |
|---|---|---|---|
| | | | |
