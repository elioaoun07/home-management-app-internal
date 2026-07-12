# 6 — Roadmap, Testing & Risks

**Stamped:** 2026-07-11 · **Revised:** 2026-07-12 · Covers plan sections: phased implementation slices (17), automated test strategy (18), MVP definition of done (19), risks + rejected alternatives + open decisions (20)

> **Terminology reminder (`_index.md`):** Product Phase 1 = the complete MVP = engineering slices S1–S4. Specialist expansion = S5. Post-MVP improvements = S6. "Phase 1" never means slice S1.

## 1 · Phased slices

### Slice S1 — Pure core · **S/M · 0.5–1d**

| Step | Note |
|---|---|
| `state-machine.mjs` | Pure transition table (doc 3 §2); `next(state, event) → {to, effects[]}` |
| `packet.mjs`, `classify.mjs` | Packet builder reusing `scanCheckboxes` ordinals; deterministic rule table over registry-defined capability keys |
| `agent-registry.mjs` | Central agent registry — single source of truth for the Agent Catalog, classifier definitions, launch preview, output cards, phase availability, blocking metadata (doc 3 §4) |
| `events.mjs`, `fsx.mjs`, `prompts.mjs`, `gitread.mjs` | ndjson append/replay + usage reducer; atomic writes; prompt templates; read-only git allowlist |
| `drivers/driver.mjs` + `drivers/fake.mjs` | Interface + scripted fake for tests |
| `tests/delivery/*.test.ts` + `.gitignore` `/.delivery/` line | Full unit coverage of the above |

**Exit:** `pnpm test` green including new suites; every legal/illegal transition and every classifier rule covered.

### Slice S2 — Server + runner + full UI on the fake driver · **M · 1.5d**

| Step | Note |
|---|---|
| `server-routes.mjs` + pm-server wiring | All endpoints (doc 2 §5), build-lock, decision/message writes, runner spawn/monitor |
| `run-session.mjs` | State loop, heartbeat, resume, boundary message intake — against `fake.mjs` |
| Named SSE channel | Second watcher + `event: delivery` frames; client listener |
| Dashboard UI complete | New Delivery Session flow (topic → item → preview → provider → capabilities → risks → launch; Deliver-button preselection), Agent Catalog (full roster, planned agents marked unavailable), list, detail, stepper, gate panels, composer, agent-output cards, timeline, artifact viewer |

**Exit:** a fake session driven from the UI through every gate to Accept → source checkbox ticks (drift-guarded); survives killing pm-server AND the runner mid-run; composer message visibly consumed at the next boundary; the Agent Catalog shows the complete registry roster with only Phase-1 agents enabled; the New Delivery flow enforces the selectability rules (doc 5 §2) and launches with topic/item selection as well as via Deliver-button preselection.

**IMPLEMENTED 2026-07-12.** `scripts/delivery/run-session.mjs` (runner: single-unit-of-work `advanceSession()` + long-running `runLoop()`, heartbeat/`isRunnerAlive`, retry-once-then-BLOCK, read-only/build git guards, `runValidationCommands` spawning real `pnpm typecheck/lint/test`) and `scripts/delivery/server-routes.mjs` (all `/api/delivery/*` routes, global build lock, Accept-writeback exactly-once) are new; `scripts/pm-server.mjs`, `scripts/pm/client.js`, `scripts/pm/styles.css`, `scripts/pm/ui.mjs` were extended per doc 2 §7's touch-point list. 47 new tests (16 runner + 31 server-routes) plus a live smoke test against the real dashboard (real HTTP calls through SELECTED → DISCOVERY → SPEC_READY → PLAN_READY → BUILDING → VALIDATING, with real artifact generation, real events.ndjson, real crash detection, and real cancel-with-dead-runner). `agent-registry.mjs` + `classify.mjs` are injected verbatim into the browser via `ui.mjs` (extending the existing `scanCheckboxes` precedent) so the Agent Catalog and launch-preview classifier can never drift from the server. The remaining rollup gap was closed on 2026-07-12: `renderChecklistRollup` now retains the existing skipped-row presentation while resolving real checkbox rows through `fileTasks`, so its Deliver shortcut carries the same `file` + `cbidx` identity, text-drift protection, eligibility rules, styling, and shared wizard handler as the per-file checklist view.

### Slice S3 — Real drivers · **M · 1–1.5d** *(the two SDK devDependencies are added here, not before)*

| Step | Note |
|---|---|
| Pin both SDK surfaces | Verify field names against installed `.d.ts` (`sandboxMode` vs `sandbox`; Claude options) |
| `drivers/codex.mjs` + `drivers/claude.mjs` | startSession/resume/runTurn + normalized events/usage + preflight turn |
| Real DISCOVERY → SPEC → PLAN | Structured-output artifacts on a toy item, both providers |
| Guards live | No-git-write (HEAD/refs), clean-analysis-turn, forbidden-paths — simulated violation → BLOCKED |

**Exit:** real spec.md + plan.md from each provider; token usage visible per phase; a deliberately-provoked git commit attempt lands in BLOCKED.

### Slice S4 — Build → validate → UAT · **M/L · 1.5–2d** — **Product Phase 1 (MVP) complete**

| Step | Note |
|---|---|
| BUILDING turns | Per-plan-step execution, build-log, owner-message injection |
| VALIDATING | `pnpm typecheck && lint && test` at repo root; bounded excerpts; fix loop ≤ `maxFixLoops` → BLOCKED |
| Lite self-review | One primary-thread turn against the `finish-task` DoD checklist → `review-self.md` |
| UAT assembly | Full package (doc 5 §5); Accept → writeback; SHIPPED marking |

**Exit:** one small real checklist item taken end-to-end to UAT_READY, accepted, and committed by the owner — on at least one provider.

**CLI-vs-workspace consumption benchmark (added to the S4 exit gate, 2026-07-12 owner cost review):** before setting any `budget.sessionTokens` default or trusting any cost-ratio claim (doc 4 §5, doc _index Costs table), run the same 2–3 representative tasks from this repository — one S bug fix, one M feature slice, ideally one Budget-campaign item — both as a normal CLI session and as a delivery session, same provider/model/effort for both. Record per-task input/cached-input/output totals from the CLI's own usage reporting and from `state.json.usage`. Deliverables: (1) a measured CLI↔workspace ratio per task class, replacing every qualitative estimate in this plan; (2) data-driven `budget.sessionTokens`/`warnAtPct` defaults; (3) a per-phase breakdown of where the workspace spends more (spec/plan artifacts vs. gate re-priming vs. specialists) to guide any future tuning.

### Slice S5 — Independent specialists (specialist expansion) · **M · 1d**

| Step | Note |
|---|---|
| Specialist threads | Read-only full-code/domain/ux/architecture/db/security reviewers (registry rows 9–14, flipped from `planned` to `enabled` in the registry), verdict parsing, fix-loop routing |
| Risk-flag gates | Typed `APPROVE` enforcement server+runner side |
| NEEDS_DECISION flow | Question artifact + options UI |
| "In delivery" badges | On checklist/task rows via packet identity join |

**Exit:** a Budget-campaign item triggers money + code review; a BLOCK verdict loops through fix → re-validate → re-review.

### Slice S6 (post-MVP, unscheduled)

Isolation upgrade — **non-Git only**: an opt-in temporary filesystem copy, OS-level sandbox, container-mounted copy, or copy-on-write workspace; a manually prepared external clone is acceptable only if the owner creates and manages it entirely outside the delivery tooling. The system never creates or manages branches, clones, or worktrees (permanent policy, doc 4 §3). Plus: screenshots in UAT, ship mode (release/rollback prep, roster row 15), archive/cleanup UX.

## 2 · Automated test strategy

Vitest, `tests/delivery/*.test.ts` — matches the existing `tests/**/*.test.ts` include with zero config change; house precedent `tests/pm-mutations.test.ts`.

| Layer | Modules | Approach |
|---|---|---|
| Unit (pure) | `state-machine` | Exhaustive: every legal transition; every illegal (state,event) pair throws; gate invariants (cannot leave a gate without a matching decision) |
| Unit (pure) | `classify` | Rule-table fixtures: keywords/globs/campaign → expected capability sets; always-on presence; drop-rules respect locked rows |
| Unit (pure) | `packet` | Raw md + cbidx → identity; ordinal cross-check against `scanCheckboxes` fixtures; textHash drift cases |
| Unit (pure) | `events` | Append/parse/replay; seq monotonicity; usage reducer from provider fixtures (both shapes) |
| Unit (fs) | `fsx` | Atomic write in temp dirs; EPERM retry path (mocked) |
| Unit | `gitread` | **Allowlist invariant: any non-read subcommand throws** — including `worktree`, `branch`, `checkout` (the codified no-git-write guarantee); plus a repo-wide grep test asserting no other `child_process` git usage AND no `worktree` string exists anywhere under `scripts/delivery/` |
| Unit (pure) | `agent-registry` | Completeness: every roster agent present with all required fields; exactly the Phase-1 standard set has `status:"enabled"`; every later specialist has `status:"planned"`; every classifier capability key exists in the registry (no orphans, no duplicates) |
| Unit | registry consistency | Agent Catalog render model, classifier definitions, launch capability preview, and agent-output-card metadata all derive from the same registry export — a single-source assertion, not four maintained lists |
| Integration | launch flow | Topic filtering of work items; completed and already-in-delivery items unselectable; postponed items selectable with flag; Deliver-button preselection lands on the right item; planned (S5/S6) agents never launchable; locked capability drops rejected server-side (400) |
| Integration | security guards | Analysis/specialist turns are read-only (simulated write → violation); forbidden-path and out-of-root write attempts → BLOCKED; secret-path reads (`.env*`, key files, `~/.codex`, `~/.claude`) denied by the Claude permission callback (fixture); non-enforceable provider restrictions (Codex read limits, Windows sandbox) reported as "detection-only" in session/state output, never as enforced |
| Unit (string) | `prompts` | Snapshots per phase; assert artifact paths present, git-ban text present, no inlined skill bodies, owner-message section renders |
| Integration | runner + FakeDriver | Scripted sequences in `os.tmpdir()` git fixtures: happy path; validation-fail ×3 → BLOCKED; kill + `--resume` re-entry; stale decision rejection; message drained at boundary (not mid-turn); simulated HEAD-change → BLOCKED |
| Integration | `server-routes` | Stubbed req/res against a temp `.delivery` tree: start drift 409, gate mismatch 409, artifact path traversal rejected, build-lock 429, message on terminal session 409 |
| Manual (gated) | real SDK turns | S3/S4 exit criteria — cost + nondeterminism keep these out of CI; the thin driver seam is the boundary |

## 3 · Definition of done (Product Phase 1 / MVP = engineering slices S1–S4)

1. From the dashboard: the **New Delivery Session flow** works end-to-end — select topic → select an open work item (selectability rules of doc 5 §2 enforced) → preview → provider choice (Codex or Claude Code) → capability preview with only optional rows droppable → risk/dirty warnings → launch → live session view with timeline and orchestrator output card. The task-row Deliver button opens the same flow preselected.
2. All three gates render artifacts inline; reject-with-note produces a revised artifact; approve advances; risk-flagged plans demand typed `APPROVE`.
3. The chosen agent edits the working tree directly; `pnpm typecheck && lint && test` pass at repo root; failures loop at most `maxFixLoops` then BLOCK.
4. Mid-session composer messages persist as events and are demonstrably incorporated at the next boundary.
5. UAT_READY yields the doc 5 §5 package; the manual test script is executable as written against the owner's running dev app.
6. Accept ticks the source checkbox (drift-guarded, exactly-once) and the owner handles all git; Mark-shipped records the owner's commit.
7. Kill pm-server, kill the runner, reboot-equivalent: every case resumes per doc 5 §7 without artifact loss or duplicate writeback.
8. Static `_dashboard.html` unchanged in behavior; all existing endpoints and tests untouched and green; `.delivery/` never appears in `git status`.
9. **Grep-provable:** no git-write invocation and no `worktree` usage exists anywhere under `scripts/delivery/` — only `gitread.mjs` touches git, through its read-only allowlist.
10. The **Agent Catalog** shows the complete registry roster; exactly the Phase-1 standard set (orchestrator, product/BA refinement, frontend impl, backend impl, automated testing, lite code review, UAT generation) is enabled; every later specialist is displayed as Planned and cannot be launched or classifier-selected.
11. **Registry single-source:** catalog, classifier, launch preview, and output cards demonstrably derive from `agent-registry.mjs` (test-asserted) — no duplicated agent lists exist.
12. **Security honesty:** analysis and specialist phases are read-only; forbidden-path and out-of-root write attempts drive the session to BLOCKED; secret/credential paths are denied where mechanically enforceable; every restriction that is *not* mechanically enforceable (doc 4 §4 residual risks) is reported as detection-only in the session view, never claimed as enforced.

## 4 · Risks, rejected alternatives, open decisions

| Risk | Impact | Mitigation |
|---|---|---|
| SDK surface drift across versions (both providers) | integration rework | Pin in S3 against installed `.d.ts`; the driver seam isolates all SDK types; Freshness protocol re-pin rule |
| Agent runs git anyway despite ban | violated owner constraint | Post-turn HEAD/refs guard → BLOCKED + owner notified; Claude tool-rule denial; tested via simulated violation |
| Owner-vs-agent edit collisions in the shared tree | muddy diffs, confused validation | Dirty-start warning, baseline attribution, single-build-session lock, boundary drift warnings; residual risk accepted by design (the S6 **non-Git** isolation option is the escape hatch) |
| Codex sandbox not OS-enforced on Windows | write limits there are detection-only, not prevention | Post-turn changed-file + HEAD/ref guards, network-off, owner diff review at UAT; surfaced honestly as "detection-only" in the session view (doc 4 §4) |
| Agent reads secrets (`.env*`, keys, auth stores) despite deny rules | secret content enters model context | Claude: `canUseTool` deny + Bash screening (heuristic); Codex: prompt ban only. No delivery task requires secrets; owner reviews every diff. **Residual risk — documented, never claimed enforced** |
| Fix-loop thrash burns tokens | cost | `maxFixLoops:3`, bounded excerpts, per-phase usage always visible |
| Session-level token consumption exceeds expectations | cost / burns owner's rate limits faster | Between-turn `budget.sessionTokens` (owner-set after benchmarking, doc 6 §1) → NEEDS_DECISION before it can run away; per-phase effort defaults + dashboard effort/model selectors (doc 4 §5); configurable specialist tiers instead of always using the primary model; thread-reuse policy avoids unnecessary re-priming (doc 4 §5) |
| Windows file locks break atomic renames | state corruption | tmp+rename with EPERM retry ×3; state advances only after durable artifacts |
| Two auth surfaces (Codex + Claude) | session can't start | Per-driver preflight turn at session start; failure → BLOCKED with clear reason before any work |
| Composer message arrives mid-turn and is "ignored" | owner confusion | Explicit "queued — read at next step" UI state + `owner.message.consumed` event |

| Rejected alternative | Why |
|---|---|
| Worktree/branch per session, or any tool-managed clone | **Owner hard constraint, permanent (2026-07-11, reaffirmed 2026-07-12)**: no git-state-changing action of any kind, ever — in every slice and every future refinement; direct working-tree edits in Product Phase 1; any future S6 isolation is strictly non-Git (temp filesystem copy / OS sandbox / container mount / copy-on-write) |
| Tool-performed commits/merges | Owner: all git is his |
| Campaign `Deliveries.md` writeback | Owner: invalid under the no-git model; the checkbox tick is the trace |
| CLI-spawn driver fallback (`codex exec --json`) | Owner: not yet; both official SDKs instead |
| Separate delivery server/process | Loses free reuse of the localhost posture, SSE, mutation handlers, and UI shell |
| Runner in-process in pm-server | Server restart would kill live sessions; crash isolation lost |
| WebSocket channel (`ws` dep) | SSE + named events suffice; zero-dep house style |
| LLM-based capability classifier | Non-deterministic, unauditable, costs tokens; the rule table is testable and owner-editable |
| Full specialist roster in MVP | Owner: document all, ship orchestrator + implementation + validation + UAT first; specialists are additive (S5) behind the same review seam |

**Open decisions (owner, non-blocking):** (a) token prices for the optional cost column; (b) concrete provider models mapped into `specialistTiers.{economy,balanced,strong}` in `.delivery/config.json` (tier mechanism itself is locked, doc 4 §5); (c) whether S5 should immediately follow the MVP or wait for a few real sessions of experience; (d) whether the Agent Catalog renders as a section of the `delivery` route or its own sub-route (pure UI-layout choice, registry-driven either way); (e) `budget.sessionTokens` value and idle/context-growth thresholds for the fresh-thread trigger (doc 4 §5) — deferred until the CLI-vs-workspace benchmark above produces real numbers.
