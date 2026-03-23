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

## Key Concepts

- Rate limiting: 5/min per user, 10/min global
- Token tracking in `ai_messages` table
- Context injection from Transactions + Items
- Focus page AI briefing: cached 24h, max 2 manual refreshes/day

## See Also

- [[Transactions Overview|Transactions]]
- [[Items & Reminders Overview|Items & Reminders]]
