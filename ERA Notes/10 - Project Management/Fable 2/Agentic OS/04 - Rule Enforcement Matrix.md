---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit e5f537a, 2026-11-10. 'Today' is from reading the hooks, lint config, tests and settings; baseline counts are greps and lint output from this pass. 'Proposed' is design."
---

# Agentic OS — rule enforcement matrix

[Agentic OS index](<_index.md>) · [Setup registry](<03 - Setup Registry.md>) · next: [Conflict and drift detector](<05 - Conflict and Drift Detector.md>) · item: [R94](<../../PM Tooling/PM Tooling — Master Book.md#r94>)

## Enforcement levels

| Level | Meaning | Shield in PM.2 |
|---|---|---|
| **Blocked** | A mechanism stops the action or fails hard (hook exit 2, config deny, test setup) | Full |
| **Checked** | A deterministic detector gives pass or fail on a diff or a transcript, and a failing verdict is recorded | Three quarters |
| **Reminded** | Something prints a message and continues | Half |
| **Written** | Text in `CLAUDE.md` or a skill only | Outline |
| **Judgment** | Cannot be decided by a script; belongs in UAT | Eye |

## The 29 Hard Rules

| Rule | Subject | Today | Baseline on `main` | Proposed detector | Target |
|---|---|---|---|---|---|
| 1 | Every toast has Undo | Written | 24 files with `toast.success` and no "Undo" | Syntax check: a `toast.success` call whose options lack `action`, on added lines. Blocked on DEC-07's wording | Checked |
| 2 | Single click opens, double click pins | Written | n/a | UAT scenario | Judgment |
| 3 | No red on item rows | Written | not measured | Advisory: red utility classes added in row components | Reminded |
| 4 | Futuristic SVG icons | Written | n/a | none | Judgment |
| 5 | Mobile-first | Written | n/a | Process: a UI diff needs a 390 px screenshot in the session report | Checked (process) |
| 6 | `safeFetch` for mutations; `timeoutMs` on slow calls | Reminded (lint `warn`) | 96 call sites | Lint count must not rise; added AI or upload calls must pass `timeoutMs` | Checked |
| 7 | Never trust `navigator.onLine` | Written | 7 references | Added use outside `connectivityManager` | Checked |
| 8 | Cron routes: secret, admin client, `maxDuration` | Written | 6 of 6 have `maxDuration` and the admin client; 4 of 6 refuse an unset secret | Static check of every file under `src/app/api/cron/` | Checked |
| 9 | Unique violation returns 409 | Written | 47 of 94 inserting routes mention `23505` | Changed route with an insert and no `23505` branch | Checked |
| 10 | Theme variables, no hardcoded backgrounds | Written | not measured | Hardcoded background classes on added lines | Reminded |
| 11 | Never edit `src/components/ui/` | **Blocked** (Claude); weaker copy for Codex | 0 expected | Also a diff check so any author is covered | Blocked |
| 12 | Zod for all API input | Written | 101 of 215 mutating routes import no schema | Changed mutating route without a parse | Checked |
| 13 | Household linking in routes | Written | not measured | The service-role contract test ([R90](<../../PM Tooling/PM Tooling — Master Book.md#r90>)) | Checked |
| 14 | Colour identity follows the person | Written | not measured | Advisory: literal blue or pink identity classes outside the theme helper | Reminded |
| 15 | Floating panels opaque and portaled | Written | not measured | Advisory: `neo-card` inside a popover or dropdown file | Reminded |
| 16 | Fixed headers need a content offset | Written | n/a | UAT scenario | Judgment |
| 17 | Cache invalidation | Written (skill) | not measured | Advisory: added `useMutation` with no invalidation in the same hook | Reminded |
| 18 | Time zone consistency | Written (skill) | 9 sites listed by the bug sweep | Server-side `toISOString().split("T")[0]` on added lines under `src/app/api` and `src/services` | Checked |
| 19 | No `type="number"` | Written | 3 | Added occurrence outside `src/components/ui` | Checked |
| 20 | No `EXISTS` policies on hot child tables | Written | unknown (snapshot 97 days old) | A new migration file creating such a policy on a listed table | Checked |
| 21 | One bundle RPC for hot parent plus children | Written | n/a | none | Judgment |
| 22 | No `console.*` in client code | Written | 184 calls in 45 files | Added call in the listed client directories | Checked |
| 23 | Atlas stays in sync | Reminded (hook regenerates JSON) | not measured | New `page.tsx` or route folder with no Atlas entry in the same diff | Checked |
| 24 | Migration file and `schema.sql` together | Reminded (hook prints, exits 0) | n/a | `schema.sql` changed if and only if a dated migration is in the diff | Checked |
| 25 | PM files updated in the same session | Blocks once (Stop hook, Claude only) | n/a | A `src/` or `migrations/` diff needs a checklist or book diff naming an ID | Checked |
| 26 | No agent writes to production | **Blocked** by name in local Claude sessions only | n/a | Deny in every namespace ([R84](<../../PM Tooling/PM Tooling — Master Book.md#r84>)); transcript scan for write tools, `psql`, `supabase db`, service-role scripts | Blocked + Checked |
| 27 | RLS state before route code on "can't see" bugs | Written | n/a | Transcript order: `migrations/db-state.json` is read before any file under `src/app/api` when the prompt matches the pattern | Checked (process) |
| 28 | UI text is a cost | Written | n/a | Advisory: long string literals added in JSX | Reminded |
| 29 | No live paid-API tests | **Blocked** (`blockPaidApis.ts`) | 0 | Transcript scan for calls to paid hosts outside Vitest | Blocked |

## Summary

| Level | Today | After this plan |
|---|---|---|
| Blocked | 3 (rules 11, 26, 29; two of them for one agent or one namespace) | 3, for every agent |
| Blocks once | 1 (rule 25) | 0 |
| Checked | 0 | 16 |
| Reminded | 3 (rules 6, 23, 24) | 6 |
| Written only | 22 | 0 |
| Judgment | n/a | 4 (rules 2, 4, 16, 21) |

Today's headline for the PM.2 rulebook: **7 of 29 rules have any mechanism behind them, and none of them covers Codex fully.**

## How a detector is written

```text
scripts/os/detectors/hr-22-no-client-console.mjs
  export const meta = { rule: "HR-22", version: 1, type: "diff", level: "checked" }
  export function detect({ addedLines, removedLines, read }) -> [{ verdict, file, line, excerpt }]
tests/os/detectors/hr-22.test.ts
  one fixture that must fail, one that must pass, one that must be not-applicable
```

- **Input is a diff, not the tree.** A detector reports violations the change added and violations it removed. The session's verdict for the rule is `fail` if it added any, `improved` if it only removed, `pass` if neither, `n/a` if no file in scope changed.
- **Process detectors** take the transcript instead of the diff (rules 5, 27, parts of 26 and 29).
- **Every detector has fixtures.** The three-case test is the detector's own contract; without it the detector does not load.
- **Versioned.** A report stores the detector version, so a later, stricter detector does not rewrite history.
- **Advisory detectors** (level Reminded) never fail a session. They add a note to the report and a count to the rule's card.

## Order of building

First the eight with exact patterns and existing debt worth watching: 22, 6, 19, 7, 24, 25, 8, 12. They cover the rules most often broken in the baseline, and each is under fifty lines. Then 26 and 29 (transcript scans), 18, 9, 23, 20, 27, 11, 1, 13.
