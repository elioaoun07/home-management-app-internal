# AI Usage

**Type:** Standalone
**Route:** `/ai-usage`

## What it does

Tracks LLM token usage across providers/models and surfaces upcoming "AI sessions" (planned model interactions). Useful for cost monitoring.

## Files at a glance

- **Page entry**: `src/app/ai-usage/page.tsx`, `src/app/ai-usage/layout.tsx`
- **Components**:
  - `src/components/ai-usage/AIUsagePage.tsx`
  - `src/components/ai-usage/ModelCard.tsx`
  - `src/components/ai-usage/AddModelDialog.tsx`
  - `src/components/ai-usage/AddSessionUsage.tsx`
  - `src/components/ai-usage/SessionTypesEditor.tsx`
  - `src/components/ai-usage/UpcomingSessionsList.tsx`
  - `src/components/ai-usage/UsageGauge.tsx`
- **Hooks**:
  - `src/features/ai-usage/hooks.ts`
  - `src/features/ai-usage/useUpcomingAISessions.ts`
  - `src/features/ai-usage/calc.ts`
  - `src/features/ai-usage/queryKeys.ts`
- **API routes**: `src/app/api/ai-usage/`
- **DB tables**: ai-usage / model / session tables (confirm in `schema.sql`)

## Common edit scenarios

- **"Edit model card UI"** → `ModelCard.tsx`.
- **"Add a new provider"** → DB enum → API zod → `AddModelDialog.tsx`.
- **"Change cost calculation"** → `src/features/ai-usage/calc.ts`.

## Connected modules

- **AI Assistant** ([../junction/ai-assistant.md](../junction/ai-assistant.md)) — writes usage rows.
