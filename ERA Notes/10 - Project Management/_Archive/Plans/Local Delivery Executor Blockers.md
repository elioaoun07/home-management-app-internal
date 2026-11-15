---
created: 2026-11-15
updated: 2026-11-15
type: plan
status: implemented
owner: Elio
evidence_cutoff: 2026-11-15; HEAD e3d4be6c, clean tree; failed HUB-118 runs under `.delivery/local/`; `codex sandbox` probes (no model calls)
---

# Local Delivery executor blockers

**Incorporated 2026-11-15 as DLV-157.** Steps 1–4 implemented with option 3A (no-shell Claude); verification is recorded in the [Delivery Master Book](<../../Delivery/Delivery — Master Book.md#dlv-157>). Step 5 remains an owner-started subscription retest in [Delivery UAT](<../../../../docs/Delivery-UAT.md#windows-local-executor-retest--dlv-157>). Optional cleanup was not performed. The original diagnosis and plan follow as historical evidence.

No local session could start work. There were two separate causes, one per executor.

| Executor | What you saw | Cause |
| --- | --- | --- |
| Codex | "workspace is mounted read-only", then `candidate needs a change` | The worker's private Codex home has no Windows sandbox setting, so Codex drops to read-only and rejects every command |
| Claude | Sandbox error at start | Claude's Bash sandbox does not exist on native Windows, and the adapter refuses to run without it |

## Step 1 — Codex: turn its Windows sandbox on (restriction kept)

**Evidence.** The run's own record (`.delivery/local/local-8a5ff550…/home/.codex/sessions/…jsonl`) shows `sandbox_policy: read-only` although the adapter asked for `workspace-write`, and every command ended `rejected: blocked by policy`. Your own `~/.codex/config.toml` has `[windows] sandbox = "elevated"`; the private home written at `scripts/delivery-v2/local-lane.mjs:149` has only the two login lines.

**Change.** In `scripts/delivery-v2/local-lane.mjs:149`, on Windows, add two lines to the private `config.toml`:

```toml
[windows]
sandbox = "unelevated"
```

Use `unelevated`, not `elevated`: the elevated sandbox keeps its setup (sandbox users, secrets) inside the Codex home, and the private home is new on every run, so it would need an admin prompt each time. Not tested; inferred from where `~/.codex/.sandbox-secrets` lives.

**Test.** Add an assertion in `tests/delivery-v2/local-lane.test.ts` that the private Codex config contains the `[windows]` block on `win32`.

**Probe results (SDK's `codex.exe` 0.156.1, fresh private home, no model calls):**

| Check | Without the block | With `unelevated` |
| --- | --- | --- |
| Write inside the worktree | denied | allowed |
| Write to the main checkout | — | denied |
| Network | — | blocked |
| Read outside the worktree (main checkout's `.env`) | — | **allowed** |

The open read is the known Codex gap already stated in `adapters/registry.mjs` ("its read boundary is observed to fail"). The network block is what stops a worker using anything it reads. Temp folders are also writable; that is Codex's default.

## Step 2 — Both: stop telling the worker to commit

The instruction at `scripts/delivery-v2/local-lane.mjs:174` says "Commit the change" and "commit it". Neither worker can: Codex's sandbox denies writes to the main checkout's `.git`, and Claude's tool guard refuses git-mutating commands. The supervisor already commits leftover work (`local-lane.mjs:187-190`).

**Change.** Replace both commit phrases with: "Do not commit; the supervisor commits your work."

## Step 3 — Claude on Windows: pick one

| Option | Effort | Result |
| --- | --- | --- |
| **3A. No-shell Claude (recommended)** | Small code change | Claude runs on Windows with file tools only |
| 3B. WSL2 | One-time setup, about an hour | Full Claude with sandboxed shell |
| Sandbox off, shell on | — | **Not offered** |

Why the last one is out: an unsandboxed shell has network access and can read the main checkout's `.env`, and local dev points at the production database. The command guard is accident prevention, not a boundary. That breaks Hard Rule #26.

### 3A. No-shell Claude

The sandbox only protects the shell. Without a shell there is nothing for it to protect: file tools are already confined to the worktree by `canUseTool`, and the supervisor already runs typecheck, lint, test and `pm:lint` after the session.

In `scripts/delivery-v2/adapters/claude.mjs` `buildSessionOptions` (lines 234-250), when `local` and `process.platform === "win32"`:

1. Remove `"Bash"` from `tools` and add it to `disallowedTools`.
2. Set `sandbox` to `{ enabled: false }`. Everywhere else it stays `{ enabled: true, failIfUnavailable: true }`.
3. Add `.claude`, `.codex`, `.agents`, `.husky` to `forbiddenPaths`. Project hooks run outside any sandbox, so the worker must not be able to edit them.
4. In the instruction (`local-lane.mjs:174`), add for this case: "You have no shell. The supervisor runs the checks after you finish."

Update the sandbox assertions in `tests/delivery-v2/local-lane.test.ts:126-136` and `tests/delivery-v2/executor-selection.test.ts:196-199`: the rule becomes "a shell never runs unsandboxed", not "the sandbox is always on".

**Cost.** The worker cannot run tests while it works. If a host check fails, the run fails with no retry. Expect more failed runs than Codex, most of all on Haiku.

### 3B. WSL2

Only the `docker-desktop` distro exists today.

1. `wsl --install -d Ubuntu`, then reboot.
2. Inside Ubuntu: install Node 22, pnpm, `bubblewrap` and `socat`.
3. Clone the repo into the Linux home (not `/mnt/c`, which is slow) and run `pnpm install`.
4. Install Claude Code and sign in with the subscription.
5. Run `pnpm pm` from Ubuntu and open `http://127.0.0.1:4317`.

No code change. The Windows checkout and the WSL checkout are separate copies.

## Step 4 — Verify without spending

Run from PowerShell:

```powershell
pnpm vitest run tests/delivery-v2
pnpm typecheck
```

## Step 5 — Retest (owner starts it; this uses the subscription)

1. Start HUB-118 with Codex, GPT-6 Luna, Medium.
2. Expected activity: file reads, then edits, then "Host checks started". No "read-only" or "blocked by policy" message.
3. If you chose 3A or 3B, repeat with Claude.

Not yet exercised: the supervisor's own commit and the four host checks. They are the next place a run could stop.

## Optional — clear the failed attempts

Six HUB-118 worktrees and `delivery/HUB-118*` branches remain under `..\budget-app-delivery\`. The lane keeps failed attempts on purpose, so removing them is your call:

```powershell
git worktree list
git worktree remove --force <path>
git branch -D <branch>
```
