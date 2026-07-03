---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - module/hub-era
---

# Hub & ERA · FABLED 2.3 — Optimization Plan

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · **3 · Optimization** · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>) · v1 baseline: [FABLED/3](<../FABLED/3 - FABLED — Optimization Plan.md>)
>
> v1's plan was correct and 0% executed. It carries forward with two additions (O6 store consolidation, O7 AnalysisReport tests) and sharper sequencing — the rule stands: no decomposition without a feature or test riding on it.

---

## O1 — Test the intent system first (carried v1-O1 — still the highest value-per-hour in the app)

1. **Routing fixture table:** ~40 real utterances → expected `(face, intent)` through `resolveIntent.ts`. Every future intent extends the table. Kills "confidently wrong" at the root.
2. **Confidence fail-safe:** below threshold → ERA asks a clarifying question instead of acting. Test the threshold. (Non-negotiable before any new money intent — bulk convert raised the stakes.)
3. **Resolver shape tests** (mock the query layer) + **formatter snapshots** (pure, nearly free).

## O7 — Test the AnalysisReport engine (new; 1–2 hours, pure functions)

`analysisReport.ts`: schema validation tolerance (junk model output → fallback, never throw), `buildFallbackReport` correctness on fixture metrics, and the duplicate-category-label merge in `AnalysisDashboard` (the June React-key bug — pin it). This engine is about to be copied by other modules ([Budget FABLED 2.4 · E6](<../../Budget/FABLED 2/4 - FABLED 2 — Future Enhancements.md>)); test the original before the copies inherit its bugs.

## O2 — Decompose `HubPage.tsx` along its seams, briefing-first (carried v1-O2, urgency up)

Unchanged plan, unchanged rule (extraction only with a rider):
1. Per-view components (MessagesView, AlertsFeedView, ShoppingModeShell) — the alerts page already mounts view-restricted, proving the seam.
2. **`useEraActions` extraction** — the conversation-engine callbacks — *as the substrate for the in-chat briefing card* (file 4 · E1). This is the one to do first because the moat feature pays for it.
3. Thread-state plumbing last.
New datapoint for motivation: +292 LOC in 3 weeks; every roadmap item lands here until this happens.

## O3 — Split the two mega-routes when next touched (carried v1-O3)

`api/hub/messages` (side-effects → `src/lib/hub/`) · `api/ai-chat` (**context assembly → `src/lib/ai/context.ts` with unit tests** — this is also the proactive composer's input, so it pays twice).

## O4 — Voice resilience pass (carried v1-O4, all three still pending)

1. Degradation states pinned (token fail, SDK fail, worklet fail, mid-stream drop → defined orb + text fallback).
2. Delete `sttCapture.ts` + `vadGate.ts` (15 min — bundle with the app-wide hygiene sweep).
3. Write the runbook into `Voice Conversation.md`, reconciled with the May overhaul memory.

## O5 — Widget freshness audit (carried v1-O5; 30 min)

Query key / TTL / invalidator per `use*Summary` widget; money + today ride short caches; document in the AI Assistant vault doc.

## O6 — Consolidate the conversation stores (carried v1-O6, now three-way)

Inventory `api/ai-chat/conversations`, `api/era/conversations|messages`, `ai_messages` → declare one canonical owner per *purpose* (ERA conversational state vs Budget analysis history are allowed to be different stores — but say so in writing). Document in the vault doc; add a "which store?" decision line to the new-AI-surface checklist.

---

### Sequencing

```
O1.1 fixtures + O7 (one test week — the cluster's overdue debt)
  → O1.2 confidence fail-safe → O2.2 useEraActions (as the briefing substrate)
  → O3.2 context extraction (as the composer substrate) → O4.1 degradation states
O4.2 deletion + O4.3 runbook = one idle hour · O5/O6 = one afternoon each
```

Kill criterion for O2: if the briefing card gets descoped this quarter, do *not* decompose HubPage speculatively — extract only what a shipping feature touches. The rule that created this debt is still the rule that prevents worse.
