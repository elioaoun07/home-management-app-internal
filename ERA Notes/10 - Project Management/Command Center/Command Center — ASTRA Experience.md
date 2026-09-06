---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: active
owner: Elio
---

# Command Center — ASTRA Experience

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../ERA Top Layer — Master Plan (2026-09-02).md>), not a replacement roadmap. Source cutoff `3106164`; local artifacts inspected read-only on 2026-09-06. Deltas [Delivery Master Book](<../Delivery/Delivery — Master Book.md>) `updated: 2026-08-01` and [PM Tooling Master Book](<../PM Tooling/PM Tooling — Master Book.md>) `updated: 2026-08-03`; Delivery contains later August records.
>
> Read with [Architecture](<Command Center — ASTRA Architecture.md>), [Orchestration](<Command Center — ASTRA Orchestration.md>) and [Packets](<Command Center — ASTRA Packets.md>). This specifies behavior and proof, not production UI wording. Phase 3 changes only the eight study documents.

## 1 · An application earns trust by preserving intent

The existing application already has boards, filters, session details, gate controls, offline handling and history. The consequential gap is the continuity between the owner's intention, the action submitted, and the outcome later shown. A stale ordinal can select another item; a successful command can time out on the phone; an ACCEPTED session can show a BLOCKED finish package. Those are interaction failures even when each screen renders correctly (Architecture CC01, CC02, CC09).

**EXTENDS → R7 / DLV-72 / DLV-93:** repair those existing seams before adding screens. The product work this removes uncertainty from is HUB-37/E-01 verification and the bounded template-success subset of HUB-47/E-11. Preserve the owner’s existing screen structure, gate decisions and Markdown authority.

Desktop does not need another implementation of the phone toolbar. It already supports query, chips, grouping and sorting with URL state (`scripts/pm/src/features/tasks/BoardToolbar.jsx:12–41`, `boardState.js:96`). Match semantics where evidence shows disagreement; do not make visual parity a project.

## 2 · One product does not imply identical powers

| Surface | One-second read | Existing action / destination | Required degraded behavior | Docking / product unlocked |
|---|---|---|---|---|
| Local desktop board | Filtered product work and its current lane | Open item detail; local mutation or governed launch | Preserve filters after refresh. Stale item identity refuses a mutation before any file changes. Offline or incompatible data cannot authorize a write. | EXTENDS → R7/R37; HUB-37/E-01 |
| Portable `_dashboard.html` | A dated, read-only corpus snapshot | Navigate the embedded board/detail | Generation age remains distinct from local cache age; no implied connection to a running laptop. | EXTENDS → R37; review HUB-47/E-11 scope |
| Hosted `/pm` | The published read-only snapshot | Same Preact board/detail | Cached navigation is not proof of current authentication or current repository data. Preserve read-only capability. | EXTENDS → R37; inspect HUB-37 evidence; hosted-SW implementation held |
| Live phone board | Relayed tasks plus the bridge's last observation | Existing item/session detail and supported commands | Only verified same-owner cache may hydrate. A successful full read removes absent rows. A failed read retains stale same-owner data, not an invented empty success. | EXTENDS → DLV-72; ASTRA-CC-2; HUB-47/E-11 |
| Desktop Delivery session | Current phase, gate need and budget provenance | Inspect current spec/plan/UAT; take the permitted decision | Review or validation with no usable result cannot imply success. Current state and finish evidence must agree or disclose uncertainty. | EXTENDS → DLV-90/93; ASTRA-CC-3; HUB-37/E-01 |
| Phone Delivery session | Same session identity and currently actionable gate | Inspect relayed artifacts; issue a supported command | Command acknowledgment can be unknown independently of bridge liveness. No second grant or launch is sent merely because a timeout fired. | EXTENDS → DLV-72; ASTRA-CC-1; HUB-47/E-11 |

Sources: `scripts/pm/ui.mjs:18`, `scripts/build-pm-dashboard.mjs:51`, `scripts/pm/src/app/api.js:25`, `src/features/pm-live/usePmLive.ts:35–50,147–161`, `scripts/delivery/server-routes.mjs`, `src/components/pm-live/PmLiveApp.tsx`. These are four delivery surfaces but two UI implementations: three Preact surfaces and one React/Next phone app.

**UNVERIFIED:** current installed-device rendering and hosted cache behavior. Settle through the device fixtures in §7, recording build identity, viewport, connectivity and observed result. This study did not start servers or open signed-in live surfaces.

## 3 · The owner journey stays short and governed

| Moment | Existing contract retained | Failure to remove | Evidence that resolves it |
|---|---|---|---|
| Choose the product item | Markdown item is the work contract | An insertion changes the ordinal underneath an open row | Intended item identity and expected text checked at execution; ASTRA-R-1 |
| Inspect launch | Registry-backed lane, scope, budget and prerequisites | Cumulative dollars and throughput inflate different gauges | Correct units and recorded provenance; ASTRA-DLV-1/2/3 |
| Approve scope and plan | SPEC_READY and PLAN_READY decisions; qualifying INSTANT may produce both decisions from one action | A stale phone control acknowledges the wrong revision, or retries after missed acknowledgment | Existing server authorization plus one command identity reconciled to a terminal receipt; ASTRA-CC-1 |
| Let the runner work | Existing artifacts and scoped tools | Process alive is treated as work progressing; unsealed attempts disappear | Preserve heartbeat as heartbeat; missing progress/attempt proof stays explicit and held under DLV-68/91 |
| Inspect acceptance | UAT_READY decision uses actual criterion evidence | Zero selected tests, malformed review or arbitrary file evidence appears green | Nonzero validation, strict review, criterion-bound proof; ASTRA-DLV-4/5/6 |
| Accept, then ship | ACCEPTED remains distinct from owner-marked SHIPPED | Finish files describe an earlier crash after acceptance | One finish-integrity projection on both surfaces; ASTRA-CC-3 |
| Resume later | Existing session history and salvage route | Stale remaining-work document becomes the next work contract | Verify package generation and semantic inputs before offering it as authoritative; ASTRA-CC-3 |

The three human gate decisions and typed risk acknowledgments remain locked (Delivery Master Book, Owner Non-negotiables). **CONFLICTS → those non-negotiables:** DLV-89’s broader two-interaction/removal-of-typed-ack proposal requires a precise owner amendment. The established INSTANT exception is not permission to compress oversight in other lanes. Architecture CC-C04 carries this into the Phase-5 register.

No new confirmation dialog is proposed. Existing command state and artifact areas carry the required distinction. No UI rationale paragraphs, new wording catalog, new dashboard or `/era` rearrangement.

## 4 · Failure states are part of the action contract

| Scenario | Current evidence | Required result / owning packet |
|---|---|---|
| External edit prepends another open task | Ordinal plus expected checkbox state at `mutations.mjs:24–38` accepts the new target | Refuse before writing; refresh keeps selection tied to identity. ASTRA-R-1. |
| Undo after another edit | Desktop `archive.mjs:384–391` restores snapshots without comparison | Validate all expected post-images before restoring any. Refuse on drift; never erase the later edit. ASTRA-R-1. |
| Fast command completion before insert response | Waiter is registered after response at `usePmLive.ts:147–161` | Register before submission, query the same ID after response or reconnect, deduplicate settlement. ASTRA-CC-1. |
| Timeout after successful execution | Same function resolves `ok:false` at timeout without reconciling | Preserve an unknown outcome and the same command ID. Do not emit failure as proof of no effect. ASTRA-CC-1. |
| Bridge dies after claiming | `bridge.mjs:1135–1157` claims before side effect; final update failure unchecked | Never automatically requeue a claimed action. Durable bridge receipt/recovery remains a separately held DLV-93 refinement; CC-1 does not claim exactly-once server execution. |
| Account changes after cached open | Unscoped `pm-live-cache-v2`, hydration before `getUser()` | Clear prior-owner state and pending observations; hydrate only a verified matching envelope. No ownership inference from old payload. ASTRA-CC-2. |
| DELETE missed while offline | Full read merges at `store.ts:73–90` | Replace complete successful snapshot; absent sessions disappear. Preserve stale data on transport failure. ASTRA-CC-2. |
| Bridge heartbeat fresh, task payload old | Heartbeat publication and task publication are separate (`bridge.mjs:962,1177`) | Do not use heartbeat age to certify task generation, runner progress or command completion. Existing payload provenance first; no second timer service. EXTENDS → DLV-72/R38. |
| Accept after crash/resume | HUB-1 local state ACCEPTED, old finish BLOCKED | Current state stays visible; old summary is stale/unverifiable evidence. Acceptance writes a new coherent package; read routes do not repair history. ASTRA-CC-3. |
| Cached shell and data disagree | Fixed local SW cache at `assets/sw.js:8`; shell/data fetched independently | Preserve existing offline behavior, require compatible data format before writes. ASTRA-R-2. |

The current desktop already uses network-first requests and offline headers and blocks stale mutations (`assets/sw.js:39,53`, `scripts/pm/src/app/store.js:77,99,132`). The defect is not “everything offline looks live.” Distinguish already-shipped protection from missing identity and compatibility.

## 5 · Phone navigation: reproduce before altering

`src/components/pm-live/session/SegmentedPanes.tsx:38–52` advances selected state before smooth scrolling completes and suppresses observer updates for 400 ms. This supports a testable synchronization concern; it does not prove a Chromium or physical-phone failure.

**EXTENDS → R42, verification only:** at 390×844 and on the owner's installed phone, enter a session by direct link, tap every segment, swipe each direction, and repeat with reduced motion. Record selected segment and visible pane in the same capture. Pass only when they agree after settling and deep linking lands on the intended pane. Existing responsive layout remains the baseline.

If reproduced, isolate that component's selection/scroll synchronization as the existing R42 fix, with the reproduction attached before allocating implementation. No speculative CSS or animation rewrite. Product unlocked: reliably reaching HUB-47/E-11's UAT artifact on the phone. **UNVERIFIED:** physical-device result until that capture exists.

## 6 · History is evidence, not an endlessly growing screen

There is already retention: bridge terminal relay rows are pruned after seven days for SHIPPED/CANCELLED states (`bridge.mjs:79–80,1046–1052`), relayed snapshots are capped near 200 KB (`:535`), and cached sessions retain ten tail events (`cache.ts:16,44`). The cache guard measures serialized string length despite its byte-named constant. Local raw artifacts and long-term history have no equivalent complete retention convention in the inspected paths.

**EXTENDS → R38 / DLV-68, held until product evidence:** keep three evidence levels in the existing system:

| Level | Purpose | Existing boundary to preserve |
|---|---|---|
| Local raw attempts and decisions | Reconstruct actual execution, including interrupted work | Session-local artifacts; raw transcripts may contain sensitive task data. No automatic deletion or relay upload in these packets. |
| Local summary and finish package | Review outcome and remaining work | Same session identity; current-generation proof required before authoritative salvage. ASTRA-CC-3. |
| Phone projection and cache | Brief inspection and permitted actions | Existing size/age limits, verified owner, payload provenance. ASTRA-CC-2. |

The raw SDK transcript pointer is already local state evidence (Orchestration §6; `run-session.mjs` driver references). **EXTENDS → DLV-70, held:** if DLV-92 identifies a debugging delay, expose pointer metadata and verified existence in the existing local session detail. The SDK pointer can be absolute and outside the session's artifacts directory; it is not a relative artifact URL. Preserve the current artifact reader's containment boundary: no arbitrary-path read endpoint and no raw transcript relay to the phone. Measure time to find the relevant attempt before selecting this work.

A newer heartbeat must not freshen an older completion summary. A compact projection is useful only when the owner can tell which underlying artifact it summarizes. No new history platform, model-generated session summaries or automatic corpus archive sweep is proposed.

## 7 · Binary experience proof, not work completed by this study

All rows below are **NOT RUN**; this is the acceptance contract for later implementation. Component tests may use synthetic accounts and fixture data. Live relay/DB actions belong only to the owner under Hard Rule 26; agents run mocked integrations.

| Proof | Command or screenshot specification | Pass condition |
|---|---|---|
| Intended item and Undo | ASTRA-R-1's explicit four-file Vitest selection; desktop before/after fixture capture | Wrong row never changes; drifted Undo restores no files. |
| Command ordering and ambiguity | ASTRA-CC-1 gate: mocked early UPDATE, dropped UPDATE, uncertain insert, reload and owner change | One insert per authorized action; same ID reconciled; uncertainty never becomes another command automatically. |
| Private cache and missed DELETE | ASTRA-CC-2 gate: A→B account switch, legacy cache, failed read, complete empty read | No A data during B hydration; successful absence removes rows; failed read preserves stale A data only while A remains verified. |
| Desktop/static compatibility | ASTRA-R-2 gate; desktop cached-shell/current-payload fixture and offline portable HTML capture | Incompatible shell cannot mutate; snapshot provenance is not labeled as runtime liveness. |
| Pane navigation | §5's 390×844 and physical-phone capture, including reduced motion | Selected and visible pane agree; gate artifact is reachable by direct link and tap. |
| Finish consistency | ASTRA-CC-3 gate; desktop and phone views of one synthetic resumed session | Both receive identical integrity result; stale/historical package cannot silently authorize continuation. |
| Existing lane oversight | Fake-driver INSTANT and STANDARD run records plus owner decision ledger | Three decisions recorded; only established INSTANT merge permitted; SHIPPED remains owner-only. |
| Product benefit | DLV-92's one bounded product run; DLV-93's permitted fixes then second run | Record owner interactions, wall time, valid acceptance evidence and costs with known accounting basis; owner records completion. |

Do not open real household data merely to get a screenshot for the study. **UNVERIFIED:** deployed PM access, current DB constraints/policies and billing basis. Owner-supplied current DB-state output, untruncated policies/CHECKs and account-settings classification settle those gaps; no prose or repo schema asserts the live result.

## 8 · Admission and things to leave alone

The August 6 Delivery freeze still controls. A real HUB-1 session exists on August 22, but it is ACCEPTED with inconsistent finish evidence; two product completions are not proved. The study's packet catalog is not permission to finish tooling before product work. The existing DLV-92/93 experiment permits only the evidenced reliability/workflow/validation limit described in Architecture §1.

Reject a new desktop toolbar, shared-framework rewrite, new approval dashboard, expanded mobile mutation authority, speculative pane rewrite, raw transcript relay and model-generated progress prose. Keep the existing registry, parser, queue and surfaces. **EXTENDS → R6:** finish locked UAT, then remove the legacy desktop escape hatches instead of refreshing that second interface.

## ASTRA 10× Findings

- **Leverage 1 — EXTENDS → DLV-72:** reconcile one command identity across acknowledgment loss. Removing the need to guess whether a tap worked is a larger daily gain than another control; ASTRA-CC-1 supports HUB-47/E-11.
- **Leverage 2 — EXTENDS → R7:** carry intended-item identity through mutation, postponement and Undo. The existing scanner and Move precondition already supply the seam; ASTRA-R-1 protects HUB-37/E-01.
- **Leverage 3 — EXTENDS → DLV-93:** use one finish-integrity projection in desktop, phone and salvage. It removes three inconsistent interpretations without adding a screen; ASTRA-CC-3 protects HUB-47/E-11 review.
- **Simplification — EXTENDS → R6:** after recorded UAT, delete the legacy desktop client and both escape hatches. Keep the static twin and current Preact app.
- **Frontier — NEW, parked:** use existing outcome receipts to resume a phone interruption directly at the next still-valid owner decision, with no new runner authority. Consider only after two real product completions demonstrate fewer repeated interactions; retain all three gate decisions.
- **Uncomfortable — EXTENDS → DLV-92/93:** a polished control can make uncertainty harder to detect. The present command timeout and contradictory finish package let the interface tell a simpler story than the execution warrants; more UI polish would amplify that gap.
