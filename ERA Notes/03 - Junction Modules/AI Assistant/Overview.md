---
created: 2026-03-23
type: overview
module: ai-assistant
module-type: junction
tags:
  - type/overview
  - module/ai-assistant
---

# AI Assistant

> **Source:** `src/app/api/ai-chat/`, `src/lib/ai/`
> **Type:** Junction — connects Transactions, Items, Dashboard, Focus

## Docs in This Module

- [[Gemini API Guidelines]]
- [[Spending Analysis Report]] — strict structured report → markdown chat answer + on-demand dashboard

## Key Concepts

- Rate limiting: 5/min per user, 10/min global
- Token tracking in `ai_messages` table
- Context injection from Transactions + Items
- Focus page AI briefing: cached 24h, max 2 manual refreshes/day
- **Budget AI analysis** (2026-06-27): analysis-intent messages return a strict `AnalysisReport` JSON (Gemini `responseSchema` + Zod + deterministic fallback) that renders as a markdown chat answer and, via **View as Dashboard**, as recharts widgets. The report JSON is persisted on the assistant `ai_messages` row (`analysis_report`) so historical answers can reopen the dashboard without another AI call. See [[Spending Analysis Report]].

## See Also

- [[Transactions Overview|Transactions]]
- [[Items & Reminders Overview|Items & Reminders]]
