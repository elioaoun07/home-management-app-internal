---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit 8da80ae, 2026-11-10."
---

# Method and evidence

[Fable 2 index](<../_index.md>) · [Coverage map](<Coverage Map.md>)

## Conditions

- Repository at commit `8da80ae` on a fresh, shallow clone (50 commits), in a Linux container with 4 cores and 15 GB. The project's stated platform is Windows; nothing here was run on the owner's machine.
- No `.env`, no Supabase credentials, no provider keys. The production database was never queried and no Supabase tool was called (Hard Rule 26). No paid API was called (Hard Rule 29); the test suite ran replay-only with `tests/setup/blockPaidApis.ts` in place.
- No delivery run, no pairing, no phone relay. `.delivery/` and `.tmp/` do not exist in a clone, so every claim in PM documents that cites them could not be checked.
- One session, no subagents. Breadth was bought with measurement; depth was spent on Delivery, the Command Center and the cross-cutting findings.

## Evidence classes used in these documents

| Word | Meaning |
|---|---|
| Measured | A command was run in this session and its output is quoted |
| Read | The cited file and lines were opened in this session |
| Seen | Observed in the running Command Center or its screenshots |
| From the sweep / from the book | Taken from a cited document without re-verification |
| Not examined | Stated explicitly, never implied to be fine |
| Proposed | A design or recommendation; nothing is implemented |

## Commands and results

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | 16.5 s |
| `pnpm typecheck` | Aborted: JavaScript heap out of memory |
| `NODE_OPTIONS=--max-old-space-size=10240 npx tsc --noEmit -p .` | Exit 0, 0 errors, 85 s |
| `pnpm lint` | 0 errors, 990 warnings |
| `npx vitest run` | 296 files passed, 3 skipped; 4,647 tests passed, 28 skipped; 134 s |
| `node scripts/pm/lint.mjs` | 0 errors, 0 warnings |
| `node scripts/pm/check-docs.mjs` | 17 errors before this filing (15 in the Delivery book, 2 in Plans/Delivery Optimization Closeout), all missing `.tmp/` or `.delivery/` targets |
| `node scripts/check-db-state.mjs` | Snapshot 97 days old; RLS disabled on `guest_drinks`, `item_prerequisites` |
| `node scripts/pm-server.mjs --no-open --no-bridge` plus Playwright | 14 screenshots, 7 views at two sizes; no page error |
| GitHub Actions, `ci.yml` | 48 runs; 40–48 passed; 38 and 39 failed |
| `find`, `wc`, `grep` over `src/`, `scripts/`, `tests/`, `ERA Notes/` | Counts quoted in each document |

## How findings were chosen

1. Read the rules (`CLAUDE.md`, conventions, registry) and the prior audits marked "read" in the [coverage map](<Coverage Map.md>), so that nothing already owned is filed twice.
2. Measure the whole repository cheaply: sizes, tests, lint, routes, validation, service-role use, headers.
3. Follow each anomaly to source until it is either confirmed with a line reference or dropped.
4. Check the PM backlog for an existing owner before allocating an ID.
5. For every claim, name its evidence class.

Three anomalies were dropped after checking: the three `notifications/*` routes with no auth call are forwarding shims that pass the header through; the eight sampled service-role routes each show an authentication call followed by an owner or household check; CI is green, so the typecheck memory problem is an environment sensitivity, not a broken gate.

## Known weaknesses of this pass

- Heuristics: "no Zod" and "no auth call" are text matches on a route file. A route that validates by hand or delegates to a service is counted as lacking.
- The shallow clone hides history before September, so no claim about long-run velocity is made from git.
- The Command Center was seen empty of delivery state.
- The Local lane is a design argued from source and measurement. It has not been built, run or attacked ([study H6](<../Model Tiers/CLAUDE_HIGH/Work Packets.md>)).
