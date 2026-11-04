---
created: 2026-11-04
updated: 2026-11-04
type: research
status: draft
owner: Elio
evidence_cutoff: "commit 91c4285 (application source identical to 22152c2). §2 is CURRENT IMPLEMENTATION; §3–§8 are PROPOSED DESIGN. The example trace is fictional."
---

# ERA AI Trace Specification

[README](README.md) · [AI Task Matrix](AI-TASK-MATRIX.md) · **Trace Spec** · [Evaluation Pack](EVALUATION-PACK.md) · [Usage Controls](USAGE-CONTROLS.md)

The smallest record that can answer four questions about any AI-assisted turn — **what context was used, why an action happened, why a run failed, what it cost** — without copying what the person said, what ERA knows about them, or what the model wrote.

## 1. The four questions and what answers them

| Question | Needs | Does **not** need |
|---|---|---|
| What context was used? | Source names, coverage state, record IDs, section sizes, prompt/schema/catalog versions | The context text |
| Why did an action happen? | Router decision and reason, proposal kind and capability IDs, admission verdict, approval (who, when, fingerprint), action IDs and artifacts | Slot values, model prose |
| Why did a run fail? | Stage, error class, attempt list, stop reason, timeouts, quota state | Stack traces with prompt fragments, raw provider bodies |
| What did it cost? | Provider, resolved model, tokens by kind (input, cache read, cache write, output incl. thinking), price-table version, estimated cost per attempt | Request or response content |

## 2. What exists today (CURRENT)

| Record | Holds | Content stored? | Code |
|---|---|---|---|
| `ai_messages` (Ask AI, legacy chat) | Two rows per call: `role`, **`content`** (question and answer text), tokens, `model_used` with `:estimated` / `:cache=R/W` / `unknown:no-response` suffixes | **Yes** (copies) | `src/app/api/era/ask/route.ts:262-291`; `schema.sql` `ai_messages` |
| `contextReceipt` on the assistant `era_messages` row | Coverage per source, episode and choice IDs, packet size | No (IDs only) | `src/lib/ai/eraAdaptiveContext.ts:431-439`; `useEraAskAI.ts:382-386` |
| `era_messages.intent_payload` | Outcome, plan, run receipts, artifacts, `missKind` | Partly (some values, e.g. memory recall `value`) | `src/features/era/missTracking.ts`; `resolvers/brain.ts:81` |
| `era_actions` ⛁ | Artifact rows (entity, id, title, route) | Titles | Feature Map ERA |
| `era_runs` ⛁ | Journal state with step results | Result text | `src/features/era/execution/state.ts` |
| Server logs | `[era-ask] …` reasons, usage-receipt failures | Codes only by intent (`route.ts:287-290`) | Vercel (retention UNKNOWN) |
| Gym receipts | Per-scenario model, tokens, stop reason, ms, raw output; prompt/schema fingerprints required for replay | Synthetic only | `tests/era-gym/AGENT-*.md`, `recordings/` |

Gaps: only the first provider response is metered (`route.ts:264`, HUB-44); content routes other than Ask AI and the legacy chat write no receipt at all ([AI-TASK-MATRIX §1](AI-TASK-MATRIX.md#1-inventory-current)); no record ties a model call to the action it led to except by conversation and time; content is copied into `ai_messages`.

## 3. Trace records (PROPOSED)

Three records. Field classes: **ID** (opaque identifier), **ENUM** (fixed vocabulary), **NUM** (count, size, ms, USD), **HASH** (SHA-256 of a canonical string; never of personal content alone), **TS** (timestamp). No free-text field exists.

### 3.1 Turn

One per user turn that reached any AI task (native-only turns write nothing new).

| Field | Class | Notes |
|---|---|---|
| `turn_id` | ID | = the user `era_messages.id` when the turn came from ERA |
| `owner_id`, `conversation_id` | ID | Owner-only RLS |
| `task` | ENUM | `AT-02` … `AT-12` |
| `surface` | ENUM | `era_typed`, `era_voice`, `era_ask_tap`, `recipe_page`, `budget_page`, … |
| `route_decision` | ENUM | `native_hit`, `clarify`, `language_gap`, `capability_gap`, `recent_dialogue`, `manual` |
| `context_sources` | ENUM→ENUM map | e.g. `{conversations: sampled, lexicon: available, budget_face: unavailable}` |
| `context_ids` | ID[] | Message, rule and record IDs actually placed in the packet (CURRENT receipt, extended to face context) |
| `context_sizes` | NUM map | Characters per section |
| `prompt_version` | HASH | Of the stable block + schema + capability catalog (the same fingerprint replay uses) |
| `budget_state` | NUM | Spent and ceiling before the call |
| `attempt_ids` | ID[] | §3.2 |
| `result` | ENUM | `prose`, `proposal`, `plan`, `refused_admission`, `no_response`, `degraded_native` |
| `refusal_code` | ENUM | `invalid_schema`, `unknown_capability`, `unsupported_part`, `conditional_unsupported`, `ambiguous_target`, `speech_act`, `truncated` |
| `proposal` | ENUM[] | Capability IDs only, in plan order |
| `action_ids` | ID[] | Links to the action envelope ([06 ACTION-LIFECYCLE §2](../06-action-execution/ACTION-LIFECYCLE.md#2-the-action-envelope)) |
| `created_at` | TS | |

### 3.2 Model attempt

One per provider request, including retries, fallbacks and escalations.

| Field | Class | Notes |
|---|---|---|
| `attempt_id`, `turn_id` | ID | |
| `ordinal` | NUM | 1, 2, … |
| `reason` | ENUM | `primary`, `retry_free_rejection`, `fallback_model`, `escalation_E2` |
| `provider` | ENUM | `anthropic`, `google`, `azure` |
| `tier_alias` | ENUM | `CLAUDE_LOW`, `GEMINI_PRIMARY`, … |
| `model_resolved` | ENUM | The model the provider reports (CURRENT `model_used` prefix); literal on purpose (Model Registry: usage records stay literal) |
| `effort`, `max_tokens` | ENUM, NUM | |
| `tokens_in`, `tokens_cache_read`, `tokens_cache_write`, `tokens_out` | NUM | `tokens_out` includes thinking |
| `usage_basis` | ENUM | `reported`, `estimated`, `unknown_no_response` |
| `stop_reason` | ENUM | `end_turn`, `max_tokens`, `refusal`, `error` |
| `error_class` | ENUM | `timeout_may_bill`, `http_429`, `http_5xx`, `http_4xx`, `quota_daily`, `key_missing`, `network` |
| `latency_ms` | NUM | |
| `price_table` | HASH | Version of the rate table used for the estimate |
| `cost_usd_est` | NUM | Computed from tokens × rates; marked `unpriced` when no rate exists |
| `created_at` | TS | |

### 3.3 Failure

One per stopped turn or run, linking stage to cause.

| Field | Class | Values |
|---|---|---|
| `turn_id` / `run_id` | ID | |
| `stage` | ENUM | `quota_check`, `context`, `model`, `admission`, `preview`, `approval`, `dispatch`, `verify` |
| `cause` | ENUM | From `error_class`, `refusal_code` or action outcome (`uncertain`, `partial`, `stale`) |
| `user_message_code` | ENUM | Which fixed reply was shown (`ai_unavailable`, `couldnt_validate`, `check_app`, …) |

## 4. Content minimization rules

| ID | Rule |
|---|---|
| TR-1 | No trace field holds the person's words, context values, prompts, model output, titles or amounts. Enumerations and IDs only. |
| TR-2 | Content stays where the product already keeps it (`era_messages`, owner RLS) and is removed by the forget pipeline ([04 CORRECTION-AND-EXPIRY-RULES §7](../04-memory-context/CORRECTION-AND-EXPIRY-RULES.md#7-forget)); traces only point at it. |
| TR-3 | `ai_messages` becomes a receipt table: keep tokens, model, session and time; stop writing `content` for Ask AI (04-memory-context OD-7). Existing content follows the forget and retention decisions. |
| TR-4 | Hashes are over canonical prompt *templates*, schemas and catalogs, never over a person's message or context packet (a hash of short personal text can be brute-forced). |
| TR-5 | Error logging records `error_class` and HTTP status, never provider bodies, which can echo the prompt (CURRENT practice for the receipt failure, `route.ts:287-290`). |
| TR-6 | Content capture for debugging exists only in an owner-started, time-boxed session on synthetic data (Live API Testing Protocol), written to a local file and deleted after. Real conversations are investigated through the person's own Report (HUB-85), which they choose to file. |
| TR-7 | Partner data never appears: traces are per owner; a household read records only its coverage state for that owner. |

## 5. How each question is answered

| Question | Query path |
|---|---|
| Context used | `turn.context_sources` + `turn.context_ids` → open the referenced rows (owner only); `prompt_version` → the template revision |
| Why an action happened | `turn.route_decision` → `turn.result` / `proposal` → `action_ids` → action envelope approval (who, when, fingerprint) → artifacts |
| Why a run failed | `failure.stage` + `failure.cause`; for model stages the attempts in order with `error_class`, `stop_reason` and `latency_ms` |
| What it cost | Sum `attempt.cost_usd_est` by turn, task, day, month; `usage_basis` shows which numbers are estimates; unmetered tasks show as gaps, never zero |

## 6. Storage, retention and access

- **Where.** Top Layer D4 names `ai_sessions/ai_messages` as the telemetry store; the turn and attempt records extend that store (owner-run migration, Hard Rule 24) rather than adding a new one. The failure record is a field set on the turn.
- **Access.** Owner-only RLS, same as `ai_messages` in the snapshot (`auth.uid() = user_id`).
- **Retention (proposal, QD-T1).** Attempt-level rows 90 days; monthly aggregates per task and tier kept indefinitely; turn rows follow conversation retention (04-memory-context OD-2).
- **Forget.** Traces hold no content, so forget leaves them intact; their IDs simply stop resolving.

## 7. Example (fictional)

Maya asks on the Kitchen face to plan pasta on Thursday and add the ingredients; the router misses on the compound request.

```json
{
  "turn": {
    "turn_id": "msg_9f2e", "task": "AT-02", "surface": "era_typed",
    "route_decision": "language_gap",
    "context_sources": { "conversations": "sampled", "currentConversation": "sampled",
                         "choices": "available", "settings": "available",
                         "activity": "unavailable", "sharedMemories": "unavailable" },
    "context_ids": ["msg_71aa", "msg_71ab", "lex_33c0"],
    "context_sizes": { "personal": 3120, "history": 1880 },
    "prompt_version": "sha256:4be1…", "budget_state": { "spent_usd": 0.21, "ceiling_usd": 1 },
    "attempt_ids": ["att_1"], "result": "plan",
    "proposal": ["recipe.search", "meal.assign", "recipe.ingredients", "shopping.add"],
    "action_ids": ["act_a1", "act_a2"]
  },
  "attempts": [{
    "attempt_id": "att_1", "ordinal": 1, "reason": "primary", "provider": "anthropic",
    "tier_alias": "CLAUDE_LOW", "effort": "low", "max_tokens": 2000,
    "tokens_in": 1550, "tokens_cache_read": 4000, "tokens_cache_write": 0, "tokens_out": 640,
    "usage_basis": "reported", "stop_reason": "end_turn", "latency_ms": 3920,
    "price_table": "sha256:a07d…", "cost_usd_est": 0.000515
  }]
}
```

Cost line: 1,550 × $0.10/M + 4,000 × $0.01/M + 640 × $0.50/M = $0.000155 + $0.00004 + $0.00032 = $0.000515 (rates verified 2026-11-04, [USAGE-CONTROLS §2](USAGE-CONTROLS.md#2-verified-pricing)).

## 8. Owner decisions

| ID | Decision | Recommendation |
|---|---|---|
| QD-T1 | Attempt-level retention | 90 days; aggregates kept |
| QD-T2 | Stop storing Ask AI text in `ai_messages` | Yes (= 04 OD-7) |
| QD-T3 | Meter every AI route, including Gemini content routes and Azure speech | Yes (HUB-44) |
| QD-T4 | Trace store location | Extend `ai_messages`/`ai_sessions` (D4) |
