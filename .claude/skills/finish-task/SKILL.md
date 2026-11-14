---
name: finish-task
description: "Definition-of-done gate — run BEFORE declaring any coding task complete or committing: self-review greps for hard-rule violations, typecheck/lint/tests, functional verification, docs & Atlas, PM Command Center update, migration pairing. Use at the end of EVERY task that touched src/ or migrations/; repo hooks will block you otherwise."
---

# /finish-task — Definition of Done

> **Contract:** a task is "done" when every gate below passes or is explicitly reported as not applicable **with a reason**. Never claim "should work". Your final report states what you verified, how, and what you did NOT verify. Repo hooks (`check-pm-update`, `check-migration`, pre-commit `docs:check`) enforce gates E/F — passing them by accident is not passing them.

## Gate A — Self-review greps (run on the files you changed)

Run each check with the Grep tool, scoped to your changed files. Any hit in **your** changes = fix before proceeding (pre-existing hits elsewhere: leave, but don't add to them).

| # | Grep pattern | Rule broken if found | Fix |
|---|---|---|---|
| 1 | `console\.(log\|warn\|error)` | Hard Rule 22 — no committed console output | Delete, or route through Error Logs module |
| 2 | `fetch\(` on a POST/PATCH/PUT/DELETE call you wrote | Hard Rule 6 — mutations use `safeFetch` | Swap to `safeFetch` from `@/lib/safeFetch` |
| 3 | `safeFetch` calls for AI/upload/external ops **without** `timeoutMs` | Hard Rule 6 — the default CRUD budget is too short for long work | Add `{ timeoutMs: 60_000 }` (or appropriate); timeout must not directly mark Offline |
| 4 | `toast.success(` without `action:` in the options | Hard Rule 1 — every mutation toast has Undo | Add the Undo action (see ui-guardrails §7) |
| 5 | `type="number"` | Hard Rule 19 | `type="text"` + `inputMode="decimal"` |
| 6 | `queryKey: \[` with inline string arrays in code you wrote | Query-key rule | Use `qk.*` / the module's `queryKeys.ts` factory |
| 7 | `bg-(black\|white\|slate-9\|zinc-9\|\[#)` on new surfaces | Hard Rule 10 — theme variables only | Use `tc.*` / `--theme-bg` |
| 8 | Edits under `src/components/ui/` | Hard Rule 11 | Revert; wrap instead |
| 9 | Naive datetime strings (`T\d\d:\d\d:\d\d"` without `Z`) in payloads you wrote | Timezone rule | `localToISO(...)` from `src/lib/utils/date.ts` |

## Gate B — Machine checks (all must be clean)

```
pnpm typecheck    # tsc --noEmit — zero errors
pnpm lint         # eslint — zero errors in changed files
pnpm test         # vitest run — or scoped: pnpm vitest run <path> when the suite is broad
```

On failure: fix the cause. Never suppress with `any`-casts, eslint-disable, `--no-verify`, or test skips to get green — if a check is fundamentally wrong, report it instead.

## Gate C — Functional verification (the one that actually matters)

1. `pnpm dev` and exercise the exact DONE-WHEN behavior from your task restatement — real clicks, real data, not just compilation.
2. Mobile viewport pass (~390 px) — Hard Rule 5 (see ui-guardrails §11).
3. If you touched a **Junction** module: exercise one flow in each connected standalone you traced.
4. If you touched a mutation: verify the toast (with Undo), and that every view displaying that data refreshes (cache-invalidation skill).
5. If a DB migration is pending manual run, you CANNOT fully verify — say so explicitly and hand the user the run-first instruction.

## Gate D — Docs

- [ ] Module vault doc updated if behavior/DB/gotchas changed (augment the existing doc — never create a parallel one).
- [ ] **New page/route/feature-module/nav change → Atlas entry** (Hard Rule 23): copy `ERA Notes/04 - UI & Design/Page & Feature Atlas/_Template.md`, fill all sections, add the `_Index.md` row. (`public/atlas/atlas.json` regenerates via hook — don't run it manually.)
- [ ] New route/icon → `ERA Notes/04 - UI & Design/App Routes and Icons.md`.
- [ ] Renamed a feature/route → update/delete the corresponding Atlas MD in the same commit.

## Gate E — PM Command Center (Hard Rule 25 — Stop hook enforces this)

If you touched `src/` or `migrations/`, record it in the owning campaign under `ERA Notes/10 - Project Management/` **in this same session**. `_index.md` there lists the campaigns; `_Conventions.md` owns the grammar. Do not keep a second list here.

1. **Tracked item finished and verified** → `pnpm pm:ship <ID> --note "<what you verified: tests, typecheck, flow exercised>"`. One command ticks the row, writes the dated `✅` receipt to the Master Book's Shipped Log, moves the item's criteria to `_Archive/Shipped/`, refreshes `_index.md` and runs `pm:lint` + `pm:check-docs`. If the owner still has to run a migration or check a device, add `**Implementation:** done` and `**UAT:** pending` to the `### <ID>` section **before** shipping: the section then stays in the book and the item appears under "Awaiting your acceptance".
2. **Untracked work** → first add the row to `4 - Checklist.md` (next free number; copy the row shape of its neighbours: bold ID, outcome, criteria link, `_(severity - effort)_`) and a `### <ID>` section with **Outcome** and **Acceptance** in the Master Book; then ship it as in 1.
3. **Partly done** → leave the row open; add a dated progress line inside its `### <ID>` section.
4. **Bug found but not fixed** → a Pain Inventory entry in the Master Book (🔴/🟠/🟡/⚪ lead, cause, evidence).
5. **A decision was realized** → mark `*(IMPLEMENTED YYYY-MM-DD)*` where the Master Book's Vision & Decisions describes it.

After any hand edit of a checklist run **`pnpm pm:lint`**. `pnpm pm:ship --undo` restores the files of the last ship run.

Pure tooling/config/hook changes with no PM-trackable story: state that explicitly in your report and finish — the hook fires once and accepts it.

## Gate F — Migration pairing (Hard Rule 24)

`migrations/schema.sql` changed ⇔ a `migrations/YYYY-MM-DD_*.sql` file from this session exists. One without the other = incomplete. Remind the user to run the migration manually in the Supabase SQL Editor.

## Gate G — The report (final message format)

```
DONE: <what changed, user-visible terms>
VERIFIED: <each behavior + HOW (flow exercised / test / typecheck)>
NOT VERIFIED: <anything you couldn't test + why + what the user must do (e.g. run migration)>
RISKS / FOLLOW-UPS: <known edge cases, drift you noticed (e.g. doc vs code), sibling code with the same defect>
```

Report failures faithfully: failing test → paste the output; skipped step → name it. An honest partial is acceptable; a confident guess is not.
