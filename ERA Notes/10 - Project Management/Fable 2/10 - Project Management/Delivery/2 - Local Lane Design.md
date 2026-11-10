---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit 8da80ae, 2026-11-10. Proposed design; nothing here is implemented. Host timings measured in a clean Linux container."
---

# Delivery — the Local lane (proposed design)

[Fable 2 index](<../../_index.md>) · [Diagnosis](<1 - Diagnosis.md>) · [Gate disposition](<3 - Gate Disposition.md>) · [Migration](<4 - Migration and Retirement.md>) · [Supervisor contract](<5 - Supervisor Contract.md>)

**Status: proposed.** Owner direction 2026-11-10: deliver locally, build UATs, ship; relax the restrictions and give the AI more freedom. Four guardrails survive, by the owner's choice: no production DB writes, subscription only, owner ships, risk-domain review. Canonical work: [DLV-150](<../../../Delivery/Delivery — Master Book.md#dlv-150>) to [DLV-155](<../../../Delivery/Delivery — Master Book.md#dlv-155>).

## The whole flow

| Step | What happens | Who |
|---|---|---|
| 1. Start | Pick an item, press Deliver. Three checks only: the base branch is known and clean, the chosen subscription CLI is signed in, dependencies are installed | Owner, one click |
| 2. Workspace | Supervisor creates branch `delivery/<ID>` in its own git worktree outside the main checkout | Supervisor |
| 3. Build | One native agent session (Claude Agent SDK or Codex) runs in the worktree with edit and shell freedom there. It loads the repo's CLAUDE.md, skills and hooks. It plans, implements, runs the repo's own checks and commits to the branch | Agent |
| 4. Check | When the agent stops, the supervisor runs `pnpm typecheck`, `pnpm lint`, the tests the diff touches (or the full suite) and `pnpm pm:lint` itself, on the host, and records the output | Supervisor |
| 5. Risk review | The diff's paths are classified. Anything in a risk domain waits for the owner to read the plan or the diff. Everything else goes straight on | Owner only when flagged |
| 6. UAT | The owner runs the worktree build (`pnpm dev -p <port>`) and walks the handover scenarios in the existing UAT wizard | Owner |
| 7. Ship | Sign-off merges the branch and pushes. CI runs. Nothing else can reach `main` | Owner, one click |
| 8. Undo | `git revert` of the merge commit | Owner |

No container, no policy revision, no grant expiry, no qualification record, no frozen diff, no fleet allowance.

## The four guardrails and where each is enforced

| Guardrail | Enforcement | Honest limit |
|---|---|---|
| **No production DB writes** (Hard Rule 26) | (a) The agent process starts from an allowlisted environment: no `SUPABASE_SERVICE_ROLE_KEY`, no `CRON_SECRET`, no provider keys. (b) The worktree gets no `.env`. (c) Tool deny rules for Supabase write tools, `supabase`, `psql` in every tool namespace ([R84](<../../../PM Tooling/PM Tooling — Master Book.md#r84>)). (d) Best: the worktree points at a disposable dev database ([DLV-154](<../../../Delivery/Delivery — Master Book.md#dlv-154>)) | Without a container an agent with a host shell can still read the main checkout's `.env` if it goes looking. (a)–(c) stop accidents and ordinary drift, not a determined process. Moving the service-role key out of the repo directory (user-level env loaded only by the owner's dev script) closes most of that gap and costs nothing |
| **Subscription only** (Hard Rule 29) | Keep the existing adapter refusal of API keys and paid sign-ins (DLV-110) and `tests/setup/blockPaidApis.ts` | Usage is whatever the subscription allows; the lane shows it and warns, it does not meter it |
| **Owner ships** | The Ship action is the only merge path. Add GitHub branch protection on `main` (pull request or owner push only). The agent never has push rights to `main` in its session | Branch protection is a repository setting the owner turns on once |
| **Risk-domain review** | A path classifier run on the diff before UAT. Flagged diffs cannot be shipped until the owner opens the review | The list below is the contract. A path missing from it is not reviewed |

### Risk-domain paths (first version)

- **Money:** `src/lib/balance.ts`, `src/lib/balance-utils.ts`, `src/services/transaction.service.ts`, `src/app/api/{transactions,transfers,accounts,debts,drafts,recurring-payments,future-payments,future-purchases,budget-allocations,statement-import,recycle-bin}/`, `src/features/{balance,accounts,transfers,transactions,recurring,debts,budget,drafts,statement-import,future-purchases}/`
- **Recurrence:** `src/lib/recurring.ts`, `src/lib/schedule/`, `src/app/api/cron/`, any file importing `rrule`
- **Auth, RLS, household:** `src/lib/supabase/`, `src/lib/accountAccess.ts`, `src/lib/tripAccess.ts`, `src/app/api/auth/`, `src/app/api/household/`, `src/app/api/guest-portal/`, `proxy.ts`, `src/middleware.ts`, any route that imports `supabaseAdmin`
- **Schema:** `migrations/`
- **The rules themselves:** `CLAUDE.md`, `.claude/`, `.github/workflows/`, `tests/setup/blockPaidApis.ts`

## What the agent is free to do

Inside its worktree: read anything, edit anything, run `pnpm` scripts, run tests, create files, commit, amend, rebase its own branch, start a dev server on its own port, continue after a failed check without asking. It may write the migration SQL file and `schema.sql` (Hard Rule 24); applying SQL stays with the owner.

Outside its worktree: nothing. It does not push, merge, tick checklists in the main checkout or touch another item's branch. The supervisor copies the PM trace (Hard Rule 25) at Ship.

## Why a worktree and not just a branch

The owner keeps working in the main checkout while an item is being built, two items can build at once without sharing a `node_modules` state or a dev-server port, and a discarded attempt is one `git worktree remove`. Overlap between two items shows up as an ordinary merge conflict at Ship, which is a better signal than a pre-declared path reservation.

## The checker, measured

| Check | Host time (4 cores, no container) | Result on 8da80ae |
|---|---|---|
| `tsc --noEmit -p .` | 85 s | 0 errors. Needs a raised heap in a 15 GB container: plain `pnpm typecheck` ran out of memory there, see [R91](<../../../PM Tooling/PM Tooling — Master Book.md#r91>) |
| `pnpm lint` | not timed separately | 0 errors, 990 warnings |
| `vitest run` (whole suite) | 134 s | 296 files passed, 3 skipped; 4,647 tests passed, 28 skipped |
| `pnpm pm:lint` | under 1 s | 0 errors, 0 warnings |

The supervisor runs these after the agent stops, so the result does not depend on the agent's own report. That keeps the one property of the protected checker that matters.

## UAT against which database

Until [DLV-154](<../../../Delivery/Delivery — Master Book.md#dlv-154>) exists, a local UAT build talks to production exactly as the owner's normal `pnpm dev` does today, started by the owner with the owner's `.env`. That is the current risk level, not a new one, and it is the reason migrations and money changes stay in the review list.

DLV-154 options, cheapest first:

| Option | Docker needed | Notes |
|---|---|---|
| A. Second hosted Supabase project used only for development | No | Recommended. Schema from an owner-run dump (`schema.sql` alone lacks RLS and functions), plus a small synthetic seed. Agents may write to it freely; Hard Rule 26 names the production project |
| B. Supabase CLI local stack | Yes, for the database only | Full fidelity, offline, but it reintroduces the dependency the owner wants gone |
| C. In-process Postgres for tests only | No | Useful for route tests; not a UAT target |

## What stays from V2 unchanged

Work identity and attempt history, the session screen, live activity, cancel, token display, the UAT wizard and Shipped semantics, the phone as a status and UAT surface. Starting a Local run from the phone is out of scope for the first version.

## What this design does not claim

- It is not safe for unattended or remote execution. The confined path stays for that.
- It does not make risk-domain changes automatic. That is the owner's chosen guardrail.
- It has not been built or run. Timings above are of the checks, not of a delivery.
