---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit 8da80ae, 2026-11-10. `tsc`, `eslint` and `vitest run` executed in a clean Linux container (4 cores, 15 GB); GitHub Actions history read for ci.yml."
---

# Architecture — the verification pyramid

[Fable 2 index](<../_index.md>) · [Module evidence matrix](<../02 - Standalone Modules/_Module Evidence Matrix.md>)

## Baseline, measured

| Check | Result |
|---|---|
| `tsc --noEmit -p .` | 0 errors in 85 s with a 10 GB heap. Plain `pnpm typecheck` aborted with "JavaScript heap out of memory" in this container |
| `pnpm lint` | 0 errors, **990 warnings**: 513 `no-explicit-any`, 320 `no-unused-vars`, 96 `no-restricted-syntax` (raw `fetch` mutation), 47 `react-hooks/exhaustive-deps`, 10 `no-img-element`, 4 other |
| `vitest run` | 296 files passed, 3 skipped; 4,647 tests passed, 28 skipped; 134 s |
| `pnpm pm:lint` | 0 errors, 0 warnings |
| `pnpm pm:check-docs` | 17 errors, all missing link targets to gitignored `.tmp/` and `.delivery/` evidence. Not part of CI |
| CI (`.github/workflows/ci.yml`) | typecheck, lint, test, pm:lint, docs:check. Runs 40–48 passed; 38 and 39 (2026-10-27) failed |

The suite is healthy and fast. The findings are about where it points.

## 1. Tests guard the tool more than the product

| Area | Test files | Share |
|---|---|---|
| PM and Delivery tooling (`tests/delivery`, `tests/delivery-v2`, `tests/pm-ui`, `tests/pm-*`) | 172 | 58% |
| Everything the household uses | 127 | 42% |
| of which ERA command layer (`src/features/era`) | 41 | |

23 of 35 feature directories have no test file (the generated `graphify-out` is not counted). Among money features `accounts`, `balance`, `budget`, `debts`, `drafts`, `categories` and `future-purchases` have none; `transactions`, `transfers`, `recurring` and `statement-import` have one each. Of 256 API routes, 13 have a route test. The full table is in the [module evidence matrix](<../02 - Standalone Modules/_Module Evidence Matrix.md>).

The Major Bug Sweep found its four critical defects by reading, in exactly the places with no tests. Existing BUD-74 (cover core money route contracts) is the right first response and sits in Next; [R90](<../../PM Tooling/PM Tooling — Master Book.md#r90>) adds the authorization contract for service-role routes.

## 2. Lint reports the Hard Rules but cannot fail on them

The rule that implements Hard Rule 6 is set to `"warn"` (`eslint.config.mjs:57-58`), so its 96 hits pass CI. The same is true of all 990 warnings. Existing R44 (guard new raw-fetch mutations), R47 (client console rule), R46 (Zod warning) and DLV-84 (hook dependencies) each own a slice. What is missing is a ratchet: record today's count per rule and fail CI when a count rises. That makes every existing slice safe to do gradually and needs no cleanup first. Recommendation only; fold into R44 when it is taken.

## 3. Input validation is half done

101 of 215 mutating routes import no Zod schema. By area the worst are notifications (15 of 16), guest-portal (7 of 7), hub (7 of 10), catalogue (7 of 12), and the money areas accounts (4 of 7), transactions (4 of 5), debts (3 of 3), drafts (2 of 2), future-purchases (3 of 3). Existing R46 and the sweep's BUD-94 own this. No new item.

## 4. `pnpm typecheck` depends on the machine

It passes on the owner's laptop and in CI and runs out of memory in a 15 GB cloud container at Node's default heap. Any agent working in a cloud session (this one included) cannot run the documented command. [R91](<../../PM Tooling/PM Tooling — Master Book.md#r91>): set the heap in the script.

The same environment skips the pre-commit gate entirely: `.husky/pre-commit` is stored without the executable bit (git mode 100644), so on a Linux clone git prints "hook was ignored because it's not set as executable" and commits without running docs, PWA, typecheck or tests. Observed when this filing was committed; the checks were run by hand instead. Folded into R91.

## 5. One checker is not in CI

`pm:check-docs` is the check that would have caught a study naming IDs that do not exist, and the one that knows about 17 broken evidence links. CI runs `pm:lint` only. [R88](<../../PM Tooling/PM Tooling — Master Book.md#r88>).

## What a stronger pyramid looks like here

1. Route-contract tests for the money API areas (BUD-74): authentication, authorization, validation, exactly-once.
2. One table-driven authorization test covering every route that imports `supabaseAdmin` (R90).
3. A lint ratchet so rule debt can only shrink.
4. `pm:check-docs` and `db:verify-rls` (snapshot age) in CI.
5. Only then, a thin end-to-end smoke against the development database from DLV-154.
