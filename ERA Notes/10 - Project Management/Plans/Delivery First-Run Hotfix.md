---
created: 2026-09-14
updated: 2026-09-14
type: plan
status: active
owner: Elio
evidence_cutoff: "2026-09-14 working tree over 8d95233; read-only local SQLite, application journal and byte comparison for r-c1d69bb666cf; source review and 53 passing targeted tests. Browser unavailable; no fresh visual or phone acceptance."
---

# Delivery first-run hotfix

## 1. Contract and ownership

**Make a small Delivery understandable, controllable, proportionate and recoverable from launch through rollback.** This is the owner's requested implementation plan after the first V2 trial, DLV-107 / `r-c1d69bb666cf`. The investigation and plan are complete; the changes below are pending implementation. Planning this hotfix does not certify the present experience or authorize a new model run.

Delivery owns execution, resource controls, evidence, plan review and application safety. PM Tooling owns responsive presentation and item-to-run navigation. The campaign checklists remain the only execution queues. Existing DLV-108/109/112/113/114 and R55 are extended or linked, not recreated. New outcomes are DLV-115–119 and R64.

Keep the current V2 supervisor, native subscription workers, protected checker/integrator and shared React/transport architecture. No third engine, new campaign, paid fallback, production DB access, framework replacement or V1 redesign. This plan requires local SQLite/API evolution; any later relay schema change must have an owner-run migration. Existing uncommitted application work belongs to the owner and must be preserved.

**Release position:** do not call another owner trial a safe capped run until DLV-119/114 are proved. Do not call the experience ready until the review, rollback and responsive walkthrough in §8 passes. These are acceptance gates for implementation, not claims that this analysis disabled the existing launcher.

## 2. What actually happened

The run's two native jobs requested **Codex / GPT-5.6 Luna / low / focused**. Both refer to the same native thread. Their events did not report effective model/effort, so the UI must distinguish requested values from observed values.

Times below are **Asia/Beirut, UTC+03:00 on 2026-09-14**, converted from the stored UTC events:

| Time | Recorded event | Meaning |
|---|---|---|
| 19:08:58 | Run created | First native investigation admitted. |
| 19:09:01–19:09:36 | Investigation | Read-only work produced plan revision 1. |
| 19:09:36 | Plan proposed | A readable structured plan was stored. |
| 19:10:25 | `plan.approved`, actor `owner` | The approval gate was crossed. A receipt proves the command; it cannot prove that the owner could comfortably read its content. |
| 19:10:26–19:10:57 | Implementation | Existing thread resumed, one source line changed. |
| 19:10:58 | Candidate C1 frozen | One modified file, no new source file. |
| 19:11:03 | Result v1 | Both protected criteria inconclusive: `malformed-observation`. |
| 19:12:12, 19:12:33, 22:08:07 | Results v2–v4 | Same candidate and same failing evidence references. These were not new implementations. |
| 22:08:49 | Result v5 | Both criteria satisfied; verified candidate. |
| 22:09:04–22:09:14 | Apply | Preview and integrated checks passed, one file written. |
| 22:17:21 | Rollback | One file restored; no foreign edits or failed restores recorded. |

Native job wall time was about **67 seconds combined**. Time from first inconclusive result to verification was about **2h 58m**; the record does not establish how much of that was active owner work. It is incorrect to describe the whole interval as model runtime.

### The actual change and rollback

The application journal's before/after bytes show this entire source diff in `scripts/pm/app/Work.tsx:72`:

```diff
- href={`#${spacePath(campaign)}?view=story`}
+ href={`#${spacePath(campaign)}?tab=story`}
```

`Work.tsx` existed in the **launch filesystem snapshot**, although the new React directory is untracked in Git. Git-untracked does not mean created by this delivery. Candidate classification correctly says `update`. The current file's SHA-256 is `e9fab17fa70c34e773c9266a9d3c1b149e6c7e22abc3a4e128662c91109850fb`, exactly matching the application before-image and launch manifest. **Rollback restored this file correctly; deleting it would have destroyed pre-existing work.**

The confirmed defects are the absent confirmation/preview, absent readable diff and weak rollback receipt. The specific allegation that this run left a newly created source file behind is disproved for `Work.tsx`. A genuine create→rollback deletion still needs an explicit regression fixture. Candidate snapshots should remain available after rollback as history, with a clear distinction from the checkout.

Evidence: local `.delivery/v2/supervisor.sqlite`, run/job/plan/result/application/event rows; application `app-8c52911738e3` journal and before/after bytes under the local Delivery data directory. No live run, file, application state or installed policy was modified during this audit.

### Token accounting and why the task was expensive

| Phase | Input | Cached input, subset | Output | Reasoning output, subset | Input + output | Current additive counter |
|---|---:|---:|---:|---:|---:|---:|
| Plan, `j-74fa32e78cae` | 62,822 | 30,208 | 835 | 81 | 63,657 | 93,946 |
| Build, `j-bbb23a7cb015` | 218,910 | 167,680 | 1,676 | 204 | 220,586 | 388,470 |
| Total | **281,732** | **197,888** | **2,511** | **285** | **284,243** | **482,416** |

`jobs.mjs:203` adds all four categories when settling tokens; `v2model.ts:81` repeats that additive display. OpenAI documents cached input and reasoning as subsets of input and output. The installed Codex SDK's `Usage` type and `normalizeCodexUsage` preserve those raw categories. **284,243 is the corrected input-plus-output interpretation of the saved readings**, not a measured invoice or remaining subscription quota. Preserve the original 482,416 historical receipt and add versioned normalized accounting; prove the pinned Codex semantics with fixtures before changing admission. Do not assume Claude's counters have identical inclusion rules. [OpenAI usage semantics](https://developers.openai.com/api/docs/guides/agents-api/observability#understand-token-usage).

The installed policy is **200,000 tokens per run, `strict: false`, 50,000 reserved per job**, and fleet allowance 200,000 with one writer/job. Even the corrected total exceeds 200,000 by **84,243 (42.1%)**; the present additive total reports a 141.2% overrun. A reservation is capacity accounting, not a provider-enforced job cap. Before Build the remaining corrected allowance was 136,343; the 50,000 reservation admitted a job that subsequently used 220,586 input-plus-output tokens. No observed stop was requested in either job.

The evidence supports these causes:

- The same native thread continued; this was not a provider handoff or a fresh planning restart. Repeated context processing is visible in 197,888 cached-input tokens. Exact prompt/tool-output attribution is not retained, so a precise cost-per-command breakdown would be invented.
- Both profiles enter the same investigation/approval/build lifecycle. The selected label does not activate a smaller execution policy or a different context budget.
- The worker attempted `git status`, then `npm run typecheck` without `tsc`, then `npm run pm:check-docs` with its script missing from the supplied workspace. The native final report identifies both check failures. The protected checker separately had its own prepared tools and passed later. The planner was not told this distinction clearly enough.
- Activity and usage are retained at job completion, so the owner cannot reliably observe consumption or intervene from live evidence while the job is active (DLV-109).
- Recheck did not spend more model tokens: only **two native jobs** exist. It generated repeated Results and protected checks. Do not blame those result versions for additional model calls.

## 3. Disposition of the owner's 13 points

| # | Finding | Hotfix ownership and required behavior |
|---|---|---|
| 1 | Confirmed source-level typography problem. Root 14px; plan disclosure 9px, check values 10px, check/resource/list rows 11px. Some responsive rules shrink further. Visual severity is owner-reported; no browser available in this audit. | **R64:** readable desktop workspace and mobile layout, with computed-size and real-device acceptance. |
| 2 | Focused means FAST **intent**, Investigate means DEEP **intent** in the design. In current code these are stored profile names and optional catalog suggestions, not materially different execution lanes. Both begin with investigation. | **DLV-117/118:** one vocabulary, real profile contracts, visible estimate and supported limits. Do not claim an implemented fast lane merely by changing its label. |
| 3 | The UI has suggestion support and the installed catalog has a Focused Luna/low suggestion. It has no Investigate suggestion. Suggestions are static per profile/provider, not item-aware; changing model resets effort to Default. | **DLV-117:** task-aware deterministic recommendation, explicit selected settings, reasons and fallback. Preserve manual overrides. |
| 4 | “Can run together” is a conflict/capacity verdict relative to other work. With no peer it reads like an instruction. Fleet allowance is aggregate reserved/settled resource admission, not an agent count or a token-stop guarantee. | **R64/DLV-117/114:** show `Ready` for a lone run, name blocking work otherwise; hide concurrency details under `Capacity`; show unit/used/remaining when relevant. |
| 5 | A plan and approval receipt exist. Approval controls precede the plan. Valid plans expose normalized fields only; raw text is projected only for malformed plans. No full V2 artifact reader exists. | **DLV-116:** reviewable versioned plan before approval, stable download/export, revision comparison and preserved feedback. |
| 6 | High actual consumption plus inflated accounting; failed worker checks wasted work. | **DLV-119/118:** normalize usage, trim task context, declare check capabilities, and measure the small-task overhead. |
| 7 | No run-level token input in Launch; installed threshold only gates future dispatch. No in-job cap or overrun decision appeared. | **DLV-114:** explicit per-run resource authority, proven enforcement mode, visible warnings, durable stop and owner-only increase/escalation. |
| 8 | “Review result” exposes Recheck/Close without explaining the failed evidence. Rechecks did run but v1–v4 kept identical inconclusive evidence. A command-receipt `Check` is a different operation. | **DLV-112/R64:** distinct evidence reader, `Recheck` and `Check status`; command progress/receipt and reason-specific next action. |
| 9 | Here “inconclusive” means the checker could not interpret execution counts, not that the code failed. Parser fix is already present and v5 passed. | **DLV-112:** `Couldn’t verify` with `Test count unreadable` and inspectable logs; retain precise internal states. |
| 10 | V2 renders only kind/path, no textual diff. `update` was correct relative to this run's base. | **DLV-116:** Created/Modified/Deleted, line changes, before/after views and exact candidate identity. |
| 11 | Several separate technical projections compete: plan, criteria, Work complete, Cost, application counters and Jobs. No clear decision hierarchy. | **R64:** each section answers one owner question; diagnostics disclosed on demand. |
| 12 | Direct Roll back button has no confirmation. Actual inverse correctly restored the pre-existing file. | **DLV-115:** preview, explicit confirmation, stale-preview protection and detailed completion/conflict receipt. Test true additions/deletions. |
| 13 | Work's `runFor` only considers active V1 runs. V2 is fetched separately on Delivery; terminal V2 history is hidden behind its history toggle. No item attempt timeline. | **R55:** permanent per-item attempt history, stable run links, candidate/result/application versions and retry ancestry. |

## 4. Owner experience to build

### Launch

Show the selected item and a compact recommendation first: **Focused · Codex · GPT-5.6 Luna · Low**, only when that exact combination remains in the installed qualified subscription catalog. This is the appropriate existing entry for the tested narrow navigation fix; it is not a recommendation to buy or install another model. One short reason, such as `One-file navigation fix`. `Change` exposes provider/model/effort/profile choices. If only one entry is supported, say so inside the picker.

Use **Focused / Deep** as the two visible labels; retain `focused` / `investigate` as compatible stored values. A short optional `i` explains their difference. They describe engineering depth, not permission to skip approval. Show the estimated token range, editable authorized limit, enforcement mode, maximum native jobs/repairs and elapsed-time stop. Values are proposed until the owner starts; no default silently increases an installed limit. Missing/unqualified recommendations remain actionable refusal states, never silent provider substitution.

Concurrency stays out of the primary path for a single run. `Ready`, `Waiting for DLV-…`, or `Scope needed` is sufficient. In `Capacity`, distinguish active native jobs, writers and shared resource allowance. Include the unit and affected runs. These counters never stand in for run-specific budget enforcement.

### Run and review

Use a stable heading with item, attempt, **current outcome**, short next action and usage. Keep chronological stages as navigation; do not show completed stages as a claim of application. Tabs: **Plan · Changes · Checks · Activity**. Usage is persistent in the header with a detail disclosure, rather than a competing generic Cost table.

The current task decides which tab opens:

- Awaiting plan → full plan reader. Outcome, scope, steps, checks, risks and unresolved questions are readable before the Approve/Revise controls. Show revision, author/time and exactly what approval covers. No forced scrolling ceremony or “I read it” checkbox.
- Candidate ready → Changes, with a clear current application state (`Not applied`, `Applied`, `Rolled back`, `Partly restored`). Two distinct primary actions remain: approving a plan and applying a reviewed candidate.
- Check problem → Checks, focused on the blocking criterion, its evidence and the next useful action.
- Running → current phase, observed activity and usage freshness. `Last observed` is honest when streams lag; no fake live animation or progress percentage.

`Plan.md` is a deterministic Markdown representation of the immutable stored plan revision, not another editable source of authority. Allow full view, copy/download and earlier revisions. For a long plan, preserve all authoritative text; the current normalization clips lists at 20, text at 800 and raw reply at 8,000 characters (`interaction.mjs:39`). Do not silently approve a clipped plan: retain the original as a hash-bound artifact and explicitly reject/label truncation. An edited plan or scope/limit change gets a new revision and invalidates the older approval.

Changes show filename, Created/Modified/Deleted, line counts and a unified diff. Desktop may offer split view; mobile defaults to unified. The file shown is the frozen candidate versus its actual launch/checkpoint before-image. Do not calculate it against Git HEAD or today's live file. Offer a separate `Current source` comparison when useful; never replace the approved diff silently.

Checks show criterion title, Passed/Failed/Couldn’t verify/Not tested/Stale, actual counts, check scope and a log disclosure. `Recheck` reruns trusted checks; `Revise` sends recorded findings into a bounded candidate revision; `Check status` resolves a command whose response is unknown. Unknown receipt state is not execution failure. A repeated deterministic parser failure should say `Same check issue` and direct to evidence, not create the illusion that another model attempt is fixing it.

### Responsive contract

- **Desktop 1280–1920px:** use available width with a reading pane and a 300–360px summary rail. Main text approximately 65–90 characters per line; no wide empty gutters while the plan remains compressed. Diff may use the full content width.
- **Tablet 768–1024px:** reduce to one main pane when the rail compromises reading. Keep selection and primary action in view without overlapping content.
- **Phone 320/390/430px:** one column, comfortably sized text, safe-area-aware action bar, compact tab strip and full-screen artifact/check detail. Keyboard and bottom navigation must not cover controls.
- Body and input text **16px minimum**; decision labels and interactive disclosure text at least 14px; secondary metadata at least 12px. Do not globally enlarge a root font while retaining 9px overrides. Touch actions at least 44×44px. At 200% zoom the page reflows; only a deliberately labeled code/diff pane may scroll horizontally.
- Reuse current theme tokens and opaque dialogs/popovers. Check all four palettes for contrast, two in the full walkthrough. Status includes words/icons, not color alone. Keyboard focus returns to its triggering control; dialogs trap focus and Escape cancels. Reduced-motion preferences remain respected.
- Product copy stays short under Hard Rule 28. Put diagnostics and rationale behind `i` or disclosures. This detailed plan is engineering documentation, not text to paste into the UI.

## 5. Implementation packets

### A. Correct resource accounting — DLV-119

**Files:** `scripts/delivery-v2/jobs.mjs`, `adapters/codex.mjs`, `adapters/claude.mjs`, `store.mjs`, `journey.mjs`; `scripts/pm/app/v2model.ts`, `types.ts`; shared PM metrics/relay consumers where they sum usage. Tests in `tests/delivery-v2/` and `tests/pm-ui/`.

Introduce one provider-aware normalized usage contract shared by run display, admission, fleet capacity, dashboard and exports. Retain raw readings, inclusion semantics, source provider/SDK version, reading identity and normalization version. Input/output totals and cached/reasoning subsets must not be independently summed. Preserve unknown and partial readings, detect cumulative resets/replays, and never coerce a missing category to a claimed complete measurement. Include Claude cache creation when its raw protocol supplies it; do not apply OpenAI's formula blindly.

Existing Results remain immutable historical evidence. Add a recomputed projection with normalization version and `Previously reported` disclosure; do not rewrite receipts or forgive an overrun silently. Test this run's saved counters, duplicate replay, resumed thread, unknown usage, both providers and consistency of every consumer. Expected normalized interpretation for this run: **284,243**, with the raw historic **482,416** retained.

### B. Enforce visible per-run limits — DLV-114, depends on DLV-119

**Files:** `policy.mjs`, `contracts.mjs`, `jobs.mjs`, `journey.mjs`, both adapters, `worker/runner.mjs`, `worker-boundary.mjs`, `qualification.mjs`; launch/types/transport and relay command validation. Connect live readings through DLV-109's event path.

Define separate fields for token estimate, authorized stop threshold, proven hard ceiling (optional), native-job limit, repair limit, wall-time limit and shared fleet allowance. Bind the accepted resource revision to the run/grant. Validate finite positive values server-side, within installation authority. No silent `Default` or unlimited launch when the owner expects a cap.

The backend must advertise evidence-backed enforcement capability:

| Capability | Permitted claim and behavior |
|---|---|
| Proven whole-job upper bound | A hard ceiling is allowed only when input, generated output, internal calls and permitted subordinate work all fit within the remaining bound. Reserve this maximum atomically before dispatch. |
| Live/intermediate readings with observed stop | Stop threshold; show maximum qualified overshoot if known. At the threshold, signal cancellation, stop the worker and wait for observed termination. A completed overrun cannot be undone. |
| End-of-job readings only | No live token cap claim. Refuse a requested hard-cap run; offer a clearly separate threshold mode only if existing owner policy authorizes it. Do not switch modes automatically. |

At an initial warning level (proposed **80%**, persisted as policy), issue one durable event per budget revision and surface `Near limit`. At 100%, stop further dispatch, request stop for active work, retain recoverable artifacts and show `Stopping` until observed. Unknown or disconnected jobs keep their reservations. Token sampling and control must run inside the native loop/boundary; a React poll or a completion handler cannot implement enforcement. `maxTurns` alone is not a token bound; Codex's current `runStreamed` path has no such cap forwarded. Prove supported controls before displaying them.

Escalation means a decision: `Stop`, `Increase limit`, `Change model`, or `Reduce scope`. Only explicit owner action changes authority; new scope/model/effort/limits get a recorded revision and necessary reapproval. Do not automatically buy credits, retry on another provider or select a stronger model. Zero additional spending remains a separate subscription-auth restriction, not proof of a hard token bound.

Tests must stream a crossing **before native completion**, prove observed worker stop, no automatic second job, accounting settlement and restart recovery. Exercise no-stream capability refusal, burst/overshoot, duplicate readings, exhausted quota and two runs competing for the last fleet reservation. A synthetic event-only unit test does not qualify a production hard cap.

### C. Confirm and explain rollback — DLV-115

**Files:** `apply.mjs`, `journey.mjs`, `entry.mjs`, `store.mjs`; `DeliveryV2.tsx`, `v2model.ts`, `types.ts`, transport and relay validators; `tests/delivery-v2/apply.test.ts` and UI interaction tests.

Reuse the protected integrator. Add a **read-only rollback preview** returning application ID, current state/revision, exact operations, before/after identities, detected conflicts and a digest. UI dialog: `Roll back?`, filename list, Restore/Delete/Recreate counts, then `Cancel` and `Roll back`. Default focus is Cancel. Opening/dismissing the dialog has no filesystem effect. The user's explicit requirement for confirmation applies here despite ordinary app Undo preferences.

Confirmation names the application, preview digest, expected revision and durable command ID. Server rechecks state and every affected path immediately before any inverse operation. A stale preview returns a fresh conflict for review. Preserve the existing compare-before-restore guard; never overwrite later owner edits. Revalidate path confinement at rollback as well as Apply, including links/junctions, case collisions and symlink replacement after preview.

After completion, show restored/deleted/recreated files and conflicts/failures. `Partly restored` is distinct from `Rolled back`. Keep candidate and application history. Repeated confirmation resolves the same receipt. Test modified file restoration, **true new file removal**, deleted file recreation, pre-existing untracked file survival, rename-as-delete/add, foreign edit refusal, interrupted inverse, stale preview and double click/reconnect. Do not delete this run's Work.tsx as a supposed repair.

### D. Make plans and changes reviewable — DLV-116

**Files:** `interaction.mjs`, `journey.mjs`, `candidate.mjs`, `entry.mjs`, `store.mjs`, `apply.mjs`; `DeliveryV2.tsx`, `components.tsx`, `types.ts`, transport implementations. Suggested new focused components: `DeliveryPlan.tsx` and `DeliveryChanges.tsx` under `scripts/pm/app/`; these names are proposed, not existing files.

Build the artifact/read APIs before the UI. Resolve an artifact through run ID + immutable plan/candidate/result identity + allowlisted path. Verify hashes and confinement. No caller-supplied absolute path or arbitrary host-file reader. Return content metadata, MIME/encoding, size, pagination and explicit truncation; treat source/Markdown as untrusted display content. Large/binary files get honest metadata and bounded download rather than a fake empty diff.

Ensure before-images are retained independently of the current checkout and available **before Apply**. Reuse captured base material if durable; the current manifest's hashes alone cannot reconstruct deleted/replaced bytes. Handle existing runs with missing base bytes as `Original unavailable`, never manufacture a diff from Git HEAD. Local and relay transport must share the same artifact identity and page contract; relay caches are owner/installation-bound and never silently truncate a plan being approved.

Put approval with the plan reader, bound to contract/plan/grant revisions and the exact full artifact digest. Existing old approvals are history, not permission to approve a newly edited plan. Export deterministic `plan-r1.md`; expose feedback and revision history after run closure. Show candidate lineage, text diff and distinct base-versus-current comparisons. Acceptance: the owner can read the whole plan, reject/revise it, inspect the exact change, then apply without visiting a terminal or guessing a path.

### E. Explain checks and make revisions useful — DLV-112/113

The ANSI/count parser patch is **already in the current working tree**, and the targeted suites passed. Do not reimplement it or weaken zero/unknown-test evidence. Finish DLV-112's owner-facing scope: expose criterion name, runner/command, candidate/hash, checker/observer version, timestamps, counts, exit status and readable bounded logs. Today `journey.detail` includes counts/exit code, but the screen renders only ID/state. Logs need an authenticated evidence reader, sharing packet D's artifact mechanism.

Represent failure layers separately: test assertion failed; process unavailable/interrupted; output unreadable; evidence stale; criteria not run. Preserve exact internal reason codes. Result v1–v4 in this trial should read `Test count unreadable`; v5 should show the new evidence and why it supersedes v4. `Review checks` opens detail; `Recheck` runs checks without a native model call; `Check status` asks about one pending command. Command buttons show pending/received/refused/result state and do not leave the owner guessing.

DLV-113 adds `Revise` from candidate review with recorded findings and an explicit bounded dispatch. A queued Guidance message is not delivered to a running model merely because it was saved. Show `Saved for next step`, `Sent`, or `Cannot send` from actual receipts. Revision preserves C1 and creates C2, binds findings to evidence, rechecks resource authority, and renews approval when scope or other consequential authority changes. Handle closed verified runs with a linked successor/revision path rather than mutating approved C1. No repeated paid/model attempt to solve a deterministic evidence-parser issue.

### F. Recommend settings and make profiles real — DLV-117/118

**DLV-117 files:** `service.mjs`, `policy.mjs`, `work-ref.mjs`, `coordination.mjs`, `journey.mjs`, launch and types. **DLV-118 files:** `interaction.mjs`, `policy.mjs`, `journey.mjs`, snapshot/worker-boundary setup and tests.

Use an explainable, deterministic recommendation from declared kind, acceptance, known paths, risk, dependencies and estimated scope. Intersect it with qualified, subscription-ready model/effort capabilities. Persist the recommendation, reason, source facts, selected override and policy version. Do not spend a model call to decide which model should fix a one-line link. Reuse relevant existing classifier knowledge only after validating its V1 assumptions; do not import the V1 workflow wholesale.

An illustrative policy table to implement and calibrate, **not a measured forecast or spending approval**:

| Profile | Entry condition | Engineering contract |
|---|---|---|
| Focused | Reproduced defect, narrow known scope, no unresolved high-risk decision | Compact read packet; one plan + one implementation job; targeted checks in the prepared checker; zero automatic repair by default. Escalate if scope/risk changes. |
| Deep | Unknown cause, cross-module interaction or material design choice | Read-only investigation first; explicit hypothesis/scope/check proposal; bounded stages and checkpoint; build only after plan approval. |

Profile fields must actually drive context selection, available check inventory, job/repair limits and escalation. Keep exact invariant/docs pointers and necessary dependency closure in the worker. Present executable checks and responsible environment to the agent: worker checks versus protected checker versus owner/device acceptance. If typecheck is required, provision it in the checker or record it as a missing obligation before approval; do not instruct repeated attempts at absent tools.

Measure instruction size, supplied file bytes, observed native calls/usage and unsuccessful tool attempts. This run's full raw per-call transcript is not available; establish the baseline from retained counters and avoid invented attribution. The first comparison uses the **same one-line fixture and same acceptance**, with fewer wasted commands and consumption demonstrably below the corrected 284,243-token baseline. Any new numeric target requires fixture/pilot evidence and owner-approved limits. Do not reduce cost by removing approval, confinement, protected checks or required verification.

### G. Responsive workspace and permanent attempt history — R64/R55

**R64:** `scripts/pm/app/DeliveryV2.tsx`, `delivery.css`, `responsive.css`, narrowly scoped `styles.css`, shared components/types. Implement §4 with clear section purposes: Plan = proposed work; Changes = bytes; Checks = evidence; Activity = timeline; Usage = consumption. Application state is authoritative in the heading. `Work complete` currently means the contract's requested disposition was met; for this run that was only a verified candidate. Display `Candidate verified` and `Rolled back` separately, never imply the checklist item is shipped.

**R55:** `Work.tsx`, `Home.tsx`, `Delivery.tsx`, `state.tsx`, `model.ts`, `v2model.ts`, `types.ts`; `journey.mjs`/store projections plus local/relay read models. Resolve history by stable WorkRef/campaign/normalized ID, not the current checkbox ordinal or only the active V1 list. Show **all attempts**, newest first, including cancelled/failed/closed/rolled-back runs. A missing or shipped checklist row must still resolve an identity/history shell.

Use `Attempt 1`, `Attempt 2`, with date, executor/settings, actual outcome and usage; within an attempt show plan r1/r2, candidate C1/C2, result v1/v2 and applications/rollbacks. These are different dimensions: five Results are not five deliveries, and a rollback is not another attempt. Add durable `parent_run_id`/relation metadata only for explicit retry/supersede relationships; do not infer ancestry from similar titles. Existing runs can be ordered without invented ancestry.

Every item has `Delivery history` and a stable run link; active work also has `Open delivery`. Run has an item link. Preserve Back/Forward, originating search/filter, selected tab and selected attempt. Direct URL, refresh and a second tab must work. Avoid recursive growth of `from=` URLs by keeping one sanitized return route per navigation transition. Delivery history is shown as an ordinary visible section, with filters/pagination as needed. Read-only/offline modes show saved provenance and disable state-changing commands without hiding records. No runtime retention or deletion change is part of this hotfix.

## 6. Sequence and boundaries

| Order | Canonical outcomes | Exit condition |
|---|---|---|
| 1 — Restore safety/truth | DLV-119, then DLV-114; DLV-115 can be implemented independently | Correct totals everywhere; honestly enforced limit mode; confirmed, conflict-safe rollback. No new capped owner run before this gate. |
| 2 — Restore owner control | DLV-116; finish DLV-112; DLV-113 | Full plan/diff/check review and useful revision, with durable commands and immutable generations. |
| 3 — Restore usability/efficiency | R64, R55, DLV-117, DLV-118; integrate DLV-109 | Desktop/mobile readable, histories recoverable, recommendations clear, Focused policy measurably smaller. |
| 4 — Prove the whole path | DLV-108/109 recovery/live evidence plus owner acceptance under existing DLV-97/107/100 | Exact walkthrough and failure matrix below pass; campaign records reconcile source, fixtures and owner trial separately. |

These are implementation packets, not one giant Delivery prompt. Complete a bounded packet with its tests before launching the next. UI work can use saved fixtures while worker enforcement is qualified. Dependencies do not authorize extra agents, parallel native jobs or additional model spend.

Keep DLV-107 open after the successful rollback: the link defect is back in the checkout. Mark the candidate as having passed its limited checks, not the product bug as shipped. Update old “no V2 run exists” summaries with dated evidence, preserving original historical statements. Do not sweep DLV-112 merely because its parser component landed; the expanded readable-evidence acceptance remains pending.

## 7. Failure behavior to specify before coding

- Offline/disconnected: retain last observed state and timestamp; don't claim a run stopped or an approval failed. Recover the same command ID after reconnect. No automatic authority increase or replayed rollback.
- Restart at a durable boundary: recover terminal native jobs into plan/result exactly once (DLV-108); keep output until transition commits. Usage, checks and PM projection must not duplicate.
- Policy/model/profile changed while a form is open: reject a stale recommendation/approval with changed fields; preserve the draft. An old empty/default model must not silently resolve differently at dispatch.
- Plan/diff changed during review: immutable identity changes; owner sees a fresh revision. A local UI acknowledgment is never enough to bypass the server check.
- Source changed before Apply/rollback: preview and before/after guards refuse clobbering. A partial rollback lists files still changed; preserve journal recovery.
- Work shipped/cancelled/reopened: item identity and attempt history survive; a failed delivery never cancels the item by implication.
- Unknown usage: `Unknown` with its evidence gap, not zero or an unqualified numeric forecast. Subscription quota is neither raw token total nor API-equivalent USD.
- Existing protected-path, auth, CSRF, confinement and subscription restrictions stay in force across new artifact/preview/revision routes. New routes must be represented in the transport capability contract and relay allowlist, not assembled ad hoc by views.

## 8. Acceptance and verification

### Automated gates

1. **Recorded-run fixtures:** redacted fixture of this run's two jobs, plan, five Results, C1 and application/rollback. Assert the correct history dimensions, default tab, active action and normalized usage. Preserve UTC source timestamps; render local times with timezone context.
2. **Approval:** full plan is visible before Approve; malformed/truncated/unavailable plans cannot be silently approved; Revise makes a new revision; stale/double submissions do not write or dispatch twice.
3. **Artifacts:** modified/new/deleted/untracked/binary/large files; hash mismatch; missing base bytes; path traversal, encoded paths, case collisions and junctions; local/relay same identities and explicit pagination.
4. **Checks:** ANSI output, explicit observer counts, zero tests, unknown output, failing assertion, missing tool, stale evidence. Recheck has no provider dispatch. UI displays why the state changed, or why it did not.
5. **Resources:** provider-specific inclusion rules, cache creation, cumulative resets/replay, mid-job crossing and observed stop, unknown usage, no hard-bound capability, owner-approved increase, no unapproved escalation and fleet admission races.
6. **Rollback:** cancel sends nothing; true creation removed; existing untracked file restored; deletion recreated; later edits preserved; stale preview refused; partial/in-progress inverse and restart recover accurately.
7. **History/navigation:** active/cancelled/failed/verified/applied/rolled-back attempts; shipped/discarded item URLs; normalized suffix IDs and campaigns containing spaces/`&`; Back/Forward, reload, deep link, second tab and saved offline history.
8. **Build/invariants:** targeted `tests/delivery-v2/`, `tests/pm-ui/` and relay suites appropriate to edits, `pnpm typecheck`, lint for affected files, `pnpm pm:lint`, `pnpm pm:check-docs`. Read opt-in test scope before running anything that launches a native provider/container. Update Feature Map, existing `pm`/`pm-live` Atlas pages and API/transport documentation with implemented behavior.

### Mandatory owner walkthrough

Use a synthetic source fixture first; no real backlog Ship/Discard action is needed. Exercise at 1440×900, 1920×1080, 768px, 390×844 and 320px; include 200% desktop zoom, keyboard navigation, a long plan/diff, mobile keyboard and two themes. Verify the remaining themes' contrast. Test a real phone relay only after its owner-applied prerequisites; a narrow desktop window is not remote acceptance.

Walk this sequence without a terminal: **Work → recommendation/limits → Start → read plan → Revise → read changed plan → Approve → see live activity/usage → inspect Changes and Checks → Apply → Back to item → reopen attempt → Roll back → Cancel → Roll back → Confirm → inspect exact inverse → reopen history after refresh.**

Then exceed a small synthetic token threshold, lose a command response, disconnect the laptop and inject a post-job restart. Each must end in one comprehensible state with one useful next action, preserved artifacts and no duplicate dispatch. Only after these gates use a single owner-started narrow subscription trial, with a proven resource mode and explicit authority. Do not rerun the whole hotfix as its own first live test.

### Verification performed for this plan

- Read-only inspection of the actual local run and application journal; exact one-line before/after diff and current-file hash verified.
- Reviewed routing, launch, plan/control, candidate, resource, checker, Apply/rollback and Work history paths. Queried the existing Graphify graph; it predates Delivery V2 and has no useful current execution map, so it was not used as implementation evidence.
- `tests/delivery-v2/evidence.test.ts`, `tests/delivery-v2/apply.test.ts`, `tests/pm-ui/delivery-v2-model.test.ts`: **3 files / 53 tests passed**. Captured run took 5.20s. PowerShell returned a nonzero wrapper status for Node's experimental SQLite warning under stream redirection; Vitest's captured summary itself reports all tests passing. No provider or production DB was used.
- PM lint passed with zero errors/warnings; PM documentation checks passed for 11 campaign pairs, 252 unique tasks and 35 active Markdown files. The local read-only dashboard was regenerated; its first build hit sandbox ancestor-directory access, and the permitted rerun succeeded. Nothing was published.
- Browser runtime discovery returned no available browsers. No visual/mobile acceptance, new native trial, paid usage, deployment, rollback operation or production write was performed. Application typecheck/full lint are not claimed for this documentation-only deliverable.

## 9. Evidence index and retirement

Line references describe the inspected working tree; use symbols after later edits:

| Evidence | Source |
|---|---|
| Launch profile suggestions/defaults; no run token input | `scripts/pm/app/DeliveryV2.tsx:238`, `:274`, `:335`; `scripts/delivery-v2/service.mjs:238` |
| Same initial investigation path | `scripts/delivery-v2/journey.mjs:871`; `scripts/delivery-v2/policy.mjs:754`, `:864`; `interaction.mjs:303` |
| Approval before content, simplified checks/diff, direct rollback | `DeliveryV2.tsx:467`, `:540`, `:587`, `:760`, `:826`, `:909` |
| Valid-plan raw text suppressed, evidence fields and application projection | `scripts/delivery-v2/journey.mjs:2534`, `:2579`, `:2633` |
| Token addition and completion-only native usage | `scripts/delivery-v2/jobs.mjs:130`, `:203`, `:530`; `adapters/codex.mjs:145`, `:432`; `scripts/pm/app/v2model.ts:81` |
| Native runner capability boundary | `scripts/delivery-v2/worker/runner.mjs:117`; `worker-boundary.mjs:353`; `adapters/claude.mjs:243` |
| Parser patch currently present | `scripts/delivery-v2/checks.mjs:330` |
| Correct baseline-relative classification and inverse | `scripts/delivery-v2/candidate.mjs:145`; `apply.mjs:435`; application `app-8c52911738e3` |
| Small typography and narrow plan/check hierarchy | `scripts/pm/app/styles.css:17`; `delivery.css:578`, `:624`, `:675`, `:703`; `responsive.css:67` |
| Work only follows active V1 | `scripts/pm/app/state.tsx:141`; `model.ts:129`; `Work.tsx:86`; V2 separately in `Delivery.tsx:34` |
| Existing ownership/contracts | [Delivery Master Book](<../Delivery/Delivery — Master Book.md>), [PM Tooling Master Book](<../PM Tooling/PM Tooling — Master Book.md>), [Command Center](<Command Center.md>), [Conventions](<../_Conventions.md>) |

Archive this plan under `_Archive/Plans/` only after the canonical outcomes and owner acceptance are reconciled, or an explicitly adopted replacement supersedes it. Preserve this run's measured baseline, the 13-point disposition and remaining limitations. Writing the plan is not shipping these fixes.
