---
created: 2026-07-11
updated: 2026-08-01
type: master-book
status: active
owner: Elio
consolidates: "Agentic Delivery Workspace (base architecture), Delivery Workspace (DW durable-memory layer), Delivery 10x (_index, 1 - Feature State, 2 - Vision & Architecture, 3 - Action Plan, 5 - Session Postmortem, 6 - Design Debates, 7 - Cost Anatomy) — originals in ../_Archive/"
tags:
  - pm/master-book
  - tooling/delivery
---

# Delivery — Master Book

> **Campaign:** Delivery · prefix `DLV` (`DW` retired, IDs never reused) · working queue → [4 · Checklist](<4 - Checklist.md>)
> **What this file is:** the single consolidated record for the agentic Delivery system — the base architecture, the durable-memory layer, the governance campaign, the smoke-test forensics, the design debates, and the cost anatomy.

## Identity & North Star

Delivery is the agentic execution system: the owner picks a PM checklist item, and a governed session drives it from discovery through spec, plan, build, validation, review and UAT — with three human gates, artifact-first persistence, and hard guardrails.

**North star:** *a system the owner can govern* — budget limiters set from the owner's side before a token is spent, right-sized delivery lanes, a scope contract that cannot silently inflate, and a truthful-finish contract so every session ends in a deliberate, honest, recoverable state.

**Source:** `scripts/delivery/` (state machine, packet, classifier, drivers, controls, budgets, validation, transcript, memory, context assembly, server routes, run-session), `scripts/pm/src/features/delivery/` (desktop UI), `scripts/pm/bridge.mjs` (mobile relay), `src/features/pm-live/` + `src/components/pm-live/` (the phone app). Session state lives on disk under `.delivery/sessions/<id>/`.

### The owner non-negotiables (locked 2026-07-11, unchanged)

- **No git writes, ever.** Worktrees banned permanently; the read-only allowlist plus post-turn HEAD/ref guards enforce it.
- **Never `bypassPermissions`.** `assertNeverBypass` in the Claude driver.
- **`agent-registry.mjs` is the single source of truth** for the Agent Catalog.
- **Always three human gates** — `SPEC_READY`, `PLAN_READY`, `UAT_READY` (typed `APPROVE` when risk flags include db-migration or security), plus owner-marked `SHIPPED`. Any lane that wants to change gate policy is an explicit owner decision, recorded in writing. **Lanes compress effort, context and validation — never oversight.** *(Amended 2026-08-01 for INSTANT only: three gate decisions are still recorded, but one owner action may produce the spec+plan pair, because on that lane they are one artifact from one turn. See "the INSTANT lane, and two scoped exceptions it needs" under Vision & Decisions — the amendment is the record this bullet requires.)*
- **No writes to the live Supabase project by any route** (CLAUDE.md Hard Rule 26), enforced in the agent's `canUseTool` Bash screen as well as by the MCP seal.

## Current State (verified)

**The state machine:** `SELECTED → DISCOVERY → SPEC_READY → PLAN_READY → BUILDING → VALIDATING → REVIEWING → UAT_READY → ACCEPTED → SHIPPED` (+ `BLOCKED` / `NEEDS_DECISION` / `FAILED` / `CANCELLED`), a pure transition table in `scripts/delivery/state-machine.mjs`. Beyond the three approval gates the machine also parks at `question` (the agent asked something), `budget` (envelope exhausted) and `blocked` (retries exhausted / hard error).

**Artifact-first persistence is the feature's greatest strength — preserve it in every change.** Everything lives under `.delivery/sessions/<id>/`: `state.json`, `packet.json`, `events.ndjson`, `transcript/turns.ndjson` + per-turn shards + `prompts/`, `memory/ledger.json`, `messages/`, `controls/`, `artifacts/{spec.md,plan.md,plan.json,finish/}`. The entire 2026-07-22 postmortem was reconstructed from files alone.

**Durable-memory layer (the former DW campaign, shipped — all thirteen slices landed):** full transcript capture, a provider-neutral Q&A ledger, pause/resume/abort controls, mid-session model and effort switching via `/api/delivery/control`, and provider handoff/rotation/fork. DLV work builds *on* this machinery, never beside it.

**Governance (the 10x campaign):** owner-set budget envelopes enforced between turns, a preflight Flight-Check panel, lanes as real policy bundles (effort-per-phase + budget + `maxInternalTurns` + context reading list + validation rungs), a scope contract with runner-derived size classes, an AC coverage matrix the runner confirms rather than the agent claims, a finish package written on every exit, salvage/continuation, automatic PM trace as a state-machine exit effect, fleet metrics, and a triage gate that routes trivial items to INSTANT at launch.

**The four lanes.** Lanes are policy bundles resolved at launch and snapshotted into `packet.json` (`resolveLanePolicy`). Only INSTANT changes the pipeline's *shape*; the rest change its dials.

| Lane | Tier | Model turns | Discovery+Plan | Review / UAT | Budget |
|---|---|---|---|---|---|
| **INSTANT** | economy | **2** | always merged | deterministic, escalates on any mismatch | $0.25 / 250K / 8 internal |
| **FAST** | economy | 4–5 | merged when the item names one file | model turns | $0.50 / 500K / 12 |
| **STANDARD** | standard | 5+ | separate | model turns | $2 / 2M / 20 |
| **DEEP** | premium | 5+ | separate | model turns | $5 / 5M / 40 |

INSTANT is the destination the triage gate routes to. It requires exactly one known target file — named by the item or resolved by the zero-token locator — and refuses rather than silently downgrading when it has none.

**Mobile Command Surface:** `/pm/live` — a phone-installable PM + delivery app fed by an outbound-only Supabase relay from `pnpm pm --bridge`. Revoke-tier commands (pause / stop-turn / cancel) are always reachable; launch is a narrow, envelope-mandatory grant; `answer` works only when the session is *currently* awaiting the question gate, verified server-side.

### Smoke-test record

| Date | Session | Outcome |
|---|---|---|
| 2026-07-25 | `s-20260725-151324-23aw` | CANCELLED — stranded at PLAN_READY by the budget/gate collision |
| 2026-07-25 | `s-20260725-154808-p1im` | CANCELLED — same collision at UAT_READY, second reproduction |
| 2026-07-25 | `s-20260725-181118-xdl9` | **ACCEPTED — the first session to complete the pipeline end-to-end.** Hit the collision twice more with the fix live; both times `awaiting` was correctly restored after an owner-authorized raise. Marked SHIPPED 2026-07-29 after sitting ACCEPTED-not-shipped for 4 days, silently holding the global build lock |
| 2026-07-29 | `s-20260729-121840-pdhx` | CANCELLED — FAST-lane run on a genuinely trivial S-effort item (BUD-14). Never reached BUILDING: DISCOVERY exhausted `maxInternalTurns`, both auto-retries and a post-guidance resume crashed instantly, escalated to NEEDS_DECISION twice. Real spend **$0.1026 / 210,193 tok** (the originally-recorded "$0.34 / 512K" was inflated 2.4× by counting duplicate raw records). Positive finding: retry-exhaustion escalation worked — it stopped and asked rather than looping silently |
| 2026-07-30 | `s-20260730-104900-9mfu` | CANCELLED at the budget gate, **$0.5317 spent, zero lines of code changed** — a re-run of the same item after the remediation wave. **DISCOVERY completed on the first attempt** (6 tool calls / 7 internal turns, 149,760 tok / $0.1048, complete 5-AC spec) where the previous run could not finish at all. Recorded usage matched the deduplicated raw transcript **exactly**. Then the gates themselves surfaced six more findings; all but two were fixed the same day |

**The verdict recorded 2026-07-30:** *the FAST lane is now genuinely fast and correct, but it cannot beat editing by hand on an item this size, and it was never going to — the floor is ~5 phases each paying its own cache-creation cost. BUD-14 is the item the pipeline should refuse, and now it does.*

**Revised 2026-08-01 (DLV-73).** That verdict was right about FAST and wrong about the conclusion. The floor it describes is a property of *the five-phase shape*, not of governed delivery — so the answer was to change the shape rather than to refuse the work. INSTANT runs BUD-14 in **two** model turns with all three gate decisions intact, because the phases it drops (PLAN, REVIEWING, UAT_PREP) are the ones whose output is derivable: the plan from the same turn as the spec, the review from asserting the diff against the approved `declaredEdit`, the UAT script from the turn that planned the change. **BUD-14 is no longer the item the pipeline refuses — it is the item INSTANT exists for.**

## Pain Inventory

- ✅ ~~**INSTANT verified the whole working tree instead of its own diff.**~~ *(FIXED 2026-08-01, DLV-80/81/82 — surfaced by the first live DLV-78 run, `s-20260801-094951-jx8o`. The session made a **correct** two-line edit to `MobileExpenseForm.tsx` and was still judged a 1326-line, 20-file overreach, because the verifier was handed an unscoped `git diff` of a tree the owner had left dirty. It escalated to the REVIEWING and UAT_PREP turns INSTANT exists to avoid, REVIEWING then died on `max-turns (8)`, and the session exhausted its 250K envelope at 348K tokens / $0.2455 and parked at `NEEDS_DECISION` with 0/3 acceptance criteria — for a change that was already right on disk. On a repo that is normally dirty, this meant INSTANT could essentially never take its own fast path: the failure was **unconditional**, not data-dependent.)*
- 🟡 **REVIEWING hit the 8-turn internal ceiling and returned no verdict at all.** On the escalation above, the fallback review turn failed with `Reached maximum number of turns (8)` rather than producing a PASS/FAIL — so the session had neither the deterministic verdict nor the model one. DLV-80 removes the escalation that triggered it, but the ceiling itself is untested under a real escalation and should be exercised deliberately: a review turn that cannot finish is a silent hole in the one path that makes skipping review safe. Worth folding into DLV-78's re-run.
- 🟡 **The targeted-test rung can pass by finding nothing.** The same session recorded `test: ok, targeted: true` on the excerpt `No test files found, exiting with code 0` — vitest exits 0 when a filter matches no files, so "no test covers this file" is indistinguishable from "the tests pass". `passesDelta` was true and `attributable` false, so nothing downstream noticed. INSTANT's safety argument leans on "validation passed first time"; that assertion is weaker than it reads whenever the changed file has no test.
- ✅ ~~**Repo lint baseline is still red.**~~ *(FIXED 2026-08-01, DLV-83 — `pnpm lint` exits 0; the full ladder is green. Read the fix precisely: 48 of the 636 were genuinely repaired, and the remaining 588 were **ledgered, not eliminated** — grandfathered to `warn` per-file in `eslint.config.mjs` while both rules stay `error` everywhere else, so new code still fails the build. The debt is still real and still owned by DLV-52; what ended is the tax it levied on every session. See the Shipped Log entry for why the ledger was the right instrument rather than a mass retype.)*
- 🟡 **The `any` debt is now invisible to the gate that used to surface it.** The ledger's honest cost: within the 126 ledgered files, a newly introduced `any` warns instead of erroring, so the ratchet protects new *files* better than it protects old ones. Mitigated by `warn` rather than `off` (the count stays printed and countable, so burn-down is measurable), but a reviewer touching a ledgered file gets no hard stop. Burning a file down and deleting its ledger line is what restores the guard — the list is designed to only ever shrink.
- 🟡 **Transcript stub records and a stalled-session watchdog are still missing.** Gap *detection* at session end exists; nothing writes a stub the instant a turn id is allocated, and there is no runner-heartbeat watchdog.
- 🟡 **Rotation doesn't seed the fresh session with a rendered context digest** — it relies on the artifact-by-path mechanism, which covers the substantive spec/plan output but not a mechanical summary of prior exploration.
- ✅ ~~**Role/colour data never reaches the phone.**~~ *(FIXED 2026-07-30, DLV-64/65 — the bridge relays `role` per turn and the Conversation pane renders the same role colours as the desktop view. The colour map is duplicated rather than imported, since the Next.js surface cannot statically import `scripts/delivery/*.mjs`; keep the two in step by hand.)*
- 🟡 The raw-SDK transcript pointer exists in `state.json` but is not surfaced in any UI, and the pinned opt-in export mechanism (redaction + de-dup) was deliberately not attempted.
- ✅ ~~Cache-TTL split is measured and instrumented but **no lever exists at the TTL level**.~~ *(ADDRESSED 2026-08-06, DLV-85 — the lever was never at the TTL level, it was at the **session** level. Every runner turn opened its own `query()`, so the prefix was re-written cold on every turn and read back only inside that turn: measured `cacheWrite 325,141 : cacheRead 488,456` = **1 : 1.5**, where a warm cache should be 1:10 or better. Consecutive same-option turns now share one live streaming-input session. The TTL observation stands and is unchanged — 100% `ephemeral_1h`, so the 2× write rate was always right; what was wrong was how often we paid it.)*
- 🟡 **`PHASE_BASELINE_TOKENS` still forecasts the pre-DLV-85 world, and it was already wrong by ~50×.** `recommendation.mjs:55` assumes economy `{cacheCreation: 10_000, cachedRead: 350_000}` — a **35 : 1** read-to-write ratio, against a measured **1 : 1.5**. That single term is 77–87% of a real session's bill, so every envelope the owner sets is a guess against a model known to be false, and the budget gate keeps firing on it. DLV-85 changes the true ratio again (in the right direction), so the constants must be re-derived from measurement, not adjusted by intuition. Tracked as DLV-86 — **do this before the next real launch**, or the forecast shown at the flight check stays fiction.
- ⚪ Conversation search and highlighting is real but polish-tier; deferred until the dependability path is done.

## Shipped Log

### Session cost architecture

- ✅ 2026-08-06 — **DLV-85** **One live SDK session now serves consecutive turns instead of one `query()` per turn — the cache is an asset again rather than a tax.** The driver opened a fresh `query()` for every runner turn, which is verifiable on the artifacts: `s-20260725-181118-xdl9` has **13 turn results and 13 `agent.session.init` events, exactly 1:1**. Each of those re-wrote the entire conversation prefix into a cold prompt cache at the 1-hour rate (2× input) and read it back only inside that one turn's internal tool loop. Measured across the two sessions that have honest v2 accounting: `cacheWrite 325,141 : cacheRead 488,456` = **1 : 1.5**, where a warm cache should be 1:10 or better — you paid $6/MTok to write and recovered $0.45. Cache writes were **87%** of `s-20260730-104900-9mfu`'s bill and **77%** of `s-20260801-094951-jx8o`'s. **The fix:** the SDK's `query()` accepts `prompt: string | AsyncIterable<SDKUserMessage>` (streaming input mode, confirmed in the installed `sdk.d.ts` 0.3.207) — the subprocess stays alive and the conversation stays resident, so consecutive turns pushed into the same stream pay no re-init and no cache re-write. A **segment** is one such live query; turns reuse it while every query-level option is unchanged. **Why segments and not one session for the whole run:** four options are query-level and cannot change on a live query — `mode` (readonly gets `tools: [Read, Grep, Glob]` with Write/Edit/Bash denied; build gets `acceptEdits`), `outputSchema` (`Options.outputFormat` has no per-message override and phases genuinely differ), `model`/`effort`, and `maxTurns`. Segmenting on `mode` is a deliberate choice to **keep the readonly guarantee by construction** rather than widen DISCOVERY to write access — `setPermissionMode` exists in streaming mode but only moves `permissionMode`, it cannot change the tool allowlist, and the allowlist is the real boundary. Session identity is untouched (`sessionId` first, `resume` after), so BUILDING still inherits DISCOVERY's context exactly as before; a segment boundary costs what *every* turn used to cost, and turns inside a segment now cost nothing extra. **Evidence — the real recorded phase sequences replayed through the real driver against a fake SDK:** `whdv` 16 turns → **3** sessions (81% fewer cold caches), `xdl9` 13 → **4** (69%), `9mfu` 4 → **3** (25%, a DISCOVERY retry after PLAN), `jx8o` (INSTANT) 3 → **3** (**0% — INSTANT alternates mode every turn and gains nothing by design**, an honest limit of this change, not a defect). The win concentrates exactly where turns pile up: BUILDING's fix loop and every in-phase retry now stay warm. **Instrumentation** (the owner's ask): `sdkSessionsCreated` and the open segment via `driver.sessionStats()`, a `segment: {id, seq, turnIndex, created, reason}` field on every `turns.ndjson` entry, and an `agent.segment.opened` event — so sessions-per-run is greppable from `events.ndjson`, where `agent.session.init` used to be 1:1 with turns. Cache writes/reads, context occupancy and per-phase tokens were already recorded (DLV-37/DLV-61) and now become interpretable. **Trap closed by a test:** the drain loop uses a manual `.next()` loop, never `for await ... break` — breaking out of `for await` calls the generator's `return()` and destroys the live session, which would silently revert the entire change with every turn still succeeding and only the bill moving. `drivers-claude-segments.test.ts` › "does not close the generator between turns" fails if anyone reintroduces it, and "serves three turns from a single query() call" is the load-bearing economic assertion. Conservative on failure: an error result or an abort retires the segment so the retry resumes fresh — exactly the behaviour DLV-44's forensics proved healthy, at the cost of a retry paying a cold cache, which is what it paid before anyway. 15 new tests; delivery suite 1232 → 1247. `typecheck exit=0 · lint exit=0 (0 errors) · test exit=0`. **The one existing test that failed was asserting the bug** — `drivers-claude.test.ts` › "first turn uses sessionId, later turns resume the same id" explicitly required turn 2 to be a *second* `query()` call; rewritten to assert the same session-identity contract across a segment boundary instead of across every turn.

### Validation baseline

- ✅ 2026-08-01 — **DLV-83** **The launch baseline is green: `typecheck`, `lint` and `test` all exit 0.** `pnpm lint` had exited 1 on 636 pre-existing errors, so the preflight ladder opened *every* session red and the owner cleared it with the `RED BASELINE` ack — and mobile launch (DLV-21) refused outright, since the phone never forwards a typed acknowledgment. The diagnosis is that this was as much a **rule-calibration** failure as a code one: `no-explicit-any` and `react-hooks/exhaustive-deps` are `warn` in next/typescript and next/core-web-vitals, `eslint.config.mjs` raises both to `error`, and the debt that already existed was never burned down — so the gate fired unconditionally, on a signal no session caused. That is precisely the failure the `.next` ignore block above it was written to fix, and its own comment already passed the verdict: *"A guard that always fires teaches you to wave it through."* Fixed in two parts. **(1) Real repairs, 636 → 588:** new `src/lib/errors.ts` (`getErrorMessage` / `getErrorCode` / `isCodedError`) replaces 35 `catch (e: any)` clauses with `catch (e: unknown)` and 13 `(error as any).code` casts across 27 files. This was a genuine latent bug, not cosmetics — the old code read `error.message` off a value that is only typed as having one under `any`, so any non-Error throw (a string, a Supabase error object, a rejected fetch value) rendered an empty toast. `getErrorMessage` narrows honestly and always returns something displayable. **(2) A debt ledger, not an amnesty:** both rules stay `error` globally; two override blocks name today's 126 (`any`) + 25 (`exhaustive-deps`) offending files and grandfather them to **`warn` — deliberately not `off`**, so the debt stays printed and countable and burn-down is measurable. Burning down = fix a file, delete its line; the list may only shrink. Notably the 50 `exhaustive-deps` errors were **not** mass-fixed on purpose: adding a missing dependency changes runtime behaviour, and these sit in `SyncContext`, `HubPage` and `MobileExpenseForm`, where a wrong dep is an infinite render loop in the offline sync engine or a money form — the ledger is the honest holding position until each gets per-site judgment (DLV-52). Evidence: ladder now `typecheck exit=0 · lint exit=0 · test exit=0`; lint reports `937 problems (0 errors, 937 warnings)`. Ratchet proven live, not assumed — a probe file containing `any` written to `src/lib/` still **errors**, while a ledgered file (`splitBill.ts`) reports the same violation as a warning. Suite 1524 → 1536: `src/lib/errors.test.ts` covers the non-Error throws the old `any` silently swallowed. Gotcha worth keeping: Next's `[id]` dynamic-route segments are minimatch character classes, so the first ledger silently matched none of the 10 dynamic API routes and left 32 errors standing — the paths need escaped brackets (`\\[id\\]` in source).

### INSTANT lane

- ✅ 2026-08-01 — **DLV-80** INSTANT's deterministic review now verifies **the session's own diff**, not the whole working tree. `tryInstantVerification` called `readDiff(repoRoot)` with no pathspec, so every uncommitted file the owner already had in flight counted against the lane's assertions; `readDiff` now takes the session's `changedFiles` (∪ the declared path) and passes them after `--`. Found by the first live DLV-78 run — see the Pain Inventory entry it closes. Evidence: replaying `s-20260801-094951-jx8o`'s real `declaredEdit` against the real repo goes `ok:false, 1425 lines, [undeclared-file, outside-scope-lock, diff-too-large]` → `ok:true, 2 lines, []`. Regression test `run-session-instant.test.ts` › "passes deterministically even when the rest of the tree is dirty" drives a full session against a git-like `readDiff` that returns the dirty tree when unscoped, and asserts `turnCounter === 2`; reverting the one-line fix fails it. A sibling test proves scoping did not weaken the check — a file the session touched but did not declare still escalates.
- ✅ 2026-08-01 — **DLV-81** Three diff/path-reading defects found in the same trace and fixed: (1) `parseUnifiedDiff` treated any line beginning `---` as a file header, so a deleted SQL migration's `-- WHAT:` comments were filed as touched *file paths* and — the silent half — vanished from `removed`, where a `before` match could then fail on a diff that plainly contained it; headers are now recognized only as the adjacent `---`/`+++` pair git always emits, outside a hunk. (2) Git C-quotes any path with a non-ASCII byte and escapes it in **octal**, which `JSON.parse` can never decode; `normalizeStatusPath`'s fallback kept the raw quoted string and rewrote its backslashes, turning every `ERA Notes/… — Master Book.md` into `…/342/200/224…` — a path that matches nothing, so it silently dropped out of change-ownership, scope-lock and `fingerprintDirtyPaths`' integrity guard. New `unquoteGitPath` in `instant.mjs` decodes it properly and both readers share it. (3) The same path arrived twice, as `a/…` and `b/…`, because the `^[ab]/` strip ran before unquoting. 12 new tests.
- ✅ 2026-08-01 — **DLV-82** Locator precision: bare numeric literals were grepped as plain substrings, so BUD-14's `$25` matched `text-white/25`, `bg-emerald-500/25` and `p256dh`. Enough of that noise lifted unrelated files close enough to the real one that the verdict fell from `likely` to `ambiguous` — which is the difference between INSTANT locating a file for free and spending a model turn on it. A number now matches only where it stands alone (not inside a longer identifier or number, and not after `/` or `.`, which here means a Tailwind opacity suffix). Evidence: BUD-14 goes `ambiguous` (leader 58.7, runner-up 34.5) → `likely` (leader 114.3, runner-up 22.1). Also fixed `scanLiterals`' signature, whose `= readFileSync` parameter default made TypeScript ignore the looser JSDoc and fail `tsc --noEmit` on all three tests that inject a fake reader — a red typecheck rung taxes every future session's validation ladder.
- ✅ 2026-08-01 — **DLV-73** INSTANT lane shipped: two model turns for a single located file, against FAST's four to five. `scripts/delivery/locate.mjs` (zero-token locator), `scripts/delivery/instant.mjs` (deterministic review + synthesized UAT), lane plumbing across `recommendation.mjs` / `config.mjs` / `run-session.mjs` / `server-routes.mjs`, desktop + phone surfaces. Evidence: `tests/delivery/run-session-instant.test.ts` drives a full session against a **two-turn** fake-driver script and asserts `turnPhases === ["DISCOVERY", "BUILDING"]` with all three gate decisions on disk — a regression that reintroduces a REVIEWING or UAT_PREP model call runs the script dry and fails. 50 new tests; suite 1172 → 1222.
- ✅ 2026-08-01 — **DLV-74** Triage gate converted from a wall into a router: a trivial item launches on INSTANT with **no acknowledgment at all**, and the refusal for other lanes now names INSTANT instead of "make the edit by hand". Lane and tier decoupled (`TIER_BY_LANE` gains `INSTANT: "economy"`; `laneForRecommendation` owns the choice) — they had been bijective, which is why the recommender could not previously suggest INSTANT at all.
- ✅ 2026-08-01 — **DLV-75** Zero-token locator: item keywords → Feature Map `_index.md` intent table → the module's own file list → an in-process literal scan, ranked by co-occurrence. Resolves BUD-14 to `MobileExpenseForm.tsx` **with no path given** in ~45 ms at `confidence: "likely"`, anchored on the `QUICK_AMOUNTS` block. Ambiguity becomes a pre-launch picker — the cheapest place to ask, since a mid-session question costs a whole turn. (Built on an in-process scan rather than ripgrep: `execFileSync("rg")` throws ENOENT under Node here even though `rg` resolves from the shell, and a launch-blocking dependency on an external binary was a bad trade for a bounded scan.)
- ✅ 2026-08-01 — **DLV-76** `declaredEdit` contract + deterministic review with auto-escalation; `manualSteps` from the same turn replaces the entire UAT_PREP turn. Migration `2026-08-01_pm-commands-instant-gates.sql` written for the mobile gate types — **not applied; owner runs it.**

### M1 — Governed Start

- ✅ 2026-07-24 — **DLV-1** budget governance: an owner-set cost/token envelope is mandatory at launch (or a typed `NO CAP`), recorded in the immutable packet, enforced between turns with one-shot warnings, and a hard cap pauses with a finish artifact and an audited raise-only resume
- ✅ 2026-07-24 — **DLV-2** preflight Flight-Check: one launch authorization panel showing item/ACs, lane + model/effort fit, required budget, context manifest estimate, capability/risk flags and governed baseline acknowledgments; the reviewed snapshot is persisted into `packet.json`
- ✅ 2026-07-24 — **DLV-3** config hardening: schema-validated `.delivery/config.json` with last-known-good fallback + dashboard banner, atomic writes, runner crash-loop backoff
- ✅ 2026-07-24 — **DLV-4** error taxonomy + retry escalation: closed the "monthly spend limit" pattern gap; quota/auth errors are never retried (paused and resumable); max auto-retries per gate then `NEEDS_DECISION` with a notification
- ✅ 2026-07-24 — **DLV-5** baseline & change-ownership gate: the server fingerprints the working tree and runs validation before launch; dirty and red states require exact typed acknowledgments; pre-existing edits are recorded as not-session-owned; later validation passes only on a non-regressing delta

### Mobile Command Surface

- ✅ 2026-07-25 — **DLV-20** mobile command channel: bridge drainer + allowlist mapping every phone command onto the existing `routeDelivery()` gates; `set-budget`/`set-config`/`rotate`/`fork` and any spec/plan/uat/blocked decision are never exposed
- ✅ 2026-07-25 — **DLV-21** mobile launch flow: flight-check + mandatory budget envelope with no default; refuses on a dirty tree or red baseline because mobile never forwards the typed acknowledgment
- ✅ 2026-07-25 — **DLV-23** mobile checklist made read-only and a row tap repointed at the flight check. `tick` refused server-side (`REFUSED_TYPES` **and** dropped from the `pm_commands.type` CHECK — an installed PWA can still issue it from a cached bundle); every bridge write journaled with a restorable pre-image under `.delivery/pm-undo/`; `undo` command + Undo strip on the phone, refusing rather than clobbering a later laptop edit
- ✅ 2026-07-25 — **DLV-22** push consumer for `notification.requested` (emitted since DLV-1, unconsumed until then): gate transitions, budget events, terminal states and runner death (60 s debounce) deep-link into `/pm/live`
- ✅ 2026-07-25 — **DLV-24** `/pm/live` promoted from a 3-tab relay to a responsive PM application: five views, bottom nav under `lg` and a side rail + widget grid above. Two new `pm_live` row kinds (`rollups`, `history`) derived laptop-side — no migration, they ride the existing `(id, kind, payload jsonb)` shape. A Zustand store confines the 10 s heartbeat to the status chip instead of re-rendering ~480 rows
- ✅ 2026-07-25 — **DLV-25** the three orphaned bridge commands got an interface: `capture` (Inbox quick-add), `ask` (free-form guidance) and `abort-turn`
- ✅ 2026-07-25 — **DLV-26** two drift fixes: `LANE_HINTS` was a hand-copied constant diverging from `DEFAULT_CONFIG.budgets.laneDefaults` — the bridge now publishes the real values; and terminal `session:<id>` rows are pruned after 7 days
- ✅ 2026-07-25 — **DLV-27** a missing provider USD cost renders as unavailable rather than crashing or showing a false zero; gate notifications use the same safe fallback

### Reliability floor & cost anatomy

- ✅ 2026-07-25 — **DLV-29** fixed the budget-exhausted / manual-gate collision that permanently stranded a session: `enforceBudgetBoundary` no longer clobbers an existing phase-gate `awaiting`, and the resume path re-derives it. Reproduced twice in real sessions before the fix; both had to be cancelled
- ✅ 2026-07-25 — **DLV-33 / DLV-35** per-spawn overhead floor: `strictMcpConfig` + `mcp__*` denial (16–36 unused tools rode along on 10 of 13 turns), an explicit skills filter and a build-mode tool allowlist. BUILDING sheds 9,291 tok/spawn (−32.8 %); a one-shot probe script makes driver-option changes A/B-measurable for a fraction of a cent
- ✅ 2026-07-28 — **DLV-37** usage accounting tells the truth: `cache_creation_input_tokens` was extracted **nowhere** for either provider; `state.usage` is now v2-shaped end-to-end so budget enforcement includes cache-creation, the cache-write rate was corrected to 2× input, and every PM UI total includes it with a legacy fallback
- ✅ 2026-07-28 — **DLV-32** owner guidance reaches every phase; PLAN and REVIEWING can now stop and ask (BUILDING via a `BLOCKING QUESTION:` sentinel). Caught a correctness bug in the process: answering a PLAN-raised question would have stranded the session exactly like DLV-29
- ✅ 2026-07-28 — **DLV-31** drivers survive a rotation: `reset()` on every driver, called from `getHandle` before any `startSession`, regardless of why the ref went null
- ✅ 2026-07-28 — **DLV-36** CLAUDE.md is no longer force-loaded per spawn (`settingSources: []`), replaced with a compact doctrine pointer. Also stopped the interactive-CLI hooks firing inside delivery's own automated sessions
- ✅ 2026-07-29 — **DLV-39** hard triage gate at launch: an item that cannot fail interestingly refuses to launch through the full pipeline without a typed `LAUNCH ANYWAY`, showing its own corrected cost forecast. **Refuses entry only** — every gate stays exactly as strict once a session is running
- ✅ 2026-07-29 — **DLV-41** closed the Bash escape hatch to the live Supabase project: `psql`, the `supabase` CLI (including `npx`-prefixed), `curl`/`wget` against a Supabase endpoint, or any script referencing the service-role key are now denied unconditionally
- ✅ 2026-07-29 — **DLV-38** flight-check forecast closed the loop: the "~140×" claim conflated the context-load preview with the budget forecast (really ~6× off). The history-informed median path was unreachable because `recommendAgentConfig` was called with no history at either call site
- ✅ 2026-07-30 — **DLV-42** the money-domain flag no longer fires on a money word embedded in a UI noun, and scope hints stop discarding the item's own file pointer. The old path substituted all six campaign globs, so "broad launch scope" fired for *every* Budget item ever launched. A one-token chip edit scored 3 → premium → DEEP; it now scores 0 → economy → FAST
- ✅ 2026-07-30 — **DLV-43** a turn that dies after the provider answered now banks what it spent. Found en route: `addUsageV2` on a legacy-shaped total produced `NaN`, and `NaN > cap` is false — a resumed old session's caps would have been silently dead for the rest of its life
- ✅ 2026-07-30 — **DLV-44** the hypothesis was wrong and the real cause was narrower and worse: `established` was set *after* the message loop, but the SDK throws from inside it, so every retry re-sent `sessionId` for a session Claude Code had already written. **This bricked any turn that failed after SDK init, not just max-turns.** `error_max_turns` is now non-retryable with an escalation naming the two real remedies
- ✅ 2026-07-30 — **DLV-45** FAST became a real fast lane: every lane had handed DISCOVERY the same ~33,151-token mandated reading list against FAST's own 8-turn cap, so **the phase was structurally unable to finish**. FAST wasn't expensive *and* broken by coincidence; it was broken *because* it was expensive
- ✅ 2026-07-30 — **DLV-46** `pnpm lint` was not failing, it was running out of memory: flat config's built-in ignores cover only `node_modules`/`.git`, so a bare `eslint` walked `.next`'s ~5,130 emitted files with type-aware rules. 452 s and a heap crash, every time — meaning **every delivery session saw a red lint baseline** for something that was never about the code. Now 14 s
- ✅ 2026-07-30 — **DLV-47** the raw SDK transcript is not usable as ground truth without deduplication, and this campaign's own cost forensics were inflated by it
- ✅ 2026-07-30 — **DLV-48** the long-carried "pre-existing DLV-34 handoff failure" was misattributed — a different collision entirely
- ✅ 2026-07-30 — **DLV-49** `smoke-launch.mjs`: a CLI harness that launches and inspects a real session through `routeDelivery` — the same path the dashboard uses, so a smoke test can never validate a path the real UI does not take
- ✅ 2026-07-30 — **DLV-50** repo typecheck restored to 0 errors; **DLV-51** the last red test was a false-positive drift guard, not a Schedule bug
- ✅ 2026-07-30 — **DLV-53…DLV-60** the plan-rejection path returns to SPEC_READY with the gate re-armed · `packet.mode` renamed (it had zero readers and only misled the agent about its own phase) · the step budget is stated to the planner at generation time · the triage gate can finally refuse the items it was written for · the forecast's unit is a phase traversal, not a session · economy `plan` effort lowered after a `medium` PLAN turn cost $0.1857 to decompose one line · a bounded read window is derived from the pointer the item already carries
- ✅ 2026-07-30 — **DLV-58** verified in flight, no fix needed: **the $0.50 budget cap held**, pausing the session with the underlying phase gate correctly preserved

### Mobile session drill-down

- ✅ 2026-07-30 — **DLV-63** the phone shows the agent's question. The runner had always written `awaiting.questions` and the bridge had always published `awaiting` verbatim; the field was dropped at the *type* layer, so the owner got a reply box with no question in it. A type + render fix, no data change
- ✅ 2026-07-30 — **DLV-64** the `session:<id>` row now carries what the phone needs to *read* a session: the Q&A ledger (blocking questions first), a compact tail of the last 40 turns with an excerpt on the most recent 12, artifact excerpts (spec / plan / finish summary / remaining work / recovery) and cost broken down by phase and by model with context-window occupancy. All of it derived from files already on disk, riding the existing `(id, kind, payload jsonb)` shape — **no migration**. `capSessionSnapshot` trims to ~200 KB along a stated ladder (turn excerpts → older turns → answered questions → older events → artifact excerpts) and **records what it dropped**, because a silently short detail view is worse than a labelled one
- ✅ 2026-07-30 — **DLV-65** session detail at `?session=<id>`: a sticky segmented pill bar with a sliding thumb over horizontally snap-scrolling panes — Questions / Conversation / Artifacts / Cost. Native scroll-snap does the paging so the swipe has real momentum and costs no re-renders; a tap scrolls the same container, so the two inputs cannot disagree. Every pane renders from the cached snapshot, so the whole view works with the laptop shut — only *sending* is disabled, visibly, rather than hidden
- ✅ 2026-07-30 — **DLV-66** ledger questions are answerable from the phone through the **existing** `answer` type: a `questionId` routes to the non-blocking ledger control (the same path the desktop Q&A card uses), no `questionId` keeps the server-verified gate path. No new `pm_commands` type, so no CHECK-constraint migration
- ✅ 2026-07-30 — **DLV-67** gate pushes deep-link to `?view=delivery&session=<id>` instead of the app root — a notification about one session no longer makes the owner find it again by hand — plus a Delivery PWA shortcut

### M2 — Right-Sized Delivery

- ✅ 2026-07-29 — **DLV-6 (D9)** lanes became a real, packet-resolved policy bundle: `resolveLanePolicy()` resolves FAST/STANDARD/DEEP into effort-per-phase + budget envelope + `maxInternalTurns`, which the Claude driver maps onto the SDK's own `maxTurns` — closing the exact mechanism behind "13 runner turns became ~40 model calls". Before this, `grep -i lane run-session.mjs` returned 0 matches
- ✅ 2026-07-30 — **DLV-7** the scope contract end to end: DISCOVERY must return a `scopeEstimate`, and the **runner** — not the agent — derives the size class from owner-set thresholds
- ✅ 2026-07-30 — **DLV-8** per-lane, per-phase context budgets dropping lowest-priority sources first (item > doctrine > skill > campaign). Fixed a related undocumented bug: the agent's `cwd` is the repo root, so bare `artifacts/spec.md` paths never resolved — the exact mechanism behind the postmortem's "artifacts/ at repo root (untracked)" finding
- ✅ 2026-07-30 — **DLV-9** model/effort fit is re-checked after discovery using the *measured* size class
- ✅ 2026-07-30 — **DLV-30 / DLV-34** phase-boundary context rotation is wired (every evaluation, including "no rotation needed", is an auditable event) and provider handoff now completes on the right driver
- ✅ 2026-07-28/30 — **DLV-11 (D10)** risk-based validation ladder: FAST runs typecheck + targeted `vitest related`, lint skipped; a skipped rung is always a structured, reasoned entry, never simply absent

### M3 — Truthful Finish

- ✅ 2026-07-30 — **DLV-10** the AC coverage matrix is real state, seeded at spec approval with every criterion `unmet`. The rule is neither "believe the agent" nor "ignore the agent" but **the agent may claim, the runner confirms**
- ✅ 2026-07-30 — **DLV-12** `writeFinishPackage(reason)` on **every** exit to a terminal, blocked or paused state: manifest, acceptance, remaining-work, recovery, risks, summary. The exhaustiveness is the deliverable
- ✅ 2026-07-30 — **DLV-13** `GET /api/delivery/salvage` reads the predecessor's own remaining-work package and returns a pre-filled launch payload; `start` accepts `continuationOf` and narrows the successor's ACs to what is left
- ✅ 2026-07-30 — **DLV-14** the PM trace is an exit effect the runner performs, not a step the agent can skip. It could, and did: BUD-11 burned two sessions and left **zero** PM trace

### M4 — Operability & Proof

- ✅ 2026-07-30 — **DLV-15** a persistent `StatusHeader` answers "what's happening" and "what needs me" in two lines, above everything else
- ✅ 2026-07-30 — **DLV-16** the dashboard half of notifications: `pnpm pm` raises toasts for the same events the bridge pushes to the phone, plus gate transitions
- ✅ 2026-07-29 — **DLV-17 (D12, partial)** transcript gap *detection*: `findMissingTurnIds` compares `state.turnCounter` against what exists on disk, and a `transcript.gap.checked` event fires at every terminal transition — including "zero gaps", so the check having run is itself part of the record
- ✅ 2026-07-29 — **DLV-40 (D12, partial)** role attribution and colour: `PHASE_ROLES` map each turn-producing phase to a role carried on every raw record and turn entry; `parent_tool_use_id` recorded unconditionally as cheap insurance that a future subagent is traceable by construction; `ROLE_COLORS` imports the role names from the runner so colour can never drift; the raw SDK transcript is referenced by pointer + hash, never copied
- ✅ 2026-07-30 — **DLV-18** `failure-scenarios.test.ts` drives each governance behaviour against the failure it exists to prevent — every one of which happened at least once in the BUD-11 forensics
- ✅ 2026-07-30 — **DLV-19** fleet metrics computed from the session directories at request time: outcome distribution, owner decisions per session, first-pass validation rate. Every input already existed on disk and had simply never been added up
- ◐ 2026-07-30 — **DLV-61 / DLV-62** cache-TTL split measured and instrumented (no lever exists at the TTL level); owner decision recorded on lane shape — **options (a)+(b), NOT (c)**: the standing "3 gates always" rule is untouched and unamended

## Delivery session log

*(Delivery runner appends dated progress bullets here automatically.)*
- 2026-08-06 — **DLV-86** delivery session `s-20260806-224840-o8xj` ended **paused — needs a decision** at NEEDS_DECISION. 0 file(s) changed. · finish package: `.delivery/sessions/s-20260806-224840-o8xj/artifacts/finish/summary.md`

## Vision & Decisions

### Design debates — adopted

Outcome milestones instead of flat fixes · budget controls, scope tripwire and model guard promoted to Now · risk-based validation **with the amendment that skips are always explicit and authorized** (silent `(skipped)` lines are exactly what the failed session produced) · FAST/STANDARD/DEEP as policy bundles that **never alter gate count** · context budgets as v2 of the existing assembly/policy modules, not a new engine · AC coverage matrix, evidence-backed completion, remaining-work package, revert instructions, risk register and a PARTIAL outcome expressed via existing states + `awaiting.reason` (no transition-table change without owner approval) · failure-injection scenarios on the existing fake driver, **not** a new test framework · the preflight screen promoted to the M1 centrepiece.

### Design debates — rejected (do not re-propose without reading these)

| Idea | Disposition |
|---|---|
| **Automatic provider fallback** (Claude ↔ Codex mid-session) | ❌ Rejected — cross-provider auth, cost and behaviour differences make silent fallback risky. A failing provider should pause and ask. Deliberate handoff/rotation at a human gate already exists |
| **Remote decision controls** | ❌ Rejected, then **reframed** — see the amendment below |
| **Ungated AUTO lane** | ❌ Rejected as-is — conflicts with "always 3 gates". FAST compresses effort, context and validation, **not oversight** |
| **Formal S/M/L benchmark + Delivery-vs-direct-CLI comparison** | ❌ Rejected — a measurement science project for a solo owner with 8 sessions of history. Fleet metrics answer the same questions continuously and for free |
| **Conversation search & highlighting** | ⏸ Deferred — real but polish-tier |
| **"Avoid locking exact files/functions too early"** | ◐ Partially rejected — this repo's playbook culture works *because* docs anchor to verified files. Compromise: anchor files as starting points with a freshness protocol, and specify contracts, not diffs |
| **Idempotent transitions as new work** | ◐ Right-sized — the transition table is already pure and crash reconciliation exists; this became verify-and-harden inside the failure scenarios |
| **Mid-session model/effort switching, pause/resume/cancel, provider switching** | ✅ Already exists (DW layer). The 10x work surfaces them better; it does not rebuild them |

### Amendment (2026-07-25): mobile command tiers

The original "remote decision controls" rejection was written against a specific transport — widening `pm-server`'s own binding. `/pm/live` uses a different transport the rejection did not contemplate. The revision, made explicitly:

| Tier | Commands | Disposition |
|---|---|---|
| **Revoke** (can only reduce a running session's authority) | `pause`, `abort-turn`, `cancel` | ✅ Adopted — always reachable. Worst case under a compromised channel: a session stops. Nothing is written |
| **Grant, narrowly** | `launch` (envelope mandatory, no default; refuses on a dirty tree or red baseline because mobile never forwards the typed ack) · `answer` (only when the session is *currently* awaiting the question gate, verified server-side, not merely hidden in the UI) | ✅ Adopted |
| **Still rejected** | any decision on the `spec` / `plan` / `uat` / `blocked` gate · `set-budget` · `set-config` · `rotate` · `fork` | ❌ Unchanged. Authorizing a gate, or raising a budget envelope, from a phone that might be used one-handed on a bus is not a risk this campaign takes |

*(Also discovered while implementing: `raiseBudgetEnvelope()` is raise-only, so a "decrease-only `set-budget` from mobile" idea was unimplementable without new budget logic — and unnecessary, since Pause and Cancel already cover it.)*

### Amendment (2026-07-25, same day): mobile checkbox ticking — adopted at 01:20, revoked at 11:30

The Mobile Command Surface shipped with `tick` in its allowlist. **Within two minutes of the bridge going live for the first time, a tap marked a real PM item done** — silently, with no confirmation, no trace and no way back — and the board then hid the row, because done items are filtered out.

The root cause is a category error, not a UI bug: the phone got a **grant** capability (assert that work is finished) on a surface built for **revoke** capabilities and glanceable one-handed taps. Three failures compounded: the whole row was the hit target, the mutation was silent (violating the Undo hard rule), and the result was invisible.

- ❌ **Mobile checkbox ticking** — rejected after shipping.
- ❌ **Fix it with a confirm dialog or long-press** — rejected: it keeps a done-marking capability on the phone at the cost of a modal on the highest-frequency gesture, and the capability has no demand behind it. The owner's actual mobile intent for a row is *"start work on this"*.
- ✅ **Tap a row → launch a delivery session** — adopted: every existing launch guard still applies, so a stray tap costs a preflight run and nothing else.
- ✅ **Journaled, revertible bridge writes** — adopted: removing `tick` fixes today's incident, not the class.

**Enforcement is server-side, not UI-side** — an installed PWA running a cached older bundle can still issue a removed command.

### Amendment (2026-08-01): the INSTANT lane, and two scoped exceptions it needs

**The problem.** The triage gate (DLV-39/59) refuses items it judges too trivial for the pipeline, and its refusal text quotes the measurement that justified it: BUD-14 — *"Mobile expense form quick-amount chip: replace the $25 preset with $20"* — **spent $0.5317 across DISCOVERY and PLAN and never reached BUILDING**, against roughly a cent to make the edit by hand. But refusal only ever had two exits, and both were bad: do it by hand (the pipeline has nothing to offer the work the owner does most often), or type `LAUNCH ANYWAY` and pay FAST's five-phase shape for a one-character change. **INSTANT is the third exit**, and the triage signal now *routes* to it instead of blocking.

**The shape.** Two model turns — one merged DISCOVERY+PLAN, one BUILDING — against FAST's four to five. Everything else is deterministic: a zero-token locator resolves the file before launch, and REVIEWING and UAT_PREP are discharged by asserting the diff against a `declaredEdit` the owner approved. Forecast ~$0.12–0.20 for the BUD-14 profile.

Two exceptions were needed, and both are recorded here as amendments rather than presented as compliance:

| # | Exception | Why it is not a general loosening |
|---|---|---|
| **(a)** | **One owner action may record both the spec and plan approvals** on INSTANT. All three gate decisions still exist in `decisions/` and both transitions still run through the state machine — but INSTANT has **two review moments, not three**, because the second gate's artifact *is* the first gate's artifact. | The merged turn writes `spec.json` and `plan.json` together, so the two gates fire back-to-back with no work between them: the owner reads one thing and clicks approve twice. Requires INSTANT **and** a genuinely merged turn, and a risk-flagged plan (`db-migration` / `security`) still needs its own typed `APPROVE` — the collapse is refused otherwise. |
| **(b)** | **`code-review` and `uat-generation` are discharged deterministically** on INSTANT, not by a model turn. Both remain locked always-on rows in `classify.mjs`. | The runner asserts the diff touches only the declared file, is within `instantMaxDiffLines` (20), matches `declaredEdit.before`/`.after`, and passed validation with no fix loop. **Any failure escalates to the real REVIEWING + UAT_PREP turns** — the escalation path, not the happy path, is what makes skipping them safe. You pay for review exactly when the change turns out not to have been trivial. |

**Explicitly unchanged:** the "always three human gates" non-negotiable still holds in the sense that matters — three approvals are recorded, in every lane, and no gate was deleted. What (a) changes is the number of *interactions*, and that change is confined to a lane whose artifact makes it meaningless to review twice. Nothing here applies to FAST, STANDARD or DEEP.

### Amendment (2026-08-01): mobile gate approval, INSTANT only

The 2026-07-25 tiering above still rejects *"any decision on the `spec` / `plan` / `uat` / `blocked` gate"* from mobile. That rejection is revised for one lane only.

The rejection's reasoning was that authorizing a gate from a phone used one-handed on a bus is not a risk worth taking — and that is right whenever the owner cannot actually read what they are approving. INSTANT inverts the premise by construction: its launch precondition is exactly one known target file, and its diff is bounded at 20 changed lines. That is a change that fits on a phone screen in full.

- ✅ **`approve` (spec gate) and `accept` (uat gate) from mobile, on INSTANT sessions only.** Both re-read the session and refuse any other lane or gate server-side (`requireInstantGate` in `bridge.mjs`) — an installed PWA running a cached bundle cannot bypass it. The `pm_commands.type` CHECK is widened to admit them, but it *cannot* express "INSTANT only", so the bridge remains authoritative.
- ✅ **`answer` may carry `acceptProposal`** when the runner marked the gate `proposalReady`. A DISCOVERY question normally re-runs the phase — a second full turn, i.e. a 50% overrun on a two-turn lane — so INSTANT's prompt requires a complete best-guess proposal *alongside* its questions, and the owner can answer and approve in one action when the guess was right. "Answer + revise" is unchanged and still available.
- ❌ **Still rejected, unchanged:** `blocked`-gate decisions, `set-budget`, `set-config`, `rotate`, `fork`, and every gate decision on FAST / STANDARD / DEEP.

### Standing tensions to keep in view

- **Governance friction vs launch speed.** Mandatory budget fields and acknowledgments add clicks to every launch. Accepted deliberately: **the flight-check is the product.** Lane defaults keep the S-item path to ~3 confirmations.
- **Runner-enforced truth vs agent autonomy.** Moving AC status from agent prose to runner reconciliation means more machinery and less trust in the model. The failed session settles it: the economy model *will* over-claim, so truth must be structural — exactly as the git ban is enforced by construction rather than by instruction.
- **"Unset until baselined" is dead.** The base plan's stance of no defaults until a benchmark runs produced two uncapped runaway sessions on the same item. Defaults may be imperfect; absent envelopes are worse. *(Owner-direction change, 2026-07-24.)*
- **A guard that always fires teaches you to wave it through.** The red lint baseline demanded a red-baseline acknowledgment on every session for something that was never about the code.
- **The pipeline has a floor.** ~5 phases each paying its own cache-creation cost. Below that size, the pipeline *is* the cost — which is what the triage gate exists to refuse.

## Acceptance Criteria Index

### DLV-52
- **Acceptance:** `pnpm lint` reports 0 errors, with each `no-explicit-any` replaced by the correct type from its own call site (never `unknown`-as-a-shortcut or a suppression), and each `exhaustive-deps` fix verified in the running app — specifically that `SyncContext`, `HubPage` and `MobileExpenseForm` do not enter a render loop.

## Successor Briefing

**Who should read this:** you are about to change the delivery system itself. This is the machinery that runs other agents against a real repo with real money. Its failure modes are governance failures, not crashes.

**First 10 minutes:**

```bash
git log --format="%h %ad %s" --date=short --since=2026-07-30 -- scripts/delivery scripts/pm/bridge.mjs src/features/pm-live src/components/pm-live
npx vitest run tests/delivery/          # expect green
node scripts/pm/lint.mjs                # the board's own grammar guard
```

Then read `scripts/delivery/state-machine.mjs` (the pure transition table) → `scripts/delivery/server-routes.mjs` (`routeDelivery` — every surface funnels through it) → the design-debate dispositions above before proposing anything that sounds familiar.

**Task-tier map:**

| Task archetype | Tier | Route |
|---|---|---|
| Desktop delivery UI (views, cards, chips) | any-model | `ui-guardrails`; the desktop app is Preact under `scripts/pm/src/` |
| `/pm/live` UI (the phone app) | any-model | it is a normal Next.js surface under `src/`; it **cannot** import `scripts/delivery/*.mjs` — everything arrives as relayed JSON |
| New `pm_live` row kinds / payload fields | any-model | migration-free by design; keep the published payload under ~200 KB |
| New bridge command types | **human-first** | the `pm_commands.type` CHECK is a migration **and** a security boundary; the revoke/grant tiering above is the decision record |
| Runner phases, prompts, context policy | mid-tier+ | measure before and after; the cost forensics are the standard of evidence here |
| State machine transitions, gate semantics | **human-first** | "always 3 gates" is an owner non-negotiable; changing it requires an amendment in writing |
| Budget enforcement, usage accounting | **human-first** | this is money math on real spend; a `NaN` here silently disables every cap |

**Out-of-depth tells — stop if:** you're about to let an agent write to git, or to the live Supabase project, by any route · you're adding a capability to the phone that *grants* rather than *revokes* · you're changing gate count or gate policy · you're trusting the raw SDK jsonl without deduplicating it · you're proposing something in the rejected table above without reading its rationale.

**Trap registry:**

| Trap | Symptom | Guard |
|---|---|---|
| Raw SDK transcript double-counts | cost forensics inflated ~2.4× | deduplicate before drawing any conclusion |
| `NaN > cap` is false | a resumed legacy session has silently dead caps | usage totals must be v2-shaped with every key present |
| A skipped validation rung that is simply absent | "it passed" when it never ran | every skip is a structured, reasoned entry |
| Server-side enforcement vs UI removal | a cached PWA bundle re-issues a removed command | refuse in the bridge **and** in the DB CHECK |
| Preflight runs the full ladder | a red repo baseline taxes every session | keep typecheck/lint/test green as delivery infrastructure, not hygiene |
| `pnpm pm` hooks fire inside delivery sessions | mysterious extra tool-free model calls | `settingSources: []` keeps interactive-CLI hooks out |

## Pointers

- Working queue: [4 · Checklist](<4 - Checklist.md>) · conventions: [_Conventions](<../_Conventions.md>)
- Bridge + relay: `scripts/pm/bridge.mjs`, `migrations/2026-07-25_pm-mobile-relay.sql`, `migrations/2026-07-25_pm-commands-drop-tick.sql`
- Phone app doc: [Page & Feature Atlas / pm-live](<../../04 - UI & Design/Page & Feature Atlas/pm-live.md>)
- Pre-consolidation originals — the full base architecture (state machine, packet, classifier, drivers, security, dashboard UX, roadmap), the DW campaign record, the complete `whdv` session postmortem with its forensic timeline and salvage runbook, the full design-debates file, and the Cost Anatomy analysis: `../_Archive/{Agentic Delivery Workspace,Delivery Workspace,Delivery 10x}/`
