---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - module/hub-era
---

# Hub & ERA · FABLED 2.1 — Current Implementation

> **FABLED 2:** [_index](<_index.md>) · **1 · Implementation** · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>) · v1 baseline: [FABLED/1](<../FABLED/1 - FABLED — Current Implementation.md>)
>
> Verified 2026-07-02. v1's three-subsystem map (Hub Chat data plane, the face/intent architecture, the Azure voice pipeline) still holds and is not repeated — read it there. This file records the June additions and the numbers that moved.

---

## 1 · The mount + size reality (numbers re-counted today)

- `src/components/hub/HubPage.tsx` — **5,798 LOC** (v1: 5,506; +292 in 3 weeks). Still owns thread state, message rendering, ERA invocation, voice callbacks, shopping-mode switching, and the alerts render path (~5,554–5,737 per the Notifications campaign). Every June Hub feature landed *inside* it — the decomposition debt is compounding, not static.
- `ShoppingListView.tsx` 3,181 · `NotesListView.tsx` ~56 KB · `api/hub/messages/route.ts` ~42 KB · `api/ai-chat/route.ts` ~30 KB — all unchanged from v1.
- The ERA intent system is structurally unchanged: 4 faces (`brain` · `budget` · `chef` · `schedule`), `intents/` registry + `resolveIntent.ts` + per-face `resolvers/` + `formatters/`, widgets via `use*Summary`. Verified: `ls src/features/era/intents/` matches v1's diagram exactly. **Adding a capability is still "add an intent to one face."**

## 2 · What June added — three things worth knowing cold

1. **Bulk convert with draft review (06-16).** "Multi-add" turns N chat messages into transactions/reminders via `BulkConvertReviewSheet`; a budget row auto-confirms **only** with Amount + Category + Subcategory, else it becomes a draft (`items.status='draft'` for reminders, reviewed in `DraftRemindersDrawer`). This is the cluster's first *reviewed-proposal* UX — the exact pattern proactive proposals need ([file 4 · E1](<4 - FABLED 2 — Future Enhancements.md>)), proven on real data.
2. **The Budget AI analysis engine (06-27).** `AIChatAssistant` (the floating Budget-scoped chat, *distinct from ERA's intent system*) now produces schema-constrained `AnalysisReport` JSON over precomputed metrics, with tolerant Zod + `buildFallbackReport` so a data-backed answer always renders, markdown via `ChatMarkdown` (fixed the literal-`**` bug for **every** assistant message), a one-tap ephemeral recharts dashboard, and persistence in `ai_messages.analysis_report` so reopened conversations don't re-generate. Full anatomy: [Budget FABLED 2.1 §3](<../../Budget/FABLED 2/1 - FABLED 2 — Current Implementation.md>); vault doc `03 - Junction Modules/AI Assistant/Spending Analysis Report.md`.
3. **A third conversation store.** v1 flagged two (`api/ai-chat/conversations` vs `api/era/conversations|messages`); the June work persists Budget AI chats in `ai_messages`. Three stores, three shapes, no documented owner — [file 2 · G8](<2 - FABLED 2 — Gaps & Missing.md>).

## 3 · Voice pipeline — verified unchanged, including the debt

Azure STT/TTS/worklet architecture as v1 documented. Re-verified today: **wake word is still the transcript regex** (`azureWake.ts` awaiting a trained `hey-era.table` + `NEXT_PUBLIC_WAKE_MODEL_ENABLED=true`), and the dead Web-Speech path **still ships** (`src/features/voice-conversation/sttCapture.ts`, `vadGate.ts` — zero importers, third month on disk). Degradation states (token-mint fail, worklet fail, mid-stream drop) remain unpinned; the runbook remains a memory file instead of a vault doc.

## 4 · The junction map (what routes through this cluster now)

| Bridge | State | Note |
|---|---|---|
| Message → transaction/reminder/item | ✅ mature | Message Actions modals |
| Bulk messages → drafts → confirm | ✅ new (06-16) | the reviewed-proposal pattern |
| Voice → budget submit | ✅ | `useEraBudgetSubmit` |
| Budget questions → AnalysisReport | ✅ new (06-27) | Budget-scoped, not yet an ERA face capability |
| Proactive briefings | 🟠 shallow | widgets read caches; no composer, no signals registry |
| ERA ↔ memories | 🟠 stub | `features/memories/` still hooks+types only |

## 5 · Test reality

**Still zero tests in all three subsystems** (app suite: 93 tests, none here). The gap is most acute exactly where June raised the stakes: `resolveIntent` now sits upstream of *more* money-capable actions (bulk convert, budget submit, analysis chat), and `analysisReport.ts` + `buildFallbackReport` are pure functions begging for the cheapest tests in the cluster.
