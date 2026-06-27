---
created: 2026-06-27
type: feature
module: ai-assistant
module-type: junction
tags:
  - type/feature
  - module/ai-assistant
  - scope/budget
---

# Budget AI — Spending Analysis Report

> **Source:** `src/lib/ai/analysisReport.ts`, `src/app/api/ai-chat/route.ts`, `src/components/ai/AnalysisDashboard.tsx`, `src/components/ai/AIChatAssistant.tsx`, `src/components/ai/ChatMarkdown.tsx`
> **Added:** 2026-06-27 — turns the weak, plain-text "Budget AI" reply into a deep, organized analysis that is **also viewable as an on-demand dashboard**.

## Why

The floating **Budget AI** assistant used to return short, plain-text answers — and the chat rendered them with `whitespace-pre-wrap`, so `**bold**`/`##` showed as literal characters. Output was capped at `maxOutputTokens: 1024`, there was no enforced structure (the model could stop after a 45-token greeting), and the context was raw rows with no derived metrics.

## The contract — one `AnalysisReport`

A **single strict schema** is the source of truth for both surfaces:

- the **chat** renders the report's `narrative` (markdown), and
- the **"View as Dashboard"** button re-draws the same report's structured fields as recharts widgets. The dashboard UI is ephemeral, but the structured report is stored on the assistant message (`ai_messages.analysis_report`) so historical responses can reopen it without another AI call.

Shape (see `src/lib/ai/analysisReport.ts`): `period`, `headline`, `narrative`, `kpis[]`, `categoryBreakdown[]`, `trend[]`, `insights[]`, `recommendations[]`. Only `headline` + `narrative` are required; every data section is an array that may be empty.

## Robustness (the hard requirement)

The model must **always** abide by the format so widgets can't break — enforced three ways:

1. **Gemini structured output** — `responseMimeType: "application/json"` + `responseSchema: ANALYSIS_RESPONSE_SCHEMA` (the `@google/genai` `Type`-enum schema).
2. **Tolerant Zod validation** (`AnalysisReportSchema`) — `parseAnalysisReport()` drops malformed array items instead of throwing, and recovers JSON from fenced/▒prose-wrapped replies.
3. **Deterministic fallback** — `buildFallbackReport(context)` produces a real, data-backed report (KPIs, category %, MoM deltas, trend) when Gemini is rate-limited/unavailable or returns junk. `generateAnalysisReport()` **never throws**.

The renderer (`AnalysisDashboard.tsx`) also renders **one widget per non-empty section** and skips the rest, so a partial report degrades gracefully.

## Flow

1. `POST /api/ai-chat` decides `wantsAnalysis` = `mode === "analysis"` **or** `isAnalysisIntent(message)` (keywords: analyze/spending/save/breakdown/report/on track/routine…). Buffered only — never on the SSE path.
2. `fetchBudgetContext(..., { includeTrend: true })` adds a 6-month income/expense/net series (`fetchMonthlyTrend`) on top of the existing current/last-month context.
3. `generateAnalysisReport()` calls Gemini (temp 0.3, `maxOutputTokens: 8192`, JSON schema) with a precomputed-metrics prompt (category share, MoM delta, savings rate), validates, and falls back if needed.
4. The route returns `{ message: report.narrative, report }` and persists the same `report` JSON to the assistant `ai_messages.analysis_report` column.
5. `GET /api/ai-chat?sessionId=...` selects `analysis_report`; `AIChatAssistant.loadConversation()` hydrates it back onto the assistant message so **View as Dashboard** remains available from chat history.

## Widget mapping

| Report field        | Widget                                            |
| ------------------- | ------------------------------------------------- |
| `headline`          | banner                                            |
| `kpis[]`            | KPI card grid (delta arrow + sentiment color)     |
| `trend[]`           | income/expense area chart (≥2 points)             |
| `categoryBreakdown` | donut + ranked bar list w/ comments + MoM delta   |
| `insights[]`        | typed insight cards (positive/warning/opp/anomaly)|
| `recommendations[]` | priority action cards (impact $/mo)               |

## Gotchas / rules honored

- **Markdown render**: assistant messages now go through `ChatMarkdown` (`react-markdown` + `remark-gfm`) — fixes the literal-`**` bug for **every** message, not just reports.
- **`safeFetch` with `timeoutMs: 60_000`** on the chat POST (Hard Rule #6) — the default 8 s would kill the 8k-token analysis call.
- Dashboard overlay is **opaque** (`tc.bgPage`, Hard Rule #15), **mobile-first** single column (#5), header `h-14` with a separate scroll body (#16). Amounts use `BlurredAmount`.
- Category labels from the model are display text, not stable IDs. `AnalysisDashboard` merges duplicate category names (for example two `Food` rows), recalculates their visible share, and keys chart/legend rows by generated slice IDs to avoid React/Recharts identity collisions.
- Historical dashboard re-open is **non-AI**: the saved `analysis_report` JSON is reused as-is. Existing analysis answers created before `2026-06-27_ai-message-analysis-report.sql` will not have a stored report and must be regenerated once.
- Token caps raised: conversational 1024→**2048**, streaming 512→**1024**, analysis **8192**.

## Possible next steps

- A stronger Gemini tier (Pro/thinking) for the analysis call if quality demands it.

## See Also

- [[Gemini API Guidelines]]
- [[Overview]]
