---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - module/hub-era
---

# Hub & ERA · FABLED 2.4 — Future Enhancements

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · **4 · Enhancements** · v1 baseline: [FABLED/4](<../FABLED/4 - FABLED — Future Enhancements.md>)
>
> The face/intent architecture remains the extension seam. June changed the economics: the reviewed-proposal UX and the AnalysisReport contract are now *shipped precedents*, not designs — several v1 estimates drop accordingly.

---

## E1 — The proactive household briefing ⭐ (carried v1-E1 — still the moat, now cheaper)

**Impact: Highest in the app · Effort: M (was M–H) · Prereq: O1 tests + O3.2 context extraction**

The composer design is unchanged (per-module `getBriefingSignals()` → ranker → card + push + TTS). What June built for it: Budget's forecast substrate ([Budget FABLED 2.4 · E1](<../../Budget/FABLED 2/4 - FABLED 2 — Future Enhancements.md>)), the notification type fix + `daily_items_summary` precedent (typed, correctly-routed proactive pushes — [Notifications FABLED 2.1](<../../Notifications & Alerts/FABLED 2/1 - FABLED 2 — Current Implementation.md>)), and the draft/proposal review UX for actionable cards. Stage it: Schedule signals → Budget → Kitchen/Trips.
**Kill criterion:** none — this is the product's definition. If it slips a third consecutive month, the FAR's Phase-2 exit gate ("Speaks-First Ratio > 0") should be declared missed in the campaign file, in writing.

## E2 — Conversational expense-split (carried v1-E2)

**Impact: Med–High · Effort: M (down: the confirm-card pattern shipped)** — reuse `BulkConvertReviewSheet`'s proposal semantics + `useSplitBill` math. First multi-step money conversation; every later money intent inherits the pattern.

## E3 — Hands-free wake (carried v1-E3)

**Impact: High felt · Effort: S external + S code (exists).** The 1-hour Azure Custom Keyword training remains the entire blocker. **Kill criterion:** if not done by end of July, park it formally and stop carrying it — a permanently-pending magic trick costs credibility every week it's listed.

## E4 — Widget deep-links & richer in-chat widgets (carried v1-E4)

**Impact: Med · Effort: M · After O5** (never quote stale money).

## E5 — Smart notification timing + digest (carried v1-E5)

Now primarily owned by [Notifications FABLED 2.4](<../../Notifications & Alerts/FABLED 2/4 - FABLED 2 — Future Enhancements.md>) (delivery policy engine); this cluster contributes the composer (E1) that gives the digest content. Keep one owner.

## E6 — Unify the two assistants around one capability registry (new — replaces the drift risk in [G10](<2 - FABLED 2 — Gaps & Missing.md>))

**Impact: High coherence · Effort: M**

Target state: ERA's budget face *routes to* the AnalysisReport engine (`mode:"analysis"` intent → same precomputed context → same report renderer), so "ask about money" has one answer regardless of door. The floating `AIChatAssistant` becomes a scoped shell over shared capabilities rather than a parallel assistant. Concretely: extract the analysis call into a face-consumable resolver; register it in `budget.ts` intents; render `AnalysisReport` cards in Hub threads.
**Kill criterion:** if extraction shows the Budget chat's context needs are truly disjoint from ERA's, don't force it — instead write the "which assistant for what" paragraph in the vault doc and stop at shared rendering.

## E7 — Memory-grounded ERA (carried v1-E6; still gated on the memories decision)

`features/memories/` is still hooks+types. Decide promote-or-fold first (global Feature State flags it); then the brain face reads household facts before answering. **Kill criterion:** if no resolver has needed a memory in a month of briefings, fold the module.

## E8 — Multi-turn task flows (carried v1-E7)

After E2 proves the confirm pattern and O1 tests exist. The conversation engine's state machine is ready; the router isn't (untested).

## E9 — Voice personas / expressive TTS (carried v1-E8; last)

Pure polish after O4 resilience.

## E10 — The household daily log (new — Hub as the system of record)

**Impact: Med · Effort: S–M**

Hub threads already receive everything (messages, actions, system events, drafts). Add a per-day collapsible digest view over `hub_messages` + `hub_message_actions` + system events: "what happened in this house today" — money logged, items completed, meals cooked, who did what. Zero new writes; one grouped read + render. Pairs with E1 (the briefing links to "yesterday's log") and quietly becomes the family journal nobody had to keep.
**Kill criterion:** if the grouped query needs new denormalization to perform, defer until the signals store exists — don't build a second aggregation layer for it.

---

## Recommended order

```
E3 (do-or-park by end of July)
  → O1/O7 tests → E2 (confirm pattern on shipped UX) → E1 staged (the moat)
  → E6 (one money-answer story) → E5 content side · E4 after O5
  → E10 cheap anytime · E7 after memories decision · E8/E9 later
```
