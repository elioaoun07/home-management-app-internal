---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit 8da80ae, 2026-11-10. Source read and suites run in a clean Linux container with no .env and no production access. No delivery run was started."
---

# Delivery — why it feels unusable

[Fable 2 index](<../../_index.md>) · next: [Local lane design](<2 - Local Lane Design.md>) · [Gate disposition](<3 - Gate Disposition.md>) · [Migration](<4 - Migration and Retirement.md>) · [Supervisor contract](<5 - Supervisor Contract.md>)

## Verdict

Delivery V2 is a well-built answer to a question the owner is no longer asking. It was designed for **unattended execution by an untrusted worker on a machine that holds secrets**. The owner's stated operating mode (2026-11-10) is **supervised local delivery → UAT → ship**. In that mode most of the stack protects things git already makes recoverable, and the three assets that actually matter are protected only indirectly.

## What one run has to pass today

| Stage | Mechanism | Source |
|---|---|---|
| Browser trust | Pairing code even on loopback (`pnpm pm:pair`) | `scripts/pm/app/BrowserSession.tsx:30-31`, `scripts/delivery-v2/local-auth.mjs` |
| Launch readiness | 11 gates: policy, selection, source, coordination, runtime, authentication, modelAvailability, environment, qualification, checks, budget. Six need a live observation; observations expire after 60 s, a Ready projection after 30 s | `scripts/delivery-v2/readiness-contract.mjs:3-6`; [Delivery V2 §Pre-launch readiness](<../../../Plans/Delivery V2.md#pre-launch-readiness-report--2026-10-19>) |
| Authority | Installed execution policy (revision 13 at the cutoff), a grant with an expiry, renewal receipts, 13 refusal codes | `scripts/delivery-v2/policy.mjs:138-158`, `scripts/delivery-v2/authorization.mjs` |
| Worker | Disposable Linux container: non-root, read-only root, no host mounts. Dispatch is impossible without it | `scripts/delivery-v2/journey.mjs:24-25`, `scripts/delivery-v2/worker-boundary.mjs` (1,205 lines) |
| Executor | Per-backend qualification record. The Claude profile is still `status: "unqualified"` with seven unobserved controls | `scripts/delivery-v2/profiles/claude-local.json` |
| Plan | Read-only investigation job → plan revision → owner approval binds revision, contract and grant | `scripts/delivery-v2/journey.mjs:12-15` |
| Verification | Quiesce, export, freeze, protected checks in a second container (typecheck, candidate tests) | `scripts/delivery-v2/checks.mjs`, `typecheck.mjs`, `candidate-tests.mjs` |
| Landing | Apply writes only the approved frozen diff through an integrator, with a rollback journal | `scripts/delivery-v2/apply.mjs` (588 lines) |
| Acceptance | Owner test gate → UAT wizard → explicit sign-off is the only thing that means Shipped | `scripts/delivery-v2/test-gate.mjs`, `uat.mjs` |

Workers are also launched with `"skills": []` and `"settingSources": []` (`profiles/claude-local.json`), so the delivering agent does not get this repo's CLAUDE.md, skills or hooks: the strongest quality asset in the repository is switched off for exactly the sessions that write code.

## Cost against output

| Measure | Value | How measured |
|---|---|---|
| Delivery + PM tooling source | about 74,000 lines in 306 files (`scripts/delivery-v2`, `scripts/delivery`, `scripts/pm`) | `wc -l` |
| V1 engine still imported by the server, bridge and V2 | 16,584 lines (`scripts/delivery/`) | imports in `scripts/pm-server.mjs:64`, `scripts/pm/bridge.mjs:43-46`, `scripts/delivery-v2/{criteria,service,touches}.mjs` |
| Test files for PM/Delivery tooling | 172 of 299 in the repo (58%) | `find` on `tests/` and `src/` |
| Distinct V2 run IDs cited in active PM docs and `docs/` | 8 since 2026-09-13 | `grep -o 'r-[0-9a-f]{12}'` |
| Sprint outcomes | 2 of 20 planned items delivered across six elapsed weeks (0/5, 1/4, 0/3, 0/3, 0/3, 1/2) | Sprints view, 2026-11-10 |

Recorded blockers that were not product bugs (all from the [Delivery Master Book](<../../../Delivery/Delivery — Master Book.md>) state log and `docs/Delivery-Requests.md`): the Docker backend was absent (2026-10-31); a script-only `package.json` edit invalidated the checker environment (2026-10-27); an expired grant needed a manual renewal (2026-10-24); readiness went from Ready to expired admission inside two minutes (2026-10-19, 23:05–23:07); a lifetime token allowance silently queued a run forever (2026-09-15); the installed policy covered one item's files only (2026-09-15). DLV-148 already answered the owner's 2026-10-27 remark "too much of a constraint that it is not practical" with a standing policy, but every layer above is still in place.

## Root cause: the threat model does not match the use

In supervised local use the assets are:

1. **The production database.** One Supabase project holds real money and schedule data, and `SUPABASE_SERVICE_ROLE_KEY` sits in the repo-root `.env` (`docs/ENV.md:13`). There is no second database anywhere ([Environments](<../../01 - Architecture/Environments and Data Safety.md>)).
2. **Paid APIs.** Gemini, Claude and Azure keys (Hard Rule 29).
3. **`main` and the deployment that follows it.**

A container stops a worker writing outside its scratch directory. Git already makes every repository file recoverable, so that is the cheapest thing to lose. What the container does usefully is keep the worker away from `.env`, and the same result is available from a far smaller mechanism: do not give the worker the keys, give it a branch, and keep the merge with the owner. That is the [Local lane](<2 - Local Lane Design.md>).

The independent checker is the other large piece. It exists so a worker cannot fake its own verification. Measured on 2026-11-10 without any container: `tsc --noEmit` finishes in 85 s (0 errors) and the whole Vitest suite in 134 s (4,647 passed, 28 skipped). The supervisor can simply run those itself, on the host, after the worker stops. CI already runs the same commands on every push and pull request; its last nine runs (40–48, 2026-10-31 to 2026-11-06) all passed.

## What is good and should survive

- One work identity per item with a permanent attempt history.
- A readable plan before code, and the Plan / Changes / Checks / Activity session layout.
- The UAT wizard and the rule that only an explicit sign-off means Shipped.
- Live activity (DLV-109), cancel (DLV-122), honest token display (DLV-119).
- Subscription-only executors with no silent fallback.
- `Touches` as a declared scope, used as a hint instead of a lock.

## Decisions this reverses

The Local lane contradicts recorded decisions. The owner's 2026-11-10 direction is logged in the Delivery book; these are the specific lines it supersedes for the Local lane only:

| Recorded decision | Where | Effect |
|---|---|---|
| "no Git writes/worktrees/permission bypass" (V1 freeze) | `Plans/Delivery V2.md` line 82 | Local lane uses a branch and a worktree per item |
| Boundary direction 2026-09-11: disposable containers for worker and checker | Delivery book, Vision & Decisions | Not required in the Local lane |
| DEC-16: Apply only through the protected integrator writing the frozen diff | Delivery book, Vision & Decisions | Replaced by an owner merge after UAT |
| DLV-96 / DLV-97: qualification and explicit dispatch policy before any pilot | Delivery book | Not required in the Local lane |

The confined path is not deleted by this. It stays available, frozen, for any future unattended or remote use ([Migration](<4 - Migration and Retirement.md>)).
