---
created: 2026-09-19
updated: 2026-09-19
type: investigation
status: active
owner: Elio
evidence_cutoff: 2026-09-19T15:42Z
---

# Delivery — Token Consumption Investigation (BUD-83, run `r-83dddb67fea9`)

[PM home](<../_index.md>) · Campaign: [Delivery](<../Delivery/Delivery — Master Book.md>)

> Investigation only. No code, policy, accounting or delivery state was changed. No AI worker was launched. All database reads were taken from a **copy** of `.delivery/v2/supervisor.sqlite` (+WAL) in a scratch directory. Evidence labels used below: **[OBS]** observed in a record · **[CODE]** supported by code · **[EST]** estimate, method stated · **[HYP]** hypothesis · **[UNK]** unknown.

---

## 1. Executive summary

1. **The session is identified exactly.** It is BUD-83 ("Show the Split tag in transaction details and remove a pending split"), Delivery V2 run `r-83dddb67fea9`, 2026-09-19. It had two Codex jobs: planning `j-4226b804ec62` and build `j-1facab2c8eaf`. All reported figures reproduce exactly from the stored readings **[OBS]**: 94,110 + 1,630 + 487,742 + 5,694 = **589,176**.
2. **The total formula is right if the raw fields mean what the SDK says.** Delivery computes total = `input + output`. It treats cached input as a subset of input and reasoning as a subset of output **[CODE]**. The UI split into fresh (uncached), cached and output also subtracts correctly **[CODE]**.
3. **The biggest accounting question is still open.** The build job *resumed the planning job's Codex thread*: both have the same native thread ID **[OBS]**. The SDK types document `turn.completed.usage` as usage "during a turn". Delivery stores it that way. Whether Codex 0.144.1's exec layer actually reports a counter that is cumulative for the thread after a resume is **not established [UNK/HYP]**.
   - If the counter is cumulative, the build figure contains the planning figure. The corrected session total would then be **493,436**, not 589,176 (−95,740, 16%).
   - Model fits are ambiguous. The fit depends on whether commentary messages are separate model requests. One artifact would settle it: the Codex rollout file in the run's session volume (§8, Q1).
4. **"Repeated file reading" is not supported as the main cause.** Across both jobs I found one genuinely redundant re-read of unchanged content: 31 lines, about 0.3k tokens **[OBS+EST]**. The other second reads covered different ranges or a file the worker had just edited.
   - The actual mechanism is the agent loop. Every model request re-sends the whole accumulated conversation. By the build, that conversation included the carried-over planning transcript (≈22–27k tokens **[EST]**).
   - The build made ≈11–13 requests **[EST]**, so input volume was roughly 11–13 × (25k → 40k+). 87% of it was served from cache **[OBS]**.
5. **"13 steps" are 13 UI activity rows, not 13 model requests [OBS].** The build rows are 3 messages, 5 commands and 5 edits. They map to about 10 tool calls, so ≈11 requests, or 13 if the commentary messages were standalone requests **[EST]**.
6. **Two build requests were spent on commands that could not work in the container [OBS].**
   - `npm run typecheck` failed: `tsc` is not installed.
   - `git diff --check` / `git diff` failed: `/work` is not a Git repository.
   - As a result, a real defect reached the candidate with nothing in the pipeline able to catch it: `supabaseAdmin.from(...)` is used where `supabaseAdmin().from(...)` is needed **[OBS]**, at candidate `src/app/api/transactions/[id]/route.ts:198` and `:205`.
   - The claimed link between this bug and the run is **confirmed** as a verification gap. It is not a cause of token consumption.
7. **Allowance depletion was not recorded.** The worker reads the ChatGPT subscription usage endpoint before each job. It keeps only booleans and discards `used_percent` **[CODE]**. Whether 589k counter-tokens meaningfully drained the subscription is unknown and cannot be reconstructed.
8. **Budget controls are admission-time only.** The run's allowance was 200k + 200k owner top-up = 400k. Actual usage was 589k (or 493k). Nothing stopped the build mid-job, and `maxTurns: 8` is never passed to Codex **[CODE]**.
9. **Configuration has changed since the run.** DLV-127 (the check-count parser) and DLV-128 (`NO_TEST_RUNS`, owner test gate) landed after it. The run's stored prompts contain neither **[OBS]**.

Provisional fixes, in evidence order (§7):

- **A.** Settle the cumulative-versus-per-turn question from the rollout file, then correct the accounting if needed.
- **B.** Record the subscription `used_percent` before and after each job.
- **C.** Stop sending the plan twice to a resumed thread, and tell the worker `/work` has no Git.
- **D.** Add a deterministic typecheck to the protected checks, outside the model.
- **E.** Run a controlled comparison of resume versus a fresh build thread before changing the handoff.

No percentage savings are claimed.

---

## 2. Exact session and evidence inventory

### 2.1 Identity

| Field | Value | Source |
|---|---|---|
| Run | `r-83dddb67fea9` | `runs` **[OBS]** |
| Work item | BUD-83, work `w-d07d58510aaf`, contract `c-7915297c2fda` rev 1, grant `g-0cb79ad2740c` | `runs`, `grants` |
| Requested change | Split tag in `TransactionDetailModal`; owner may remove a *pending* split; server-side notification dismissal; Undo re-requests | job `request_json.instruction`; Budget Master Book §BUD-83 |
| Date / times | Planning 13:14:45–13:15:35Z; owner approval 15:08:34Z; build 15:08:36–15:10:22Z; checks 15:10:27Z; owner re-check 15:42:08Z | `run_events` seq 41–55 |
| Outcome | `CLOSED / verified_candidate` (result `res-fc5b50822f64@2`); **not applied** (0 rows in `applications`) | `runs`, `applications` |
| Files changed (candidate C1) | 5 files, 182 inserted lines: `[id]/route.ts` +97, `useDashboardTransactions.ts` +39, `TransactionDetailModal.tsx` +24, `splitBill.test.ts` +14, `splitBill.ts` +8 | `git diff --no-index` base vs `%LOCALAPPDATA%/era-delivery-v2/.../generations/r-83dddb67fea9/C1` |

### 2.2 Did a usable plan already exist?

Partly. The BUD-83 criteria in the Budget Master Book already held six acceptance bullets, a race note and an exact **Touches** list of the same five files the plan chose.

The planning job's plan (`plan-4550f66d6194`) mostly restates those criteria as steps. It added:

- Two risks: the balance-delta logic in the generic PATCH, and the RLS ownership of notifications.
- Two unknowns: the cache key and the Undo payload.

What planning also produced was ~13k+ tokens of *file content in the thread*, which the build then reused (§4). So planning was not pure duplication, but its written output largely re-derived an existing specification. **[OBS]**

### 2.3 Execution setup (this run)

| Item | Value | Source |
|---|---|---|
| Backend | `codex-exec-sdk` via `@openai/codex-sdk` **0.144.1** (bundles `@openai/codex` 0.144.1) | `node_modules`, job `effective_json` |
| Requested model / effort | `gpt-5.6-luna` / `low` (the owner overrode the recommendation of `gpt-5.6-sol` / `high`, profile "investigate") | `runs.settings_json.recommendation.overridden = true` |
| Observed model / effort | **Not reported** ("not reported by @openai/codex-sdk 0.144.1 events") | `jobs.effective_json` |
| Auth | ChatGPT subscription login (`forced_login_method = "chatgpt"`). The preflight refuses if paid credits exist (`credits.balance` must be 0). Not API billing. | `scripts/delivery-v2/worker/subscription.mjs:34-39, 92-93` |
| Where the worker ran | Docker container (`era-delivery-v2-worker:subscriptions`, image `sha256:9e0f065b…`), `/work` = run volume, `HOME=/home/era` = run session volume, no host bind mounts, egress via proxy | `worker-boundary.mjs:201-214`; checker receipts `toolchain.image` |
| Workspace | Curated 29-file snapshot (manifest in `runs.base_manifest_json`), including `CLAUDE.md` (39 KB), Budget Master Book (134 KB) and `migrations/db-state.json` (449 KB). **No `AGENTS.md`**, so Codex auto-loaded no repo guidance. None of those three large files was read. | `runs.base_manifest_json`; activity rows |
| Planning job | `j-4226b804ec62`, purpose `investigate`, read-only sandbox, thread `01a0b9ce-23e5-79e3-aec3-a8a614e56f2f` (started) | `jobs` |
| Build job | `j-1facab2c8eaf`, purpose `resume`, `continues_job_id = j-4226b804ec62`, **same thread** `01a0b9ce-…` (`codex.resumeThread`) | `jobs.native_ref`, `settings_json`; `runner.mjs:127`; `adapters/codex.mjs:629` |
| Retries / repairs / compaction / extra agents | None recorded: 1 dispatch per job, 1 usage reading per job, `resets: []`. No sub-agents (Codex exec has none here). Compaction: no evidence either way **[UNK]**; at ~40k context it is unlikely. | `usage_readings`, `observations_json` |
| Reservation | 50,000 tokens per job (the build's basis text also says "Planning reservation", a label inaccuracy) | `jobs.reservation_*` |
| Allowance | Grant 200,000 tokens, `strict: false`. The owner added +100k twice at 15:08:11 and 15:08:13, just before approving the build, for 400k total. | `grants.grant_json`; `run_events` 45–46; `.delivery/v2/allowances.json` |

### 2.4 Configuration now versus at run time

| Aspect | At run time | Now | Evidence |
|---|---|---|---|
| Executor test runs | Build prompt: "run the checks you need" | `NO_TEST_RUNS` appended to both prompts (DLV-128) | stored `request_json.instruction` vs `interaction.mjs:299-300, 313, 334` |
| Oracle count parser | "N of M tests passed" not recognised, so the first check was filed `inconclusive / malformed-observation` | Accepted (DLV-127) | `evidence` e-59450b1b0ddf; Delivery Master Book DLV-127 |
| Owner test gate | Absent | `test-gate.mjs`, which locks the next delivery after an Apply | DLV-128 |
| Token total formula | Computed at read time from stored raw fields, so a later change to the formula does not change stored data | `jobs.mjs:88-90`, `deliveryReviewModel.ts:119-121` | — |

Whether the display formula shown to the owner at 15:10 was already `input + output` cannot be reconstructed. The working tree is uncommitted. It does not matter for the stored raw data. **[UNK, low impact]**

### 2.5 Evidence I could **not** read

- **Codex rollout / session JSONL** for thread `01a0b9ce-…`. It lives in Docker volume `era-v2-r-83dddb67fea9-session` under `/home/era/.codex/sessions/`. The volume also holds the subscription credential file, so I did not open it. It would hold per-request `token_count` events (`last_token_usage` and `total_token_usage`) and full tool outputs. This is **the** missing artifact (§8).
- Raw SDK event stream: the containers were removed. Only activity summaries truncated at ~240 characters remain.
- Subscription usage before and after: never persisted.

---

## 3. Accounting reconciliation

### 3.1 Raw fields (Codex SDK 0.144.1 `Usage`)

From `node_modules/@openai/codex-sdk/dist/index.d.ts:119-129`:

```ts
/** Describes the usage of tokens during a turn. */
type Usage = {
    /** The number of input tokens used during the turn. */
    input_tokens: number;
    /** The number of cached input tokens used during the turn. */
    cached_input_tokens: number;
    /** The number of output tokens used during the turn. */
    output_tokens: number;
    /** The number of reasoning output tokens used during the turn. */
    reasoning_output_tokens: number;
};
```

| Raw field | Meaning (provider / version) | Subset of? | Delivery field | Included in total? |
|---|---|---|---|---|
| `input_tokens` | All prompt tokens across every model request in the Codex *turn* (one `thread.run`) | — | `input` | Yes |
| `cached_input_tokens` | Portion of `input_tokens` served from the prompt cache | **Subset of input** (OpenAI convention; consistent with the data: 425,472 ≤ 487,742; both cached figures are exact multiples of 128) | `cachedInput` | No (would double count) |
| `output_tokens` | Generated tokens, including reasoning | — | `output` | Yes |
| `reasoning_output_tokens` | Reasoning portion of output | **Subset of output** | `reasoningOutput` | No |
| cache creation | **Not reported** by Codex; the adapter hard-codes 0 | n/a | `cacheCreation` = 0 | — |
| monetary cost | **Not reported**; the adapter sets `costUsd: null` deliberately | n/a | `cost_usd` null | — |

The code path is:

1. Adapter: `adapters/codex.mjs:433-434` pushes `{turn, usage: normalizeCodexUsage(event.usage)}` on each `turn.completed`.
2. `mergeUsageReadings` (`codex.mjs:170-196`) keys readings by turn ordinal and replaces duplicates, so a replayed `turn.completed` cannot double count within a job.
3. Stored as one row per `(job_id, reading_key)` (`usage_readings` primary key); re-inserting the same reading is a no-op.
4. Aggregation: `resourceSummary` (`jobs.mjs:146-160, 205-209`) sums raw fields across jobs.
5. Allowance settlement: `normalizedTokenTotal = input + output` (`jobs.mjs:88-90`).
6. UI (`deliveryReviewModel.ts:119-121`):

```ts
const input = Number(t.input || 0);
const cached = Math.min(input, Number(t.cachedInput || 0));
return { fresh: input - cached, cached, output: Number(t.output || 0), total: input + Number(t.output || 0) };
```

Double-counting checks:

- **Within a job:** protected by turn-keyed replacement and the primary key **[CODE]**.
- **Across jobs:** not protected. Each job's reading is summed independently. If a resumed thread reports a thread-cumulative counter, the planning usage is counted twice **[CODE + HYP]**.
- One stray item: `Run.tsx:165-167` (the V1 run view) adds `input + … + cachedInput`, which would double count if it were fed V2 readings. I did not trace whether this path renders V2 runs **[UNK, low]**.

### 3.2 Per-turn or thread-cumulative after resume?

- The SDK documents per-turn usage.
- I could not inspect the 0.144.1 exec binary's source for which counter it emits on `turn.completed` after `resumeThread`. Codex keeps both a last-request and a session-total counter internally; which one feeds the event is the question.
- A cost model from recorded activity (§4.3) fits **both** readings, depending on whether commentary messages are separate requests.
- The earlier comparable run `r-c1d69bb666cf` has the same ambiguity: planning 62,822 input; build 218,910 input with 6 tool calls.

**Status: [UNK], decisive evidence named in Q1.**

### 3.3 Reconciled figures

| Quantity | Formula | Planning `j-4226…` | Build `j-1fac…` | Session |
|---|---|---:|---:|---:|
| Input (all) | `input_tokens` | 94,110 | 487,742 | 581,852 |
| Cached input | `cached_input_tokens` | 65,024 | 425,472 | 490,496 |
| Uncached input | `input − cached` | 29,086 | 62,270 | 91,356 |
| Output (incl. reasoning) | `output_tokens` | 1,630 | 5,694 | 7,324 |
| of which reasoning | `reasoning_output_tokens` | 222 | 1,050 | 1,272 |
| Normalised total | `input + output` | 95,740 | 493,436 | **589,176** |
| Cache share of input | `cached / input` | 69% | 87% | 84% |
| **If** build is thread-cumulative: build-only | `build − planning` per field | — | in 393,632 · cached 360,448 · uncached 33,184 · out 4,064 | **493,436** |

Every reported lead is verified as a stored value, with one caveat: "Planning ≈96k" is 95,740, and "Building ≈493k" is 493,436 as *stored*. Whether 493k is build-only depends on §3.2.

Four quantities, kept separate:

1. **Token volume:** as above.
2. **Delivery internal accounting:** 589,176 settled against a 400,000 run allowance, so overspent by 189,176 with no stop (§5.5).
3. **Monetary cost:** not applicable. This is subscription auth and the SDK reports no cost. No pricing illustration is offered, because any per-token price would be an API price that does not describe subscription consumption.
4. **Subscription allowance consumed:** **not recorded** (§5.6). A large counter, even one 84% cached, does not tell how much of a ChatGPT plan window was used. Cached tokens are not assumed free.

---

## 4. Context, requests and repeated-read analysis

### 4.1 What "13 steps" is

The 13 rows in the `activity` table for `j-1facab2c8eaf` are UI events produced by the adapter from SDK items, not model requests **[OBS]**. The row numbers below are the build's activity row IDs (the "steps"); the request IDs in §4.3 are estimated model calls.

| # | Time (Z) | Kind | Summary (truncated at source) |
|---|---|---|---|
| B0 | 15:08:45 | message | "I'm implementing the approved five-file scope now…" |
| B1 | 15:08:48 | command | `sed -n '100,230p' split-bill/route.ts; sed -n '1000,1060p' useDashboardTransactions.ts; sed -n '125,220p' useDashboardTransactions.ts; rg -n "pending…` (truncated) |
| B2 | 15:08:58 | edit | `splitBill.test.ts`, `splitBill.ts` |
| B3 | 15:09:18 | edit | `[id]/route.ts` |
| B4 | 15:09:32 | edit | `useDashboardTransactions.ts` |
| B5 | 15:09:36 | command | `rg -n 'split-bill|type TransactionUpdateInput|Split removed' …; sed -n '1300,1370p' useDashboardTransactions.ts` |
| B6 | 15:09:46 | edit | `TransactionDetailModal.tsx` |
| B7 | 15:09:52 | command | `sed -n '495,540p' transaction.service.ts; sed -n '45,80p' split-bill/route.ts; cat package.json \| sed -n '1,100p'` |
| B8 | 15:09:58 | edit | `[id]/route.ts` (second edit) |
| B9 | 15:10:02 | message | "The core implementation is in place… via the admin client…" |
| B10 | 15:10:05 | command | `npm test -- --run splitBill.test.ts && node tests/delivery-oracles/bud83-split-removal.mjs /work /tmp/bud83-oracle && npm run typecheck`, where **typecheck failed: `tsc` not installed** |
| B11 | 15:10:12 | command | `git diff --check; git diff --stat; git diff -- …`, where **all failed: `/work` is not a Git repository** |
| B12 | 15:10:21 | message | final summary |

The SDK emitted 26 native events for the build (`nativeEventCount`); the 13 activity rows were derived from them.

Planning had 7 activity rows (P0–P6): 1 message, 5 commands, 1 final JSON. There were 15 native events.

### 4.2 Initial context assembly

| Component | Inserted into prompt? | Size |
|---|---|---|
| Codex base instructions + tool schemas + environment context | Yes, by the Codex CLI, every request | **[UNK]** directly; ≈9–10k tokens **[EST]** from the planning arithmetic in §4.3 |
| Repo guidance (`AGENTS.md`) | **No.** Not present in the snapshot; `CLAUDE.md` is present but Codex does not auto-load it and it was never read | 0 |
| Planning prompt (task, acceptance text, Touches, JSON shape) | Yes | 4,225 characters of request JSON; instruction ≈1.1k tokens **[EST, bytes/4]** |
| Build prompt (instruction + **full plan JSON again**) | Yes, appended to the resumed thread | request 4,585 characters, ≈1.2k tokens **[EST]**. The plan JSON (≈1.5k characters) is **already in the thread** as the planning job's final answer, so it is duplicated. |
| Files in the 29-file snapshot | **Accessible only**, not inserted. The worker reads them with `sed`/`rg`. | — |
| Planning transcript at build start | **Retained in full** because the build resumes the same thread | ≈22–27k tokens **[EST]** |

### 4.3 Request-level reconstruction **[EST]**

Per-request usage is **not recorded**; only one aggregate per job exists. The following is a model, not an observation.

Method:

- Requests ≈ tool calls + 1 final answer. Add standalone commentary messages if the model emitted them as separate responses (unknown).
- Context additions are the byte sizes of the exact file ranges named in the visible commands, measured on the base files, divided by 4. The host files are byte-identical to the run's base manifest (SHA-256 verified).

**Measured context additions from file reads** (visible ranges only; truncated command tails and `rg` outputs are not measurable):

| Step | File / range | Chars | ≈Tokens |
|---|---|---:|---:|
| P2 | `splitBill.ts` 1–260 (whole file, 92 lines) | 2,901 | 725 |
| P2 | `splitBill.test.ts` 1–300 (whole, 91 lines) | 2,375 | 594 |
| P2 | `[id]/route.ts` 1–340 (of 467) | 10,224 | 2,556 |
| P4 | `TransactionDetailModal.tsx` 1–180 | 5,670 | 1,418 |
| P4 | `useDashboardTransactions.ts` 320–410 | 2,997 | 749 |
| P4 | `useDashboardTransactions.ts` 1030–1135 | 3,479 | 870 |
| P4 | (4th command truncated `sed -n '1,…'`) | ? | ? |
| P5 | `useDashboardTransactions.ts` 50–125 | 2,544 | 636 |
| P5 | `useDashboardTransactions.ts` 1180–1346 (to EOF) | 5,849 | 1,462 |
| B1 | `split-bill/route.ts` 100–230 | 3,900 | 975 |
| B1 | `useDashboardTransactions.ts` 1000–1060 | 2,234 | 559 |
| B1 | `useDashboardTransactions.ts` 125–220 | 3,321 | 830 |
| B5 | `useDashboardTransactions.ts` (edited) 1300–1370 | 2,614 | 654 |
| B7 | `transaction.service.ts` 495–540 | 1,786 | 447 |
| B7 | `split-bill/route.ts` 45–80 | 1,242 | 311 |
| B7 | `package.json` 1–100 | 3,829 | 957 |
| | **Measured total, both jobs** (planning ≈9.0k, build ≈4.7k) | **54,965** | **≈13.7k** |

The candidate diff is 10.8k characters ≈ 2.7k tokens. It entered context as patch *output* (B2–B8), not via `git diff`, which failed.

**Planning fit.** 6–7 requests. Additions accumulate roughly 0 → 0.1 → 4.0 → 6 → 9.5 → 12.5k. Solving `94,110 ≈ n·B + Σadditions` gives a base context B ≈ 9–10k and an end-of-planning context ≈ 22–27k.

**Build fit.** 10 tool calls (B1, B2, B3, B4, B5, B6, B7, B8, B10, B11) + final = **11 requests**, or **13** if B0/B9 were standalone responses.

| Hypothesis | Build input to explain | Requests | Implied mean context/request | Plausible? |
|---|---:|---:|---:|---|
| H-turn (per-turn counter) | 487,742 | 11 | 44.3k | Needs start ≈35k+; high vs. the ≈26k start estimate |
| H-turn | 487,742 | 13 | 37.5k | Fits: start ≈26k, growing to ≈45–48k |
| H-cumulative (includes planning) | 393,632 | 11 | 35.8k | Fits: start ≈26k to ≈42k |
| H-cumulative | 393,632 | 13 | 30.3k | Fits loosely |

Uncached input is a partial discriminator:

- Under H-turn, 62,270 uncached = the first build request (≈26k; the cache is likely cold after a 1 h 53 min gap) + ≈19k of new content + ≈17k of cache misses. This is plausible.
- Under H-cumulative, only 33,184 uncached remains for build. That requires most of the first build request to be a cache hit after nearly 2 hours, which is less plausible. It also cannot be excluded without knowing the ChatGPT backend's cache retention **[UNK]**.

**Conclusion:** undetermined. The report does not choose between these.

**What is robust under either hypothesis [EST]:** the dominant term is *context re-sent per request*.

- The retained planning transcript alone (≈22–27k) re-sent on ≈11–13 build requests is ≈240–350k tokens of input volume. That is 50–70% of 487k, or 60–90% of 393k.
- Build-specific reads (≈4.7k) and patches (≈2.7k of output) are small by comparison.

### 4.4 Repeated-read table

| File / range | Reads | Content changed between reads? | Justified? |
|---|---|---|---|
| `useDashboardTransactions.ts` 1030–1060 | 2 (P4 as part of 1030–1135; B1 as part of 1000–1060) | No | **No.** Already in the resumed thread. ≈31 lines ≈0.3k tokens. |
| `useDashboardTransactions.ts` ~1300–1346 | 2 (P5 1180–1346; B5 1300–1370) | **Yes** (edited at B4; lines shifted) | Yes: post-edit verification |
| `split-bill/route.ts` | 2 (B1 100–230; B7 45–80) | No | Yes: disjoint ranges. (P4's truncated 4th command might also have read it **[UNK]**.) |
| `[id]/route.ts` | 1 read (P2, lines 1–340), 2 edits | — | Not re-read |
| `package.json` | 1 (B7) | — | Read to find scripts; the worker still ran a `typecheck` that could not work |
| `CLAUDE.md`, Master Book, `db-state.json` | 0 | — | Present in snapshot, never read |

**Verdict:** the "repeated file reading" attribution is **not supported**. Measured redundancy is ≈0.3k tokens of content. Even re-sent on every later request, that is ≈3k tokens of volume.

### 4.5 Failed or redundant actions

| Step | Action | Cost | Cause |
|---|---|---|---|
| B10 (typecheck part) | `npm run typecheck` fails, `tsc` absent | Part of one request's output. The chained tests passed first. | Worker image / dependency volume lacks TypeScript; the prompt said "run the checks you need" |
| B11 | `git diff --check / --stat / git diff` all fail | **One full request** (≈40–48k context re-sent) plus the final answer reflecting the failure | `/work` is deliberately a metadata-free snapshot (`skipGitRepoCheck`, `codex.mjs` comments), but the prompt does not say so |
| Build prompt | Plan JSON re-sent inside the resumed thread | ≈0.4k tokens × 11–13 requests ≈ 5k volume | `interaction.mjs:338-339` appends `JSON.stringify(plan.body)` even on resume |

---

## 5. Current execution and verification setup

### 5.1 Flow

1. **Deliver (planning):** a read-only Codex job in a container runs over the snapshot volume and returns plan JSON.
2. The owner approves the plan (and here also topped up the allowance).
3. **Resume (build):** a write job resumes **the same Codex thread**. It edits `/work`, and the candidate is frozen (`candidate.frozen`, generation C1, 5 changed files).
4. **Protected checks** run in a separate `--rm` container against the read-only candidate volume, with no network. They use the declared criteria: `tests/delivery-oracles/bud83-split-removal.mjs` and `vitest run src/lib/utils/splitBill.test.ts`. Stdout and stderr are **hashed, not stored**, and are **not** fed back to the model. No repair loop runs (`repairDispatchLimit: 1`, `retryAutomatically: false`, Focused prompt "do not start an automatic repair loop").
5. Result recorded. At the time, the oracle was filed `inconclusive / malformed-observation` although it exited 0. After the DLV-127 parser fix, the owner's `recheck` at 15:42 produced `verified_candidate`.
6. **Apply:** an owner-triggered protected Apply. It was not executed for this run.

### 5.2 What the worker can reach

- `/work` (snapshot; read-only for planning, writable for build), its own `HOME` session volume, and `/deps` (read-only dependency volume, which is where vitest came from).
- Network is limited to the egress proxy allowlist.
- No Git metadata. No `tsc` was observed.

### 5.3 Checks during this run

| Check | Where | Result | Failure cause |
|---|---|---|---|
| `splitBill.test.ts` (worker) | In model loop | 12 passed | — |
| Oracle (worker) | In model loop | 6/6 | — |
| `npm run typecheck` (worker) | In model loop | Failed | Missing tooling (environment) |
| `git diff --check` (worker) | In model loop | Failed | No Git in snapshot (environment) |
| Oracle (protected) 15:10 | Outside model | exit 0, filed **inconclusive** | Result parsing (fixed by DLV-127) |
| Oracle + `splitBill` (protected) 15:42 | Outside model | satisfied (6/6, 12/12) | — |
| **Typecheck (protected)** | — | **Never run.** Not a declared criterion. | Pipeline gap |

### 5.4 The supabaseAdmin defect

Candidate `src/app/api/transactions/[id]/route.ts`:

```ts
198:        await supabaseAdmin
199:          .from("notifications")
…
205:        await supabaseAdmin.from("notifications").insert({
```

`src/lib/supabase/admin.ts` exports `supabaseAdmin()` as a **function**, and the same file uses it correctly at `:478` (`const adminClient = supabaseAdmin();`).

- TypeScript would reject `.from` on the function (TS2339).
- At runtime it throws a `TypeError` *after* the split fields have already been updated. The remove and undo requests would then return 500 with the notification side effect missing.

**Established:**

- The defect exists in the candidate **[OBS]**.
- The worker's only typecheck attempt failed for environmental reasons **[OBS]**.
- No protected check could catch it **[OBS]**.
- The Delivery Master Book DLV-127 entry already states this **[OBS]**.

**Not established:** any link between this defect and token consumption. It is a verification-coverage finding, not a consumption finding.

### 5.5 The DLV-128 test gate (current, post-run)

- **Implemented** (`scripts/delivery-v2/test-gate.mjs`, `TestGate.tsx`); not proposed. No `test-gate.json` exists yet, so it has never been exercised.
- The owner runs tests on the **laptop working tree after Apply**. That tree also contains unrelated uncommitted work (see `git status`). So the gate validates *checkout + candidate*, not the exact candidate.
- It controls **the next delivery** (refusal `tests-unconfirmed`), not the current Apply.
- It is invalidated per application: records are keyed by `application_id`, and a stale ID is refused. File changes after recording do **not** invalidate a "passed" record **[CODE, `test-gate.mjs:45-58, 71`]**.
- "Failed" unlocks only with an explicit Proceed, which is recorded. A candidate therefore cannot be silently relabelled verified. `verified_candidate` still means "protected criteria satisfied", which did not include a typecheck.
- `NO_TEST_RUNS` stops the model from running tests. It removes the failed-typecheck request class, and also the worker's own passing signals (the tests and oracle at B10).

### 5.6 Budget controls

| Control | Real behaviour | Evidence |
|---|---|---|
| Per-job reservation | 50,000 tokens, fixed, same for plan and build | `execution-policy.json resources.perJobReservation` |
| Run allowance | 200,000 (`strict: false`) + owner top-ups; checked at **admission/dispatch** as settled + reserved + next ≤ allowance | `jobs.mjs:240-265`; `allowances.mjs` header: "A native job that is already running is not interrupted (qualified in-job stopping is DLV-114)" |
| `maxTurns` / `thresholdUsd` | Stored in `native_limits` (8 / null); used only by the **Claude** adapter. Not passed to Codex, whose SDK has no such option. A Codex "turn" is the whole job anyway. | `claude.mjs:243, 670`; no reference in `adapters/codex.mjs` |
| Warnings / stop thresholds | None mid-job. Accounting is **completion-only**: one reading after `turn.completed`. | `usage_readings` 1 row per job |
| Subscription preflight | Refuses if paid credits are enabled or a window is ≥100% used; `used_percent` is read, then **discarded** | `subscription.mjs:34-39` returns only `{method, additionalSpendAllowed, includedUsageAvailable}` |

Result for this run: 589,176 settled against 400,000. The build's 50k reservation under-predicted its own usage by ~10×. Nothing warned or stopped it.

---

## 6. Confirmed findings versus hypotheses

| # | Finding | Status | Affects |
|---|---|---|---|
| F1 | Reported figures equal the stored readings; the total is `input + output`; cached ⊂ input and reasoning ⊂ output are handled correctly in V2 aggregation and UI | **Confirmed** | Accounting |
| F2 | Build resumed the planning thread; the full planning transcript is carried into every build request | **Confirmed** | Consumption |
| F3 | Build usage may include planning usage (thread-cumulative counter after resume), so the session is overstated by 95,740 | **Hypothesis**, undetermined by modelling | Accounting |
| F4 | Main consumption driver is per-request re-sending of accumulated context (≈11–13 build requests over a 25k→45k context), not repeated reads | **Confirmed in mechanism; magnitudes estimated** | Consumption |
| F5 | Only one genuinely redundant re-read (≈0.3k tokens) | **Confirmed** (visible ranges); truncated commands **[UNK]** | Consumption (negligible) |
| F6 | Two build requests or partial requests were spent on impossible commands (typecheck, git) | **Confirmed** | Consumption, reliability |
| F7 | Plan JSON sent twice to the resumed thread | **Confirmed**; small (≈5k volume) | Consumption |
| F8 | No typecheck anywhere in the verification pipeline let a TS2339/runtime defect through as `verified_candidate` | **Confirmed** | Reliability |
| F9 | Subscription allowance consumption not observable: `used_percent` discarded | **Confirmed** | Accounting (allowance) |
| F10 | Allowance and reservation are admission-only; `maxTurns` is inert for Codex; the build overshot the allowance by 189k unnoticed until completion | **Confirmed** | Control |
| F11 | Planning largely restated an already-detailed specification | **Confirmed** (content comparison); value of its file reads to the build **[UNK]** | Consumption |
| F12 | Observed model and effort are unverifiable on Codex 0.144.1 | **Confirmed** | Accounting provenance |

---

## 7. Provisional minimal fix plan and validation approach

Ranked by evidence × impact. None of these are implemented.

**A. Settle F3, then correct the accounting if needed (evidence: the missing rollout file).**

- **Change:**
  1. Extract the `token_count` events from the run's rollout JSONL (Q1).
  2. If `turn.completed` is thread-cumulative after resume, store a resume job's reading as a delta against the parent job's final reading. Keep the raw value in the stored `note`.
- **Affects:** displayed and settled accounting only; not consumption.
- **Trade-off:** it depends on version-specific CLI behaviour, so pin it to 0.144.1 with a fixture test.
- **Verify:** the sum of per-request `last_token_usage` from the rollout equals the stored build reading, or the build reading minus planning.

**B. Record subscription usage before and after each job (F9).**

- **Change:** persist `primary_window.used_percent` / `secondary_window.used_percent` (and the Claude equivalent) from the existing preflight response on the job, and take one read-only probe after completion.
- **Affects:** allowance observability.
- **Trade-off:** percent windows are coarse and shared with the owner's other Codex use, so attribute only when nothing else ran.
- **Verify:** two recorded values bracket each job; the display labels them "plan window, not tokens".

**C. Remove known-waste requests (F6, F7).**

- **Change:**
  1. On `resume`, send the plan by revision reference instead of the full JSON (it is already in the thread). Keep full JSON when starting a fresh thread.
  2. Add one clause to the build prompt: "`/work` has no Git metadata; do not run git."
- `NO_TEST_RUNS` already covers typecheck.
- **Affects:** consumption (small), reliability.
- **Trade-off:** a plan reference relies on the thread still holding it. If compaction ever occurs, the plan could be summarised away, so keep the full JSON when the thread was compacted or the plan revision changed.
- **Verify:** stored build instructions differ as intended, and the activity of the next comparable run shows no `git` commands.

**D. Put a deterministic typecheck outside the model (F8).**

- **Change:** add a protected criterion that runs `tsc --noEmit` (project config) against the frozen candidate in the checker container. This needs `typescript` in the `/deps` volume. Its output is hashed like the others and is not fed to the model.
- **Affects:** reliability. It would have caught the `supabaseAdmin.from` defect. No model tokens.
- **Trade-off:** checker runtime. A full-project `tsc` may surface pre-existing errors unrelated to the candidate, so compare against a baseline run on the base snapshot and count only new diagnostics.
- **Verify:** re-run the checks on candidate C1 of this run; the new criterion must report the TS2339 at `:198/:205`.

**E. Resume versus fresh build thread: experiment first, no change yet (F2, F4, F11).**

- Resuming carries ≈25k of planning context into every build request. A fresh thread carries only the plan, ≈1.5k, but may re-read files.
- The evidence does not show which is cheaper for this task class. Do not switch on the basis of this report.

**F. Budget control honesty (F10).**

- **Change:**
  1. Stop showing `maxTurns` as a limit for Codex.
  2. Size the build reservation from the plan job's measured usage (e.g. a multiple of it) instead of a flat 50k.
- **Affects:** control accuracy, not consumption.
- **Trade-off:** it is still admission-only; in-job stopping remains DLV-114.

**Validation experiment (owner-approved, not executed).**

- Pick two BUD/SCH items of comparable size to BUD-83: 4–6 files, detailed criteria, one protected oracle each.
- For each item, run twice with identical model, effort, snapshot and criteria:
  1. **Current** (resume thread, plan JSON re-sent).
  2. **Variant**: fresh build thread with plan JSON + plan-job file list, plus the no-Git clause.
- Before each run, apply fix A's measurement (rollout extraction) and fix B's bracket.
- Measure:
  1. Per-request tokens (from the rollout).
  2. Uncached input, cached input and output separately.
  3. Subscription `used_percent` delta.
  4. Protected-criteria outcome **including the new typecheck (D)**.
  5. Owner review verdict.
- Acceptance: the variant is adopted only if outcomes are equal or better on all quality measures and uncached input plus output is lower on both items. Otherwise keep resume.

---

## 8. Missing evidence and questions for the owner

**Missing evidence (with how to obtain it without exposing credentials)**

- **Q1 — rollout file (decisive for F3 and the per-request table).** You can run a command that copies only the `token_count` lines, not `auth.json`. Paste the output, or save it to a file and point me to it:
  ```
  docker run --rm --network none --mount type=volume,source=era-v2-r-83dddb67fea9-session,target=/s,readonly era-delivery-v2-worker:subscriptions sh -c 'f=$(find /s/.codex/sessions -name "*01a0b9ce-23e5-79e3-aec3-a8a614e56f2f*.jsonl"); grep -c . "$f"; grep "\"token_count\"" "$f"'
  ```
  Also useful: the same file filtered to `"type":"function_call_output"` with only the output lengths, to measure the `rg` and truncated-command outputs.
- **Codex base prompt size:** it would come out of the same rollout (the first request's `last_token_usage.input_tokens`).
- **Cache retention of the ChatGPT backend:** not documented in the repo. It affects how much of a resumed build can be cached after a long owner pause (here 1 h 53 min).

**Questions only you can answer**

1. Did your ChatGPT/Codex plan usage visibly drop around 13:14–15:11Z on 2026-09-19, for example on the usage page? By roughly how much, and was anything else using Codex then?
2. Why did you add +200k before approving the build? Was an admission refused or a warning shown, or was it pre-emptive? The stored numbers (95,740 settled + 50,000 reserved < 200,000) do not require it.
3. Checks: do you prefer automatic protected typecheck (D) as part of every delivery, or manual laptop checks after Apply (the current DLV-128 gate), or both?
4. Do you authorise bounded repair attempts? For example, one automatic repair dispatch when a *protected* check fails, with only the failing check's summary fed back. Current policy is no automatic repair.
5. Should Focused delivery skip model planning when the criteria already contain acceptance plus an exact Touches list, as BUD-83 did? Keep in mind that planning's file reads were reused by the build. Answering "yes" is a candidate for the experiment in §7, not a decided change.
6. Do you approve the validation experiment in §7 (four paid runs on two items) once A and B are in place?
