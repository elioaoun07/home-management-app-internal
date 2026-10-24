# ERA Steward runbook — "Run delivery for item <ID>"

**Owner direction (2026-10-20):** readiness and setup are checked and fixed on the PM Command Center side. ERA Steward does one thing: press Start for the item it is given and report the result. Background: [ERA Steward setup summary](ERA-Steward-Setup-Summary.md). Tracked as [DLV-139](<../ERA Notes/10 - Project Management/Delivery/Delivery — Master Book.md#dlv-139>).

## Owner — before handing an item to Steward

1. `pnpm pm --bridge` is running in one terminal.
2. Open `http://127.0.0.1:4317/#/deliver/<ID>` (for example `#/deliver/R44`).
3. Press **Check readiness**. The card shows **Checking readiness…**, then a checked time with **Checks passed**, **Checks at Start** or **Setup required**. A request error shows **Check failed**. Open **Check details** for individual gates; executor/lane/model/effort are under **Settings**.
4. Fix anything listed in the card, then check again. Common fixes:
   - **Start Docker Desktop**
   - **Sign in again** — the line shows the exact action (for example, run `codex` once)
   - **Policy expired — renew it**
   - **Record your test result** (after an Apply)
   - **Add Touches to the item**
   - **package.json or lockfile changed** — undo the change, or re-stage the environment (DLV-133)
   - **Refresh build setup** — generated compiler inputs differ from the reviewed policy; refresh/review those pins before activation.

   Uncommitted files do not block a launch by themselves. Avoid saving code changes while Start runs; if files change mid-check, Start says so and can be pressed again.
5. Tell Steward: **"Run delivery for item <ID>"**.

## Steward — "Run delivery for item <ID>"

1. Open `http://127.0.0.1:4317/#/deliver/<ID>?initiator=era-steward` in the paired Command Center browser (or select **Steward** on the launch screen).
2. Keep the preselected executor, lane, model and effort unless the owner named different ones.
3. Press **Start** once. Wait on the page. Start runs the Docker, sign-in and model checks itself (about 1–2 minutes), so its evidence cannot expire before it is used.
4. When the run page opens, reply with its link. You are done.

**If Start does not open a run:** reply with the lines shown in the readiness card, word for word, then stop. The owner fixes them on the PM side. If the owner asks you to try again after fixing, press Start again.

**If the page shows a receipt (Acknowledged or Outcome unknown):** press its **Check** button, which re-sends the same request. Never start a second launch for the item.

**If the page asks to pair this browser:** tell the owner and stop.

## Request status (DLV-140)

The Steward entry sends `initiatedBy: era-steward` through the existing Start transport. The local supervisor commits a receipt with the authenticated actor and the original command UUID before checking mode, executor or readiness. Delivery, the launch screen and the run page share these request cards on desktop and `/pm/live`. Ordinary Start is not attributed to Steward.

In Steward mode, Start can record a request even when readiness, executor setup or the test gate is blocked. The same server admission checks still refuse the run; the difference is a durable, visible blocker before a run exists.

The card shows **Initiated by ERA Steward**, request/launch UUID, accepted and coordination-start timestamps, stage, last confirmed coordination update, job state, known blocker, run link and retained evidence. This records use of the Steward entry; it does not authenticate an external chat agent or infer its activity. The actual authenticated actor remains in Evidence.

**Status unconfirmed** concerns coordinator liveness only. Each device derives it from `lastConfirmedAt`, even while showing cached/offline relay data. The default interval is 180,000 ms; `PM_STEWARD_STALE_MS` configures the service value (integer 1,000–86,400,000 ms; invalid values use the default). Passive reads and polling do not refresh that timestamp. The displayed job state and terminal result remain authoritative and separate. Silence never marks a job failed or triggers a retry.

A repeated UUID returns its recorded outcome or remains unconfirmed. A second UUID for the same pending/open Steward work is refused with the original UUID. An interrupted prelaunch request with no proven outcome keeps its claim: use the same saved request and status check; do not mint another launch. Owner investigation is required if no command outcome can be recovered. After a confirmed refusal the existing DLV-138 correction flow may create a new explicit request. The newest 100 requests are published; older receipts remain in the supervisor store. No automatic cleanup, retry or expiry action runs.

After a confirmed **CLOSED / cancelled** run, the launch page offers **New delivery** beside **Open delivery**. New delivery re-reads that exact run under the existing browser intent lock, archives the original browser receipt under `pm-command-receipt:<scope>:<command UUID>`, then releases only its active intent slot. It does not launch. Pressing Start afterward creates a fresh UUID; the original command still resolves to the old run. Failed, completed, active, missing and unknown outcomes do not qualify. A lost launch reply must first be reconciled with Resume request / Check. Storage or confirmation failure retains the active intent. Server receipts, relay history, run artifacts and results are never deleted.

**Never:** run terminal or Docker commands; restart or start `pnpm pm`; press Check readiness repeatedly; diagnose failures; write readiness reports; approve plans; press Apply. Plan approval and Apply stay with the owner, on the phone or laptop.

## Prepared R44 pilot — 2026-10-24 (not activated)

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
