# 4 — Agent Drivers & Security

**Stamped:** 2026-07-11 · **Revised:** 2026-07-12 · Covers plan sections: agent SDK integration design (8), approval & security boundaries (12), token & context optimization strategy (13)

## 1 · Provider-neutral driver interface

`scripts/delivery/drivers/driver.mjs` defines the seam; `codex.mjs`, `claude.mjs`, and `fake.mjs` implement it. Both SDKs are **devDependencies added only in slice S3**, dynamic-`import()`ed inside their driver module only — pm-server and every pure module stay zero-dep; a missing/broken SDK fails the runner into BLOCKED with a clear reason, never breaks the dashboard.

**IMPLEMENTED 2026-07-13 (both driver modules + neutral runner wiring).** `@openai/codex-sdk@0.144.1` and `@anthropic-ai/claude-agent-sdk@0.3.207` are installed devDependencies. `codex.mjs` and `claude.mjs` self-register without loading an SDK; each lazily imports its SDK only from `startSession`/`resume`/`runTurn`. `run-session.mjs` imports both registration modules, selects `packet.agent`, forwards `packet.agentConfig.model` plus the phase effort, and persists the returned ref before starting DISCOVERY. Both modules expose pure option/event/usage helpers and injectable `importSdk` seams. Automated turn mechanics are complete; the two real codebase-reading runs remain approval-blocked because they transmit private workspace context (doc 6 §1).

```
createDriver(kind) → {
  startSession({cwd, mode: "build" | "readonly", model?, effort?})  → handle   // persist handle.ref immediately
  resume(ref)                                                       → handle
  runTurn(handle, prompt, {outputSchema?, onEvent, effort?})        → {finalText, usage}
}
```

`model` and `effort` originate from `packet.agentConfig` (doc 3 §1), itself defaulted from `.delivery/config.json` and overridable at launch (doc 5 §2 step 4a). `effort` is passed per-turn (not just at `startSession`) because the per-phase defaults differ (below) — the runner resolves the phase-appropriate level from `agentConfig.effort` before each `runTurn` call. `model` is fixed for the life of the session, set once at `startSession`.

- **Normalized events:** every provider event becomes `{ts, seq, type: "agent."+kind, phase, agent, data}` appended to `events.ndjson` (command lines truncated to 500 chars, messages to 2000 — full text lives in artifacts).
- **Normalized usage:** `{input, cachedInput, output, costUsd?}` accumulated per phase into `state.json.usage`.

## 2 · Provider mapping (**CONFIRMED 2026-07-13** against installed `@openai/codex-sdk@0.144.1` and `@anthropic-ai/claude-agent-sdk@0.3.207` declarations)

| Concern | Codex — `@openai/codex-sdk` | Claude Code — `@anthropic-ai/claude-agent-sdk` |
|---|---|---|
| Session | **Confirmed.** `new Codex().startThread({workingDirectory, sandboxMode, approvalPolicy, networkAccessEnabled, model?, modelReasoningEffort?})`; the preflight establishes `thread.id`; `resumeThread(ref.id, options)` reconstructs it. The runner persists `handle.ref` before the first real DISCOVERY turn. | **Confirmed.** `query({prompt, options:{cwd, sessionId, resume, …}})` returns an `AsyncGenerator<SDKMessage>`, ended by a `result` message per call — there is no long-lived streaming-input session object. The driver pre-generates its own session id (`crypto.randomUUID()`) at `startSession` and persists it as `ref.id` immediately (doc 5 §1 requirement) rather than waiting on the SDK to mint one; the first real `runTurn` passes `sessionId: ref.id`, every later turn passes `resume: ref.id`. `ref.established` flips to `true` only once a `system/init` message is actually observed on the stream. |
| Build mode | `workspace-write` sandbox, network **off**, `approval_policy: "never"` (anything needing approval must surface as NEEDS_DECISION via structured output instead). **Windows caveat:** Codex's OS-level sandbox mechanisms (Landlock/Seatbelt) do not cover Windows — on this machine the sandbox is advisory, and the authoritative controls are the post-turn guards (§3) + changed-file scope check (§4); recorded as residual risk, never claimed as enforced (doc 6 §4) | **Least-permissive workable mode — never `bypassPermissions`.** `permissionMode: "acceptEdits"` + an authoritative `canUseTool` callback that (a) allowlists writes to {working tree minus `constraints.forbiddenPaths`, own session dir}, (b) denies reads of secret paths (§4), (c) denies git-mutating Bash — allowlist-based on `gitread.mjs`'s own `ALLOWED_SUBCOMMANDS`, never name-lists mutating subcommands (keeps the repo-wide "no alternate-checkout terminology" grep invariant, doc 6 §2, clean by construction). `disallowedTools: []` in build mode (canUseTool is the sole enforcement layer there — no known built-in tool needs a hard second-layer block today). Harness-level enforcement (in-process SDK callback, invoked before every tool execution per the SDK's own `CanUseTool` type — not conditioned on `permissionMode`), not OS-level — stated as such in §4 |
| Read-only mode (discovery/plan/S5 reviews) | read-only sandbox for specialist threads (same Windows caveat); primary-thread analysis turns guarded mechanically (§3) | **Confirmed field: `tools`, not `allowedTools`.** `tools: ["Read", "Grep", "Glob"]` hard-restricts the *available* built-in toolset (this is the field that actually removes Bash/Write/Edit from the model's context — `allowedTools` only auto-approves without restricting availability, so it was the wrong lever); `disallowedTools: ["Write", "Edit", "Bash", "NotebookEdit"]` as the second layer. Same `canUseTool` secret-path + allowed-roots denial applies underneath (defense in depth; mode-agnostic by design). |
| Structured output | **Confirmed.** `Thread.runStreamed(prompt, {outputSchema})`; the exact runner schema is passed through. | **Confirmed.** `options.outputFormat: {type: "json_schema", schema}`; the exact runner schema is passed through. The runner then validates every required spec/plan field before rendering Markdown; malformed JSON or shape → BLOCKED with usage retained. |
| Model / effort | **Confirmed.** `ThreadOptions.model` + `modelReasoningEffort`; a changed per-turn effort rebuilds the resumed thread with the same id. | **Confirmed.** `model?: string` and `effort?: 'low'\|'medium'\|'high'\|'xhigh'\|'max'` are top-level `Options` fields. |
| Usage | **Confirmed.** `turn.completed.usage {input_tokens, cached_input_tokens, output_tokens, reasoning_output_tokens}` → normalized input/cachedInput/output. | **Confirmed.** Result `usage` plus sibling `total_cost_usd` → normalized input/cachedInput/output/costUsd. |
| Auth | Existing Codex auth is inherited by the SDK subprocess; global CLI observed as 0.128.0, while the SDK ships/pins its own 0.144.1 surface. | Existing Claude Code install (2.1.207 observed); the driver does not replace `env`, so SDK auth resolution is inherited. |
| Preflight (S3) | **IMPLEMENTED.** One `thread.run("Reply with exactly: OK")` at `startSession`; missing thread id or error throws before real work. | **IMPLEMENTED.** One `maxTurns: 1`, `tools: []`, `effort: "low"`, `persistSession: false` turn at `startSession`; auth/billing/result failure throws before real work. Both preflight errors are caught by the runner and durably transition the session to BLOCKED. |

**Instruction inheritance:** both agents auto-read their repo instruction file (`AGENTS.md` for Codex, `CLAUDE.md` for Claude — byte-identical mirrors), so every session inherits Hard Rules 1–25 natively. HR24 (migration pairing) is re-checked by the code reviewer; HR25's PM trace is satisfied by the Accept checkbox tick.

## 3 · Git policy enforcement (owner hard constraint)

**This policy is permanent** — it applies to every slice, every phase, and every future refinement; no later document may reintroduce worktrees or any other git write as an option.

**Allowed (read-only observation):** `git status --porcelain`, `git diff`, `git log`, `git show`, `git rev-parse`, `git for-each-ref`.
**Prohibited (anything that changes git state):** `worktree`, `branch`, `checkout`, `switch`, `add`, `commit`, `push`, `pull`, `fetch`, `merge`, `rebase`, `reset`, `restore`, `stash`, `tag`, git config edits.

**The distinction, explicitly:** agents may edit normal working-tree source files during the approved BUILDING phase; they may inspect Git through the approved read-only commands; they may **never** change Git metadata, refs, branches, index, commits, remotes, stash, tags, or worktrees. The system never creates or manages branches, clones, or worktrees. Suggested revert/rollback commands anywhere in the UI or artifacts are display-only — the tool never executes them.

Enforced in three independent layers — none of which is prompt trust:

1. **By construction:** the only git invocation point in the tooling is `gitread.mjs`, which shells out through an explicit **read-only subcommand allowlist**. No other module imports `child_process` for git. Grep-provable invariant (tested, doc 6 §2).
2. **Agent guards:** prompts ban git writes; around provider session setup/preflight and after **every successful or failed turn** the runner compares HEAD, the full ref listing, the staged/index diff, the tracked working diff, `status --porcelain --untracked-files=all`, and SHA-256 fingerprints for every dirty path. HEAD/ref/index change → immediate BLOCKED. Analysis drift → BLOCKED. During build turns, a new/changed fingerprint matching `constraints.forbiddenPaths` → BLOCKED. The test injects changed snapshots; it never performs the prohibited operation it is simulating.
3. **Provider config:** Claude driver denies git-mutating Bash via tool rules; Codex build sandbox has network off and the prompt-level ban (its sandbox cannot selectively block git, hence layer 2 is the authoritative check for both providers).

## 4 · Approval & security boundaries

**Hard-coded human gates:** spec approval, plan approval (typed `APPROVE` when riskFlags include db-migration/security — validated server-side AND runner-side), UAT acceptance, shipped confirmation. Not configurable off.

**Honesty rule for this whole section:** the plan claims a protection only where a concrete mechanism enforces it, and names the enforcement level — *OS-level* (kernel sandbox), *harness-level* (in-process SDK permission callback / tool rules), or *detection* (post-turn verification that blocks the session after the fact). Prompt instructions are never counted as enforcement. Anything weaker than the claim is listed under **Residual risks** below and surfaced in the session view as "detection-only".

**Filesystem access contract (per phase):**

| Concern | Rule | Claude Code enforcement | Codex enforcement |
|---|---|---|---|
| Readable roots | repo working tree + own `.delivery/sessions/<id>/` | harness: `canUseTool` path check on Read/Grep/Glob + Bash arg screening | **not mechanically enforceable** (sandbox constrains writes, not reads) → prompt ban + residual risk |
| Secret paths — unreadable by default | `.env`, `.env.*`, private keys, credential files, auth stores, `~/.codex`, `~/.claude`, other user-profile dirs, `.delivery/` outside own session | harness: `canUseTool` deny patterns (heuristic for Bash) | **not mechanically enforceable** → prompt ban + residual risk |
| Writable roots — BUILDING only | working tree minus `constraints.forbiddenPaths` + own session dir (when the runner requires it) | harness: exact-path checks for Write/Edit/NotebookEdit; Bash is only heuristically screened, then in-repo changes are detection-checked after the turn | OS-level `workspace-write` where the installed Codex sandbox provides it; **not treated as proven on Windows** → in-repo detection via post-turn changed-file guard |
| Analysis & specialist phases | **read-only, no writes at all** | harness: `allowedTools: [Read, Grep, Glob]` | read-only sandbox (Windows caveat) + detection: post-turn `status --porcelain` must equal the pre-turn snapshot (§3) |
| Shell / command execution | git writes denied; commands screened | harness: `canUseTool` Bash screening + `disallowedTools` (heuristic) | sandboxed shell (platform-dependent) + prompt ban; §3 guards authoritative |
| Session-store access | own session dir only; never other sessions' dirs, never `config.json` writes | harness path check | detection (changed-file guard) |

**The tool may NEVER (with the enforcing mechanism and its level):**

| Never | Enforced by |
|---|---|
| Any git write incl. worktrees (see §3) | by construction (`gitread.mjs` allowlist — the only git invocation point) + detection (post-turn HEAD/refs guards) |
| Push, deploy, or any remote operation | no code path exists; Codex sandbox network off; no credentials handed to agents |
| Execute SQL against any database | sessions may *write* migration files + runbooks per the `db-migration` skill; no DB client in the tooling; validation runs no DB |
| Add dependencies | `allowNewDeps:false` → plan requiring a package raises NEEDS_DECISION; the owner edits package.json personally |
| Write outside {working tree minus forbidden paths, own session dir} | Prevented for Claude's direct file tools; only heuristic for Claude Bash. Provider sandbox where available for Codex. The runner detects Git-visible/fingerprinted in-repo changes, but cannot detect arbitrary out-of-root or ignored-path writes → residual risk |
| Read secret/credential paths (`.env*`, keys, `~/.codex`, `~/.claude`, auth stores) | harness-level deny (Claude); **Codex: prompt ban only — residual risk, not claimed enforced** |
| Touch `~/.codex`, `~/.claude`, `.claude/`, `.codex/`, `.husky/`, repo git config | forbidden paths (harness/detection as above) + no code path |
| Execute revert/rollback commands | no code path — all such commands are display-only for the owner |
| Tick PM checkboxes before human Accept | writeback only runs on the Accept decision, exactly-once via `writeback.done` |

**Residual risks (documented honestly, not claimed as enforced):**

1. **Codex sandbox enforcement on this Windows host is not independently proven.** Treat it as detection-only for policy claims: a violating in-repo write can exist until the post-turn snapshot blocks the session. The guard does not undo it.
2. **In-repo and on-disk secret reads cannot be fully prevented** for an agent with shell access: Claude's Bash screening is heuristic (an obfuscated command can evade it) and Codex cannot restrict reads at all. Default-deny is attempted where possible; mitigations are network-off (Codex), no delivery task ever requiring secrets, and the owner reviewing every diff at UAT.
3. **Harness-level enforcement is in-process**, not kernel-level — a provider SDK bug could bypass `canUseTool`/tool rules. Post-turn guards are the backstop.
4. **Detection guards act after the fact** — they BLOCK the session and notify the owner; they do not undo the violating action (the tool never reverts anything). They cover Git metadata/index plus Git-visible and fingerprinted dirty paths, not arbitrary files outside the repo or ignored paths that never appear in status.
5. **Claude Bash is not a filesystem sandbox.** Direct Write/Edit tools get exact root/forbidden-path checks, but shell parsing is heuristic; quoting, aliases, interpreters, or obfuscation can evade textual screening. The in-repo post-turn guard is the backstop, and out-of-root Bash writes remain non-detectable by this runner.

**Network posture:** pm-server unchanged — 127.0.0.1 bind + Host-header allowlist covers the new routes automatically. The runner talks only to the filesystem and the agent SDKs (whose own outbound API access is the CLI/SDK's, not the sandboxed agent's).

## 5 · Token & context optimization

- **Artifact-first prompting:** every turn = ~1–2 KB framing + the small packet JSON + **paths** to artifacts ("read `artifacts/spec.md`"), never pasted history — agents read files themselves inside their own context management.
- **Primary thread lifecycle — reuse by default, fresh only on a defined trigger.** Provider-native compaction and prompt caching make a continued thread workable across phases, and continuity has its own value, so the runner does **not** default to discarding the thread at every human gate. It resumes the existing thread unless one of these fires:
  - **Long idle time** at a gate (owner-configurable threshold — cache has likely gone cold; resuming would re-pay the accumulated history at full price with little benefit),
  - **Excessive context growth** (thread history has grown well beyond what the artifacts capture),
  - **Failed resume** (provider `resume()` errors or a lost session ref),
  - **Instability** (post-turn guard anomalies, degraded output quality).

  On any of these, the runner starts a fresh thread seeded from artifact paths only — "artifacts make threads replaceable" is the enabling mechanism for this fallback, not a mandate to discard threads by default. Each phase turn still opens with "authoritative state is in the artifacts listed below; disregard prior scratch reasoning" so a resumed thread never leans on stale scratch context.
- **Specialists as fresh threads (S5):** unchanged — review context stays diff-sized; disposable, never resumed, regardless of the primary-thread policy above.
- **Skill budget:** skills referenced by repo-relative path (committed `.claude/skills/**`), never inlined — cost only if the agent reads them; only the 1–3 classifier-mapped skills per session.
- **Bounded feedback:** validation failures fed back as last-200-lines-per-command excerpts; review diffs capped at 4000 lines with per-file fallback.
- **Model choice:** unset by default (provider defaults). `.delivery/config.json` can override `model` (primary) and exposes **configurable specialist model tiers** — `specialistTiers: {economy, balanced, strong}`, each owner-mapped to a concrete provider model (no model is hardcoded in the tooling). Each registry specialist declares which tier it uses (e.g. UX/lite code review → economy; DB-migration review → balanced; money-domain guardian → strong); an unset tier falls back to the provider default. Spawning a specialist on a cheaper tier — never switching the primary thread's model — is the cache-preserving pattern (doc "Caching for Agents" in the shared skill reference).
- **Effort control:** the New Delivery Session flow (doc 5 §2) exposes a **model** and an **effort** selector per session, persisted into the packet and mapped per provider (Codex: reasoning-effort thread option; Claude Agent SDK: effort/thinking option — pinned against the installed `.d.ts` in S3, alongside the existing exact-field-name pinning task in §2 above). Recommended per-phase defaults, config-overridable:

  | Phase | Effort | Rationale |
  |---|---|---|
  | DISCOVERY / spec | medium | mostly reading + writing one artifact |
  | PLAN | high | plan quality gates everything downstream |
  | BUILDING | high (xhigh opt-in per session for hard items) | high is the cost/quality sweet spot; xhigh only when the item warrants it |
  | Self-review / UAT prep | medium | checklist-shaped work |
  | S5 specialists | low–medium | verdict-shaped, diff-scoped |
- **Session token budget:** `.delivery/config.json` supports `budget: {sessionTokens, warnAtPct}`. **`sessionTokens` ships unset (no enforcement)** — no arbitrary default is prescribed; the owner sets a value only after the CLI-vs-workspace benchmark (doc 6 §1) produces real baseline numbers for this repo's task classes. Enforcement is **between turns, not a mid-turn hard limit** — a turn already in flight always completes. After every turn, the runner compares accumulated `state.json.usage.total` against the budget: at `warnAtPct` it emits a `budget.warning` event; at or above 100% it raises `budget.exhausted` → NEEDS_DECISION (doc 3 §2) before composing the next turn, offering "extend budget by N" or "cancel session" — never a silent kill.
- **Visibility:** per-phase usage table always rendered (doc 5 §6) — thrash is visible before it is expensive; `maxFixLoops:3` bounds the worst case. Session header additionally shows total tokens against the configured budget when one is set (doc 5 §6).
- **Consumption is measured, not assumed:** no fixed multiplier (e.g. "Nx a CLI session") should be treated as fact for this workspace. Doc 6 §1 defines a benchmark — the same representative tasks run once via CLI and once via a delivery session, same provider/model/effort — whose measured ratios are the only authoritative cost comparison; they supersede any qualitative estimate.
