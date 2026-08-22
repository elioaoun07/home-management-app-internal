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
- **ERA intent resolution — `resolveIntent` is the single owner of every intent's side effect *and* its reply** (2026-08-22, HUB-12). `src/features/era/intents/resolveIntent.ts` dispatches an `Intent` to a per-face resolver in `intents/resolvers/`, which performs the real write and returns `{ text, metadata }`; `intents/formatters/` owns the wording. Three points matter when adding an intent here:
  - **Never let an intent fall through to `replyFormatter`.** `formatReply` is a *fallback for callers that format without resolving* — before HUB-12, `draftReminder` and `showAnalytics` reached the dispatcher, hit the `default` branch, and returned "Coming soon" while writing nothing. That is the worst failure shape available: the user reads it as success. If you add an `Intent` member, add its `case` in the same commit.
  - **Side effects that need React live behind `ResolveDeps`, not behind a branch in the caller.** `draftTransaction` needs the user's accounts, categories, the React Query client, and the Undo toast — all of which live in `useEraBudgetSubmit`. `CommandBar` injects that hook's `submit` as `ResolveDeps.submitBudgetDraft` rather than doing the write itself, so the write and the reply cannot disagree. It used to run on a parallel path in `CommandBar`, which is exactly how a failed draft came back as "Drafting $25.00…". `CommandBar` reads the draft id back out of `metadata.draftId`.
  - **`draftReminder` omits `due_at` when the parser found no date.** `resolvers/schedule.ts` runs `parseSmartText`, uses its cleaned `title` (not the raw utterance), and converts `dueDate`/`dueTime` with `localToISO` — but only when `confidence.date > 0`. Inventing a due time would fire an alert immediately. When a date was parsed with no time it defaults to noon, matching `MobileReminderForm`.
  Locked by `intents/resolveIntent.test.ts` (14 cases), which asserts the request body and the reply together.
- **ERA's voice is pooled, not scripted** (2026-08-22, HUB-15). `src/lib/era/phrasing.ts` supplies the mechanics — `pick` / `fill` / `say`, `describeWhen`, `money`, `plural`, `listOut`, `errorReply`, and a time-aware `greeting` — and every situation across all four faces owns a **pool** of slot-templated sentences chosen at random, so the same request twice does not return the same string. It sits in `src/lib/` because ERA and voice-conversation are separate standalone feature dirs. Four rules govern the pools, and breaking any of them is a bug, not a style choice:
  1. **Every variant carries the same facts.** Variation lives in the connective tissue; a variant that drops the amount or the due time makes the assistant lie some fraction of the time, with no way to tell which fraction. `intents/resolveIntent.test.ts` enforces this by driving `Math.random` across its range, collecting every sentence a pool can emit, and asserting the payload survives in all of them.
  2. **Slots, not concatenation** — `{name}` placeholders let a variant put the fact where its sentence wants it, which is most of what makes a set read as human. `fill` handles the spacing edge cases (flush against an opening quote vs. flush against a word) and cleans up separators stranded by an empty slot.
  3. **No jokes or personality-of-the-day.** Variants differ in rhythm and register only.
  4. **Never randomize an error's meaning.** `errorReply(diagnosis)` varies the apology and the retry nudge around a fixed diagnosis.
  *(Not yet applied to `src/features/voice-conversation/speechTemplates.ts`, which is still a parallel un-pooled surface — HUB-16.)*
- **Budget AI analysis** (2026-06-27): analysis-intent messages return a strict `AnalysisReport` JSON (Gemini `responseSchema` + Zod + deterministic fallback) that renders as a markdown chat answer and, via **View as Dashboard**, as recharts widgets. The report JSON is persisted on the assistant `ai_messages` row (`analysis_report`) so historical answers can reopen the dashboard without another AI call. See [[Spending Analysis Report]].

## See Also

- [[Transactions Overview|Transactions]]
- [[Items & Reminders Overview|Items & Reminders]]
