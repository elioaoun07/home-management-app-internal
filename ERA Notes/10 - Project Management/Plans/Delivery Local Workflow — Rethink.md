---
created: 2026-11-22
updated: 2026-11-22
type: plan
status: implemented-uat-pending
owner: Elio
evidence_cutoff: "2026-11-22, main 4dcefd6a plus the uncommitted DLV-166/167 work. Read-only git inspection of the main checkout and the ten worktrees under budget-app-delivery/; fsutil hard-link listing; du of .next and .delivery/local; gh repo view of both remotes. No git write, no provider turn, no production write."
---

# Delivery Local workflow — rethink (implementation prompt)

[PM home](<../_index.md>) · item: [DLV-168](<../Delivery/Delivery — Master Book.md#dlv-168>) · built so far: [DLV-166](<../Delivery/Delivery — Master Book.md#dlv-166>) Run app, [DLV-167](<../Delivery/Delivery — Master Book.md#dlv-167>) Merge · owner checks: [Delivery-UAT](<../../../docs/Delivery-UAT.md>)

**How to start a session from this file:** paste *"Read `ERA Notes/10 - Project Management/Plans/Delivery Local Workflow — Rethink.md` and run it from Stage 0."* Everything below is addressed to that agent.

## Stage 0 checkpoint · 2026-11-22

The owner approved D1–D6 and requested the entire workflow in one implementation session. [Decision record](<../Delivery/Delivery — Master Book.md#dlv-168>). The following order keeps the original stage numbers. The owner can exercise the witnesses together after restarting the PM server.

1. Configure the destination first and close the old Ship and Undo paths that can still push to `origin`. [S2 · DLV-171](<../Delivery/Delivery — Master Book.md#dlv-171>)
2. Preview which closed runs can be removed, keep recoverable patches, and verify both disk use and dependency isolation. [S1 · DLV-170](<../Delivery/Delivery — Master Book.md#dlv-170>)
3. Keep Test steps, sign-off and the next action on one run page in Calm and Game. Use the recorded result to label each step. [S3 · DLV-172](<../Delivery/Delivery — Master Book.md#dlv-172>)
4. Show the run's exact files before Commit and every outgoing commit before Push. Keep the receipt when cleanup finishes. [S4 · DLV-173](<../Delivery/Delivery — Master Book.md#dlv-173>)
5. On an overlap, name the files. Offer Refresh for committed changes and a recheck after the owner resolves uncommitted changes. [S5 · DLV-174](<../Delivery/Delivery — Master Book.md#dlv-174>)

**Updated baseline.** BUD-95 and the Run app/Merge implementation are already in local `main` at `a20d6183`. The cached `internal/main` points to the same commit. Use a fresh item for the Start → Pushed witness. The ten existing worktrees are an inventory to classify. Some may still hold the only recoverable copy. The cleanup preview must determine eligibility from run and workspace evidence.

**Changes proposed to the original specifications below.** A matching lockfile permits sharing only after write isolation is demonstrated for the worker, hooks, host checks and preview. Commit also needs a record of the exact PM changes for this item because the existing PM sweep can touch other campaigns. Keep a failed PM update actionable. Preserve the difference between copying files, creating a commit, publishing a branch and reclaiming storage across a restart.

## Implemented workflow · 2026-11-22

Open the item in Local Delivery and press **Start**. Test, sign off, review a risky diff if prompted, then **Merge → Commit → Push** on the same run. Setup or the Push step can bind the verified `internal/main` destination. The old combined Ship and Undo routes refuse writes. A copied legacy run with no file manifest requires review before the owner handles its files.

The main-checkout commit uses literal, path-limited Git arguments so an unrelated staged change survives. Push binds the reviewed local SHA, remote branch and expected remote SHA, with tag and submodule pushes disabled. The UI displays the exact commands. Dirty overlaps require a recheck after resolution. Committed overlap offers a worktree rebase and fresh UAT.

Dependencies use the accepted private fallback. A per-run junction points to private package files outside the sibling checkout. The preview also has its own dev cache. **Measure disk** includes those files in the retained total and lists checkout sizes separately. The real cleanup and Explorer measurement are owner witnesses. [One walkthrough for all five stages](<../../../docs/Delivery-UAT.md#local-delivery-from-start-to-push--dlv-168>)

---

## 1. Your job

Turn the Local Delivery lane into one clear, button-driven flow per item. The owner must be able to go from **Start** to **Pushed** on one page without a terminal and without guessing what a word like "Shipped" means. Keep the delivery folders small. Work in stages, and stop at each owner witness.

**Model and effort:** `CLAUDE_HIGH`, high (read `ERA Notes/Model-Registry.md`). **Playbooks:** `start-task` → `add-feature` → `finish-task`. Read the Design Doctrine's Ten Questions before Stage 1.

**Read first, in this order:** `CLAUDE.md`; `.claude/skills/start-task/SKILL.md`; this file; then in `Delivery/Delivery — Master Book.md` only: the two 2026-11-22 Pain Inventory entries (🔴 remote, 🟠 workflow), the `### DLV-150` to `### DLV-153`, `### DLV-161`, `### DLV-166`, `### DLV-167` sections, and the Successor Briefing; then `docs/Delivery-UAT.md` sections DLV-166 and DLV-167. Code: `scripts/delivery-v2/local-lane.mjs`, `local-preview.mjs`, `local-routes.mjs`, `local-guardrails.mjs`, `local-process.mjs`, `scripts/pm/app/LocalDelivery.tsx`, `LocalPreview.tsx`, `UatWizard.tsx`, `localBoardActions.ts`. Tests: `tests/delivery-v2/local-lane.test.ts` (its real temporary-repo fixture is the pattern for every new git test), `local-preview.test.ts`, `tests/pm-ui/local-board-actions.test.ts`, `local-delivery.test.ts`.

## 2. Rules that do not bend

1. **You never run a state-changing git command yourself.** That means add, commit, merge, rebase, reset, checkout, switch, branch, worktree add or remove, stash, clean, tag, config and push. It applies in your shell, in scripts you run, and in tests against the real repository. Git reads are fine. Every git test uses a temporary fixture repository.
2. **The PM Command Center may run git, but only from an owner click.** Each button runs exactly the commands it names. The UI shows the exact argv before it runs, and the run's activity records each command with its exit code and output tail. One button means one owner intent: nothing chains a push onto a commit unless the owner configured that.
3. **Git writes in the owner's main checkout are limited to:** `git add -- <listed files>`, `git commit -m <message>` and `git push <configured remote> <branch>`. Nothing else, and never on files outside the run's list.
4. **No `.env` in a worktree, ever.** `assertNoLocalSecrets` stays. Run app passes env values through the process environment only (DLV-166).
5. **Never push to a remote the owner did not configure.** `origin` is stale (see §4). No implicit default.
6. Hard Rules 25 (PM records in the same session), 26 (no production database writes), 28 (minimal UI text) and 29 (no paid live API tests) apply unchanged.
7. **Do not re-decide these:** worktrees are allowed as temporary copies. Merge's conflict rule is the owner's own spec (§5). Run app stays.

## 3. The owner's workflow (his words, 2026-11-22)

Today, without Delivery:

> 1. ask AI to fix a file A
> 2. add and commit file A
> 3. git push --force internal main
>
> that's it

What he wants Delivery to do:

> 1. run session
> 2. session clones Local Repo at current branch (ALPHA)
> 3. I have parallel work that changes my branch to (BETA)
> 4. Session edited files 1,2,3
> 5. parallel work edited filed A,B,C
> 6. no conflicts; add a Button to merge:
>    a. it will check if files 1,2,3 changed from branch Alpha to Beta
>    b. if yes, stop and through an alert
>    c. if not, replace files 1,2,3 in BETA from files 1,2,3 in the cloned Repo
> 7. add and commit file A (manually as phase 0)
> 8. git push --force internal main (manually as phase 0)

On git: *"I know I have hard rules for AI not to run Git commands that alter my files in GitHub, but I don't mind having git commands in the PM UI."* On disk: *"cloning the full repo is fine to have it temporarily, but now the delivery cloned repos are more than 18 GB. This is not sustainable and not acceptable."* On clarity: *"to have it as UI rather than me getting mixed up with all of these steps."*

Steps 6a to 6c shipped as DLV-167. Steps 7 and 8 are this plan's Commit and Push buttons.

## 4. Facts measured 2026-11-22 (re-verify before relying on them)

- **Remotes.** `internal` is `home-management-app-internal`. It matches `main`, was last pushed 2026-11-21, and is the owner's real remote. `origin` is `home-management-app`: last pushed 2026-05-30, 201 commits behind, with its own Vercel project. Both repositories are public. `main` has no upstream configured.
- **The old Ship pushes to `origin`.** `createLocalLane` defaults to `remote = "origin"`, and `service.mjs` never overrides it. DLV-167 hid the Ship button; the API path still exists for push-pending retries.
- **The old Ship refuses once `main` moves** (`main-advanced`), so any parallel commit voids a tested run. DLV-167's Merge does not have this limit.
- **Disk.** There are 10 worktrees under `<repo>-delivery/`, 7 of them retained failed HUB-118 attempts, and Explorer reports about 18 GB. Here is where the space really goes:
  - The tracked checkout is about 60 MB per worktree.
  - `node_modules` is installed per worktree (`pnpm install --offline --frozen-lockfile`). Its files are hard links into `C:\Users\aoune\.pnpm-store\v10`, which `fsutil hardlink list` shows shared across all ten folders plus the main checkout. Explorer counts every link in full. The files are not real extra bytes, but each folder adds hundreds of thousands of file entries: a `du` of the folder did not finish in 10 minutes, and deleting is just as slow.
  - `.next` is 149 MB in BUD-95, left behind by Run app.
  - `.delivery/local/<run>/home` holds 887 MB across 9 runs: the private credential homes plus whatever the CLIs cache there.
  - Nothing ever removes a closed attempt. DLV-161 parts 3 and 4 are not implemented.
- **What exists.** DLV-150 to 153 (Local lane: worktree, host checks, UAT, risk review, Ship/Undo). DLV-164 and 165 (questions and chat). DLV-166 (Run app). DLV-167 (Merge by file copy with the ALPHA/BETA conflict check and a PM ship; Ship hidden; Undo off for copied merges).

## 5. The target: one page per run

A fixed stepper. Each step has one primary button. Status words come from recorded facts only and survive a PM restart.

| Step | Status shown | Primary button | What happens |
|---|---|---|---|
| 1 | Building | Cancel | Worktree from `main` at ALPHA (recorded SHA). Agent works; chat and questions as today. |
| 2 | Checking | (none) | Host checks. |
| 3 | Ready to test | Run app → Test steps | DLV-166 plus the UAT wizard; ends with Sign off. |
| 4 | Review (risky diffs only) | Review diff | Unchanged rule. |
| 5 | Ready to merge / **Blocked** | Merge | DLV-167. Conflict: a red alert with the files, offering **Refresh** (Stage 5) or **Discard**. |
| 6 | Merged in your folder | Commit | `git add -- <run files + PM files>` and `git commit -m "<ID> <title>"` in the main checkout. Shows the file list and command first. Never `git add -A`: the owner's other changes stay unstaged. |
| 7 | Committed | Push | The configured push command (§7, D1), shown before it runs. Disabled when the checkout is not on the configured branch or has nothing to push. |
| 8 | Pushed → Cleaned | (automatic) | Remove the worktree, branch, credential home and `.next`. Keep the run record, final patch, handover and activity under `.delivery/`. |

Discard on any closed or failed run removes the same things and keeps the same record. Retire the word "Shipped" from this lane's UI; use the statuses above.

## 6. Disk budget (hard requirement)

- **Target:** with no run active, `<repo>-delivery/` is empty. With one run active it holds one worktree, and Explorer shows **under 300 MB** for it. `.delivery/local` holds no credential home for a closed run.
- **`node_modules`:** when the candidate's `pnpm-lock.yaml` equals the main checkout's, make the worktree's `node_modules` a directory junction to the main checkout's (`assertNoLocalSecrets` already skips entries named `node_modules` before its link check: confirm this). Removing a worktree must unlink the junction, never recurse through it; prove that with a fixture test that checks the target survives. Two risks to settle in Stage 0:
  - A worker that runs `pnpm install` would write into the main checkout's `node_modules`. Either deny it through the worker sandbox, or fall back to a private install whenever the session edits `package.json` or the lockfile.
  - A Run app `next dev` in the worktree must not corrupt the main checkout's caches.
- **Retention:** at most `N` worktrees exist (D3). Closed runs are cleaned automatically after Push or Discard. A failed attempt keeps `diff.patch`, logs and its handover under `.delivery/local-archive/<run>/`, not a checkout.
- **Credential homes:** remove at run end and for already-closed runs (DLV-161 part 3). Find out what fills them (887 MB) and keep it out.
- **Disk line in Setup:** real usage counted once per file (not Explorer's link-counted size), plus **Clean up closed runs**. The first use cleans the existing ten worktrees. The owner confirms the list first; this is an owner click, not your command.

## 7. Owner decisions (ask these in Stage 0; record the answers in DLV-168)

| ID | Question | Recommendation |
|---|---|---|
| D1 | Push command | `git push --force-with-lease internal main`. For a solo owner it does what `--force` does today, but refuses if GitHub has commits the laptop never saw. If he keeps `--force`, show it in red. |
| D2 | Commit message | `<ID> <title>` |
| D3 | Max worktrees kept | 2 |
| D4 | `node_modules` | Junction to the main checkout when the lockfiles match; private install otherwise |
| D5 | What Commit stages | Only the run's files and the PM files it changed, never other staged or unstaged work |
| D6 | `origin` | Never pushed by the Command Center; the Ship route refuses it |

## 8. Stages (stop at each witness)

Each stage ships through `finish-task`:
- Replay-only tests with fixture repositories.
- `pnpm typecheck`, scoped ESLint and `pnpm pm:build-app`.
- `pnpm pm:ship <ID>` with `**UAT:** pending`.
- One short owner scenario block in `docs/Delivery-UAT.md`.

The owner restarts `pnpm pm` himself between stages.

- **S0 — Decide (no code).** Ask D1 to D6. File one checklist row and `### <ID>` section per stage under DLV-168. Restate this plan in five lines and wait for "go".
- **S1 — Disk.** Retention, cleanup on Push and Discard, junction `node_modules`, credential-home removal, the Setup disk line and the one-time cleanup click. *Witness:* the owner cleans the ten old worktrees and starts one run; Explorer shows the budget in §6.
- **S2 — Remote.** One stored push setting (D1). The Ship route and the new Push button use only that setting and refuse when it is unset. *Witness:* the setting is shown and `origin` is unreachable from the UI.
- **S3 — Stepper.** The §5 page and status words, in calm and Game views (the Game rail uses the same `LocalActions`). *Witness:* the owner reads a run's state without asking anyone.
- **S4 — Commit and Push buttons.** Command preview, exact file list, recorded argv and exit codes. *Witness:* one real item goes Start → Pushed with only buttons.
- **S5 — Refresh.** On a Merge conflict, rebase the run's branch onto the current `main` inside the worktree (owner click), rerun host checks and require a fresh Test sign-off. A conflicting rebase stops and shows the files. *Witness:* a fixture conflict, then one real one.

**Done when** one real item goes Start → Pushed on one page, every git command is shown before it runs, nothing reaches `origin`, and the delivery folders stay within §6.

## 9. Backup: what the 2026-11-22 session did and found

The record, in case this conversation is lost.

1. **BUD-95 run `local-38c4d389-54ea-4446-a0db-ab3b9d3795c1`.** The candidate `faa3630a` on `delivery/BUD-95` sends `private, no-store` + `Vary: Cookie`. Host checks were 4/4. The owner first tried `pnpm dev` in the worktree, which failed with "Your project's URL and Key are required" because the worktree has no `.env`.
2. **DLV-166 Run app (built, UAT pending).** A **Run app** button on Test steps runs `pnpm dev --port <3000|3100+>` in the worktree, with the main checkout's `.env` values in the child's environment only. A smoke run on BUD-95 was ready in 4 s. The owner then ran BUD-95's UAT with it: all three scenarios passed, sign-off at 11:14:59Z (handover `uat-06bc4a08494c`).
3. **Findings.** The 🔴 Ship-to-`origin` defect and the 🟠 workflow mismatch, now in the Pain Inventory.
4. **DLV-167 Merge (built, UAT pending).** **Merge** copies the session's files into the main checkout when none changed there since ALPHA (committed or uncommitted). Otherwise a red alert lists the files and Merge refuses. It records the UAT line and runs `pm/ship.mjs#ship` for the item, with no git write. It replaced Ship in the UI. A hand check for BUD-95 found no conflicts on its four files.
5. **This plan and DLV-168.**
6. **Files from this session:**
   - `scripts/delivery-v2/local-preview.mjs`; `local-lane.mjs` (preview, stopPreview, merge, planMerge, recordUatPassed, canMerge, Undo guard); `local-routes.mjs`.
   - `scripts/pm/app/LocalPreview.tsx`, `UatWizard.tsx`, `LocalDelivery.tsx`, `localBoardActions.ts`, `LocalRunGame.tsx`, `LocalRunReview.tsx`, `LocalRunConsole.tsx`, `uat.css`, `delivery.css`.
   - `tests/delivery-v2/local-preview.test.ts`, `local-lane.test.ts`; `tests/pm-ui/local-board-actions.test.ts`, `local-delivery.test.ts`.
   - `docs/Delivery-UAT.md` (DLV-166 and DLV-167 sections); the Delivery Master Book (Pain Inventory, DLV-166/167/168); `Delivery/4 - Checklist.md`; this file.
7. **State when this file was written.** The DLV-166/167 work was uncommitted in the main checkout, and the owner commits it himself. BUD-95 waits for the owner to restart `pnpm pm`, press Review diff (if asked) and Merge, then commit and `git push --force internal main`.
