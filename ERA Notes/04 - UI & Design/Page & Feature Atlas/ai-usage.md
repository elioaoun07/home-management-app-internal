---
slug: ai-usage
title: AI Usage
category: utility
route: /ai-usage
type: page
parent: null
children: []
status: active
tags: []
---

# AI Usage

> Personal LLM cost tracker — register models, log sessions, monitor usage percentage per billing cycle.

## Files

- **Page**: `src/app/ai-usage/page.tsx`
- **Layout**: `src/app/ai-usage/layout.tsx`
- **Main component**: `src/components/ai-usage/AIUsagePage.tsx`
- **Sub-components**:
  - `src/components/ai-usage/ModelCard.tsx`
  - `src/components/ai-usage/UsageGauge.tsx`
  - `src/components/ai-usage/AddModelDialog.tsx`
  - `src/components/ai-usage/AddSessionUsage.tsx`
  - `src/components/ai-usage/SessionTypesEditor.tsx`
  - `src/components/ai-usage/UpcomingSessionsList.tsx`

## Hooks

- `src/features/ai-usage/hooks.ts` — models, sessions, session types
- `src/features/ai-usage/useUpcomingAISessions.ts` — upcoming planned sessions
- `src/features/ai-usage/calc.ts` — usage percentage logic

## API routes

- `GET/POST /api/ai-usage` → `src/app/api/ai-usage/`

## DB tables

- `ai_usage_models`
- `ai_session_types`
- `ai_sessions`
- `ai_rate_limits`

## How to get here

- ERA nav or direct URL: `/ai-usage`

## What it links to

- No child routes — all interactions are in-page dialogs/sheets.

## Related vault doc

- `ERA Notes/02 - Standalone Modules/AI Usage/`

## Notes

- `current_usage_pct` on the model is a denormalized field updated by session log mutations, not a DB trigger.
- Adding a new provider: DB enum → Zod schema → `AddModelDialog.tsx`.
