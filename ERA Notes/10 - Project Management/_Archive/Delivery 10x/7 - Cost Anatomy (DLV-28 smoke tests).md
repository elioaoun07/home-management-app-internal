---
created: 2026-07-25
updated: 2026-07-25
type: postmortem
status: living
owner: Elio
tags: [pm/postmortem, tooling/delivery, tooling/cost]
---

# Cost Anatomy — what a delivery session actually spends money on

> **What this file is:** a forensic answer to the owner's question after the D3 smoke test — *"isn't this cost immensely inflated? I used FAST lane and the cheapest model at low effort. Will it scale exponentially on complex tasks?"*
>
> **Short answer:** the dollars are real, ~90% of them were overhead rather than work, the scaling is **quadratic in turn count rather than exponential**, and the per-turn constant is currently several times larger than it needs to be. The single largest saving is not making the pipeline cheaper — it is **not running trivial work through it at all** (§7).

---

## 1. What was measured

Four real sessions on disk, plus the raw Agent SDK transcripts under `~/.claude/projects/`. Three of them are an unusually clean experiment: **the same trivial one-line documentation edit (DLV-28), run three times**, on FAST lane / `claude-haiku-4-5` / low effort throughout. Task size was held constant; only how far each session travelled varied.

Method: `state.json` usage totals and `transcript/turns.ndjson` per turn, reconciled against the SDK's own per-request `usage` objects and `total_cost_usd`.

---

## 2. Cost tracked traversal, not work

| Session | Turns | Reached | Recorded tokens | Cost |
|---|---|---|---|---|
| `s-20260725-151324-23aw` | 3 | PLAN_READY | 300,645 | $0.60 |
| `s-20260725-154808-p1im` | 9 | UAT_READY | 1,803,223 | $1.95 |
| `s-20260725-181118-xdl9` | 13 | ACCEPTED | 2,386,471 | $2.40 |
| `s-20260722-225601-whdv` (BUD-11 — a genuine 25-file refactor) | 16 | BLOCKED | 8,805,293 | $2.91 |

The first three rows are the **same one-line doc edit**. Cost rose 4x across them purely as a function of how many phases and turns each traversed. Note the fourth row: a real cross-module refactor cost only 21% more than the trivial task that completed. **Spend is dominated by pipeline traversal, not by the difficulty of the work.**

---

## 3. Where the money goes — cache writes, not thinking

Exact reconstruction of one DISCOVERY phase (`23aw`), matching the recorded `costUsd` to seven decimal places:

| Bucket | Tokens | Rate | Cost |
|---|---|---|---|
| input | 47 | $1.00/MTok | $0.000047 |
| cache **read** | 223,480 | $0.10/MTok | $0.022348 |
| cache **creation** — *recorded nowhere in the system* | **140,438** | **$2.00/MTok** | **$0.280876** |
| output | 4,234 | $5.00/MTok | $0.021170 |
| | | **total** | **$0.324441** ✓ |

**86.6% of that phase's cost sits in a token bucket the delivery system does not record.**

Across the whole session: **294,337 cache reads vs 270,774 cache writes** — almost 1:1. The context prefix is being *rewritten* at $2.00/MTok when it could be *read* at $0.10/MTok. That is a **20x premium, paid on nearly every turn boundary**. Cache reads are the cheap, intended path; this session barely used it.

The reason the write rate is $2.00 rather than the more familiar $1.25: Claude Code uses the **1-hour** cache TTL (every raw usage object reads `cache_creation: {ephemeral_1h_input_tokens: N, ephemeral_5m_input_tokens: 0}`). The 1h write rate is 2x base input, not 1.25x.

---

> [!warning] **Correction, 2026-07-30 (DLV-47) — §3, §4 and §5 overstate real volume.**
> Every "actual" figure below was derived by summing usage-bearing records in Claude Code's raw
> `~/.claude/projects/<slug>/<id>.jsonl`. **That file repeats each assistant record.** In the
> 2026-07-30 BUD-14 session it wrote **12 usage-bearing records for only 5 unique `message.id`s**
> (one id appeared four times), so a naive sum double-counts real API calls — measured inflation on
> that session: **2.08x**.
>
> Deduplicated by `message.id`, that session's raw totals (`input 34 / cachedRead 106,165 /
> cacheCreation 41,753 / output 1,808`) match what `state.usage` recorded to the token. So after
> DLV-37 the delivery system's accounting fidelity is **100%**, not the 1.9x under-report claimed in
> §4 — the under-report §4 measured was real *before* DLV-37 (cache creation genuinely went
> unrecorded), but the "actual" it was compared against was itself inflated, so the stated ratio is
> not trustworthy. The 2026-07-29 failed session likewise cost **$0.1026 / 210,193 tok**, not the
> ~$0.34 / 512,752 tok recorded in DLV-43 and the smoke-test log.
>
> The *structural* conclusions of §5–§7 (traversal dominates work; scaling is quadratic in turn
> count; the pipeline's economics are bad at the trivial end) are unaffected — they rest on ratios
> between sessions measured the same way. Only absolute token/dollar figures sourced from raw-record
> sums are suspect. `node scripts/delivery/smoke-launch.mjs cost --id <session>` now reports the
> deduplicated reconciliation directly.

## 4. Three token numbers exist, and none of them is true

For session `xdl9`:

| Surface | Reports | What it actually counts |
|---|---|---|
| Session header chip | `34,490 tok` | input + output **only** |
| Usage panel | `2,386,471` | + cache read |
| Reality | higher still | + cache creation (never recorded) |

On `23aw`, where the raw transcript allows an exact check: recorded 300,645 vs actual **571,419** — the system under-reports real processed volume by **1.9x**.

Two consequences that matter beyond reporting aesthetics:

- **Every `maxTokens` cap is roughly 2x looser than authorized.** `totalProcessedTokens()` sums `input + cachedInput + output` and omits creation entirely.
- **`.delivery/config.json` prices `cacheWritePerMTok` at the 5-minute rate** (1.25x input) for all three models, while the runtime bills the 1-hour rate (2x). The catalog is **37.5% low on the single dominant cost bucket**.

→ **DLV-37**

---

## 5. The 140x estimate gap

The pre-launch flight-check estimated **17,040 tokens**. The session processed **2,386,471** — and that figure is itself an undercount (§4).

The estimator sums the byte length of six named files, divides by four, and stops. It models **one** context load. Ranked causes of the gap:

| # | Cause | Share | Item |
|---|---|---|---|
| 1 | **Context never rotates.** `decideContextStrategy()` in `context-policy.mjs` is never imported by the runner — only by its own unit test — so `rotateAtTokens: 150000` is dead code. One SDK session spans all five phases; context grows ~14K → 100K+ and every later call pays the peak. The REVIEWING turn alone read 870,008 cached tokens. | ~45% | DLV-30 |
| 2 | **Nested multiplication.** 13 runner turns became ~40 internal model calls (`Σ num_turns`), each a fresh `query()` subprocess re-establishing system prompt, tool definitions, `CLAUDE.md` and the replayed history. Turn 7 is the clearest case: one model call, **zero** tool uses, 96,535 input tokens. | ~25% | DLV-6 |
| 3 | **Accumulated tool output replayed forever.** DISCOVERY wrote an 86KB transcript shard (~21K tokens) that was replayed on all 36 subsequent calls. | ~15% | DLV-8 |
| 4 | **Per-spawn fixed overhead** — see §6. | ~10% | **DLV-33** ✅ |
| 5 | **The full packet JSON is embedded in every prompt** — 3,883 of each prompt's 4,047 tokens, i.e. 96% of prompt text. It even contains the context-manifest estimate itself, so the estimate is re-transmitted every turn. | ~3% | DLV-8 |

→ **DLV-38** for the estimator itself.

---

## 6. What was fixed (DLV-33) and what it measured

Three SDK options were unset in `buildSessionOptions`, and every default is "load everything":

- **`strictMcpConfig`** — unset meant project `.mcp.json`, user-settings MCP, plugins and cloud connectors all attached. Observed in `xdl9`: **16–36 MCP tools (Gmail, Supabase, Chrome) on 10 of 13 turns, none ever invoked.** A readonly DISCOVERY turn carried 16 Gmail label-management tools. `options.tools` never filtered these — it is the *built-in* allowlist only, which is why the existing `["Read","Grep","Glob"]` restriction did not keep them out.
- **`skills`** — unset means "CLI defaults apply", injecting all 16 repo skill descriptions into every system prompt. Prompts already reference skills *by path*, so the agent reads what it needs; the descriptions were pure overhead.
- **No build-mode tool allowlist** — the build branch set `disallowedTools: []` with no `tools`, so BUILDING (the most expensive phase) advertised every built-in the CLI ships.

Measured with `scripts/delivery/probe-overhead.mjs` (**DLV-35**) — one `maxTurns: 1` query that does no work, reporting what a spawn costs merely to exist:

| Mode | Tools advertised | Fixed overhead | Cost/spawn |
|---|---|---|---|
| readonly — before | 4 | 15,795 tok | $0.031755 |
| readonly — after | 3 | **14,782 tok** | $0.030234 |
| build — before | 31 | 28,331 tok | $0.057957 |
| build — after | 7 | **19,040 tok** | $0.038550 |

**BUILDING sheds 9,291 tokens (−32.8%) per spawn; readonly sheds 1,013 (−6.4%).** Multiplied across ~40 model calls, this is roughly **8–9% of a session like `xdl9`** — and it is fixed cost, so it is paid whether the task is trivial or enormous.

The readonly delta also settled an open question: the ~1,013 tokens saved is almost exactly 16 skill descriptions plus the now-unnecessary `Skill` tool, confirming **`skills: []` is honoured as "none"** rather than being coerced to "omitted".

> **Honest limitation.** The probe reported **0 MCP tools in both variants**, so it did *not* reproduce the MCP attachment seen in real sessions. Connectors attach asynchronously and a single fast turn completes first (the same race that produced the 4↔20 tool-count flapping in `xdl9`). `strictMcpConfig: true` plus `mcp__*` in `disallowedTools` is therefore a **correctness guarantee whose token saving remains unverified by this probe** — the real-session evidence for the waste is in `events.ndjson`, not here. Treat the 8–9% as the measured floor.

---

## 7. Does it scale? — and when NOT to use delivery

**The scaling model.** Each model call pays a fixed overhead plus the accumulated conversation so far:

```
total ≈ (calls × fixed_overhead) + (calls² × growth_per_call)
```

That is **quadratic in turn count, not exponential**. Complexity does not compound multiplicatively; it lengthens the session, and length is squared. A task needing 3x the turns costs roughly 9x — steep, but bounded and predictable.

**The reassuring half:** fixed overhead is identical whether the task is trivial or enormous. On a one-line doc edit it is ~100% waste; on a real refactor it amortizes. This is exactly why BUD-11 — a 25-file cross-module migration — cost only $2.91 against $2.40 for a one-line edit. **The pipeline's economics are bad specifically at the trivial end, and reasonable at the complex end.** The owner's instinct that "it's worth it for complex work" is correct and is now supported by measurement.

**The routing rule.** The pipeline's ~$0.50–$2.00 floor buys: three human gates, evidence-gated validation, a resumable finish package, artifact-first audit trail, and guardrails that have held 100% across every session. That is worth paying for.

| Route directly (skip delivery) | Use delivery |
|---|---|
| S-effort, single file, no risk flags | M/L effort, or multi-file |
| Docs, comments, copy, config values | Money, schedule, migrations, auth/RLS |
| Changes you could review in one glance | Changes where you want a spec and plan **before** any edit |
| Anything where the pipeline's floor exceeds the value of the work | Anything where an unattended wrong answer is expensive |

A one-line doc edit costs ~$0.02 done directly and $2.40 through the pipeline — a **~100x premium for no added confidence**, because a change that trivial cannot fail in an interesting way. Reserve the pipeline for work where its confidence is the point.

This is input to **DLV-6** lane design, not a new mechanism: FAST already exists as a lane, and the honest conclusion is that *some work should not enter a lane at all*.

---

## 8. Fix ledger

| Finding | Status | Expected saving | Confidence |
|---|---|---|---|
| **FAST's mandated reading list made its own turn cap unreachable** — 4 campaign docs + every skill + CLAUDE.md ≈ 8 tool calls and ~33,151 tokens before any work, against `maxInternalTurns: 8`. DISCOVERY could not finish in this lane at all. | ✅ **DLV-45** shipped 2026-07-30 | 29% fewer tokens on DISCOVERY, and the phase now completes | **measured** (149,760 tok / $0.1048 vs a prior run that produced nothing) |
| **Raw-transcript sums double-count** — 12 records / 5 unique `message.id`s. Invalidates the absolute figures in §3–§5; recorded usage is in fact exact. | ✅ **DLV-47** shipped 2026-07-30 | — (correctness) | **measured** |
| **`pnpm lint` OOM'd rather than failing** (452 s, exit 134) because flat config ignored no build output; `.next` alone = ~5,130 files. Made every launch baseline red and cost 7.5 min per preflight. | ✅ **DLV-46** shipped 2026-07-30 | 32x faster preflight lint | **measured** (452 s → 14 s) |
| Per-spawn overhead floor (MCP, skills, build allowlist) | ✅ **DLV-33** shipped 2026-07-25 | 8–9% | **measured** |
| Overhead probe script | ✅ **DLV-35** shipped 2026-07-25 | — | tool |
| Phase-boundary context rotation | queued **DLV-30** | ~45% | high, from turn-level data |
| Drivers survive a rotation | queued **DLV-31** | — (bug) | certain |
| Owner guidance reaches every phase | queued **DLV-32** | — (bug) | certain |
| Handoff completes on the new provider | queued **DLV-34** | — (bug) | certain |
| `settingSources: []` + compact doctrine block | queued **DLV-36** | ~10% (≈10.2K tok/spawn) | high |
| Usage accounting truth | queued **DLV-37** | — (correctness) | certain |
| Flight-check estimator honesty | queued **DLV-38** | — (correctness) | certain |

`maxPlanSteps` enforcement is deliberately **not** queued: once DLV-30 lands, N build steps stop being N full-context replays, so the problem it addresses may substantially dissolve. Re-measure before changing owner-facing flow.

---

## 9. Bugs found incidentally

None of these are cost bugs; all three were surfaced by reading the machinery closely enough to explain the cost.

1. **Drivers cannot restart after a rotation** (**DLV-31**). `startSession` throws `"session already started"` on an already-started instance, and nothing ever resets that flag. Every code path that nulls the ref — the owner `rotate` control and the quota-paused retry — therefore **blocks the session on its next turn**. The existing rotation test passes only because it hands a *fresh* fake driver to the post-rotation tick, which is precisely the case that hides the bug.
2. **Owner guidance is dropped outside DISCOVERY** (**DLV-32**). `state.pendingGuidance` is read by exactly one call site. An answer to a question raised during BUILDING or REVIEWING never reaches any prompt, and a **UAT rejection note is never written as guidance at all** — it lands only in the ledger. Owner-visible as *"I answered and it ignored me."*
3. **Provider handoff completes on the wrong driver** (**DLV-34**). `performHandoff` runs verification on a locally-created driver instance but writes back only its `ref`, so subsequent turns resume the *new* provider's ref on the *old* provider's driver.

---

## Where this fits

- Campaign index: [_index](<_index.md>)
- Evidence for the sessions themselves: [5 · Session Postmortem](<5 - Session Postmortem (s-20260722-225601-whdv).md>)
- The items this file generated: [4 · Checklist](<4 - Checklist.md>) (DLV-30…38)
