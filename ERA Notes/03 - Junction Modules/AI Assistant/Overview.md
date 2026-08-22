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
- **ERA intent routing — graceful `clarify` fallback** (2026-08-22, HUB-1): the ERA command-bar router (`src/features/era/intents/`) parses an utterance to a discriminated `Intent`. When it cannot confidently tell what was meant it now returns a dedicated `clarify` outcome (`reason: "ambiguous"` = more than one face matched; `reason: "weak"` = a single incidental keyword too soft to act on) instead of firing a wrong action. `clarify` carries no `face`, so `CommandBar` treats it exactly like `unknown` — **no face switch, no budget/transaction draft** — while still surfacing a clarifying prompt to the user. Concretely: non-spend text such as `spent 2 hours studying` produces no money draft, a weak money word no longer confidently switches faces, and a multi-face utterance asks the user to clarify rather than letting fixed face order silently decide. Behavior is locked by a table-driven fixture (`intents/rootIntentRouter.test.ts`, 39 cases). *(Note: the deterministic ERA keyword router is separate from `voice-conversation/intentClassifier.ts`, which is owned by HUB-2.)* *(Corrected 2026-08-22, same day: the original HUB-1 landing made cross-face fallback treat every non-null hit as equally confident, so a fully slot-filled match (e.g. schedule's `draftReminder` from "remind me…") could tie with another face's bare generic-keyword `switchFace` echo and wrongly resolve to `clarify/ambiguous` — "remind me to buy dinner ingredients" is the caught case. It also let the active face's own weak `clarify` short-circuit before cross-face routers ran at all, swallowing "remind me to buy groceries" (active=budget) before schedule ever saw it. Fixed same-session by tiering cross-face hits — `switchFace` is weak, everything else is strong — and by having the active face's `clarify` step aside for a stronger cross-face hit instead of winning outright. One row corrected, one row added to the fixture.)*
- **Budget AI analysis** (2026-06-27): analysis-intent messages return a strict `AnalysisReport` JSON (Gemini `responseSchema` + Zod + deterministic fallback) that renders as a markdown chat answer and, via **View as Dashboard**, as recharts widgets. The report JSON is persisted on the assistant `ai_messages` row (`analysis_report`) so historical answers can reopen the dashboard without another AI call. See [[Spending Analysis Report]].

## See Also

- [[Transactions Overview|Transactions]]
- [[Items & Reminders Overview|Items & Reminders]]
