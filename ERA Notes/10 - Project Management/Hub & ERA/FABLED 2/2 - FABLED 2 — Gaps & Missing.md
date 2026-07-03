---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - module/hub-era
---

# Hub & ERA · FABLED 2.2 — Gaps & Missing

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · **2 · Gaps** · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>) · v1 baseline: [FABLED/2](<../FABLED/2 - FABLED — Gaps & Missing.md>)
>
> Re-ranked 2026-07-02. Nine v1 gaps: one closed by June, one worsened, seven carried.

---

## Delta ledger

| v1 | Verdict 2026-07-02 |
|---|---|
| G1 flagship zero tests | **Open — stakes raised** (more money actions downstream of the router) |
| G2 HubPage bottleneck | **Worsened** — 5,506 → 5,798 LOC |
| G3 proactive reads shallow | **Open, unchanged** — no composer started |
| G4 wake word regex | **Open** — the 1-hour external step remains undone |
| G5 voice runbook | **Open** — memory file still beats the vault doc |
| G6 dead voice code | **Open** — `sttCapture.ts`/`vadGate.ts` verified on disk today |
| G7 expense-split from chat | **Open** |
| G8 dual conversation stores | **Worsened** — now three (`ai_messages` joined) |
| G9 widget freshness unaudited | **Open** |
| — | **Closed by June:** assistant markdown rendering (the literal-`**` bug) via `ChatMarkdown` |

## 🔴 G1 — The router is still untested, and more money flows through it (carried v1-G1)

Unchanged core: no fixtures pin "utterance → face, intent"; no confidence threshold forces a clarifying question before acting. What changed is the blast radius — bulk convert auto-confirms budget rows, `useEraBudgetSubmit` posts money, the analysis chat reads the whole financial context. Meanwhile the resolvers/formatters (pure, trivially testable) and the new `analysisReport.ts`/`buildFallbackReport` (pure) sit untested. The cheapest meaningful coverage in the app is *still* sitting on the table three weeks after v1 said exactly that.

## 🔴 G2 — `HubPage.tsx`: the bottleneck is compounding (carried v1-G2, worsened)

+292 LOC in 3 weeks, all June Hub features landed inside it, and the roadmap's biggest items (in-chat briefing card, expense-split, richer widgets) all target it. v1 predicted this file would tax every feature; June is the receipt. The decomposition must ride the next feature ([file 3 · O2](<3 - FABLED 2 — Optimization Plan.md>)) — one more "we'll split it after this ships" cycle puts it at 6,000+.

## 🟠 G3 — Proactive ERA still reads shallow (carried v1-G3)

No signals registry, no composer, no `get_briefing_bundle`. The surrounding modules did their homework in June (Budget forecast substrate, planner surface, notification type fix) — the receiving end is now the single blocker for the FAR's Phase 2 ("ERA speaks first ≥ once/day"). This gap is the product's identity gap.

## 🟠 G8 — Three conversation stores (carried v1-G8, worsened)

`api/ai-chat/conversations` · `api/era/conversations|messages` · `ai_messages` (+`analysis_report`). Nobody has written down which is canonical, what each persists, or the migration intent. Every new AI surface will guess — the fourth store is a matter of time. One afternoon: inventory the three, declare an owner, document in the AI Assistant vault doc ([file 3 · O6](<3 - FABLED 2 — Optimization Plan.md>)).

## 🟠 G4 — Wake word: the cheapest unstarted magic (carried v1-G4)

Still a transcript regex; still "one afternoon at speech.microsoft.com" away; still pending since May. Either book the afternoon or write "voice wake is parked until X" in the campaign file — the permanent limbo is worse than either choice.

## 🟡 G5 — Voice runbook unwritten (carried v1-G5)

Env rotation or a new device still breaks voice with no written recovery path. The memory file (`project_voice_conversation`) remains more accurate than `Voice Conversation.md`.

## 🟡 G6 — Dead voice code still shipped (carried v1-G6)

Two files, zero importers, verified again today. Same execution-slot disease as Schedule's `MobileItemForm` — bundle them into one hygiene sweep ([PM FABLED 2.3 · O2](<../../FABLED 2/3 - FABLED 2 — Optimization Plan.md>)).

## 🟡 G7 — Expense-split from chat (carried v1-G7)

Unchanged. Note the new prerequisite ordering: the bulk-convert review sheet established the confirm-card pattern — E2 should reuse *it*, not invent another.

## ⚪ G9 — Widget freshness unaudited (carried v1-G9)

Unchanged 30-minute audit: which query key, which TTL, what invalidates each `use*Summary`. Money/today widgets must ride the short caches.

## ⚪ G10 — Two assistants, one user-facing story missing (new)

ERA (intent faces, Hub-wide) and `AIChatAssistant` (Budget-scoped analysis chat) now coexist with different capabilities, different renderers, and different stores. Fine architecturally — but nothing documents *which one the user should ask what*, and the Budget assistant's `AnalysisReport` capability is invisible to ERA's budget face. Decide the convergence story before both grow another surface ([file 4 · E6](<4 - FABLED 2 — Future Enhancements.md>)).
