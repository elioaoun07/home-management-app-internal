# ERA Steward task observability — DLV-140

Implemented locally on 2026-10-20 over checkout HEAD `f2f127b1`. This is supervised Codex source work, not a Delivery pipeline run. The checklist and [Delivery Master Book](<../ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md#dlv-140>) own DLV-140. Owner UAT and activation remain pending.

## What changed

The real Steward entry is `#/deliver/<ID>?initiator=era-steward`, also available through **Steward** on the existing launch screen. Its Start sends `initiatedBy: era-steward` through the existing DLV-138 durable command transport. Ordinary Start is not attributed to Steward.

Before checking dispatch mode, executor, readiness or admission, the service commits a coordination receipt in the existing local SQLite supervisor store. The receipt retains the authenticated actor, original command UUID, work identity, accepted/start/last-confirmed timestamps, stage and bounded transition evidence. No new table, migration, dependency, scheduler or orchestration system was added. DLV-133 still owns environments, DLV-137 readiness and DLV-138 launch identity/recovery.

The same request card appears on Delivery, the selected launch screen and the linked run page, on desktop and the shared `/pm/live` UI. It shows **Initiated by ERA Steward**, request/launch UUID, timestamps, stage, job state, known blocker, run link and evidence. Publication rides the existing runs relay row, without a relay schema or production DB change.

Each device derives **Status unconfirmed** from the coordinator's recorded timestamp, even with cached data or missed polls. `PM_STEWARD_STALE_MS` sets the service interval: default **180,000 ms**, valid integer range **1,000–86,400,000 ms**; invalid values use the default. This is distinct from readiness expiry. Polling/publication never renews the timestamp. Job progress and terminal outcomes use their own durable records and evidence clocks. Coordinator silence never changes job state, infers failure, retries work or overwrites a terminal outcome.

In Steward mode, Start may record a request despite missing setup/readiness or a locked test gate. The existing server gates still refuse admission. This lets a prelaunch blocker be visible before any run exists.

## Identity and uncertainty

- The original command UUID is the request/launch identity; a later run ID links to it.
- An identical repeated request returns its recorded outcome. Actor/payload changes under the same UUID conflict.
- A second UUID for the same pending/open Steward work is refused with the original UUID.
- An exception retains the claim and shows reconciliation required. It is not a proven failed job.
- Explicit command-status reads recover an already-committed command/run after a lost response, without constructing a runtime or journey.
- An interrupted prelaunch request with no command outcome is not automatically replayed or released. It remains visible/unconfirmed and requires owner investigation. The existing DLV-138 flow permits a corrected new request only after a confirmed refusal.
- The UI/relay publishes the newest 100 requests. Older receipts stay in the supervisor store. No retention cleanup or automatic expiry runs.

## Files created

| File | Purpose |
|---|---|
| `scripts/delivery-v2/steward-requests.mjs` | Transactional receipt claim, progress recording, duplicate protection and passive run/command reconciliation. |
| `scripts/pm/app/StewardRequests.tsx` | Shared card and independent coordinator-staleness derivation. |
| `tests/delivery-v2/steward-requests.test.ts` | Real Start route and isolated SQLite/relay recovery regressions. |
| `tests/pm-ui/steward-requests.test.ts` | Attribution, timestamps, stale boundaries and preserved known/terminal states. |
| `tests/pm-ui/steward-entry.test.ts` | Actual launch component: Steward can record missing setup while ordinary Start stays gated. |
| `docs/ERA-Steward-Observability-Implementation.md` | This implementation and handover report. |

## Existing files changed by this task

| Files | Change |
|---|---|
| `scripts/delivery-v2/entry.mjs` | Wrap existing Start with the durable Steward claim, persist refusals/uncertainty, expose request-aware command status and runs response. |
| `scripts/delivery-v2/service.mjs` | Existing-store request publication and explicit command reconciliation. |
| `scripts/delivery-v2/store.mjs` | Queries over existing receipts and the latest run-event reference; no schema change. |
| `scripts/pm/bridge.mjs` | Carry requests in the existing runs row; reconcile prelaunch outcomes through the existing command journal. |
| `scripts/pm/app/Delivery.tsx`, `DeliveryV2.tsx` | Integrate cards, explicit Steward entry and prelaunch recording behavior. |
| `scripts/pm/app/delivery.css` | Wrapping responsive cards using the existing theme variables. |
| `scripts/pm/app/types.ts`, `transport.ts` | Shared request projection in the runs response. |
| `src/features/pm-live/relay/transport.ts` | Carry the same request records through live and saved phone data. |
| `tests/pm-live-relay.test.ts` | Verify live/cached request identity and timestamps survive relay reads. |
| `docs/ERA-Steward-Runbook.md` | Actual initiation URL, recovery procedure, liveness semantics and interval configuration. This runbook was already untracked when this task began. |
| `docs/ENV.md` | Document the optional coordinator-silence interval. |
| `ERA Notes/01 - Architecture/Feature Map/cross-cutting/pm-command-center.md` | Route intent to the implementation and tests. |
| `ERA Notes/04 - UI & Design/Page & Feature Atlas/pm.md` | Document the existing launch entry and shared status surface. |
| `ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md`, `4 - Checklist.md` | Register/close DLV-140 with local evidence and owner-UAT limits. |

Existing overlapping DLV-139/readiness and unrelated Chores/Schedule work were preserved. No changes were made to installed policy, application/production data, Docker resources, retained snapshots, recovery evidence, cancelled/old R44 artifacts or the pre-existing Atlas JSON changes. No service was restarted; no provider job, R44 launch, Apply, commit, push or deployment occurred.

## Verification results

All database fixtures were under a fresh test-owned directory inside `.tmp/dlv-140/test-temp`; no operational store was used. Tests retained `tests/setup/blockPaidApis.ts`. Docker/environment witnesses were disabled for the aggregate run. No package installation or environment repair was performed.

| Check | Actual result | Evidence |
|---|---|---|
| Scoped final regression: Steward server/UI/entry, command intents, pilot entry, phone relay and bridge relay | **103 passed, 7 files**, exit 0 | `.tmp/dlv-140/scoped-tests-final.log` |
| Delivery V2 + PM UI + bridge/relay/query/derive aggregate | **1,383 passed, 8 failed, 8 skipped; 98 files**, exit 1 | `.tmp/dlv-140/aggregate-tests.log` |
| `pnpm typecheck` | **Passed**, exit 0 | `.tmp/dlv-140/typecheck-final.log` |
| Scoped ESLint over changed code/tests | **Passed**, no warnings/errors | `.tmp/dlv-140/scoped-lint-final.log` |
| `pnpm pm:build-app` | **Passed**, 1,098,334 B JS + 233,559 B CSS | `.tmp/dlv-140/build-app.log` |
| `pnpm lint` | **Failed**, exit 1: 6,364 errors / 8,146 warnings across source and scratch/history artifacts; changed-file lint remains clean | `.tmp/dlv-140/lint-aggregate.log` |
| `pnpm pm:lint` | **Passed**, 0 errors / 0 warnings | `.tmp/dlv-140/pm-lint-final.log` |
| `pnpm pm:check-docs` | **Failed**, exit 1: 15 existing historical recovery-evidence links in the Delivery Master Book | `.tmp/dlv-140/pm-check-docs-final.log` |
| `pnpm docs:check` | **Passed**, Feature Index matches Feature Map | `.tmp/dlv-140/docs-check-final.log` |
| Archive workflow | **Passed**, only DLV-140 swept; original undo journal unchanged; CLI then found nothing to sweep | `.tmp/dlv-140/archive-receipt.json` |
| `git diff --check` | **Passed**, exit 0 | `.tmp/dlv-140/diff-check-final.log` |
| Browser/device visual walkthrough | **Not run**: available-surface inventory returned `apps: []`, `browsers: []` | Computer-use inventory in task transcript |

The aggregate ran before the last two added regression cases; the final scoped run covers those cases and the final behavior changes. The aggregate's eight failures are in unchanged tests: five fixture failures caused by denied Windows links/junctions (`apply`, `checker-program`, `compiler-input`, two `isolation` cases), and three `pm-ui/health` requests denied with `connect EACCES 127.0.0.1:<fixture-port>`. No test was weakened, bypassed or newly skipped. The eight skipped tests are existing opt-in operational witnesses, not new skips.

Initial verification also exposed a sandbox EPERM on Vitest's default temporary-file rename before test collection. A process-local `TEMP`/`TMP` pointing at `.tmp/dlv-140/test-temp` allowed normal fixture execution; no installed/global configuration changed. One initial new test used `root` instead of the relay journal's `dir`; it was corrected. A subsequent typecheck caught typing errors in the new tests/API JSDoc; these were corrected before the passing final checks.

To reproduce the scoped regression in PowerShell:

```powershell
$env:TEMP = (Resolve-Path .tmp/dlv-140/test-temp).Path
$env:TMP = $env:TEMP
pnpm exec vitest run tests/delivery-v2/steward-requests.test.ts tests/pm-ui/steward-requests.test.ts tests/pm-ui/steward-entry.test.ts tests/pm-ui/command-intents.test.ts tests/delivery-v2/pilot-entry.test.ts tests/pm-live-relay.test.ts tests/pm-relay.test.ts
```

## Manual owner scenarios — pending, not performed

This is a direct checkout change, not a frozen Delivery candidate. Evidence is bound to the files above over HEAD `f2f127b1` plus preserved checkout changes; no candidate ID, grant, run or owner approval was manufactured. Revalidate the source before activation. The current service keeps its previously loaded backend until an owner-coordinated reload; this task did not perform that reload.

Use a disposable PM checkout/fixture installation with a synthetic work item and isolated local store. Keep its policy non-dispatching for scenarios 1–3. Do not use R44 or the operational store for these tests. Physical-phone transport and any real provider run require their own owner-controlled session; the steps below do not authorize one.

1. **Prelaunch blocker/attribution:** Open `#/deliver/<synthetic-ID>?initiator=era-steward` in a paired fixture browser. Press Start once while setup/readiness is deliberately blocked. Open Delivery. Expect one **Initiated by ERA Steward** card, one UUID, accepted/start/last-confirmed UTC stamps, the known blocker and evidence, with no run/job. Refresh and expect the same card/UUID. Ordinary Start must remain gated and must not gain Steward attribution.
2. **Missed updates/staleness:** In the fixture process set `PM_STEWARD_STALE_MS=5000`. Initiate a blocked request. Keep the card open for five seconds, then disconnect the fixture relay or use its saved copy. Expect **Status unconfirmed** under Coordinator; the known blocker remains. Repeated reads must not change the recorded timestamp or create a request/job. Repeat with the default interval if desired.
3. **Uncertain response/duplicate initiation:** Use only a scripted fixture route that stalls readiness or loses the response. Press Start once; refresh/reconnect and use **Resume request / Check status**. Expect the same UUID, one server receipt, and no second admission. A second-tab/new-UUID request for the same pending work must name the original UUID. With no proven outcome, expect reconciliation required; do not clear storage or create another request to work around it.
4. **Run and terminal evidence:** With synthetic persisted run/result records (no provider), view running, completed, failed and cancelled variants. Expect the linked original run, current job stage and dated event/result references. Advance the coordinator age past the interval; expect coordinator unconfirmed beside the unchanged job/terminal result. A late coordination report must not replace the terminal result.
5. **Responsive/shared views:** Inspect the same fixture cards at desktop, 390 × 844 and 320 px widths in Blue and Pink. Expect wrapped UUID/timestamps, no horizontal overflow, usable Evidence disclosure and Open delivery link. Through the isolated relay double, compare live and saved/offline records. A physical `/pm/live` pass remains pending separately.

## Limitations and remaining boundaries

- Attribution means the explicit Steward entry was used by the recorded authenticated actor. There is no external chat-agent attestation, heartbeat agent or chat-transcript ingestion.
- Coordinator timestamps describe the launch coordination handled by this service. Job/event/result timestamps are separate; job activity cannot prove the external Steward chat is alive.
- Lost/unproven prelaunch outcomes retain their claims indefinitely for owner investigation; there is deliberately no automatic timeout release, retry or repair.
- Historical requests initiated before this change have no new attribution receipt. Old runs and R44 evidence were not backfilled.
- Real desktop clicks, live service restart/reconnect, physical phone layout, live relay publication and provider execution are untested. Server route, isolated persistence, shared render output, launch gating, cached relay and recovery behavior are fixture-tested.
- Completing source work does not activate the running service, renew policy, prepare environments or accept owner UAT.

## Final closeout checks

DLV-140 was registered, checked, swept to the Delivery Shipped Log and marked implemented with UAT pending. The existing archive engine was called only after its dry-run proved DLV-140 was the sole completed item. Its ordinary CLI journal write would replace the owner's previous undo snapshot, so the source sweep used `sweepAll()` directly, retained a task-local receipt, verified the old `.pm/last-sweep.json` hash was unchanged, then ran `pnpm pm:archive` (nothing left to sweep). No historical snapshot was overwritten.

The full lint command completed naturally. Its output includes `.tmp`, `.delivery`, historical/generated fixtures and existing source debt; this task did not alter lint policy or repair those unrelated files. An optional CIM process-inventory read (`Get-CimInstance Win32_Process`, to inspect lint progress) was denied by the sandbox; it was not retried and no process was stopped.

All 15 final PM-documentation errors refer to pre-existing `../../../../.tmp/delivery-recovery-20261018/continuation/*.json` links. Representative links were verified present in HEAD. The newly created implementation report resolved its own initially pending link. Old evidence and link text were preserved under the task boundary; no fabricated evidence file was added to silence validation.

No tests, services or helper processes remain running for this task. No permission escalation was attempted. The remaining operational step is an owner-coordinated activation and fixture/desktop/phone walkthrough, followed by any separately authorized real launch; none is claimed complete here.
