---
created: 2026-11-04
updated: 2026-11-04
type: research
status: draft
owner: Elio
evidence_cutoff: "commit 91c4285 (2026-11-04; application source identical to 22152c2). §1 is CURRENT IMPLEMENTATION; §2–§5 are PROPOSED DESIGN. No model was called."
---

# ERA AI Task Matrix

[README](README.md) · **AI Task Matrix** · [Trace Spec](TRACE-SPEC.md) · [Evaluation Pack](EVALUATION-PACK.md) · [Usage Controls](USAGE-CONTROLS.md)

Every place ERA (and the app around it) asks a model to do work, whether that work needs a model, and which tier, effort, escalation and fallback each task should use. Models are named by **tier alias** from `ERA Notes/Model-Registry.md` (`CLAUDE_LOW`, `CLAUDE_MID`, `CLAUDE_HIGH`); the registry, not this file, maps aliases to selectors.

**Labels.** CURRENT IMPLEMENTATION = read in code. PROPOSED = this folder. UNKNOWN = needs deployment, provider console or owner. Task IDs `AT-n` are used across the folder.

## 0. Summary

1. **Two providers, twelve model tasks.** Ask AI runs on Claude (`ANTHROPIC_MODEL`, default the `CLAUDE_LOW` model, `src/lib/ai/anthropic.ts:5`). Everything else runs on Gemini through `generateContentWithFallback` with a primary and a fallback model from `GEMINI_MODEL` / `GEMINI_FALLBACK_MODEL`, both defaulting to auto-updating "-latest" aliases (`src/lib/ai/gemini.ts:6, 12`; `docs/ENV.md:15-18`).
2. **Only Ask AI and the legacy chat write usage receipts.** Recipe, focus, allocation, schedule-suggestion and URL-extraction calls are rate-limited or not at all, and their tokens are never recorded (§1).
3. **About half the tasks do not need a model for their core result.** Numbers (spend, allocations, scaling), counts and summaries can be computed; a model adds wording at most. Language interpretation, recipe generation and messy extraction genuinely need one.
4. **Proposal: `CLAUDE_LOW` at low effort stays the default for interpretation**, with a narrow, evaluated escalation to `CLAUDE_MID` for compound plans; money and schedule facts are never model-computed; on provider failure ERA degrades to native-only rather than switching provider for action proposals.

## 1. Inventory (CURRENT)

| ID | Task | Route / code | Provider · model | Output contract | Validation | Fallback today | Metered | Rate-limited |
|---|---|---|---|---|---|---|---|---|
| AT-01 | Native ERA turn (router, resolvers, capture memory) | `src/features/era/useEraTurn.ts`, `intents/`, `src/lib/era/captureMemory.ts` | **None** | Intent → resolver | Deterministic | — | n/a | n/a |
| AT-02 | Ask AI: interpret router misses, compound requests, manual taps; propose action/plan or answer | `/api/era/ask` → `generateAskAIResponse` (`src/lib/ai/eraAskProposal.ts`) | Claude · `CLAUDE_LOW`, effort `low`, JSON schema, 5-min prompt cache on the stable block, SDK timeout 40 s, `maxRetries: 0` with own retries only on free 429/5xx (`anthropic.ts:20, 28-40`) | `ASK_AI_RESPONSE_SCHEMA`: `prose` / `propose_action` / `propose_plan` / `propose_nfc_reminder` (`eraAskProposal.ts:126-170`) | Zod + capability/plan admission; refusal text deterministic (HUB-108) | Deterministic "couldn't reach the AI" prose; server-side model fallback only on listed higher models (`anthropic.ts:7-13`) | Yes: `ai_messages` receipts incl. cache split (`route.ts:262-291`) | Yes: 5/min user, 10/min global, 5 s dedupe (`rateLimit.ts`); 15 auto-escalations/day; $1/month (`route.ts:48, 60`) |
| AT-03 | Legacy floating budget assistant (chat, stream) | `/api/ai-chat`, `/api/ai-chat/stream` (`src/components/ai/AIChatAssistant.tsx`) | Gemini primary → fallback | Prose; "Budget AI" persona (`gemini.ts:290`) | None | Fallback model on 429/5xx | Yes (`ai_messages`) | Yes; 1M tokens/month (`rateLimit.ts:15`; `ai-chat/route.ts:116`) |
| AT-04 | Spending analysis report | `src/lib/ai/analysisReport.ts` via AT-03 | Gemini | Strict JSON report (`responseSchema` + Zod) | Zod; `buildFallbackReport` deterministic (`:472`) | Deterministic report | Via AT-03 | Via AT-03 |
| AT-05 | Focus weekly insight | `/api/focus-insights` | Gemini, `maxOutputTokens: 800` (`:275`) | JSON-ish: greeting, summary, focusTip, ≤3 priorityInsights, patternObservations, encouragement | Regex-extracted JSON; deterministic fallback text on parse error | Fallback model | **No** | 2 generations/day; 6 h minimum gap (`:178-205`) |
| AT-06 | Budget allocation suggestion | `/api/budget-allocations/ai-suggest` | Gemini, `maxOutputTokens: 16384`, JSON mime (`:432-448`) | `suggestions[]` with category ids, amounts, reasoning; `total_suggested` (`:402-417`) | `JSON.parse`; statistical fallback `buildStatisticalSuggestion` | Statistical | **No** | **No** |
| AT-07 | Flexible schedule suggestion | `/api/suggest-schedule` | Gemini only when `useAI` (default false, `:74, 170-171`) | Suggested slots | — | Pattern-based deterministic result | **No** | **No** |
| AT-08 | Recipe generate (ingredients + steps from a title) | `/api/recipes/[id]/generate` | Gemini | Recipe fields; sets `ai_generated` (`:143`) | — | Fallback model | **No** (rate-limit row only) | Yes (`recordRequestHash`) |
| AT-09 | Recipe optimize (fill gaps, correct times) | `/api/recipes/[id]/optimize` | Gemini | Diff with reasons | — | Fallback model | **No** | Yes |
| AT-10 | Recipe scale ("non-linear" servings) | `/api/recipes/[id]/scale` | Gemini | Scaled ingredients | — | Fallback model | **No** | Yes |
| AT-11 | Ingredient substitution | `/api/recipes/[id]/substitute` | Gemini | Substitutions + impact | — | Fallback model | **No** | Yes |
| AT-12 | Recipe from URL / social / YouTube | `/api/recipes/extract-from-url` | Gemini; YouTube from "training knowledge" (`:7`) | Recipe JSON | None found | Fallback model | **No** | Yes |
| AT-13 | Category suggestion helper | `suggestCategory` (`gemini.ts:563`) | Gemini | Category | — | — | — | No caller found |
| AT-14 | Speech to text / text to speech | `/api/azure-speech`, `/api/tts`, `src/features/voice-conversation/` | Azure speech | Transcript / audio | — | Browser speech synthesis fallback for TTS | **No** | Not traced |
| — | Code delivery agents | `scripts/delivery*` | Subscription SDKs, Model Registry aliases | — | Delivery gates | — | Delivery's own ledger | DEC-14 (no API keys, no extra cost) |

Delivery is listed only to mark the boundary: it has its own model governance and is out of scope here.

## 2. Model or deterministic?

**Rule.** Use a model only when the task's core result depends on open-ended language understanding or generation that a bounded rule cannot cover. Compute every fact, number, date, identifier and count deterministically; a model may *phrase* or *choose among* computed options, never produce them.

| ID | Core result | Needs a model? | Deterministic alternative | Recommendation |
|---|---|---|---|---|
| AT-01 | Intent + slots | No | Already deterministic | Keep; widen with lexicon, not models |
| AT-02 | Interpretation of free phrasing, compound plans | **Yes** | Router covers fixed phrasings | Keep, router first (HUB-77); model never computes the answer to a data question: it routes to a read (`spend.month`, `schedule.forDay`) whose result is returned verbatim |
| AT-03 | Budget Q&A | Partly | ERA reads + templates | Retire into ERA (04-memory-context OD-10); it duplicates AT-02 with another period and persona (HUB-45) |
| AT-04 | Report numbers | No (numbers); optional (narrative) | `buildFallbackReport` | Numbers deterministic; model only for the narrative line, or none |
| AT-05 | Weekly focus summary | No | Templates over counts and due dates (D3, D9) | Replace with the deterministic briefing; retire the model call (D9) |
| AT-06 | Money allocation | No (amounts) | `buildStatisticalSuggestion` | Amounts deterministic; model at most explains; never posts |
| AT-07 | Slot placement | No | Pattern engine (default) | Keep `useAI` off by default |
| AT-08 | Recipe from a title | **Yes** | — | Keep; mark `ai_generated`; allergen check deterministic afterwards |
| AT-09 | Recipe edits | **Yes** | — | Keep; diff shown for review |
| AT-10 | Scaling | Mostly no | Linear scaling + per-unit rounding rules ("slices", "eggs", "pinch") | Deterministic first; model only for flagged non-linear lines |
| AT-11 | Substitutions | **Yes** (knowledge) | — | Keep; deterministic allergen filter on the suggestions |
| AT-12 | Extraction | Partly | schema.org Recipe JSON-LD / microdata when present; model for plain text; **refuse** "training knowledge" for videos | Deterministic first; model on page text only; never invent a recipe for a URL it cannot read |
| AT-13 | Category | No | Merchant map, user history (capture memory) | Remove the dead helper |
| AT-14 | Speech | **Yes** (speech model) | — | Keep; the transcript then goes through AT-01 |

## 3. Model and effort selection by requirement

Each task is scored on five requirements; the tier is the lowest that satisfies all of them **on the evaluation pack** ([EVALUATION-PACK](EVALUATION-PACK.md)). Until an owner-approved pass exists, tiers below are proposals, not measured choices.

| Requirement | Low | High |
|---|---|---|
| Ambiguity of input | Fixed vocabulary | Free, mixed-language, multi-intent |
| Output strictness | Prose | Strict schema with IDs and bindings |
| Consequence of a wrong output | Cosmetic | Money/schedule/safety (gated by Confirm) |
| Latency budget | Background | Interactive (< 5 s target) |
| Volume | Rare | Many calls/day |

| ID | Profile | Proposed tier | Effort | Max output | Why |
|---|---|---|---|---|---|
| AT-02 single action / prose | High ambiguity, strict schema, consequence gated by Confirm, interactive, high volume | `CLAUDE_LOW` | `low` (CURRENT) | 2,000 tokens (thinking included) | Existing receipts: ~5,540 input and 38–886 output tokens per call (`tests/era-gym/AGENT-HAIKU-2026-10-11.md`) |
| AT-02 compound plan (≥ 3 steps or cross-module) | As above, more reasoning | `CLAUDE_LOW` first; `CLAUDE_MID` only by escalation rule E-2 | `low` → `medium` on escalation | 4,000 | The only failure in the 2026-10-11 pass was a compound "pantry subtraction" request (11/12); escalate after evidence, not by default |
| AT-04 narrative | Low ambiguity, prose | `GEMINI_PRIMARY` or none | provider default | 300 | Numbers come from code |
| AT-08 / AT-09 / AT-11 | Generative, cosmetic-to-moderate consequence, background | `GEMINI_PRIMARY` | default | 2,000 | Existing path; no reason to move until metered |
| AT-10 non-linear lines | Narrow | `GEMINI_FALLBACK` (lighter) | default | 500 | Only flagged lines are sent |
| AT-12 text extraction | Messy text, strict fields, external content | `GEMINI_PRIMARY` | default | 1,500 | Injection-exposed; output validated before save |

`GEMINI_PRIMARY` / `GEMINI_FALLBACK` are **proposed** aliases for `GEMINI_MODEL` / `GEMINI_FALLBACK_MODEL`; the Model Registry has no Gemini rows today, and the "-latest" defaults change the model (and price) without a code change (QD-1).

## 4. Escalation and fallback

| ID | Trigger | Behaviour | Never |
|---|---|---|---|
| E-1 | Router miss classified *language gap*, or manual Ask AI | AT-02 at `CLAUDE_LOW` (CURRENT) | Escalate a *capability gap* automatically (CURRENT rule) |
| E-2 | AT-02 plan with ≥ 3 steps or ≥ 2 modules **and** the owner has enabled tier escalation after an evaluation pass | Re-ask at `CLAUDE_MID`, effort `medium`, once; the second response replaces the first | Escalate because the first answer was a refusal or a question (those are often correct) |
| E-3 | Schema-invalid or truncated (`stop_reason = max_tokens`) response | Treat as no answer; deterministic refusal (CURRENT); no automatic re-ask at the same tier | Show partial JSON or partial prose as an answer |
| E-4 | Free rejection (429 / 5xx before work) | One retry with backoff (CURRENT for Claude; Gemini moves to the fallback model) | Retry a timeout (it may have been billed, `anthropic.ts:28-34`) |
| E-5 | Provider unavailable, key missing, or budget exhausted | **Degrade to native-only**: "AI is unavailable · use the app directly", native router keeps working | Switch Ask AI to the other provider: prompts, schemas and evaluation differ (QD-6) |
| E-6 | Gemini daily quota (`isDailyQuotaError`) | Fallback model for content tasks (CURRENT); mark the receipt `fallback=true` | Hide that a fallback produced the result |
| E-7 | Content task fails entirely | Deterministic fallback where one exists (AT-04, AT-05, AT-06, AT-07); otherwise "Couldn't do that now" | Save a partial recipe or allocation |

Every attempt (primary, retry, fallback, escalation) is metered and traced on its own ([TRACE-SPEC §3.2](TRACE-SPEC.md#32-model-attempt)); today Ask AI records only the first response's usage (`route.ts:264`), which HUB-44 tracks.

## 5. Owner decisions

| ID | Decision | Recommendation |
|---|---|---|
| QD-1 | Add Gemini rows to the Model Registry and pin selectors instead of "-latest" (D13) | Pin; record the verified price beside each row |
| QD-2 | Scope of the monthly AI ceiling: Ask AI only (today) or every AI route | Every route, per person ([USAGE-CONTROLS §6](USAGE-CONTROLS.md#6-budget-controls)) |
| QD-3 | Retire the legacy floating assistant (AT-03) | Yes, after ERA covers its analysis report |
| QD-4 | Replace the Focus model call (AT-05) with deterministic templates | Yes (D9) |
| QD-5 | Allocation amounts (AT-06) deterministic only | Yes; model text optional |
| QD-6 | Cross-provider fallback for Ask AI | None; degrade to native-only |
| QD-7 | Enable E-2 (`CLAUDE_MID` escalation) | Only after an owner-approved pack pass shows `CLAUDE_LOW` failing compound cases that `CLAUDE_MID` passes |
| QD-8 | Refuse "training knowledge" recipes for unreadable URLs (AT-12) | Refuse |
