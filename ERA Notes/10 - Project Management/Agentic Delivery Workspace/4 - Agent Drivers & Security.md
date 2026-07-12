# 4 — Agent Drivers & Security

**Stamped:** 2026-07-11 · **Revised:** 2026-07-12 · Covers plan sections: agent SDK integration design (8), approval & security boundaries (12), token & context optimization strategy (13)

## 1 · Provider-neutral driver interface

`scripts/delivery/drivers/driver.mjs` defines the seam; `codex.mjs`, `claude.mjs`, and `fake.mjs` implement it. Both SDKs are **devDependencies added only in slice S3**, dynamic-`import()`ed inside their driver module only — pm-server and every pure module stay zero-dep; a missing/broken SDK fails the runner into BLOCKED with a clear reason, never breaks the dashboard.

```
createDriver(kind) → {
  startSession({cwd, mode: "build" | "readonly", model?})  → handle        // persist handle.ref immediately
  resume(ref)                                              → handle
  runTurn(handle, prompt, {outputSchema?, onEvent})        → {finalText, usage}
}
```

- **Normalized events:** every provider event becomes `{ts, seq, type: "agent."+kind, phase, agent, data}` appended to `events.ndjson` (command lines truncated to 500 chars, messages to 2000 — full text lives in artifacts).
- **Normalized usage:** `{input, cachedInput, output, costUsd?}` accumulated per phase into `state.json.usage`.

## 2 · Provider mapping (pin exact field names against installed `.d.ts` in S3 — both surfaces have documented naming drift)

| Concern | Codex — `@openai/codex-sdk` | Claude Code — `@anthropic-ai/claude-agent-sdk` |
|---|---|---|
| Session | `codex.startThread({workingDirectory: repoRoot, sandboxMode})`; persist `thread.id`; `codex.resumeThread(id)` | `query({prompt, options:{cwd: repoRoot, resume: sessionId, …}})`; persist `session_id` from the init message |
| Build mode | `workspace-write` sandbox, network **off**, `approval_policy: "never"` (anything needing approval must surface as NEEDS_DECISION via structured output instead). **Windows caveat:** Codex's OS-level sandbox mechanisms (Landlock/Seatbelt) do not cover Windows — on this machine the sandbox is advisory, and the authoritative controls are the post-turn guards (§3) + changed-file scope check (§4); recorded as residual risk, never claimed as enforced (doc 6 §4) | **Least-permissive workable mode — never `bypassPermissions`.** `permissionMode: "acceptEdits"` + an authoritative `canUseTool` callback that (a) allowlists writable paths to {working tree minus `constraints.forbiddenPaths`, own session dir}, (b) denies reads of secret paths (§4), (c) denies git-mutating Bash by subcommand screening; `disallowedTools` as a second layer. Harness-level enforcement (in-process SDK callback), not OS-level — stated as such in §4 |
| Read-only mode (discovery/plan/S5 reviews) | read-only sandbox for specialist threads (same Windows caveat); primary-thread analysis turns guarded mechanically (§3) | `allowedTools: ["Read", "Grep", "Glob"]` (no Bash, no Write/Edit) + the same `canUseTool` secret-path read denial |
| Structured output | `outputSchema` on `run` | schema-constrained final message; parse + validate runner-side |
| Usage | `turn.completed.usage {input_tokens, cached_input_tokens, output_tokens}` | result message `usage` + `total_cost_usd` |
| Auth | existing `~/.codex/auth.json` (CLI 0.128.0 installed) | existing Claude Code install |
| Preflight (S3) | one trivial turn at session start proves auth/SDK before any real work | same |

**Instruction inheritance:** both agents auto-read their repo instruction file (`AGENTS.md` for Codex, `CLAUDE.md` for Claude — byte-identical mirrors), so every session inherits Hard Rules 1–25 natively. HR24 (migration pairing) is re-checked by the code reviewer; HR25's PM trace is satisfied by the Accept checkbox tick.

## 3 · Git policy enforcement (owner hard constraint)

**This policy is permanent** — it applies to every slice, every phase, and every future refinement; no later document may reintroduce worktrees or any other git write as an option.

**Allowed (read-only observation):** `git status --porcelain`, `git diff`, `git log`, `git show`, `git rev-parse`, `git for-each-ref`.
**Prohibited (anything that changes git state):** `worktree`, `branch`, `checkout`, `switch`, `add`, `commit`, `push`, `pull`, `fetch`, `merge`, `rebase`, `reset`, `restore`, `stash`, `tag`, git config edits.

**The distinction, explicitly:** agents may edit normal working-tree source files during the approved BUILDING phase; they may inspect Git through the approved read-only commands; they may **never** change Git metadata, refs, branches, index, commits, remotes, stash, tags, or worktrees. The system never creates or manages branches, clones, or worktrees. Suggested revert/rollback commands anywhere in the UI or artifacts are display-only — the tool never executes them.

Enforced in three independent layers — none of which is prompt trust:

1. **By construction:** the only git invocation point in the tooling is `gitread.mjs`, which shells out through an explicit **read-only subcommand allowlist**. No other module imports `child_process` for git. Grep-provable invariant (tested, doc 6 §2).
2. **Agent guards:** prompts ban git usage outright; after **every** turn the runner asserts via `gitread.mjs` that `rev-parse HEAD` and the ref list are unchanged (agent committed/branched → violation → BLOCKED + owner notified), that analysis turns left `status --porcelain` identical to the pre-turn snapshot (agent edited during analysis → log + surface + one retry, then BLOCKED — the tool never reverts), and that build-turn changed files avoid `constraints.forbiddenPaths`.
3. **Provider config:** Claude driver denies git-mutating Bash via tool rules; Codex build sandbox has network off and the prompt-level ban (its sandbox cannot selectively block git, hence layer 2 is the authoritative check for both providers).

## 4 · Approval & security boundaries

**Hard-coded human gates:** spec approval, plan approval (typed `APPROVE` when riskFlags include db-migration/security — validated server-side AND runner-side), UAT acceptance, shipped confirmation. Not configurable off.

**Honesty rule for this whole section:** the plan claims a protection only where a concrete mechanism enforces it, and names the enforcement level — *OS-level* (kernel sandbox), *harness-level* (in-process SDK permission callback / tool rules), or *detection* (post-turn verification that blocks the session after the fact). Prompt instructions are never counted as enforcement. Anything weaker than the claim is listed under **Residual risks** below and surfaced in the session view as "detection-only".

**Filesystem access contract (per phase):**

| Concern | Rule | Claude Code enforcement | Codex enforcement |
|---|---|---|---|
| Readable roots | repo working tree + own `.delivery/sessions/<id>/` | harness: `canUseTool` path check on Read/Grep/Glob + Bash arg screening | **not mechanically enforceable** (sandbox constrains writes, not reads) → prompt ban + residual risk |
| Secret paths — unreadable by default | `.env`, `.env.*`, private keys, credential files, auth stores, `~/.codex`, `~/.claude`, other user-profile dirs, `.delivery/` outside own session | harness: `canUseTool` deny patterns (heuristic for Bash) | **not mechanically enforceable** → prompt ban + residual risk |
| Writable roots — BUILDING only | working tree minus `constraints.forbiddenPaths` + own session dir (when the runner requires it) | harness: `canUseTool` allowlist on Write/Edit/Bash | OS-level `workspace-write` cwd restriction on Linux/macOS; **advisory on Windows** → detection via post-turn changed-file guard |
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
| Write outside {working tree minus forbidden paths, own session dir} | harness-level (Claude `canUseTool`) / OS-level on Linux-macOS, detection on Windows (Codex) + post-turn changed-file guard in all cases |
| Read secret/credential paths (`.env*`, keys, `~/.codex`, `~/.claude`, auth stores) | harness-level deny (Claude); **Codex: prompt ban only — residual risk, not claimed enforced** |
| Touch `~/.codex`, `~/.claude`, `.claude/`, `.codex/`, `.husky/`, repo git config | forbidden paths (harness/detection as above) + no code path |
| Execute revert/rollback commands | no code path — all such commands are display-only for the owner |
| Tick PM checkboxes before human Accept | writeback only runs on the Accept decision, exactly-once via `writeback.done` |

**Residual risks (documented honestly, not claimed as enforced):**

1. **Codex on Windows has no OS-level sandbox** (Landlock/Seatbelt are Linux/macOS). Its write restriction here rests on post-turn detection + the prompt ban, not prevention. A violating write can exist briefly before the session is BLOCKED.
2. **In-repo and on-disk secret reads cannot be fully prevented** for an agent with shell access: Claude's Bash screening is heuristic (an obfuscated command can evade it) and Codex cannot restrict reads at all. Default-deny is attempted where possible; mitigations are network-off (Codex), no delivery task ever requiring secrets, and the owner reviewing every diff at UAT.
3. **Harness-level enforcement is in-process**, not kernel-level — a provider SDK bug could bypass `canUseTool`/tool rules. Post-turn guards are the backstop.
4. **Detection guards act after the fact** — they BLOCK the session and notify the owner; they do not undo the violating action (the tool never reverts anything).

**Network posture:** pm-server unchanged — 127.0.0.1 bind + Host-header allowlist covers the new routes automatically. The runner talks only to the filesystem and the agent SDKs (whose own outbound API access is the CLI/SDK's, not the sandboxed agent's).

## 5 · Token & context optimization

- **Artifact-first prompting:** every turn = ~1–2 KB framing + the small packet JSON + **paths** to artifacts ("read `artifacts/spec.md`"), never pasted history — agents read files themselves inside their own context management.
- **One primary thread, phase-scoped turns:** each phase turn opens with "authoritative state is in the artifacts listed below; disregard prior scratch reasoning"; provider-native compaction handles long threads. Artifacts make threads replaceable — resume can fall back to a fresh thread without loss.
- **Specialists as fresh threads (S5):** review context stays diff-sized; disposable, never resumed.
- **Skill budget:** skills referenced by repo-relative path (committed `.claude/skills/**`), never inlined — cost only if the agent reads them; only the 1–3 classifier-mapped skills per session.
- **Bounded feedback:** validation failures fed back as last-200-lines-per-command excerpts; review diffs capped at 4000 lines with per-file fallback.
- **Model choice:** unset by default (provider defaults); `.delivery/config.json` can override `model` (primary) and `specialistModel` (cheaper reviews). No per-phase model switching in MVP.
- **Visibility:** per-phase usage table always rendered (doc 5 §6) — thrash is visible before it is expensive; `maxFixLoops:3` bounds the worst case.
