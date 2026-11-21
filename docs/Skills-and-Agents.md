# Skills & Agents

Reference for the engineer playbooks (skills) and custom agents registered in this repo.

## Skills

Located in `.claude/skills/<name>/SKILL.md`.

`pnpm sync:ai` generates all `.agents/skills/` files, `.codex/hooks/` scripts,
and `.codex/hooks.json` from `.claude/` alongside the three instruction mirrors.
Edit the Claude sources; `pnpm sync:ai:check` checks parity without writing.
Unexpected files in generated directories fail the check and must be removed explicitly.

Codex CLI 0.145.0 was observed loading `.codex/hooks.json` (not
`.codex/settings.json`) via `hooks/list` on 2026-11-10. Its generated command
resolves the Git root, then `scripts/run-agent-hook.mjs` runs the matching Claude
wiring against the generated Codex scripts. Bash, Node and jq are required;
Windows uses the Bash from the active Git installation rather than WSL.
Commands work from repo subdirectories and paths containing spaces.
The Windows command explicitly forwards `$LASTEXITCODE`: PowerShell otherwise
maps the guard's blocking exit 2 to exit 1, which Codex treats as a hook error.

New or changed Codex hook definitions require review in `/hooks` before they
run ([official hook documentation](https://learn.chatgpt.com/docs/hooks)).
Generated parity does not grant trust or translate Claude permissions into a
Codex permission policy. `.claude/settings.local.json` remains committed by
owner choice (2026-11-10). No provider calls are needed for parity checks.

**R130 recorder correction (2026-11-16):** the Stop wrapper now imports both
Claude and Codex transcripts automatically. Previously it explicitly excluded
Codex, so even a recorded Codex Stop could not create a stored session. Native
activation also needs approved SessionStart and Stop entries in `/hooks`; the
observed workstation trust configuration approved only tool hooks. No trust
entries are created by the recorder. Historical missing events stay unknown.

At automatic Stop, an unchanged HEAD with a dirty tree and a recorded
SessionStart is evaluated against the current working tree, including untracked
source files. The report labels this snapshot **uncommitted** and warns that it
includes pre-existing changes. Ordinary historical imports keep their committed
range unless the current working-tree snapshot is explicitly requested. Model
and tier attribution follow the model responsible for most assistant turns.

| Skill                | What it does                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `add-feature`        | Playbook for adding a feature to an existing module as a vertical slice (DB → API → types → hooks → UI → wiring).   |
| `api-route`          | Recipe and verified template for routes under `src/app/api/` (auth → Zod → household linking → DB → error mapping). |
| `cache-invalidation` | Rules for correct TanStack Query cache invalidation in mutations and feature hooks.                                 |
| `data-repair`        | Safe workflow for production data fixes (inspect, dry-run, backup, idempotent fix, verify, rollback).               |
| `db-migration`       | Database change workflow: write the migration runbook first, update `schema.sql`, pick a safe RLS pattern.          |
| `era-wire`           | Wires an already-shipped manual feature into the ERA command bar (grammar + adapter + Gym case).                    |
| `finish-task`        | Definition-of-done gate run before completing any task (self-review, typecheck/lint/tests, docs, PM update).        |
| `fix-bug`            | Evidence-first debugging playbook (reproduce, locate, root-cause with proof, minimal fix, verify, PM trace).        |
| `money-rules`        | Financial-correctness invariants for any money module, with a required before/after balance example and test.       |
| `new-module`         | Scaffolds a new Standalone or Junction module and keeps all six index surfaces in sync.                             |
| `pwa-install`        | Rules for the many installable PWAs on one origin (manifests, "already installed" errors).                          |
| `recurrence-safety`  | Safety rules for both recurrence systems to prevent duplicate generation of future instances.                       |
| `skill-factory`      | Meta-skill for authoring a new repo skill in house style and registering it.                                        |
| `start-task`         | Operating protocol and task router to run at the start of any coding task.                                          |
| `timezone-handling`  | UTC storage and DST handling rules for dates, RRule/DTSTART, and mutations.                                         |
| `triage-inbox`       | Files raw PM Inbox captures into canonical outcomes/decisions without implementing product work.                    |
| `ui-guardrails`      | UI/UX hard rules (theming, color identity, opaque panels, header offsets, toasts, mobile-first).                    |
| `wizard`             | Runs interleaved AI/owner setup or debug sessions as a shared step-by-step checklist with verification gates.       |

## Hooks

Wired in `.claude/settings.json`; scripts in `.claude/hooks/`. Each command runs through `scripts/os/hook.mjs` (the A3 recorder) and behaves the same with it removed.

| Event | Script | What it does | Blocks? |
| ----- | ------ | ------------ | ------- |
| SessionStart | `session-brief.sh` | Prints a line only when something is stale: no checklist updated for 14 days, or `migrations/db-state.json` missing or older than 30 days (Hard Rule 27). Every folder with a `4 - Checklist.md` counts as a campaign. | No |
| PreToolUse (Edit, Write) | `block-ui-dir.sh` | Refuses edits under `src/components/ui/` (Hard Rule 11). | Yes |
| PostToolUse (Edit, Write) | `sync-ai-mirrors.mjs --hook` | Regenerates the instruction mirrors, `.agents/skills/` and `.codex/` after an edit to `CLAUDE.md` or `.claude/`. | No |
| PostToolUse (Edit, Write) | `update-atlas.sh` | Rebuilds `public/atlas/atlas.json` after an Atlas entry changes (Hard Rule 23). | No |
| PostToolUse (Edit, Write) | `check-migration.sh` | Reminds when `schema.sql` and a dated migration are not edited together (Hard Rule 24). | No |
| Stop | `check-pm-update.sh` | Once per turn, blocks finishing when `src/` or `migrations/` changed and no PM file did; the message points to `pnpm pm:ship <ID>` (Hard Rule 25). | Once |

`pre-commit.sh` is run by Husky, not by an agent event. Its test subprocess clears the repository-local variables listed by `git rev-parse --local-env-vars` (R119, 2026-11-15), so fixture repositories cannot reuse the committing worktree's index, directory or `-c` configuration. The surrounding hook retains its Git context for staged-file linting. The two keyword-matching `UserPromptSubmit` reminders (Feature Map, graphify) were removed on 2026-11-11: `CLAUDE.md` and `start-task` already carry the Feature Map rule, and the keyword match fired on unrelated prompts.

## Agentic OS setup tools (A1 / R93)

`pnpm os:scan` writes `.os/setup.json` (`os/setup@1`) and `.os/setup.sha256`.
The registry contains rules (including module rules), per-agent skills/hooks,
permissions, instruction mirrors, package checks, tiers, routes and relations.
Its fingerprint hashes content, excluding the generation time and commit;
line endings are normalized for hashing, while mirror bodies are compared byte for byte.
Local permission commands are redacted. No user-level configuration, network,
provider, product data or database is accessed.

`pnpm os:check` scans current files without writing them, lists the thirteen
conflict classes, and exits 1 on errors. On a fresh checkout it needs no saved
registry; if one exists, stale/corrupt registry or fingerprint files also fail.
Run `os:scan` after setup edits; remove a corrupt `.os/setup.json` before
rebuilding. `.os/` is disposable and ignored by Git. Rule tombstones are retained
when rebuilding an existing registry. Unknown versions are refused.

Warnings do not fail CI. `BASELINE` stays unknown without recorded whole-tree
evidence. A2 evaluates diffs and retains unknown baseline counts. Contradiction
queries cover owned module/campaign lists, platform and campaign-reading claims.
Shared machine-specific permissions, missing hooks and parity errors remain
actionable. Workstation-local permissions and the owner's tracked-local choice
appear as informational notes. The CI job runs `os:check` with history for the
`e5f537a` hand-inventory acceptance fixture.

Verification: `pnpm vitest run tests/os` (A0–A2 fixtures).

### Setup repairs and rule coverage (R112)

The November 14 repair moved two Windows-specific grants from shared settings
into local settings with identical permission values. The scanner resolves the
generated pre-commit mirror through its wired canonical source and detects
missing referenced hook scripts. Launch declarations use syntax inspection to
recognize the confined worker's explicit isolation and Local's project-loading
branch. Missing Local setup or weakened declarations still produce findings.
The era-wire skill now references the `CLAUDE_MID` tier alias.

Advisory detectors retain their scope and remediation. A rule claiming stronger
enforcement than its guard supplies produces a warning. Conditional Stop guards
have explicit metadata. Four judgment requirements share one registry between
Setup and session scorecards, covering interaction semantics, icon selection,
header clearance and bundled reads. The scan retains all nineteen module rules
with their authored source paths.

Setup opens with scan health and hard-rule coverage. Rule coverage exposes guard
sources, fixture counts, individual baseline evidence, recorded session links
and manual review steps. Missing, disabled, malformed or mismatched guards are
excluded from valid coverage. Automated checks include advisory detectors whose
limited scope is shown in their evidence. Configuration has independent agent
and category filters, selection and search. Conflicts displays errors and
warnings first, with informational notes under disclosure. Old `tab=map&rule=`
links open the matching rule detail. Module rules open from Configuration.

The fresh source scan after repair has zero errors, zero warnings and twelve
informational facts. Refresh the saved registry after edits with `pnpm os:scan`.
Configuration presence establishes static coverage. Runtime hook loading and
physical-device acceptance require their own observations.

Verification on November 14 includes 193 Agentic OS tests, 74 PM regression
tests, typecheck, changed-file lint, mirror parity and PM build. The browser
fixture exercises desktop and 390 px Blue/Pink with real scan data and injected
broken guards, conflicts and missing snapshots. The local server's served
JavaScript and CSS match the verified build. Evidence is in
`.pm/setup-evidence/result.json` and `.pm/setup-evidence/served.json`.

## Agentic OS diff evaluation (A2 / R94)

Run `pnpm os:eval "<base>..<head>"`, for example
`pnpm os:eval "HEAD~1..HEAD"`. Both ends must resolve to commits. Two-dot
comparison uses those exact snapshots, including for merge commits; it does not
include staged, unstaged or untracked changes. Run from any repo subdirectory.
Git and the installed TypeScript parser are required; no source is executed,
network is accessed, checks are launched, or report/session store is written.

Eight versioned modules cover HR-22, HR-6, HR-19, HR-7, HR-24, HR-25, HR-8 and
HR-12. Each loads only after its fail/pass/n/a JSON fixtures succeed. The text
report prints every rule's verdict, detector/version, added/removed counts, file,
1-based line, excerpt and base/head side. `--json` returns `os/evaluation@1` with
`os/verdict@1` rule rows and all findings. N/a locations are null.

Exit codes: **0** for pass, improved or n/a; **1** for any rule failure; **2**
for an invalid range, Git/parser error or broken detector contract. No partial
report is emitted on an input error. New failures take priority over removals.
Equivalent syntax is matched as a multiset across each changed file's snapshots:
old debt and formatting-only edits pass, removals improve, new occurrences fail.
Renames retain base paths for removed findings. HR-24/25 inspect the range's
file relationship and trace rather than historical violation counts.

Static scope and limits:

- HR-22/6 cover the documented client directories, `page` files and leading
  `use client` modules. Source test/spec/fixture files are excluded. HR-6 covers
  direct `fetch` calls with a literal/resolvable mutation method, and `safeFetch`
  (including import aliases) for AI/ask/upload/import API paths or FormData
  bodies lacking `timeoutMs`. Computed methods, arbitrary wrapper functions,
  dynamic URLs/options and inter-file data flow need review.
- HR-19 checks JSX `type="number"` and literal JSX expressions outside the
  protected UI directory; HR-7 checks direct/computed `navigator.onLine` outside
  `connectivityManager.ts`. Aliased/destructured browser globals are not traced.
- HR-8 checks changed cron routes for exported `maxDuration = 60`, an imported
  admin call, and per-handler rejection of unset secrets and mismatched Bearer
  authorization. It recognizes direct `process.env.CRON_SECRET`/local aliases,
  `headers.get`, rejecting `if` guards and Bearer template literals. Custom auth
  helpers require review. It does not prove control-flow dominance or scheduling.
- HR-12 checks each exported POST/PUT/PATCH/DELETE handler for parse/safeParse
  (including Async) on a schema rooted in Zod or a schema/validation import.
  JSON.parse, comments and unused Zod imports do not satisfy it. Validation in
  external helper calls is not inferred; schema semantics still need review.
- HR-24 requires `schema.sql` and a surviving dated migration in the same diff.
  HR-25 requires a newly changed line naming a canonical work ID in an active
  campaign checklist/Master Book for source/migration changes. Archived prose,
  deleted books and unchanged ID lines do not count. Tooling-only work is n/a.

These are diff checks, not whole-tree baseline counts or proof of correctness.
The existing `os:check` setup errors remain visible. CI evaluates pull requests'
explicit base/head SHAs, even if the independent setup check fails.

Acceptance replay: `pnpm os:eval "bf0ee6ef~1..bf0ee6ef"` must exit **1** and
report HR-22 at `src/components/settings/SettingsDialog.tsx:567`, excerpt
`console.error("Failed to set default income account:", error);`.
`pnpm os:eval "HEAD..HEAD"` must exit **0**, with eight n/a rows. Both are
read-only owner verification steps; neither implies owner acceptance or deployment.
`pnpm vitest run tests/os` includes this historical replay and isolated Git
fixtures for failures, old debt, removals, renames, Unicode/spaced paths, dirty
files, empty ranges and invalid inputs. A3 records these existing verdicts; A4+
remains separate.

## Agentic OS flight recorder (A3 / R95)

Claude's six configured command hooks now call
`node scripts/os/hook.mjs <name> <event> -- <program> [args...]`. The runner
passes the original stdin bytes, stdout, stderr and exit status through, then
appends a versioned, redacted event under `.os/events/`. A failed recorder never
replaces the hook result. SessionStart records the setup fingerprint/counts and
Git base; Stop records the head and attempts ingest in a subprocess with a
20-second deadline. Blocked Stops and `stop_hook_active` retries are recorded.
Codex's generated wiring retains parity and labels its firings Codex; A4 adds an explicit Codex transcript adapter below.

```sh
pnpm os:ingest /path/to/claude-session.jsonl
pnpm os:ingest /path/to/older-session.jsonl --range 'base~1..base'
pnpm os:report <session-id>
pnpm --silent os:report <session-id> > flight-report.md
```

Ingest reads the transcript without modifying it and transactionally replaces
that session's derived rows in `.os/os.db` (Node 22.20 `node:sqlite`, store version
1). Repeated imports replace rows; streaming assistant usage is counted once per
message ID. It records successful Skill invocations and literal skill-file reads
through Read or simple `cat`/`Get-Content` commands, reads before the first edit,
tool/result timings, recognized check observations and usage counters. It does
not store prompts, command bodies, tool output or environment objects. Diagnostic
excerpts are limited to 240 characters; credential patterns and known credential
environment values are redacted before writing. Unknown schemas are refused.

Reports read the store without rerunning anything. Historical transcripts cannot
reconstruct the start-time setup/base, and hook summaries have no exit status;
those fields stay unknown. An explicit range is labelled as such, never inferred
to be the exact session diff. Dirty working-tree edits are outside A2's committed
range. Checks here are transcript observations with explicit exit codes when
available; A3 launches no supervisor checks, model calls or network requests.
A4 below adds process scoring, more detectors and Delivery/Codex adapters. PM.2 remains A5+.

`.os/` is already gitignored. Derived rows persist indefinitely; runner event
files older than 90 days are pruned on the next firing. A best-effort
`.os/recorder-unavailable` marker and missing-lifecycle warnings disclose logging
failures. If the whole directory is unwritable no failure marker can be saved;
the runner still preserves the hook status and emits a short stderr warning.
To remove the recorder, strip `node scripts/os/hook.mjs <name> <event> --` from
the six commands in `.claude/settings.json`, leaving the original commands, and
run `pnpm sync:ai`. The guard scripts have no recorder dependency.

**Verification, 2026-11-11:** `pnpm exec vitest run tests/os` covers byte/exit
equivalence (0/1/2), the real UI guard with/without the wrapper, failed logging,
redaction, automatic Stop ingest, reimport/reopen, transaction rollback and
unsupported schemas. `fixtures/claude-recorded.jsonl` is a privacy-trimmed real
Claude sample; the other transcript fixture is synthetic.

The real November 3 session `4db77e08-0b3e-420d-9434-0458e2dc5e85` was imported
and exported to `.os/reports/R95-real-session.md`: four skills (`start-task`,
`fix-bug`, `money-rules`, `finish-task`), two historical Stop hook summaries and
138 tool calls. The explicitly supplied contemporaneous transfer commit range
`e053ac9f~1..e053ac9f` yields six pass, one improved and one n/a verdict. That
commit includes other work too; this is range evidence, not exact attribution.
Transcript SHA-256: `1d6235f4fa23f6818127f2b402e8e6a32901d739d63740e339ba9124b3556aa1`.
Source bytes remain unchanged. No new native Claude/API session was launched;
runner/lifecycle behavior was exercised through actual local hook processes.

## Agentic OS scorecards (A4 / R96)

A4 stops at command-line tools. Stored sessions have independent **Rules,
Checks, Process, Scope, Autonomy and Cost** panels; there is no combined score
or model review. Deleting the derived `.os/` store still leaves source transcripts,
Git and Delivery/UAT records as truth.

```sh
pnpm os:ingest /path/to/rollout.jsonl --agent codex --item R96 --range 'base..head'
pnpm os:report <session-id>
pnpm os:score item R96
pnpm os:score session delivery:<job-id>
pnpm os:score compare --json
```

The first command imports a confirmed local Codex rollout, never starts Codex.
Optional `--tier ALIAS` records an explicit historical label; otherwise exact
selectors map through Model Registry. Unknown selectors/efforts/classes remain
unknown. The setup fingerprint is retained per session; comparison rows show
fingerprints, setup changes, evidence coverage, tier alias, effort, kind, risk,
item effort and largest file. Every group prints **n**. Groups below ten sessions
show raw rows without rates; no overall ranking is produced at any size.

**Rules and process.** Twenty-one diff detectors and four transcript detectors
have fail/pass/n-a load gates; four rules remain explicit UAT judgment. Advisory
findings never fail the checked-rules panel. The path-to-skill table uses the
Local lane money classifier plus money UI/trip-budget paths; before/after source
also identifies recurrence, mutations/cache invalidation and date work. The
process panel independently checks successful required skill loads, start before
editing, finish after the last edit, ordered Feature Map reads and changed PM
trace. A money-path edit without an observed `money-rules` load fails Process even
when Rules pass. Missing transcript/diff/order evidence stays unknown.

**Delivery.** This is a projection of existing V2 jobs, normalized usage,
supervisor checks, results, decisions and UAT records, not a second run registry.
The adapter opens the supervisor store read-only and refuses live WAL or changed
snapshots; comparisons retain native sessions with an explicit warning when the
Delivery snapshot is unavailable. A native record joins a Delivery job only for
a unique matching native reference and exact base/head range. Transcript check
observations never satisfy supervisor verification. Missing check counts,
added/removed lint warnings and test-addition counts are unknown rather than zero.

Item reports count dispatched sessions, sessions to recorded ship, per-scenario
UAT results, cost, owner response intervals (approximate, from recorded decisions
and UAT receipts), cited bug criteria filed within thirty days, and reverts.
`reworkLines` follows touched line identities through contiguous Git hunks;
missing or noncontiguous history is unknown. `reworkLinesApprox` separately labels
file-overlap churn. Standard Git revert trailers are matched against candidate
commits and the recorded merge; Delivery Undo is also retained. A missing source
is unknown; an incomplete thirty-day observation window is labelled incomplete.
Escapes only count explicit acceptance references and recorded filed dates,
including shipped historical criteria; unfiled/unlinked bugs cannot be measured.

**Static limits.** HR-1 checks `toast.success` action presence; DEC-07 remains open.
HR-13 is an advisory for missing local service-role access evidence; it does not
claim R90's still-unimplemented behavioral authorization contract. HR-20 checks
a versioned list of hot children including the Schedule tables in the performance
reference. No static check proves all ownership, cache, money or SQL behavior.
Tool scans catch known forbidden names/direct command shapes, not arbitrary
encoded programs. Screenshot evidence requires an explicit successful 390px
screenshot-tool viewport. Shell read extraction accepts literal Read/cat/Get-Content
paths and literal exec-command objects; dynamic paths, unknown wrappers and
unrecorded actions are not inferred. Codex usage is deduplicated per response
ID, with cumulative counters only as fallback; cached input/reasoning output are
subsets for Codex and separate token classes for Claude. Prompts, command bodies,
tool output, account IDs and environment objects are not copied into OS rows.

**Verification, 2026-11-11:** `pnpm vitest run tests/os` passes **161 tests in seven files**. Scoped ESLint, `docs:check`, `pm:lint` and `pm:check-docs` pass. `os:scan` registers 25 fixture-backed detectors. `os:check` reports 68 setup errors and 12 warnings; it is deliberately not made green by this delivery. Behavioral tests cover the independent money-process
failure, all detector gates, schema refusal, reimport, small-sample comparisons,
line rework, SQLite read-only projection, candidate-bound checks, direct Git
reverts and privacy. Local real-Codex replay: session
`01a1cc25-6ac7-7743-9313-dd22beb5610f`, `gpt-6.1-sol`, effort high; six observed
skill reads, 26 reads and 85 tool calls. The replay uses an explicitly labelled
empty Git range for adapter evidence, not attribution of the historical diff.
Unchanged transcript SHA-256: `9737bbb595187651c0e84fbad4f1c71a8ce4722bd9e4442453d7bf97c15d278a`. Source hashes before/after and exported reports are kept locally under
`.os/reports/R96/`. No native/API session, database write, browser UI or paid API
pass was launched. The two existing `tests/pm-ui/ship.test.ts:188,192` TS2322 failures
remain outside A4. Scoped lint uses the already installed pnpm plugin directories
via NODE_PATH because this workspace's root plugin links are incomplete.

## PM.2 cockpit (A5 / R97)

**Local session repair, 2026-11-14 (R117):** `LocalRunReview.tsx` restores the existing session visual structure for Local: evidence-backed milestones, selected work brief, four host checks, activity, changes and UAT/Ship controls. Unrun and inconclusive checks stay distinct. The supervisor projects active work without an owner gate, completed failures as terminal and lost preparing/building/checking processes as interrupted. Bridge prioritizes observed execution, then the newest explicit failure/blocked attempt over unrelated waiting UAT; genuine owner review remains yellow. Local Start now reuses Delivery launch receipts for refusal persistence and UUID replay, with fresh worktrees/branches for explicit new attempts after closed runs. The Claude adapter snapshots environment values before freezing options, fixing the real Node `process.env` exception without weakening sandbox settings. Backend changes require an owner restart of the publishing bridge. [Owner cases and limits](Delivery-UAT-Agentic-OS-2026-11-14.md#r117--local-session-review-bridge-states-and-startup-recovery).

**Deliver launch, 2026-11-14 (R113):** Local and Confined wait until explicit Start to show readiness failures. Start stays usable once connected, paired and a selection exists; the server retains all source/authentication/dependency/policy/qualification/test gates. Confined Start includes explicit owner authorization renewal under the durable receipt; a replay cannot renew twice and restricted Steward credentials cannot renew. Claude/Codex SDK presence is separate from Confined policy permission. Game Mode wraps both launch forms in `DeliveryMission.tsx` with orbital artwork, a controls deck and an uncompleted delivery route; reduced motion and hidden/offscreen pause apply. No fabricated progress or extra provider call. UI rebuilds live, but renewal requires a server restart; the current `--bridge` restart is owner-run under Hard Rule 26. Tests and owner cases: [R113 handover](Delivery-UAT-Agentic-OS-2026-11-14.md#r113--deliver-launch-and-game-mode).

**Sessions workspace, 2026-11-14 (R111):** replaces R110's rejected backlog widgets and Item overview / Runs & reviews split. `SessionWorkspace.tsx` and `sessionBoardModel.ts` render Running, Needs you, To test, Waiting, Finished and Unconfirmed. Explicit bindings combine representations of the same session; counts keep session/request/acceptance units separate. Large queues open by campaign, then six cards per page. `ItemUatWizard.tsx` resolves an item's authored Action/Expect steps through `uat-item.mjs`; Start test freezes them into the existing source-bound UAT engine without recording availability, results or signoff. The shared `uat-item-selection.mjs` excludes superseded tests and changed instruction revisions; a new Start creates a fresh attempt without inheriting earlier results. Explicit owner questions remain visible above unfinished UAT preparation. No inference API or parallel acceptance store. Existing frozen handovers work over the relay; new authored-step preparation is laptop-only. Evidence inspection/comparison remains `#/sessions?view=history`. R110's Work planning path and conservative acceptance/reference cards remain. Tests: `session-board.test.ts`, `uat-item.test.ts`, `session-workspace.browser.mjs`; realistic 71-item desktop/390 px Blue/Pink evidence is under `.pm/session-workspace-evidence/`. Physical-phone deployment remains separate.

**Usability refactor, 2026-11-14 (R101):** `CockpitUI.tsx` shares subnavigation, linked metrics and readable evidence disclosures. Bridge separated queues from metrics (superseded by R102 below); Setup opens a searchable agent/category browser with the graph behind Connection map and conflicts grouped in disclosures; Sessions adds search, numbered touch-sized rule links and readable fact panels before raw JSON; Score uses consistent Sessions / Backlog / Arena tabs and structured cohort details. The five primary destinations have equal navigation weight. Routes, records, pairing and Delivery commands retain their contracts. The corrected interaction specification is in Agentic OS `09 - PM.2 Product Design.md`; browser regression: `tests/pm-ui/cockpit-usability.browser.mjs` against the credential-free `a5-browser.mjs --launchpad --arena` fixture. Screenshots and results live in `.pm/r101-evidence/`. Hosted export and physical-phone deployment are separate.

R101 verification: typecheck, PM React build, zero-warning changed-file ESLint, 39 targeted tests in seven files, docs/PM checks and three browser suites pass. The cockpit suite covers 390/768/1024/1440 px in Blue/Pink plus expanded graph, rule evidence, comparison and empty recorder. Full lint completes with 9,285 errors / 51,983 warnings, matching the previously recorded A6 baseline; it is not a clean repository-wide gate. No paid API, production write or native agent launch was used.

Implemented locally 2026-11-14. `pnpm pm` opens **Bridge**; the shared shell has
Bridge / Launch / Sessions / Setup / Score and a one-click **Library**. Existing
Delivery launch is retained. No A6 skill forms/recipes, A7 Arena/game expansion,
detector definitions, migration or second task/session store were added.

`scripts/pm/cockpit.mjs` projects A1 `check()`, A4 `collect()` / `comparisons()`
and explicit A4 PM filing facts. The existing Delivery adapter may evaluate its
known candidate range with the existing detectors; it never launches checks or
providers. `cockpit-reader.mjs` / `cockpit-worker.mjs` coalesce background reads,
publish only changed snapshots and retain labelled stale evidence after a
failure. Server reads do no Git/SQLite work.
OS-only notifications bypass PM observation and Drive publication. Corpus
publishing coalesces an in-flight refresh so the initial pending snapshot cannot
hide the subsequently completed recorder from the phone.
A real local read observed 29 rules, five sessions, three comparison groups and
81 conflicts; the active Delivery
WAL guard refused projection without checkpointing or cleanup. Background
verification completed in 1,852 ms while the host's maximum 10 ms timer gap was
19 ms; a completed snapshot read took 0.007 ms.

Setup uses the registry without `.os/`: six columns, agent/rule chains, shield
levels, recorded baselines, session violation-delta trends, last failure links,
conflicts grouped by class and an explicit prefilled Library Inbox capture.
Sessions exposes the recorded timeline, 29-rule strips, file/line excerpts,
six independent panels, same-item sessions and two-session comparison. A3
retained fingerprint/count snapshots, **not historical source hashes**; their
file-level diff remains unrecorded. Baselines are recorded counts, not a newly
scanned whole-tree time series. Unknown accounting, outcomes, checks, UAT and
missing native observations remain unknown. First-ten cohorts stay raw rows;
later eligible cohort rates use A4's exact comparison helper. Weekly additions
count explicit filing dates only, with complete coverage evidence beside them.

The existing relay manifest carries the same full read-only projection through
the owner/installation/schema-bound cache. No new row kind, command, migration
or live publish was used. Physical-phone/deployed-bridge acceptance is distinct
from the relay-double and 390 px browser evidence. Existing V2 phone UAT command
work remains R79; the separate legacy phone/V1 reader remains operational.

Library retains guarded checkbox editing/Undo, document search, file/folder
create/rename/move/trash, ordering, pins/recents and contents. Order changes now
return the existing guarded snapshot receipt so Undo restores exact original
names even with numbering gaps. Undo receipts survive route changes. Local
legacy/classic entry points were retired **after** desktop/390 px and the
credential-free fake-driver spec → plan → UAT → shipped walkthrough; the three
legacy assets were removed. Static read-only export, V1 execution/recovery and
history readers remain. `tests/pm-ui/fixtures/a5-browser.mjs` creates a disposable
server with explicit `PM_DRIVE_PUBLISH=0`, a disposable Drive fallback, no `.env`
or bridge, and the existing fake runner seams.

Verification commands and local artifacts: `tests/pm-ui/cockpit.test.ts`,
`primary-navigation.test.ts`, the PM UI/OS/relay/fake-driver suites; desktop and
390 px screenshots plus machine output under gitignored `.pm/a5-evidence/`.
Final machine pass: **741 tests in 59 files**; full typecheck, focused ESLint
(zero warnings), `docs:check`, `pm:lint`, `pm:check-docs` and `git diff --check`
pass. This includes worker responsiveness/recovery, in-flight relay publication,
legacy/static parity and the A1–A4 contracts.
Full `pnpm lint` was run and reports 9,284 errors / 51,999 warnings across this
checkout, including generated `.tmp` bundles; focused lint of the changed files
is the separate clean gate. No paid API or production database write was run.

The final browser pass also verified former local UI URLs, Home → Bridge,
two-session double-click pinning, recorded red-mark file/line evidence, exact
cohort drilldowns, Work search/reload, Library search/pins and capture Undo across
navigation. Three Needs-you, Running and Next-up rows ended at y=644 px, above
the bottom navigation at y=770 px in a 390×844 viewport. Fresh Setup rendered
after moving only the disposable fixture's `.os/`; Sessions/Score showed their
empty state and rule bytes remained unchanged.

During the first disposable-server attempt, the existing Windows-default Drive
publisher unexpectedly wrote four fixture documents and status. The server was
stopped; all four documents were restored byte-for-byte from the publisher's
preserved backups, and status was regenerated from the real publisher's saved
state. Later fixture launches explicitly disable publishing. Repair and
verification evidence remains under `.pm/a5-evidence/`.

## Skill Launchpad (A6 / R98)

**Retired 2026-11-15 (R127).** The Prompt tools page, its server endpoint, saved recipes and browser launch flow are removed. `#/skill-tools` and bare `#/launch` open Work; item-selected Delivery links retain their existing launch path. R98's remaining native generic-prompt expansion is cancelled, not shipped. [Cancellation record](<../ERA Notes/10 - Project Management/_Archive/Cancelled Log.md#pm-tooling>).

Setup › Configuration › Skills shows **Last used** and **Sessions** from the recorder projection supplied through `cockpit-reader.mjs`. Counts represent distinct recorded sessions per skill. Missing timestamps show a dash; an unavailable recorder shows dashes in both columns. **Unused** requires zero observed use over at least twenty recorded sessions.

**Owner decision D3, 2026-11-15: keep.** The eight `.claude/skills/*/form.json` sidecars, `scripts/os/forms.mjs`, `launchpad.mjs`, `launch-settings.mjs` and `tests/os/launchpad.test.ts` remain. The scanner still needs the settings parser and the retained tests exercise validation/defaults/conditions, registry/PM membership, required attachments, safe quoting and bounded scaffold preview. `FORM-MISSING` and `FORM-DRIFT` remain. Typed item intake has not been commissioned.

The retained test suite owns synthetic recipe data; there is no shipped recipe directory or launcher API. Historical A6/R107/R108 implementation witnesses remain under `.pm/a6-evidence/`, `.pm/launch-composer-evidence/` and `.pm/work-entry-evidence/`. They describe the retired page and do not authorize its restoration. Current retirement/skill-use evidence is under `.pm/r127-evidence/`.

An existing PM server requires an owner restart to unload the removed endpoint. No provider turn, real session or agent restart is part of this change.

## Bridge calm and game views (R102)

The owner approved a chart-led Bridge and a longer exception for infrequent mode
changes on 2026-11-14. `Bridge.tsx` retains the same Needs you / Running / Next up
queues in both modes, with New task and Game layer controls in the header.
The compact Game layer control sits among the header icons (R103): the original
Lucide Orbit SVG matches the neighboring icons when off and uses a shining blue gradient when on.
Its 90-degree clockwise turn takes 380 ms; reduced motion keeps the state colors without
rotation. Settings continues to share the same persisted preference.
`BridgeVisuals.tsx` adds the ERA core and chart disclosures; `bridgeModel.ts` reuses
the canonical `workOutcomes` / `outcomeSeries` history contract for eight weeks of
shipped outcomes, separating undated outcomes. Session quality is a count
partition of non-Arena records using `cleanEvidence`; missing checks or rule
coverage remain Unknown. Neither chart infers UAT acceptance, deployment or a
model success rate. Bars and quality categories open their underlying records.

The former Bridge guard/conflict tiles move to Setup, with a numberless attention
dot; clean streak and the existing evidence mirrors remain in Score. This slice
does not redesign Score. `setupAttention.ts` considers warning/error
conflicts and a missing declared guard chain. A deliberately judgment-only rule
does not light the dot simply because it lacks an automated guard.

`ProviderStatus.tsx` reads the existing executor catalogue through the transport.
Green means an SDK package directory was found on the local laptop; it is not a
provider probe, credential test or launch-readiness verdict. Local observations
age after 45 seconds and read failures/disconnection retain Stale or Unknown.
The relay catalogue lacks a measurement timestamp, so known installation values
remain Stale and absent or unmeasured entries Unknown even when the laptop
connection is online.

The preference remains per browser and shared with Settings. Explicit changes
use the approved 1.8 s enter / 1.0 s exit choreography; reload does not replay it.
Reduced motion disables it, controls remain usable, and the queues keep their
underlying links. Laptop presents the core alongside work; phone stacks the
compact core, queues and charts. Verification and owner acceptance are recorded
under [R102](<../ERA Notes/10 - Project Management/PM Tooling/PM Tooling — Master Book.md#r102>).

**Game-core amendment (R104, owner approved 2026-11-14):** Game mode permits
continuous visible core rotation and a visual throttle burst from click/keyboard
activation in `EraCore.tsx` / `core-motion.css`, with deterministic state from
`coreState.ts`. Running sessions use red/orange friction, smoke and embers; waiting
for approval/action uses gentler yellow motion; explicit success uses green;
failure uses a grey broken offset ring. The core is a session indicator: standing
backlog decisions remain in Needs you and do not force a yellow core forever.
Running work takes precedence over delivery approvals/actions. Unknown/stale, cancelled and partial outcomes cannot
produce a false success. Terminal labels retain their actual level: Candidate
verified, Applied or Shipped; a green verified candidate does not claim owner
acceptance or deployment. Missing/invalid terminal dates or conflicting tied
outcomes cannot establish a latest successful result. The throttle is a
cosmetic burst; Open sessions remains a
separate link. Reduced motion stops motion/particles, and hidden/offscreen
animation pauses. Calm mode retains the short, non-looping feedback rule. This
supersedes the former blanket no-loop/400 ms wording for the Game core only.

**Overload refinement (R105, owner approved 2026-11-14):** `useCoreMotion.ts`
coordinates `coreDynamics.ts` and `coreParticles.ts`. The wheel accelerates into
red/orange heat, outward flame/ember spray, smoke and localized vibration. A
visible-time clock preserves angular phase; repeat activation extends the drive
without remounting the wheel or accumulating timers. Speed, heat, emission and
vibration decay gradually after release or session completion, with existing
particles finishing their trajectories. Running sessions sustain the effect.
The actual session caption remains unchanged during a simulated throttle, and
the effect stays inside the core card. No provider or session command is sent.
The drive lasts 2.4 s and targets 240 rpm; observed running targets 180 rpm.
Exponential deceleration preserves the wheel's phase and returns to the state's
baseline over several seconds. Particle capacity is fixed at 180; generated
flame/smoke sprites avoid per-frame blur. The clock follows
[MDN's timestamp-based requestAnimationFrame guidance](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
and respects the system's reduced-motion preference. Transform/opacity changes
and bounded sprite drawing follow the performance approach in
[web.dev's animation guide](https://web.dev/articles/animations-guide).

**ERA appearance refinement (R106, owner approved 2026-11-14):** the ERA mark
uses light, open orbital arcs and an elliptical counter-orbit. Tire-like spokes,
tread ticks, the solid track and ground-contact particle patch are removed.
Emission drops from 225 to 160 particles/s at full energy; smoke opacity,
vibration, heat/glow and trail reach are softened by roughly a quarter. The
2.4 s drive, running speed, continuous phase and natural cooldown are retained.
The focused local browser check covers desktop/mobile Blue/Pink geometry and
presentation, click/coast, sustained running and reduced motion. Evidence is
in `.pm/r106-evidence/`; owner appearance/device acceptance remains pending.

R105's frozen browser pass covers 24 state/theme/viewport combinations, timed
throttle/retrigger/cooldown, running-to-success/failure, keyboard, reduced motion
and hidden/offscreen pause, with zero errors, writes or native/provider calls.
Six dynamics tests cover frame-rate-independent travel and release. Typecheck,
build and scoped lint pass; 37 tests are covered after one concurrent cockpit
timeout passed on its unchanged 10-test isolated rerun. Evidence and 13-file
candidate hashes are in `.pm/r105-evidence/`; owner scenarios and pending
physical-device/aesthetic acceptance are under
[R105](<../ERA Notes/10 - Project Management/PM Tooling/PM Tooling — Master Book.md#r105>).
The final hue correction follows the shorter blue-to-red arc through violet,
avoiding green while heating or cooling a non-successful core. The main motion
receipt precedes this correction; `hue-amendment.json` binds final source and
records 1,042 rendered desktop Blue/mobile Pink samples without a green-band
crossing, plus reduced-motion state-color checks.

R104 verification uses `tests/pm-ui/core-state.test.ts` and the credential-free
`core-motion.browser.mjs` harness. The frozen local pass covers all six states
at 1440/390 px in Blue/Pink, throttle/focus/retrigger, sustained running,
hidden/offscreen pause, reduced motion and calm removal. Existing Bridge browser
regression, typecheck/build/scoped lint and 31 tests across seven files pass.
The synthetic receipt and nine-file candidate manifest are in
`.pm/r104-evidence/`; owner aesthetic/physical-device acceptance remains pending
under [R104](<../ERA Notes/10 - Project Management/PM Tooling/PM Tooling — Master Book.md#r104>).

**Verification (2026-11-14):** typecheck, PM React build, changed-file ESLint and
31 focused tests across seven files pass. The frozen-candidate
`tests/pm-ui/bridge-game.browser.mjs` pass covers 390/768/1440 px Blue/Pink,
keyboard/persistence, queue-link parity, explicit enter/exit timing, intermediate
text scale, reduced motion, 40 px controls, chart drilldowns and missing/stale/
pending/error evidence. No overflow, page errors, writes or native calls.
Existing cockpit and game/Arena browser regressions pass. Local screenshots,
`result.json` and the 19-file SHA-256 `candidate.json` are in
`.pm/r102-evidence/`; owner scenarios remain Pending in R102. This is local
implementation evidence, not deployment, a physical-phone witness or owner
aesthetic approval. Full-repository lint retains the separately recorded R101
baseline; it was not represented as a clean gate.

## Arena and game layer (A7 / R99, partial)

The initial 2026-11-14 A7 slice added the per-browser Game layer switch (off until
enabled) and a 360 ms scan. R102 supersedes the scan and Bridge presentation above.
Score's calm and game presentations use identical A1/A4 facts: consecutive
confirmed clean sessions, guarded rules, recorded baseline debt, setup coverage
and conflicts. Every number expands to its source rows or links. Missing or tied
session chronology prevents a streak; unknown checks/coverage never count as
clean. Arena exercises never advance the product streak. Baseline debt is not
extrapolated from session deltas, and no defeat, reward, confidence score or
weekly shipping/UAT badge is invented. Tier evidence remains A4's raw rows.

`scripts/os/cases/kit11.json` harvests shipped KIT-11: start
`880ecd285dce629d047887380fb287842c4b4e6a`, solution
`5f2f4e755c82341f5fda889b1cc9baaf37ef2ee4`, one route, retained brief and
the existing cooking-count oracle. The normalized oracle SHA-256 is pinned in
the case; a changed oracle is refused. `pnpm os:arena case KIT-11` prints the
frozen case. `pnpm os:arena controls KIT-11` exports the two historical route
blobs, executes the same existing oracle with stubbed Supabase/cookies/response
seams and saves local evidence under `.os/reports/arena/controls-*/evidence.json`.
Observed: baseline exit 1 with four count-handling failures; solution exit 0,
**12 of 12 checks passed**. Neither control is a model run.

Score → Arena (`#/score?view=arena`) renders six A4 panels side by side from the
existing cockpit records, through optional `session.arena` bindings in the
existing `os/session@1` contract/store. Compatibility requires distinct
Claude/Codex tiers, the same case fingerprint/start/oracle/setup/effort, recorded
candidate commits, matching scorecard identity/settings, oracle verdicts and
protected isolation. It draws no ranking. There is no second session store,
result-import authority or native launcher in this slice.

**Stop boundary:** the native Local lane cannot establish a hidden oracle.
`adapters/registry.mjs` documents Codex's failed read boundary;
`adapters/codex.mjs#buildThreadOptions` confines writes/network, not outside
reads. `local-guardrails.mjs` explicitly calls Local accident prevention, not a
security boundary. Putting an oracle outside a worktree or omitting it from the
prompt therefore does not meet “tests the agent never sees.” The A7 architecture
explicitly excludes reusing the confined policy/authorization/container modules.
Selecting/extending a protected execution boundary needs an owner scope
decision before implementing dispatch. No credentials, subscriptions or live
models were used. A3 ingest/report binding, pacing and two genuine owner-started
Claude/Codex runs remain unimplemented. **R99 is open.**

| A7 acceptance | Evidence / state |
| --- | --- |
| Owner wants comparison; existing scorecards | Owner selected Claude/Codex; A4/A5 reused |
| Harvest shipped case with frozen brief and oracle | KIT-11 case, hash and historical controls above |
| Only owner starts, paced, subscription only | Blocked before dispatch; no model calls, no fake receipt |
| Same case on two tiers, side-by-side scorecards | UI verified with explicitly synthetic fixtures; real runs **not met** |
| Optional honest game layer, evidence behind counters | Settings persistence; identical calm/game facts; no activity rewards |
| Futuristic transition and mobile/reduced motion | 360 ms, pointer-transparent scan; 1440/390 px Blue/Pink browser checks |

Verification: `pnpm typecheck` and scoped ESLint pass; `pm:build-app` passes;
**36 targeted tests in five files** pass (Arena/game, A4 scorecards and Delivery
adapter, A5 cockpit). The broader `pnpm vitest run tests/os tests/pm-ui` run is
**not green**: 575 passed, nine 5-second timeouts in existing setup (2), eval (4),
registry (2) and recorder (1) tests. Earlier baseline also reproduced the setup
guard timeout in isolation. No timeout was increased, skip added or block removed.
The earlier full-repository lint attempt was interrupted after JSX parser
diagnostics; scoped lint is a separate gate, not a repository-wide clean claim.
Browser source: `tests/pm-ui/game-arena.browser.mjs`, against
`fixtures/a5-browser.mjs` (empty) or `--arena` (synthetic records). Local
screenshots/receipts are under `.pm/a7-evidence/`. Synthetic scorecards demonstrate
rendering only and do not satisfy the real two-tier exit criterion.

## Agents

None defined in this repo (no `.claude/agents/`, `.github/agents/`, `*.agent.md`, or `*.chatmode.md`).
