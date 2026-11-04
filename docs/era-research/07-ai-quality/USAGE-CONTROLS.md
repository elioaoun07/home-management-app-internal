---
created: 2026-11-04
updated: 2026-11-04
type: research
status: draft
owner: Elio
evidence_cutoff: "commit 91c4285 (application source identical to 22152c2). §1 is CURRENT IMPLEMENTATION; prices in §2 verified 2026-11-04 where stated; workloads in §3 are ASSUMPTIONS; costs in §4 are arithmetic on those assumptions, not measurements; §6–§8 are PROPOSED DESIGN."
---

# ERA AI Usage Controls

[README](README.md) · [AI Task Matrix](AI-TASK-MATRIX.md) · [Trace Spec](TRACE-SPEC.md) · [Evaluation Pack](EVALUATION-PACK.md) · **Usage Controls**

What ERA's AI costs under stated workloads, how to keep it inside the owner's ceiling, how to compare quality against cost without inventing results, and what ERA does when a task cannot finish.

## 1. Controls today (CURRENT)

| Control | Value | Applies to | Code |
|---|---|---|---|
| Monthly spend ceiling | **$1 per person** (owner decision 2026-10-12), estimated from `ai_messages` receipts after inference | Ask AI (counts every receipt row of the person, i.e. Ask AI + legacy chat) | `src/app/api/era/ask/route.ts:53-86, 212-218` |
| Auto-escalation cap | 15 per day | Ask AI auto path only | `route.ts:47-48, 199-210` |
| Quota read failure | 503 before inference | Ask AI | `route.ts:189-197` |
| Monthly token ceiling | 1,000,000 tokens | Legacy chat | `src/lib/ai/rateLimit.ts:15`; `ai-chat/route.ts:116` |
| Rate limit | 5/min per person, 10/min global, 5 s duplicate window | Ask AI, legacy chat, recipe routes | `rateLimit.ts:9-12` |
| Per-feature caps | Focus: 2 generations/day, ≥ 6 h apart, 24 h cache | Focus | `focus-insights/route.ts:14-16, 178-205` |
| Output cap | 16,000 tokens default including thinking (Ask AI) | Ask AI | `src/lib/ai/anthropic.ts:100`; `eraAskProposal.ts:333-339` |
| Retries | SDK retries off; own retries only for free 429/5xx; a timeout is never retried | Ask AI | `anthropic.ts:20, 28-40` |
| Timeout metering | Input estimated, output 0 (a lower bound) | Ask AI | `eraAskProposal.ts:365-372` |
| Tests | Paid hosts blocked in every Vitest process; live passes owner-started only | All | `tests/setup/blockPaidApis.ts`; Hard Rule 29 |
| **Not controlled** | No receipt, no ceiling for focus, allocation, schedule-suggest, recipe generate/optimize/scale/substitute, URL extraction; no rate limit on allocation and schedule suggestions; Azure speech unmetered | — | [AI-TASK-MATRIX §1](AI-TASK-MATRIX.md#1-inventory-current) |

## 2. Verified pricing

**Claude — verified 2026-11-04** from the official pricing page, [platform.claude.com/docs/en/about-claude/pricing](https://platform.claude.com/docs/en/about-claude/pricing). USD per million tokens.

| Alias (Model Registry) | Product row on the page | Input | 5-min cache write | 1-h cache write | Cache read | Output | Notes |
|---|---|---|---|---|---|---|---|
| `CLAUDE_LOW` | Haiku 5.5, prompts ≤ 100,000 tokens | 0.10 | 0.125 | 0.20 | 0.01 | 0.50 | Over 100,000 prompt tokens the whole request pays 0.50 / 2.50 |
| `CLAUDE_MID` | Sonnet 5.5 | 2.00 | 2.50 | 4.00 | 0.10 (0.05×) | 10.00 | |
| `CLAUDE_HIGH` | Opus 5.5 | 4.00 | 5.00 | 8.00 | 0.20 (0.05×) | 20.00 | |

Also on that page: Batch API −50 % on input and output; US-only inference (`inference_geo`) ×1.1 on all categories (not used in `src/`); models from the 4.7 generation on use a tokenizer that produces about 30 % more tokens for the same text.

**Repo price table check** (`src/features/era/aiUsage.ts:24-62`): base input/output rates for the three aliases and the Haiku long-prompt rule match the page. The cache-read multiplier is a single 0.1× for every model; the page lists **0.05× for Sonnet 5.5 and Opus 5.5** and 0.025× for Fable 5.1, so the AI Usage view would overstate cache-read cost for those models if Ask AI moved to them.

**Gemini — not verified.** The official pricing page (`ai.google.dev`) and Google Cloud's pricing page could not be read from this session (host blocked / page body empty, 2026-11-04). Web search returned only third-party pages with conflicting figures. The repo's own rates (`aiUsage.ts:35-36`) are therefore **unverified assumptions** and are not used for any number in this file. In addition, `GEMINI_MODEL` and `GEMINI_FALLBACK_MODEL` default to "-latest" aliases, so the model and its price can change without a code change (QD-1).

**Azure speech — not verified.** Not researched; no price is used.

## 3. Assumed workloads

All numbers below are assumptions chosen to bracket plausible use; none is measured household behaviour.

**Per Ask AI call (AT-02).** Existing receipts from the 2026-10-11 synthetic pass show 5,538–5,560 input tokens and 38–886 output tokens per call (median 312), thinking included (`tests/era-gym/AGENT-HAIKU-2026-10-11.md`). Two input profiles:

| Profile | Stable (cacheable) | Dynamic | Total input | Basis |
|---|---|---|---|---|
| P-small | 4,000 | 1,550 | 5,550 | Receipts total; the stable/dynamic split is assumed |
| P-full | 4,000 | 7,550 | 11,550 | P-small + a full personal packet and history (12,000 + 12,000 characters at ~4 chars/token; +30 % tokenizer effect would add ~1,800) |

Output: 312 tokens at `low` effort; 936 (3×) as a sensitivity for `medium` effort on higher tiers (assumption).

**Per person per month.**

| Workload | Ask AI calls | Description |
|---|---|---|
| W1 Light | 60 | ~2 a day |
| W2 Typical | 180 | ~6 a day |
| W3 Heavy | 750 | ~25 a day (the 15/day auto cap plus 10 manual) |

**Cache state.** *Warm*: the stable block is read from cache. *Cold*: it is written each call (sparse use, more than 5 minutes apart). *None*: no caching.

## 4. Cost estimates

Per call (USD), computed from §2 rates and §3 assumptions:

| Tier | P-small, 312 out: none / cold / warm | P-full, 312 out: none / cold / warm | P-full, 936 out: cold |
|---|---|---|---|
| `CLAUDE_LOW` | 0.00071 / 0.00081 / 0.00035 | 0.00131 / 0.00141 / 0.00095 | 0.00172 |
| `CLAUDE_MID` | 0.01422 / 0.01622 / 0.00662 | 0.02622 / 0.02822 / 0.01862 | 0.03446 |
| `CLAUDE_HIGH` | 0.02844 / 0.03244 / 0.01324 | 0.05244 / 0.05644 / 0.03724 | 0.06892 |

Cross-check: the route's own comment estimates "~$0.0006 a call" (`route.ts:58`), consistent with the `CLAUDE_LOW` P-small range.

Per person per month, P-full, cold cache, `CLAUDE_LOW` at 312 output and higher tiers at 936 output (the conservative case):

| Workload | `CLAUDE_LOW` | `CLAUDE_MID` | `CLAUDE_HIGH` | 90 % LOW + 10 % MID |
|---|---|---|---|---|
| W1 (60) | $0.09 | $2.07 | $4.14 | $0.28 |
| W2 (180) | $0.25 | $6.20 | $12.41 | $0.85 |
| W3 (750) | $1.06 | $25.85 | $51.69 | $3.54 |

Readings:
- Against the **$1 ceiling**, only `CLAUDE_LOW` fits W1 and W2 with margin; W3 at P-full reaches the ceiling even on `CLAUDE_LOW`.
- A 10 % escalation share to `CLAUDE_MID` fits W1 and W2 but not W3. Escalation must therefore be narrow (E-2) and capped (B-5).
- **Caching can cost more than it saves for sparse use:** a cold 5-minute write costs 1.25× input on the stable block, so cold calls are ~14 % dearer than uncached ones on `CLAUDE_LOW` P-small. The saving appears only when calls cluster within 5 minutes (a conversation). Decide from measured cache hit rates in receipts (QD-10).
- Gemini tasks (AT-03–AT-12) cannot be costed here until their prices are verified and their tokens metered.

## 5. Quality versus cost

**What evidence exists.** Two synthetic, non-representative passes: the 2026-10-10 Gym report for the earlier Gemini path (`tests/era-gym/REPORT.md`) and the 2026-10-11 12-scenario pass where the `CLAUDE_LOW` model passed 11/12 against a Gemini baseline of 12/12 (`AGENT-HAIKU-2026-10-11.md`). There is no evaluation of `CLAUDE_MID` or `CLAUDE_HIGH` on ERA tasks and no result on this folder's pack.

**Comparison method (PROPOSED).**

| Step | |
|---|---|
| 1 | Owner approves one pack pass per tier (11 AT-02 calls each; Q-01 runs offline; the three Gemini cases separately). Estimated at P-small cold: `CLAUDE_LOW` ≈ $0.009, `CLAUDE_MID` ≈ $0.25, `CLAUDE_HIGH` ≈ $0.49 per pass (936-token outputs for MID/HIGH). |
| 2 | Report per tier: critical failures, cases ≥ 8, mean score, tokens, cost per passed case, latency p50/p95. |
| 3 | **Select the lowest tier with zero critical failures and the pack pass threshold.** A higher tier is chosen only for the case categories the lower tier fails and the higher passes (that becomes E-2's trigger set). |
| 4 | Recompute §4 with the measured tokens and the chosen mix; it must stay under the ceiling at W2. |
| 5 | Repeat after any prompt, schema, catalog or model change (replay fingerprints change). |

| Tier | Cost per call (P-full cold) | Pack score | Critical failures | Decision |
|---|---|---|---|---|
| `CLAUDE_LOW` | $0.0014 | not measured | not measured | Default today |
| `CLAUDE_MID` | $0.028–0.034 | not measured | not measured | Escalation candidate only |
| `CLAUDE_HIGH` | $0.056–0.069 | not measured | not measured | Not proposed for household runtime |

## 6. Budget controls

| ID | Control | Behaviour |
|---|---|---|
| B-1 | **One meter.** Every AI route writes a receipt per attempt (HUB-44; [TRACE-SPEC §3.2](TRACE-SPEC.md#32-model-attempt)) | Unmetered routes are blocked from new features until metered |
| B-2 | **One ceiling per person across all AI routes** (QD-2), default the existing $1 | Thresholds below |
| B-3 | **80 %** of the ceiling | Auto-escalation (E-1 auto path) and tier escalation (E-2) off; content routes need an explicit tap; the person sees `AI 80 %` in AI Usage only |
| B-4 | **100 %** | Model calls refused (CURRENT 429 for Ask AI, extended to every route); native ERA, deterministic fallbacks (AT-04–AT-07) and precision tools keep working; owner can raise the ceiling |
| B-5 | **Per-task caps** | Escalated calls ≤ 10 % of the person's monthly calls; recipe AI ≤ 20/day; URL extraction ≤ 10/day; allocation 1 per week (stored); Focus as today |
| B-6 | **Reservation** | Before a call, reserve the worst case (input estimate + `max_tokens` × output rate) atomically; settle to actual after; a timeout settles at the reservation, not at zero |
| B-7 | **Output caps per task** | From [AI-TASK-MATRIX §3](AI-TASK-MATRIX.md#3-model-and-effort-selection-by-requirement) instead of the 16,000 default; worst case on `CLAUDE_LOW` falls from $0.008 to $0.001 of output per call |
| B-8 | **Kill switch per provider** | Env flag (D13) → E-5 native-only degradation |
| B-9 | **Price table with a verified date** | Unpriced or unverified models are flagged in AI Usage, never shown as $0 |

## 7. Incomplete-task behaviour

| ID | Situation | ERA does | ERA never |
|---|---|---|---|
| IT-1 | Output truncated (`stop_reason = max_tokens`) | Treats it as no answer; deterministic "Couldn't do that now"; receipt `stop_reason` recorded | Parse partial JSON or show partial prose |
| IT-2 | Schema-invalid or admission-refused proposal | "I couldn't validate that action. Nothing was changed." (CURRENT) | Show model-authored success text |
| IT-3 | Timeout (may have been billed) | "I couldn't reach the AI just now…" (CURRENT); usage settled at the reservation (B-6) | Retry automatically |
| IT-4 | Free rejection 429/5xx | One retry (Claude) or fallback model (Gemini), each metered | Loop |
| IT-5 | Budget reached mid-conversation | Current turn finishes if already dispatched; next AI turn refused (B-4); confirmed plans keep executing because their steps call no model | Cancel a confirmed write |
| IT-6 | Content task fails (recipe, extraction) | Nothing saved; `Couldn't finish · [Try again]` | Save a partial recipe or allocation |
| IT-7 | Deterministic fallback used (Focus, allocation, report) | Shows the result with a one-word marker (`Basic`) | Present fallback text as model insight |
| IT-8 | Streaming cut off (legacy chat) | Marks the answer incomplete | Store it as a complete answer |
| IT-9 | Fallback or escalated model produced the answer | Receipt records the reason; answer shown normally | Hide which model produced it from the trace |

## 8. Owner decisions

| ID | Decision | Recommendation |
|---|---|---|
| QD-1 | Pin Gemini models and add registry rows with verified prices | Yes |
| QD-2 | Ceiling scope | All AI routes, per person |
| QD-9 | Approve one evaluation pass per tier (≈ 11 AT-02 calls + 3 Gemini calls each) | Yes, `CLAUDE_LOW` and `CLAUDE_MID` first |
| QD-10 | Prompt caching for sparse use | Keep; review after one month of receipts shows the cache hit rate |
| QD-11 | Lower the Ask AI output cap from 16,000 to 2,000–4,000 | Yes, after the pack shows no truncation at the lower cap |
| QD-12 | Update the cache-read multipliers in `aiUsage.ts` before any switch to `CLAUDE_MID`/`CLAUDE_HIGH` | Yes |

QD-3 to QD-8 are in [AI-TASK-MATRIX §5](AI-TASK-MATRIX.md#5-owner-decisions); QD-T1 to QD-T4 in [TRACE-SPEC §8](TRACE-SPEC.md#8-owner-decisions).
