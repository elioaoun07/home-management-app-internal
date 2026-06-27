---
slug: feature-budget-ai
title: Feature · Budget AI (Analysis + Dashboard)
category: feature
route: n/a
type: feature
parent: null
children: []
status: active
tags:
  - feature-module
  - module/ai-assistant
---

# Feature · Budget AI (Analysis + Dashboard)

> Global floating "Budget AI" assistant. Analysis-intent questions return a strict structured report rendered as a markdown chat answer, with a **View as Dashboard** button that re-draws it as ephemeral recharts widgets.

## Files

- **Floating chat panel**: `src/components/ai/AIChatAssistant.tsx`
- **Markdown renderer**: `src/components/ai/ChatMarkdown.tsx` (`react-markdown` + `remark-gfm`)
- **Dashboard translator**: `src/components/ai/AnalysisDashboard.tsx` (ephemeral, no storage)
- **Report contract + prompt + fallback**: `src/lib/ai/analysisReport.ts`
- **Gemini wrapper + budget context**: `src/lib/ai/gemini.ts`

## API routes

- `POST /api/ai-chat` → `src/app/api/ai-chat/route.ts` — returns `{ message, report? }`; `report` present for analysis intent or `mode: "analysis"`.

## DB tables

- `ai_messages`, `ai_sessions` (chat history / usage). The report itself is **not** persisted (session-only).

## How to get here

- Tap the floating **✦ Budget AI** button (bottom-right) on non-standalone pages.
- Ask an analysis question ("Analyze my spending last month", "Where can I save money?") → answer shows a **View as Dashboard** button.

## What it links to

- **Dashboard view**: in-chat opaque overlay (KPIs, donut, trend, insights, recommendations). Closing returns to chat.

## Related vault doc

- `ERA Notes/03 - Junction Modules/AI Assistant/Spending Analysis Report.md`
- `ERA Notes/03 - Junction Modules/AI Assistant/Gemini API Guidelines.md`

## Screenshots

- n/a

## Notes

- Hidden on standalone routes (`/chat`, `/dashboard`, `/reminders`, `/era`, …) and when offline — same as the existing assistant button.
- Robustness: Gemini `responseSchema` + tolerant Zod + deterministic fallback; each widget renders only when its section has data, so a partial report never breaks the layout.
- Mobile-first single column; overlay uses opaque `tc.bgPage` (Hard Rule #15).
