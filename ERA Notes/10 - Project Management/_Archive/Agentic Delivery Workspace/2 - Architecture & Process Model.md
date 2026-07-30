# 2 — Architecture & Process Model

**Stamped:** 2026-07-11 · Covers plan sections: proposed architecture (2), workspace/change-isolation strategy (9), persistence model (10), API endpoints & event model (11)

## 1 · Components

| Component | File(s) | Process | Role |
|---|---|---|---|
| pm-server (extended) | `scripts/pm-server.mjs` (edit) + `scripts/delivery/server-routes.mjs` (new) | existing long-lived server | `/api/delivery/*` routes, spawns/monitors runners, watches `.delivery/sessions/` → named SSE events, writes decision + message files, checkbox writeback on Accept |
| Delivery runner | `scripts/delivery/run-session.mjs` (new) | **one detached child process per session** | Owns the state machine: baseline capture, agent turns, validation commands, artifact writing, boundary-time message intake |
| Driver layer | `scripts/delivery/drivers/{driver,codex,claude,fake}.mjs` (new) | in-runner | Provider-neutral interface (start/resume/runTurn streamed, normalized events + usage); Codex + Claude Code implementations; `fake` for tests. SDKs dynamic-`import()`ed here ONLY |
| Pure core | `scripts/delivery/{state-machine,packet,classify,agent-registry,events,fsx,prompts,gitread}.mjs` (new) | library | Transition table, packet builder, capability classifier, **central agent registry** (single source of truth for catalog / classifier definitions / launch preview / output cards / phase availability / blocking metadata), ndjson append/replay, atomic writes, prompt templates, **read-only git wrapper** — all unit-testable, zero-dep |
| Dashboard UI | `scripts/pm/client.js` + `styles.css` (edits) | browser | `delivery` + `delivery-session` routes, **New Delivery Session flow**, **Agent Catalog**, list/detail, timeline, gate panels, message composer, agent-output cards |
| Session store | `.delivery/` at repo root (gitignored) | files | Single source of truth: packet, state, events, artifacts, decisions, messages |

## 2 · Process model

```
pnpm pm  ──►  pm-server.mjs (long-lived, 127.0.0.1:4317)
                 │  POST /api/delivery/start
                 ├── spawn(node scripts/delivery/run-session.mjs --session <id>,
                 │        {detached, windowsHide, stdio → runner.log}).unref()
                 │        → runner survives pm-server restarts
                 ├── fs.watch(".delivery/sessions", {recursive:true}) → named SSE "delivery" frames
                 ├── POST /api/delivery/decision → writes sessions/<id>/decisions/<seq>-<gate>.json
                 └── POST /api/delivery/message  → writes sessions/<id>/messages/<seq>.json

run-session.mjs (one per session)
                 ├── baseline capture (read-only git: status --porcelain + rev-parse HEAD)
                 ├── driver: ONE primary agent thread (cwd = repo root, direct edits)
                 │     + short-lived read-only specialist threads (S5, reviews only)
                 ├── spawns pnpm typecheck / lint / test at repo root (VALIDATING)
                 ├── writes state.json / events.ndjson / artifacts/** (atomic tmp+rename)
                 └── fs.watch(own decisions/ + messages/) + 2 s poll → consumes gates & owner messages
```

**Single-writer discipline (prevents all file races):**

| Path | Writer | Reader(s) |
|---|---|---|
| `state.json`, `events.ndjson`, `artifacts/**`, `runner.json` | runner only | pm-server, UI |
| `decisions/*.json`, `messages/*.json`, `writeback.done` | pm-server only | runner (decisions/messages), pm-server (marker) |
| PM markdown (`ERA Notes/10 - …`) | pm-server only (existing op handlers) | everything existing |
| Working-tree files | agent (build turns only) | validation, owner |

## 3 · Direct-edit workspace strategy (owner's git policy)

Sessions run against the **live working tree at repo root** — no worktree, no branch, no commits, ever (permanent owner policy, doc 4 §3 — not an MVP simplification).

- **Baseline:** at start the runner snapshots `git status --porcelain` (hashed) + `git rev-parse HEAD` (read-only). Everything the session changed is attributed as the delta vs this baseline.
- **Dirty-start warning:** if the tree is dirty at launch, the dashboard warns ("agent edits will interleave with your uncommitted changes") and requires an explicit confirm; it never hard-blocks.
- **Hot-reload UAT:** because edits land in the live tree, the owner's running `pnpm dev` app rebuilds automatically — UAT happens in the real app with zero setup. This is the intended workflow, not a side effect.
- **Concurrency:** exactly **one non-terminal session past PLAN_READY at a time** (global build lock, HTTP 429 on a second start). This structurally enforces "no parallel agents editing overlapping files" — there is never a second writer. Sessions parked at gates don't hold the lock.
- **Cancel/revert:** CANCELLED leaves the tree untouched; the UI shows the changed-file list plus **display-only** suggested revert instructions (`git checkout -- <files>`, delete-new-file commands) for the owner to copy and run manually. No code path in the tool executes a revert command — this holds everywhere revert/rollback commands appear (here, the UAT `rollback.md`, doc 5 §5).
- **Deferred (S6):** the "clean sandbox / UAT environment" refinement — an opt-in **non-Git** isolated copy per session: a temporary filesystem copy, an OS-level sandbox, a container-mounted copy, or a copy-on-write workspace. If an external clone is ever used, the owner prepares it manually — the delivery tooling never creates or manages branches, clones, or worktrees. Note for then: `tsconfig.json` includes `**/*.ts` with only `node_modules` excluded, so any in-repo copy must be a dot-dir or live outside the repo.

## 4 · Persistence model (`.delivery/`, repo root, fully gitignored)

```
.delivery/
  config.json                      {maxConcurrentSessions:1, maxFixLoops:3, model:null,
                                    effort:{discovery:"medium", plan:"high", building:"high",
                                            review:"medium"},
                                    specialistTiers:{economy:null, balanced:null, strong:null},
                                    budget:{sessionTokens:null, warnAtPct:70},
                                    priceIn:null, priceOut:null}
                                    -- effort/specialistTiers/budget per doc 4 §5; all null/default
                                    until the CLI-vs-workspace benchmark (doc 6 §1) sets real values
  sessions/<sessionId>/            sessionId = s-<yyyymmdd>-<hhmmss>-<rand4>
    packet.json                    doc 3 §1 (written by pm-server at start; enriched once by runner)
    state.json                     {schemaVersion, sessionId, state, awaiting|null,
                                    phaseHistory:[{state, enteredAt, exitedAt}], agent,
                                    driver:{threadId|sessionId, specialists:{cap:id}},
                                    workspace:{baseHead, dirtyAtStart, changedFiles[]},
                                    fixLoop, usage:{perPhase:{}, total:{}},
                                    decisionsProcessed, messagesProcessed, lastError|null, updatedAt}
    events.ndjson                  append-only {ts, seq, type, phase, agent, data}
    runner.json                    {pid, startedAt, heartbeatAt, node} — rewritten every 5 s
    runner.log                     detached-process stdout/stderr
    decisions/0001-spec.json       {seq, gate, decision, note?, confirmText?, tickCheckbox?, at}
    messages/0001.json             {seq, text, at} — owner composer messages (doc 5 §3)
    writeback.done                 exactly-once Accept-writeback marker
    artifacts/
      inputs/                      campaign md snapshots fed to discovery
      spec.md  plan.md  build-log.md
      validation.json  validation-report.md
      review-self.md  review-<capability>.md (S5)
      uat/                         doc 5 §5
```

All JSON writes are atomic (`fsx.mjs`: write `<name>.tmp` + `renameSync`, EPERM retry ×3 — same-volume rename is effectively atomic on NTFS). `events.ndjson` is append-only via `appendFileSync`. **Nothing under `.delivery/` is ever committed** (one new `.gitignore` line: `/.delivery/`).

## 5 · API endpoints

New GET/POST branches are inserted in `pm-server.mjs` **before** the generic `POST /api/<op>` MUTATIONS lookup (currently line 344) and before the 404; handlers live in `server-routes.mjs` and reuse `fail()` / `sendJson()` / `readBody()` so errors keep the `{error}` JSON contract the client's `apiPost` already understands. The MUTATIONS map is untouched.

| Method + path | Request → Response | Notes |
|---|---|---|
| POST `/api/delivery/start` | `{file, cbidx, expectText, agent:"codex"\|"claude", model?, effort?:{discovery?,plan?,building?,review?}, dirtyAck?, options?:{capabilitiesDrop?:[]}}` → `{sessionId}` | Re-reads the md; validates checkbox open + text match (409 on drift, same pattern as `opToggle`); 409 if the item is already in an active session; 429 on build-lock/concurrency; 400 if tree dirty and no `dirtyAck`; server recomputes the capability set from the registry + classifier and rejects (400) any `capabilitiesDrop` naming a locked always-on row. `model`/`effort` default from `.delivery/config.json` when omitted (doc 4 §5) and are written into `packet.agentConfig` (doc 3 §1) |
| GET `/api/delivery/sessions` | → `{sessions:[{sessionId, state, awaiting, agent, item:{text,id,campaign,pmFile,cbidx}, updatedAt, usageTotal, runnerAlive}]}` | Reads each `state.json` |
| GET `/api/delivery/session?id=` | → `{packet, state, artifacts:[{path,size,mtimeMs}], runner:{alive,heartbeatAt}}` | 404 unknown id |
| GET `/api/delivery/events?id=&after=` | → `{events:[…], lastSeq}` | seq cursor, cap 500 per call |
| GET `/api/delivery/artifact?id=&path=` | → `{name, content, lang}` | `resolveInside(sessionDir/artifacts, path)`; ext allowlist md/json/ndjson/txt/patch/log; 1 MB cap |
| POST `/api/delivery/decision` | `{id, gate, decision:"approve"\|"reject"\|"accept"\|"answer"\|"retry"\|"cancel"\|"shipped", note?, confirmText?, tickCheckbox?, answer?}` → `{ok, seq}` | 409 if `gate !== state.awaiting.gate`; risk-flagged plan approve requires `confirmText === "APPROVE"` (validated server-side too); cancel with dead runner → pm-server marks CANCELLED directly |
| POST `/api/delivery/message` | `{id, text}` → `{ok, seq}` | Owner composer (doc 5 §3); 409 if session terminal; text cap 8 KB |
| POST `/api/delivery/resume` | `{id}` → `{ok}` | 409 if heartbeat fresh; respawns runner with `--resume` |

**No separate preview endpoint is needed for the New Delivery Session flow:** `agent-registry.mjs` and `classify.mjs` are pure zero-dep modules injected verbatim into the browser exactly like `scanCheckboxes` already is (`ui.mjs:30` precedent), so the Agent Catalog and the launch capability preview are computed client-side from the same code the server runs — they cannot drift. The server's recomputation at `start` remains authoritative.

## 6 · Event model (SSE)

Reuse the existing `/api/events` connection with **named** frames: `event: delivery` + `data: {"sessionId":"…"}`, broadcast from a second debounced `fs.watch(".delivery/sessions", {recursive:true})` (created lazily, wrapped in the same try/catch fallback as the PM watcher). The current client only handles unnamed frames via `es.onmessage`, so named events are invisible to all existing code paths — no spurious full markdown reloads, no static-twin impact, one TCP connection total. The client adds one `es.addEventListener("delivery", …)` that refetches session data when a delivery route is active (150 ms debounce, mirroring the existing `sseTimer` pattern).

Accept-writeback deliberately does **not** set `suppressUntil`: the checkbox tick should trigger the normal PM `data: reload` so every open dashboard sees it.

## 7 · Touch points

| Path | Change |
|---|---|
| `scripts/pm-server.mjs` | Delivery GET/POST branches before the MUTATIONS lookup (line 344); runner spawn/monitor; second watcher + named SSE broadcast; Accept writeback via in-process `opToggle` (textHash re-verified first) |
| `scripts/delivery/server-routes.mjs` (new) | All route handlers; build-lock; decision/message file writes |
| `scripts/delivery/run-session.mjs` (new) | Detached runner: state machine loop, phase execution, heartbeat, resume |
| `scripts/delivery/drivers/*.mjs` (new) | Provider-neutral driver + codex/claude/fake implementations (doc 4) |
| `scripts/delivery/{state-machine,packet,classify,agent-registry,events,fsx,prompts,gitread}.mjs` (new) | Pure core modules (docs 3–4), incl. the central agent registry |
| `scripts/pm/client.js` | Route types/setters/dispatch branches, quicklink + icon + wiring, SSE listener, screens incl. New Delivery Session flow, Agent Catalog, composer + agent-output cards (doc 5) |
| `scripts/pm/styles.css` | Delivery view styles — calm, muted, monochrome badges |
| `.gitignore` | `+ /.delivery/` |
| `package.json` | S3 only: `@openai/codex-sdk` + `@anthropic-ai/claude-agent-sdk` as devDependencies |
| `tests/delivery/*.test.ts` (new) | Suites per doc 6 §2 |

Explicitly **not** touched: `src/`, `migrations/`, `scripts/build-pm-dashboard.mjs`, the MUTATIONS map, `.claude/`, `.codex/`, `.husky/`.
