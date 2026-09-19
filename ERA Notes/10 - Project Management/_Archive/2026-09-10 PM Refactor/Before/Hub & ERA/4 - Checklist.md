---
created: 2026-06-20
updated: 2026-09-06
type: checklist
status: active
owner: Elio
tags:
  - pm/checklist
  - scope/module
  - module/hub-era
---

# Hub & ERA · 4 — Checklist

> **Campaign:** [Hub & ERA — Master Book](<Hub & ERA — Master Book.md>) · [4 · Checklist](<4 - Checklist.md>)
>
> **What this file is:** the single flat, checkable surface for Hub & ERA — every open actionable item under **Now / Next / Later**. Grammar: [_Conventions](<../_Conventions.md>) (validated by `pnpm pm:lint`). The narrative *why* is [Hub & ERA — Master Book](<Hub & ERA — Master Book.md>). Completed items are swept into the Master Book's Shipped Log and the line deleted — git history is the rest of the archive.
>
> **Legend:** Sev blocker / friction / annoyance / parked. Effort S / M / L.
> **ID migration (2026-07-15):** N1–N2→HUB-1–HUB-2, X1–X2→HUB-3–HUB-4, L1–L6→HUB-5–HUB-10.
> **2026-09-02:** working queue re-sequenced against the [ERA Top Layer — Master Plan](<../ERA Top Layer — Master Plan (2026-09-02).md>), which supersedes the Awakening plan and Top View study. New items carry their plan packet ID (`E-nn`) in the body; absorbed items point at the packet that now owns them instead of duplicating.

---

## Now

- [ ] **HUB-37** (ASTRA E-01a; absorbs former open R49 CI alias) CI runs typecheck/test/lint on push and PR; ERA preserves recoverable input on rejected capture and distinguishes offline, timeout and uncertain results. HEAD is already committed; no git write is part of this packet. → [Execution sheet](<../Top Layer/Top Layer — ASTRA Packets.md>) _(blocker - M)_
- [ ] **HUB-38** (ASTRA E-02a; E-02 retained parent) Owner-verified cron ledger and six wrappers provide authenticated cadence-aware liveness; record APPLIED migrations separately. E-02a follows ledger implementation. Cron logging reconciliation remains held under NOTIF-5.4; this packet waives neither applicable rule. → [Execution sheet](<../Top Layer/Top Layer — ASTRA Packets.md>) _(blocker - M)_
- [ ] **HUB-39** (ASTRA E-03a) Owner configures the existing scheduler-of-record plan with polling and IANA local-date eligibility; DST and duplicate ticks are verified. The briefing slot stays inactive until recipient policy and owner-recorded C01 eligible-hour/C03 partner-sequencing decisions are satisfied. → [Execution sheet](<../Top Layer/Top Layer — ASTRA Packets.md>) _(blocker - S)_
- [ ] **HUB-40** (ASTRA M-00a) Complete the assistant treaty and source-proven dead-code removal without changing existing ERA layout. Earlier plan supersession is already recorded; inventory correction is 16 total manifests, including 14 per-route. HubPage remains 6,275 LF lines until its sanctioned rider. → [Execution sheet](<../Top Layer/Top Layer — ASTRA Packets.md>) _(blocker - M)_

## Next

- [ ] **HUB-41** (ASTRA E-04a) Signals distinguish complete, partial and unavailable facts with provenance. Reuse canonical Schedule/Budget inputs; BUD-66 and the Schedule day-adapter/parity prerequisites must pass before their summaries are certified. Existing recurring-dues/overdraw scope remains. → [Execution sheet](<../Top Layer/Top Layer — ASTRA Packets.md>) _(friction - M)_
- [ ] **HUB-42** (ASTRA E-05a/b; C01/C03 decisions pending) Deterministic stored briefing delivers once per eligible local date and recipient, with verified identity/claim and recipient hour/toggle policy. Activate only at an owner-resolved eligible hour; D5 stays binding. Composition and focus-insights retirement remain parent obligations. → [Execution sheets](<../Top Layer/Top Layer — ASTRA Packets.md>) _(blocker - M)_
- [ ] **HUB-43** *(E-06)* Briefing feedback (👍/👎) + the "ERA vital signs" tile block (SFR₇, precision, cron liveness) in the Activity view. _(friction - M)_
- [ ] **HUB-44** (ASTRA E-07a; E-07 coordination parent) Dispatch the M provider/model/usage-attribution sheet first, then the retained quota gauge, degradation matrix and `AI_MODEL`/`AI_FALLBACK_MODEL` pin/kill-switch obligations. One bounded child per session; E-07a alone does not close the parent. Must ship before new Gemini consumers (HUB-45). → [Execution sheet](<../Top Layer/Top Layer — ASTRA Packets.md>) _(friction - M)_
- [ ] **HUB-45** (ASTRA E-08a) ERA reads balances and scoped meal coverage and supplies bounded Chef/Brain context. Reuse the existing Chef meal read; complete meal/person/status coverage and canonical money facts precede a trusted answer. → [Execution sheet](<../Top Layer/Top Layer — ASTRA Packets.md>) _(friction - M)_
- [ ] **HUB-46** (ASTRA E-09a–f; coordination parent) Durable queue acknowledgment, idempotent draft/nonrecurring-item endpoints and owner-bound reconciliation precede income/event extensions. Dispatch one bounded child sheet per session; reuse existing queue feature keys. Parent remains open until every retained criterion passes. → [Execution sheets](<../Top Layer/Top Layer — ASTRA Packets.md>) _(friction - M)_
- [ ] **HUB-47** (ASTRA E-11a/b) Failed/pending/uncertain actions cannot count as success or improve templates; Activity covers capability outcomes and opens real doors. Verify current conversation behavior with owner evidence; any needed migration belongs to E-05a, not a duplicate trigger guess. → [Execution sheets](<../Top Layer/Top Layer — ASTRA Packets.md>) _(friction - M)_

## Later

**ASTRA wave 1 (2026-09-06)** *(study: [ASTRA Book](<ASTRA/Hub & ERA — ASTRA Book.md>); top-layer ownership: [accepted sheets](<../Top Layer/Top Layer — ASTRA Packets.md>))*

- [ ] **HUB-57** (ASTRA-HUB-1) Future chat conversion links the actual returned draft ID and never automatically recreates a draft after link failure. → [Execution sheet](<ASTRA/Hub & ERA — ASTRA Packets.md>) _(friction - S)_
- [ ] **HUB-58** (ASTRA-HUB-2) Bulk conversion Undo checks every inverse result and refuses a false completion acknowledgment. → [Execution sheet](<ASTRA/Hub & ERA — ASTRA Packets.md>) _(friction - S)_

These two guards remain Later. Existing Top Layer parents retain their own phases; the 21 child sheets are refinements, not 21 new commitments. Unallocated frontier work and unresolved owner decisions remain in the study.

- [ ] **HUB-2** Voice graceful degradation + setup docs *(now packet **E-17**, Phase 2)* — one `speak()` seam with a `speechSynthesis` fallback promoted from `useEraReplyTTS`, distinct orb states for token-mint/SDK/worklet/mid-stream failures. Wake-word setup itself is out of scope per owner decision 2026-09-02 (D2) — voice degradation is about the TTS/STT pipeline, not wake. _(blocker - M)_
- [ ] **HUB-48** *(E-10)* Status line + in-hub briefing card (additive, doesn't move the orb/widgets/nav) + `analysis.report` capability so the floating `AIChatAssistant` can be retired once the report is reachable from ERA. _(friction - M)_
- [ ] **HUB-16** `/chat` voice reminders lose the time and don't save *(now packet **E-13**, the one sanctioned `HubPage.tsx` rider)* — gives HubPage's voice engine `runTurn`, deletes `intentClassifier.ts` and the five legacy callbacks. _(friction - M)_
- [ ] **HUB-49** *(E-14)* `get_era_topview_bundle()` RPC — collapses the four widget hooks' ~7 round trips into 1 *(absorbs **HUB-7**'s "fresh cache" half)*. _(friction - M)_
- [ ] **HUB-50** *(E-15)* Vitals strip on mobile, rendered even while asleep — "data is always awake; only the conversational layer sleeps." _(friction - M)_
- [ ] **HUB-51** *(E-16)* Partner: person-absolute colors (`personColor()`, currently unimplemented despite Hard Rule 14), her own briefing hour/toggle from day 6, her chosen flow (Q-PARTNER). _(friction - M)_
- [ ] **HUB-52** *(E-18)* ERA sessions picker + reopen + deterministic titles (no LLM). *(Inbox 2026-08-27; plan sacrifice #1 if a gate is missed.)* _(annoyance - M)_
- [ ] **HUB-53** *(E-19)* Delivery policy v1: quiet hours + 3-push/day budget + digest overflow, consulted inside `pushSender` so every producer inherits it *(absorbs **HUB-8**)*. _(friction - M)_
- [ ] **HUB-54** *(E-20)* Signal stack + card actions (draft-only, never a direct write) + doors from every tile. _(friction - M)_
- [ ] **HUB-55** *(E-21)* Anomaly → proposal: outlier transaction gets exactly one policy-gated card with a "why" line. _(friction - M)_
- [ ] **HUB-56** *(E-22)* Module signals from Kitchen/Trips/Healthcare *(absorbs **HUB-9**)*. _(friction - M)_
- [ ] **HUB-23** *(E-23)* Feedback-weighted ranker — 👎 history halves a signal type's rank. *(Plan sacrifice #4 if a gate is missed.)* _(annoyance - M)_
- [ ] **HUB-5** Decompose `HubPage.tsx` — no standalone extraction packet; per D10 it only shrinks as a rider on a real feature (E-13/HUB-16 is the sanctioned one this window). _(friction - L)_
- [ ] **HUB-6** Expense-split from chat (gap 8a) — untouched by this plan; still Later. _(annoyance - M)_
- [ ] **HUB-10** Merchant-match in "Add as Transaction" — untouched by this plan; still Later. Counterpart of [Budget · 4 · Checklist](<../Budget/4 - Checklist.md>) BUD-2. _(annoyance - M)_
- [ ] **HUB-21** (ASTRA C12) Verify the served build and original slice flows with actual revision/device evidence; HUB-37 CI alone cannot close this item. Any historical test-data cleanup remains owner-only and requires current inspection. → [Completion gates](<../Top Layer/Top Layer — ASTRA Completion.md>) _(friction - S)_
- [ ] **HUB-22** Slice 2 stretch capabilities not built: debt settlement via ERA, expense-split from chat (HUB-6), recurring-payment add/skip via ERA — untouched by this plan. _(annoyance - M)_

## Definition of Done

- [x] **D1** Intent routing has test coverage; a misrecognized intent clarifies instead of mis-acting; `pnpm test` green.
- [ ] **D2** Voice degrades gracefully with no Azure connection, and the setup is documented. *(→ HUB-2/E-17)*
- [ ] **D3** ERA's briefing reads at least one of Schedule/Budget proactively (visibly smarter than reactive-only). *(→ HUB-41/E-04, HUB-42/E-05)*
- [x] **D4** [Hub & ERA — Master Book](<Hub & ERA — Master Book.md>) updated to drop the "no tests" / "fragile" notes this work closes. *(intent-routing notes dropped 2026-08-22; voice "fragile" note stays open for HUB-2/E-17)*
- [ ] **D5** *(new 2026-09-02)* ERA has spoken first for 5 consecutive mornings (Speaks-First Ratio ≥ 5/7) — the plan's own G1 gate, Oct 12.
