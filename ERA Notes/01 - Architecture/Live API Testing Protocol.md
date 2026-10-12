# Live API Testing Protocol

Applies to any test that spends real quota on an external paid/rate-limited API: Claude, Gemini, Azure speech, or similar. Summary lives in CLAUDE.md Hard Rule #29.

## Default: no live calls (2026-10-12)

- **Only the owner starts a live pass** — when a new feature needs model evidence, something seems broken, or a reported chat needs reproducing. An agent never proposes or runs one on its own, and a stale or missing recording is never a reason to: replays skip it.
- **Tests cannot reach paid APIs.** `tests/setup/blockPaidApis.ts` (Vitest `setupFiles`) rejects every request to Anthropic, Gemini/Vertex and Azure speech/OpenAI hosts, whatever SDK makes it. Never remove it or add a host exception.
- **No recorder ships in the repo.** The Gemini gym recorder (`tests/era-gym/record.test.ts`) and the Claude agent-record refresh were deleted on 2026-10-12, along with the one-off `.tmp/era-agent-*-once.mjs` scripts. `gym.test.ts` and `agent-record.test.ts` replay the committed recordings only. An owner-started pass is a standalone script written for that pass, run outside Vitest, then deleted.
- Why: the 2026-10-11 HUB-107 acceptance work ran two Claude passes (12 + 13 calls, ~$0.019) that wrote no `ai_messages` receipts, so ERA's AI Usage tab showed $0.003 against a $0.02 console bill (HUB-111).

## Why

2026-10-11: a 12-scenario test packed into one Gemini request spent its entire 4,096-token output cap on thinking (3,932 thought vs 150 answer tokens) and returned truncated JSON scoring nothing. The same 12 scenarios as separate paced calls went 12/12 (126–1,717 thinking tokens each). Receipt: `tests/era-gym/AGENT-PACED-2026-10-11.md`.

## Protocol

When the owner does start a pass:

1. **Replay first.** Run the offline replay (no network) to learn which recordings are stale (skipped) or missing; call only for those.
2. **Owner approves one pass**, with the call count and rough duration stated. A second pass needs a new approval.
3. **Fix the question list up front.** No discovering extra scenarios mid-run.
4. **One call per scenario, sequential, ≥ 30 s apart.** Never pack scenarios into one request (thinking tokens count against `maxOutputTokens`). Never parallel.
5. **No retries, no fallback, stop on first error.** Gemini: `generateContentWithFallback({ maxPrimaryAttempts: 1, fallbackModel: "" })`. Claude: `generateClaudeJson({ maxRetries: 0 })`. On 429/5xx/timeout, stop and report.
6. **Lock file** created with `{ flag: "wx" }` before the first call so a crash or repeat run cannot re-spend the pass.
7. **Run in the background; write the receipt incrementally**: per-scenario status, model, in/out/thought tokens, finish reason, ms, raw output → `tests/era-gym/AGENT-<NAME>-<date>.md` + JSON under `recordings/`. Never print the key.
8. **Synthetic inputs only.** No household data, no Supabase, no writes (Hard Rule #26).
9. **Ceilings.** ≤ 500 calls per run (gym cap). Agents never schedule recurring or looped live tests (`/loop`, cron, wakeups).
