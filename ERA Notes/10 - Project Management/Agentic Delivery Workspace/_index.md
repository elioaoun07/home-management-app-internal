# Agentic Delivery Workspace — Plan Index

**Stamped:** 2026-07-11 · **Revised:** 2026-07-13 (S3 integration + local acceptance) · **Status:** 🚧 IN PROGRESS — S1 + S2 implemented 2026-07-12; S3 code and mutation-free automated acceptance implemented 2026-07-13 (both real drivers, provider wiring, structured spec/plan, persisted resume refs, usage normalization, strengthened guards). S3's two cost-bearing live DISCOVERY→PLAN runs remain unaccepted because the execution approval boundary denied transmitting this private workspace to OpenAI/Anthropic; explicit owner approval after that disclosure is required (doc 6 §1). S4–S6 have not started.
**Owner intent:** pick a topic + checklist item in the PM dashboard, launch a delivery session, and have one orchestrator agent (Codex or Claude Code) take it spec → plan → build → validate → review → UAT behind three human gates; Elio UATs in his own running dev app and handles all git personally.

> **Terminology (used consistently across all docs):** **Product Phase 1 = the complete MVP**, implemented through **engineering slices S1–S4**. Product Phase 1 ships the full Agent Catalog (every roster agent visible in the dashboard) but **enables only the standard agent set** (doc 3 §4). **Specialist expansion = S5**; **post-MVP improvements = S6**. "Phase 1" never means engineering slice S1.

---

## Verdict in one paragraph

Extend `scripts/pm-server.mjs` (the existing zero-dependency PM Command Center server) with a delivery layer: a `delivery` view in the dashboard, `/api/delivery/*` routes, and one detached runner process per session that drives a **provider-neutral agent driver** (Codex via `@openai/codex-sdk` or Claude Code via `@anthropic-ai/claude-agent-sdk`) through an explicit state machine — `SELECTED → DISCOVERY → SPEC_READY → PLAN_READY → BUILDING → VALIDATING → REVIEWING → UAT_READY → ACCEPTED → SHIPPED` plus `BLOCKED / NEEDS_DECISION / FAILED / CANCELLED`. All session state is explicit files under a gitignored `.delivery/` dir (packet, state, append-only events, artifacts, decisions, owner messages) — never conversation memory. Agents edit the live working tree directly; the tool performs **git reads only** and the owner does all commits/reverts. A deterministic classifier picks the minimum capability set per item from a **central agent registry** (`scripts/delivery/agent-registry.mjs`) that also drives a visible **Agent Catalog** in the dashboard — the complete roster is shown from day one, while **Product Phase 1 enables exactly the standard set: Delivery Orchestrator, Product/BA refinement, frontend implementation, backend implementation, automated testing, lite code review, and UAT generation** (doc 3 §4); independent specialists arrive in S5 and stay visible as "Planned" until then. This is deliberately not multi-agent roleplay: one Delivery Orchestrator owns the work item end-to-end; specialists are temporary, independent, and read-only.

> **Hard constraint (owner, 2026-07-11, PERMANENT — applies to every slice and every future refinement, not only the MVP): the tool and its agents perform NO git-state-changing action, ever.** Git **reads** (`status`, `diff`, `log`, `show`, `rev-parse`, `for-each-ref`) are allowed — they power the changed-files panel, the UAT diff, and the misbehavior guards. **Writes** (`worktree`, `branch`, `checkout`/`switch`, `add`, `commit`, `push`/`pull`/`fetch`, `merge`/`rebase`, `reset`/`restore`, `stash`, `tag`, git config changes, …) are prohibited — enforced by construction (the only git wrapper in the codebase is a read-only allowlist, doc 4) plus post-turn HEAD/ref guards on the agents. Violation = session BLOCKED + owner notified.
>
> **The distinction, explicitly:** agents may edit normal working-tree source files during the approved BUILDING phase. They may inspect Git through the approved read-only commands. They may **never** change Git metadata, refs, branches, index, commits, remotes, stash, tags, or worktrees. The system itself never creates or manages branches, clones, or worktrees. Where the tool shows revert/rollback commands, they are **display-only** — the owner runs them manually; the tool never executes them.

## Decisions locked (2026-07-11 with Elio; revised 2026-07-12 per owner feedback — plan remains DRAFT until re-approved)

| Decision | Choice |
|---|---|
| Agent driver | Provider-neutral driver interface; **both** `@openai/codex-sdk` and `@anthropic-ai/claude-agent-sdk` implemented in slice S3 (devDependencies added then, not before); no CLI-spawn fallback |
| Git policy | Reads allowed, writes prohibited (hard constraint above); the owner owns every commit and every revert |
| Change isolation | **None in Product Phase 1** — direct edits to the live working tree so changes hot-reload into the owner's running `pnpm dev` app; one build-phase session at a time; dirty-tree warning at launch. Any future isolation (S6) is **non-Git only**: a temporary filesystem copy, an OS-level sandbox, a container-mounted copy, a copy-on-write workspace, or a manually prepared external clone that the delivery tooling does not create or manage — never a worktree, branch, or tool-managed clone |
| Approval gates | Always 3: `SPEC_READY`, `PLAN_READY` (typed `APPROVE` when risk flags include db-migration/security), `UAT_READY` — plus owner-marked `SHIPPED` |
| Mid-session comms | Interactive message composer on the session page; messages persist as session events and are incorporated at the **next workflow boundary** (never interrupt a running turn; never substitute for a gate decision) |
| Specialist scope | Full roster registered in the central agent registry and visible in the Agent Catalog; Product Phase 1 enables the standard set only (orchestrator; product/BA refinement, frontend/backend implementation as inline capabilities; automated testing; lite code review; UAT generation); domain skills (e.g. `money-rules`) are injected into the orchestrator's prompts, never independent agents in Phase 1; independent specialist review threads land in S5 |
| Agent Catalog & registry | `scripts/delivery/agent-registry.mjs` is the single source of truth for all agents. The Agent Catalog, classifier capability definitions, launch capability preview, session agent-output cards, phase availability, and blocking/advisory metadata all derive from it — no duplicated lists. The dashboard catalog shows the complete roster with planned agents visibly marked unavailable |
| Session launch flow | Explicit **New Delivery Session** flow on the Delivery page (topic → open item → preview → provider → capability set → risk/dirty warnings → launch); the task-row Deliver button is a preselection shortcut into the same flow, never the only path (doc 5 §2) |
| Dashboard visibility | Every agent (orchestrator + each specialist) gets its own expandable output card — collapsed to one calm line, expanded to its rendered artifact; raw event noise stays in the timeline (doc 5) |
| Accept trace | Tick the source checkbox (drift-guarded, optional per accept); no extra vault writeback |
| Delivery mode | Build-to-UAT only; no deploy path exists in the tool; `SHIPPED` is recorded after the owner's own commit |
| Token governance (added 2026-07-12, owner cost review) | Between-turn session token budget, unset until baselined against real measurements (doc 4 §5); per-phase effort defaults + dashboard model/effort selectors (doc 4 §5, doc 5 §2); configurable specialist model tiers (economy/balanced/strong), no hardcoded model (doc 4 §5); primary-thread reuse by default with defined fresh-thread triggers — long idle, excessive context growth, failed resume, instability (doc 4 §5); S5 specialists keep fresh disposable threads unchanged; a CLI-vs-workspace consumption benchmark (doc 6 §1 exit gate) replaces estimates with measured ratios before any budget default is set |

## Costs

| Item | Cost | Recurring? |
|---|---|---|
| `@openai/codex-sdk` + `@anthropic-ai/claude-agent-sdk` (devDeps, added in S3) | $0 | — |
| Agent tokens per session | billed per the provider auth method already configured for that CLI (subscription plan or metered API key — the delivery tool introduces no separate billing path); per-phase usage always visible (doc 5) — actual delivery-session vs CLI-session consumption is unmeasured until the benchmark in doc 6 §1 runs; treat any ratio as unverified until then | per session |
| Optional cost column | owner-set `priceIn`/`priceOut` in `.delivery/config.json` — no hardcoded price table to rot | — |
| Session token budget | between-turn enforcement (doc 4 §5), `sessionTokens` unset by default — no arbitrary ceiling until baselined | per session, opt-in |

## Phase overview

| Slice | Scope | Effort |
|---|---|---|
| S3 🚧 | **Both real drivers** (SDKs pinned against installed `.d.ts`), real DISCOVERY/SPEC/PLAN turns, no-git-write + no-drift guards, usage capture — *(code + mutation-free automated acceptance IMPLEMENTED 2026-07-13; live provider turns approval-blocked)* | M · 1–1.5d |
| S4 | BUILDING + VALIDATING + fix loop + self-review + UAT assembly — **MVP complete** | M/L · 1.5–2d |
| S5 | Independent specialist threads (code/security/db/ux/architecture reviews), risk-flag typed approval, NEEDS_DECISION flow, "in delivery" badges on task rows | M · 1d |
| S6 (post-MVP) | Isolation upgrade (**non-Git only**: temporary filesystem copy / OS-level sandbox / container-mounted copy / copy-on-write workspace — never worktrees, branches, or tool-managed clones), screenshots in UAT, ship mode (release/rollback prep), archive & cleanup UX | open |

**Product Phase 1 (MVP) = engineering slices S1–S4, ≈ 4.5–6 dev days.**

## Reading order

1. [[1 - Current State & Evidence]] — **frozen 2026-07-11 pre-implementation baseline** (what pm-server, the dashboard, and the agent installs were *before* any delivery code existed, evidence-stamped) — for current state, see doc 6 §1 and this file's status line above
2. [[2 - Architecture & Process Model]] — components, process model, direct-edit workspace, persistence, API + SSE
3. [[3 - State Machine, Packet & Classifier]] — packet schema, transition table, orchestrator phase contracts, classifier, **agent registry & full catalog roster**
4. [[4 - Agent Drivers & Security]] — both SDK integrations, git-read-only enforcement, approval boundaries, token strategy
5. [[5 - Dashboard UX, UAT & Recovery]] — screens, message composer, agent-output cards, UAT package, crash matrix
6. [[6 - Roadmap, Testing & Risks]] — slices with exit gates, automated test strategy, MVP definition of done, risks & rejected alternatives

## Related artifacts

- `scripts/pm-server.mjs` + `scripts/pm/` — the host this plan extends (routing/SSE/mutations verified in doc 1)
- `.claude/skills/` — the 14 playbooks reused as capability prompts (`start-task` router, `finish-task` DoD gate)
- `AGENTS.md` / `CODEX.md` / `CLAUDE.md` — auto-synced mirrors; both agent brands inherit Hard Rules 1–25 in any repo session
- `docs/WEAR_OS_NATIVE_APP_IMPLEMENTATION.md` — precedent "implementation brief for Codex" format
- `tests/pm-mutations.test.ts` — house pattern for testing tooling modules with vitest
- [Native App](<../Native App/_index.md>) — the plan-folder format precedent this folder follows

## Freshness protocol

Trust this plan as of 2026-07-11. Before implementing any slice, delta with `git log --since=2026-07-11 -- scripts/pm-server.mjs scripts/pm package.json tsconfig.json .gitignore` — those are the load-bearing integration points. If `codex-cli` or the Claude Code install has been upgraded since, re-pin both SDK surfaces against their installed `.d.ts` before starting S3 (known naming drift, doc 4).
