# 3 — State Machine, Packet & Classifier

**Stamped:** 2026-07-11 · **Revised:** 2026-07-12 · Covers plan sections: work-item packet schema (4), delivery-session state machine (5), orchestrator responsibilities (6), agent registry + Agent Catalog roster + specialist activation rules (7)

## 1 · Work-item packet (`packet.json`, schemaVersion 1)

Built server-side at `start` from the live file (drift-checked), enriched once by the runner after SPEC approval (acceptance criteria). Identity mirrors what `fileTasks` / `parseTaskMeta` / `scanCheckboxes` already extract, so the dashboard can join sessions back to task rows. `capabilities[].name` values are capability keys defined in `agent-registry.mjs` (§4) — the packet never invents capability names of its own.

`agentConfig` carries the session's model/effort choices from the New Delivery Session flow (doc 5 §2, step 4a) into the runner: `model` is the provider model override (`null` = provider default); `effort` is a per-phase map so the runner can pass the right level into each `runTurn` call, seeded from the config defaults (doc 4 §5) and overridable at launch. Named `agentConfig.effort` — not to be confused with `item.effort`, the S/M/L task-size field parsed from the checklist line. The driver interface (doc 4 §1) receives the resolved per-phase value on each `startSession`/`runTurn` call, not the whole map.

```json
{
  "schemaVersion": 1,
  "sessionId": "s-20260711-143210-k7x2",
  "createdAt": "…",
  "mode": "uat",
  "agent": "codex",
  "agentConfig": {
    "model": null,
    "effort": {
      "discovery": "medium",
      "plan": "high",
      "building": "high",
      "review": "medium"
    }
  },
  "item": {
    "pmFile": "Budget/4 - Checklist.md",
    "cbidx": 17,
    "lineText": "**N4** Fix rounding drift in allocation splits _(blocker - M)_",
    "id": "N4",
    "text": "Fix rounding drift in allocation splits",
    "heading": "Now",
    "sectionRank": 0,
    "sev": "blocker",
    "effort": "M",
    "campaign": "Budget",
    "sourceMtimeMs": 0,
    "textHash": "sha1(trimmed lineText)"
  },
  "context": {
    "campaignFiles": ["Budget/1 - Feature State.md", "…2…", "…3…", "…4…"],
    "relatedNotes": []
  },
  "scopeHints": {
    "keywords": ["rounding", "allocation", "splits"],
    "globs": ["src/features/budget/**", "src/app/api/budget/**"],
    "modules": ["budget"]
  },
  "capabilities": [
    {
      "name": "backend-impl",
      "reason": "api glob",
      "source": "rule",
      "blocking": true
    },
    {
      "name": "automated-testing",
      "reason": "always-on",
      "source": "rule",
      "blocking": true
    },
    {
      "name": "code-review",
      "reason": "always-on",
      "source": "rule",
      "blocking": true
    },
    {
      "name": "uat-generation",
      "reason": "always-on",
      "source": "rule",
      "blocking": true
    }
  ],
  "constraints": {
    "maxFixLoops": 3,
    "allowNewDeps": false,
    "forbiddenPaths": ["src/components/ui/**"],
    "gitPolicy": "read-only",
    "approvalGates": ["SPEC_READY", "PLAN_READY", "UAT_READY"]
  },
  "skills": [
    {
      "capability": "backend-impl",
      "path": ".claude/skills/api-route/SKILL.md"
    },
    {
      "capability": "money-domain",
      "path": ".claude/skills/money-rules/SKILL.md"
    }
  ],
  "acceptanceCriteria": [
    { "id": "AC1", "text": "(filled from approved spec)", "source": "spec" }
  ],
  "workspace": {
    "baseHead": "b03b2bb",
    "dirtyAtStart": false,
    "baselineStatusHash": "sha1(porcelain)"
  }
}
```

## 2 · State machine

States: `SELECTED, DISCOVERY, SPEC_READY, PLAN_READY, BUILDING, VALIDATING, REVIEWING, UAT_READY, ACCEPTED, SHIPPED` + `BLOCKED, NEEDS_DECISION, FAILED, CANCELLED`. Implemented as a pure transition table in `state-machine.mjs`: `next(state, event) → {to, effects[]} | throw`. Human gates (**hard-coded, not configurable off**): `SPEC_READY`, `PLAN_READY`, `UAT_READY`, plus owner-marked `SHIPPED`.

| From             | Event                                                                 | To                       | Side effects / notes                                                                                                                                                                                                          | Trigger                                          |
| ---------------- | --------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| —                | `session.start`                                                       | SELECTED                 | packet + session dir; runner spawned                                                                                                                                                                                          | owner (POST)                                     |
| SELECTED         | `baseline.captured`                                                   | DISCOVERY                | read-only status+HEAD snapshot; primary agent thread started                                                                                                                                                                  | runner                                           |
| SELECTED         | `baseline.failed`                                                     | FAILED                   | setup failure before any work product; no Resume, only re-start                                                                                                                                                               | runner                                           |
| DISCOVERY        | `spec.written`                                                        | SPEC_READY               | `artifacts/spec.md` from structured output; `awaiting={gate:"spec"}`                                                                                                                                                          | runner                                           |
| SPEC_READY       | `decision.approve`                                                    | → plan turn → PLAN_READY | capability set confirmed/edited at this gate; `awaiting={gate:"plan"}` when plan.md lands                                                                                                                                     | owner → runner                                   |
| SPEC_READY       | `decision.reject(note)`                                               | DISCOVERY                | note feeds revision turn; spec.md v2                                                                                                                                                                                          | owner                                            |
| PLAN_READY       | `decision.approve`                                                    | BUILDING                 | typed `APPROVE` required when riskFlags ∋ db-migration \| security (checked server-side AND runner-side)                                                                                                                      | owner                                            |
| PLAN_READY       | `decision.reject(note)`                                               | DISCOVERY                | re-plan with note                                                                                                                                                                                                             | owner                                            |
| BUILDING         | `build.step.done` ×N / `build.complete`                               | BUILDING / VALIDATING    | agent edits working tree per plan step; per-step events; **no commits ever**                                                                                                                                                  | runner                                           |
| VALIDATING       | `validation.pass`                                                     | REVIEWING                | `validation.json` + report                                                                                                                                                                                                    | runner (spawns `pnpm typecheck && lint && test`) |
| VALIDATING       | `validation.fail` (loop < max)                                        | BUILDING                 | bounded failure excerpt (last 200 lines/cmd) → fix turn                                                                                                                                                                       | runner                                           |
| VALIDATING       | `validation.fail` (loop = max)                                        | BLOCKED                  | `awaiting={gate:"blocked"}`                                                                                                                                                                                                   | runner                                           |
| REVIEWING        | `reviews.pass`                                                        | UAT_READY                | uat/\*\* assembled; `awaiting={gate:"uat"}`                                                                                                                                                                                   | runner                                           |
| REVIEWING        | `reviews.blocking` (loop < max / = max)                               | BUILDING / BLOCKED       | findings → fix turn → re-validate → re-review                                                                                                                                                                                 | runner                                           |
| UAT_READY        | `decision.accept`                                                     | ACCEPTED                 | pm-server (exactly-once via `writeback.done`): re-verify `textHash` → `opToggle` the source checkbox (drift → skip + surface note, never guess a line); no `suppressUntil` so all clients see the tick                        | owner                                            |
| UAT_READY        | `decision.reject(note)`                                               | BUILDING                 | counts as a fix loop                                                                                                                                                                                                          | owner                                            |
| ACCEPTED         | `decision.shipped`                                                    | SHIPPED                  | records `git rev-parse HEAD` (read-only) after the owner's own commit                                                                                                                                                         | owner                                            |
| any active       | `question.raised`                                                     | NEEDS_DECISION           | `awaiting={gate:"question", returnTo}`; question artifact with options                                                                                                                                                        | runner (agent structured output)                 |
| any active       | `budget.exhausted` (session token usage ≥ configured `sessionTokens`) | NEEDS_DECISION           | Checked **between turns**, before composing the next agent turn — never mid-turn; `awaiting={gate:"question", returnTo}` with options "extend budget by N" / "cancel session"; no-op when `sessionTokens` is unset (doc 4 §5) | runner                                           |
| NEEDS_DECISION   | `decision.answer`                                                     | `returnTo`               | answer injected into next turn                                                                                                                                                                                                | owner                                            |
| any active       | `error.fatal` (after retries)                                         | BLOCKED                  | `lastError` in state.json; Retry re-enters phase idempotently / Cancel                                                                                                                                                        | runner                                           |
| any non-terminal | `decision.cancel`                                                     | CANCELLED                | tree left as-is; changed-file list + revert instructions shown; session dir retained for audit                                                                                                                                | owner                                            |
| any active       | `runner.crashed` (stale heartbeat + pid probe)                        | _(state kept)_           | UI shows stale badge + Resume → respawn `--resume`                                                                                                                                                                            | pm-server                                        |

Semantics: **BLOCKED** = technical impasse needing human Retry/Cancel. **NEEDS_DECISION** = concrete question with options and a `returnTo`. **FAILED** = unrecoverable setup failure before any work product. **CANCELLED** = terminal, audited, never auto-reverts.

**Owner messages and boundaries:** composer messages (doc 5 §3) never transition state and never substitute for a gate decision. The runner drains unread messages at every **workflow boundary** — immediately before composing any next agent turn prompt, and between BUILDING plan steps — logs each as an `owner.message` event on arrival (visible in the timeline immediately), and injects the drained batch into the next prompt under an "Owner guidance (mid-session)" section. A message that changes scope mid-BUILDING may cause the orchestrator to raise `question.raised` rather than silently diverging from the approved plan.

## 3 · Orchestrator responsibilities (phase → artifact contracts)

Per phase: assemble a bounded prompt (framing + small packet JSON + **paths to artifacts**, never pasted history), run one turn on the single primary thread, persist the artifact, advance the machine. **Gate enforcement is runner code, not prompt trust** — the machine cannot leave a gate without a decision file matching `state.awaiting.gate`; the runner never interprets agent output as permission to advance.

| Phase      | Prompt inputs                                                                                                                                                                                     | Mode                 | Output contract                                                                                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---------------------------- |
| DISCOVERY  | packet inline; campaign-file snapshots in `artifacts/inputs/`; triggered skill paths ("read before answering"); explore code read-only                                                            | analysis (guarded)   | `spec.md`: problem, current behavior with file:line evidence, proposed behavior, acceptance criteria[], affected paths[], riskFlags[], open questions[] (questions → NEEDS_DECISION before the gate) |
| PLAN       | spec.md path + approval note                                                                                                                                                                      | analysis (guarded)   | `plan.md`: ordered steps `{id, description, paths[], validation hint}`, test plan, riskFlags confirmation, rollback sketch, explicit no-new-deps statement                                           |
| BUILDING   | plan.md path + "execute step N" (+ prior validation excerpts when looping; + drained owner messages)                                                                                              | workspace-write      | working-tree edits; `build-log.md` appended per step                                                                                                                                                 |
| VALIDATING | — (no agent; runner spawns `pnpm typecheck && lint && test` at repo root)                                                                                                                         | n/a                  | `validation.json` {typecheck/lint/test: {ok, ms, excerpt}, loop} + report                                                                                                                            |
| REVIEWING  | MVP: self-review turn on the primary thread against the `finish-task` DoD checklist. S5: read-only diff (`git diff` vs baseline, capped 4000 lines) + spec + one skill file per specialist thread | analysis / read-only | `review-self.md` (MVP) / `review-<capability>.md` (S5), each with a mandatory `VERDICT: PASS                                                                                                         | PASS_WITH_NOTES | BLOCK` line + findings table |
| UAT prep   | spec, plan, validation.json, reviews, changed-file list                                                                                                                                           | analysis (guarded)   | `artifacts/uat/**` (doc 5 §5)                                                                                                                                                                        |

## 4 · Agent Catalog — full roster, registry-driven

**Single source of truth: `scripts/delivery/agent-registry.mjs`.** Every agent is one registry entry with the fields `{key, name, purpose, executionMode: "primary"|"inline"|"independent-readonly"|"runner-native", trigger: "always-on"|<classifier rule>, inputs, outputs, blocking: "blocking"|"advisory"|"—", access: "read-only"|"implementation-capable", providers, status: "enabled"|"planned", phase: "phase1"|"S5"|"S6"}`. The following all **derive from this one module — no duplicated lists anywhere**: the dashboard **Agent Catalog** (doc 5 §2), the classifier capability definitions (§5), the launch capability preview, the session agent-output cards (doc 5 §4), phase availability, and blocking/advisory metadata.

**One orchestrator owns every item; everything else is a temporary capability** — either _inline_ (a skill injected into the orchestrator's prompts) or an _independent read-only thread_ (fresh, disposable, fed only artifacts + one skill file, never edits the tree — S5+). All agents run on the session's chosen provider (Codex or Claude Code); S5 specialists use the configured `specialistTiers` mapping (economy, balanced, or strong).

**Product Phase 1 enables exactly the standard set (rows 1–8): Delivery Orchestrator, Product/BA refinement, frontend implementation, backend implementation, automated testing, lite code review, and UAT generation.** Frontend/backend implementation and product/BA refinement are **inline capabilities of the single orchestrator, not independent threads** — anything else would break the one-writer rule. Domain skills (e.g. `money-rules`) are injected into the orchestrator's prompts when the classifier triggers them; **they never become independent specialist agents in Phase 1**. The complete roster below — including every planned specialist — is visible in the dashboard Agent Catalog from day one, with planned rows clearly marked unavailable and not launchable.

| #   | Agent                             | Capability key          | Execution mode                                                                               | Access                                     | Trigger                                                                                                     | Inputs                             | Output                                                              | Blocking                          | Status · Phase                |
| --- | --------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------- | --------------------------------- | ----------------------------- |
| 1   | **Delivery Orchestrator**         | `delivery-orchestrator` | primary thread                                                                               | implementation-capable (BUILDING only)     | always-on                                                                                                   | packet + artifacts                 | all phase artifacts                                                 | —                                 | **Enabled · Phase 1** (S3/S4) |
| 2   | Product/BA Analyst                | `product-ba-refinement` | inline in DISCOVERY turn                                                                     | read-only                                  | vague item (< 8 words, no verifiable outcome)                                                               | packet + campaign files 1–3        | sharper spec questions inside spec.md                               | advisory                          | **Enabled · Phase 1** (S3)    |
| 3   | Frontend Implementer              | `frontend-impl`         | inline (inject `ui-guardrails`, `cache-invalidation`)                                        | implementation-capable                     | globs `src/app/**`, `src/components/**`, `src/features/**` (non-api)                                        | plan + skills                      | working-tree edits                                                  | —                                 | **Enabled · Phase 1** (S4)    |
| 4   | Backend Implementer               | `backend-impl`          | inline (inject `api-route`)                                                                  | implementation-capable                     | globs `src/app/api/**`; /api\|route\|endpoint\|cron/i                                                       | plan + skills                      | working-tree edits                                                  | —                                 | **Enabled · Phase 1** (S4)    |
| 5   | Test Engineer                     | `automated-testing`     | hybrid: orchestrator writes tests inline; **validation harness is runner-native (no agent)** | implementation (tests) / runner-native     | always-on                                                                                                   | plan test step                     | test files + `validation.json`                                      | blocking                          | **Enabled · Phase 1** (S4)    |
| 6   | Code Reviewer (lite)              | `code-review`           | self-review turn on the primary thread against the `finish-task` DoD checklist               | read-only                                  | always-on                                                                                                   | diff + spec                        | `review-self.md` verdict                                            | blocking                          | **Enabled · Phase 1** (S4)    |
| 7   | UAT Author                        | `uat-generation`        | inline on primary thread                                                                     | read-only (writes only `artifacts/uat/**`) | always-on                                                                                                   | all artifacts                      | `uat/**` package                                                    | blocking (UAT gate needs it)      | **Enabled · Phase 1** (S4)    |
| 8   | Domain skill injection (Money, …) | `money-domain`          | **skill injection into orchestrator prompts — not an agent activation**                      | n/a (modifies prompts only)                | campaign = Budget; /balance\|amount\|transaction\|transfer\|debt\|allocat/i                                 | skills + spec                      | before/after balance example required in spec/plan                  | blocking (checked in lite review) | **Enabled · Phase 1** (S4)    |
| 9   | Full Code Reviewer                | `code-review-full`      | independent read-only thread with `finish-task` DoD checklist                                | read-only                                  | always-on (replaces lite verdict as the gate check)                                                         | diff + spec                        | `review-code.md` verdict                                            | blocking                          | Planned · S5                  |
| 10  | Domain Guardian (Money)           | `money-domain-review`   | independent review checklist thread                                                          | read-only                                  | same trigger as row 8                                                                                       | skills + spec + diff               | domain findings in review                                           | blocking                          | Planned · S5                  |
| 11  | UX Reviewer                       | `ux-review`             | independent read-only thread                                                                 | read-only                                  | UI paths in the diff                                                                                        | diff + spec + `ui-guardrails`      | `review-ux.md`                                                      | blocking                          | Planned · S5                  |
| 12  | Architecture Reviewer             | `architecture-review`   | independent read-only thread, plan-stage                                                     | read-only                                  | ≥ 3 top-level `src/*` areas, ≥ 5 new files, or /refactor\|restructur/i                                      | plan.md                            | `review-architecture.md` (shown at plan gate)                       | advisory                          | Planned · S5                  |
| 13  | DB / Migration Reviewer           | `db-migration-review`   | independent read-only thread                                                                 | read-only                                  | /migration\|schema\|rls\|policy\|sql\|column\|index/i or `migrations/` in affected paths                    | diff + `db-migration` skill + HR24 | `review-db.md` + **plan-gate risk flag (typed APPROVE)**            | blocking                          | Planned · S5                  |
| 14  | Security Reviewer                 | `security-review`       | independent read-only thread                                                                 | read-only                                  | /auth\|token\|secret\|password\|permission\|rls\|household\|encrypt/i or supabase/middleware/api-auth paths | diff + spec                        | `review-security.md` + risk flag                                    | blocking                          | Planned · S5                  |
| 15  | Release Engineer                  | `release-rollback-prep` | independent/inline, **ship mode only** (non-default)                                         | read-only                                  | mode = "ship"                                                                                               | uat + plan                         | `release-notes.md` + deepened `rollback.md` (display-only commands) | blocking in ship mode             | Planned · S6                  |

Every agent gets its own expandable output card in the dashboard (doc 5 §4), rendered from the same registry metadata.

## 5 · Classifier

`classify.mjs` is a **deterministic pure function** over packet text + spec-declared affected paths (keywords, globs, campaign) → capability keys defined in `agent-registry.mjs` (§4) — the classifier owns the _rules_, the registry owns the _definitions_; a startup assertion verifies every classifier key exists in the registry. Auditable, unit-testable with fixtures, and **owner-editable at the SPEC gate and in the New Delivery Session flow's launch preview** (mandatory always-on rows locked: automated-testing, code-review, uat-generation; **only optional rows are droppable** — the server rejects drops of locked rows, doc 2 §5). The classifier never selects an agent whose registry `status` is `"planned"` for the current phase — planned specialists are visible in the catalog but not activatable. Rejected alternative: an LLM classifier — non-deterministic, unauditable, and costs tokens (doc 6 §4). Blocking review verdicts always route back through the single primary thread — structurally there is exactly one writer, ever.
