---
created: 2026-05-30
type: overview
module: ai-usage
module-type: standalone
status: active
tags:
  - type/overview
  - module/ai-usage
related:
  - "[[Common Patterns]]"
---

# AI Usage

> **Page:** `src/app/ai-usage/` | **Feature:** `src/features/ai-usage/` | **Components:** `src/components/ai-usage/`
> **DB Tables:** `ai_usage_models`, `ai_session_types`, `ai_sessions`, `ai_rate_limits`
> **Type:** Standalone
> **Route:** `/ai-usage`

## Overview

Personal LLM cost tracking. Users register AI models (e.g. Claude Sonnet, GPT-4o) with a billing cycle, track usage percentage per cycle, log individual sessions, and view upcoming planned sessions. Useful for staying within usage caps and monitoring spend across providers.

## Architecture

Each user creates **models** (`ai_usage_models`) — one per subscription/plan. A model has a `refresh_frequency` (weekly/monthly), `cycle_start_date`, and `current_usage_pct`. Users log **sessions** (`ai_sessions`) against models with token counts; the `calc.ts` module computes rolling usage percentages. **Session types** (`ai_session_types`) are named templates (e.g. "coding session") linked to a model with an `estimated_usage_pct`, used to plan upcoming usage.

The `UsageGauge` component renders a radial gauge per model. `UpcomingSessionsList` shows planned sessions ordered by scheduled date.

## Database

| Table | Role |
|---|---|
| `ai_usage_models` | One per subscription — name, provider, cycle config, `current_usage_pct`, `position` (display order) |
| `ai_session_types` | Named session templates with `estimated_usage_pct`, FK to a model |
| `ai_sessions` | Logged sessions — title, token counts, `is_archived` |
| `ai_rate_limits` | Per-endpoint rate limiting for AI API calls |

## Key Files

- `src/app/ai-usage/page.tsx` — page entry
- `src/app/ai-usage/layout.tsx` — layout wrapper
- `src/components/ai-usage/AIUsagePage.tsx` — root component
- `src/components/ai-usage/ModelCard.tsx` — per-model card with gauge
- `src/components/ai-usage/UsageGauge.tsx` — radial usage gauge
- `src/components/ai-usage/AddModelDialog.tsx` — add/edit model form
- `src/components/ai-usage/AddSessionUsage.tsx` — log a session
- `src/components/ai-usage/SessionTypesEditor.tsx` — manage session type templates
- `src/components/ai-usage/UpcomingSessionsList.tsx` — planned sessions
- `src/features/ai-usage/hooks.ts` — main query/mutation hooks
- `src/features/ai-usage/useUpcomingAISessions.ts` — upcoming sessions query
- `src/features/ai-usage/calc.ts` — usage percentage calculations
- `src/features/ai-usage/queryKeys.ts` — query key constants
- `src/app/api/ai-usage/` — REST API for models, sessions, session types

## Gotchas

- Adding a new provider requires: DB enum update → Zod schema update → `AddModelDialog.tsx` update — all three together.
- `current_usage_pct` on the model is a denormalized cache; it is updated by the session log mutation in `calc.ts`, not by a DB trigger.
- This module is intentionally excluded from the CLAUDE.md Feature Index (it tracks AI usage as a personal utility, not app behaviour).

## See Also

- [[AI Assistant]] — the ERA Hub AI that this module tracks usage for
- [[Common Patterns]]
