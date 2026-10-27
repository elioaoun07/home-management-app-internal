# ERA Steward runbook — "Run delivery for item <ID>"

**Owner direction (2026-10-20):** readiness and setup are checked and fixed on the PM Command Center side. ERA Steward does one thing: press Start for the item it is given and report the result. Background: [ERA Steward setup summary](ERA-Steward-Setup-Summary.md). Tracked as [DLV-139](<../ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md#dlv-139>).

## Owner — before handing an item to Steward

1. `pnpm pm --bridge` is running in one terminal.
2. Open `http://127.0.0.1:4317/#/deliver/<ID>` (for example `#/deliver/R44`).
3. Press **Check readiness**. This explicit owner action renews the exact saved authorization for at least another 24 hours, then collects readiness. The card shows **Authorized until**, a checked time and **Checks passed**, **Checks at Start** or **Setup required**. A request error shows **Check failed**. Open **Check details** for individual gates; executor/lane/model/effort are under **Settings**.
4. Fix anything listed in the card, then check again. Common fixes:
   - **Start Docker Desktop**
   - **Sign in again** — the line shows the exact action (for example, run `codex` once)
   - **Authorization expired — check readiness**
   - **Record your test result** (after an Apply)
   - **Add Touches to the item**
   - **package.json or lockfile changed** — undo the change, or re-stage the environment (DLV-133)
   - **Refresh build setup** — generated compiler inputs differ from the reviewed policy; refresh/review those pins before activation.

   Uncommitted files do not block a launch by themselves. Avoid saving code changes while Start runs; if files change mid-check, Start says so and can be pressed again.
5. Tell Steward: **"Run delivery for item <ID>"**.

### Check readiness renews saved authority (DLV-142)

The authenticated owner Check command (desktop or updated phone shell) records a time-only renewal in `.delivery/v2/authorization.json`; it does not rewrite the installed policy. Each receipt retains its command UUID, authenticated actor, exact settings fingerprint and expiry. A replay returns the original receipt without adding time. Each new click grants at least 24 hours from that click; a longer existing window is not shortened, and a policy without expiry stays without expiry. Readiness can still report genuine setup blockers after authorization is renewed.

The policy must already be installed and valid. Check cannot install a draft, change source pins/scope, reset usage or reservations, raise concurrency/repair limits, approve a plan, dispatch work or Apply. A changed policy cannot inherit a prior renewal. Passive GET/CLI/relay publication and Start's internal observation collection never renew authority. The journal and original run receipts are retained across restarts; an unreadable journal refuses instead of discarding it.

New grants bind to this exact settings fingerprint. Continuing runs with that binding use renewed time at admission/dispatch without rewriting their stored grants or changing plan approvals/revocation versions. Historical grants without the binding retain their original expiry. This feature does not widen the R44-only/one-Start pilot procedure or enable parallel work under its one-writer/one-job settings.

After a server-source update, restart the existing bridge once and reload the local page. The hosted phone shell needs the corresponding deployed UI before its Check sends the renewal request. No service restart, live renewal, provider turn, deployment or owner acceptance is implied by source verification.

Owner acceptance: on the updated local launch page, press Check once. Expect pending feedback, **Authorized until** at least 24 hours ahead, and the actual readiness result. Reload and confirm the same authorization expiry; passive reads must not move it. On the updated phone shell repeat once and confirm the new expiry on both devices. Genuine source/environment/usage blockers must remain. Keep Start untouched for this check. Record the date, displayed expiry, readiness result and device in the existing wizard; real-phone/deployed acceptance is pending.

## Steward — "Run delivery for item <ID>"

1. Open `http://127.0.0.1:4317/#/deliver/<ID>?initiator=era-steward` in the paired Command Center browser (or select **Steward** on the launch screen).
2. Keep the preselected executor, lane, model and effort unless the owner named different ones.
3. Press **Start** once. Wait on the page. Start runs the Docker, sign-in and model checks itself (about 1–2 minutes), so its evidence cannot expire before it is used.
4. When the run page opens, reply with its link. You are done.

**If Start does not open a run:** reply with the blocker shown under **Start blocked**, word for word, and its request ID under **Start details**, then stop. Use the readiness card only for a blocker that prevented pressing Start. The owner fixes it on the PM side. If the owner asks you to try again after fixing, press Start again.

**If the page shows a receipt (Acknowledged or Outcome unknown):** press **Check status**. It only reads the original request; it never sends Start again. Missing or uncertain status retains that request. Never start a second launch for the item.

**If the page asks to pair this browser:** tell the owner and stop.

## Typed tools, support accounting and candidate tests — DLV-144

Implements the repo portions of the [sign-off plan](ERA-Steward-Signoff-Plan-2026-10-24.md). The four operations remove the need for coding-agent status tasks once connected. Delivery usage and recorded Support/Chat coverage are visible; unreported external usage remains unknown.

### Steward tools (connection status corrected 2026-10-25)

Setup execution and per-step evidence: [Dot connection setup checklist](ERA-Steward-Dot-Connection-Setup-2026-10-25.md). Use that file to track progress; this section describes the connection.

One stdio tool server, four tools: `start-delivery`, `read-request`, `read-run`, `wait-for-changes`. Each is a deterministic request to Command Center. None runs a model, a shell or Docker.

**Correction:** local Codex MCP registration does not prove that Dot itself receives those tools. No per-Dot switch removing every coding/shell/delegation tool has been verified. Full Dot sign-off remains pending; this is an integration dependency, not merely an owner checkbox.

The supported connection route to evaluate is **Dot → installed private ChatGPT plugin → Secure MCP Tunnel → this stdio server → Command Center**. MCP is an optional transport for ERA; this route provides direct typed tools. OpenAI documents private stdio forwarding in [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels), plugin creation in [Connect and test your plugin](https://developers.openai.com/plugins/deploy/connect-chatgpt), and Dot's use of connected plugins in [Computers and apps](https://learn.chatgpt.com/docs/dots/computers-and-apps). Product support is documented; account permissions and this end-to-end connection are not yet tested.

1. Keep the existing bridge running. UAT records restricted pairing already completed; do not pair again unless that credential is missing/revoked. The credential limits PM routes only; it does not control other Dot capabilities.
2. Create a private tunnel in [Platform tunnel settings](https://platform.openai.com/settings/organization/tunnels), associated with the intended ChatGPT workspace. The documented prerequisites are tunnel Read/Manage access and a runtime key with Read/Use. Store the key locally, never in chat. Install the official `tunnel-client` using the download link there and check `tunnel-client help quickstart`.
3. Configure the existing server as the tunnel's stdio command. From this repo, the documented command shape is:

```powershell
tunnel-client init --sample sample_mcp_stdio_local --profile era-steward --tunnel-id <TUNNEL_ID> --mcp-command "node C:/Users/aoune/WebApp/budget-app/scripts/delivery-v2/steward-mcp.mjs"
tunnel-client doctor --profile era-steward --explain
tunnel-client run --profile era-steward
```

4. In ChatGPT **Plugins → + → Add custom MCP server**, choose **Connection: Tunnel**, select that tunnel, configure authentication, then **Create as a plugin**. Verify the discovered four tools. Test Dot's direct `read-run` for `r-46688acd1b86`; no Start. Keep the tunnel client running.
5. After that succeeds, remove Dot's general local-computer access using **Dot profile → Computers → connected computer → Revoke access**. The independently running tunnel/bridge supplies the restricted connection. Re-test the read from Dot with general local access revoked. This closes the local-computer delegation route; it does not disable Dot's cloud tasks.
6. Set **Settings → Personalization → Custom rules → Add** for starting/continuing/delegating Work, Codex, Claude or shell tasks for ERA, with **Ask before taking action**. [Official Dot controls](https://learn.chatgpt.com/docs/dots/controls) describe rules as fallible instructions. They cannot prove a hard ban on all external model usage. That stronger promise remains unproven and must not be included in sign-off.

Once the connection is accepted, the normal instruction remains **"Run delivery for item `<ID>`"**. Plan approval and Apply stay with the owner.

What you can rely on:

- Start persists its intent in `.delivery/v2/steward/intents/` before the request leaves and keeps one UUID. A repeated call, a lost reply or a restarted tool re-reads that receipt. The restricted server credential cannot create a second request for work with an existing launch, even after refusal or completion, or after clearing the tool's local files. Any new attempt uses the owner's normal Command Center controls; Steward then monitors the supplied run link. There is no model-supplied retry permission.
- The sole permitted executor and the lane's suggested model/effort are used, as on the launch screen. With more than one permitted executor the tool stops and asks.
- A dropped connection returns the last confirmed state labelled *stale* (`.delivery/v2/steward/last-known/`). No Start, repair or model follows.
- Status lines are templates: item, request/run id, state, owner next action, checks, evidence time, then usage.
- Plan approval and Apply stay with you, on the phone or laptop.

The existing browser procedure remains usable for supervised delivery. It does not establish that external coding-agent delegation is technically disabled. Do not treat browser use or a model's verbal refusal as the M1 permission proof.

### Support jobs and the usage report

A Claude/Codex repair you ask for is real work and belongs on the record. **There are no automatic support jobs.** Use the owner CLI (`pnpm pm:pair`, then `pnpm pm:support pair <CODE>`):

| Step | Command |
| --- | --- |
| Authorize one job | `pnpm pm:support authorize --run <run> --purpose "…" --scope a,b --executor codex --tier CODEX_LOW --effort low --tokens 50000` |
| Let it start | `pnpm pm:support admit <authorization> <job>` |
| Record what it reported | `pnpm pm:support settle <authorization> <job> --file settlement.json` |
| Withdraw | `pnpm pm:support close <authorization>` |
| Enter a chat figure you read yourself | `pnpm pm:support chat --run <run> --tokens N` |
| Show it | `pnpm pm:support report --run <run>` |

One authorization admits one job. A job whose usage is missing or cannot be normalized stays **unknown** and blocks the next one, as do the job limit and a spent allowance. Usage is normalized like Delivery's: cached input stays inside input, a cumulative counter is differenced, a missing baseline is a flagged hole. A cost the provider did not report is *unknown*, never $0. The settlement keeps requested and observed model/effort, thread and turn ids, tokens and stop reason (`support-cli.mjs` header lists the file shape).

This is a manually maintained authorization/accounting ledger. It does not launch a repair, select its model, enforce its file scope or stop its runtime. Matching effort is labelled `effort_match`; an observed model is reported without claiming that it matches a documentation tier. Input and output counters are required for measured usage. Partial dollar amounts are labelled known subtotals with the remainder unknown; estimates stay labelled estimates.

The run page shows **Support** apart from the delivery's own usage; `read-run` and `report` show **Delivery / Support / Chat overhead** separately, each with how many jobs its figure covers. Chat overhead is never measured here, only figures you enter.

### Candidate tests

R44's authored test file was never run before Apply. With `candidateTests` configured, the test files a candidate adds or changes, plus test files its approved plan names, run in the protected checker with a command the policy pins; the candidate supplies paths only. Anything but a clean pass leaves the run unverified and Apply refused: a missing file, a failing, skipped or timed-out test, unreadable output, extra files collected, a runner that never started, or a changed checker input. Apply checks the evidence belongs to this exact candidate under today's command, checker inputs and test bytes, and the integrated tree re-runs the tests before Applied. The protected oracle and the typecheck are unchanged. A candidate with no test file reports "no candidate tests".

Owner activation: a new policy revision, then **Check readiness**. Adding the block changes the settings fingerprint, so an earlier renewal does not carry over.

```json
"checks": {
  "inputs": ["tests/delivery-oracles/r44-fetch-guard.mjs", "vitest.config.ts", "tests/setup/blockPaidApis.ts"],
  "requiredVerifications": {
    "typecheck": { "…": "unchanged" },
    "candidateTests": {
      "enabled": true,
      "enforcement": "required",
      "argv": ["node", "/node_modules/vitest/vitest.mjs", "run"]
    }
  }
}
```

Omitting `include` uses the built-in test patterns for both `tests/` and source-adjacent tests under `src/`. Keep these defaults for normal delivery. The scratch scope must contain what a test imports, or the test fails honestly. The worker image links `/node_modules` to the pinned dependency volume; confirm once that `vitest` resolves there (UAT M3). If it does not, every candidate with tests is *inconclusive*, never passed. Passing evidence requires complete file and test summaries, with every selected file passed.

## Request status (DLV-140)

The Steward entry sends `initiatedBy: era-steward` through the existing Start transport. The local supervisor commits a receipt with the authenticated actor and the original command UUID before checking mode, executor or readiness. Delivery, the launch screen and the run page share these request cards on desktop and `/pm/live`. Ordinary Start has the same durable receipt, labelled Owner rather than Steward (DLV-143).

In Steward mode, Start can record a request even when readiness, executor setup or the test gate is blocked. The same server admission checks still refuse the run; the difference is a durable, visible blocker before a run exists.

The card shows **Initiated by ERA Steward**, request/launch UUID, accepted and coordination-start timestamps, stage, last confirmed coordination update, job state, known blocker, run link and retained evidence. This records use of the Steward entry; it does not authenticate an external chat agent or infer its activity. The actual authenticated actor remains in Evidence.

**Status unconfirmed** concerns coordinator liveness only. Each device derives it from `lastConfirmedAt`, even while showing cached/offline relay data. The default interval is 180,000 ms; `PM_STEWARD_STALE_MS` configures the service value (integer 1,000–86,400,000 ms; invalid values use the default). Passive reads and polling do not refresh that timestamp. The displayed job state and terminal result remain authoritative and separate. Silence never marks a job failed or triggers a retry.

A repeated UUID returns its recorded outcome or remains unconfirmed. A second UUID for the same pending/open Steward work is refused with the original UUID. An interrupted prelaunch request with no proven outcome keeps its claim: use the same saved request and status check; do not mint another launch. Owner investigation is required if no command outcome can be recovered. After a confirmed refusal the existing DLV-138 correction flow may create a new explicit request. The newest 100 requests are published; older receipts remain in the supervisor store. No automatic cleanup, retry or expiry action runs.

After a confirmed **CLOSED / cancelled** run, the launch page offers **New delivery** beside **Open delivery**. New delivery re-reads that exact run under the existing browser intent lock, archives the original browser receipt under `pm-command-receipt:<scope>:<command UUID>`, then releases only its active intent slot. It does not launch. Pressing Start afterward creates a fresh UUID; the original command still resolves to the old run. Failed, completed, active, missing and unknown outcomes do not qualify. A lost launch reply must first be reconciled with **Check status**. Storage or confirmation failure retains the active intent. Server receipts, relay history, run artifacts and results are never deleted.

**Never:** run terminal or Docker commands; restart or start `pnpm pm`; press Check readiness repeatedly; diagnose failures; write readiness reports; approve plans; press Apply; hand a status check or a command to Codex or Claude. Plan approval and Apply stay with the owner, on the phone or laptop. With the [tool server](#typed-tools-support-accounting-and-candidate-tests--dlv-144) these steps are its four tools, and the server refuses the rest.

## One Start result — DLV-143

**October 24 cancellation/status follow-up:** [R44 acceptance report](R44-Delivery-Acceptance-2026-10-24.md) records the actual cancelled run/request, idle queue/container evidence, terminal Activity/default-tab correction, reconciled offline tests and browser recovery checks. The subsequent fresh validation was denied at New delivery before execution; no replacement run exists. Follow the report's exact authorization/checkpoints instead of assuming the cancelled proposal is an approvable fresh run.

The October 24 R44 failure had two separate causes. Retained native metadata ended at `model/list` with `native-probe-timeout`; a 10-second caller override left about five seconds after initialize/account lookup. The browser then dropped the detailed refusal and showed only `delivery not ready`. The ordinary entry had no prelaunch receipt. Read-only supervisor evidence confirms no new run/job was created. The original request UUID was not retained; the latest collection is evidence of the runtime failure, not a reconstructed command receipt.

The source correction uses the probe's existing 30-second budget inside the unchanged 45-second container deadline. It retains cleanup, zero inference for readiness, exact model/effort checks, freshness, qualification, authority and owner approval. It does not guarantee an upstream model-service response. Every new Start now retains a receipt before checks, and **Start result** retains its exact refusal independently of later passive readiness. **Check status** reads the original outcome only. A new explicit Start after a confirmed refusal archives the old browser receipt; it is never an automatic retry.

Owner activation and acceptance for this source checkout:

1. After the source checks pass, stop the existing `pnpm pm --bridge` process in its own terminal and start **one** `pnpm pm --bridge` there. Reload the paired R44 page. Preserve policy, pairing, supervisor history and volumes. No image rebuild or environment staging is required for the host-streamed metadata probe correction. The agent cannot restart the production-publishing bridge under project Hard Rule 26; the owner performs this step.
2. Keep the already chosen R44/Codex/Fast lane selection. The prior failed attempt is historical and must not be called a new receipt. On a separately owner-authorized Start, expect either a run link or **Start result** with the actual blocker (for example **Model check timed out**), command ID and technical details. A timeout must not create a run or dispatch work.
3. While a request is unresolved, use **Check status** only. Reload and check again: identity must remain the same, and read-only checks must never trigger another Start. Once the exact refusal is recorded, passive readiness refresh and reload must preserve it. Starting again is a new explicit owner decision.
4. Repeat the presentation checks at 390 px in Blue/Pink. Hosted `/pm/live` requires deployment of the matching frontend for the new result/status controls; local build verification is not deployment or real-phone acceptance. Exact plan approval and Apply remain separate owner actions.

Isolated fixture verification and source fingerprints are retained in `.tmp/r44-start-diagnosis-20261024/`; operational readiness/provider success and owner/phone PASS are not claimed by those fixtures.

## Prepared R44 pilot — 2026-10-24 (not activated)

> **Status, 2026-10-24 (later):** superseded by what happened. The owner activated a fresh Start; run `r-46688acd1b86` reached Applied. See the [R44 acceptance report](R44-Delivery-Acceptance-2026-10-24.md). The preparation record below is kept as history and must not be re-run as written.

Local review package: `.tmp/r44-steward-pilot-20261024/`. `policy.draft.json` is revision 10 with a deliberately expired grant and PENDING authorization. `inputs.json` pins all 704 exact input files, including every JS/TS source in the four client directories for the plan's R48 recount, the ESLint/package/lock config, safeFetch/connectivity helper, Vitest config and paid-API block, fixture conventions and selected PM source. The new `tests/pm-ui/raw-fetch-guard.test.ts` is intentionally absent: the pilot creates it. No placeholder or application guard has been implemented here.

The draft retains the installed runtime, dependency volume, qualification requirements, protected oracle, required checker/typecheck, resources, catalog and concurrency. Its generated-type pins are refreshed to the current source bytes; two old development pins differed. No environment is built or repaired. Publication is exactly `eslint.config.mjs` and `tests/pm-ui/raw-fetch-guard.test.ts`.

Pilot selection: **R44 / CODEX_LOW / low / focused**. The literal selector is recorded in `pilot.json`. Focused enforces at most **one planning job, one implementation job, zero repairs** per run. Exact plan approval remains required; `ownerReviewed` in R44's prepared material remains false. Maximum disposition is **verified_candidate**, automatic retry is false and no host Apply/publish effect is granted. The schema has no item allowlist, work-profile restriction or global one-run counter: **R44 only, Focused only, one Start** are owner operational limits, not additional machine-enforcement claims.

### Owner activation (future explicit action)

1. Review the source diff and `pilot.json`, `inputs.json`, `policy.draft.json` and `verification.json` in the package. Any changed input invalidates this preparation; regenerate/review it before activation. The initial working tree contained unrelated incoming-transfer work and an executor-selection test edit; those were preserved. The source manifest records the current input bytes, including existing checkout edits.
2. In the existing Command Center, confirm **zero active/reserved/unknown jobs and writers**, no pending launch for R44, and the old `r-262a6aee5ed3` is **CLOSED / cancelled**. If any outcome is unknown, reconcile the original receipt and stop. This preparation does not certify the operational store's present state.
3. Stop the existing bridge with Ctrl+C in its own terminal. Keep the supervisor database, pairing, relay journal, receipts, old policy and all volumes. Do not start a second bridge.
4. In PowerShell at the repo root, review and run this activation block yourself. It refuses changed policy/input/generated-type bytes, preserves policy 9, creates a fresh 24-hour authorization and installs only the reviewed revision 10:

```powershell
$pilotDir = '.tmp/r44-steward-pilot-20261024'
$pilotReview = Get-Content -Raw -Encoding UTF8 "$pilotDir/pilot.json" | ConvertFrom-Json
$pilotInputs = Get-Content -Raw -Encoding UTF8 "$pilotDir/inputs.json" | ConvertFrom-Json
$pilotDraft = Get-Content -Raw -Encoding UTF8 "$pilotDir/policy.draft.json" | ConvertFrom-Json
function Assert-PilotHash($pilotPath, $pilotExpected) {
  $pilotActual = 'sha256:' + (Get-FileHash -LiteralPath $pilotPath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($pilotActual -ne $pilotExpected) { throw "Changed input: $pilotPath" }
}
Assert-PilotHash '.delivery/v2/execution-policy.json' $pilotReview.installedPolicySha256
Assert-PilotHash "$pilotDir/policy.draft.json" $pilotReview.draftPolicySha256
Assert-PilotHash "$pilotDir/inputs.json" $pilotReview.inputsSha256
foreach ($pilotInput in $pilotInputs.files) { Assert-PilotHash $pilotInput.path $pilotInput.sha256 }
foreach ($pilotPin in $pilotDraft.checks.requiredVerifications.typecheck.program.generatedTypes.PSObject.Properties) {
  Assert-PilotHash $pilotPin.Name $pilotPin.Value
}
if (Test-Path -LiteralPath 'tests/pm-ui/raw-fetch-guard.test.ts') { throw 'New test path already exists; re-review preparation' }
if (Test-Path -LiteralPath "$pilotDir/policy.rev9.preserved.json") { throw 'Activation already staged; reconcile it first' }
Copy-Item -LiteralPath '.delivery/v2/execution-policy.json' -Destination "$pilotDir/policy.rev9.preserved.json" -ErrorAction Stop
$pilotNow = [DateTime]::UtcNow
$pilotDraft.authorized_by = 'Elio: one R44 Steward pilot; CODEX_LOW / low / focused; one plan, one implementation, zero repairs; stop at verified_candidate'
$pilotDraft.authorized_at = $pilotNow.ToString('o')
$pilotDraft.grant.expires_at = $pilotNow.AddHours(24).ToString('o')
$pilotDraft.'$comment' = 'Owner activated one R44 pilot. Exact phone plan approval; no automatic retry, repair, Apply or publish.'
$pilotJson = $pilotDraft | ConvertTo-Json -Depth 100
[IO.File]::WriteAllText((Join-Path (Get-Location) "$pilotDir/policy.activation.json"), $pilotJson, [Text.UTF8Encoding]::new($false))
node --input-type=module -e "import {readFileSync} from 'node:fs'; import {validateExecutionPolicy} from './scripts/delivery-v2/policy.mjs'; const r=validateExecutionPolicy(JSON.parse(readFileSync('.tmp/r44-steward-pilot-20261024/policy.activation.json','utf8'))); if(!r.ok) throw new Error(JSON.stringify(r.refusals));"
if ($LASTEXITCODE -ne 0) { throw 'Policy validation failed; installed policy unchanged' }
Copy-Item -LiteralPath "$pilotDir/policy.activation.json" -Destination '.delivery/v2/execution-policy.json' -ErrorAction Stop
```

5. Start **one** `pnpm pm --bridge` in that terminal. Pair only if requested. Open `http://127.0.0.1:4317/#/deliver/R44?initiator=era-steward`; verify Codex / literal selector from `pilot.json` / low / Fast lane. If this browser offers Open delivery for the cancelled old run, press **New delivery** once; the old receipt remains accessible in Delivery history. If a request is unresolved, use Check/Resume request and stop.
6. Owner may check readiness once. Setup, qualification, sign-in, included usage, environment or source blockers stop the pilot; no repair, dependency preparation, qualification rerun or provider fallback is authorized by this package. Historical evidence is not current readiness.
7. Give Steward **“Run delivery for item R44. One Start only; report the run link or listed blockers, then stop.”** Start performs its own fresh admission checks. On an uncertain response, check the same receipt; never mint another UUID.
8. Owner reviews and approves the **new run's exact plan/contract revision on the phone**. Confirm the R48 recount and focused fixture fit the two publication paths. No second planning job, revision job, implementation retry or repair is authorized. Stop at the verified candidate or first failure/unknown/blocker. Retain the new run/command/plan/result references. **Do not Apply** as part of this pilot; any later Apply is a separate owner action.

Offline checks do not certify Docker, subscription/model availability, live qualification, relay, actual phone approval or a provider candidate. Fixture/manual acceptance: after source activation, use the cancelled old run only to confirm New delivery releases its browser slot without launching; Open delivery/history must still open the old run. A waiting/unknown run must expose only recovery, and an offline confirmation must preserve the intent. Verify these actions at about 390 px on the phone before owner acceptance. No owner PASS is recorded here.

## Launch UI acceptance — DLV-141

Source checkout plus `.tmp/dlv141-ui/verification.json` identifies this UI follow-up; it is not an R44 candidate or an activated pilot. Local desktop assets serve the new card; the hosted `/pm/live` shell needs the corresponding deployed source. Offline evidence does not install policy or refresh qualification.

1. Reload R44 on desktop and phone. Expect a compact title, **Settings**, a readiness card and a clear action. Open Settings to inspect the executor/lane/model/effort. At 390 px and 320 px, check wrapping, touch targets and that scrolling keeps the action clear of bottom navigation; repeat in Blue/Pink.
2. Press **Check readiness** once when you intend to collect readiness. Expect **Checking readiness…** immediately, disabled Check/Start/settings controls, then a checked time and **Checks passed**, **Checks at Start** or **Setup required**. The same blockers remaining still produce completion feedback. **Check details** retains gate codes and diagnostic detail.
3. An actual request failure must show **Check failed** and its error; normal Start remains disabled until a successful recheck. Cached checks appear only under **Previous checks**. An isolated fixture exercised this case; do not interrupt an operational service just to manufacture it.
4. A confirmed cancelled request shows **New delivery** and **Open delivery**, with no duplicate Start. New delivery must preserve the old receipt and release only the active intent; it must not launch. Afterward Start appears. Open/history must retain the old run. An uncertain request still offers recovery of its original identity.

Owner observations: pending. The isolated browser fixture exercised all four paths without operational API calls. For step 2's real expired-policy/compiler-input blockers, follow the reviewed activation procedure above before attempting the pilot.
