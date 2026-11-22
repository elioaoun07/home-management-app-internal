---
created: 2026-09-10
updated: 2026-11-15
type: master-book
status: active
owner: Elio
---

# Delivery — Master Book

[Backlog](<4 - Checklist.md>) · [PM home](<../_index.md>) · [Governance](<../_Conventions.md>)

Item plans follow [the shared execution-plan convention](<../_Conventions.md#9-item-execution-plans>); read only the selected item and its dependencies.

## Purpose & ownership

Produce useful product outcomes with bounded authority and truthful evidence. Tooling campaign; V1 operation and V2 construction have separate contracts.

## Current state & evidence

**2026-11-10 — ERA Steward subject closed in one document (documentation only):** the [supervisor contract](<../Fable 2/10 - Project Management/Delivery/5 - Supervisor Contract.md>) records why no Steward-started delivery shipped (the furthest reached a plan awaiting approval, `r-262a6aee5ed3`; the applied R44 run was owner-driven and has no recorded sign-off), defines the conductor state machine, the verbs, the mandate and the escalation table, and sets four exercises as the acceptance. DLV-156 added. Nothing is implemented.

**2026-11-10 — Fable 2 filing (documentation only):** DLV-150, DLV-151, DLV-152, DLV-153, DLV-154, DLV-155 added to the checklist with criteria below. Sources are the 2026-11-04 Major Bug Sweep, whose IDs had not been filed, and the [Fable 2 analysis](<../Fable 2/_index.md>) at commit `8da80ae`. Nothing is implemented, applied or verified by this entry.

**2026-10-31, 18:17 Beirut — KIT-10 readiness recovered, no launch:** following the owner's request to diagnose Check directly, existing saved local owner access sent Check (no new pairing). Authorization renewed until 2026-11-01T16:13:15.570Z and prepared-plan Touches were derived automatically. Collection isolated `docker-unavailable`: frontend alive, backend absent, missing Linux engine pipe. Supported Start falsely said already running; Restart failed on lingering processes. Stopping verified Docker frontend processes and launching the installed main executable recovered engine 28.5.1 without changing Docker settings or deleting resources. A second Check without renewal passed **11/11, ready: true**, completed 2026-10-31T16:17:01.069Z, native 0.156.1 / Codex Luna low, zero provider turns, both probe cleanup signals true. No delivery Start, Apply, bridge restart or policy replacement. R82 owns the blocker/pending presentation fix. Historical browser-click outcome and the Docker backend's original exit cause remain unestablished; readiness expires normally and Start rechecks live facts.

V2 S0/S1 code and synthetic fixtures landed Sep7–9, but no native baseline, admitted executor profile, actual dispatch or genuine V2 product pilot is evidenced. V1 HUB-1 activity did not establish a successful product completion. Older session/cost totals are dated receipts, not live metrics.

Refactored 2026-09-10 against repository HEAD `8d952332b0d7917369ce074730cfe830a5c37a97` and dated source studies. This date records document reconciliation, not a fresh runtime, DB or device witness. The [pre-refactor record](<../_Archive/2026-09-10 PM Refactor/Before/Delivery/Delivery — Master Book.md>) preserves detailed older narratives and receipts.

## Vision & Decisions

- **Supervisor contract, 2026-11-10 (owner commission to close the ERA Steward subject).** Delivery is run by a deterministic conductor that needs no assistant; a supervisor (Dot now, Claude Duet or another later) is an optional caller of eight verbs on the Local lane only, with authority fixed by which verbs exist. It never approves a risk review, ships, or edits the mandate. The browser-driving procedure is retired when DLV-156 ships; the tunnel and private plugin are an optional transport; UAT scenario M1 (tools-only proof) is dropped as unprovable and unnecessary. All choices are closed in the [contract](<../Fable 2/10 - Project Management/Delivery/5 - Supervisor Contract.md>) §10. Proposed design; not implemented.

- **Owner direction 2026-11-10 — relax Delivery for supervised local use.** In the owner's words: "The docker feels an overkill, the feature seems too restrictive to a point that it feels unusable. From my point of view, I will be delivering locally, build UATs, and eventually ship the feature … I want to relax everything, and give more freedom to AI to ship." Four guardrails survive by the owner's choice: no production DB writes (Hard Rule 26), subscription only (Hard Rule 29), the owner ships after UAT sign-off, and money, recurrence, auth/RLS and migration changes are reviewed before they land. Everything else becomes advisory or is dropped in a new Local lane ([design](<../Fable 2/10 - Project Management/Delivery/2 - Local Lane Design.md>), [gate disposition](<../Fable 2/10 - Project Management/Delivery/3 - Gate Disposition.md>)); work is DLV-150 to DLV-155. For the Local lane only, this supersedes the V1 "no Git writes/worktrees" freeze, the 2026-09-11 container boundary direction, DEC-16's protected Apply and DLV-96/97 qualification. The confined V2 path is unchanged and frozen. Not implemented.

- **DLV-143 — A Start result remains reportable.** Ordinary and Steward launches share durable prelaunch receipts without conflating attribution. Recovery reads the original request; uncertain outcomes never authorize a new Start. Confirmed blockers remain visible independently of passive readiness, including when browser result persistence fails. *(IMPLEMENTED 2026-10-24 — source/offline fixtures; operational activation pending.)*

- **DLV-141 — One clear next action on desktop and phone.** Keep advanced launch settings and gate diagnostics disclosed; show request progress and an explicit outcome even if blockers do not change. A confirmed cancelled request offers New/Open before Start. Server authority and original receipts remain authoritative. *(IMPLEMENTED 2026-10-24 — offline checks/browser fixtures; physical-phone UAT pending.)*

- Steward coordination requests are observable before a run exists, under DLV-138's original command UUID. Coordinator silence is derived independently and never changes job state, triggers a retry or replaces a terminal result. DLV-137 retains readiness and DLV-133 environment ownership. *(IMPLEMENTED 2026-10-20 — DLV-140; local fixtures, owner UAT pending.)*

- Owner direction 2026-10-20: readiness and setup (Docker, sign-ins, policy, item scope, environment) are checked and fixed on the Command Center side. ERA Steward's whole job is "Run delivery for item <ID>": open the item, press Start once, and report the run link or Start's listed blockers word for word. Steward never diagnoses, prepares, restarts or writes readiness reports; the launch screen and Start's refusal carry the per-gate report. Plan approval and Apply stay with the owner. *(IMPLEMENTED 2026-10-20 — DLV-139; owner UAT pending.)*

- Owner-approved 2026-09-20 bounded DLV-118 slice: reuse complete owner-reviewed low-risk task material as a proposed plan even when no AI authored it; preserve plan approval, one-engineering-job limits, verification and Apply. Explicit advisory versioning applies only to new contracts; legacy meaning is unchanged. *(IMPLEMENTED 2026-09-20 locally; live comparison and complete DLV-118 acceptance remain separately gated.)*

- Owner decision 2026-09-15: Work/Deliver contains actionable implementation only; completed source appears as Done, with UAT pending separately. Owner-only gates leave the backlog and remain in the UAT. Partial scope is split into explicit remaining engineering. *(IMPLEMENTED 2026-09-15: lifecycle reconciliation; PM Tooling R65 owns the app and guards.)*

- Owner follow-up (2026-09-15): make Delivery a readable application with minimal text, repair the phone session and plan.md review, supply a small request-to-change table and real-item UAT with expected/actual and ship/hotfix/rollback decisions. *(IMPLEMENTED 2026-09-15 — shared session workspace and both requested documents; owner UAT remains pending.)*

- Owner commission (2026-09-14): prioritize readable desktop/mobile Delivery, meaningful plan/diff/check review, visible resource limits and escalation, explicit rollback confirmation, and permanent per-item attempt history. The [hotfix specification](<../_Archive/Plans/Delivery First-Run Hotfix (2026-09-14).md>) supplies proposed implementation details and acceptance; DLV-107 is implemented, while the remaining packets are pending. Keep the existing V2 architecture and subscription-only authority. Rollback must restore the actual launch before-image, including pre-existing untracked files; a candidate and its history survive rollback. *(IMPLEMENTED 2026-09-14 — DLV-107: completed-item links select the Story tab and the synthetic shipped/discarded navigation matrix passes.)*

- Owner requirement (2026-09-13): Delivery uses the owner's existing Claude and ChatGPT subscriptions through their native SDKs. Additional-spend authority is **zero**: no API keys, paid-provider fallback, purchased usage credits or automatic top-ups. Stop when included usage is exhausted and report the limit. This supersedes the proposed USD 2 trial approval; SDK API-equivalent estimates are not invoices. *(IMPLEMENTED 2026-09-13 — DLV-110: both actual workers authenticate through subscriptions, reject paid/unknown auth and unavailable included quota before SDK jobs; account checks confirm Claude usage credits disabled and Codex credits unavailable with balance zero. No inference was requested during setup.)*
- V1 retains its operating freeze: before further architecture, obtain two genuine product completions; after the first allow at most one reliability, workflow and validation repair. V2’s separately authorized construction is a distinct track, not a retroactive waiver of V1 gates.
- V1 preserves three gate decisions; qualifying INSTANT compression is the documented scoped exception. The broader interaction experiment remains DEC-21/DLV-89. Unknown costs refuse launch; zero tests mean NOT_TESTED.
- No silent provider fallback. Explicit pause/handoff at an authorized boundary only. Mobile revoke controls remain available; no mobile checkbox ticking or new authority-grant expansion. Existing command eligibility is verified under DLV-77.
- Accepted V2 target: ERA owns work identity, immutable contract, authority/resources, durable dispatch/reconciliation and evidence; the native environment owns engineering tools/context. FAST/DEEP are policies over one architecture. The real comparison reopens the old rejected benchmark only as a small bounded trial.
- DLV-96 qualifies actual read/descendant confinement; DLV-97 obtains explicit dispatch policy. Current admission wiring is not a dispatcher, read sandbox or pilot. No weakened battery to manufacture admission.
- Owner application/release remains separate from a verified candidate. Historical DLV-94/95 retain their Aug22 meanings; Sep9 open blockers are DLV-96/97.
- Adopted 2026-09-11 ([Command Center §4](<../Plans/Command Center.md#4-delivery-design-to-build-toward>)): executor, model and effort are chosen per run from allowed, qualified profiles, with requested and effective values persisted and no substitution; this supersedes the Sep 9 installation-wide selection (DLV-97). V2 has two review moments: plan approval, which covers implementation, checks and limited repair, and the final application decision; ask again only for a consequential scope/resource/effect change or a blocking question. V1 gates and DEC-21 are unchanged. *(IMPLEMENTED 2026-09-12 — per-run selection, requested/effective settings and plan approval in code and fixtures; no real run, and the final application decision stays manual until DLV-105.)*
- Adopted 2026-09-11 (DEC-15 resolved): the phone is a core milestone of the same product (DLV-104, PM Tooling R63); managed hosting stays optional. *(IMPLEMENTED 2026-09-12 in code and fixtures — `/pm/live` mounts the shared views over the relay with durable command recovery; relay migration and phone acceptance outstanding.)*
- Adopted 2026-09-11 (DEC-16 resolved): the target includes an owner-triggered Apply through a protected integrator that writes only the approved frozen diff and runs candidate checks only in the isolated checker (DLV-105). Until DLV-105 lands with local tests, application stays manual. No autonomous Git, publication, deployment or production DB authority. *(IMPLEMENTED 2026-09-12 in code with local fixtures, locally and through the relay — no real verified candidate exists to apply yet, so application of real work remains unobserved.)*
- Default resource policy (2026-09-11): a visible estimated-spend threshold, enforceable dispatch and repair limits, and a qualified wall-time/stop limit; a strict monetary limit only with a proven whole-job bound. The owner supplies every amount before any paid run (DEC-14); unknown cost never becomes zero.
- Boundary direction (2026-09-11): disposable Linux containers on a VM-backed runtime — non-root, read-only root filesystem, no capabilities, no host mounts or container-control socket — for the worker and a separate checker; stop means removing the container. Bounded parallel candidates follow Apply (DLV-106).
- Parallel candidates (2026-09-12, Command Center Phase 5): at most two concurrent writers (`concurrency.maxWriters` 1–2; the ceiling rises only in code after recorded parallel runs). Three possibly running jobs by default (`maxJobs`, an initial choice the owner may change); reserved, active, paused and unknown jobs and stops not yet observed all count. A fleet allowance is optional and owner-supplied, and unknown amounts refuse under it. Scope is declared with `**Touches:**` beside acceptance, or observed from the approved plan and candidates; a missing declaration is unknown scope, never independence. Built-in classes that serialize: shared code (`src/lib`, `src/types`, `src/components`, `src/contexts`, `src/hooks`, `scripts/pm/shared`) against its importers, `migrations/`, dependency manifests and lockfiles, and generated outputs. The policy declares exclusive check resources per check. A HELD row, or an open, cancelled or unresolved prerequisite, does not launch. Waiting runs are admitted automatically, since plan approval already covers the implementation loop. A verified candidate reserves its paths until it is applied, rolled back or superseded, or the owner releases it. *(IMPLEMENTED 2026-09-12 in code and fixtures — no real pair.)*

Unresolved policy choices live in the [decision register](<../_Decisions.md>); original exploratory ideas live in [Research options](<../Research/Options.md>). A Later item is retained work, not automatic permission to start.

- **2026-09-26 owner scope decision:** Delivery closes as **accepted for supervised use, laptop + phone** once the KIT-11 A→B trial, Apply/rollback on arm B and one phone pass are recorded in [owner UAT](<../../../docs/Delivery-UAT.md>). **Now** holds only what that evidence closes. Everything in **Later** is an enhancement, reopened only when a real run shows a blocker, a safety problem or real friction. V1 items were cancelled the same day (see `_Archive/Cancelled Log.md`); V1 stays frozen. *(moved from the checklist header 2026-11-11)*

## Pain Inventory

🔴 **Local Ship pushes to `origin`, not the remote the owner uses (2026-11-22).** `createLocalLane` defaults `remote = "origin"` (`local-lane.mjs:45`) and `service.mjs` never overrides it; Ship then runs `git push origin HEAD:refs/heads/main`. In this checkout `internal` (home-management-app-internal) is current with `main`, while `origin` (home-management-app, its own Vercel project) was last pushed 2026-05-30 and is 201 commits behind. One Ship would publish those 201 commits (1,348 `src/` files, migrations since August) to the stale repository and leave `internal` without the merge. `main` has no upstream configured. Fix: push to the upstream of `main` and refuse when none is set. Found in source; no Ship was pressed.

🟠 **Local Ship does not match how the owner ships (2026-11-22).** The owner's real flow is three steps: ask an AI to fix file A; `git add` and commit A; `git push --force internal main`. Work on `main` keeps going while a session runs. Local Ship assumes the opposite. It merges, commits and pushes by itself, to `origin` (see the 🔴 above). It refuses once `main` has moved past the run's base (`main-advanced`): BUD-95's base `24b981c3` was passed by a one-line `BrainRoom.tsx` commit 17 minutes after the build, so a passed UAT needed a full rebuild. It also merges the run's `.delivery-handover.json` into `main`. The owner, mid-UAT, could not tell how a tested worktree change reaches the repo folder and then GitHub. **Phase 0:** [DLV-167](<#dlv-167>). A run starts from `main` at ALPHA; parallel owner work moves `main` to BETA. **Merge** copies the session's files into the main checkout only if none of them changed between ALPHA and BETA, committed or not. Otherwise it shows a red alert and refuses. The owner then commits and pushes as usual. **Full flow and disk budget:** [DLV-168](<#dlv-168>), [plan and prompt](<../Plans/Delivery Local Workflow — Rethink.md>).

🔴 **DLV-159 — A Local candidate with changes cannot be committed (2026-11-15).** `local-lane.mjs:37` limits every Git command to 30 s; the build commit, ship commit and revert run the repository hook, whose test stage alone took 300.91 s on run `local-cac958d7`. The runner returns `ETIMEDOUT` with `status: null`, so the lane throws even when the hook passes. Seven real attempts, none reached host checks. [Evidence and fix](<../Plans/Agentic OS Delivery Reliability.md#dlv-159--supervisor-git-steps-outlive-the-hook>). Fixture resolution reverified 2026-11-15; owner W1 and real hook timing remain pending.

🟠 **DLV-160 — Failed Local runs hide the stored reason (2026-11-15).** Runs 2–3 showed "native session did not confirm success" while `observations.error` held the sandbox refusal; runs 4–6 showed "candidate needs a change" while the worker's final text said the workspace was read-only. Fixture resolution verified 2026-11-15; owner W1 remains pending.

🟠 **DLV-161 — A failed ship strands `main`; a dead process leaves the command lock; credential copies outlive runs (2026-11-15).** Source-confirmed in `local-lane.mjs#ship` and `#locked`; seven copies of the subscription login remain under `.delivery/local/<id>/home/`. No ship has been attempted, so the first two are unobserved.

🟠 **DLV-158 — Previous Local deliveries remain on Loading session.** Confirmed 2026-11-15: the owner's failed `local-cac958d7-1f8e-4e65-9cb8-1471c839f796` has no candidate head; its workspace comparison spans 4,485 files. `local-lane.mjs#detail` awaited two sequential blob reads per file on every GET before returning saved history. This establishes the cause of R118's pending-detail residual.

🟠 **DLV-157 — Local workers stop before editing on Windows.** The private Codex home omits `[windows] sandbox`, Claude requires a Bash sandbox unavailable on native Windows, and both prompts ask for a commit their guards deny. Confirmed 2026-11-15 in `local-lane.mjs#build` and `adapters/claude.mjs#buildSessionOptions`; owner-provided failed-run and no-model sandbox probe evidence is retained in [the executor blockers plan](<../_Archive/Plans/Local Delivery Executor Blockers.md>).

🟠 **DLV-150** Deliver an item on a branch in a local worktree with host checks. Filed 2026-11-10 from [Fable 2 Local lane design](<../Fable 2/10 - Project Management/Delivery/2 - Local Lane Design.md>) (2026-11-10, owner direction). See [acceptance](<#dlv-150>).

🟠 **DLV-151** Start a local delivery with three checks and no pairing on loopback. Filed 2026-11-10 from [Fable 2 gate disposition](<../Fable 2/10 - Project Management/Delivery/3 - Gate Disposition.md>) (2026-11-10). See [acceptance](<#dlv-151>).

🟠 **DLV-152** Enforce the four surviving guardrails in code. Filed 2026-11-10 from [Fable 2 Local lane design, guardrails](<../Fable 2/10 - Project Management/Delivery/2 - Local Lane Design.md>) (2026-11-10, owner direction). See [acceptance](<#dlv-152>).

🟠 **DLV-153** Ship by owner merge after UAT sign-off and undo by revert. Filed 2026-11-10 from [Fable 2 Local lane design, steps 6 to 8](<../Fable 2/10 - Project Management/Delivery/2 - Local Lane Design.md>) (2026-11-10, owner direction). See [acceptance](<#dlv-153>).

🟠 **DLV-154** Give agents and UAT a disposable development database. Filed 2026-11-10 from [Fable 2 finding F2-05](<../Fable 2/01 - Architecture/Environments and Data Safety.md>) (2026-11-10). See [acceptance](<#dlv-154>).

⚪ **DLV-155** Retire the confined stack after five local deliveries. Filed 2026-11-10 from [Fable 2 migration and retirement](<../Fable 2/10 - Project Management/Delivery/4 - Migration and Retirement.md>) (2026-11-10). See [acceptance](<#dlv-155>).

⚪ **DLV-149 — 2026-10-31, resolved same day: false "Offline · viewing last known work" while the server ran.** DLV-148's directory scopes expanded in every `loadExecutionPolicy`, so the bridge's 5-second run poll walked 3,492 files per run on the server's only thread. Measured live: `/api/health` p50 4.6 s, max 8.1 s against the browser's 3 s probe; 28 of 106 browser probes aborted. Fixed in code; needs a `pnpm pm` restart. [Criteria](<#dlv-149>).

🟠 **A script-only `package.json` edit invalidates the checker environment — 2026-10-27, KIT-4 Start.** The managed dependency environment pins the exact `package.json` bytes (`receipt.spec.packageDigest`, `inspect-readiness.mjs:198`). Adding three `pm:` scripts (commits since 2026-10-20; lockfile unchanged) made every Start fail with `environment-manifest-mismatch` and then `native-model-runtime-unavailable`, until a full DLV-133 re-stage and policy revision. Passive readiness does not show it, because inspection never probes the environment, so it surfaces only at Start. Separately, item-specific command oracles (here `meal-coverage`) must also be in the receipt, so each new item policy needs a re-stage anyway. Options, undecided: digest only dependency-relevant manifest fields, or surface the mismatch in passive readiness. **Resolved by [DLV-148](#dlv-148) (standing policy).** **Re-stage findings (same evening):** (1) The fixed 20-minute install bound cannot be met on a ~290 KB/s link (~500 MB). The first attempt timed out at 713/717 packages, mid-way through the 148 MB `@openai/codex` linux binary. `stage-checker-environment.mjs` now accepts an opt-in `ERA_V2_INSTALL_DEADLINE_MS` from 20 to 90 minutes, and the default is unchanged (`dependency-environment.test.ts` 58/58). (2) A failed install cannot resume. Continuation only covers post-install validation, so a retry re-downloads everything. (3) `validOracles` requires every `candidateFixture` to pin an `eslint.config.mjs`, an R44-specific assumption. The KIT-4 fixture (`tests/delivery-oracles/fixtures/kit4-positive/`, generated corrected control, 54/54) carries a marker file. (4) The staging container mounts no `/out`, so the KIT-4 oracle writes to `/tmp/kit4-out` (policy rev 13).

🟠 **Steward supervision escapes Delivery accounting — owner report, 2026-10-24.** The session summary records external Codex turns for local access/status and repairs outside measured Delivery jobs; external model/usage/cost are unavailable. Existing receipt attribution does not restrict the external agent's tools. The same R44 outcome exposed relevant authored tests first running after Apply. [Proposed bounded closure](<../../../docs/ERA-Steward-Signoff-Plan-2026-10-24.md>); no control or verification change is claimed by this analysis.

🟠 **DLV-142 — Routine readiness required a separate manual authorization renewal (owner, 2026-10-24).** An expired grant required a policy-file activation script even when the saved operating conditions were unchanged. Owner direction: Check readiness is the explicit time-only authorization action; routine delivery must reuse saved conditions instead of requiring a new policy preparation per item. Real source, isolation, usage and coordination blockers still apply.

🟠 **DLV-141 — Readiness check appeared inert; launch was crowded on phone (owner screenshots, 2026-10-24).** `LaunchV2` only changed its refresh button label while pending, with no explicit completion feedback if the same blockers remained. Secondary launch actions were bare buttons inheriting the global transparent reset. V2 also rendered V1's two-step heading, expanded executor/lane/model controls and eleven readiness chips. Root cause is presentation/feedback; the shown expired policy and changed compiler inputs remain real server blockers.

🟡 **KIT-11 oracle count is hardcoded — 2026-09-26 review.** `tests/delivery-oracles/kit11-cooking-count.mjs` invokes `check()` 13 times but line 229 prints `12 of 12 checks passed`; the protected checker therefore records 12 rather than the actual assertion count. Failed assertions still throw before that summary: a fresh local replay against the unchanged checkout failed the four count cases, while both hash-verified frozen candidates (`r-54d5cf10d995`, `r-fa5c81702ec7`) passed. This is an evidence-count defect, not evidence of a false passing candidate. Derive the summary from executed assertions and retain this behavioral regression in routine checks after KIT-11 lands (the oracle is deliberately outside normal Vitest discovery). Do not silently edit a pinned oracle beneath the pending candidates; changed oracle bytes need fresh verification. No candidate, policy or application was changed in this review.

🟠 **`pnpm pm` starts the production relay bridge — 2026-09-26.** `.env` sets `PM_BRIDGE=1`, so any `pnpm pm` (including an agent's local UI check) publishes to `pm_live` and drains `pm_commands` on the live project. Observed 2026-09-26: an agent ran it for ~3 min (installation `inst-46f97a160108`); no command was claimed (no relay journal entry), no run or job created; stopped and redone with `node scripts/pm-server.mjs --no-bridge`. Agents must always pass `--no-bridge` (Hard Rule #26); the owner starts the bridge.
  **2026-09-26 evidence clarification:** `feedback.md` says nothing was written, but an empty command journal does not establish that. `scripts/pm/bridge.mjs:1444` starts heartbeat/task/fleet/V2 publication independently of command draining, and `publishRow()` at line 974 upserts `pm_live`. Actual successful production writes during that earlier incident were not established by this read-only local review; neither zero writes nor successful writes is claimed. No bridge or production inspection was started for this review.

🟠 **DLV-133 — 2026-09-20: staging the checker's compiler would break every command-spec oracle.** `era-dlv107-dependencies` currently holds 41 packages including **esbuild 0.25.12 with its linux-x64 binary** — which `tests/delivery-oracles/bud83-split-removal.mjs` and `tests/delivery-oracles/kit11-cooking-count.mjs` both need in order to run at all — and **no `typescript`, no `next`**. `setup-checker-deps.mjs` deletes and recreates that volume from `CHECKER_DEPENDENCY_PACKAGES`, which does not list `esbuild`: running it adds the compiler and removes the bundler, and both oracles stop running. Adding `esbuild` to the list is not sufficient either — the script copies packages out of *this* checkout, and this checkout is Windows (`@esbuild/win32-x64` only), so there is no linux binary to copy. Root cause: one volume serves two unrelated needs (compile the program, bundle a candidate) and is provisioned by host-copy from a foreign platform. Options, undecided: pin `esbuild` + `@esbuild/linux-x64` and install the linux binary in this checkout, or build the volume inside the image instead of copying from the host. Evidence: `docker run -v era-dlv107-dependencies:/deps` inspection 2026-09-20 (`@esbuild/linux-x64` present, `typescript`/`next` absent); `setup-checker-deps.mjs:120-124` (`volume rm -f` then recreate). **Until this is decided, do not run `setup-checker-deps.mjs`** — the KIT-11 trial depends on the volume as it stands.

🟠 **Claude extra usage enabled — 2026-09-19.** The Claude account reports usage credits on (monthly cap USD 50, USD 12.96 used), contradicting the 09-13 "credits disabled" check (DLV-110). The worker guard refuses every Claude launch until the owner disables extra usage in claude.ai → Settings → Usage. Evidence: `/api/oauth/usage` `extra_usage.is_enabled: true`, `spend.enabled: true`.

🟡 **DLV-133 — 2026-09-20: the deterministic typecheck runs on the host, not in the protected checker.** The checker container has neither TypeScript nor the source closure (`/deps` holds 41 packages: vitest, React, no `typescript`), so DLV-131's compile runs on the host against the current working tree. It is deterministic, outside the model and outside the writer's authority, but it sits outside the checker's isolation boundary and its baseline includes uncommitted work. Cost is ~3–4 minutes per verification (two compiles, no incremental reuse). Moving it inside means building a dependency volume with `typescript` plus the full source closure. Evidence: [Token Consumption Fixes §3/§7](<../_Archive/Studies/Delivery Consumption (2026-09)/Delivery — Token Consumption Fixes.md>); docker inspection of `era-dlv107-dependencies` 2026-09-20.
  **2026-09-20 progress — the checker path exists and labels itself; two owner steps remain.** `createContainerRuntime.typecheckExecutor()` stages a pinned program into a content-addressed read-only volume, mounts it at `/program` beside the read-only `/candidate` and `/deps`, and runs the *image's* `typecheck-runner.mjs` with no network on a read-only rootfs. Every verdict now carries `environment.producer` (`protected-checker` or `host-checkout`) with `isolated`, the program fingerprint and file count, the dependency volume and the resolved `typescript` version; `isolation: "checker"` makes a host verdict **inconclusive before compiling**, and an unlabelled producer can never read as isolated. A dependency volume without a compiler is refused up front, by name, instead of producing a baseline full of TS2307s. Still open, and both are the owner's: `node scripts/delivery-v2/setup-checker-deps.mjs` has not been run, so `era-dlv107-dependencies` still has no `typescript`; and `isolation` is not yet set to `"checker"`, so the policy default falls back to the labelled host path. The in-container demonstration (`tests/delivery-v2/typecheck.docker.test.ts`, deliberate failure + passing control + a compiler-less refusal) is written and **unrun** — it needs a Docker daemon and builds an image. Journey-level coverage in `tests/delivery-v2/verification-gate.test.ts`: the checker is used when the runtime offers one and the verdict records it, an unavailable checker falls back to the labelled host path with the reason in `typecheck.checker-unavailable`, and under `isolation: "checker"` an unavailable checker leaves the candidate **not verified** rather than passing.

🟠 **DLV-122 — 2026-09-19: a lifetime token allowance silently blocks every new run.** `concurrency.fleetAllowance` 200,000 is compared with *settled* lifetime tokens (DLV-107 settled 284,243), so the DLV-90 run `r-8e7f635c1466` waits as "Capacity full" beside Writers 0/1 · Jobs 0/1. The screen does not name tokens as the cause, the allowance never resets, and a waiting run has no Cancel. Evidence: `coordination.mjs:545-569` (capacityReasons FLEET), owner UAT walkthrough 2026-09-19.

🔴 **DLV-114 / DLV-119 — 2026-09-14: token threshold overrun and inflated totals.** *(In-job stopping implemented 2026-09-20; the real stop witness is UAT U20.)* The two jobs report 281,732 input and 2,511 output tokens plus cached/reasoning subsets. Current settlement/display adds all four categories (482,416); the input-plus-output interpretation is 284,243, still 42.1% above the 200,000 threshold. Per-job reservation is 50,000 and `strict: false`; no in-job stop was observed. Preserve raw receipts and prove provider-specific normalization before changing admission. [Run evidence and implementation](<../_Archive/Plans/Delivery First-Run Hotfix (2026-09-14).md>).

🟠 **DLV-115 / DLV-116 — 2026-09-14: consequential actions lack reviewable context.** `DeliveryV2.tsx` sends rollback directly without confirmation and renders only kind/path for a candidate. Approval appears before plan content; valid raw plan text is not exposed. Actual rollback succeeded: `Work.tsx` existed at launch and its present hash equals the recorded before-image. Do not delete it as a purported repair.

🟠 **DLV-117 / DLV-118 — 2026-09-14: depth labels do not create proportionate execution.** Focused/Investigate are stored settings and optional catalog recommendations but share the same initial investigation path. The installed catalog supplies only a Focused suggestion. The native build spent work attempting unavailable typecheck/docs commands; protected checks run separately. Broader per-call token attribution is unavailable.

🟠 **DLV-112 / DLV-113 — 2026-09-14: evidence and revision affordances leave the owner stuck.** Recheck produced repeated inconclusive Results with identical evidence refs; counts and reason details are not rendered. The parser component is now patched and v5 passed, but readable logs, actionable failure distinctions and a bounded candidate-revision action remain pending. *(2026-09-20: readable logs and the failure distinctions shipped under [DLV-120](<../_Archive/Shipped/Delivery.md#dlv-120>) — retained redacted output with criterion/revision identity, and `runner-missing` / `output-unreadable` / `no-tests-selected` / `tests-failed` kept apart. The bounded candidate-revision action is still [DLV-113](<#dlv-113>).)* PM Tooling [R64](<../PM Tooling/PM Tooling — Master Book.md#r64>) owns responsive presentation; [R55](<../PM Tooling/PM Tooling — Master Book.md#r55>) owns attempt history.

🟡 **2026-09-13 — subscription credentials need a refresh path for unattended use.** Current setup copies only native subscription credentials into isolated read-only volumes. The worker checks the provider before inference and refuses expired credentials; it does not yet refresh an expired snapshot through native SDK control requests. Desktop readiness is verified now; future unattended launches must not be promised across credential expiry. [DLV-111](<#dlv-111>) owns refresh and actionable reconnect status.
⚪ **DLV-108 — 2026-09-13, resolved 2026-09-20: a successful job could strand its run after a restart.** The job became terminal before its plan/result transition; startup only scanned nonterminal jobs. A synthetic release failure left `ACTIVE`, one `finished/succeeded` job and zero plans even after reconciliation. Fixed by the schema-8 settlement marker and a second recovery scan — see the Shipped Log entry. Deterministic fixtures only; the owner's real restart acceptance ([U18](<../../../docs/Delivery-UAT.md>)) is still Pending. [Recovery criteria](<../_Archive/Shipped/Delivery.md#dlv-108>).

🟡 **DLV-107 — 2026-09-13: “See what changed” opens the backlog instead of history.** The link sends `view=story`, while its destination reads `tab=story`; actual-component rendering reproduced both outcomes. [First-trial scope](<../_Archive/Shipped/Delivery.md#dlv-107>).

🟠 **DLV-109 — 2026-09-13: live executor activity arrives only when the stream finishes.** *(Implemented 2026-09-20: events are relayed and persisted from inside the stream; acceptance during a real run is pending.)* The adapters accumulate activity in memory and the supervisor persists it with the final dispatch result. An observed Read event stayed absent from the run view until completion. [Activity criteria](<#dlv-109>).

🟠 **2026-09-11 planning assessment — delivery boundary gaps:** V1's budget predicate returns OK for null/NaN cost against a finite limit (re-probed 2026-09-11; [DLV-87](<#dlv-87>)); unchanged. The V2 gaps — unknown/unit settlement, trusted qualification loading, exclusive dispatch claims and trusted-local authentication — were implemented 2026-09-12 under [DLV-97](<#dlv-97>) and [DLV-96](<../_Archive/Shipped/Delivery.md#dlv-96>), with fixtures, not yet with a real run. The initial-selection gap is closed at V2 entry. Evidence: [Command Center §2](<../Plans/Command Center.md#2-what-is-actually-present>).

🟡 **2026-09-12 — the Claude SDK stop threshold was invisible to the interface probe.** `@anthropic-ai/claude-agent-sdk` 0.3.207 exposes `Options.maxBudgetUsd` (the query stops after its estimate is exceeded); `probes/claude-qualification.mjs` searched only for other option names. Detection added; it is recorded as `monetaryThresholdOption` and forwarded from the policy's `dispatch.thresholdUsd`, and the strict whole-job bound stays refused.

🟠 **2026-09-12 — Phase 5 landed ahead of two prerequisites.** PM Tooling [R61](<../PM Tooling/PM Tooling — Master Book.md#r61>) (sprints and readiness) has no implementation: no `_Planning.json`, readiness module or Sprints view. Parallel verdicts therefore appear on Delivery, Launch and Run but not on a sprint board, and prerequisite order reads the checklists and Master Books directly. No executor profile is qualified ([DLV-96](<../_Archive/Shipped/Delivery.md#dlv-96>)), so no real parallel pair can run. Found while verifying Phases 2–4 for DLV-106.

🟠 **2026-09-11 planning assessment — phone recovery/provenance:** command waiters register after insertion; timeouts have no durable receipt recovery; a bridge crash between effect and receipt can leave a claimed command; cache/snapshot state is not owner-bound or replaced. Source-level findings from the plan's review, not observed incidents. **2026-09-12:** repaired in code for both the shared relay view and the legacy view ([DLV-104](<#dlv-104>)); production still has the old relay policies, under which a phone session can UPDATE its own command rows (reset a claimed command to pending, or write a receipt) and write `pm_live` rows, until the owner runs `migrations/2026-09-12_pm-v2-relay.sql`. The bridge's journal refuses to re-run an effected command even so. DLV-77 and R42 keep their separate scope.

🔴 **DLV-97** Authorize dispatch and enforce its policy. See [acceptance](<#dlv-97>) for the root cause, evidence and gate.

🟠 **DLV-98** Record a native baseline for a selected real item. See [acceptance](<#dlv-98>) for the root cause, evidence and gate.

🟠 **DLV-86** Correct forecast units from clean receipt provenance. Dated source diagnosis; cause and witness limits are in [criteria](<#dlv-86>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **DLV-87** Reject launches with unknown or unpriced cost. Dated source diagnosis; cause and witness limits are in [criteria](<#dlv-87>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **DLV-88** Separate API cost, estimates and subscription usage. Dated source diagnosis; cause and witness limits are in [criteria](<#dlv-88>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **DLV-90** Reject zero-test validation as NOT_TESTED. Dated source diagnosis; cause and witness limits are in [criteria](<#dlv-90>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

🟠 **DLV-91** Release abandoned session locks safely. Dated source diagnosis; cause and witness limits are in [criteria](<#dlv-91>) and its provenance. Runtime incidence/application is unverified unless the cited receipt says otherwise.

The remaining retained defects, decisions and enhancements are indexed below and ordered once in the checklist. Historical study claims are not new production incidents.

## Acceptance Criteria Index

### DLV-159

**Outcome:** The supervisor's commit, merge commit and revert wait for the repository hook, and a timeout is reported as a timeout.
**Kind:** bug
**Source:** [Agentic OS delivery reliability](<../Plans/Agentic OS Delivery Reliability.md#dlv-159--supervisor-git-steps-outlive-the-hook>), 2026-11-15 review of the seven failed HUB-118 runs. The sheet is the execution plan.
**Touches:** `scripts/delivery-v2/local-lane.mjs`, `scripts/delivery-v2/process.mjs`, `scripts/pm/app/localRunFailure.ts`, `tests/delivery-v2/local-lane.test.ts`, `tests/pm-ui/`

- **Acceptance:** A fixture hook that outlasts 30 s no longer fails the build commit; ship and undo use the same limit. A timeout kills the hook's process tree and reads `timed out after <n> s`. The hook's six stage lines appear as supervisor rows, in order.
- **Tier:** `CLAUDE_MID`, effort high. CLI session, not the lane. Owner restart of `pnpm pm` activates it.
**Implementation:** done (2026-11-15). Ordinary Git remains 30 s; commit/merge/revert use 25 minutes and push uses 5 minutes. Timeout kills the process tree and has its own failure title; six deduplicated hook stages are recorded as Seal evidence. Real-Git fixtures verify a 31 s successful hook, timeout with both hook processes gone and HEAD unchanged, unchanged failing-hook text, ordered stage rows and build/ship/undo limits. [Verification and handover](<../../../.pm/dlv159-evidence/README.md>).
**Reverification (2026-11-15):** Existing implementation preserved; the required PowerShell delivery-v2 + pm-ui command passes 156 files / 2,129 tests (3 files / 8 tests skipped), and three final full runs each pass 348 files / 5,420 tests (3 files / 24 tests skipped). The real-Git 31-second hook, descendant kill/unchanged HEAD, stage ordering, nonzero hook text and injected build/ship/undo/push limits pass. Actual multi-minute Windows repository-hook timing and a real provider run remain unverified. [Current packet evidence](<../../../.pm/reliability-20261115/README.md>). The prior ship receipt is retained; no duplicate ship.
**Audit recheck (2026-11-15):** No implementation gap found. Fresh required PowerShell suite passes 156 files / 2,129 tests, with 3 files / 8 tests skipped; real-Git hook, descendant termination, stage provenance and limit assertions pass. Typecheck, full lint, changed-file ESLint and PM lint pass. Existing source and ship receipt preserved; no second ship. [Recheck evidence](<../../../.pm/reliability-recheck-20261115.md>).
**UAT:** pending. Owner restart required. W1 is owner-only after DLV-160 and R124; no live delivery, Ship or Undo was run here. [Owner steps](<../../../docs/Delivery-UAT.md#supervisor-git-limits--dlv-159>).

### DLV-160

**Outcome:** A failed Local run shows the reason the worker or the check recorded, before any raw log.
**Kind:** bug
**Source:** [Agentic OS delivery reliability](<../Plans/Agentic OS Delivery Reliability.md#dlv-160--every-failure-names-its-real-cause>), 2026-11-15.
**Touches:** `scripts/delivery-v2/local-lane.mjs`, `scripts/delivery-v2/failure-lines.mjs`, `scripts/pm/app/localRunFailure.ts`, `tests/delivery-v2/`, `tests/pm-ui/`

- **Acceptance:** The run stores `failure { code, step, detail }` for the nine codes in the sheet. Native errors and no-change endings carry the worker's own words. Decisive lines are extracted from test, type and lint output. Stored runs without the field still decode.
- **Tier:** `CLAUDE_MID`.
**Implementation:** done (2026-11-15). The nine specified failure codes persist with their recorded reasons beside raw errors. Decisive lines strip ANSI and preserve up to twelve diagnostics; the trimmed retained-run fixture yields ten FAIL lines plus both totals. Calm and Game show the detail before collapsed raw output, old records decode without the field, and replay hides terminal failure facts. Ordinary Git faults and candidate drift retain their accurate legacy titles.
**Verification (2026-11-15):** Final typecheck and changed-file ESLint pass; required `npx vitest run tests/delivery-v2 tests/pm-ui` passes 156 files / 2,129 tests, with 3 files / 8 tests skipped. Three final full runs each pass 348 files / 5,420 tests, with 3 files / 24 tests skipped and zero failures. Eight current-source static browser cases (Calm/Game, 390/1440 px, Blue/Pink) verify detail order, raw-log disclosure and overflow. [Evidence and complete file list](<../../../.pm/reliability-20261115/README.md>).
**Audit recheck (2026-11-15):** All nine specified failure codes, decisive-line extraction, legacy decoding and Calm/Game detail placement remain covered. Fresh required suite passes 156 files / 2,129 tests, with 3 files / 8 tests skipped; typecheck, full lint, changed-file ESLint and PM lint pass. The 41 source hashes match the existing acceptance packet. Existing ship receipt retained. [Recheck evidence](<../../../.pm/reliability-recheck-20261115.md>).
**UAT:** pending. Owner restart of pnpm pm required. No real provider/Local run, actual multi-minute Windows hook timing, hydrated app or physical-device witness. [Owner scenarios](<../../../docs/Delivery-UAT.md#local-failure-reasons--dlv-160>). DLV-161–163 remain held for owner confirmation of W1.

### DLV-161

**Outcome:** After any failed or interrupted Ship, Undo or command, the next click works; closed runs leave no credential copy and can release their worktree.
**Kind:** bug
**Depends on:** DLV-159
**Source:** [Agentic OS delivery reliability](<../Plans/Agentic OS Delivery Reliability.md#dlv-161--ship-undo-and-locks-recover-closed-runs-clean-up>), 2026-11-15.
**Touches:** `scripts/delivery-v2/local-lane.mjs`, `scripts/delivery-v2/local-routes.mjs`, `scripts/delivery-v2/local-cli.mjs`, `scripts/pm/app/`, `tests/delivery-v2/`

- **Acceptance:** Ship validates the candidate's checklist row before merging, aborts the merge on any failure and returns to `uat-ready`; a run found in `merging` recovers. A lock held by a dead process is reclaimed with a recorded row. The private credential home is removed when a run ends, and for runs already closed. An owner `discard` removes a closed attempt's worktree and branch and keeps its record.
- **Tier:** `CLAUDE_HIGH`.
**2026-11-16 progress — parts 1–2:** candidate checklist validation now precedes merge; failed/matching interrupted Ship and Undo restore retry state only after proving ownership of the staged/worktree bytes. Exact recorded inverse recovery also handles Git's hook failure without `REVERT_HEAD`. Extra owner edits, foreign operations, advanced HEAD and ambiguous post-commit interruptions fail closed. Dead-PID command locks recover with an activity row; live/unknown locks remain protected. Twenty-four focused recovery/safety cases passed before the final broad run. W1 is pending. Parts 3–4 (credential-home cleanup and Discard files) are not implemented; this parent remains open. [Owner scenarios](<../../../docs/Delivery-UAT.md#agentic-os-v0-corrections--dlv-161-parts-12--r121--r129--r130>).

**2026-11-22 completion:** DLV-170 archives failed and discarded candidates and releases run-owned credentials, dependencies, branch and checkout. DLV-171 retires the compound Ship and Undo operations covered by the earlier recovery work. Fixtures exercise cleanup after partial failure and preserve the original patch.
**Implementation:** done (parts 3–4 under DLV-170).
**UAT:** pending. [Storage and recovery witness](<../../../docs/Delivery-UAT.md#local-delivery-from-start-to-push--dlv-168>).

### DLV-162

**Outcome:** A delivery runs each verification command once, shows each as its own check, and stores rule verdicts on the run.
**Kind:** feature
**Depends on:** DLV-159
**Source:** [Agentic OS delivery reliability](<../Plans/Agentic OS Delivery Reliability.md#dlv-162--each-gate-runs-once-visibly-with-rule-verdicts>), 2026-11-15. Admission: one delivery has shipped through the lane, and owner decision D1 in the [review](<../Plans/Agentic OS Review.md#8-owner-decisions>) is recorded.
**Touches:** `scripts/delivery-v2/local-lane.mjs`, `scripts/delivery-v2/local-process.mjs`, `scripts/pm/app/`, `scripts/os/`, `tests/delivery-v2/`, `tests/pm-ui/`

- **Acceptance:** Checks come from one declared list that a parity test ties to `.claude/hooks/pre-commit.sh`. `os:eval <base>..<head>` is a check and its verdicts are stored. No command runs twice in one delivery. A Local run with every check passed and no failing verdict counts as clean in Score.
- **Tier:** `CLAUDE_HIGH`.
**Implementation:** pending

**2026-11-16 admission:** the owner approved D1: the supervisor may disable hooks for its build/ship commits and execute every declared gate itself, once each. W1 has not been run; the sheet explicitly forbids starting this rewrite before it passes. Existing hooks and four host checks remain active; no duplicate-gate or Local clean-score claim is made by the replay-only corrections.

### DLV-163

**Outcome:** The worker starts with its playbook, risk skills, rules and Feature Map file already named, and Deliver shows them.
**Kind:** feature
**Source:** [Agentic OS delivery reliability](<../Plans/Agentic OS Delivery Reliability.md#dlv-163--deliver-routes-the-item-before-launch>), 2026-11-15; the part of the rejected skill launcher (R98, R108) worth keeping. Admission: one delivery has shipped through the lane.
**Touches:** `scripts/delivery-v2/route.mjs`, `scripts/delivery-v2/local-lane.mjs`, `scripts/os/process.mjs`, `scripts/pm/app/`, `tests/delivery-v2/`, `tests/pm-ui/`

- **Acceptance:** A pure `routeFor` resolves playbook, skills from the existing `requires` table, rules and the Feature Map file from the item's Kind and Touches. The instruction carries a Route block; Deliver shows it as chips. A routed skill the session never read is a process failure through the existing detector.
- **Tier:** `CLAUDE_MID`.
**Implementation:** pending

### DLV-164

**Outcome:** A Local Claude session can stop and ask the owner a question, with its recommended option preselected, and continues with the answer — shown as a chat in the session view.
**Kind:** feature
**Source:** owner request, 2026-11-21: "why aren't I able to have Agent SDKs in my PM Deliveries to ask me questions? … let the questions have recommended answer … I want to feel like I'm talking here in chat."
**Touches:** `scripts/delivery-v2/adapters/claude.mjs`, `scripts/delivery-v2/local-questions.mjs`, `scripts/delivery-v2/local-worker.mjs`, `scripts/delivery-v2/local-worker-channel.mjs`, `scripts/delivery-v2/local-process.mjs`, `scripts/delivery-v2/local-lane.mjs`, `scripts/delivery-v2/local-routes.mjs`, `scripts/pm/app/`, `tests/delivery-v2/`, `tests/pm-ui/`

- **Acceptance:** A Local Claude build offers `AskUserQuestion`. The call is answered only by the owner, through `canUseTool`. Review jobs, Confined and Codex runs do not get the tool. The worker relays each call to the supervisor. The supervisor validates its shape, records it in `.delivery/local-questions/<run>.json` and holds the session until an answer is given or the session ends.
- **Acceptance:** `POST /api/delivery/v2/local {action:"answer"}` accepts the owner's answers only while the session runs. It needs one answer per question and treats a repeated identical answer as a replay. It refuses closed, unknown and conflicting answers.
- **Acceptance:** The instruction tells Claude to ask only for decisions that belong to the owner and to put its recommended option first, marked "(Recommended)". The UI preselects that option and shows the description and preview. "Other" accepts free text, and multi-select joins choices.
- **Acceptance:** Calm view shows a Chat thread (main-thread narration, questions, answers). In Game view the question card appears in the Needs you rail. An open question reads "Question for you" (owner's turn, not "No signal"). Sessions and Delivery home put the run under Needs you. Replay hides questions and answers that come after the cursor.
- **Tier:** `CLAUDE_MID`.
**Implementation:** done (2026-11-21). Replay-only coverage: `tests/delivery-v2/local-questions.test.ts` (shape, adapter tool gating and `canUseTool` answers, worker channel, real child-process round trip through the fixture worker) and the `DLV-164 owner questions` block in `tests/delivery-v2/local-lane.test.ts` (hold and resume, route answer, replay/conflict, cancel closes, malformed refused); `tests/pm-ui/local-chat.test.ts` (recommendations, Other, thread order, card render, attention, liveness, replay masking, Needs you lanes). No live provider run.
**Limits:** Codex has no equivalent tool, so Codex runs never ask. Questions are desktop-only, like the rest of Local; the phone relay does not carry them. A PM server restart while a question is open interrupts the session, as any restart does. Free mid-run messages from the owner are not part of this item.
**Superseded in part (2026-11-21):** [DLV-165](<#dlv-165>) replaces holding the process with park-and-resume. It moves the ledger to `.delivery/local-chat/<run>.json`, adds owner messages and gives Codex `ask_owner`. The three limits above no longer apply, except desktop-only. The question card, recommendation and Needs you placement are unchanged.
**UAT:** pending. Covered by DLV-165's owner scenarios, which include everything here.

### DLV-165

**Outcome:** An owner question no longer holds a live process. The session parks and resumes with the answer, surviving PM restarts. The owner can message the agent at any time, and Local Codex runs can ask too.
**Kind:** feature
**Source:** owner, 2026-11-21, after DLV-164: "is there a better approach?" → agreed plan (park-and-resume, two-way chat, Codex parity) → "do all the steps now".
**Touches:** `scripts/delivery-v2/local-lane.mjs`, `scripts/delivery-v2/local-questions.mjs`, `scripts/delivery-v2/local-worker.mjs`, `scripts/delivery-v2/local-worker-channel.mjs`, `scripts/delivery-v2/local-process.mjs`, `scripts/delivery-v2/local-routes.mjs`, `scripts/delivery-v2/local-ask-mcp.mjs`, `scripts/delivery-v2/adapters/claude.mjs`, `scripts/delivery-v2/adapters/codex.mjs`, `scripts/pm/app/`, `tests/delivery-v2/`, `tests/pm-ui/`
**Depends on:** DLV-164

- **Acceptance (park):** A question is validated in the worker. A malformed one is refused back to the agent, and nothing is recorded. A valid one is recorded, and the turn ends: Claude through `canUseTool` deny with `interrupt`, Codex by stopping on the next work item. The run stays `building` with `parked` set and the job `paused`. No process remains, `interrupted` is false, and Bridge does not call it interrupted.
- **Acceptance (resume):** An answer, or an owner message, resumes the same native session under job `<run>:r<n>` with the original native id. Delivered answers and messages are marked. Counters add up across segments. Resume works after a PM restart. An answer given while the session is still winding down resumes at once. A session that parks without a recorded question fails rather than waiting.
- **Acceptance (messages):** `POST /api/delivery/v2/local {action:"message"}` is accepted only while the session can take it. A running Claude session gets messages at its next tool call (PostToolUse context) or when it tries to stop (Stop hook, conversation continues). Messages no session took resume it before checks. A message to a parked session closes the open question as unanswered and resumes. Cancel closes a parked session directly.
- **Acceptance (Codex):** The private `config.toml` registers `era_owner`, the stdio `local-ask-mcp.mjs`. Its `ask_owner` tool mirrors the AskUserQuestion shape, and the instruction names it. The tool only validates and acknowledges; the worker records the call from the event stream.
- **Acceptance (UI):** The chat thread shows owner messages with a Queued or Delivered mark. A composer (text, Enter to send) appears in calm view, and in Game view's Activity panel, while `canMessage`. Replay hides future messages.
- **Tier:** `CLAUDE_MID`.
**Implementation:** done (2026-11-21). Replay-only coverage:
- `tests/delivery-v2/local-questions.test.ts`: ledger, Claude parking against a fake SDK, resume identity, message hooks, Codex parking against a fake SDK, the MCP server, and the worker channel with a real child-process park and live message.
- The `DLV-164/165` block in `tests/delivery-v2/local-lane.test.ts`: park, restart, answer and resume; message resume; live delivery without resume; undelivered-message resume; answer while winding down; parked cancel; park without a question; Codex config.
- `tests/pm-ui/local-chat.test.ts`: owner messages, composer, replay masking, and the Bridge core not calling a parked run interrupted.

No live provider run.
**Limits:**
- These SDK behaviours are verified only against fakes: Claude's handling of `interrupt: true` on AskUserQuestion, a Claude resume after it, and Codex MCP tool calls and thread resume after an aborted turn. One owner-started run per executor is needed.
- Codex gets messages only between turns, not mid-turn.
- Still desktop-only.
**UAT:** pending. [Owner scenarios](<../../../docs/Delivery-UAT.md#local-questions-and-chat--dlv-164--dlv-165>).

### DLV-168

**Outcome:** One page per Local run takes an item from Start to Pushed with owner buttons only. Every git command is shown before it runs, nothing reaches `origin`, and the delivery folders stay small.
**Kind:** feature
**Source:** owner, 2026-11-22: "write me a prompt that guides AI on implementing a full organized workflow … make sure the PM delivery session for an item is clear … the delivery cloned repos are more than 18 GB … not acceptable". Plan and prompt: [Delivery Local Workflow — Rethink](<../Plans/Delivery Local Workflow — Rethink.md>).
**Touches:** `scripts/delivery-v2/`, `scripts/pm/app/`, `tests/delivery-v2/`, `tests/pm-ui/`, `docs/Delivery-UAT.md`

- **Acceptance:** the stepper, status words and buttons in plan §5. Commit stages only the run's files plus its PM files. Push uses the one configured command, and Ship and Push refuse when it is unset.
- **Acceptance:** the disk budget in plan §6. With no active run `<repo>-delivery/` is empty, and one active run takes under 300 MB as Explorer reports it. Closed runs leave no worktree, branch or credential home.
- **Acceptance:** agents never run state-changing git; owner clicks may, limited to plan §2.3. Every git test uses a fixture repository.
- **Tier:** `CLAUDE_HIGH`.
**Implementation:** done (S0–S5, 2026-11-22). Fresh Local runs use one Calm/Game page through Test steps, sign-off, Merge, Commit, Push and cleanup. The tested branch, file manifest, PM changes, commit, published tip and archive have separate records. Native execution and real publication remain owner actions.
**UAT:** pending. [Owner walkthrough](<../../../docs/Delivery-UAT.md#local-delivery-from-start-to-push--dlv-168>). Chromium fixture witnesses at 1280 px and 390 px reached Pushed and Cleaned after a reload. Temporary Git repositories exercised the real filesystem, command router, lease rejection and rebase. The real owner push and Explorer budget measurement are outstanding.

**Stage 0 decision, 2026-11-22.** The owner approved all six defaults and requested completion of the whole workflow in one implementation session. The remote guard comes first. The stage witnesses remain separate owner acceptance scenarios.

| Decision | Approved default | Owner answer |
|---|---|---|
| D1 · Push | Preview outgoing commits, then `git push --force-with-lease internal main`. Ordinary `git push internal main` also supports the routine fast-forward case. | Approved |
| D2 · Commit title | `<ID> <title>` | Approved |
| D3 · Worktrees | Limit to two. A run awaiting a question, test, recovery, commit or push keeps its place. At capacity, show the two runs. | Approved |
| D4 · Dependencies | Share matching dependencies only when the target is protected against writes by the worker, hooks, checks and preview. Otherwise use private dependencies, including for dependency changes. | Approved |
| D5 · Commit scope | Only the run's tested changes and the PM changes attributable to this item. Preserve unrelated staged and unstaged edits, including edits in a shared PM file. | Approved |
| D6 · Remotes | Refuse `origin` across Local actions, including legacy Ship, Retry push and Undo. An unset destination blocks a push. | Approved |

### DLV-171

**Outcome:** S2. Every Local action that can publish uses the owner's saved destination and push mode.
**Kind:** bug
**Depends on:** DLV-169
**Touches:** `scripts/delivery-v2/`, `scripts/pm/app/`, `tests/delivery-v2/`, `tests/pm-ui/`, `docs/Delivery-UAT.md`

- **Acceptance:** Configure the destination once in Setup. Enforce the setting in the backend on new and retained runs. Refuse an unset destination, the wrong branch and `origin` before any write. Retire old compound Ship/Undo paths that would merge, revert or push implicitly in the main checkout. Exercise direct legacy requests and retries against two fixture remotes.
- **Witness:** After restart, the owner sees the chosen destination and can inspect an old run without being offered an unsafe retry.
- **Implementation:** done. An authenticated owner previews and binds the credential-free push URL. The backend refuses a changed destination and both obsolete combined commands. Two isolated remotes verified the destination and lease.
- **UAT:** pending. [Destination witness](<../../../docs/Delivery-UAT.md#local-delivery-from-start-to-push--dlv-168>).

### DLV-170

**Outcome:** S1. The owner can reclaim closed runs from Setup and see how much disk each active run uses.
**Kind:** feature
**Depends on:** DLV-169
**Touches:** `scripts/delivery-v2/`, `scripts/pm/app/`, `tests/delivery-v2/`, `tests/pm-ui/`, `docs/Delivery-UAT.md`

- **Acceptance:** Implement DLV-161 parts 3–4 once. Preview eligible run IDs and paths before the cleanup click. Protect resumable sessions, pending post-delivery work and unproven ownership. Preserve the final patch, logs, handover and run record before removing owned temporary files, branch and credential home. Cleanup is retryable and never repeats a successful push. Failures with unsaved work retain a recoverable copy.
- **Acceptance:** Enforce D3 at Start. Measure distinct stored files across the lane and report the active checkout size separately. Verify the 300 MB Explorer target on the normal matched-dependency path and identify any private-install exception with the owner before accepting it. Test junction removal with a surviving target, candidate writes and preview cache isolation. A manifest match alone cannot make a writable junction safe.
- **Evidence (2026-11-22):** Ten sibling worktrees, nine CLI homes totaling 883.1 MiB by file length, including 616.8 MiB of Codex sandbox binaries. The BUD-95 preview has 147.1 MiB in `.next`. Sampled Next package files share an NTFS file ID across the worktrees and main. These are separate measurements.
- **Witness:** The owner reviews the eligible list, cleans it, starts one run and checks its size in Explorer. Once all runs are closed and cleaned, the sibling directory is empty and closed runs have no credential home.
- **Implementation:** done. Setup previews each eligible checkout, the branch deletion, and the file sizes. Private dependencies and the preview cache use run-owned targets. Offline pnpm installation, an HTTP 200 Next preview, guarded junction removal, archive recovery and the worktree limit were exercised in disposable fixtures. Read-only inspection of the owner's ten worktrees found nine eligible for bulk cleanup and one protected historical file-copy merge (BUD-95).
- **Windows cleanup follow-up.** Git for Windows rejected a 264-character pnpm dependency path in the closed TRIP-33 retry after unregistering its worktree. Cleanup now enables long paths for its Git commands. A matching archive and branch allow a fresh preview to recover the detached folder, archive surviving source and remove generated dependencies and preview caches.
- **UAT:** pending. The owner confirms cleanup of the remaining eligible checkouts. [Disk witness](<../../../docs/Delivery-UAT.md#local-delivery-from-start-to-push--dlv-168>).

### DLV-172

**Outcome:** S3. A Local run in Calm or Game stays on one page through sign-off and shows the next action after a reload.
**Kind:** feature
**Depends on:** DLV-169, DLV-170, DLV-171
**Touches:** `scripts/delivery-v2/`, `scripts/pm/app/`, `tests/delivery-v2/`, `tests/pm-ui/`, `docs/Delivery-UAT.md`

- **Acceptance:** Reuse the current Run app, Test steps and risk review. Use one projection of persisted run facts for the page, session list and Game rail. An old file-copy receipt means Merged in your folder. Only a confirmed push means Pushed. A failed PM update offers recovery. Keep merged runs reachable until their next action is resolved. Keep standalone UAT links usable.
- **Witness:** From Sessions the owner opens a run, signs off, switches views and reloads. The run still opens on the same next action.
- **Implementation:** done. Calm and Game share the run actions and recorded milestones. Local Test steps stay on the run URL. Browser fixtures completed the desktop and phone-width paths with a reload after Merge.
- **2026-11-22 owner-room revision.** Game opens the handoff in its own six-station board or 3D workshop. Calm exposes the same station inspector. Read-only inspection and explicit review use the recorded candidate revision. BUD-95 desktop and phone-width checks reached the transaction route patch and all 69 recorded events. Browser fixtures exercised sign-off through push. The owner's publication witness remains pending.
- **Explore 3D follow-up.** The elevator joins two floors of the same observatory. The renderer, gait, camera, touch controls, seat and core persist during travel. Six interactive owner bays use the run’s existing actions and the Merge projector shows the chosen file.
- **UAT:** pending. [Run page witness](<../../../docs/Delivery-UAT.md#local-delivery-from-start-to-push--dlv-168>).

### DLV-173

**Outcome:** S4. The owner can commit and then push the tested changes from the run page.
**Kind:** feature
**Depends on:** DLV-172
**Touches:** `scripts/delivery-v2/`, `scripts/pm/`, `tests/delivery-v2/`, `tests/pm-ui/`, `docs/Delivery-UAT.md`

- **Acceptance:** Freeze the copied candidate paths and the item's actual PM changes at Merge. The current global PM sweep can touch other campaigns. Isolate the item's changes and refuse overlapping owner edits before altering shared PM files. Before Commit, show and recheck exact paths, contents, branch and argv. A bare commit consumes pre-staged unrelated files. Refuse that case under the current git allowlist, or use an explicitly agreed path-limited commit. Cover added/deleted files and edits made after Merge.
- **Acceptance:** A separate Push click previews the destination, command and all outgoing commits, including parallel work on the branch. Record the confirmed commit and pushed tip, exit codes and output tails. Reconcile interrupted operations before retrying. A failed push stays Committed and retries only the push. Record cleanup independently so retrying it cannot republish.
- **Witness:** One fresh real item goes Start → Pushed on one page. Parallel local edits survive. The owner can reopen the run and see the push receipt.
- **Implementation:** done. The selected item's PM receipt and exact file changes are computed before Merge. Commit preserves unrelated staging. Push previews every outgoing commit and pins the expected remote tip. A remote read can verify an external push. The authenticated fixture exercised separate merge, commit and publication with two remotes and parallel owner work.
- **UAT:** pending. [Real publication witness](<../../../docs/Delivery-UAT.md#local-delivery-from-start-to-push--dlv-168>).

### DLV-174

**Outcome:** S5. A blocked Merge names the overlapping files and offers an action appropriate to their state.
**Kind:** feature
**Depends on:** DLV-173
**Touches:** `scripts/delivery-v2/`, `scripts/pm/app/`, `tests/delivery-v2/`, `tests/pm-ui/`, `docs/Delivery-UAT.md`

- **Acceptance:** For committed overlap, an owner-clicked Refresh operates inside the run worktree only. A clean refresh requires new host checks, UAT and any applicable diff review for the new head. A rebase conflict lists the files and preserves the recoverable candidate. For an overlapping uncommitted edit in the owner's checkout, identify the file and allow a recheck after resolution. Discard identifies what it will release and preserves the run archive.
- **Witness:** Exercise both overlap types in fixture repos, then observe a real conflict and its recovery with the owner.
- **Implementation:** done. Uncommitted overlaps get a recheck. Committed overlaps can rebase the session worktree. A clean refresh freezes a handover on the new head after checks. A conflict records its files and restores the previous candidate. Fixture coverage includes stale previews and failed-check retries.
- **UAT:** pending. [Conflict witness](<../../../docs/Delivery-UAT.md#local-delivery-from-start-to-push--dlv-168>).

### DLV-167

**Outcome:** After testing a Local candidate, one **Merge** button copies the session's files into the owner's main checkout. It refuses with a red alert when any of those files changed there since the session started. The owner then commits and pushes as usual (`git push --force internal main`).
**Kind:** feature
**Source:** owner, 2026-11-22, after a successful BUD-95 UAT: "add a Button to merge: it will check if files 1,2,3 changed from branch Alpha to Beta; if yes, stop and throw an alert; if not, replace files 1,2,3 in BETA from files 1,2,3 in the cloned Repo", with commit and push staying manual as phase 0. Pain: "Local Ship does not match how the owner ships" above.
**Touches:** `scripts/delivery-v2/local-lane.mjs`, `scripts/delivery-v2/local-routes.mjs`, `scripts/pm/app/LocalDelivery.tsx`, `scripts/pm/app/localBoardActions.ts`, `scripts/pm/app/LocalRunGame.tsx`, `scripts/pm/app/LocalRunReview.tsx`, `scripts/pm/app/LocalRunConsole.tsx`, `tests/delivery-v2/`, `tests/pm-ui/`

- **Acceptance (check):** the session's files are `git diff --name-status <base> <head>`, without `.delivery-handover.json`. A file conflicts when `git diff <base> HEAD` in the main checkout touches it (committed) or `git status` shows it (uncommitted). The run detail reports `mergePlan {files, conflicts, branch}`. `canMerge` needs the same gates as Ship (current clean head, passed checks, owner sign-off on that head, diff review when risky), plus `main` checked out, at least one file and no conflict. The main checkout may move on other files.
- **Acceptance (merge):** `POST /api/delivery/v2/local {action:"merge"}` re-checks everything under the command lock. It confirms the PM row exists (dry run), then copies added and modified files from the clean worktree and deletes deleted ones. It records the owner's sign-off on the item's `**UAT:** pending` line and runs `pm/ship.mjs#ship` for the item. It makes no Git command that writes. The run closes as `shipped` with `applied {at, files, main_head}`, Undo stays off, and any preview stops.
- **Acceptance (UI):** a `uat-ready` run shows **Merge** in place of **Ship**; Retry push stays for existing push-pending runs. Conflicts show a red alert listing the files. After a merge, the run reads "Merged N files" with the next step: commit and push in your repo.
- **Tier:** `CLAUDE_MID`.
**Implementation:** done (2026-11-22). Replay coverage: the `DLV-167` block in `tests/delivery-v2/local-lane.test.ts`, the route case in `local-preview.test.ts`, `tests/pm-ui/local-board-actions.test.ts`, `local-delivery.test.ts`. Delivery and PM UI suites: 2384 passed, 8 Docker-only skipped. BUD-95 check by hand: none of its four files changed in the main checkout since base `24b981c3`, committed or not, and the owner's sign-off is recorded (`uat-06bc4a08494c`, 11:14:59Z).
**Limits:** A file-copy merge has no Undo; revert in your repo. Git history does not record `delivery/<ID>` as merged. Ship stays in the API for push-pending retries only, until the 🔴 remote defect is fixed. A risky diff still needs Review diff before Merge.
**UAT:** pending. [Owner scenarios](<../../../docs/Delivery-UAT.md#merge-into-your-repo--dlv-167>).

### DLV-166

**Outcome:** The owner can run a Local candidate from its Test steps page with one button, without a terminal and without copying `.env` into the worktree.
**Kind:** feature
**Source:** owner, 2026-11-22, during BUD-95 UAT: the worktree has no `.env` (by design), so `pnpm dev` there failed with "Your project's URL and Key are required"; "i need to have a button that runs this command for me … it should be dynamic based on where the repo was cloned".
**Touches:** `scripts/delivery-v2/local-preview.mjs`, `scripts/delivery-v2/local-lane.mjs`, `scripts/delivery-v2/local-routes.mjs`, `scripts/pm/app/LocalPreview.tsx`, `scripts/pm/app/UatWizard.tsx`, `scripts/pm/app/LocalDelivery.tsx`, `tests/delivery-v2/`

- **Acceptance:** `POST /api/delivery/v2/local {action:"preview"}` starts `pnpm dev --port <port>` with the run's recorded `workspace` as its working directory. It passes the main checkout's `.env` values (`<root>/.env`) only through the child's environment and writes no file into the worktree. Paths come from the run record and the server's root, never constants.
- **Acceptance:** Preview is refused unless the run is `uat-ready`, its worktree is clean at the recorded head and `<root>/.env` exists. A second start for the same run returns the existing preview. Starting another run's preview stops the first, so only one runs at a time. The port is 3000 when free, else the first free port from 3100.
- **Acceptance:** `{action:"stop-preview"}`, Ship and PM server exit stop the process tree. (Cancel needs no hook: it applies only before `uat-ready`.) The run detail reports `preview` as `{state: starting|ready|stopped|failed, url, port, exit, tail}`. The Test steps page of a Local handover shows **Run app**, then the `localhost:<port>` link and **Stop**, and the output tail when it fails.
- **Tier:** `CLAUDE_MID`.
**Implementation:** done (2026-11-22). Env comes from `dotenv.parse` over Next's dev file order (`.env.development.local`, `.env.local`, `.env.development`, `.env`); `NODE_ENV`, `PORT` and `npm_*` are dropped from the inherited environment. Replay coverage: `tests/delivery-v2/local-preview.test.ts` and the `DLV-166` block in `tests/delivery-v2/local-lane.test.ts`. Agent smoke against the real BUD-95 worktree: Ready in 4 s on port 3100, `/api/health` 200, `/login` 200 with no Supabase env error, Stop freed the port, worktree still clean with no `.env`.
**Limits:** Desktop only, like the rest of Local. If the PM server stops without a normal exit (Ctrl+C included), the dev server may keep running, and the restarted server no longer knows about it. The next Run app then takes the next free port. On port 3100+, sign-in relies on the `localhost` cookie from your usual port 3000 session; cookies are not port-scoped.
**UAT:** pending. Needs an owner restart of `pnpm pm`. [Owner scenarios](<../../../docs/Delivery-UAT.md#run-app-from-test-steps--dlv-166>).

### DLV-158

**Implementation:** done

**Outcome:** Retained Local delivery history opens independently of full diff inspection.
**Kind:** bug
**Touches:** `scripts/delivery-v2/local-lane.mjs`, `tests/delivery-v2/local-lane.test.ts`
- **Acceptance:** Failed attempts without a candidate return recorded activity without Git inspection; candidate polls inspect identity/status without reading every changed blob.
- **Acceptance:** Review and Ship perform fresh diff inspection and fail closed when inspection fails; existing UAT/current-head gates remain intact.
**Evidence:** 2026-11-15 read-only inspection of the reported local run found phase failed, head null and 4,485 changed paths; individual identity/status/path-list operations completed in under 150 ms.
**Verification:** Corrected GET handler against the real local SQLite store opened read-only: 200 in 6 ms, failed phase, 35 activity events, work brief present, Ship disabled. Thirty replay regressions, typecheck and scoped lint passed. No production writes or provider calls. The current `--bridge` backend retains the old module until owner restart; its startup publishes production relay data and Hard Rule 26 prohibits the agent initiating that write.
**Handover:** Restart the PM backend after active runs finish, reopen the reported URL in Game and calm modes, and verify saved status, activity and brief load. Do not start a provider session to test history. Candidate Review and Ship remain explicit owner actions.
**UAT:** pending

### DLV-157

**Outcome:** Owner-started Windows Local sessions can edit with Codex's unelevated sandbox or Claude's file tools; the supervisor commits and runs checks.

**Kind:** bug
**Depends on:** DLV-150, DLV-152
**Touches:** `scripts/delivery-v2/local-lane.mjs`, `scripts/delivery-v2/adapters/claude.mjs`, `tests/delivery-v2/local-lane.test.ts`, `tests/delivery-v2/executor-selection.test.ts`
**Implementation:** done
**UAT:** pending

- **Source:** [Local Delivery executor blockers](<../_Archive/Plans/Local Delivery Executor Blockers.md>) (owner execution request, 2026-11-15). Recommended option 3A selected; no WSL installation or failed-attempt cleanup.
- **Acceptance:** Windows private Codex config selects `unelevated`; worker prompts delegate commits to the supervisor. Local Windows Claude omits and disallows Bash, disables only the unused shell sandbox and denies file writes beneath `.claude`, `.codex`, `.agents` and `.husky` while preserving reads and caller constraints. Other platforms and confined dispatches retain fail-loud sandboxing. Replay-only Delivery tests and typecheck pass; no paid run is started by an agent.
- **Owner UAT:** [Windows executor retest](<../../../docs/Delivery-UAT.md#windows-local-executor-retest--dlv-157>). Owner starts HUB-118 with Codex, then Claude; expect edits followed by Host checks started, without read-only/policy/sandbox startup failure. Live results remain pending.

**Evidence (2026-11-15):** `pnpm vitest run tests/delivery-v2` passed 1,226 tests (70 files); 8 opt-in operational tests remain skipped (3 files). The focused executor suites passed 71 tests, including a synthetic Codex session's private Windows config, supervisor commit and four host checks, plus Windows/Linux/macOS Claude options, protected-file denials, preserved reads/caller constraints and unchanged confined sandboxing. `pnpm typecheck`, four-file scoped ESLint, `pm:lint`, `pm:check-docs`, `docs:check` and `git diff --check` passed. No provider call, production DB write, backend restart, WSL install or retained-worktree cleanup occurred. This tooling-only change has no UI/mobile or migration gate; native executor behavior remains owner UAT, including the known Codex outside-worktree read gap.

### DLV-156

**Outcome:** A supervising assistant, or the owner alone, drives a local delivery from start to shipped through one small command contract with a fixed state machine.

**Kind:** feature
**Depends on:** DLV-150, DLV-152, DLV-153
**Touches:** `scripts/delivery-v2/`, `scripts/pm/app/`, `tests/delivery-v2/`, `package.json`

- **Source:** [ERA Steward supervisor contract](<../Fable 2/10 - Project Management/Delivery/5 - Supervisor Contract.md>) (2026-11-10, owner commission to close the Steward subject). Filed 2026-11-10; not started.
- **Acceptance:** One implementation behind the CLI, the stdio MCP server and the Command Center buttons provides eight Steward verbs (`next`, `start`, `status`, `wait`, `answer`, `handover`, `stop`, `report`) and five owner verbs (`mandate`, `review`, `signoff`, `ship`, `undo`) with the documented exit codes. Each run has an append-only log and a state file naming the state, the next actor and the next action; `start` is idempotent per item. The mandate file is enforced before every start and cannot be changed with the Steward credential. The escalation table is code: an unlisted situation is reported, never handled. Exercises E1 to E4 in the contract pass, E1 (no supervisor, one small item from start to shipped) first. The browser-driving procedure in the runbook is retired; the tunnel stays optional.
- **Tier:** CLAUDE_HIGH, effort high. Routing: [Fable 2 model tiers](<../Fable 2/Model Tiers/_Routing.md>).
- **Reading guide:** Reuse `scripts/delivery-v2/steward-mcp.mjs`, `steward-tools.mjs` (intent receipts, last-known state, status templates) and re-point them from launch routes to the verbs. The contract's §4 is the state machine, §7 the mandate, §8 the escalation table, §11 the acceptance.

### DLV-150

**UAT instructions:** [Test steps](<../../../docs/Delivery-UAT-Agentic-OS-2026-11-14.md#dlv-150--native-session-and-host-checks>)

**Outcome:** One item can be built by a native agent session in its own worktree and checked on the host, with no container, policy file or qualification record.

**Kind:** feature
**Touches:** `scripts/delivery-v2/`

**Implementation:** done
**UAT:** pending

**Evidence (2026-11-11):** Local CLI and supervisor use a sibling `delivery/<ID>` worktree, the existing run/job/activity store, native adapters and scrubbed subscription home. Independent host typecheck/lint/test/pm:lint outputs are retained on the run. Replay tests execute a small synthetic non-risk item with real Git and host commands. Native provider execution remains owner-only and unobserved. [Handover](<../../../docs/Delivery-UAT.md#local-lane--dlv-150153>); `.tmp/dlv-150-153/verification.md` retains machine results.

- **Source:** [Fable 2 Local lane design](<../Fable 2/10 - Project Management/Delivery/2 - Local Lane Design.md>) (2026-11-10, owner direction). Filed 2026-11-10; implemented 2026-11-11, owner UAT pending.
- **Acceptance:** From the CLI: create branch `delivery/<ID>` in a worktree outside the main checkout; start one Claude or Codex session there that loads the repository's CLAUDE.md, skills and hooks; when it stops, the supervisor runs typecheck, lint, tests and `pm:lint` on the host and records the output on the session. Proven on one small non-risk item. No production key is present in the agent's environment.
- **Tier:** CLAUDE_HIGH, effort high. Routing: [Fable 2 model tiers](<../Fable 2/Model Tiers/_Routing.md>).
- **Reading guide:** [Diagnosis](<../Fable 2/10 - Project Management/Delivery/1 - Diagnosis.md>), [gate disposition](<../Fable 2/10 - Project Management/Delivery/3 - Gate Disposition.md>). Reuse the session record, activity stream and adapters; do not build a second status engine.

### DLV-151

**UAT instructions:** [Test steps](<../../../docs/Delivery-UAT-Agentic-OS-2026-11-14.md#dlv-151--fresh-local-entry>)

**Outcome:** From a fresh browser on `127.0.0.1`, one click on an item reaches a running local session.

**Kind:** feature
**Depends on:** DLV-150
**Touches:** `scripts/pm/app/LaunchReadiness.tsx`, `scripts/pm/app/BrowserSession.tsx`, `scripts/delivery-v2/readiness-contract.mjs`, `scripts/delivery-v2/local-auth.mjs`

**Implementation:** done
**UAT:** pending

**Evidence (2026-11-11):** Local Start checks Source, subscription Sign-in and matching Dependencies only. Coordination/model/usage are advisory. Same-origin browsers on an observed loopback socket bootstrap cookie + CSRF without a Pair form; LAN/relay still pair. The confined lane retains all eleven gates. Auth and rendered-control regressions pass; fresh-browser/mobile observation is pending because the automation kernel fails during sandbox setup. [Handover](<../../../docs/Delivery-UAT.md#local-lane--dlv-150153>).

- **Source:** [Fable 2 gate disposition](<../Fable 2/10 - Project Management/Delivery/3 - Gate Disposition.md>) (2026-11-10). Filed 2026-11-10; implemented 2026-11-11, owner UAT pending.
- **Acceptance:** Local Start blocks only on source (base known, tree clean), authentication (subscription CLI signed in, no API key) and environment (dependencies match the lockfile). Coordination, model availability and budget are shown and never block. No pairing form on a loopback origin; LAN and relay access still pair.
- **Tier:** CLAUDE_MID. Routing: [Fable 2 model tiers](<../Fable 2/Model Tiers/_Routing.md>).
- **Reading guide:** Eleven gates today in `readiness-contract.mjs:3`. The confined path keeps all eleven.

### DLV-152

**UAT instructions:** [Test steps](<../../../docs/Delivery-UAT-Agentic-OS-2026-11-14.md#dlv-152--risk-review-belongs-to-the-checked-head>)

**Outcome:** A local delivery cannot hold production keys, use a paid API key, or ship a risk-domain change without the owner's review.

**Kind:** feature
**Depends on:** DLV-150
**Touches:** `scripts/delivery-v2/`

**Implementation:** done
**UAT:** pending

**Evidence (2026-11-11):** Versioned risk classification covers money, recurrence/imports, auth/household/admin routes, migrations and rules, including removed imports. The worker starts from an environment allowlist with no production/provider keys; its worktree refuses env files and its private home contains only subscription sign-in. Flagged candidates cannot Ship until the owner opens review for that checked head and classifier version. Tests cover every domain, credential refusal and invalidated review. The UI states the residual host-access limit. Automatic approval review rejected disabling native sandboxes/enabling extra network access; the implementation retains those protections. [Handover](<../../../docs/Delivery-UAT.md#local-lane--dlv-150153>).

- **Source:** [Fable 2 Local lane design, guardrails](<../Fable 2/10 - Project Management/Delivery/2 - Local Lane Design.md>) (2026-11-10, owner direction). Filed 2026-11-10; implemented 2026-11-11, owner UAT pending.
- **Acceptance:** The agent process starts from an allowlisted environment with no `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` or provider key, and the worktree has no `.env`. A versioned path classifier flags money, recurrence, auth/RLS/household, migrations and rule files, and any route importing `supabaseAdmin`. A flagged diff cannot be shipped before the owner opens the review; an unflagged diff can. One test per domain.
- **Tier:** CLAUDE_HIGH, effort high. Routing: [Fable 2 model tiers](<../Fable 2/Model Tiers/_Routing.md>).
- **Reading guide:** Risk-domain list in the design doc. State the residual risk in the UI: without a container the scrub prevents accidents, not a determined process.

### DLV-153

**UAT instructions:** [Test steps](<../../../docs/Delivery-UAT-Agentic-OS-2026-11-14.md#dlv-153--ship-and-undo-the-approved-test-item>)

**Outcome:** The owner ships a local delivery with one action after UAT, and can undo it with one action.

**Kind:** feature
**Depends on:** DLV-150, DLV-152
**Touches:** `scripts/delivery-v2/`, `scripts/pm/app/`

**Implementation:** done
**UAT:** pending

**Evidence (2026-11-11):** Owner-authenticated Local Ship requires checks and UAT sign-off on the current clean branch head plus any required risk review. It merges with the selected item's PM receipt/swept row, refreshes the PM index and pushes. Undo reverts that merge. Temporary-repository replay exercises the Command Center's authenticated command boundary, real push/revert, stale-head/sign-off refusal and same-commit push retries; no production branch was pushed. Native workers receive a refusing pre-push hook and disabled origin push transport, retaining native sandbox protections. Owner branch protection and an actual browser Ship/Undo witness remain pending. [Handover](<../../../docs/Delivery-UAT.md#local-lane--dlv-150153>).

- **Source:** [Fable 2 Local lane design, steps 6 to 8](<../Fable 2/10 - Project Management/Delivery/2 - Local Lane Design.md>) (2026-11-10, owner direction). Filed 2026-11-10; implemented 2026-11-11, owner UAT pending.
- **Acceptance:** Ship is enabled only after a UAT sign-off on the current branch head; it merges, pushes, writes the Shipped Log entry and sweeps the checklist line. Undo reverts the merge commit. No agent session can push to `main`. One item shipped and one reverted through the Command Center.
- **Tier:** CLAUDE_HIGH. Routing: [Fable 2 model tiers](<../Fable 2/Model Tiers/_Routing.md>).
- **Reading guide:** Replaces frozen-diff Apply and the rollback journal for the Local lane only. Branch protection on `main` is an owner setting.

### DLV-154

**Outcome:** A local build and an agent session can run against data that is not production.

**Kind:** feature
**Touches:** `docs/ENV.md`, `migrations/`

- **Source:** [Fable 2 finding F2-05](<../Fable 2/01 - Architecture/Environments and Data Safety.md>) (2026-11-10). Filed 2026-11-10; not started.
- **Acceptance:** A documented way to create and reset a development database with the production schema, policies and functions and a synthetic seed; a worktree `.env` that points at it; Hard Rule 26 text names the production project so writes to the development one are allowed. Split before dispatch: design and runbook first, then seed, then wiring.
- **Tier:** CLAUDE_HIGH; several owner steps. Routing: [Fable 2 model tiers](<../Fable 2/Model Tiers/_Routing.md>).
- **Reading guide:** Options in the Local lane design: a second hosted project (recommended, no Docker), the local stack, or in-process Postgres for tests. `schema.sql` alone lacks RLS and functions; the schema must come from an owner-run dump.

### DLV-155

**Outcome:** Code that only the confined path needs is removed once the Local lane has shipped five items and the owner confirms unattended delivery is not wanted.

**Kind:** maintenance
**Depends on:** DLV-153
**Touches:** `scripts/delivery-v2/`, `scripts/delivery/`, `tests/delivery-v2/`, `tests/delivery/`

- **Source:** [Fable 2 migration and retirement](<../Fable 2/10 - Project Management/Delivery/4 - Migration and Retirement.md>) (2026-11-10). Filed 2026-11-10; not started.
- **Acceptance:** Admission gate: five items shipped through DLV-153 and an explicit owner decision on phone-started delivery. Then container boundary, qualification, checker staging, policy, authorization and allowance modules and their tests are deleted with the suite green. Coordinates with DLV-103 (V1) and R6 (older UIs).
- **Tier:** CLAUDE_MID. Routing: [Fable 2 model tiers](<../Fable 2/Model Tiers/_Routing.md>).
- **Reading guide:** Sizes at 8da80ae: V1 16,584 lines; confinement 5,203; policy and coordination 2,157.

### DLV-149

**Outcome:** The Command Center stops reporting Offline because Delivery's run polling blocks the server. *(IMPLEMENTED 2026-10-31)*
**Kind:** bug
**Execution:** cli
**Touches:** `scripts/delivery-v2/policy.mjs`, `scripts/delivery-v2/journey.mjs`, `scripts/delivery-v2/inspect-readiness.mjs`, `tests/delivery-v2/policy-read-cost.test.ts`

- **Acceptance:** Reading runs never walks the source tree; Start and readiness still see the expanded scope and resolved generated pins. After a `pnpm pm` restart, `/api/health` answers inside the 3 s probe while the bridge publishes.
- **Provenance:** 2026-10-31 owner screenshot on KIT-10. A 40-second CPU profile of the running server was 87.7% busy, about 31 s of it under `loadExecutionPolicy → materializePolicy → expandScratchInclude`, reached from `publishV2` via `journey.list`/`detail` (`policyNow` per run).
- **Reading guide:** `loadExecutionPolicy` returns the policy as written unless passed `materialize: true`. Materializing callers: `buildDeliver`, journey `deliver`, first provision, `inspectReadiness`. Integration checks use `resolveGeneratedPins`. A missed caller refuses: an unexpanded directory is "not an explicit file" and `"current"` is not a hash. Load cost on this checkout: 140 ms → 2 ms.
- **Residual:** one readiness inspection still blocks about 1 s (walk 0.2 s, hashing 3,493 files 0.8 s) per GET, every 30 s on an open launch page. Below the probe limit, not free.

### DLV-148

**Outcome:** One standing execution policy runs every item from the Command Center: Check readiness fills in a missing Touches line, the environment survives non-dependency package.json edits, and the typecheck plus the item's own tests verify a candidate without an item-specific oracle.
**Kind:** feature
**Execution:** cli
**Touches:** `scripts/delivery-v2/touches.mjs`, `scripts/delivery-v2/service.mjs`, `scripts/delivery-v2/policy.mjs`, `scripts/delivery-v2/scratch.mjs`, `scripts/delivery-v2/inspect-readiness.mjs`, `scripts/delivery-v2/dependency-environment.mjs`, `scripts/delivery-v2/journey.mjs`, `scripts/delivery-v2/candidate-tests.mjs`, `scripts/delivery-v2/stage-checker-environment.mjs`, `scripts/pm/app/readinessModel.ts`, `tests/delivery-v2/`

- **Acceptance:** Owner decision 2026-10-27 ("too much of a constraint that it is not practical"). The KIT-4 attempt needed per-item scope, an environment rebuild per item and a byte-pinned package.json; see the Pain Inventory entry. Shipped as code, with tests 1551/1551 passing in `tests/delivery-v2` + `tests/pm-ui`:
  - **Standing policy rev 13:** directory scopes (`src`, `tests`, `scripts/pm` publish; config, Feature Map, vault and PM docs readable), no item criteria or specs, required candidate tests (`requireTests`), and generated route types pinned `current`. Directories expand after authorization (only under `materialize: true` since [DLV-149](#dlv-149)), so the authorization key is unchanged and only adding a dependency rebuilds the environment. Rev 12 is preserved at `.delivery/v2/preparations/execution-policy.rev12.backup.json`.
  - **Touches:** Check readiness (and Start's internal refresh) writes a missing `**Touches:**` line. It uses the prepared plan scope, else explicit item paths, else the top Feature Map module plus `tests`. Paths are clipped to the publication scope, and a declared line or `none` is never rewritten. See `touches.mjs`.
  - **Environment:** with the same lockfile digest, a package.json whose dependency specifiers equal the lock importer's is equivalent, so scripts and metadata edits keep the environment. Item command checks bind into the receipt only when the policy has them. The install deadline is opt-in via `ERA_V2_INSTALL_DEADLINE_MS`.
  - **Verification:** `evidenceFor` no longer returns before the typecheck and candidate tests when a policy has no item criteria. A candidate with no tests fails under `requireTests`.
  - **Tradeoff (owner-accepted):** without a protected item oracle, the candidate's own tests grade behavior. Plan approval, Touches and Apply remain the owner's per-item controls.
  - **Not observed:** a live Check readiness → Start on rev 13. The running PM server still has the old code and reports the policy unavailable until `pnpm pm` restarts.

### DLV-147

**Outcome:** An unapplied verified candidate always offers Release, so the owner can free its reserved paths before another item queues behind it.
**Kind:** bug
**Execution:** cli
**Touches:** `scripts/pm/app/DeliveryV2.tsx`

- **Acceptance:** 🟠 Owner report 2026-10-27: BUD-83 (`r-83dddb67fea9`) and DLV-107 (`r-c1d69bb666cf`) hold reservations (`reservingRuns`), and KIT-4's readiness reports `scope-unknown` against both. The run page showed no Release. Cause: the button also required `coordination.holding.length`, which `holdingFor` fills only with *waiting* runs. An item that has not started yet never appears there. The button now shows whenever Apply is offered and the candidate is not released. The server `release` action already refuses anything other than a closed, unapplied `verified_candidate`. Server unchanged.

### DLV-146

**Outcome:** The delivering worker's existing implementation, repair and revision output carries the structured UAT handover, and the supervisor captures, validates and freezes it against the candidate without another model call.
**Kind:** feature
**Execution:** delivery
**Depends on:** Delivery/DLV-145
**Touches:** `scripts/delivery-v2/interaction.mjs`, `scripts/delivery-v2/journey.mjs`, `scripts/delivery-v2/store.mjs`, `scripts/delivery-v2/uat.mjs`, `tests/delivery-v2/`

- **Acceptance:** [DLV-145](#dlv-145) supplies the schema, validation, freezing and sign-off gate; this item wires them into the run. Worker instructions ask for `scenarios` in the existing output; a missing, malformed or oversized block becomes **Handover incomplete** and a verified candidate keeps its truthful green result but is not offered for owner testing. Retained output is recovered after interruption without a dispatch. A replacement candidate creates a new revision. Plan, Apply and Result authority are unchanged. Spec §4 and §9 rows *Complete delivery*, *Missing/invalid content* and *Identity and recovery* are its tests.
- **Not started:** until this ships, handovers enter through `pnpm pm:uat` (drafted documents) or the authenticated import route, never from a running worker.

### DLV-145

**UAT instructions:** [Test steps](<../../../docs/Delivery-UAT-Agentic-OS-2026-11-14.md#dlv-145--bound-results-and-sign-off>)

**Outcome:** Each delivery has one canonical, candidate-bound UAT handover; the owner's Pass / Fail / Blocked results, feedback and sign-off are append-only receipts; **Shipped** exists only after an explicit valid sign-off.
**Kind:** feature
**Execution:** delivery
**Touches:** `scripts/delivery-v2/uat.mjs`, `scripts/delivery-v2/uat-docs.mjs`, `scripts/delivery-v2/uat-cli.mjs`, `scripts/delivery-v2/entry.mjs`, `package.json`, `tests/delivery-v2/uat.test.ts`, `tests/delivery-v2/uat-docs.test.ts`
**Spec:** [Delivery UAT wizard, sign-off and feedback](<../Plans/Delivery UAT Sign-off and Feedback.md>) §2–§4, §9

- **Acceptance:** `.delivery/v2/uat/` holds append-only handover revisions, owner receipts and feedback revisions; a revision's content digest, identity envelope (run or direct reference, candidate ID/generation, Result and plan revisions, acceptance revision) and status (**draft**, **ready**, **incomplete**) come from the supervisor, never from the caller. Validation rejects empty, oversized, duplicate-ID, missing-expectation and omitted-criterion content as **Handover incomplete**. A receipt names the authenticated actor, a stable command ID (a repeat is a no-op), the handover revision, the server receipt time and an observation time that cannot be in the future; a later result supersedes without deleting. Sign-off requires a **ready**, current handover, a current PASS for every required scenario, an available build, no unresolved Needs-changes feedback (even before import) and the owner's explicit command; Apply, green checks, test-gate Proceed, Pending/FAIL/BLOCKED, a Steward credential or a stale revision never satisfy it. Retraction appends a receipt and reopens acceptance. A replacement candidate or revised content starts Pending again; earlier receipts stay readable. Draft scenarios cannot reach Shipped.
- **Reuse of drafted scenarios:** `pnpm pm:uat import-docs` extracts the numbered Action / Expected steps from the six `docs/Delivery-UAT-*-2026-10-25.md` wizards as **draft** handovers (preview by default, `--apply` writes), reporting any step lacking an expectation instead of inventing one.
- **Not claimed:** worker-emitted handovers ([DLV-146](#dlv-146)), the phone relay and Work/Sprints/Analytics labels ([R79](<../PM Tooling/PM Tooling — Master Book.md#r79>)), and any owner PASS.
- **Implementation:** done
- **UAT:** pending
- **Verification (2026-10-25):** `tests/delivery-v2/uat.test.ts` (26: validation, freeze/revision, receipts, the sign-off gate matrix, feedback, drafts), `uat-routes.test.ts` (7: anonymous, forged actor and Steward refused; actor from the session; run identity from the supervisor; direct delivery bound to an exact revision), `uat-docs.test.ts` (7, including the six real wizards: 62 handovers from 80 scenarios, 13 flagged Incomplete for steps with no expected result). All offline temp roots; no provider, Apply, Git write or production write. Isolated Chrome (own temp root and port): Test row, step navigation with resume after reload, Fail with note, Pass, Sign off to Shipped, Retract, a lost reply shown as Pending sync then retried under the same command ID with exactly one receipt. **Not exercised:** the Outcome-tab row against a real run (the isolated store had none), the phone, hosted deployment. A pre-existing clock-sensitive failure in `tests/delivery-v2/authorization.test.ts` (hard-coded 2026-10-24/25 times) is unrelated and untouched.
- **Owner steps:** restart `pnpm pm`; `pnpm pm:uat import-docs --apply` was already run on this checkout (62 drafts under `.delivery/v2/uat/`, local and gitignored; delete the folder to undo).

### DLV-144

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-Current-Attempts-2026-10-25.md#direct-144--steward-tools-usage-and-candidate-tests>) (drafted 2026-10-25; original results retained).

**Review follow-up (2026-10-24):** the four independently reported defect areas are corrected. The final single-invocation regression passed **241 tests across 13 files**, including a further R44 fixture loader correction after a reproduced 30-second plugin-loading timeout. The same real ESLint config, cases, assertions and deadlines now pass through one shared API instance; C1 remains unchanged. Actual positive/negative checker execution is witnessed. The manual support ledger is explicitly documented as accounting rather than runtime/model/scope enforcement. [Final sign-off boundary](<../../../docs/ERA-Steward-Signoff-Plan-2026-10-24.md#review-corrections-and-sign-off--2026-10-24>).

**Outcome:** ERA Steward can be accepted for routine delivery initiation and deterministic monitoring: no routine AI delegation, separately accounted support, and the candidate's own tests executed before it can be verified or applied. *(IMPLEMENTED 2026-10-24; source + offline suite, owner steps pending)*
**Kind:** feature
**Execution:** delivery
**Implementation:** done
**UAT:** pending
**Touches:** `scripts/delivery-v2/steward-surface.mjs`, `steward-tools.mjs`, `steward-mcp.mjs`, `support-ledger.mjs`, `candidate-tests.mjs`, `local-auth.mjs`, `entry.mjs`, `policy.mjs`, `journey.mjs`, `scripts/pm/planning.mjs`, `scripts/pm/app/DeliveryReview.tsx`, `DeliveryV2.tsx`, `types.ts`, `package.json`, `tests/delivery-v2/`, `tests/pm-ui/support-usage.test.ts`

- **Acceptance (Phase 1):** routine Steward control is four typed operations that wrap the existing transport and keep its command UUID, authorization, admission and duplicate protection: persist the intent before Start, recover the same receipt after an uncertain reply, never mint a second UUID. Generic Codex/Claude delegation, shell, plan approval, Apply, readiness renewal and recovery are refused at the tool and by the server for the Steward credential. A stale connection returns the last confirmed state, labelled stale, and never starts or repairs. Support is zero by default: an owner authorization (scope, model tier, effort, token allowance) admits one job; unknown usage and the job limit block more. Usage is normalized like Delivery's, a missing cost is unknown, and Delivery / Support / Chat overhead are reported apart with their coverage.
- **Acceptance (Phase 2):** under `checks.requiredVerifications.candidateTests` the pinned command runs the added/changed/planned test files against the frozen candidate in the protected checker. Missing, failing, skipped, timed-out, unreadable or extra-collected runs, a changed checker input and a runner that never started all block Candidate verified; Apply re-checks that the evidence is for this candidate under today's definition (command, checker inputs, test bytes); the integrated tree re-runs the tests before Applied. The oracle and typecheck are unchanged.
- **Acceptance (Phase 3):** one offline suite proves identity/zero model calls, no Start/repair/fallback on staleness-duplicate-failure, delegation denial plus linked and counted support, and the candidate-test gate with owner approval intact.
- **Not claimed:** a hard spend cap (DLV-114), that the external Steward chat can no longer reach another tool (it is configured outside this repo), Chat overhead measurement (owner-entered only), an unattended run, or the physical-phone result.
- **Verification:** `tests/delivery-v2/steward-closure.test.ts` (9), `steward-tools.test.ts` (41), `support-ledger.test.ts` (20), `support-cli.test.ts` (4), `candidate-tests.test.ts` (34), `tests/pm-ui/support-usage.test.ts` (3); Delivery/PM/relay aggregate 155 files / 2,819 passed / 8 existing opt-in skips; typecheck, scoped ESLint and `pm:build-app` pass. No paid or live call.
- **Owner steps:** [Delivery UAT](<../../../docs/Delivery-UAT.md#era-steward-sign-off--2026-10-24>); setup in the [runbook](<../../../docs/ERA-Steward-Runbook.md#typed-tools-support-accounting-and-candidate-tests--dlv-144>).

### DLV-143

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-Current-Attempts-2026-10-25.md#direct-143--keep-a-failed-starts-exact-result>) (drafted 2026-10-25; original results retained).

**Outcome:** One Start has a durable, reportable result, with bounded metadata collection and read-only recovery.
**Kind:** bug
**Touches:** `scripts/delivery-v2/entry.mjs`, `scripts/delivery-v2/steward-requests.mjs`, `scripts/delivery-v2/worker-boundary.mjs`, `scripts/pm/app/DeliveryV2.tsx`, `scripts/pm/app/commandIntents.ts`, `scripts/pm/app/localTransport.ts`, `scripts/pm/app/transport.ts`, `scripts/pm/app/StewardRequests.tsx`, `src/features/pm-live/relay/transport.ts`, `tests/delivery-v2/`, `tests/pm-ui/`, `tests/pm-live-relay.test.ts`

- **Reported defect:** R44 refused with generic `delivery not ready`. The retained 11:57:08–11:57:31 UTC collection shows initialize/account lookup consuming 5.14 seconds of a shared 10-second native deadline, followed by `model/list` timeout. The UI dropped the structured refusal, ordinary Start bypassed the prelaunch journal, and recovery could issue a POST. The original command UUID/response were not retained, so the cached collection is not presented as a recovered command receipt.
- **Acceptance:** Retain an authenticated receipt before readiness for ordinary and Steward Start without false attribution. Replaying one UUID never recollects or dispatches again. A lost reply has GET-only status recovery; a missing/unknown outcome cannot become a fresh launch. Preserve and show the exact refused readiness snapshot, including model timeout and request identity, across passive refresh and reload. A new explicit Start after a confirmed refusal archives the old browser receipt. Use the native probe's existing 30-second budget within the unchanged 45-second outer deadline; real timeout, cleanup, freshness, qualification and authorization failures still refuse.
- **Evidence:** Retained collection and stable local supervisor copy in `.tmp/r44-start-diagnosis-20261024/`; the old cancelled run is `r-262a6aee5ed3`. No current run was created. Upstream model-service latency is not explained by these local diagnostics.
- **Verification:** Full Delivery/PM/relay regression report: 1,385 passed, 0 failed, 8 existing opt-in skips. The initial run exposed a relay context fixture missing its store and a transform during concurrent edits; both pass on stable source. A 5-second large-manifest test exceeded its deadline under concurrent load, then passed unchanged alone and in the final aggregate. Typecheck, scoped ESLint, PM frontend build, PM lint and Feature Index pass; two final display suites pass 11 tests after completing a typed readiness fixture. Twelve isolated browser scenarios pass, including details-open overflow and status-without-POST. `pm:check-docs` still reports the same 15 pre-existing missing October 18–19 temporary recovery evidence links. No production DB write, new Start, live native probe, policy/image/environment/qualification change, bridge restart or deployment.
- **Implementation:** done
- **UAT:** pending — [owner scenarios](<../../../docs/ERA-Steward-Runbook.md#one-start-result--dlv-143>).

- **Cancellation/status follow-up 2026-10-24:** the real cancelled R44 still rendered Plan under Activity Status and reopened a saved proposal. `ActivityReview` now reuses the shared status formatter; closed attempts default to Outcome while preserving application-check and active-plan gates. Four presentation cases and a real-entry/SQLite/scripted-SDK launch → cancel → fresh-launch integration preserve identity, zero outstanding jobs, terminal projection agreement and owner plan approval. The actual `r-69bc10ef3c60` cancellation is verified; additional live validation is blocked before New delivery by automatic approval. [Acceptance report](<../../../docs/R44-Delivery-Acceptance-2026-10-24.md>) separates operational evidence, reconciled offline tests and pending owner checks.

### DLV-141

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-Current-Attempts-2026-10-25.md#direct-141--read-the-launch-screen>) (drafted 2026-10-25; original results retained).

**Outcome:** A clear mobile/desktop launch page with visible readiness request outcomes.
**Touches:** `scripts/pm/app/Delivery.tsx`, `scripts/pm/app/DeliveryV2.tsx`, `scripts/pm/app/LaunchReadiness.tsx`, `scripts/pm/app/readinessModel.ts`, `scripts/pm/app/delivery.css`, `tests/pm-ui/launch-readiness.test.ts`, `tests/pm-ui/readiness.test.ts`, `tests/pm-ui/steward-entry.test.ts`

- **Acceptance:** Show pending, completed-with-blockers, failure and unavailable states at the check control. Keep settings and full gate details behind disclosures; give New/Open/Check distinct button affordances and a full-width Start. Remove V1's progress steps only from V2. Bind refresh cache writes to the submitted selection; block competing settings/launch changes while checking. Preserve server admission, request identity, cancellation receipts and owner authority.
- **Verification:** 95 scoped tests passed (8 files, zero skipped), typecheck and changed-file ESLint passed. Real React browser fixtures covered pending, unchanged blockers, success, failure, cancelled-intent retirement and Settings at desktop/390/320 px in Blue/Pink. Live desktop asset GET contains the new card. Real readiness collection, bridge restart, production relay, policy activation, provider work and physical-phone acceptance remain separate. [Manual checks](<../../../docs/ERA-Steward-Runbook.md#launch-ui-acceptance--dlv-141>).
- **Implementation:** done
- **UAT:** pending

### DLV-140

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-Current-Attempts-2026-10-25.md#direct-140--follow-the-same-steward-request>) (drafted 2026-10-25; original results retained).

**Outcome:** Track an ERA Steward request durably before readiness or run creation, and distinguish coordinator silence from job state. *(IMPLEMENTED 2026-10-20; local source/fixtures)*
**Kind:** feature
**Execution:** delivery
**Implementation:** done
**UAT:** pending
**Touches:** `scripts/delivery-v2/steward-requests.mjs`, `scripts/delivery-v2/store.mjs`, `scripts/delivery-v2/entry.mjs`, `scripts/delivery-v2/service.mjs`, `scripts/pm/bridge.mjs`, `scripts/pm/app/StewardRequests.tsx`, `scripts/pm/app/Delivery.tsx`, `scripts/pm/app/DeliveryV2.tsx`, `scripts/pm/app/delivery.css`, `scripts/pm/app/types.ts`, `scripts/pm/app/transport.ts`, `src/features/pm-live/relay/transport.ts`, `tests/delivery-v2/steward-requests.test.ts`, `tests/pm-ui/steward-requests.test.ts`, `tests/pm-live-relay.test.ts`

- **Acceptance:** The actual Steward Start entry commits its authenticated actor and existing DLV-138 command UUID before checking readiness. Desktop and phone show attribution, request/launch identity, accepted/start/last-confirmed timestamps, stage, run link and evidenced blocker or terminal outcome. Duplicate and uncertain requests reconcile the original identity without re-launching. Each device independently derives Status unconfirmed after the documented configurable interval; this never changes job state, retries work or overwrites terminal evidence.
- **Ownership:** This bounded observability slice reuses DLV-138 launch identity, DLV-137 readiness and the current relay. DLV-133 still owns environment preparation. No orchestration, policy activation or application-data changes.
- **Provenance:** Owner voice request and explicit supervised local Codex implementation commission, 2026-10-20. Existing readiness/Chores checkout edits predate this slice and are preserved.
- **Verification and owner steps:** [implementation report](<../../../docs/ERA-Steward-Observability-Implementation.md>): 103 scoped tests passed; typecheck/scoped lint and PM app build passed. Aggregate sandbox failures and unrelated lint/documentation debt remain explicit. Actual launch, restart, physical-phone acceptance and provider work were not performed. Follow the report's five fixture/manual scenarios before owner acceptance; no automatic retry, repair or authority expansion is introduced.

### DLV-139

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-Current-Attempts-2026-10-25.md#direct-139--one-start-checks-readiness>) (drafted 2026-10-25; original results retained).

**Outcome:** ERA Steward launches an item with one Start; readiness is checked and fixed on the PM side. *(IMPLEMENTED 2026-10-20; local fixtures only)*
**Kind:** bug
**Execution:** delivery
**Implementation:** done
**UAT:** pending
**Touches:** `scripts/delivery-v2/entry.mjs`, `scripts/delivery-v2/service.mjs`, `scripts/delivery-v2/readiness.mjs`, `scripts/delivery-v2/readiness-contract.mjs`, `scripts/delivery-v2/worker-boundary.mjs`, `scripts/pm/app/DeliveryV2.tsx`, `scripts/pm/app/readinessModel.ts`, `scripts/pm/app/commandIntents.ts`, `scripts/pm/app/Work.tsx`, `scripts/pm/app/types.ts`, `scripts/pm/app/delivery.css`, `docs/ERA-Steward-Runbook.md`, `tests/delivery-v2/`, `tests/pm-ui/`

- **Problem (2026-10-19 evidence):** Start (`POST /api/delivery/v2/deliver`) accepted only live observations under 60 s old. A refresh took 44.3 s and left an 18.6 s Ready window, which Steward's Start missed. A stopped Docker surfaced as "managed dependency volume missing", blockers rendered as raw codes, and Steward did setup and diagnosis itself.
- **Acceptance:** With the passive gates (policy, selection, source, coordination, checks) satisfied, Start collects stale or missing live evidence inside its own request and admits only on a current all-gates Ready result. A still-blocked result refuses with that readiness and creates nothing; a collector exception refuses with the passive result; evidence invalidated mid-check says so. Current readiness skips collection, and an existing command id reconciles without readiness. A stopped Docker engine ends collection with "Docker is not running". The launch screen shows every gate and one short owner fix per problem, enables Start on passive gates alone and waits up to 180 s. One permitted executor is preselected, and `#/deliver/<ID>` resolves a unique ID.
- **Limits:** The 60 s observation and 30 s projection limits, dispatch-time re-observation, qualification, plan approval and Apply are unchanged. Start can take 1–2 minutes because it runs the live checks. Intermittent native-model failures (cause unknown since 2026-10-19) still refuse, now worded "Model check failed — retry". Automatic persistent readiness reports (DLV-137) remain unimplemented.
- **Verification:** `tests/delivery-v2/pilot-entry.test.ts` (collect, refuse, collector crash, files moved, current skip), `worker-boundary.test.ts` (Docker stopped, stage order), `tests/pm-ui/readiness.test.ts` (rows, fixes, Start gating), `work-lifecycle.test.ts` (ID-only link). Owner UAT: restart `pnpm pm --bridge`, then follow the [runbook](<../../../docs/ERA-Steward-Runbook.md>) owner and Steward steps.

### DLV-137

- **Owner requirement added 2026-10-19 (October 18 voice call):** the [pre-launch checklist/report contract](<../Plans/Delivery V2.md#pre-launch-readiness-report--2026-10-19>) is part of this item's readiness acceptance. Every failed/stale/unknown check must explain expected versus observed state, dated evidence/binding/expiry or collection failure, operational impact and a concrete next action; unknown cause stays unknown. Generic stale/not-ready alone does not satisfy it. The process/template is recorded; automatic persistent reporting remains unimplemented. Preserve DLV-133's environment ownership and DLV-118's independent scope.

- **2026-10-18 recovery validation:** CLI `--service` consumes the existing passive service projection for the same exact selection, without credential reads or hidden preparation. Explicit Codex observations now include native model/effort advertising, pinned native version, included-only subscription provenance and confirmed child/container cleanup; missing, stale, mismatched or negative evidence blocks both shared readiness and last-moment dispatch. Account entitlement remains explicitly unverified. The actual pinned `0.144.1` runtime did not advertise `gpt-6-luna` / `low` in its complete hidden-inclusive catalog, so the pilot remains blocked without a substitution. Qualification now refuses publication when either worker or checker required controls/negative control fail. Final affected recovery regression: **1,228 passed / 8 opt-in operational tests skipped**, typecheck and 54-file scoped lint passed; 236 recorded inputs stayed unchanged. Original sandbox/fixture failures remain in `continuation/pre-freeze-*`; the corrected fixture stores retained check artifacts inside its owned temporary root. Evidence ledger remains under DLV-133.

**Outcome:** Prepare Delivery runs with one deterministic readiness result.
**Kind:** improvement
**Execution:** delivery
**Depends on:** DLV-133
**Touches:** `scripts/delivery-v2/`, `scripts/pm/app/DeliveryV2.tsx`, `scripts/pm/app/transport.ts`, `scripts/pm/app/localTransport.ts`, `scripts/pm/app/readinessModel.ts`, `scripts/pm/app/state.tsx`, `scripts/pm/app/types.ts`, `package.json`, `tests/delivery-v2/`, `tests/pm-ui/`

- **Owner decision (2026-10-17):** Stages 1–2 approved for supervised local Codex development, not the PM dispatch pipeline. DLV-133 solely owns Stage 1's dependency environment corrections and container witness; this item consumes that prerequisite and does not duplicate its acceptance. DLV-118 retains its independent context/measurement scope.
- **Acceptance:** One read-only command and the existing launch surface share deterministic readiness facts and consolidated blockers for the exact selection, policy, source, verified environment, qualification and checks. Missing/stale/unknown evidence cannot become ready; reads create no resources or provider jobs. Preparation is explicit and remains bound to current authority. Exact plan approval and protected Apply remain separate.
- **Reading guide:** Reuse `service.mjs#createDeliveryV2Context`, `journey.mjs#assess` / `preDispatch`, `task-input.mjs`, `worker-boundary.mjs`, existing qualification and `scripts/pm/app/DeliveryV2.tsx`. Start Stage 2 only after DLV-133's Stage 1 report distinguishes implemented, fixture-verified and operational evidence.
- **Execution sequence:** Stage 1 is tracked only in DLV-133. Stage 2 adds the shared readiness evaluator/CLI and existing UI projection (approved; Medium effort). Automatic isolated preparation, enumerated bounded recovery and a new separately authorized R44 end-to-end proof are later stages and remain unapproved for implementation. No new orchestrator, package-specific repair, provider fallback or hard-cap claim.
- **Verification:** Existing Delivery/PM UI harnesses; read-only/no-provider behavior, all-blocker aggregation, stale/corrupt input refusal and consistent UI/CLI/admission facts. Future cold/warm/failure measurement includes preparation and failed attempts; unknown usage stays unknown. Target warm preparation p95 <=30 s over ten identical inputs is a proposed acceptance target, not an observed result.
- **Owner gates:** First preparation/recovery envelope requires explicit approval; ordinary staged delivery still requires launch/settings/limits and exact plan approval, with Apply separate. Out-of-envelope failures stop. R44 and its paused volumes, snapshot, evidence, policy and runtime state remain untouched.
- **Current approved recovery scope (2026-10-17):** Restore the existing desktop/mobile launch path, complete DLV-133 environment/compiler integration, and implement durable command recovery under DLV-138 through supervised local development. This supersedes the earlier stages 1–2 statement above, but does not approve the old automatic-preparation/recovery stages. Installed policy, bridge process, provider jobs and Apply remain untouched.
- **Recovery implementation:** Authenticated existing `control` action `refresh-readiness` explicitly observes managed dependency content, runtime binding and subscription authentication, then recomputes all passive inputs. Observations bind exact selection/policy/source/checks/coordination, expire within 60 seconds, and positive projections within 30 seconds. The service uses its own SQLite query facade, including WAL and same-connection changes. The bridge publishes selection-bound readiness in capabilities; desktop and phone share session/approval/command contracts. The launch button and server entry require readiness; existing commands reconcile first. GET, CLI and relay publication never probe or prepare. No automatic provisioning or package repair.
- **Recovery evidence boundary:** Deterministic Delivery/PM/relay fixtures pass; final logs are in `.tmp/delivery-recovery-20261017/`. The running bridge still has earlier loaded source. Managed environment, fresh qualification, real mobile acceptance and coordinated restart are pending. Standalone CLI cannot certify a live WAL-backed service or invent observations; use the explicit service action. Historical Stage 2 limitations below describe the earlier snapshot and are superseded where covered here.
- **Current state (2026-10-17, Stage 2 local source):** `readiness.mjs` projects the existing admission/coordination refusals and the consolidated launch facts; the browser-safe contract carries the same vocabulary. `inspect-readiness.mjs` reuses selection/settings, coordination, allowances, protected-check and qualification validators. `pnpm pm:ready` and GET `/api/delivery/v2/readiness` use this adapter directly, never the service’s lazy runtime/journey getters. The existing launch view/transport consumes its result and displays all blockers; missing transport support is explicitly unavailable. Executor catalogue inspection is passive by default. No effectful preparation, repair or new orchestrator is introduced.
- **Read-only boundary:** an already-open service store exposes a fixed query-method facade with no mutation/transaction authority and a data-version check; inspection never opens it through the writable getter. Standalone immutable SQLite inspection runs only with the current schema and no WAL/shared-memory files; otherwise store-dependent checks are unavailable. It never creates/migrates/checkpoints a store. File digests detect movement during an immutable read. Missing stores remain absent. No credential, SDK job, provider readiness request, Docker operation or maintenance is invoked by inspection. A receipt alone cannot prove current runtime/auth/content facts: trusted explicit observations must match the exact context and be at most 60 seconds old; a positive UI projection expires after 30 seconds. There is currently no automatic producer/cache of those live observations. Preparing that evidence remains outside Stage 2 and requires the separately approved preparation boundary.
- **Evidence semantics:** source/acceptance and exact snapshot/check/program bytes, policy/selection, holds/prerequisites, available store coordination, budget configuration and dependent unknowns are separate facts. Managed receipt identity, manifest/lock and pinned command-oracle inputs must match; host/prefer-checker or disabled/advisory compiler verification cannot certify readiness. Admission retains its existing authoritative checks and rechecks; an inspection fingerprint is never a grant, plan approval or Apply authority.
- **Verification (2026-10-17):** Delivery V2 + PM UI regression suite: **1,052 passed, 8 skipped** (77 passed / 3 skipped files); all Docker witnesses remain disabled. Typecheck and scoped ESLint pass. Fixtures cover CLI/HTTP/service parity, UI selection/expiry, model/policy/authority/budget combinations, managed receipt/manifest/oracle mismatches, protected check gaps, preserved prerequisite blockers and immutable/WAL/no-write behavior. Logs and the final actual inspection/preservation receipt live in `.tmp/dlv-137-stage2/`. The final focused pass has 19 passing cases, including backend-specific subscription proof, source-byte fingerprints while blocked, mixed known/unknown blocker classification and the existing-store query facade. The real environment is **not operationally verified**; DLV-133 remains open and owns that acceptance. DLV-118 is unchanged. No server, preparation, provider job, policy activation or R44 resumption occurred. Stages 3–5 are not started.
- **Read-only command:** `pnpm --silent pm:ready --file "Delivery/4 - Checklist.md" --id DLV-137 --executor codex --model gpt-6.1-sol --effort medium --profile focused`. Exit 0 means inspection-ready, 1 means blocked/unknown, 2 means usage/inspection error. The CLI emits JSON and writes no receipt by default; callers may explicitly retain stdout. This never launches, prepares, repairs or applies. *(The CLI takes literal selectors and has no alias resolution: `gpt-6.1-sol` is `CODEX_MID` and `medium` is the explicit effort; see the [Model Registry](<../../Model-Registry.md>).)*
- **Actual passive result (2026-10-17):** `DLV-137`, Codex / `gpt-6.1-sol` / Medium / Focused → **blocked** (exit 1). Known blockers: HELD and open DLV-133, publication scope outside installed revision 7, no configured managed environment, and protected checker checks not prepared. Runtime is unprobed; auth/qualification are dependent unavailable. WAL/shared-memory files are present; full coordination and usage therefore remain unavailable without a checkpoint (no process liveness is inferred); the independently readable hold/dependency blockers are retained. `.tmp/dlv-137-stage2/readiness.actual.json` and `inspection-audit.json` retain the exact projection and fingerprint. Before/after hashes prove unchanged installed policy and supervisor DB/WAL/SHM bytes across inspection; all nine Stage 1 source/test hashes still match. No activation or repair was attempted.
- **Remaining evidence/limits:** default CLI and launch reads do not fabricate runtime/authentication/qualification evidence. The relay transport does not yet publish this readiness projection and therefore shows unavailable. Headless static launch fixtures built, but the local renderer returned no screenshot/DOM output; a real mobile visual pass is unconfirmed. Any Stage 3 proposal must review an explicit preparation/evidence envelope and these limits first; this source update is not authorization to begin it.

- **Queue note, moved from the checklist 2026-11-11.** **DLV-137 — 2026-10-17 recovery source/fixtures:** Explicit service observations now feed desktop/mobile readiness and server admission. Passive reads stay effect-free. DLV-133 operational evidence, coordinated restart and phone acceptance remain pending. Durable command recovery is DLV-138.

### DLV-133

- **2026-10-18 bounded recovery continuation:** Owner authorized completion of the existing recovery, preserving the reviewed resource/security envelope, with at most three full preparation attempts in total and no unchanged retry. The durable ledger is `.tmp/delivery-recovery-20261018/continuation/progress.json`; it conservatively counts the October 17 interrupted attempt and October 18 incomplete install as two consumed attempts. `checker-package-diagnostic.mjs` and the existing setup CLI now provide exact lockfile/SRI leaf diagnostics through the same confined installer, with NDJSON, filesystem capacity and payload evidence, never a reusable receipt. The exact two-package diagnostic downloaded, integrity-checked, imported and linked both payloads. The lockfile selects both Linux x64 entries without a libc selector; the downloaded Claude musl manifest does declare musl, but no omission is waived. An offline byte-for-byte storage witness reproduced `ENOSPC` on the required Codex binary: deduplicated installed package content exceeds the existing 2 GiB tmpfs. The reusable installer now uses a separate owned disk volume for its pnpm store, preserving the 2 GiB temporary storage, resource/deadline limits, exact pins and disabled scripts. Store cleanup must be confirmed before receipt publication; failed stores remain evidence. The environment identity binds this store strategy and required offline Codex/Claude native execution. Pinned-image native preflight passed; managed cold/warm acceptance remains pending. CLI service parity and ignored-oracle-fixture corrections are tracked under the same recovery; no R44 implementation is made outside its PM session. DLV-133/137 remain open, and DLV-118 stays independent.
- **2026-10-17 KIT-11 acceptance investigation:** The new scalar-only full-program witness fixture explicitly selects the ES5 standard library instead of repeatedly parsing the unrelated default DOM library. All four real compiler invocations, their original success/refusal assertions and the single test's default deadline remain unchanged; real recipe compiler inputs are unaffected. Initial full acceptance failures and complete unchanged-source recaptures are preserved at `.tmp/kit11-acceptance-repair-20261017/`: the 20 lint errors belong to an October 3 generated Chores QA bundle; journey output retention is denied in its pre-existing default AppData artifact directory; esbuild cannot read required directories under the inspection sandbox. The initial CLI timeout and additional recapture parallel-fixture timeouts are recorded separately. These are not KIT-11 count failures or passing owner acceptance. No installed state, owner gate or running bridge is changed by this test-only correction; operational prerequisites remain closed.
- **2026-10-17 recovery integration:** `compiler-input.mjs` freezes one complete declared compiler closure before dispatch, including root TS files, imported JavaScript trees, manifests, generated-type SHA256 pins and delivery snapshot inputs. Run settings retain manifest/fingerprint across restarts; provision and ordinary checking use that root. Missing, modified, linked or undeclared generated inputs refuse. Integrated Apply checks use a separate current-source compiler closure, preserving relevant conflicts without rewriting original identity. The existing reusable environment tool supplies verified receipts to readiness. No R44-specific installer or package-repair path. Compiler volumes verify their manifest digest and every file before each phase; a name alone is insufficient. `probes/compiler-program.mjs` supplies reusable full-program positive/negative environment witnesses.
- **Operational status:** Source/fixtures only. `.tmp/delivery-recovery-20261017/operational/` contains the frozen recipe, proposed policy diff and bounded pilot request. Revision 7 and old volumes are unchanged. Managed cold/warm witness and fresh boundary qualification precede activation and one separately approved R44 run. Its protected oracle is preparation evidence, not R44 implementation.

**Outcome:** Run the deterministic typecheck inside the protected checker instead of on the host.
**Kind:** improvement
**Execution:** delivery
**Touches:** `scripts/delivery-v2/worker-boundary.mjs`, `scripts/delivery-v2/typecheck.mjs`, `scripts/delivery-v2/typecheck-runner.mjs`, `scripts/delivery-v2/setup-checker-deps.mjs`, `scripts/delivery-v2/policy.mjs`, `scripts/delivery-v2/journey.mjs`

- **2026-10-17 Stage 1 source update (supervised local development):** `setup-checker-deps.mjs` now refuses legacy host copying and requires a frozen explicit recipe plus its reviewed content key. `stage-checker-environment.mjs` stages new uniquely named volumes using the pinned Linux image and pnpm tool, a frozen lockfile, disabled lifecycle/pnpmfile scripts, and registry-only egress. Existing dependency volumes and installed policy are never replaced. Full lstat/content/link inventory refuses missing, escaping, cyclic or undecodable targets; no optional-package exceptions are inferred. Offline non-root ownership/write/delete readback precedes network. Compiler semantic negative/control, actual native esbuild execution and positive-count pinned command oracles run against the same staged dependencies with no network. Host cache publication follows confirmed cleanup; a failed staging volume is retained with its evidence.
- **Identity and reuse:** the environment key binds manifest/lock, immutable image, platform/toolchain, complete pnpm tool digest and oracle inputs. Receipts bind full content and probe evidence. Warm reuse freshly verifies actual read-only contents and refuses stale/corrupt/missing evidence without rebuilding. Optional managed metadata enters the existing boundary/qualification digest; runtime verifies it before provision/checks and before each compiler phase. Legacy volume-only policy remains unchanged. The compiler producer records the managed identity when present.
- **2026-10-17 verification:** `pnpm exec vitest run tests/delivery-v2 --maxWorkers=2`: **764 passed, 8 skipped** (43 passed / 3 skipped files; all Docker witnesses disabled). `pnpm typecheck`, scoped ESLint (zero warnings), `pm:lint`, `pm:check-docs` and `docs:check` pass. Logs: `.tmp/dlv-133-stage1/delivery-suite-final.log`, `typecheck-final.log`, `eslint-final.log`, `pm-lint.log`, `pm-check-docs.log`, `docs-check.log`. The default sandbox blocked Vitest before collection with a temporary-file rename EPERM; the authorized local fixture rerun outside that sandbox passed. No live Docker/provider tests ran.
- **Evidence boundary:** The opt-in `dependency-environment.docker.test.ts` covers cold preparation, compiler/native/oracle facts and warm reuse, but has **not run**. A real full-program candidate negative/control witness, fresh qualification and owner-reviewed reversible activation remain outstanding. DLV-133 stays open; no operational environment, policy activation, R44 resumption or provider job is claimed. DLV-137 consumes this prerequisite; DLV-118 is independent.

**Stage 1 preparation runbook (not execution authority):** A concrete JSON recipe needs `root` (frozen package.json/lockfile), immutable Linux x64 glibc `image`, exact Node 22 `nodeVersion`, pnpm 10 `pnpmVersion`, `pnpm: {root, digest}` (whole tool digest from `pinnedToolDigest`), exact `packages` versions including typescript/esbuild/vitest/eslint, `program: {root, files}` (explicit relative-path to SHA256 map including matching manifests and all oracle inputs), nonempty `oracles: [{id, argv, assertions, inputs}]`, a `receipts` cache directory and a fresh per-attempt `evidence` directory. Workspace/patch/pnpm-hook projects are deliberately refused. Dangling optional-platform links are still blockers; support is not inferred from a successful install.

Read-only preview: `node scripts/delivery-v2/setup-checker-deps.mjs --recipe <reviewed.json> --plan`. Only after separate approval of that exact recipe/key and effects: `node scripts/delivery-v2/setup-checker-deps.mjs --recipe <reviewed.json> --prepare --expected-key <sha256:key>`. Preparation uses new owned volumes, a transient registry proxy and bounded install, retains raw numbered command/inventory/outcome receipts, never installs policy, and never dispatches. Ordinary tests keep `ERA_V2_DOCKER=0` and `ERA_V2_ENVIRONMENT_WITNESS=0`; the new witness additionally requires the owner-supplied recipe path and exact key. Do not run the historical bare setup or old Docker witness command as an activation shortcut.

- **2026-09-20 state:** implemented and demonstrated with a real compiler over a pinned staged program (`tests/delivery-v2/typecheck-isolation.test.ts` — deliberate `supabaseAdmin.from` failure, passing control, and a case proving the verdict comes from the pinned program rather than the working tree it was staged from; `tests/delivery-v2/worker-typecheck.test.ts` — argv, mounts, volume addressing and refusals). **Not yet witnessed inside a container**, and not yet enforceable: the dependency volume has no `typescript` until the owner runs `setup-checker-deps.mjs`, and `isolation` is still the default `prefer-checker`. **Named limitation of the pinned program:** `DEFAULT_PROGRAM` compiles `tsconfig.json`, `next-env.d.ts`, `src`, `tests`, `scripts` and `types` rather than this repo's `**/*.ts`, which would drag `build/`, `.tmp/` and `graphify-out/` — about 30 MB of scratch — into a volume. Both phases compile the identical program, so this cannot manufacture a pass out of a broken baseline; it can only fail to look outside those roots. Widen `checks.requiredVerifications.typecheck.program.roots` to change it.

- **Acceptance:** The typecheck compiles the candidate against a complete program inside the checker container — a dependency volume carrying `typescript` and the source closure — with the same inconclusive-not-pass rules, and the host path is removed or kept only as an explicit fallback that labels itself. A verification's environment record says which one produced it.
- **Provenance:** DLV-131 shipped 2026-09-20 on the host because `era-dlv107-dependencies` holds 41 packages (vitest, React) and no `typescript`, and the candidate volume is a 29-file snapshot rather than a program. See [Token Consumption Fixes §3/§7](<../_Archive/Studies/Delivery Consumption (2026-09)/Delivery — Token Consumption Fixes.md>).
- **Reading guide (2026-10-17):** Start with the Stage 1 update/runbook above and `dependency-environment.mjs`, `stage-checker-environment.mjs`, `worker/dependency-inventory.mjs`, then `setup-checker-deps.mjs` and the environment/worker-typecheck fixtures. The September destructive-copy diagnosis below is historical; the replacement refuses that path. Use `typecheck.mjs`/`typecheck-runner.mjs` for the still-required full-program container witness. No installed environment is recertified by the source change.

**Execution plan — 2026-09-26**

**Readiness:** Split first; repair provisioning before switching the installed checker.

**Verify:** Run existing typecheck-isolation/worker-typecheck fixtures, then the opt-in typecheck.docker cases after isolated setup. Prove failing candidate, passing control, missing compiler and the existing esbuild oracle in the same staged dependency environment.

```delivery-plan-v1
{
  "outcome": "Make protected compiler verification usable without destroying runnable oracle dependencies.",
  "acceptance": [
    "Protected verification names the environment and exact pinned program.",
    "A compiler upgrade cannot break the existing behavioral oracle."
  ],
  "scope": [
    "scripts/delivery-v2/setup-checker-deps.mjs",
    "scripts/delivery-v2/worker-boundary.mjs",
    "scripts/delivery-v2/typecheck.mjs",
    "scripts/delivery-v2/typecheck-runner.mjs",
    "scripts/delivery-v2/policy.mjs",
    "tests/delivery-v2/"
  ],
  "steps": [
    "Revalidate the implemented checker path and record the required compiler, framework closure and command-oracle dependencies; the current provisioner omits esbuild.",
    "Design and test a new named staging volume with target-platform dependencies; never replace the installed volume before both compiler and oracle probes pass.",
    "Verify the full selected program and candidate overlay inside the isolated checker, preserving inconclusive environment failures and producer labels.",
    "Hand the owner a reviewed volume/policy switch with rollback and fresh qualification steps; record installed state only after actual evidence."
  ],
  "invariants": [
    "Requested checker isolation never silently passes a host verdict.",
    "Missing packages produce inconclusive rather than candidate failure/pass."
  ],
  "exclusions": [
    "Running the current destructive setup script or changing installed policy during planning."
  ],
  "checks": [],
  "risks": [
    "Host-copying Windows packages can omit Linux binaries; current setup removes the target volume first."
  ],
  "unknowns": [
    "Current installed image/volume and complete program dependency closure."
  ],
  "dependencies": [],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. setup-checker-deps.mjs list, host-copy and volume-rm sequence inspected; local container deployment not re-certified."
}
```

- **Queue note, moved from the checklist 2026-11-11.** **DLV-133 — 2026-10-17 Stage 1 source update; operational witness pending.** Separate target-platform staging, full inventory, cold/warm receipts and managed identity binding are implemented locally. The legacy bare setup now refuses. Use the Master Book’s recipe/runbook; no Docker preparation, installed policy/volume switch or provider execution occurred. Real same-environment/full-program container evidence and owner activation remain open. DLV-137 depends on this item; DLV-118 remains independent.

### DLV-134

**Outcome:** Normalize historical usage readings recorded before the cumulative-counter fix.
**Kind:** bug
**Execution:** delivery
**Touches:** `scripts/delivery-v2/usage-normalization.mjs`, `scripts/delivery-v2/store.mjs`, `scripts/delivery-v2/jobs.mjs`, `scripts/pm/app/deliveryReviewModel.ts`, `tests/delivery-v2/`

- **Acceptance:** readings written before DLV-119's normalization carry a normalization record under the current version, so every consumer reads one interpretation. Raw receipts are preserved and no historical Result is silently rewritten.
- **Reading guide:** `usage-normalization.mjs` is the rule set: a legacy row is one where `usage_readings.normalization_json IS NULL` (`parseNormalization()`), counted as `normalizationHealth().legacyRows`. Schema and migration list: `store.mjs` — the `usage_readings` table (`raw_*` columns, `counter_semantics`, `normalization_json`, `PRIMARY KEY (job_id, reading_key)`) and its `recordUsageReading`/`listUsageReadings`/`countUsageReadings` accessors. Consumers to keep consistent: `jobs.mjs normalizedTokenTotal()`/`resourceSummary()` and `deliveryReviewModel.ts normalizationNote()`/`tokenSplit()`. Bump `USAGE_NORMALIZATION_VERSION` if the derivation changes; a backfill must add a versioned record, not overwrite a reading. Tests: `tests/delivery-v2/usage-normalization.test.ts`, `store.test.ts`, `tests/pm-ui/delivery-review.test.ts`.
- **Provenance:** 2026-09-20 split from DLV-119's shipped normalization; the backfill of pre-fix rows was never done.

### DLV-122
**Outcome:** Let the owner cancel a waiting run.
**Kind:** bug
**Execution:** delivery
**Touches:** `scripts/delivery-v2/`, `scripts/pm/app/`, `tests/delivery-v2/`, `tests/pm-ui/`

- **Acceptance:** The owner can cancel a waiting run from its page with no provider dispatch, and cancelling releases its reservation. *(Visibility and lifetime-vs-period window delivered by DLV-124 on 2026-09-19; the run page still offers no Cancel — the 2026-09-19 DLV-90 run was stopped through the control route.)*
- **Progress 2026-09-20:** no new backend verb was needed — `control` `stop` on a queued run already closes it `cancelled` with no job and no dispatch. Added a one-word **Cancel** on the run page's Waiting panel (`DeliveryV2.tsx`, `coordination.state === "queued"`), previously reachable only via Activity → Stop delivery. `tests/delivery-v2/parallel.test.ts` (DLV-122 case): queued run stopped → CLOSED/cancelled, zero jobs, coordination cleared; same `command_id` replayed → ok, no change; a fresh stop → `run-closed`; freeing the slot afterward never admits or dispatches it (no BUD-15 provider call). `tests/delivery-v2` + `tests/pm-ui` 896 passed, 7 skipped. **Open:** not exercised in a browser; no reservation-holding (scope-conflict) waiting run tested; scope-conflict runs get no Cancel button (Activity Stop still applies); real UAT pending.
- **Provenance:** 2026-09-19 owner UAT walkthrough (U1–U7); DLV-90 run `r-8e7f635c1466` stuck in Waiting.
- **Reading guide:** Current handoff (2026-09-26): `scripts/pm/app/DeliveryV2.tsx` offers Cancel only when `coordination.state === "queued"`; `journey.mjs` also recognizes `scope-conflict` as waiting. Reuse `control("stop")`, queue cleanup and command replay; exercise a scope-conflict reservation in `tests/delivery-v2/parallel.test.ts` before widening the button condition. DLV-124 already owns allowance windows and labels. No new cancel backend verb or fleet accounting rewrite belongs here.

**Execution plan — 2026-09-26**

**Readiness:** Implementation draft; close the scope-conflict gap.

**Verify:** `pnpm exec vitest run tests/delivery-v2/parallel.test.ts tests/pm-ui/coordination-model.test.ts`; extend with scope-conflict cancel/replay and no later dispatch; 390px fake-runtime UI check.

```delivery-plan-v1
{
  "outcome": "Let every cancellable waiting run release its claim without dispatching.",
  "acceptance": [
    "Both waiting states have a working Cancel action.",
    "Cancellation clears the applicable reservation and creates no provider job."
  ],
  "scope": [
    "scripts/pm/app/DeliveryV2.tsx",
    "scripts/delivery-v2/journey.mjs",
    "tests/delivery-v2/parallel.test.ts",
    "tests/pm-ui/"
  ],
  "steps": [
    "Reproduce a queued run and a reservation-holding scope-conflict run with the synthetic harness.",
    "Expose the existing stop action for both valid waiting states; preserve command identity and the normal control boundary.",
    "Change journey cleanup only if the new fixture proves a reservation leak; do not invent a cancel backend verb.",
    "Verify repeat cancellation, closed state and freeing capacity afterward cannot dispatch the cancelled work."
  ],
  "invariants": [
    "An uncertain active job retains its slot until stop is observed.",
    "Repeated command delivery is idempotent."
  ],
  "exclusions": [
    "Fleet window redesign or changing DLV-124 allowance behavior."
  ],
  "checks": [],
  "risks": [
    "Scope-conflict waiting differs from a never-dispatched queued run."
  ],
  "unknowns": [],
  "dependencies": [],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. DeliveryV2.tsx currently limits Cancel to queued; journey WAITING_REASONS includes queued and scope-conflict."
}
```

- **Queue note, moved from the checklist 2026-11-11.** **DLV-109 / DLV-122 — implemented 2026-09-20, fixture-tested.** Live activity is observed during the KIT-11 runs; the waiting-run Cancel is exercised if either arm waits. Both are swept once seen on a real run.

### DLV-121

**Outcome:** Page frozen diffs and older candidate artifacts.
**Kind:** feature
**Execution:** delivery
**Touches:** `scripts/delivery-v2/`, `scripts/pm/app/`, `tests/delivery-v2/`, `tests/pm-ui/`

- **Acceptance:** Expose hash-bound paged reads for older candidate generations and previews beyond the existing file/text budget. Keep every page tied to candidate/base identity; label binary/unavailable bytes, refuse unsafe paths, and preserve the working plan reader and current-candidate preview from DLV-116.
- **Provenance:** 2026-09-15 split of incomplete engineering from already implemented review scope. Owner acceptance remains in the UAT.
- **Reading guide:** `review.mjs candidateReview()` is the entire current reader and holds every bound to be paged — `index >= 20`, `remaining = 64 * 1024`, `MAX_FILE_BYTES` (128 KiB) — plus `readBytes()`'s hash gate and `resolveInside()` path safety. It reads only the *current* candidate plus hash-matching Apply-journal bytes, which is why older generations are unavailable. Identity and manifests: `candidate.mjs` (`freezeCandidate`, `candidateChangedPaths`, `candidateFreshness`). Bounded artifact storage already exists: `store.mjs publishArtifact()`/`readArtifact()`. Exposure runs `journey.mjs detail()` → `entry.mjs routeDeliveryV2()`; render is `DeliveryReview.tsx ChangesReview()`/`ChangedFile()` over `V2ChangedFile` in `types.ts`. Keep the DLV-116 labels (`preview-limit`, `base-unavailable`, `binary`, `too-large`, `unsafe-path`). Tests: `tests/delivery-v2/review.test.ts`, `apply.test.ts`, `tests/pm-ui/delivery-review.test.ts`.

**Execution plan — 2026-09-26**

**Readiness:** Implementation draft; first freeze paged artifact identity.

**Verify:** Extend tests/delivery-v2/review.test.ts, apply.test.ts and tests/pm-ui/delivery-review.test.ts: >20 files, >64KiB total, older generation, tampered bytes, binary, traversal, stale cursor and interrupted page loading.

```delivery-plan-v1
{
  "outcome": "Read large and older frozen candidate diffs in bounded hash-verified pages.",
  "acceptance": [
    "Every page names its exact candidate/base generation.",
    "Unsafe or mismatched bytes never render as a trusted diff."
  ],
  "scope": [
    "scripts/delivery-v2/review.mjs",
    "scripts/delivery-v2/journey.mjs",
    "scripts/delivery-v2/entry.mjs",
    "scripts/delivery-v2/store.mjs",
    "scripts/pm/app/DeliveryReview.tsx",
    "scripts/pm/app/types.ts",
    "tests/delivery-v2/",
    "tests/pm-ui/"
  ],
  "steps": [
    "Trace candidateReview and immutable generation/base manifests; define cursors bound to both identities and the chosen file/page, never a current-checkout offset.",
    "Add bounded page reads that verify referenced bytes and retain binary, unavailable and unsafe-path outcomes.",
    "Expose older generation selection and incremental preview using the existing review/transport surface; coordinate paging vocabulary with R55.",
    "Test stale/tampered pages and page retries without changing the working plan reader or Apply verification."
  ],
  "invariants": [
    "Reads remain bounded and cannot execute candidate code.",
    "C1 remains readable after C2."
  ],
  "exclusions": [
    "Removing preview limits globally or using live source as an unverified historical base."
  ],
  "checks": [],
  "risks": [
    "A cursor bound only to run ID can mix candidate generations."
  ],
  "unknowns": [],
  "dependencies": [
    "Coordinate presentation paging with R55."
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. review.mjs currently caps 20 entries, 64KiB total and 128KiB per file; current reader identity gates inspected."
}
```

### DLV-119

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-PM-Review-2026-10-25.md#pm-m4--count-tokens-once>) (2026-10-25 draft; actual result Pending; earlier evidence retained).

**Implementation:** done
**UAT:** pending

**2026-09-15 reconciliation:** Provider-aware token normalization shared by admission, settlement, UI and metrics; raw historical readings retained; owner UAT pending. Implementation and owner acceptance are now tracked separately; the older acceptance-held wording below is historical.

**Outcome:** Count provider tokens once across limits and displays.

**Kind:** bug
**Touches:** `scripts/delivery-v2/jobs.mjs`, `scripts/delivery-v2/adapters/`, `scripts/delivery-v2/store.mjs`, `scripts/delivery-v2/journey.mjs`, `scripts/pm/app/v2model.ts`, `scripts/pm/app/types.ts`, `scripts/pm/shared/metrics.mjs`, `tests/delivery-v2/`, `tests/pm-ui/`

- **Evidence:** `jobs.mjs:203` and `v2model.ts:81` add cached/reasoning subsets to raw input/output counters. Actual run readings and interpretation are in [hotfix packet A](<../_Archive/Plans/Delivery First-Run Hotfix (2026-09-14).md>).
- **Acceptance:** one provider-aware versioned normalization feeds run/fleet admission, UI and metrics; preserve raw receipts, unknowns and source semantics. This run's input-plus-output interpretation is 284,243, with historical 482,416 still inspectable. Tests prove pinned Codex semantics, Claude cache-creation differences, cumulative resets, duplicate replay and consumer consistency. No historical Result is silently rewritten.

### DLV-115

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-PM-Review-2026-10-25.md#pm-m6--review-apply-and-safely-test-rollback>) (2026-10-25 draft; actual result Pending; earlier evidence retained).

**Implementation:** done
**UAT:** pending

**2026-09-15 reconciliation:** Rollback preview, confirmation, revision guard and exact inverse receipts implemented; owner UAT pending. Implementation and owner acceptance are now tracked separately; the older acceptance-held wording below is historical.

**Outcome:** Confirm rollback and report its exact inverse.

**Kind:** bug
**Touches:** `scripts/delivery-v2/apply.mjs`, `scripts/delivery-v2/journey.mjs`, `scripts/delivery-v2/entry.mjs`, `scripts/delivery-v2/store.mjs`, `scripts/pm/app/DeliveryV2.tsx`, `scripts/pm/app/v2model.ts`, `scripts/pm/app/types.ts`, `scripts/pm/app/transport.ts`, `scripts/pm/app/localTransport.ts`, `scripts/pm/relay.mjs`, `src/features/pm-live/relay/`, `tests/delivery-v2/apply.test.ts`, `tests/pm-ui/`

- **Evidence:** direct rollback click in `DeliveryV2.tsx:760`; this trial restored a pre-existing file correctly. [Hotfix packet C](<../_Archive/Plans/Delivery First-Run Hotfix (2026-09-14).md>).
- **Acceptance:** read-only preview and explicit Cancel/Roll back dialog; server binds confirmation to application/revision/digest and rechecks confined paths. True additions are removed, deletions recreated, existing untracked files restored, later owner edits preserved. Partial/failed inverse is visible. Cancel has no effect; stale/double/reconnected commands cannot repeat or expand the inverse.

### DLV-116

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-PM-Review-2026-10-25.md#pm-m2--read-the-complete-plan-and-its-frozen-changes>) (2026-10-25 draft; actual result Pending; earlier evidence retained).

**Implementation:** done
**UAT:** pending

**2026-09-15 reconciliation:** Complete new-plan revisions, Markdown export and bounded current-candidate diffs implemented. Historical/large-artifact paging continues under DLV-121; owner UAT pending. Implementation and owner acceptance are now tracked separately; the older acceptance-held wording below is historical.

- **2026-09-15 implementation delta:** full stored-plan Markdown/download, revision selection, latest-plan-only approval, unclipped new plan records and a hash-verified current-candidate diff reader. Source/journal bytes are accepted only when they match the immutable base manifest. Preview is bounded to 20 files, 128 KiB per input file and 64 KiB total diff text; absence, tampering, binary and size limits are labelled. Older generation diffs and larger-artifact pagination remain actionable under DLV-121. Physical relay acceptance stays in UAT; the implemented review scope is Done.

**Outcome:** Read full plans and frozen diffs before approval.

**Kind:** feature
**Touches:** `scripts/delivery-v2/interaction.mjs`, `scripts/delivery-v2/journey.mjs`, `scripts/delivery-v2/candidate.mjs`, `scripts/delivery-v2/entry.mjs`, `scripts/delivery-v2/store.mjs`, `scripts/delivery-v2/apply.mjs`, `scripts/pm/app/`, `scripts/pm/relay.mjs`, `src/features/pm-live/relay/`, `tests/delivery-v2/`, `tests/pm-ui/`

- **Evidence:** approval precedes content, normalized plan text is clipped, valid raw text suppressed, candidate UI only lists paths. [Hotfix packet D](<../_Archive/Plans/Delivery First-Run Hotfix (2026-09-14).md>).
- **Acceptance:** authenticated hash-bound artifact reader, complete immutable plan export/revisions and feedback, approval bound to full reviewed content, readable base-to-candidate diff before Apply. Created/Modified/Deleted derive from the run base, not Git tracking. Missing originals, binary/large files and truncation are explicit. Local/relay identities match; traversal/junction/hash/stale-approval tests pass.

### DLV-117

**Outcome:** Recommend qualified models and effort for each item.

**Kind:** feature
**Touches:** `scripts/delivery-v2/service.mjs`, `scripts/delivery-v2/policy.mjs`, `scripts/delivery-v2/work-ref.mjs`, `scripts/delivery-v2/coordination.mjs`, `scripts/delivery-v2/journey.mjs`, `scripts/pm/app/DeliveryV2.tsx`, `scripts/pm/app/types.ts`, `tests/delivery-v2/`, `tests/pm-ui/`

- **Acceptance:** deterministic item-aware model/effort/profile recommendation drawn only from qualified subscription-ready catalog entries; explicit selection and preserved overrides, source facts/revision recorded. Focused/Deep labels map to compatible stored values. Missing suggestions and stale capabilities cannot silently use a default. Lone-run readiness is clear and capacity details name blockers/units. [Hotfix packet F](<../_Archive/Plans/Delivery First-Run Hotfix (2026-09-14).md>).
- **Reading guide:** the deterministic recommender already exists — `policy.mjs recommendWorkProfile()`, returning `{profile, contract, reasons, source, settings}`, where `settings` is filled only when `catalog.profiles[profile][executor]` exists (hence the Focused-only suggestion). The catalog and per-entry availability are assembled in `service.mjs createDeliveryV2Context()` and validated by `policy.mjs validateExecutionPolicy()`; qualification facts come from `qualification.mjs` and `journey.mjs qualify()`/`profileFor()`. Requested-vs-effective persistence: `entry.mjs readExecutorSelection()`/`setExecutorSelection()`/`deliverSelection()`. Launch screen: `DeliveryV2.tsx LaunchV2()` with `PROFILES` and `startBlocker()`, plus `v2model.ts launchState()`/`effortsFor()`/`executorBlockMessage()`. Capacity wording is `v2model.ts reasonLabel()`, shared with DLV-122. Tests: `tests/delivery-v2/executor-selection.test.ts`, `qualification.test.ts`, `pilot-entry.test.ts`, `tests/pm-ui/delivery-eligibility.test.ts`.

**Execution plan — 2026-09-26**

**Readiness:** Implementation draft; complete advice over current qualified catalog entries.

**Verify:** Use tests/delivery-v2/executor-selection.test.ts, qualification.test.ts, pilot-entry.test.ts and tests/pm-ui/delivery-eligibility.test.ts; add no-qualified-entry, stale capability, override retention and cold-reload cases.

```delivery-plan-v1
{
  "outcome": "Recommend compatible item-specific settings while preserving explicit owner selection.",
  "acceptance": [
    "Every suggested setting is currently compatible and qualified.",
    "Reload never replaces an explicit owner override with a default."
  ],
  "scope": [
    "scripts/delivery-v2/policy.mjs",
    "scripts/delivery-v2/service.mjs",
    "scripts/delivery-v2/work-ref.mjs",
    "scripts/delivery-v2/journey.mjs",
    "scripts/pm/app/DeliveryV2.tsx",
    "scripts/pm/app/v2model.ts",
    "tests/delivery-v2/",
    "tests/pm-ui/"
  ],
  "steps": [
    "Trace recommendWorkProfile and catalog assembly; separate existing profile advice from missing model/effort selection.",
    "Filter recommendations through qualified subscription-ready capabilities and current item facts; never fall back to an unqualified default.",
    "Persist recommendation inputs/revision and the explicit chosen override; map display labels to the existing profile values.",
    "Test stale readiness and missing suggestions before admission, and keep detailed reasons on demand with concise launch controls."
  ],
  "invariants": [
    "Advice is not launch authority.",
    "No inference request is used to choose the recommendation."
  ],
  "exclusions": [
    "Hardcoded new model offerings, provider benchmarks or automatic resource increases."
  ],
  "checks": [],
  "risks": [
    "A qualified profile can become stale between suggestion and dispatch."
  ],
  "unknowns": [
    "Which admitted catalog entries are currently available at execution."
  ],
  "dependencies": [],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. Existing policy recommender and service refusal propagation inspected; no provider availability claimed."
}
```

### DLV-118

**Outcome:** Prepare runnable checks and bounded context for Fast lane.

**Kind:** feature
**Depends on:** DLV-119, DLV-114, DLV-117
**Touches:** `scripts/delivery-v2/interaction.mjs`, `scripts/delivery-v2/policy.mjs`, `scripts/delivery-v2/journey.mjs`, `scripts/delivery-v2/worker-boundary.mjs`, `scripts/delivery-v2/worker/`, `tests/delivery-v2/`

- **Evidence:** both profiles use the same investigation flow; native build attempted unavailable tools. This run's corrected baseline and attribution limits are in [hotfix packet F](<../_Archive/Plans/Delivery First-Run Hotfix (2026-09-14).md>).
- **Acceptance:** resolved profiles govern context/check inventory and bounded job/repair policy; Focused uses known scope, compact required context and a prepared checker without repeated unavailable tool attempts. Measure fewer wasted commands and lower usage against the same acceptance fixture; preserve approvals, invariants and qualification. Deep remains bounded investigation before approval, not unlimited work. No invented estimate becomes a cap.
- **Reading guide:** Current handoff (2026-09-26): profile propagation and recovery briefs were implemented on September 20. Start with `scripts/delivery-v2/task-input.mjs` (`preparedPlanFor`, `makeTaskBrief`, `briefInstruction`) and the dated implementation/closeout receipts; use `interaction.mjs`, `policy.mjs` and `journey.mjs` only to verify an identified discrepancy. KIT-11 is now shipped, so the original launch packet is historical. Remaining work is to reconcile actual comparison evidence, protected check readiness and any reproduced gaps; do not repeat the old profile bug fix or launch a trial from this guide.

- **2026-09-20 — KIT-11 prepared as the measurement task; nothing installed or launched.** The prepared-vs-staged comparison in [the closeout plan](<../_Archive/Plans/Delivery Optimization Closeout (2026-09-26).md>) now has its inputs. Built: a protected behavioural oracle over the **real** cooking-log route (`tests/delivery-oracles/kit11-cooking-count.mjs`, 12 checks, only the data-client/cookie-store/response seams replaced), execution policy **revision 7** validated by `validateExecutionPolicy` but **not installed** (one writable path, nine-file snapshot, one command spec, one required criterion, unchanged typecheck), a single `delivery-plan-v1` body, and both arms' Master Book section text generated from that one body so the engineering specification is identical by construction. Evidence: the current source fails 4 of 12 oracle checks (nonzero, zero, missing and failed count all write `1`) and a corrected control passes 12 of 12, **both reproduced inside the pinned worker image** (`--network none`, read-only `/candidate`, real `/deps`); `preparedPlanFor` against the real checklist and book returns `no-single-prepared-plan` for the staged arm and **eligible** for the prepared arm once `ownerReviewed` is true — it is `false` on disk and stays false until the owner's review. Cost: zero provider jobs, runs, reservations or subscription tokens. Remaining work is owner-only. Packet: `.delivery/v2/preparations/kit11/LAUNCH-PACKET.md`.

**Execution plan — 2026-09-26**

**Readiness:** Investigation first; implementation exists, measurement remains.

**Verify:** `pnpm exec vitest run tests/delivery-v2/task-input.test.ts tests/delivery-v2/focused-delivery.test.ts`; reconcile existing staged/prepared receipts and same-fixture protected checks before proposing any new trial.

```delivery-plan-v1
{
  "outcome": "Close Fast-lane preparation with truthful evidence of bounded context and runnable checks.",
  "acceptance": [
    "Existing profile/context/check behavior is evidenced against current source.",
    "Any consumption saving uses comparable observed receipts, never assumed percentages."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md",
    "ERA Notes/10 - Project Management/Plans/Delivery Optimization Closeout.md"
  ],
  "steps": [
    "Reconcile the September 20 implementation and September 26 KIT-11 receipts; do not implement profile propagation or task briefs again.",
    "Compare actual same-fixture staged/prepared jobs, redundant commands and provider-normalized input/cache/output; mark missing observations unknown.",
    "Check oracle assertion-count drift and pinned inputs without modifying an oracle beneath existing candidates.",
    "Record proven behavior and measured limits; create a separate bounded engineering slice only for a reproduced remaining gap."
  ],
  "invariants": [
    "No silent ownerReviewed attestation.",
    "Existing approvals and protected checks remain required."
  ],
  "exclusions": [
    "Launching provider jobs, changing installed policy or replacing the checker dependency volume in this review."
  ],
  "checks": [],
  "risks": [
    "KIT-11 is now completed, so the old launch packet is historical rather than an executable instruction."
  ],
  "unknowns": [
    "Whether existing receipts supply a valid comparison and subscription observations."
  ],
  "dependencies": [
    "DLV-119",
    "DLV-114",
    "DLV-117"
  ],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. task-input.mjs inspected; KIT-11 shipped at current HEAD. Historical oracle counts need reconciliation."
}
```

- **Queue note, moved from the checklist 2026-11-11.** **DLV-118 — 2026-09-20 preparation done, nothing launched.** KIT-11 is prepared as the prepared-vs-staged measurement task: a protected behavioural oracle over the real route (`tests/delivery-oracles/kit11-cooking-count.mjs`, discriminating on a host checkout and inside the pinned worker image), a validated **but uninstalled** execution policy revision 7, one `delivery-plan-v1` body, both arms' Master Book section text generated from it, and verified eligibility — `no-single-prepared-plan` for the staged arm, eligible for the prepared arm once the owner sets `ownerReviewed`. `ownerReviewed` is still `false` on disk. Zero provider jobs, runs, reservations or tokens. Everything remaining is owner-only: install the policy, review the plan, choose the qualified selection and limits, launch. Packet: `.delivery/v2/preparations/kit11/LAUNCH-PACKET.md`.

- **Queue note, moved from the checklist 2026-11-11.** **DLV-118 — 2026-09-26 run A (`r-54d5cf10d995`, staged, Codex Luna medium).** Plan → one build → typecheck satisfied (host fallback). The KIT-11 oracle exited 0 with "12 of 12 checks passed", but the count parser only read "tests passed", so the run stopped at `checks-inconclusive`. Parser fixed in `checks.mjs parseTestCounts()` (harness wording, not the candidate); one owner Recheck → **verified_candidate**, oracle 12/12. Measured: 2 jobs (plan 26 s, build 33 s), 0 repairs, 0 plan revisions, **80,028 tokens** (68,096 cached input, 10,312 fresh input, 1,620 output incl. 542 reasoning); checks 2 min 18 s (host typecheck). Not applied. During the Recheck the PM server answered 33/33 health probes in ≤ 0.03 s (DLV-135 live witness).

- **Queue note, moved from the checklist 2026-11-11.** **DLV-118 — 2026-09-26 run B (`r-fa5c81702ec7`, prepared, same settings).** Owner set `ownerReviewed: true`; prepared plan approved in 8 s; 1 job (build 36 s), 0 repairs, no Recheck → **verified_candidate** (oracle 12/12, typecheck satisfied on host, checks 3 min 29 s). **47,573 tokens** (34,816 cached input, 11,639 fresh input, 1,118 output incl. 456 reasoning). Not applied yet. **A vs B:** both candidates make the same change to the one route (only a local variable name differs). B used 1 job instead of 2 and **32,455 fewer tokens (−40.6 %)**. The saving is cached context (−33,280) and output (−502); fresh input was **+1,327 (+12.9 %)**. Limits of the evidence: one run per arm, on a two-line fix; the tokens spent writing the prepared plan (2026-09-20) are not counted in B.

### DLV-112

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-PM-Review-2026-10-25.md#pm-m3--understand-a-passing-failed-or-inconclusive-check>) (2026-10-25 draft; actual result Pending; earlier evidence retained).

**Implementation:** done
**UAT:** pending

**2026-09-15 reconciliation:** Check count parsing and readable current/previous check results implemented. Protected log retention continues under DLV-120; owner UAT pending. Implementation and owner acceptance are now tracked separately; the older acceptance-held wording below is historical.

- **2026-09-15 UI delta:** current checks grouped by criterion and revision/time, readable names/counts/reasons, earlier receipts disclosed, `Couldn't verify` separate from Failed and Not tested, and `Check status` distinct from Recheck. Protected raw output remains unavailable where it was never retained; remaining log retention/actionability work is DLV-120; this implemented UI scope is Done and its owner UAT is pending.

**Outcome:** Make protected-check evidence readable and actionable.

**Kind:** bug
**Touches:** `scripts/delivery-v2/checks.mjs`, `scripts/delivery-v2/journey.mjs`, `scripts/delivery-v2/entry.mjs`, `scripts/pm/app/DeliveryV2.tsx`, `scripts/pm/app/v2model.ts`, `scripts/pm/app/types.ts`, `tests/delivery-v2/evidence.test.ts`, `tests/pm-ui/`

- **Evidence (2026-09-14):** DLV-107 run `r-c1d69bb666cf` produced two exit-0 protected receipts, but both had `selected/executed: null` and therefore became `inconclusive` under `criteria.mjs`. Vitest 4 emitted ANSI-decorated `Tests  12 passed (12)`, which the plain-text parser did not recognise. The pinned history observer correctly ran six synthetic cases but emitted its own count wording, which the parser also did not recognise. Each Recheck created a new result version with the same evidence and no owner-facing explanation.
- **Acceptance:** strip terminal formatting before parsing supported runner output; parse the pinned navigation observer's explicit synthetic-case count; retain the rule that missing/zero counts cannot pass. Cover ANSI Vitest, valid observer counts, unknown output and zero-test output.
- **Hotfix delta (2026-09-14):** parser component is present and targeted suites pass; result v5 passed with new evidence. Owner acceptance also requires criterion titles/counts/exit status, readable protected logs and precise failure layer, distinct Recheck versus command Check status, and a useful action for unchanged deterministic failures. [Packet E](<../_Archive/Plans/Delivery First-Run Hotfix (2026-09-14).md>). Keep this outcome open until readable evidence ships; do not repeat the parser patch.

### DLV-113

**Outcome:** Let an owner revise a checked candidate from recorded findings.

**Kind:** bug
**Touches:** `scripts/delivery-v2/journey.mjs`, `scripts/delivery-v2/interaction.mjs`, `scripts/pm/app/DeliveryV2.tsx`, `tests/delivery-v2/journey.test.ts`

- **Evidence (2026-09-14):** the run screen always accepts Guidance, but `queueMessage()` persists it as `queued` until a later native job carries it. A `checks-inconclusive` result offers only Recheck or Close and is not resumable, so the message is stranded and the owner has no action that turns findings into a revised plan/candidate.
- **Acceptance:** at candidate review, the owner can submit findings, see whether they are recorded and dispatchable, and explicitly choose a bounded revision path. The existing candidate remains immutable, no job dispatches without that owner action, and resource/policy refusal is stated before work begins. Cover queued, dispatched, refused and repeated-command cases.
- **Hotfix delta (2026-09-14):** bind findings to check/candidate evidence, preserve C1 while creating C2, report actual guidance delivery and support a linked successor for closed runs. Scope/model/resource changes renew necessary approval. [Packet E](<../_Archive/Plans/Delivery First-Run Hotfix (2026-09-14).md>).
- **Implemented 2026-09-20 (code only; not live-run):** `journey.control` action `revise` (`reviseCandidate()`), reusing `admitContinuation`. It refuses without `authorize_revision: true` and non-empty findings, and refuses unless the run is at `checks-inconclusive` with a result naming the latest candidate. It needs a valid approval, spends at most `REVISION_LIMIT` (2) owner-authorized jobs per run, and refuses before any work when admission refuses. The job is an ordinary `resume` write continuation marked `settings.revision`, so the automatic repair budget is untouched, and its own failed checks never trigger `repair`. C1 and every prior result stay recorded; the revision lands as C2. The findings are stored as a `revision-authorized` decision bound to the result ref, candidate id and generation, and carried in a `revisionInstruction` prompt. A replayed command id does not launch twice. UI: `Revise` with a findings box under Review checks. Tests: 5 cases in `journey.test.ts` (unauthorized/empty, C1 preserved + C2, replay, no auto-repair — confirmed to fail with the guard removed — and wrong state). `tests/delivery-v2` + `tests/pm-ui` 895 passed; typecheck clean. **Still open:** revising a CLOSED run (checks-failed / useful_partial) or a verified one needs a linked successor run; guidance receipts (`Saved for next step` / `Sent` / `Cannot send`) are not reworked; Focused profile refuses a second implementation job; approval renewal on scope change is only the existing refusal; no live-run witness.
- **Reading guide:** `journey.mjs reviseCandidate()` already admits a bounded explicitly authorized revision from checks-inconclusive; `REVISION_LIMIT` is 2 and replay does not create another job. Preserve that path. Remaining work is truthful guidance delivery receipts, linked successors for closed/verified or profile-exhausted runs, and explicit renewed approval where scope/model/resources change. Use the existing run creation/admission and immutable candidate machinery; Recheck never means implement. Read `interaction.mjs revisionInstruction` and existing journey/UI fixtures before extending them.

**Execution plan — 2026-09-26**

**Readiness:** Split first; preserve the implemented checks-inconclusive revision path.

**Verify:** Extend tests/delivery-v2/journey.test.ts, results.test.ts and tests/pm-ui/delivery-v2-model.test.ts for immutable C1/C2, linked successor, receipt delivery, stale approval, duplicate command and resource refusal.

```delivery-plan-v1
{
  "outcome": "Finish explicit candidate revision and linked successor workflows from recorded findings.",
  "acceptance": [
    "Recorded findings cannot silently dispatch.",
    "Closed/verified work has a traceable successor without mutating its original candidate."
  ],
  "scope": [
    "scripts/delivery-v2/journey.mjs",
    "scripts/delivery-v2/interaction.mjs",
    "scripts/delivery-v2/store.mjs",
    "scripts/pm/app/DeliveryV2.tsx",
    "scripts/pm/app/v2model.ts",
    "tests/delivery-v2/",
    "tests/pm-ui/"
  ],
  "steps": [
    "Read reviseCandidate and its existing owner authorization/job bound; reproduce only the remaining closed/verified-run and receipt gaps.",
    "First slice: show Saved for next step, Sent or Cannot send from actual admission/delivery records, preserving evidence identity.",
    "Second slice: create an explicitly requested linked successor through existing run creation when the original profile/state cannot admit a revision.",
    "Bind new scope/model/resource choices to fresh review; preserve the old candidate/results and verify both same-command replay and refusal before any job."
  ],
  "invariants": [
    "Focused one-implementation limit is not bypassed.",
    "Automatic repair remains a separate budget."
  ],
  "exclusions": [
    "Recheck as an implementation trigger or unbounded revision loops."
  ],
  "checks": [],
  "risks": [
    "Guidance marked saved can falsely look delivered."
  ],
  "unknowns": [
    "Exact linked-successor identity fields and current receipt gaps."
  ],
  "dependencies": [],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. journey.mjs has reviseCandidate and REVISION_LIMIT=2; September 20 partial implementation is preserved, not redesigned."
}
```

### DLV-114

**Outcome:** Enforce the subscription token ceiling during each native job.

**Kind:** bug
**Depends on:** DLV-119
**Touches:** `scripts/delivery-v2/jobs.mjs`, `scripts/delivery-v2/worker/runner.mjs`, `scripts/delivery-v2/adapters/codex.mjs`, `scripts/delivery-v2/policy.mjs`, `tests/delivery-v2/`

- **Evidence (2026-09-14):** DLV-107 used 482,416 settled token counters against its 200,000-token policy. Admission reserved 50,000 per job and correctly blocked only the next dispatch once reported use exceeded the allowance; it could not stop the running implementation, which alone settled 388,470 counters. No monetary charge was reported, but the owner requires included-subscription use only and needs a real consumption ceiling.
- **Accounting correction (2026-09-14):** 482,416 is the historical additive counter, not a deduplicated token total. Input-plus-output is 284,243 overall / 220,586 Build, still above the threshold. DLV-119 owns normalization. No further native dispatch after the overrun appears in this run; future-dispatch refusal is code behavior, not a separately exercised event in this trial.
- **Acceptance:** explicit per-run owner limit and evidence-backed enforcement mode, warning, in-job stop at observed crossing, observed termination and durable partial artifacts. A requested hard cap refuses unless a whole-job bound is proved; no silent threshold fallback. Owner-only audited increases/model escalation, unknown usage and fleet reservations preserved. Subscription zero-extra-spend and token ceilings remain separate guarantees. Cover both providers, end-only usage refusal, overshoot, restart, duplicate events and no automatic redispatch. Detailed seams and capability matrix: [packet B](<../_Archive/Plans/Delivery First-Run Hotfix (2026-09-14).md>).
- **Implemented 2026-09-20:** `budget.mjs` holds both halves. `resolveEnforcement()` reads the selected adapter's own profile `resources` (`wholeJobBound`, `strictBound`, `inJobReadings`) and refuses `hard-cap` on either executor — both declare `resource.wholeJobBound: unsupported`, so a requested cap refuses at `preDispatch` and, via `strictBoundRequired`, at deliver, with no threshold substituted. `threshold` is admitted only over per-turn counters; `advisory` is the default and stops nothing. `createBudgetMonitor()` accumulates `input + output` (cached input and reasoning stay subsets), keyed by turn against duplicates, latched to one warn and one stop, seeded with the run's banked usage and with a resumed thread's cumulative baseline. Both adapters call it from inside their stream and abort there; the supervisor marks the stop request durably at the crossing, observes termination through `runtime.stop`, records `jobs.budget_json` (mode, limit, banked, observed, overshoot, resets) and holds the run at `budget-exhausted`. The partial candidate is frozen with no checks and no repair, so nothing redispatches. Covered by 25 cases in `tests/delivery-v2/budget-stop.test.ts`, each confirmed to fail against the unfixed source. **Still open:** the bounded real stop witness (UAT U20) — a fixture abort is not a provider that stopped billing; plus wall-time limits and the `Increase limit` / `Change model` / `Reduce scope` escalation actions.
- **Reading guide:** The September 20 in-stream threshold monitor in `budget.mjs` and both adapters already exists. Preserve its capability checks, normalized counters, duplicate-event handling, overshoot and durable partial artifacts. Remaining engineering is bounded wall-time enforcement and explicit owner escalation through `policy.mjs`, `jobs.mjs`, `journey.mjs` and the run view. Existing `budget-stop.test.ts` is the starting regression suite; owner U20 is a separate real termination witness. Do not add the in-stream stop a second time or treat the earlier DLV-134 proposal as approved acceptance.

**Execution plan — 2026-09-26**

**Readiness:** Split first; token threshold exists, wall-time and explicit escalation remain.

**Verify:** Extend tests/delivery-v2/budget-stop.test.ts and journey.test.ts with wall expiry, restart, delayed termination, concurrent limit changes and repeated escalation commands; preserve both-provider threshold tests. Real stop U20 is owner evidence.

```delivery-plan-v1
{
  "outcome": "Complete bounded runtime stopping and owner-controlled recovery without overstating a hard cap.",
  "acceptance": [
    "Expired work requests stop once and retains its claim until termination is observed.",
    "No resource/scope/model escalation happens without the required owner decision."
  ],
  "scope": [
    "scripts/delivery-v2/budget.mjs",
    "scripts/delivery-v2/jobs.mjs",
    "scripts/delivery-v2/worker-boundary.mjs",
    "scripts/delivery-v2/journey.mjs",
    "scripts/delivery-v2/policy.mjs",
    "scripts/pm/app/DeliveryV2.tsx",
    "tests/delivery-v2/",
    "tests/pm-ui/"
  ],
  "steps": [
    "Revalidate the shipped threshold monitor and capability refusals; preserve normalized usage and explicit overshoot.",
    "First slice: persist an owner-configured wall-time deadline and route expiry through existing stop/termination reconciliation, retaining partial artifacts.",
    "Second slice: expose bounded Increase limit, Change model and Reduce scope choices through audited policy/approval revisions; repeat commands remain one intent.",
    "Test crash/restart and unknown-running-job cases; obtain the separate owner real-stop witness without treating fixtures as billing evidence."
  ],
  "invariants": [
    "Unsupported hard cap refuses; threshold never promises zero overshoot.",
    "No paid fallback or automatic redispatch."
  ],
  "exclusions": [
    "Rebuilding in-stream counters or inventing allowance values."
  ],
  "checks": [],
  "risks": [
    "A timeout request can be mistaken for observed termination."
  ],
  "unknowns": [
    "Qualified wall-time mechanism and owner-supplied limits."
  ],
  "dependencies": [
    "DLV-119"
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. budget.mjs already implements advisory/threshold/hard-cap semantics; Master Book identifies remaining wall-time/escalation work."
}
```

- **Queue note, moved from the checklist 2026-11-11.** **DLV-114 — 2026-09-20 partial; parked 2026-09-26 (supervised use runs `advisory`).** In-job stopping is implemented and covered by 25 isolated cases (`npx vitest run tests/delivery-v2/budget-stop.test.ts`). Still owed: the bounded **real stop witness** (UAT U20), a wall-time limit and the `Increase limit` / `Change model` / `Reduce scope` escalation actions. Reopen before any unattended use.

### DLV-111

**Outcome:** Refresh subscription sign-ins before unattended remote launches.

**Kind:** feature
**Touches:** `scripts/delivery-v2/worker/subscription.mjs`, `scripts/delivery-v2/setup-subscriptions.mjs`, `scripts/delivery-v2/service.mjs`, `tests/delivery-v2/subscription.test.ts`

- **Evidence (2026-09-13):** preparation supplies a scoped credential snapshot to a read-only named volume. The guard checks provider quota before the native SDK starts, so an expired snapshot fails closed instead of reaching the SDK's refresh path. Account checks and both native SDK controls pass now; that is not evidence of future unattended renewal.
- **Acceptance:** refresh only through the native subscription login/control flow without inference or paid credentials; preserve a refreshed worker session across jobs; expired/revoked credentials report a short reconnect action. Test expiry, revocation and a stopped/restarted host. Do not add API-key fallback, token-pasting instructions or remote exposure of host credential directories. Coordinate remote owner-device acceptance with DLV-104.
- **Reading guide:** **partly built already — read it before designing anything.** `scripts/delivery-v2/credential-sync.mjs` (header dated 2026-09-19, "DLV-111, desktop part") holds `HOST_CREDENTIAL`, `credentialExpiry()`, `readHostCredential()`, `MIN_REMAINING_MS` and `createCredentialSync({boundary, docker, …})`, copying the host sign-in into the read-only volume before a probe or job, with the worker never writing back. The guard it feeds is `worker/subscription.mjs prepareSubscription()`/`includedUsage()`/`readSubscriptionWindows()`; volume preparation is `setup-subscriptions.mjs setupSubscriptions()` and `worker-boundary.mjs makeBoundaryConfig({credentials})`. Remaining scope is the unattended/remote half and owner-facing reconnect status (auth readiness in `service.mjs`'s catalog; `v2model.ts executorBlockMessage()`), coordinated with DLV-104. Tests: `tests/delivery-v2/credential-sync.test.ts`, `subscription.test.ts`, `subscription-window.test.ts`.
- **Evidence (2026-09-20, local fixtures only — physical-phone acceptance pending):** expired/revoked access now refuses with a reconnect action and never falls back. `credential-sync.mjs` refusals carry a distinct `code` (`not-signed-in`, `expired`, `expiring`, `unreadable`, `not-connected`, `sync-failed`, and `revoked` for a provider 401/403) plus a `reconnect` action (`open Claude Code once` / `run codex once`) that names no API key or paid route. **Gap fixed:** `containerSource` used to ignore a failed sync and start the container anyway; it now throws `subscription sign-in: …` before any container runs. A provider 401/403 from the auth probe is classified `revoked`, not a generic failure. `service.mjs` passes the action on the `subscription-not-ready` refusal and `executorBlockMessage()` shows "Reconnect needed. <action>." Cases in `credential-sync.test.ts` (expired/expiring/missing codes, no API/paid wording, readiness reports reconnect without probing, dispatch refuses with zero container calls, 401 → revoked) and `delivery-v2-model.test.ts`. `tests/delivery-v2` + `tests/pm-ui`: 900 passed, 7 skipped; typecheck and ESLint clean (`react-app-build` timed out once under load, passes alone).
- **Still open (DLV-111):** the host CLI remains the only refresher — nothing refreshes an idle laptop's sign-in, so a phone launch after long idle refuses (by design) until the owner reopens the CLI; a scheduled/native refresh is not built. Reconnect status has been exercised on the desktop catalogue path only; that the phone (`/pm/live`) renders the same message is unverified. Host restart with an expired sign-in is covered by fixtures, not a real restart. Owner prerequisites are in `docs/Delivery-UAT.md` U22.

**Execution plan — 2026-09-26**

**Readiness:** Investigation first; idle renewal support must be demonstrated.

**Verify:** Extend credential-sync.test.ts and subscription.test.ts for idle expiry, revocation, concurrent probes, restart and cancellation; assert zero inference/paid fallback. Owner verifies phone U22 separately.

```delivery-plan-v1
{
  "outcome": "Renew eligible subscription sessions through supported native controls or refuse with a usable reconnect action.",
  "acceptance": [
    "Expiry or revocation fails closed with no inference job.",
    "A supported refreshed session survives subsequent jobs without racing refresh-token ownership."
  ],
  "scope": [
    "scripts/delivery-v2/credential-sync.mjs",
    "scripts/delivery-v2/worker/subscription.mjs",
    "scripts/delivery-v2/setup-subscriptions.mjs",
    "scripts/delivery-v2/service.mjs",
    "scripts/delivery-v2/worker-boundary.mjs",
    "tests/delivery-v2/"
  ],
  "steps": [
    "Keep the implemented host-to-worker sync and reconnect refusal; inspect current native control APIs/documentation for non-inference renewal at execution time.",
    "Prove a bounded renewal operation with synthetic credentials and expiry; if the provider needs interaction, retain explicit reconnect rather than inventing unattended support.",
    "Serialize renewal/copy for each provider and update the scoped read-only worker snapshot only after success; never expose host credential directories remotely.",
    "Verify idle/restart/refusal paths and confirm the shared phone projection carries the actual reconnect action."
  ],
  "invariants": [
    "No API-key fallback, token-pasting guidance or credentials in logs.",
    "Native host sign-in remains the renewal authority."
  ],
  "exclusions": [
    "A home-grown OAuth refresher or automatic CLI inference to refresh login."
  ],
  "checks": [],
  "risks": [
    "Concurrent refresh-token rotation can invalidate another active session."
  ],
  "unknowns": [
    "Current provider-supported non-inference renewal capability and real phone receipt."
  ],
  "dependencies": [],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. credential-sync.mjs confirms host CLI is the only refresher and serializes copy; current API capability is intentionally unverified."
}
```

### DLV-109

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-PM-Review-2026-10-25.md#pm-m12--recover-an-interrupted-job-and-observe-live-activity>) (2026-10-25 draft; actual result Pending; earlier evidence retained).

**Outcome:** Show observed activity while an executor is running.

**Kind:** bug
**Touches:** `scripts/delivery-v2/adapters/adapter.mjs`, `scripts/delivery-v2/adapters/claude.mjs`, `scripts/delivery-v2/adapters/codex.mjs`, `scripts/delivery-v2/jobs.mjs`, `scripts/delivery-v2/store.mjs`, `scripts/delivery-v2/journey.mjs`, `tests/delivery-v2/journey.test.ts`

- **Evidence (2026-09-13):** Claude's adapter drains the stream before returning its buffered activity (`adapters/claude.mjs:680–702`); Codex follows the same pattern (`adapters/codex.mjs:475–521`). `jobs.mjs:550–551` persists activity only with the dispatch result, and `journey.mjs:2520` renders that persisted list. A held-open fake Claude stream emitted Read while the real job remained active: `runDetail.activity` was empty. After the stream ended, Read appeared. Local probe: `.tmp/delivery-review-activity.mjs`; receipt `.tmp/delivery-review-activity.log`.
- **Acceptance:** an observed tool/agent event becomes visible through the existing run-detail polling while the stream is still active; use the same bounded persistence path for both executors. A reconnect/replay does not duplicate activity. Preserve order and attribution; never invent unreported model/effort, tool completion or cost. Cover active, resumed and interrupted streams with fake SDK fixtures.
- **Scope limit:** activity delivery only; no new chat protocol or UI redesign.
- **Implemented 2026-09-20:** each adapter now stamps every observed event with the dispatch's own ordinal and hands it to a supervisor callback as it happens; `journey.dispatch()` persists it immediately, so `detail()` polling shows tool/message activity while the stream is still open. `store.appendActivity` stores an entry under its own `seq` when it carries one, which makes the live relay and the adapter's final buffer the same rows rather than two copies; a replay or reconnect reproduces the same ordinals, so nothing duplicates. Order and attribution are preserved and nothing unreported is invented. Rows written before the adapters stamped a `seq` keep the old append behaviour. Covered by the activity cases in `tests/delivery-v2/budget-stop.test.ts` for both executors, confirmed to fail against the unfixed source. **Still open:** acceptance during a real provider run (UAT U12/U20).
- **Reading guide:** Current handoff (2026-09-26): the September 20 callback implementation supersedes the old buffered-only diagnosis. `journey.mjs` persists entries through `appendActivity` during dispatch, and `tests/delivery-v2/budget-stop.test.ts` holds streams open to inspect activity before completion. Revalidate both adapters, sequence deduplication and interruption with those fixtures; the remaining real-run witness is UAT U12/U20. Source-present activity is not a device or provider acceptance claim.

**Execution plan — 2026-09-26**

**Readiness:** Investigation first; streaming is implemented, but confirm resumed/interrupted fixture coverage before classifying all remaining work as owner evidence.

**Verify:** `pnpm exec vitest run tests/delivery-v2/budget-stop.test.ts`; held-open/final-dedupe cases exist. Add bounded resumed/interrupted activity fixtures if absent, covering both executors. Owner records real-run U12/U20 separately.

```delivery-plan-v1
{
  "outcome": "Verify active, resumed and interrupted activity, then record the separate real-run witness.",
  "acceptance": [
    "Observed activity is visible while the stream is active and is not duplicated on final settlement.",
    "Real-provider acceptance remains explicitly observed or pending."
  ],
  "scope": [
    "ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md",
    "docs/Delivery-UAT.md",
    "tests/delivery-v2/budget-stop.test.ts"
  ],
  "steps": [
    "Read the September 20 implementation receipt and current dispatch callback before considering any edit.",
    "Run existing held-open activity fixtures for both executors; add resumed/interrupted cases if missing and verify sequence deduplication through final settlement.",
    "Reconcile already-recorded real-run evidence against U12/U20; ask for a new owner observation only if missing.",
    "If fixtures pass and no defect remains, retain implementation completion separately from pending UAT and reconcile the stale queue in a dedicated lifecycle update."
  ],
  "invariants": [
    "No fabricated tool completion or model attribution."
  ],
  "exclusions": [
    "Another streaming implementation or a provider run started to satisfy this planning task."
  ],
  "checks": [],
  "risks": [
    "The old guide describes the pre-fix implementation."
  ],
  "unknowns": [
    "Resumed/interrupted activity coverage and current owner U12/U20 acceptance evidence."
  ],
  "dependencies": [],
  "risk": "medium",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. journey.mjs appendActivity callback and budget-stop.test.ts live-stream case inspected; this session did not execute them."
}
```

- **Queue note, moved from the checklist 2026-11-11.** **DLV-109 / DLV-122 — implemented 2026-09-20, fixture-tested.** Live activity is observed during the KIT-11 runs; the waiting-run Cancel is exercised if either arm waits. Both are swept once seen on a real run.

### DLV-97

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-PM-Review-2026-10-25.md#pm-m5--keep-plan-approval-separate-from-implementation-and-apply>) (2026-10-25 draft; actual result Pending; earlier evidence retained).

**Implementation:** done
**UAT:** pending

**2026-09-15 reconciliation:** Policy-bound dispatch, approved plans, protected checks and Results implemented; native acceptance remains in UAT and recovery/token-stop gaps remain separate work. Implementation and owner acceptance are now tracked separately; the older acceptance-held wording below is historical.

**Outcome:** Authorize dispatch and enforce its policy.

- **First real-run setup (2026-09-13, completed):** DLV-107 is startable. Policy revision 2 is installed, both executors are permitted and qualified, worker subscription auth and protected checks pass, and the local server has been restarted. The withdrawn USD 2/API-key draft remains invalid; operational reservations are tokens, with no extra-spend authority. Also corrected setup defects: explicit snapshot filenames instead of directory entries, writable session/check-output volume ownership, large prompt transport over stdin, and surfaced worker process failures. Resume at owner Step 5 in `ERA Notes/08 - Sessions/Wizards/delivery-first-real-run-2026-09-13.md`. No model turn or real delivery result is claimed; those remain this item's acceptance.

- **Acceptance:** Finish the execution-policy surface beyond admission. **What exists (2026-09-09):** `.delivery/v2/execution-policy.json` — validated by `scripts/delivery-v2/policy.mjs`, schema `delivery-v2/execution-policy@1` — states permitted executors, permitted effects, unit/allowance/strictness, per-job reservation basis, expiry, `maxRequestedDisposition`, and the repair-dispatch limit; `publish`, `requireConfinement: false`, `requireQualifiedProfile: false` and automatic retry are structural refusals a file cannot set. **Required behaviour still missing:** `deliver` admits a Job and builds its `JobRequest` but never dispatches, so there is no authorized path from an admitted job to a running one, no scratch provisioning wired into it, no protected-check plan bound to the policy's criteria, and no owner-approval step between admission and dispatch. **Configuration model:** extend the same document with a `dispatch` section (who may trigger it, whether an owner confirmation is required per job, and the check plan reference), then add the route that consumes it. **Owner decisions required:** whether a dispatch needs a per-job confirmation or only the policy; what the FAST allowance actually is in dollars; which criteria a FAST contract gets by default. **Acceptance:** with a policy installed and a qualified profile, one command takes a selected checklist row from admission to a dispatched job and back to a Result, with `dispatched: false` no longer hard-coded and every refusal still reachable. **Dependencies:** DLV-94 (nothing may dispatch until a profile is admissible)

- **Adopted scope (2026-09-11, Command Center Phase 3):** per-run executor, model and effort from qualified profiles, with requested and effective values persisted; plan approval and final application as the V2 review moments; an exclusive dispatch claim and recorded intent before provider invocation; trusted-local command authentication (paired credential/session plus CSRF/origin checks), because a supplied actor name is not proof; unknown, non-finite and unit checks at admission with unit-specific settlement, so a null reservation never becomes zero. Remote actors derive from authenticated identity through the bridge. Resource amounts remain DEC-14.
- **Selection half landed (2026-09-11):** `deliverSelection` and `buildDeliver` refuse a missing, stale, unknown or ambiguous witness before any store write; a reordered checklist re-resolves the witnessed row instead of the row at the clicked ordinal; an unadmitted profile is refused before the store opens; the Master Book `### <ID>` revision is frozen into the contract (`acceptance_fingerprint`), so an acceptance edit invalidates grants bound to the old contract. Fixtures in `work-ref`, `pilot-entry` and `executor-selection`; delivery-v2 304 deterministic / 334 with isolation, typecheck and ESLint clean. The three Sep 9 failures were fixture/order defects: two HTTP fixtures never selected an executor although the executor check precedes the policy check, and the policy path opened the store for an unqualified profile. `dispatched: false` stays hard-coded.
- **Phase 3 implementation landed (2026-09-12); acceptance outstanding.** *Environment and admission:* the run names executor, model and effort (`registry.validateRunSettings`: SDK-accepted efforts, catalog models; `POST /api/delivery/v2/executor` is 410); qualification comes from bound receipts (DLV-96); `store.claimDispatch` is an exclusive conditional claim that records the dispatch intent, and `dispatchJob` rechecks source, acceptance, grant, policy revision, qualification, approval and resources immediately before the provider call, cancelling and releasing the reservation on refusal; `evaluateResources` refuses unsupported units, unit mismatches, non-finite amounts, a null next reservation or an unpriced open reservation under a finite allowance, and unknown usage under a strict one, with unit-specific settlement; `local-auth.mjs` authenticates commands by paired session + `x-era-csrf` (actor from the session) or a bridge bearer credential that alone may name a remote actor. *Native interaction:* `journey.mjs` with `interaction.mjs` — read-only investigation → plan revision N and questions; Approve binds plan digest, contract and grant; Revise, answers (only for the asking revision) and blocking build questions continue the native session under fresh admission; guidance receipts Queued → Awaiting next turn → Delivered at the marker; pause/stop show Stop requested until removal is observed; reconcile replays retained output and never relaunches; one supervisor repair after a failed check; explicit handoff to the other executor with a checkpoint and re-planning; effective model/effort verified against what the adapter observed (a mismatch holds the run). *Checks and Result:* export through the trusted loader, pinned check plan in a separate checker, zero-test = Not tested, stale/failed/drifted never pass, Result versions with obligations, observed `verified_candidate` only from the checker, PM writeback as a Master Book session-log line (never a checkbox) retried alone on failure; the Delivery list/Run views show V2 beside V1 ([PM Tooling R55](<../PM Tooling/PM Tooling — Master Book.md#r55>)). **Evidence:** `tests/delivery-v2` (journey 29 through the real adapters for both backends, dispatch-claims 13, local-auth 12, qualification 10, worker-boundary 16, worker-qualification 5, updated selection/entry fixtures), with pm-ui and relay suites 643 passed / 4 opt-in skipped; opt-in container smoke 4/4; typecheck and ESLint clean. **Missing live acceptance, by backend:** *Claude* — unqualified (egress), no real turn; effective model/effort matched only against scripted `init` and hook records. *Codex* — unqualified (egress), no real turn; its 0.144.1 events carry neither model nor effort, so a real run can show only `unreported`. Neither has produced a checked candidate, a real question/revision cycle, a crash reconciliation or a native baseline (DLV-98/99). Executor choice is not complete. Amounts remain DEC-14.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Delivery/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### DLV-98

**Execution:** owner
**UAT:** replaced 2026-09-26 by the KIT-11 A→B trial (DLV-118; [Delivery Optimization Closeout](<../_Archive/Plans/Delivery Optimization Closeout (2026-09-26).md>))

**2026-09-15 reconciliation:** Owner acceptance/runbook step in [Delivery UAT](<../../../docs/Delivery-UAT.md#owner-run-checks>). Removed from Delivery scope; original requirements below remain pending.

**Outcome:** Record a native baseline for a selected real item.

- **Acceptance:** V2 S0.2: choose an eligible isolated product item, record native execution owner attention/time/cost/provenance and comparable evidence. Synthetic fixtures and prepared baseline files are not an executed baseline.
- **Phase 6 (2026-09-12):** not recorded. No owner-selected item or approved amounts (DEC-14); `.delivery/v2/artifacts/baselines/` holds only a README. See the [DLV-102](<#dlv-102>) trial ledger.

**Provenance:** [Delivery — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Delivery/Delivery — Master Book.md>). The source is historical; this entry owns the retained outcome.

### DLV-86

**Outcome:** Correct forecast units from clean receipt provenance.

- **Acceptance:** Correct the active phase-based forecast units after ASTRA-DLV-1/2 repair receipt provenance; distinguish phase totals from per-traversal priors and exclude ambiguous history. Measured effort calibration remains gated on sufficient clean samples; do not retune the obsolete aggregate constant.
- **Depends on:** [DLV-87](<Delivery — Master Book.md#dlv-87>), [DLV-88](<Delivery — Master Book.md#dlv-88>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Delivery/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** `scripts/delivery/recommendation.mjs` — `FORECAST_PHASES`, `estPhaseUsage(tier, phase, history)`, its median-eligibility helper, and `forecastByPhase()`, where `perTraversal` vs phase totals is the actual unit confusion. Receipt provenance comes from `scripts/delivery/usage.mjs` (`reduceUsageByPhase()`, `toUsageTotalsV2()`, `addUsageV2()`). Blocked on DLV-87/88 for clean receipts; the obsolete aggregate constant in `scripts/delivery/config.mjs` is explicitly not to be retuned. Tests: `tests/delivery/recommendation.test.ts`, `usage.test.ts`.

### DLV-87

**Outcome:** Reject launches with unknown or unpriced cost.

- **Acceptance:** No unpriced or unknown cost may silently disable a cap: `costUsd: null`/`NaN`/absent must never compare its way past an envelope (the `NaN > cap` class from DLV-43, via a different door), and a provider with no pricing table must **refuse to launch** rather than run uncapped. Note the consequence and accept it: `config.json` has `codex: {models: []}` and Codex never reports cost, so Codex becomes unlaunchable until someone prices it — that is the correct outcome, not a regression
- **Re-probed 2026-09-11:** `checkSessionBudget({input:10, output:10, costUsd}, {maxUsd:1})` returns `status: "ok"` for `costUsd` null, NaN and undefined, and `exceeded` only for a finite 2. Pure call; no launch or spend. Still open.
- **V2 half (2026-09-12):** V2 admission and dispatch refuse a null next reservation or an unpriced open reservation under a finite allowance, a unit mismatch, an unsupported unit, a non-finite amount and (strict) unknown usage; a reservation closes only when every reading is priced in its unit (fixtures in `dispatch-claims.test.ts`, `journey.test.ts`). V1's predicate is unchanged, so this item stays open for V1.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Delivery/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** one function — `scripts/delivery/budgets.mjs checkSessionBudget()`, with `totalProcessedTokens()` and `createBudgetEnvelope()` beside it. Pricing tables are in `scripts/delivery/config.mjs` (the `codex: {models: []}` entry is what makes Codex unlaunchable once this lands — the accepted consequence). V2's half is already done in `jobs.mjs evaluateResources()`; mirror its refusal vocabulary rather than inventing one (`tests/delivery-v2/dispatch-claims.test.ts` shows the shape). Tests: `tests/delivery/budgets.test.ts`, `config.test.ts`.

### DLV-88

**Outcome:** Separate API cost, estimates and subscription usage.

- **Acceptance:** Distinguish the three things currently conflated as one number: **actual API cost**, **estimated API-equivalent cost**, and **subscription usage**. The driver carries no `ANTHROPIC_API_KEY` and inherits Claude Code's own auth, so if that is a subscription then every dollar in the ledger is notional and the genuinely scarce resource is the rate-limit window — which is what "limit hitting" has been all along. Confirm which auth is in use, then label the ledger honestly and add a token-window/cache-creation/turn-count limit alongside the dollar cap
- **V2 provenance (2026-09-12):** V2 projections keep provider-reported estimate, measured tokens, reconciled bill, subscription usage and available quota as separate fields (the last three null until observed) and the run view shows an unreported estimate as “Unknown”. Which auth a real V2 run uses is unconfirmed; the V1 ledger is unchanged.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Delivery/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** `scripts/delivery/usage.mjs` is where the three numbers are currently one — `estimateCostUsd()`, `addUsageV2(prev, usage, costUsd, costEstUsd)` and `computeOccupancy(usage, windowTokens)`; occupancy is already the rate-limit-window measure the acceptance asks for. The ledger surface is `scripts/delivery/server-routes.mjs`. V2 already keeps the fields separate — `jobs.mjs resourceSummary()` and `v2model.ts costRows()` — so reuse those names instead of coining new ones. Tests: `tests/delivery/usage.test.ts`, `budgets.test.ts`.

### DLV-89

**Outcome:** Resolve V1 approval interaction costs.

- **Acceptance:** Resolve the proposed interaction-cost experiment for DLV-92 against the three-gate non-negotiable. Existing qualifying INSTANT gate compression remains valid; no general typed-approval, budget or gate waiver is authorized by this study.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Delivery/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** decision work, not code work — the deliverable is a recorded decision (DEC-21 in `_Decisions.md`), not an edit. For context on what the three gates actually are in V1, read `scripts/delivery/state-machine.mjs` and `scripts/delivery/controls.mjs`, plus the qualifying INSTANT compression in `scripts/delivery/instant.mjs`.

### DLV-90

**Outcome:** Reject zero-test validation as NOT_TESTED.

- **Acceptance:** A targeted run selecting zero tests records NOT_TESTED and cannot satisfy INSTANT validation, regardless of process exit code.
- **Touches:** `scripts/delivery/run-session.mjs`, `tests/delivery/run-session.test.ts`

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Delivery/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** `scripts/delivery/run-session.mjs` — `runValidationCommands()`, `VALIDATION_COMMANDS` and `targetedTestCommand()` already record `{skipped, reason}` per rung but have no zero-selected concept; `NOT_TESTED` exists nowhere in V1 yet, so it is a new state rather than a rename. Classification lives in `scripts/delivery/validation-baseline.mjs` (`countValidationFailures()`, `classifyValidationFailure()`); the INSTANT gate is `scripts/delivery/instant.mjs`. V2 already has the rule — `checks.mjs parseTestCounts()` plus `criteria.mjs`'s "missing/zero counts cannot pass" — so copy those semantics. Tests: `tests/delivery/run-session.test.ts`, `validation-baseline.test.ts`, `instant.test.ts`.

### DLV-91

**Outcome:** Release abandoned session locks safely.

- **Acceptance:** Safe session-lock handling: store lock ownership plus a heartbeat, expire abandoned leases, check whether the owning process still exists, and allow an audited manual force-release. `s-20260725-181118-xdl9` sat ACCEPTED-not-shipped for 4 days holding the global build lock; a crashed first real run must not block Delivery for days

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Delivery/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** the lock is derived, not stored — `scripts/delivery/server-routes.mjs` `isBuildLockActive()` over `BUILD_LOCK_STATES`, which includes `ACCEPTED`; that is why an accepted-not-shipped session held it for four days. Liveness already exists as `run-session.mjs isRunnerAlive(sessionDir)`, used at the salvage/force paths in the same routes file — build on it rather than adding a second heartbeat. An audited force-release should emit through `scripts/delivery/events.mjs`. DLV-68 shares this ground. Tests: `tests/delivery/server-routes.test.ts`, `server-routes-salvage.test.ts`, `failure-scenarios.test.ts`.

### DLV-92

**Execution:** owner
**UAT:** cancelled 2026-09-26 — V1 is frozen and replaced by Delivery V2; owner scope decision 2026-09-26

**2026-09-15 reconciliation:** Owner acceptance/runbook step in [Delivery UAT](<../../../docs/Delivery-UAT.md#owner-run-checks>). Removed from Delivery scope; original requirements below remain pending.

**Outcome:** Measure one genuine V1 product delivery.

- **Acceptance:** Run **one genuine medium product item** end to end: 3–8 files, clear acceptance criteria, ~1–3 hours by hand, **not** payments/auth/security/migrations/RLS, **not** visual (so the missing UI rung doesn't block it), **not** `[TEST]`, and **not** Delivery modifying Delivery. Define success in writing *before* launching. Run it mainly away from the keyboard, but **semi-attended on this first one** — glance every ~20 min, because a silent 3-hour failure would cost the only real data point there is; run #2 goes truly unattended. Record: estimated manual CLI time · actual elapsed · owner attention time · unattended execution time · useful files changed · validation confidence · would-you-use-Delivery-again. Classify the outcome as **delivered independently / delivered with supervision / useful handoff / no value**, with *unattended useful work* as the primary metric. The record is a markdown template filled in by hand — not a subsystem
- **Depends on:** [DLV-86](<Delivery — Master Book.md#dlv-86>), [DLV-87](<Delivery — Master Book.md#dlv-87>), [DLV-88](<Delivery — Master Book.md#dlv-88>), [DLV-90](<Delivery — Master Book.md#dlv-90>), [DLV-91](<Delivery — Master Book.md#dlv-91>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Delivery/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### DLV-93

**Execution:** owner
**UAT:** cancelled 2026-09-26 — V1 is frozen and replaced by Delivery V2; owner scope decision 2026-09-26

**2026-09-15 reconciliation:** Owner acceptance/runbook step in [Delivery UAT](<../../../docs/Delivery-UAT.md#owner-run-checks>). Removed from Delivery scope; original requirements below remain pending.

**Outcome:** Limit repairs and complete a second V1 product item.

- **Acceptance:** After DLV-92, allow at most **one** reliability fix, **one** workflow simplification and **one** validation fix, then run a **second** genuine product item before any further architecture work. Only after two real completions do the parked items above become eligible, and parallelism stays gated until sessions reliably start, stop, release locks, preserve context and write finish packages
- **Depends on:** [DLV-92](<Delivery — Master Book.md#dlv-92>).

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Delivery/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### DLV-72

**Execution:** owner
**UAT:** cancelled 2026-09-26 — V1 is frozen and replaced by Delivery V2; owner scope decision 2026-09-26

**2026-09-15 reconciliation:** Owner acceptance/runbook step in [Delivery UAT](<../../../docs/Delivery-UAT.md#owner-run-checks>). Removed from Delivery scope; original requirements below remain pending.

**Outcome:** Verify mobile gated-session drill-down.

- **Acceptance:** Live-verify the session drill-down end to end: a question-gated session shows its text on the phone, an advisory ledger answer lands in `ledger.json`, the four panes swipe, a gate push opens that session directly, and the published `session:<id>` row stays under the size cap for a long session

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Delivery/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### DLV-77

**UAT instructions:** [Test steps](<../../../docs/Delivery-UAT-Agentic-OS-2026-11-14.md#dlv-77--relay-prerequisite-evidence>)

**Execution:** owner
**UAT:** pending — folded into the 2026-09-26 phone pass

**2026-09-15 reconciliation:** Owner acceptance/runbook step in [Delivery UAT](<../../../docs/Delivery-UAT.md#owner-run-checks>). Removed from Delivery scope; original requirements below remain pending.

**Outcome:** Verify the current PM command authorization constraint.

- **Acceptance:** Owner supplies the current pm_commands CHECK definition and resolves the missing historical migration reference; verify approve/accept eligibility against the bridge contract before any owner-applied repair. The absent file does not prove current DB failure; agents make no DB calls.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Delivery/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### DLV-78

**Execution:** owner
**UAT:** cancelled 2026-09-26 — V1 is frozen and replaced by Delivery V2; owner scope decision 2026-09-26

**2026-09-15 reconciliation:** Owner acceptance/runbook step in [Delivery UAT](<../../../docs/Delivery-UAT.md#owner-run-checks>). Removed from Delivery scope; original requirements below remain pending.

**Outcome:** Repeat the isolated INSTANT live witness.

- **Acceptance:** Live-verify INSTANT on the real BUD-14 item against an owner-prepared isolated fixture with no git writes: Flight-Check offers INSTANT and shows the located file **before** launch; `state.usage.total` at `UAT_READY` is ≤ $0.20 with `turnCounter === 2`; `events.ndjson` has `instant.verified` and no REVIEWING/UAT_PREP turn record; all three gate decisions exist from two owner actions; then repeat with the path stripped from the item text, and with an item that secretly touches two files to confirm `instant.escalated` fires

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Delivery/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

### DLV-79

**Outcome:** Calibrate INSTANT after three clean completions.

- **Acceptance:** Re-tune INSTANT's envelope from measurement once three sessions complete — `$0.25 / 250K / 8 internal turns` is a launch-time estimate, and `estPhaseUsage` switches to measured medians at three samples

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Delivery/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** the launch-time envelope is the `instant` entry in `scripts/delivery/config.mjs` (`maxUsd`, `maxTokens`, `warnPct`, `maxInternalTurns`). The switch to measurement is already written: `scripts/delivery/recommendation.mjs` `estPhaseUsage(tier, phase, history)` uses medians once enough samples exist, with a helper that reports whether it will. So the work is supplying three clean completions and re-tuning from them, not writing a new estimator. Tests: `tests/delivery/recommendation.test.ts`, `instant.test.ts`.

### DLV-68

**Outcome:** Repair abandoned attempt observability.

- **Acceptance:** Reuse existing heartbeat and PID checks. Add missing attempt identity/open-stub closure and progress-aware watchdog behavior demonstrated by a real failure. DLV-91 owns leases/lock release; do not build a second heartbeat subsystem.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Delivery/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** same liveness primitives as DLV-91 — `run-session.mjs isRunnerAlive()`, the `runner-crash` awaiting/blocked shape near the top of the same file, and `scripts/delivery/events.mjs`. The missing pieces are attempt identity and open-stub closure: read `scripts/delivery/state-machine.mjs` and the session-artifact writers in `run-session.mjs`. DLV-91 owns leases and lock release; do not build a second heartbeat subsystem. Tests: `tests/delivery/runner-crash.test.ts`, `state-machine.test.ts`, `failure-scenarios.test.ts`.

### DLV-69

**Outcome:** Preserve the latest request context through continuation.

- **Acceptance:** Distinguish the latest owner request from already-processed traffic; attach the saved context digest once when continuing. Preserve request/attempt identity and reject accidental duplication.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Delivery/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** the continuation path is the launch handler in `scripts/delivery/server-routes.mjs` — the `continuationOf` block that builds `continuation = {predecessorSessionId, remainingWork, salvagedAt}`, carries the predecessor's `memory/ledger.json`, and calls `markSuperseded()`. Context assembly is `scripts/delivery/context-assembly.mjs` (`buildContextPackage()`, `buildMechanicalDigest()`); the ledger model is `scripts/delivery/memory.mjs`. The distinction to add is "latest owner request" versus already-processed traffic, with the digest attached once. Tests: `tests/delivery/server-routes.test.ts`, `run-session-context.test.ts`, `memory.test.ts`.

### DLV-70

**Outcome:** (rest of DLV-40) Surface the raw-SDK transcript pointer in the desktop session detail.

- **Acceptance:** (rest of DLV-40) Surface the raw-SDK transcript pointer in the desktop session detail — the `state.driver.rawTranscript` field with its hash and existence check is written but rendered nowhere

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Delivery/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** pure rendering gap, verified 2026-09-20: `withRawTranscriptLinkage()` in `scripts/delivery/run-session.mjs` writes `state.driver.rawTranscript` (pointer + hash + existence check, Claude-only), `scripts/delivery/transcript.mjs` owns the pointer, and `grep rawTranscript scripts/pm/app/` returns nothing. The desktop session detail is `scripts/pm/app/Run.tsx` — `RunStory()` for the detail body and `Transcript()` for the existing per-turn reader over `/api/delivery/transcript`; shape the field in `scripts/pm/app/model.ts`/`types.ts`. Tests: `tests/delivery/transcript.test.ts`, `tests/pm-ui/session-model.test.ts`.

### DLV-99

**Execution:** owner
**UAT:** replaced 2026-09-26 by the KIT-11 A→B trial (DLV-118; [Delivery Optimization Closeout](<../_Archive/Plans/Delivery Optimization Closeout (2026-09-26).md>))

**2026-09-15 reconciliation:** Owner acceptance/runbook step in [Delivery UAT](<../../../docs/Delivery-UAT.md#owner-run-checks>). Removed from Delivery scope; original requirements below remain pending.

**Outcome:** Run one admitted V2 product pilot.

- **Acceptance:** V2 S1.4: after actual confinement qualification, dispatch policy and native baseline, separately authorize a bounded eligible pilot; preserve authority hash and immutable attempt evidence. No pilot dispatched by this documentation task.
- **Depends on:** [DLV-96](<../_Archive/Shipped/Delivery.md#dlv-96>), [DLV-97](<Delivery — Master Book.md#dlv-97>), [DLV-98](<Delivery — Master Book.md#dlv-98>).

**Provenance:** [Delivery — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Delivery/Delivery — Master Book.md>). The source is historical; this entry owns the retained outcome.

### DLV-52

**Outcome:** Reduce measured type debt at the validation boundary.

- **Acceptance:** Reverify the current baseline and reduce type debt only where it restores useful validation. ASTRA-R-5 enforcement is a candidate for DLV-93’s single validation slot, not another parallel commitment. Exhaustive-deps runtime repairs belong only to DLV-84.

- **Acceptance:** `pnpm lint` reports 0 errors, with each `no-explicit-any` replaced by the correct type from its own call site (never `unknown`-as-a-shortcut or a suppression), and each `exhaustive-deps` fix verified in the running app — specifically that `SyncContext`, `HubPage` and `MobileExpenseForm` do not enter a render loop.

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Delivery/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Recount `pnpm lint` and `pnpm typecheck`, then freeze one useful validation boundary and inspect its actual producers/consumers. Replace no-explicit-any with real domain types or input validation; do not use casts, suppressions or a widened debt ledger. Exhaustive-deps runtime changes belong to DLV-84. Correction (2026-09-26): `tests/pm-ui/lint-rules.test.ts` tests checklist grammar and cannot certify TypeScript/ESLint debt reduction; use the compiler, actual ESLint findings and the changed domain boundary tests.

**Execution plan — 2026-09-26**

**Readiness:** Split first; choose one useful typed boundary from a fresh count.

**Verify:** Run pnpm lint and pnpm typecheck for the current baseline; per slice run the actual boundary fixtures and record removed warning sites. Verify a deliberately invalid input is refused rather than cast away.

```delivery-plan-v1
{
  "outcome": "Reduce type debt where it restores meaningful validation without weakening the lint ledger.",
  "acceptance": [
    "The chosen invalid shape is rejected or fails type checking.",
    "No suppression or widened debt allowance is introduced."
  ],
  "scope": [
    "eslint.config.mjs",
    "src/",
    "scripts/",
    "tests/"
  ],
  "steps": [
    "Recount no-explicit-any findings and choose one bounded route/service/parser contract; freeze exact files before dispatch instead of authorizing these broad planning roots.",
    "Trace each chosen value to its producer and consumer; use existing domain types or real input validation rather than a cosmetic cast.",
    "Replace only that boundary and verify both valid and malformed behavior; remove a grandfathered ledger entry only when its file is clean.",
    "Record the measured delta and next slice; keep exhaustive-deps behavior repairs with DLV-84."
  ],
  "invariants": [
    "A type assertion cannot substitute for input validation.",
    "Runtime behavior and public contracts remain unchanged unless explicitly scoped."
  ],
  "exclusions": [
    "A repository-wide replacement job or treating unknown as a shortcut."
  ],
  "checks": [],
  "risks": [
    "A correct-looking annotation can hide an unvalidated external payload."
  ],
  "unknowns": [
    "Current debt count and the first high-value boundary."
  ],
  "dependencies": [
    "DLV-93 validation-slot decision where applicable."
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. Current lint ledger inspected; historical counts are not reused. PM lint-rules.test.ts tests checklist grammar, not ESLint debt."
}
```

### DLV-84

**Outcome:** Burn down `react-hooks/exhaustive-deps` (50 across 25 files).

- **Acceptance:** Burn down `react-hooks/exhaustive-deps` (50 across 25 files) — deliberately excluded from DLV-83 because each fix **changes runtime behaviour**: these sit in `SyncContext`, `HubPage` and `MobileExpenseForm`, where a wrong dependency is an infinite render loop in the offline sync engine or a money form. Needs per-site judgment plus real in-app verification on mobile, one file at a time, never a batch — a green typecheck proves nothing here

**Provenance:** [4 - Checklist.md](<../_Archive/2026-09-10 PM Refactor/Before/Delivery/4 - Checklist.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** do not batch. The named risk sites are `src/contexts/SyncContext.tsx`, `src/components/hub/HubPage.tsx` (mounted by `src/app/chat/page.tsx` and `src/app/alerts/page.tsx`) and `src/components/expense/MobileExpenseForm.tsx` — a wrong dependency there is a render loop in the offline sync engine or in the money form. Re-measure with `pnpm lint` first; each fix needs in-app verification on a mobile viewport, one file at a time. `ERA Notes/01 - Architecture/Common Patterns.md` and `.claude/skills/cache-invalidation/SKILL.md` cover the mutation/state idioms these hooks sit in.

**Execution plan — 2026-09-26**

**Readiness:** Split first; exactly one effect/callback site per verified slice.

**Verify:** Capture current exhaustive-deps findings; for each selected site use relevant domain fixtures and real local mobile flow. Verify no render loop, duplicate listener/write or missed refresh through rerender/unmount/reconnect.

```delivery-plan-v1
{
  "outcome": "Repair hook dependencies without causing repeated writes or stale household state.",
  "acceptance": [
    "The repaired flow neither repeats writes nor misses required updates.",
    "Every changed effect has runtime evidence beyond a green compiler."
  ],
  "scope": [
    "src/",
    "eslint.config.mjs",
    "tests/"
  ],
  "steps": [
    "Recount current findings and choose one implicated effect/callback with a real user flow; pin exact files before dispatch.",
    "Trace every captured value, subscription and mutation; decide whether the effect needs dependencies, stable inputs or relocation, not an automatic array edit.",
    "Repair the selected site and verify its mount/update/unmount and retry behavior in the relevant mobile flow.",
    "Record the removed warning and evidence before selecting another site; drop the ledger entry only after the entire file is clean."
  ],
  "invariants": [
    "Money, offline queue and household rules remain binding.",
    "No eslint suppression or batch autofix."
  ],
  "exclusions": [
    "Reusing the historical 50/25 count as current scope."
  ],
  "checks": [],
  "risks": [
    "Adding a fresh object/function dependency can create an infinite mutation/render loop."
  ],
  "unknowns": [
    "Current warning locations and observable flow for the first slice."
  ],
  "dependencies": [],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. Accepted per-site contract and current lint ledger reviewed; no runtime hooks were changed in this planning pass."
}
```

### DLV-100

**UAT instructions:** [Test steps](<../../../docs/Delivery-UAT-Agentic-OS-2026-11-14.md#dlv-100--real-boundary-recovery-witness>)

**Execution:** owner
**UAT:** pending — parked to Later as an enhancement (owner 2026-09-26)

**2026-09-15 reconciliation:** Owner acceptance/runbook step in [Delivery UAT](<../../../docs/Delivery-UAT.md#owner-run-checks>). Removed from Delivery scope; original requirements below remain pending.

**Outcome:** Run the V2 failure and recovery matrix.

- **Acceptance:** V2 S2.1: execute the documented failurematrix against real boundaries, record denial/crash/timeout/budget/retry outcomes and fix only demonstrated failures. A synthetic runner test is insufficient.
- **Depends on:** [DLV-99](<Delivery — Master Book.md#dlv-99>).

**Provenance:** [Delivery — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Delivery/Delivery — Master Book.md>). The source is historical; this entry owns the retained outcome.

### DLV-101

**UAT instructions:** [Test steps](<../../../docs/Delivery-UAT-Agentic-OS-2026-11-14.md#dlv-101--deep-dive-resume-witness>)

**Execution:** owner
**UAT:** pending — parked to Later as an enhancement (owner 2026-09-26)

**2026-09-15 reconciliation:** Owner acceptance/runbook step in [Delivery UAT](<../../../docs/Delivery-UAT.md#owner-run-checks>). Removed from Delivery scope; original requirements below remain pending.

**Outcome:** Prove interrupted DEEP continuation.

- **Acceptance:** V2 S2.2: interrupt and resume a permitted DEEP item with pinned evidence, no duplicate effects, fresh authority check and bounded context. Record owner attention and result.
- **Depends on:** [DLV-100](<Delivery — Master Book.md#dlv-100>).

**Provenance:** [Delivery — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Delivery/Delivery — Master Book.md>). The source is historical; this entry owns the retained outcome.

### DLV-102

**Execution:** owner
**UAT:** replaced 2026-09-26 by the KIT-11 A→B trial (DLV-118; [Delivery Optimization Closeout](<../_Archive/Plans/Delivery Optimization Closeout (2026-09-26).md>))

**2026-09-15 reconciliation:** Owner acceptance/runbook step in [Delivery UAT](<../../../docs/Delivery-UAT.md#owner-run-checks>). Removed from Delivery scope; original requirements below remain pending.

**Outcome:** Decide V2 value from comparable runs.

- **Acceptance:** V2 S2.3: three FAST runs in total including failures, native baseline and the DEEP continuation witness produce measured value and an explicit continue/stop decision. No selective success-only denominator.
- **Phase 6 operating trial ledger (2026-09-12): not run; every criterion pending.**
  - *Native baseline (DLV-98):* none — no owner-selected item or amounts.
  - *Three FAST attempts, failures included:* 0 V2 runs — no executor qualified (DLV-96 egress), no policy `runtime` or credential volumes.
  - *Interrupted DEEP continuation (DLV-101):* none — follows DLV-99/100.
  - *Phone use:* none — relay migration unapplied, no real phone journey (DLV-104, PM Tooling R63).
  - *Two useful product outcomes:* none through V2; the Phase 5 pair (DLV-106) has not run, so there is nothing to reuse.
  - *Owner attention, unattended progress, rework, evidence confidence, usage and voluntary choice:* not measurable without runs.
  - *Recorded evidence today (local `.delivery/sessions`, read-only):* 16 V1 attempts, 2026-07-12 to 2026-08-22 — 1 Accepted (DLV-28, `s-20260725-181118-xdl9`, after two cancelled attempts), 15 Cancelled, none failed or running; provider-estimated $26.25 across 9 of 15 Claude sessions, with 6 Claude sessions and the one Codex session reporting no cost; about 25.2M cache tokens. These are V1 attempts under V1's freeze, not trial runs, and not comparable with a native baseline. No V2 store exists. The PM dashboard shows the same figures with coverage.
  - *Conclusion:* no continue/stop decision; nothing here shows V2 better or worse.
- **Depends on:** [DLV-101](<Delivery — Master Book.md#dlv-101>).

**Provenance:** [Delivery — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Delivery/Delivery — Master Book.md>). The source is historical; this entry owns the retained outcome.

### DLV-103

**Outcome:** Retire V1 only after a supported replacement.

- **Acceptance:** V2 S3.3 conditional: after owner value/retirement decision, drain sessions, preserve history and restore paths and verify the supported replacement. S3.1 remote/managed and S3.2 publication remain options until DEC-15/16 are decided.
- **Phase 6 (2026-09-12):** not started. No replacement journey has real receipts (DLV-102), so the V1 dispatcher, its routes and the `?ui=legacy` phone rollback stay operational. Prerequisite done: shared parser and model code moved out of the classic namespace (PM Tooling R6/R62). V1 history stays readable in Delivery and in the dashboard's attempts.
- **Depends on:** [DLV-102](<Delivery — Master Book.md#dlv-102>).

**Provenance:** [Delivery — Master Book.md](<../_Archive/2026-09-10 PM Refactor/Before/Delivery/Delivery — Master Book.md>). The source is historical; this entry owns the retained outcome.

- **Reading guide:** Retirement remains conditional on DLV-102 and an explicit current owner decision. DEC-15/16 were resolved in the recorded Command Center decisions; that does not satisfy replacement/value acceptance. Trace `entry.mjs` mode-switch refusals, `service.mjs listActiveV1Writers()` and V1 routes, then preserve `Run.tsx` and `shared/history.mjs` readers through any eventual drain/disable sequence. Coordinate R6 UI retirement separately. Never remove a writer/recovery path while an active or uncertain job still depends on it.

**Execution plan — 2026-09-26**

**Readiness:** Conditional: owner retirement decision after supported replacement evidence.

**Verify:** Use tests/delivery-v2/pilot-entry.test.ts and tests/pm-ui/session-model.test.ts with active V1, unreconciled V2, drained state and historical sessions; owner supplies replacement/value and recovery receipts.

```delivery-plan-v1
{
  "outcome": "Retire V1 dispatch only after its supported replacement and history recovery are proven.",
  "acceptance": [
    "No running or uncertain session loses its control/recovery path.",
    "Historical V1 outcomes remain readable after dispatch retirement."
  ],
  "scope": [
    "scripts/delivery-v2/entry.mjs",
    "scripts/delivery-v2/service.mjs",
    "scripts/delivery/server-routes.mjs",
    "scripts/pm/app/Run.tsx",
    "scripts/pm/shared/history.mjs",
    "tests/delivery-v2/",
    "tests/pm-ui/"
  ],
  "steps": [
    "Read DLV-102 replacement evidence and the current owner retirement decision; resolved DEC-15/16 do not themselves retire V1.",
    "Inventory active writers, unresolved jobs, history readers and restore paths; define a reviewed disable/drain sequence and reversal point.",
    "Disable only retired dispatch/control paths after draining; retain V1 session/history rendering and supported recovery.",
    "Verify switch refusal with active work and continuity after restart; coordinate UI retirement with R6 rather than deleting shared pieces twice."
  ],
  "invariants": [
    "Retirement needs an explicit current owner decision.",
    "A failed trial does not justify removing its fallback."
  ],
  "exclusions": [
    "Deleting session evidence or treating phone-legacy retirement as the same gate."
  ],
  "checks": [],
  "risks": [
    "Draining only visible jobs can miss an uncertain writer."
  ],
  "unknowns": [
    "Actual replacement/value acceptance and current retirement authorization."
  ],
  "dependencies": [
    "DLV-102",
    "Coordinate UI boundaries with R6."
  ],
  "risk": "high",
  "ownerReviewed": false,
  "provenance": "2026-09-26 at 45b28899. Current conditional contract and mode-switch routing reviewed; old unresolved DEC-15/16 wording is superseded by recorded decisions."
}
```

### DLV-104

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-PM-Review-2026-10-25.md#pm-m7--open-the-same-delivery-on-a-phone-and-recover-connection-state>) (2026-10-25 draft; actual result Pending; earlier evidence retained).

**Implementation:** done
**UAT:** pending

**2026-09-15 reconciliation:** Phone command identity, receipt recovery and owner-bound snapshots implemented; owner migration and physical-phone UAT pending. Implementation and owner acceptance are now tracked separately; the older acceptance-held wording below is historical.

**Outcome:** Recover phone commands and owner-bound snapshots.

- **Remote pairing concern (owner, 2026-09-13):** verify that a new phone can start/control a Delivery session while away from the laptop, without fetching a code from its terminal; consider remote code issuance only if the actual access path needs it. Current source already separates the paths: the signed-in `/pm/live` relay has `pairing: false` and derives its V2 session from the owner identity (`src/features/pm-live/relay/transport.ts:205,350`); the laptop bridge obtains its own credential (`scripts/delivery-v2/local-auth.mjs:137`). A phone opening the laptop's direct local/LAN URL still uses browser pairing. Local-auth and phone-relay fixtures passed 21 tests on this date; fresh phone sign-in/reinstall, logout/revocation and remote command acceptance remain owner-device checks. No remote code generator was added.

- **HELD — owner relay migration, DLV-97.**
- **Acceptance:** Command Center Phase 4 recovery. Command IDs exist before send and retries reuse the same intent; receipt observation is registered before dispatch and queried after reconnect or timeout; a bridge crash between effect and receipt reconciles the claimed command instead of relaunching; approvals bind owner, installation, run, plan/contract revision and payload; caches are bound to owner, installation and schema, cleared on logout or switch, replaced by complete snapshots and kept as explicitly stale same-owner data after a failed read. Killing the bridge between effect and receipt recovers the same command; double taps and replays do not duplicate work; an account switch shows no prior-owner content. New command types need an owner-run migration and schema snapshot; agents never apply it.
- **Evidence:** source-level findings in `src/features/pm-live/usePmLive.ts`, `cache.ts`, `store.ts` and `scripts/pm/bridge.mjs` ([Command Center §2, finding 5](<../Plans/Command Center.md#findings-that-should-precede-new-planning-features>)); not re-verified in Phase 0 and not an observed incident. DLV-77 and PM Tooling R42 stay separate.
- **Implementation landed (2026-09-12); acceptance outstanding.** *Contract:* `scripts/pm/relay-shared.mjs` is read by both ends — rows `cc:<installation>:<kind>[:<key>]`, receipt states (`sent` not acknowledged, `acknowledged` claimed, `done`, `refused`, `unknown`, `expired`; none is inferred from a timeout), snapshot assembly that is complete or nothing, heartbeat liveness, and attention keys per plan/question/result/application revision. *Laptop:* `scripts/pm/relay.mjs` + `bridge.mjs` — installation identity; the Markdown corpus as one row per file plus a manifest (only changed files re-sent); a secret guard on every row and receipt (service-role key, CRON secret, provider keys, the bridge token, service-role JWTs, private keys; a document holding one is withheld and named); V2 commands (`v2-deliver|decision|answer|message|control|apply`) run through `routeDeliveryV2` with an in-process paired bridge credential (`pairBridgeSession`) and actor `remote:supabase:<row user_id>`, `command_id` forced to the row id, and a command naming another installation left pending; journal `.delivery/pm-relay/commands.ndjson` (claimed → started → effected → reported) with `reconcileClaimedCommand` on start: execute if never started, report a recorded outcome, look a V2 command up by id in the supervisor store (`journey.commandState`), else `unknown` — a re-sent row whose journal shows it effected is reported, not run; `unknown` falls back to `claimed` + `result.outcome_unknown` before the migration; one drainer per checkout (`bridge.lock`); heartbeat with drain times and worker availability (`ready | not-qualified | not-configured | unavailable`); deduplicated attention pushes remembered across restarts (first pass seeds, no history storm). Approvals bind owner (actor), installation (payload), run, plan id/revision, contract revision (new `contract_revision` check in `decide`) and payload (command digest). *Phone:* `src/features/pm-live/relay/commands.ts` (intent persisted before insert, same id on retry — `23505` is the same command, waiter before insert, polling plus `resume` after reconnect or reload), `cache.ts` (IndexedDB keyed by owner/installation/schema; other owners, other schemas and the unscoped legacy cache purged before anything shows), `transport.ts` (complete read replaces rows, failed read keeps this owner's rows marked saved, account change purges and reloads). The legacy view's cache is owner-scoped and replaced by a complete read; its commands generate the id first and read receipts back. *Migration:* `migrations/2026-09-12_pm-v2-relay.sql` (inspection, types, `unknown` status, phone INSERT-pending/SELECT only, bridge-only writes to `pm_live`, index, verification, commented rollback) and `schema.sql` end state — **not applied**. **Evidence:** `tests/pm-relay.test.ts` (bridge over a Supabase double and the real V2 journey: a phone approval runs once with the remote actor; a reset row is reported not repeated; a receipt lost when the bridge died is recovered after restart with one decision and no new job; a mid-effect command is recovered from the store or reported unknown; pre-migration fallback; another installation's command stays pending; corpus/capabilities/runs/heartbeat carry no secret value and a secret-bearing document is withheld; one push per plan revision, none after restart), `tests/pm-live-relay.test.ts` (owner switch shows no prior-owner row and purges the legacy cache; complete read drops a vanished run; failed read serves this owner's saved copy marked saved; same id resolves a pending command later; bridge/ack/worker kept apart). Finish-gate suites 1961 passed / 4 opt-in skipped; typecheck, ESLint, `next build` clean. **Not evidenced:** the migration's effect on the live policies (owner-run), any real relay command, a killed real bridge, a real account switch, or a real phone.
- **Provenance:** [Command Center Phase 4](<../Plans/Command Center.md#phase-4--deliver-the-same-workflow-from-the-phone>).

### DLV-105

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-PM-Review-2026-10-25.md#pm-m6--review-apply-and-safely-test-rollback>) (2026-10-25 draft; actual result Pending; earlier evidence retained).

**Implementation:** done
**UAT:** pending

**2026-09-15 reconciliation:** Protected candidate Apply, integrated checks and recovery journal implemented; real DLV-107 Apply/rollback recorded on 2026-09-14; product UAT pending. Implementation and owner acceptance are now tracked separately; the older acceptance-held wording below is historical.

**Outcome:** Apply an approved candidate through a protected integrator.

- **HELD — DLV-99.**
- **Acceptance:** DEC-16 as adopted. Owner-triggered only, scoped to the exact candidate and destination; exclusive application claim; checks every affected before-image, the current base and scope; rejects link/reparse escapes and protected paths; validated byte writes with an application journal and backup; preserves unrelated CLI edits and blocks on conflict with an offer to rebuild against current source; copies the integrated source into the isolated checker for required checks and never runs candidate scripts in the privileged integrator; binds evidence to the integrated snapshot; a failed PM projection retries only the writeback. No reset, merge, commit, push, migration or deploy. Local tests precede any remote exposure (DLV-104, PM Tooling R63).
- **Implementation landed (2026-09-12); acceptance outstanding.** `scripts/delivery-v2/apply.mjs` is the integrator and has no process, Git, network or database capability (a fixture reads its source). `planApplication` refuses a candidate frozen inside the checkout, changed since freeze, carrying loader refusals or outside `publicationScope`; paths the loader would refuse, `PROTECTED_PATHS` (supervisor, checker, bridge and server code, `.git`, `.github`, `.husky`, `.delivery`, agent config and instruction files) plus policy `apply.protectedPaths` (additive only; `apply.automatic` is a validation error), any link or junction on the way, a sibling differing only by case or Unicode form, and candidate bytes that no longer hash to the manifest; a path whose current bytes are neither the base nor the candidate is a conflict and nothing is written; unrelated base drift is recorded and preserved; migration files are named. The journey's `apply` command binds the exact `candidate_id` and `result_id@version` the owner saw, records an `apply-candidate` decision, takes the exclusive claim (store schema 4 `applications`, partial unique index per destination), journals before-images and candidate bytes outside the checkout, writes one path at a time (re-checked, temp file, verify, rename), and on a failed write rolls back only paths still holding the candidate's bytes. Integrated checks copy the checkout's resulting bytes into a new generation through the trusted loader and run the policy's criteria with `runtime.checkExecutor` only; without a checker the state is `checks-pending`, never `applied`. `applied` records a receipt; an `applied_change` contract gains a Result version (workComplete) and a rollback appends one back. `resume`, `rollback` and `recheck` act on an application; a restart marks another process's in-flight application `interrupted` from its bytes. PM writeback is a session-log line per application state; the checkbox stays the owner's. Local route `POST /api/delivery/v2/apply`; phone command `v2-apply`; Run view Apply panel. **Evidence:** `tests/delivery-v2/apply.test.ts` (18): exact bytes applied and checked on the integrated generation outside the checkout; applied-change contract completes and rollback reverses it; unrelated CLI edit preserved and checked; failing integrated checks never read as applied and rollback keeps the CLI edit; conflict writes nothing and a later retry applies; stale candidate/result refused, same id replayed from its receipt, second apply refused, other actor conflicts; exclusive claim; crash between writes → interrupted after restart → resume without rewriting; rollback leaves an owner-edited file untouched; no checker → checks pending; protected, policy-protected, out-of-scope, junction, case-collision and inside-checkout refusals; route requires a credential and passes the binding. **Not evidenced:** a real verified candidate (none can exist before DLV-96/97/99), a real conflict with live CLI edits, or checks in the container checker on integrated code.
- **Provenance:** [Command Center §4](<../Plans/Command Center.md#completing-work-remotely-includes-disposition>); DEC-16 resolved 2026-09-11.

### DLV-106

**UAT instructions:** [Step-by-step owner wizard](<../../../docs/Delivery-UAT-PM-Review-2026-10-25.md#pm-m8--keep-conflicting-deliveries-apart>) (2026-10-25 draft; actual result Pending; earlier evidence retained).

**Implementation:** done
**UAT:** pending

**2026-09-15 reconciliation:** Dependency, writer, scope and fleet coordination implemented; native parallel-run acceptance pending. Implementation and owner acceptance are now tracked separately; the older acceptance-held wording below is historical.

**Outcome:** Run two independent candidates in parallel safely.

- **HELD — DLV-105, PM Tooling/R61.**
- **Acceptance:** Command Center Phase 5. Each candidate gets isolated writable scratch and an immutable base manifest; at most two concurrent writers until evidence supports more; admission checks dependency order, active identity, declared and observed path overlap, shared APIs/types/schema, lockfiles, generated outputs, check ports and fleet resources, shown as Can run together / Must follow / Needs scope check; conflicting writes and every application serialize; applying one candidate invalidates the other's affected checks; stale leases recover without duplicate writers; V1 keeps its global lock.
- **Implementation landed (2026-09-12); acceptance outstanding.**
  - *Rules:* `scripts/delivery-v2/coordination.mjs` (pure). Declarations come from `scripts/pm/shared/declarations.mjs`: `dependencyIds`, now shared with the portfolio read model, and `declaredTouches`.
  - *Admission:* `admitJob` takes a `gate`, evaluated inside its transaction. The journey's gate checks HELD and prerequisites against the canonical backlog, runs pairwise rules against every reserving run and checks drift of the run's own footprint since its snapshot (`source-moved`, which needs a new run). It also checks writer and job slots and the fleet allowance. `deliver` refuses held or dependent work before a run exists, and queues a launch refused only for capacity. `preDispatch` repeats the item and pairwise checks under the claim.
  - *Isolation and base:* one scratch volume per run (`volumesFor(run_id)`); the base manifest is written once, at first provision.
  - *Queue:* `runs.coordination_json` (store schema 5) records the waiting verdict, reasons and continuation. `drainQueue` runs after every job, close, stop, application and reconcile. It skips a run whose reasons still hold without spending a command, and admits with a new command id per attempt.
  - *Leases:* writer slots are derived from job and run state, never a separate lock that can go stale. A dead supervisor's claim is released by `releaseStaleClaims` and the same job dispatches once; a possibly running job keeps its slot.
  - *Discovered scope:* at freeze, observed paths outside the declaration and the approved plan are re-evaluated. A conflict sets `scope-conflict` and defers checks. A paused run yields its reservation, so two grown runs cannot deadlock.
  - *Application:* when `planApplication` reports base drift, `previewIntegration` (apply.mjs) lays the candidate over the checkout's current bytes, and the checker observes that preview under the claim before anything is written. A failed recheck (`reassessment-failed`) writes nothing, and the candidate stays applyable. An application marks every other run whose snapshot included the changed paths.
  - *Release:* control `release` drops an unapplied candidate's reservation.
  - *Surfaces:* `GET /api/delivery/v2/queue` and `/assess`. The queue rides the relay's `v2runs` row, so no new row kind or migration. Delivery shows slots, running items with executor and model, waiting items with verdicts and reasons, decisions and pairs. Launch shows the item's verdict and disables Start for held or dependent work. Run shows Waiting or Paused with reasons, plus Release when others wait on its candidate.
- **Evidence:** `tests/delivery-v2/parallel.test.ts` (15), all through the real journey:
  - two disjoint Budget items write at once while a third waits for a slot, and a race for the last slot admits exactly one;
  - a shared-contract consumer and a lockfile pair wait with their reasons until the other is applied or released;
  - a HELD item, an open prerequisite and a cancelled prerequisite refuse, and ticking the prerequisite through the CLI admits;
  - undeclared scope waits beside a reservation;
  - a writer that grows into another reservation pauses unchecked, and its later Apply conflicts without overwriting;
  - a running investigation fills the job cap, and a queued launch starts when it frees;
  - an unknown job and an unobserved stop keep the writer slot, and an observed stop frees it;
  - unknown cost queues under a fleet allowance;
  - a dead supervisor's claim is released and the job dispatched once, a replayed approval admits nothing, and the woken supervisor sends nothing;
  - native subagents are counted without a writer slot;
  - applying one candidate makes the next recheck on the combined source, refusing a failing combination and applying a compatible one;
  - an owner's CLI edit is never overwritten;
  - V1's build lock is still checked.

  Also `coordination.test.ts` (18) and `tests/pm-ui/coordination-model.test.ts` (5). Two Phase 4 Apply fixtures were updated for the pre-write recheck.
- **Not evidenced:** an owner-approved real pair, concurrency with real providers, two live container workers, or sprint integration (R61 absent).
- **Provenance:** [Command Center Phase 5](<../Plans/Command Center.md#phase-5--enable-dependable-parallel-items>).

## Backlog reconciliation

- 2026-09-26 — Owner scope decision (supervised use, laptop + phone): **DLV-98 / DLV-99 / DLV-102** owner trials are replaced by the KIT-11 A→B trial under **DLV-118**; V1 items **DLV-68/69/70/79/86/87/88/89/90/91** and owner checks **DLV-72/78/92/93** cancelled; **DLV-134** cancelled (inferred acceptance never approved); **DLV-100/101** and engineering **DLV-111/113/114/117/121/133** parked to Later; **DLV-77** folded into the phone pass. See `_Archive/Cancelled Log.md`.
- 2026-09-10 — Current open **DLV-94 → DLV-96** and **DLV-95 → DLV-97**. Historical Aug22 DLV-94/95 receipts keep their original identities.
- 2026-09-10 — **DLV-71 → DW-3** (shipped 2026-07-16); stale search/highlight item removed.
- 2026-09-11 — **DEC-15 resolved** (was: "After the V2 value trial, choose whether mobile access or a managed executor solves a measured burden"): phone use is a core milestone of the adopted Command Center, owned by DLV-104 and PM Tooling R63; managed hosting stays optional.
- 2026-09-11 — **DEC-16 resolved** (was: "After the V2 value trial, retain manual application or explicitly change Git/publication policy for a qualified path"): owner-triggered protected Apply is the adopted target (DLV-105); manual application remains until it lands; no Git, publication, deploy or production DB authority.
- 2026-09-11 — Command Center §7 mapped once: identity/source/witness repairs → PM Tooling R59 (shipped) and R51; V2 selection witness, per-run executor, approvals, resources, dispatch claim and local authentication → DLV-97; isolation → DLV-96; unknown cost → DLV-87/88; phone recovery → DLV-104; phone presentation → R63; Apply → DLV-105; parallel candidates → DLV-106; Home/Work → R60; sprints → R61; metrics → R62; native baseline, trial and retirement stay DLV-98/102/103.

## Shipped Log
- ✅ 2026-10-31 — **DLV-149** False Offline banner: policy loads no longer walk the source tree on read paths, cutting a load from 140 ms to 2 ms → [record](<../_Archive/Shipped/Delivery.md#dlv-149>)
- ✅ 2026-10-24 — **DLV-144** ERA Steward sign-off closure: four typed Steward operations with a server-enforced restricted credential, an owner-authorized support… → [record](<../_Archive/Shipped/Delivery.md#dlv-144>)
- ✅ 2026-10-24 - **DLV-143** cancellation status presentation: Activity uses terminal/stop status rather than the phase → [record](<../_Archive/Shipped/Delivery.md#dlv-143>)
- ✅ 2026-10-24 — **DLV-138** cancellation follow-up: preserve the original launch receipt and allow an explicit fresh intent only after confirmed cancellation → [record](<../_Archive/Shipped/Delivery.md#dlv-138>)

- ✅ 2026-10-17 — **DLV-133** Recovery source slice: freeze/verify compiler inputs across dispatch/restart/checking, carry generated-type pins and retain integrated… → [record](<../_Archive/Shipped/Delivery.md#dlv-133>)
- ✅ 2026-10-17 — **DLV-137** Recovery source slice: explicit service-owned observations, desktop/mobile publication and launch gate → [record](<../_Archive/Shipped/Delivery.md#dlv-137>)

- ✅ 2026-09-20 — **DLV-120** Protected-check output retained, redacted and classified → [record](<../_Archive/Shipped/Delivery.md#dlv-120>)

- ✅ 2026-09-20 — **DLV-108** Terminal-job recovery → [record](<../_Archive/Shipped/Delivery.md#dlv-108>)

- ✅ 2026-09-20 — **DLV-118** Bounded slice only: resolved-profile consistency, recoverable selected-task input, versioned advisory separation and no-planning-job… → [record](<../_Archive/Shipped/Delivery.md#dlv-118>)

- ✅ 2026-09-20 — **DLV-132** Confirmed prompt waste removed from executor instructions → [record](<../_Archive/Shipped/Delivery.md#dlv-132>)

- ✅ 2026-09-20 — **DLV-131** Deterministic typecheck outside the model, and Apply refuses without it → [record](<../_Archive/Shipped/Delivery.md#dlv-131>)

- ✅ 2026-09-20 — **DLV-130** Subscription-window observations recorded and labelled as shared → [record](<../_Archive/Shipped/Delivery.md#dlv-130>)

- ✅ 2026-09-20 — **DLV-129** Codex token accounting corrected: turn.completed.usage is thread-cumulative, not per-turn, so a resumed build restated its planning job's… → [record](<../_Archive/Shipped/Delivery.md#dlv-129>)

- ✅ 2026-09-19 — **DLV-128** Outcome tab, owner test gate and no executor test runs → [record](<../_Archive/Shipped/Delivery.md#dlv-128>)

- ✅ 2026-09-19 — **DLV-127** Protected-check count parser accepts the exact delivery-oracle summary line <n> of <m> tests passed (whole line only) → [record](<../_Archive/Shipped/Delivery.md#dlv-127>)

- ✅ 2026-09-19 — **DLV-126** Live proof-of-work card on the run page while a job plans, builds or checks: elapsed clock from the recorded job.dispatched event, a… → [record](<../_Archive/Shipped/Delivery.md#dlv-126>)

- ✅ 2026-09-19 — **DLV-125** Desktop sign-in renewal and full model catalogue → [record](<../_Archive/Shipped/Delivery.md#dlv-125>)

- ✅ 2026-09-19 — **DLV-124** Delivery Settings panel… → [record](<../_Archive/Shipped/Delivery.md#dlv-124>)

- ✅ 2026-09-14 — **DLV-119** Provider-aware token normalization shared by admission, settlement, UI and metrics → [record](<../_Archive/Shipped/Delivery.md#dlv-119>)

- ✅ 2026-09-15 — **DLV-116** Complete new-plan revisions, Markdown export and bounded current-candidate diffs implemented → [record](<../_Archive/Shipped/Delivery.md#dlv-116>)

- ✅ 2026-09-15 — **DLV-115** Rollback preview, confirmation, revision guard and exact inverse receipts implemented → [record](<../_Archive/Shipped/Delivery.md#dlv-115>)

- ✅ 2026-09-15 — **DLV-112** Check count parsing and readable current/previous check results implemented → [record](<../_Archive/Shipped/Delivery.md#dlv-112>)

- ✅ 2026-09-12 — **DLV-106** Dependency, writer, scope and fleet coordination implemented → [record](<../_Archive/Shipped/Delivery.md#dlv-106>)

- ✅ 2026-09-12 — **DLV-105** Protected candidate Apply, integrated checks and recovery journal implemented → [record](<../_Archive/Shipped/Delivery.md#dlv-105>)

- ✅ 2026-09-12 — **DLV-104** Phone command identity, receipt recovery and owner-bound snapshots implemented → [record](<../_Archive/Shipped/Delivery.md#dlv-104>)

- ✅ 2026-09-12 — **DLV-97** Policy-bound dispatch, approved plans, protected checks and Results implemented → [record](<../_Archive/Shipped/Delivery.md#dlv-97>)

- ✅ 2026-09-14 — **DLV-107** Restored completed-item history navigation with tab=story → [record](<../_Archive/Shipped/Delivery.md#dlv-107>)
- ✅ 2026-09-13 — **DLV-96** Qualified both native SDK container boundaries with unchanged canaries and judges → [record](<../_Archive/Shipped/Delivery.md#dlv-96>)
- ✅ 2026-09-13 — **DLV-110** Connected both existing subscriptions through native SDKs → [record](<../_Archive/Shipped/Delivery.md#dlv-110>)

- ✅ 2026-09-09 — **Claude and Codex are both selectable behind the one canonical executor boundary, and the execution policy is a document the owner can write.** V2 had shipped with a provider-neutral supervisor and exactly one adapter, which made it Codex-only in practice → [record](<../_Archive/Shipped/Delivery.md#2026-09-09--claude-and-codex-are-both-selectable-behind-the-one-canonical>)
- ✅ 2026-09-07 — **V2 S1.4 (entry point, installation-wide v1|v2 switch, run projection; the product pilot is NOT done and is blocked)** scripts/delivery-v2/entry.mjs connects the existing PM selection to an admitted Run: the dispatch switch, guardV1Route,… → [record](<../_Archive/Shipped/Delivery.md#2026-09-07--v2-s14>)
- ✅ 2026-09-07 — **V2 S1.3 (trusted import, protected checking, one Result, the canonical Checkpoint; V1 unchanged)** scripts/delivery-v2/checks.mjs copies the writer's output through the trusted loader into an immutable generation (<generations>/C1) and… → [record](<../_Archive/Shipped/Delivery.md#2026-09-07--v2-s13>)
- ✅ 2026-09-07 — **V2 S1.2 (store, admission and reconciliation; every fault injected through fakes; V1 unchanged)** scripts/delivery-v2/store.mjs is the local transactional supervisor store on node:sqlite — Node 22.20's built-in DatabaseSync plus its… → [record](<../_Archive/Shipped/Delivery.md#2026-09-07--v2-s12>)
- ✅ 2026-09-07 — **V2 S1.1 (adapter, scratch boundary, candidate freeze, and a containment battery that actually ran; V1 unchanged)** scripts/delivery-v2/adapters/adapter.mjs owns the canonical six-operation boundary — describeProfile / start / inspect / resume / stop /… → [record](<../_Archive/Shipped/Delivery.md#2026-09-07--v2-s11>)
- ✅ 2026-09-07 — **V2 S0.1 + S0.2 (code and synthetic fixtures only; V1 unchanged)** The first V2 code exists: scripts/delivery-v2/ with contracts.mjs… → [record](<../_Archive/Shipped/Delivery.md#2026-09-07--v2-s01--s02>)
- ✅ 2026-08-22 — **DLV-95** The budget cap was never wrong — the ledger it is checked against was → [record](<../_Archive/Shipped/Delivery.md#dlv-95>)
- ✅ 2026-08-06 — **DLV-85** One live SDK session now serves consecutive turns instead of one query() per turn — the cache is an asset again rather than a tax → [record](<../_Archive/Shipped/Delivery.md#dlv-85>)
- ✅ 2026-08-01 — **DLV-83** The launch baseline is green: typecheck, lint and test all exit 0 → [record](<../_Archive/Shipped/Delivery.md#dlv-83>)
- ✅ 2026-08-01 — **DLV-80** INSTANT's deterministic review now verifies the session's own diff, not the whole working tree → [record](<../_Archive/Shipped/Delivery.md#dlv-80>)
- ✅ 2026-08-01 — **DLV-81** Three diff/path-reading defects found in the same trace and fixed: (1) parseUnifiedDiff treated any line beginning --- as a file header, so… → [record](<../_Archive/Shipped/Delivery.md#dlv-81>)
- ✅ 2026-08-01 — **DLV-82** Locator precision: bare numeric literals were grepped as plain substrings, so BUD-14's $25 matched text-white/25, bg-emerald-500/25 and… → [record](<../_Archive/Shipped/Delivery.md#dlv-82>)
- ✅ 2026-08-01 — **DLV-73** INSTANT lane shipped: two model turns for a single located file, against FAST's four to five → [record](<../_Archive/Shipped/Delivery.md#dlv-73>)
- ✅ 2026-08-01 — **DLV-74** Triage gate converted from a wall into a router: a trivial item launches on INSTANT with no acknowledgment at all, and the refusal for… → [record](<../_Archive/Shipped/Delivery.md#dlv-74>)
- ✅ 2026-08-01 — **DLV-75** Zero-token locator: item keywords → Feature Map index.md intent table → the module's own file list → an in-process literal scan, ranked by… → [record](<../_Archive/Shipped/Delivery.md#dlv-75>)
- ✅ 2026-08-01 — **DLV-76** declaredEdit contract + deterministic review with auto-escalation → [record](<../_Archive/Shipped/Delivery.md#dlv-76>)
- ✅ 2026-07-24 — **DLV-1** budget governance: an owner-set cost/token envelope is mandatory at launch (or a typed NO CAP), recorded in the immutable packet, enforced… → [record](<../_Archive/Shipped/Delivery.md#dlv-1>)
- ✅ 2026-07-24 — **DLV-2** preflight Flight-Check: one launch authorization panel showing item/ACs, lane + model/effort fit, required budget, context manifest… → [record](<../_Archive/Shipped/Delivery.md#dlv-2>)
- ✅ 2026-07-24 — **DLV-3** config hardening: schema-validated `.delivery/config.json` with last-known-good fallback + dashboard banner, atomic writes, runner crash-loop backoff
- ✅ 2026-07-24 — **DLV-4** error taxonomy + retry escalation: closed the "monthly spend limit" pattern gap → [record](<../_Archive/Shipped/Delivery.md#dlv-4>)
- ✅ 2026-07-24 — **DLV-5** baseline & change-ownership gate: the server fingerprints the working tree and runs validation before launch → [record](<../_Archive/Shipped/Delivery.md#dlv-5>)
- ✅ 2026-07-25 — **DLV-20** mobile command channel: bridge drainer + allowlist mapping every phone command onto the existing routeDelivery() gates → [record](<../_Archive/Shipped/Delivery.md#dlv-20>)
- ✅ 2026-07-25 — **DLV-21** mobile launch flow: flight-check + mandatory budget envelope with no default; refuses on a dirty tree or red baseline because mobile never forwards the typed acknowledgment
- ✅ 2026-07-25 — **DLV-23** mobile checklist made read-only and a row tap repointed at the flight check → [record](<../_Archive/Shipped/Delivery.md#dlv-23>)
- ✅ 2026-07-25 — **DLV-22** push consumer for notification.requested (emitted since DLV-1, unconsumed until then): gate transitions, budget events, terminal states and… → [record](<../_Archive/Shipped/Delivery.md#dlv-22>)
- ✅ 2026-07-25 — **DLV-24** /pm/live promoted from a 3-tab relay to a responsive PM application: five views, bottom nav under lg and a side rail + widget grid above → [record](<../_Archive/Shipped/Delivery.md#dlv-24>)
- ✅ 2026-07-25 — **DLV-25** the three orphaned bridge commands got an interface: `capture` (Inbox quick-add), `ask` (free-form guidance) and `abort-turn`
- ✅ 2026-07-25 — **DLV-26** two drift fixes: LANE_HINTS was a hand-copied constant diverging from DEFAULT_CONFIG.budgets.laneDefaults — the bridge now publishes the… → [record](<../_Archive/Shipped/Delivery.md#dlv-26>)
- ✅ 2026-07-25 — **DLV-27** a missing provider USD cost renders as unavailable rather than crashing or showing a false zero; gate notifications use the same safe fallback
- ✅ 2026-07-25 — **DLV-29** fixed the budget-exhausted / manual-gate collision that permanently stranded a session: enforceBudgetBoundary no longer clobbers an… → [record](<../_Archive/Shipped/Delivery.md#dlv-29>)
- ✅ 2026-07-25 — **DLV-33 / DLV-35** per-spawn overhead floor: strictMcpConfig + mcp denial (16–36 unused tools rode along on 10 of 13 turns), an explicit skills filter and a… → [record](<../_Archive/Shipped/Delivery.md#2026-07-25--dlv-33--dlv-35>)
- ✅ 2026-07-28 — **DLV-37** usage accounting tells the truth: cache_creation_input_tokens was extracted nowhere for either provider → [record](<../_Archive/Shipped/Delivery.md#dlv-37>)
- ✅ 2026-07-28 — **DLV-32** owner guidance reaches every phase → [record](<../_Archive/Shipped/Delivery.md#dlv-32>)
- ✅ 2026-07-28 — **DLV-31** drivers survive a rotation: `reset()` on every driver, called from `getHandle` before any `startSession`, regardless of why the ref went null
- ✅ 2026-07-28 — **DLV-36** CLAUDE.md is no longer force-loaded per spawn (settingSources: []), replaced with a compact doctrine pointer → [record](<../_Archive/Shipped/Delivery.md#dlv-36>)
- ✅ 2026-07-29 — **DLV-39** hard triage gate at launch: an item that cannot fail interestingly refuses to launch through the full pipeline without a typed LAUNCH… → [record](<../_Archive/Shipped/Delivery.md#dlv-39>)
- ✅ 2026-07-29 — **DLV-41** closed the Bash escape hatch to the live Supabase project: psql, the supabase CLI (including npx-prefixed), curl/wget against a Supabase… → [record](<../_Archive/Shipped/Delivery.md#dlv-41>)
- ✅ 2026-07-29 — **DLV-38** flight-check forecast closed the loop: the "140×" claim conflated the context-load preview with the budget forecast (really 6× off) → [record](<../_Archive/Shipped/Delivery.md#dlv-38>)
- ✅ 2026-07-30 — **DLV-42** the money-domain flag no longer fires on a money word embedded in a UI noun, and scope hints stop discarding the item's own file pointer → [record](<../_Archive/Shipped/Delivery.md#dlv-42>)
- ✅ 2026-07-30 — **DLV-43** a turn that dies after the provider answered now banks what it spent → [record](<../_Archive/Shipped/Delivery.md#dlv-43>)
- ✅ 2026-07-30 — **DLV-44** the hypothesis was wrong and the real cause was narrower and worse: established was set after the message loop, but the SDK throws from… → [record](<../_Archive/Shipped/Delivery.md#dlv-44>)
- ✅ 2026-07-30 — **DLV-45** FAST became a real fast lane: every lane had handed DISCOVERY the same 33,151-token mandated reading list against FAST's own 8-turn cap, so… → [record](<../_Archive/Shipped/Delivery.md#dlv-45>)
- ✅ 2026-07-30 — **DLV-46** pnpm lint was not failing, it was running out of memory: flat config's built-in ignores cover only node_modules/.git, so a bare eslint… → [record](<../_Archive/Shipped/Delivery.md#dlv-46>)
- ✅ 2026-07-30 — **DLV-47** the raw SDK transcript is not usable as ground truth without deduplication, and this campaign's own cost forensics were inflated by it
- ✅ 2026-07-30 — **DLV-48** the long-carried "pre-existing DLV-34 handoff failure" was misattributed — a different collision entirely
- ✅ 2026-07-30 — **DLV-49** smoke-launch.mjs: a CLI harness that launches and inspects a real session through routeDelivery — the same path the dashboard uses, so a… → [record](<../_Archive/Shipped/Delivery.md#dlv-49>)
- ✅ 2026-07-30 — **DLV-50** repo typecheck restored to 0 errors; **DLV-51** the last red test was a false-positive drift guard, not a Schedule bug
- ✅ 2026-07-30 — **DLV-53…DLV-60** the plan-rejection path returns to SPEC_READY with the gate re-armed · packet.mode renamed… → [record](<../_Archive/Shipped/Delivery.md#2026-07-30--dlv-53dlv-60>)
- ✅ 2026-07-30 — **DLV-58** verified in flight, no fix needed: **the $0.50 budget cap held**, pausing the session with the underlying phase gate correctly preserved
- ✅ 2026-07-30 — **DLV-63** the phone shows the agent's question → [record](<../_Archive/Shipped/Delivery.md#dlv-63>)
- ✅ 2026-07-30 — **DLV-64** the session:<id> row now carries what the phone needs to read a session: the Q&A ledger (blocking questions first), a compact tail of the… → [record](<../_Archive/Shipped/Delivery.md#dlv-64>)
- ✅ 2026-07-30 — **DLV-65** session detail at ?session=<id>: a sticky segmented pill bar with a sliding thumb over horizontally snap-scrolling panes — Questions /… → [record](<../_Archive/Shipped/Delivery.md#dlv-65>)
- ✅ 2026-07-30 — **DLV-66** ledger questions are answerable from the phone through the existing answer type: a questionId routes to the non-blocking ledger control… → [record](<../_Archive/Shipped/Delivery.md#dlv-66>)
- ✅ 2026-07-30 — **DLV-67** gate pushes deep-link to ?view=delivery&session=<id> instead of the app root — a notification about one session no longer makes the owner… → [record](<../_Archive/Shipped/Delivery.md#dlv-67>)
- ✅ 2026-07-29 — **DLV-6 (D9)** lanes became a real, packet-resolved policy bundle: resolveLanePolicy() resolves FAST/STANDARD/DEEP into effort-per-phase + budget envelope… → [record](<../_Archive/Shipped/Delivery.md#dlv-6>)
- ✅ 2026-07-30 — **DLV-7** the scope contract end to end: DISCOVERY must return a `scopeEstimate`, and the **runner** — not the agent — derives the size class from owner-set thresholds
- ✅ 2026-07-30 — **DLV-8** per-lane, per-phase context budgets dropping lowest-priority sources first (item > doctrine > skill > campaign) → [record](<../_Archive/Shipped/Delivery.md#dlv-8>)
- ✅ 2026-07-30 — **DLV-9** model/effort fit is re-checked after discovery using the *measured* size class
- ✅ 2026-07-30 — **DLV-30 / DLV-34** phase-boundary context rotation is wired (every evaluation, including "no rotation needed", is an auditable event) and provider handoff now completes on the right driver
- ✅ 2026-07-28/30 — **DLV-11 (D10)** risk-based validation ladder: FAST runs typecheck + targeted `vitest related`, lint skipped; a skipped rung is always a structured, reasoned entry, never simply absent
- ✅ 2026-07-30 — **DLV-10** the AC coverage matrix is real state, seeded at spec approval with every criterion unmet → [record](<../_Archive/Shipped/Delivery.md#dlv-10>)
- ✅ 2026-07-30 — **DLV-12** `writeFinishPackage(reason)` on **every** exit to a terminal, blocked or paused state: manifest, acceptance, remaining-work, recovery, risks, summary. The exhaustiveness is the deliverable
- ✅ 2026-07-30 — **DLV-13** GET /api/delivery/salvage reads the predecessor's own remaining-work package and returns a pre-filled launch payload → [record](<../_Archive/Shipped/Delivery.md#dlv-13>)
- ✅ 2026-07-30 — **DLV-14** the PM trace is an exit effect the runner performs, not a step the agent can skip. It could, and did: BUD-11 burned two sessions and left **zero** PM trace
- ✅ 2026-07-30 — **DLV-15** a persistent `StatusHeader` answers "what's happening" and "what needs me" in two lines, above everything else
- ✅ 2026-07-30 — **DLV-16** the dashboard half of notifications: `pnpm pm` raises toasts for the same events the bridge pushes to the phone, plus gate transitions
- ✅ 2026-07-29 — **DLV-17 (D12, partial)** transcript gap detection: findMissingTurnIds compares state.turnCounter against what exists on disk, and a transcript.gap.checked event… → [record](<../_Archive/Shipped/Delivery.md#2026-07-29--dlv-17-d12-partial>)
- ✅ 2026-07-29 — **DLV-40 (D12, partial)** role attribution and colour: PHASE_ROLES map each turn-producing phase to a role carried on every raw record and turn entry → [record](<../_Archive/Shipped/Delivery.md#2026-07-29--dlv-40-d12-partial>)
- ✅ 2026-07-30 — **DLV-18** `failure-scenarios.test.ts` drives each governance behaviour against the failure it exists to prevent — every one of which happened at least once in the BUD-11 forensics
- ✅ 2026-07-30 — **DLV-19** fleet metrics computed from the session directories at request time: outcome distribution, owner decisions per session, first-pass… → [record](<../_Archive/Shipped/Delivery.md#dlv-19>)
- ✅ 2026-09-26 — **DLV-123** review-screen defects closed: cleanInlineText() keeps intra-word underscores (NOT_TESTED), a passing check shows its time in the summary… → [record](<../_Archive/Shipped/Delivery.md#dlv-123>)
- ✅ 2026-09-26 — **DLV-135** the PM server no longer freezes while Delivery works: every Docker, check and typecheck process in the in-server runtime is non-blocking… → [record](<../_Archive/Shipped/Delivery.md#dlv-135>)
- ✅ 2026-09-26 — **DLV-136** Apply no longer refuses a prepared run because of unrelated checkout edits: only the frozen candidate's own changes are held to the… → [record](<../_Archive/Shipped/Delivery.md#dlv-136>)
- ✅ 2026-10-17 — **DLV-138** Reconnect to the original delivery command → [record](<../_Archive/Shipped/Delivery.md#dlv-138>)
- ✅ 2026-10-20 — **DLV-139** Launch with one Start from ERA Steward; check readiness on the PM side — [criteria](<Delivery — Master Book.md#dlv-139>)
- ✅ 2026-10-20 — **DLV-140** Observe Steward requests before a Delivery run exists - [criteria](<Delivery — Master Book.md#dlv-140>)
- ✅ 2026-10-24 — **DLV-141** Simplify launch and show readiness check outcomes — [criteria](<Delivery — Master Book.md#dlv-141>)
- ✅ 2026-10-24 — **DLV-142** Renew saved authorization through Check readiness → [record](<../_Archive/Shipped/Delivery.md#dlv-142>)
- ✅ 2026-10-24 — **DLV-143** Retain one Start outcome and allow the bounded native model check to finish — [criteria](<Delivery — Master Book.md#dlv-143>)
- ✅ 2026-10-25 — **DLV-145** Freeze a candidate-bound UAT handover, record owner results and gate Shipped on sign-off — [criteria](<Delivery — Master Book.md#dlv-145>)
- ✅ 2026-10-27 — **DLV-147** Show Release on every unapplied verified candidate — [criteria](<Delivery — Master Book.md#dlv-147>)
- ✅ 2026-10-27 — **DLV-148** Run every item from one standing policy — [criteria](<Delivery — Master Book.md#dlv-148>)
- ✅ 2026-11-11 — **DLV-150** Deliver an item on a branch in a local worktree with host checks → [record](<../_Archive/Shipped/Delivery.md#dlv-150>)
- ✅ 2026-11-11 — **DLV-151** Start a local delivery with three checks and no pairing on loopback → [record](<../_Archive/Shipped/Delivery.md#dlv-151>)
- ✅ 2026-11-11 — **DLV-152** Enforce the four surviving guardrails in code → [record](<../_Archive/Shipped/Delivery.md#dlv-152>)
- ✅ 2026-11-11 — **DLV-153** Ship by owner merge after UAT sign-off and undo by revert → [record](<../_Archive/Shipped/Delivery.md#dlv-153>)
- ✅ 2026-11-15 — **DLV-157** Unblock local executors on Windows without an unsandboxed shell → [record](<../_Archive/Shipped/Delivery.md#dlv-157>)
- ✅ 2026-11-15 — **DLV-158** Open retained Local deliveries without full diff inspection → [record](<../_Archive/Shipped/Delivery.md#dlv-158>)
- ✅ 2026-11-15 — **DLV-159** Let supervisor Git steps outlive the commit hook → [record](<../_Archive/Shipped/Delivery.md#dlv-159>)
- ✅ 2026-11-15 — **DLV-160** Name the real cause of every failed Local run → [record](<../_Archive/Shipped/Delivery.md#dlv-160>)
- ✅ 2026-11-21 — **DLV-164** Let a Local Claude session ask the owner, with recommended answers, in chat → [record](<../_Archive/Shipped/Delivery.md#dlv-164>)
- ✅ 2026-11-21 — **DLV-165** Park Local sessions on questions, chat with the agent both ways, and let Codex ask → [record](<../_Archive/Shipped/Delivery.md#dlv-165>)
- ✅ 2026-11-22 — **DLV-166** Run a Local candidate from its Test steps page → [record](<../_Archive/Shipped/Delivery.md#dlv-166>)
- ✅ 2026-11-22 — **DLV-167** Merge a tested Local candidate's files into the main checkout → [record](<../_Archive/Shipped/Delivery.md#dlv-167>)
- ✅ 2026-11-22 — **DLV-161** Recover Ship, Undo and locks, and clean up closed attempts → [record](<../_Archive/Shipped/Delivery.md#dlv-161>)
- ✅ 2026-11-22 — **DLV-168** Take one item from Start to Pushed on one page, within a disk budget → [record](<../_Archive/Shipped/Delivery.md#dlv-168>)
- ✅ 2026-11-22 — **DLV-169** Set the Local workflow defaults and stage order → [record](<../_Archive/Shipped/Delivery.md#dlv-169>)
- ✅ 2026-11-22 — **DLV-171** Restrict Local pushes to the configured destination → [record](<../_Archive/Shipped/Delivery.md#dlv-171>)
- ✅ 2026-11-22 — **DLV-170** Release closed Local worktrees and bound dependency storage → [record](<../_Archive/Shipped/Delivery.md#dlv-170>)
- ✅ 2026-11-22 — **DLV-172** Keep the next action on the same Local run page → [record](<../_Archive/Shipped/Delivery.md#dlv-172>)
- ✅ 2026-11-22 — **DLV-173** Commit and push the tested changes from the run page → [record](<../_Archive/Shipped/Delivery.md#dlv-173>)
- ✅ 2026-11-22 — **DLV-174** Recover a blocked Merge and retest the refreshed candidate → [record](<../_Archive/Shipped/Delivery.md#dlv-174>)

DW-3 conversation search/highlighting shipped 2026-07-16; removed the stale DLV-71 duplicate on 2026-09-10. This is a reconciliation, not a second implementation.

## Delivery session log

*(Delivery runner appends dated progress bullets here automatically.)*
- 2026-09-20 — **Consumption-optimization activation** (operational, no code change). Worker image rebuilt from `6342346b` (`era-delivery-v2-worker:subscriptions`, `sha256:749107ee…`; probe `task_brief_version: 1`), egress `era-delivery-egress-749107ee3705`, boundary digest `sha256:9993ae2a…` pinned into execution policy rev 6 (`runtime` only). Claude `qr-fc129a00756e` and Codex `qr-27bb9b3ac48e` requalified through `worker-qualification.mjs` (required controls met; no model call). Both executors available/permitted/qualified, subscription-only auth. PM supervisor restarted; bridge not started (production relay, Hard Rule #26) and phone bundle not deployed. No job launched; savings still unmeasured. Backups: `.delivery/v2/preparations/pre-activation-2026-09-20/`.
- 2026-09-19 — **DLV-90** V2 run `r-8e7f635c1466` · cancelled · codex gpt-5.6-luna <!-- v2:res-170c951a1030@1 -->
- 2026-09-15 — **DLV-107** V2 run `r-c1d69bb666cf` · not applied; conflicts with the current checkout · codex gpt-5.6-luna <!-- v2-apply:app-29460c358b3f@conflict -->
- 2026-09-15 — **DLV-107** V2 run `r-c1d69bb666cf` · not applied; conflicts with the current checkout · codex gpt-5.6-luna <!-- v2-apply:app-271fa2a0f86c@conflict -->
- 2026-09-15 — **DLV-107** V2 run `r-c1d69bb666cf` · not applied; conflicts with the current checkout · codex gpt-5.6-luna <!-- v2-apply:app-bf21902e6f34@conflict -->
- 2026-09-15 — **DLV-107** V2 run `r-c1d69bb666cf` · not applied; conflicts with the current checkout · codex gpt-5.6-luna <!-- v2-apply:app-86273c8b4971@conflict -->
- 2026-09-14 — **DLV-107** V2 run `r-c1d69bb666cf` · rolled back; candidate still available · codex gpt-5.6-luna <!-- v2-apply:app-8c52911738e3@rolled-back -->
- 2026-09-14 — **DLV-107** V2 run `r-c1d69bb666cf` · applied; integrated checks passed · codex gpt-5.6-luna <!-- v2-apply:app-8c52911738e3@applied -->
- 2026-09-14 — **DLV-107** V2 run `r-c1d69bb666cf` · candidate verified; not applied · codex gpt-5.6-luna <!-- v2:res-500b1d053638@5 -->
- 2026-09-14 — **DLV-107** V2 run `r-c1d69bb666cf` · not verified (criterion, disposition) · codex gpt-5.6-luna <!-- v2:res-500b1d053638@4 -->
- 2026-09-14 — **DLV-107** V2 run `r-c1d69bb666cf` · not verified (criterion, disposition) · codex gpt-5.6-luna <!-- v2:res-500b1d053638@3 -->
- 2026-09-14 — **DLV-107** V2 run `r-c1d69bb666cf` · not verified (criterion, disposition) · codex gpt-5.6-luna <!-- v2:res-500b1d053638@2 -->
- 2026-09-14 — **DLV-107** V2 run `r-c1d69bb666cf` · not verified (criterion, disposition) · codex gpt-5.6-luna <!-- v2:res-500b1d053638@1 -->
- ✅ 2026-08-22 — **DLV-94** REVIEWING/UAT no longer crashes when permissive nested arrays arrive as JSON strings: review `findings`/`acceptanceCriteria`/`openQuestions` and UAT `acceptanceCriteria`/`manualSteps`/`deviations`/`followUps` are normalized at their structured-output boundaries, acceptance reconciliation defensively normalizes claims before filtering, and a fake-driver regression reaches `UAT_READY` with both phases stringified.
- 2026-08-06 — **DLV-86** delivery session `s-20260806-224840-o8xj` ended **paused — needs a decision** at NEEDS_DECISION. 0 file(s) changed. · finish package: `.delivery/sessions/s-20260806-224840-o8xj/artifacts/finish/summary.md`

## Successor Briefing

**2026-09-15 lifecycle correction:** Done records local implemented scope, UAT records owner acceptance, and only remaining engineering belongs in the checklist. DLV-120/121 own protected logs and artifact paging; DLV-108/109/113/114 remain unfinished runtime work. Owner trial IDs retain criteria with `Execution: owner`; do not Deliver them. PM Tooling R65 verifies guards and history navigation with 800 passing tests and 28 browser observations.

**2026-09-15 entry point:** the review UI now has an actual responsive browser witness and the two owner-requested documents. Restart `pnpm pm` before reviewing the new candidate projection; then follow [Delivery UAT](<../../../docs/Delivery-UAT.md>). Keep all pending device/provider/stream/cap/recovery acceptance explicit. The previous hotfix design remains the broader contract, but do not rebuild the newly implemented tabs, plan reader or check grouping.

**2026-09-14 update:** begin with the [first-run hotfix](<../_Archive/Plans/Delivery First-Run Hotfix (2026-09-14).md>). The DLV-107 owner trial now exists and was applied then rolled back; older readiness statements below are historical. Do not rerun it to diagnose issues already evidenced. Implement DLV-119 accounting and DLV-115 rollback confirmation first, complete DLV-112 evidence UI, then DLV-114 enforcement and the bounded review/usability packets. No code fix was implemented by this planning audit. R55/R64 carry item history and responsive surfaces. Preserve the actual run, raw usage and uncommitted checkout; never delete the restored Work.tsx.

Phase 6's operating-trial ledger is under DLV-102 and stays pending until real runs exist; the dashboard reads attempts from the V1 session list and V2 run summaries (which now carry `resources`). Command Center Phases 0, 3 and 4 code are in place; Phase 3 and Phase 4 acceptance are not. Phase 4 next steps are the owner's: run `migrations/2026-09-12_pm-v2-relay.sql` (inspection first) and walk [PM Relay Setup](<../../06 - Setup & Onboarding/PM Relay Setup.md>) on a real phone; start from `scripts/pm/relay.mjs`, `src/features/pm-live/relay/` and `scripts/delivery-v2/apply.mjs` with `tests/pm-relay.test.ts`, `tests/pm-live-relay.test.ts` and `tests/delivery-v2/apply.test.ts`. Nothing can dispatch until an executor qualifies — the open boundary is an egress the battery can observe (DLV-96) — and the owner installs a policy `runtime` section, credential volumes and DEC-14 amounts. Then DLV-98's native baseline and DLV-99's pilot are the next real evidence, run separately for Claude and Codex. Start from `scripts/delivery-v2/journey.mjs` and `tests/delivery-v2/journey.test.ts`. Read the checklist, the selected acceptance entry and its dependencies; then use the [Feature Map](<../../01 - Architecture/Feature Map/_index.md>) for source routing and the module architecture docs for invariants. Delta from the source cutoff before implementation. Use current owner-supplied DB evidence for access/application questions; agents never apply production SQL. Record code, applied migration and device/runtime acceptance separately.

Finish with the repository playbook and [governance](<../_Conventions.md>): update acceptance/evidence, sweep only completed work, and validate the canonical queue. A completed child does not complete its coordination parent.

**Recovery validation receipt (2026-10-17):** Broad deterministic suite: 1,108 passed, 8 opt-in tests skipped. Additional final targeted/UI checks and TypeScript/ESLint results are retained in `.tmp/delivery-recovery-20261017/`. KIT oracle 12/12; actual ESLint baseline control detects all 16 missing client mutation warnings with unaffected read/safeFetch/server cases. No live environment, provider or phone evidence. The browser tool reports no available browser; mobile visual acceptance remains Pending.

**Operational preparation attempt (2026-10-17; DLV-133 / DLV-137, blocked):** Owner authorized the exact recovery packet, with R44 launch reserved for ERA Steward. All 2,736 frozen/checkout input hashes and the recipe key matched. The existing pinned image, offline non-root permission/tool probe and registry-only proxy checks passed. During the single cold attempt, packet compatibility inspection found that proposed policy command `fetch-guard` (`/candidate`) has no matching oracle ID/argv in the recipe receipt contract: self-test and baseline-control entries do not satisfy the current readiness check. This is a packet/integration defect, not successful qualification. The owned installer was deliberately stopped (exit 137 after its 10-second stop grace); its proxy/container cleanup completed, and its partial dependency volume and logs were retained. No reusable receipt was published; warm verification, qualification and activation were not attempted. Evidence: `.tmp/delivery-recovery-20261017/operational/preparation-report.json` and `policy-recipe-compatibility.json`.

The current service (PID 24212, already running before preparation) reports `ready: false` and owner tests pending for applied run `r-fa5c81702ec7`, application `app-d34c1586e1d3`. No result was recorded on the owner's behalf. Detailed authenticated run inspection returned 401 and no connected browser was available, so restart safety and bridge reconnect remain unverified. The local relay journal's two capture commands are reported; this does not establish delivery-job quiescence. Policy, local-auth/pairing, installation identity and command-journal hashes remained unchanged. No server restart, old-volume replacement, WAL/SHM deletion, R44 launch, plan approval or Apply occurred. DLV-133/137 remain open; DLV-138 implementation evidence and independent DLV-118 ownership are unchanged.

**Preparation contract correction (2026-10-17; local engineering only):** DLV-133 now preflights the proposed `recipe.policyFile` against the oracle executable, protected input hashes and exact required assertion counts before any Docker call or evidence-directory creation. A pinned synthetic positive fixture runs the ordinary `fetch-guard` command with `/candidate` and all 36 assertions; it replaces the preparation API self-test, retaining five offline oracles and the existing missing-guard baseline control. The positive fixture is mounted read-only from owned inputs, never written into the checkout's actual ESLint configuration. The environment key and receipt bind the check contract and fixture bytes. DLV-137 consumes the same contract at readiness; ordinary protected checking also refuses reduced, skipped or extra assertion counts while preserving actual exit/count evidence. Local regressions cover mismatches before provisioning, receipt tampering, real CLI behavior and readiness drift. Corrected identities and validation are retained under `.tmp/delivery-recovery-20261017/`; original proposal, partial volume and logs remain preserved. No installation retry, policy activation, server restart or R44 launch is part of this correction. Existing network, resource, security, model and owner-approval bounds are unchanged; live environment qualification and authenticated restart reconciliation remain pending.

**Recovery timing validation (2026-10-18; DLV-133 validation tooling, DLV-137 consumption):** A controlled full-suite comparison reproduced two of the five prior Delivery/build deadline failures with Vitest's default 19 workers on this 20-logical-CPU laptop. CPU utilization averaged 89% and free memory fell to 2,413 MB. `vitest.config.ts` now bounds scheduling to two workers; the identical 4,096 test identities then produced **4,072 passed / 24 skipped / zero failed** across 259 files, including all five previously affected cases. CPU utilization averaged 49%, minimum free memory was 5,354 MB, and elapsed time increased from 57 to 133 seconds. Assertions, five-second deadlines, test membership and paid-API blocking are unchanged. No surviving test worker was found; the remaining esbuild process belongs to the existing PM server. This supports resource contention as the demonstrated timeout cause; it does not certify live provider or phone behavior. Current typecheck, changed-config ESLint and KIT-11 oracle (12/12) pass. Complete A/B logs, JSON test identities, resource samples, process classification and exit codes are retained in `.tmp/delivery-recovery-20261018/`. The original failed acceptance evidence is preserved; the two Radix/generated-QA lint errors remain paused maintenance, and no owner acceptance result was recorded.

**Bounded operational attempt (2026-10-18; DLV-133 blocked, DLV-137 still closed):** Before downloads, the corrected executable/oracle/required-assertion/policy contract, immutable image and 2,737 current frozen compiler inputs passed preflight, with declared generated-type pins unchanged. Attempt key `sha256:209333465d834a59c49de6e8d68c3356fc5c106bbf5817fa196e0d55e42fdf9b`; compiler fingerprint `sha256:bdce0dff8b5762432f3c00449d9b80dba82d336afcffb83ba1a0e9840fad8eb6`. The registry-only, scripts-disabled install exited zero after 10m 11.2s. Inventory then found four dangling links to two absent packages: `@openai/codex@0.144.1-linux-x64` and `@anthropic-ai/claude-agent-sdk-linux-x64-musl@0.3.207`. Read-only inspection confirms Linux x64/glibc and that neither target was in pnpm's platform-skipped list. The underlying optional fetch/import failure is unknown: the default reporter retained no diagnostic for it. Do not classify the missing Codex native package as an irrelevant foreign-platform dependency or waive the inventory gate.

The attempt exited one, published no environment receipt, retained its failed dependency volume, and confirmed cleanup of all its owned containers/input volume; no historical source volume was replaced. Warm verification, offline compiler/oracle controls, fresh qualification, activation and restart were not performed. The historical partial volume is also still present. Numbered raw operations, complete install output, inventory and outcome are copied into `.tmp/delivery-recovery-20261018/cold-evidence/`. No automatic retry is authorized by this exhausted one-attempt allowance.

**DLV-133 diagnostic correction after the attempt:** The existing installer now selects pnpm's NDJSON reporter so transitive optional-dependency failure events are retained. Network, installation behavior, retries (zero), deadlines, inventory assertions and receipt gates are unchanged. A new deterministic regression preserves an optional fetch diagnostic after a zero installer exit while refusing an incomplete tree and publishing no receipt. Environment/readiness regressions: **50 passed**; final source typecheck and changed-file ESLint pass. The last full-suite run above preceded this logging-only correction; no claim is made that another full suite ran afterward. Final source-bound local preflight passed with key `sha256:c7043add477bd8516dc3585a33a79ab4bb556d23b16952669528d73175fed3e1`, compiler fingerprint `sha256:c2fe925943ce1bdba31d38b37c353bec574754b06d325704351c659977d1fda7`; `.tmp/delivery-recovery-20261018/operational-source-final/` is unexecuted and unactivated. The attempted recipe/evidence retain their original identities.

**DLV-137 operational visibility:** The existing `pnpm pm --bridge` process was not stopped or replaced by this work. Public served JS/CSS match a fresh current-source build byte-for-byte, and its passive R44 readiness endpoint reports `ready: false`, revision 7, missing managed environment/required checker configuration and owner tests pending for `r-fa5c81702ec7` / `app-d34c1586e1d3` (`record: null`, locked). Those are observations of the running server, distinct from deterministic source tests. The browser inventory was initially empty after connection/setup confirmations, then Chrome became available later in this session. Authenticated inspection of the existing paired tab succeeded: KIT-11 is Applied, the service-backed queue shows writers 0/1 and jobs 0/1, and pending BUD-83 Apply / DLV-107 Conflict decisions remain untouched. All 21 earlier entries were visible (3 to apply, 2 applied, 16 cancelled); no active/uncertain entry was displayed. Settings exposes Tests after Apply for the exact KIT-11 run with Passed/Failed controls; neither was clicked. A separate direct API navigation was refused by cross-site protection; no bypass was attempted. The existing tab was restored to its KIT-11 session. No further browser setup is currently required. This snapshot does not certify safety for a later restart: repeat complete reconciliation immediately before it. Bridge reconnect and physical phone observations remain unverified because the environment prerequisite failed and no restart followed. No auth credentials were requested, pairing reset, owner acceptance recorded, plan approved, R44 launched or Apply performed. DLV-138 and independent DLV-118 ownership are unchanged.

Correction validation: **1,124 passed, 8 opt-in skips**, TypeScript and scoped ESLint clean, PM lint/documentation checks pass. The exact old mismatch is rejected with zero Docker calls. Final corrected artifact directory: `.tmp/delivery-recovery-20261017/operational-corrected-final/` (`contract-correction.json`, `validation.json`, recipes and proposed policy/diff); environment key `sha256:30b8db4dc87728c6d68503d12aa9011799729365306b86ad036e8b5b75f9bc77`, compiler fingerprint `sha256:40bb65e55b4e3c39368060a40c68964722ca116a64613ae65080607add6a82ba`, 2,737 files. No environment receipt exists yet. Earlier corrected draft is superseded; original operational evidence is historical and unchanged.

**2026-10-18 final bounded recovery outcome:** Attempt 3 proved a complete installed tree (79,882 entries; no inventory errors), both pinned native executables and KIT-11. The post-install Windows ENAMETOOLONG defect is fixed by bounded stdin transport and strict evidence-bound verifier continuation; no fourth installation ran. Full-program positive compilation then exhausted default, 3 GiB and final 3.5 GiB V8 heaps within the unchanged 4 GiB cgroup. Final failure was at about 116 seconds, before the 270-second deadline. No reusable receipt, warm reuse, fresh qualification or policy activation succeeded. All owned verification containers/input volumes were cleaned up; original evidence and dependency/store volumes remain retained. The three full preparations are consumed and automatic compiler retries stopped. A proposed checker-only 8 GiB / 6 GiB heap amendment is unapproved; it authorizes nothing by itself. Environment key remains `sha256:f5bb91d82cc64249fc446a56a12a4eca3831e03ee8217e717e2824ab4b5e37d3`. Ledger: `.tmp/delivery-recovery-20261018/continuation/progress.json`.

Final affected evidence: 1,245 passed / 8 opt-in skips in the completed broad JSON report; its PowerShell harness subsequently failed on Node’s SQLite warning, with child exit unknown (retained, not rerun). The final compiler-profile value passed 205 affected tests, typecheck and scoped lint with exit 0; 238 source hashes stayed stable. The earlier 1,242-test transport suite had exit 0. No final full-repository rerun or operational success is inferred. Final bridge reload at 08:01 UTC established one server (PID 32136) after authenticated zero-work reconciliation, preserved policy/installation/journal identities and paired access, and loaded final source. The owner recorded KIT-11 Passed and confirmed the physical phone online with the same Applied run after this final reload. Desktop/service CLI share the blocked exact R44 selection; policy remains revision 7. The earlier pinned native catalog did not advertise gpt-6-luna/low; current availability and entitlement remain unresolved. No new R44 run, plan approval, candidate, provider job or Apply exists. DLV-133/137/138 remain open; DLV-118 and Radix cleanup are unchanged.

**Approved memory pass and JSX closure correction (2026-10-18; current outcome supersedes the preceding checkpoint):** The owner approved one 8 GiB checker / 6 GiB V8-heap pass; that pass is consumed. The compiler completed without OOM but failed TS2307 for the omitted `InboxView.jsx` and consequent TS7006. The reusable snapshot collector now includes JSX. A real TS → JSX → JS regression, missing-JSX negative control and strict source-extension guards passed; final affected checks are **213 passed, zero skipped**, typecheck and scoped lint exit 0, with 238 source hashes stable. The new 2,777-file snapshot preserves all 2,742 original files and adds 35 JSX inputs. Target key `sha256:9bb44cfa24821cbf69d772e1db82e349550e94d33d7abdfb484c5347e0392d53`; old `f5bb91…` evidence and complete installed volume remain intact. No receipt, warm verification, fresh qualification or policy activation exists. Three full preparations remain consumed. One additional verifier-only pass at unchanged amended limits is prepared but awaits explicit owner approval; ordinary preparation would be an unauthorized fourth installation. No provider job, substitute model, R44 implementation or Apply occurred.

At 08:26 UTC, the bridge was reloaded onto the corrected source as one process (PID 21780 on 4317). A second independently started process on 4318 was first detected by the aborting restart guard; authenticated inspection of both proved the same 21 deliveries, Tests passed, no open tasks and zero jobs/writers. Both idle processes were then reconciled and consolidated while preserving policy, installation and journal hashes. Paired desktop access, KIT-11 Applied and owner Passed survived. The prior phone confirmation applies to the 08:01 reload; confirmation after 08:26 is pending. The passive service CLI still refuses exact R44 with seven concrete blockers under policy revision 7. Native gpt-6-luna/low availability remains unresolved. DLV-133/137/138 remain open. Ledger and detailed evidence: `.tmp/delivery-recovery-20261018/continuation/progress.json`.

**DLV-133 operational recovery proved; native selection blocks the pilot (2026-10-18, 11:55 Beirut):** The explicitly approved JSX-corrected verifier pass succeeded (285.561 s). Environment `sha256:9bb44cfa24821cbf69d772e1db82e349550e94d33d7abdfb484c5347e0392d53`; receipt `sha256:7c08408c6a1270400106be0ba44d17ec4edd5f40b95e22ba0c5d183bb043ec0b`; 2,777 frozen files and complete unchanged installed inventory. All required native checks, genuine full-program positive/TS2322-negative, KIT-11, 36-assertion R44 fixture and missing-guard baseline controls passed. Warm reuse passed in 18.331 s with the same receipt, no reinstall/download/provisioning. Fresh `qr-99b636350f8a` qualification passed worker and checker with valid negatives, no unverified controls and successful admission. Previous 15 receipts are unchanged; raw evidence, reuse recipe and frozen program are retained. All owned temporary resources are confirmed cleaned up; old dependency assets remain.

Fresh metadata through that qualified boundary authenticated the included ChatGPT subscription (primary usage window 28% used, reset/duration unknown), but pinned native Codex 0.144.1 does not advertise exact gpt-6-luna/low in its complete hidden-inclusive catalog. This does not establish universal model unavailability; catalog origin and account entitlement remain unknown. The native gate remains closed, with zero provider turns/jobs and no fallback. Policy remains revision 7 and the old R44 experiment is untouched. The owner confirmed the physical phone online and the same Applied KIT-11 after the 11:26 bridge reload. Exact R44 desktop/mobile/CLI/dispatch parity under an activated new policy, real Dot initiation, phone plan approval and verified candidate remain unproved. DLV-133/137/138 stay open for their remaining delivery integration. No fourth installation, further verifier pass or version/model change is authorized. Current ledger: `.tmp/delivery-recovery-20261018/continuation/progress.json`; compact result: `qualified-outcome.json` beside it.

**Native catalog diagnosis (2026-10-18, 12:10 Beirut; supersedes the preceding availability checkpoint):** The owner reports GPT-6 Luna offered in the normal same-account CLI. Metadata inspection found three installed client versions: the qualified Linux worker is 0.144.1, the npm Windows CLI is 0.145.0, and the VS Code bundled binary is 0.162.0-alpha.17.2. Both older clients successfully returned refreshed catalogs containing `gpt-5.6-luna` but no exact `gpt-6-luna`; the newer binary advertises exact `gpt-6-luna` with `low` in both bundled and refreshed catalogs. The worker also refused the exact selection after an explicit refresh in the same temporary home. This supports a client-version catalog mismatch; newer-host evidence does not qualify the worker or prove inference entitlement. All diagnostics used zero provider turns, exposed no credentials and left no diagnostic container. [OpenAI release 0.156.1](https://github.com/openai/codex/releases/tag/rust-v0.156.1) explicitly adds GPT-6 Sol/Luna to the catalog. An exact SDK/CLI/native 0.156.1 amendment is prepared in `.tmp/delivery-recovery-20261018/continuation/codex-version-amendment.json`, with a separate manifest/lock diff based on eight public SRI metadata records and byte-identical unrelated lock content. No package payload was downloaded, active manifest/lock changed, image rebuilt or environment reinstalled. The owner must approve this exception to the no-upgrade and three-preparation limits: one isolated replacement runtime/image, one additional full preparation, cold/warm verification and fresh qualification under unchanged resource/confinement limits. Stop on failure; no automatic retry. Until approval, the existing qualified environment and receipt remain preserved, policy stays revision 7, provider jobs stay zero and there is no new R44 run or phone plan. DLV-133/137/138 remain open; the owner-confirmed bridge/phone reconnection and KIT-11 Passed decision remain valid.

**Approved version amendment and image assembly checkpoint (2026-10-18, 13:05 Beirut):** Owner-approved 0.156.1 pins and three SRI-verified Linux payloads are retained. The exact native `gpt-6-luna / low` metadata preflight passes with included ChatGPT usage and zero turns. The new cache-write usage counter is preserved without double counting. The sole approved image build failed before image creation because BuildKit resolved the local config SHA as a registry name. Its failed attempt is consumed. The tested local Engine copy/commit correction awaits ONE additional image assembly approval; no new downloads or resource increases are requested. The next 2,783-file compiler program is frozen. Fourth preparation, cold/warm verification, fresh qualification and activation have not started; prior qualified assets, policy revision 7, pairing, journals and old runs remain preserved. No new pilot/provider job/Apply. Full evidence and limits: `docs/Delivery-UAT.md` latest checkpoint and `.tmp/delivery-recovery-20261018/continuation/{progress,image-assembly-correction}.json`. DLV-133/137/138 stay open.

Final checkpoint validation: **313 passed, zero skipped**, typecheck and scoped ESLint exit 0; 247 source hashes stable. PM lint and documentation checks pass; archive found nothing to sweep. All 15 earlier qualification receipts and the old 2,777-file frozen program remain unchanged. The new 2,783-file program verifies against its own manifest. Latest shared included-usage observation was 41% used at 09:57 UTC (reset/window duration unknown; not task-attributed usage). The live new-selection preflight used zero provider turns. Compact evidence: `.tmp/delivery-recovery-20261018/continuation/image-correction-checkpoint.json`.

**Qualified Codex 0.156.1 environment and policy activation (2026-10-18, 13:37 Beirut; supersedes the preceding assembly checkpoint):** The owner approved the corrected local Engine assembly, which succeeded without BuildKit or new downloads. Image `sha256:6926e678e4aea4991cd6efcccb92036be01caf7e424c2467936fe319e4b279b6` passed complete package/source/native verification. The fourth and final full preparation passed in 936.609 seconds; frozen-lock installation itself finished in about 579 seconds. Environment `sha256:e7a4f34389bbe22a9218ee4eb6d25b42e5038001fe31cdae9ad5338012fe201d`, receipt `sha256:ce7fab27a9f84ea2b391161cab95a397d79c400726730fde0c25f697e6095b63`, inventory `sha256:69fcdac5f473cafbcfc8797b6be9c96f81bc4d3371036dfecdeeebcc281fdcc1`. All 2,783 frozen files, required native executables, full-program positive and genuine TS2322-negative controls, KIT-11 (12), R44 fixture (36) and missing-guard baseline control (1) passed. Warm reuse took 20.379 seconds, retained the same receipt, and made no install/download/provisioning. Fresh qualification `qr-2da339070c21` passed worker and checker with valid negative controls and no unverified controls. Exact native `gpt-6-luna / low` is advertised through the qualified boundary; included ChatGPT usage is available, extra spend is disabled, and inference entitlement remains unproved because provider turns/jobs remain zero.

The reviewed R44-only policy revision 8 was installed after fresh authenticated reconciliation of 21 deliveries, zero jobs/writers/open tasks and the owner-recorded KIT-11 Passed gate. The normal bridge reloaded at 10:37 UTC as one process (PID 46008 on loopback port 4317), preserving installation/pairing, journals and 247 tested source hashes. A PowerShell array-shape preflight error was corrected before any stop or policy write; the guarded reload then succeeded. The policy expires at 2026-10-19T09:47:30.763Z and permits only the reviewed two-file scope, one planning and one implementation job, no automatic repair and a verified-candidate ceiling. Old environment/receipts/runs remain retained. Full preparations are 4/4 consumed; both authorized image assemblies are consumed. Installer/workers retain 4 GiB and checker 8 GiB/6 GiB heap; CPU/PIDs/storage/deadlines are unchanged. Service readiness, actual phone confirmation after this reload, real ERA Steward initiation, owner phone plan approval and the actual R44 candidate still require operational evidence. No new R44 run or Apply exists. The single current ledger is `.tmp/delivery-recovery-20261018/continuation/progress.json`; raw environment evidence is in `operational-codex-01561-corrected/` beside that directory.

DLV-133/137/138 remain open for the real delivery integration and pilot. Final source checks remain 313 passed, zero skipped, typecheck and scoped lint clean; no code changed during these operational steps. DLV-118 and Radix cleanup remain independent.

**Live readiness timing correction (2026-10-18, 13:49 Beirut):** Activation exposed a real service integration defect: passive inspection read each compiler-tree member twice, while multi-step probe facts all aged from the probe start. A local inspection took 5.535 s and a queued service GET took 12.303 s, exceeding the unchanged 8 s CLI request bound; the first live refresh became stale and correctly kept Start disabled. The reader now reuses the hashes from its current trusted tree walk, with no cross-call content cache and explicit linked-root rejection. Regression coverage proves changed/added/removed files invalidate the next observation. Each runtime/environment/authentication/model fact now retains its own observation time; old facts still expire and the freshness window is unchanged. The comparable local inspection fell to 2.790 s, with file reads falling from 5,652 to 2,885. Final affected regression: **316 passed, zero skipped**, typecheck/scoped lint clean, 247 source hashes verified. The host readiness correction changes no worker/checker launch flags, package pins, image, dependency receipt or qualification binding. The 2,783-file frozen program and all 15 prior qualification records remain unchanged. No extra image, installation, cold/warm or qualification pass occurred.

Fresh authenticated reconciliation again proved 21 deliveries, no open/uncertain work, zero jobs/writers and the owner Passed gate. The normal bridge reloaded at 10:49 UTC as one process (PID 27284), preserving policy revision 8, pairing and journal hashes. The corrected service CLI returned **Ready**, zero blockers, exact R44/Codex/gpt-6-luna/low/focused in 4.502 s; desktop Start became enabled after automatic reconnection. The selected executor badge now consumes that same current readiness projection, instead of the passive catalog's intentionally unprobed qualification field. Existing UI readiness/command-recovery tests add **9 passed, zero skipped**. Actual phone confirmation after the 10:49 reload, real ERA Steward initiation, phone plan approval and the verified R44 candidate remain pending. No new R44 run, provider job or Apply exists. Evidence: `readiness-correction-validation.json`, `readiness-corrected-cli.raw.utf16` and `readiness-restart-after.json` in `.tmp/delivery-recovery-20261018/continuation/`; current state remains in `progress.json`.

**Responsive readiness closure (2026-10-18):** The subsequent live check still found false Offline transitions: synchronous compiler traversal could delay the unchanged 3-second health probe. Passive compiler inspection now runs in a bounded read-only worker thread; concurrent readers share only the current in-flight snapshot, and the next call rereads files. Worker exit is confirmed before returning; failures and generated-input mismatches block readiness. The worker has a 128 MiB old-generation cap, 4 MiB stack and 15-second termination deadline. An initial import-cycle failure was caught by tests and corrected before reload. Final recovery/UI regression: **327 passed, zero skipped**, typecheck and scoped lint clean. The first parallel comparison retained one 6.184-second large-file-fixture timeout; serial scheduling passed with all original assertions/deadlines unchanged. The worker/checker image, dependency environment, qualification binding and original 2,783 frozen files remain unchanged; no additional installation, assembly or qualification occurred.

The normal bridge reloaded at 2026-10-18T11:02:37.2361757Z as one process (PID 16144), after fresh authenticated idle reconciliation, preserving pairing, command journal and policy 8. Exact R44/Codex/gpt-6-luna/low/focused service CLI returned Ready in 5.106 s; all 12 simultaneous health requests passed their 3-second deadline (maximum 125 ms). Desktop/mobile-width observations are retained separately; physical-phone confirmation after this final reload, actual ERA Steward initiation, owner phone plan approval and the verified candidate remain pending. New pilot/provider jobs: zero. Evidence: `.tmp/delivery-recovery-20261018/continuation/async-readiness-validation.json`, `.tmp/delivery-recovery-20261018/continuation/live-responsive-readiness-1792321445791.json`, `.tmp/delivery-recovery-20261018/continuation/async-readiness-restart-after.json`; continuation authority: `.tmp/delivery-recovery-20261018/continuation/progress.json`.

**Owner handoff confirmation (2026-10-18, 14:08 Beirut):** The owner confirmed the existing physical-phone Command Center shows ElioLaptop online and KIT-11 `r-fa5c81702ec7` Applied after the final 11:02:37Z bridge reload, closing AC3. The owner also reported sending ERA Steward the exact one-pilot instruction. This confirms message transmission only; actual Dot initiation, new run identity, phone plan approval and verified candidate still require PM evidence. At the first post-handoff inspection, the authenticated queue remained at 21 deliveries, zero jobs and zero writers. Continuation: `.tmp/delivery-recovery-20261018/continuation/progress.json`.
