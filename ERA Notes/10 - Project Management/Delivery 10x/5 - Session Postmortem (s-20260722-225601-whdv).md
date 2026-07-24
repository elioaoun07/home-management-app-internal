---
created: 2026-07-24
updated: 2026-07-24
type: postmortem
status: baseline-frozen
owner: Elio
tags: [pm/postmortem, tooling/delivery]
---

# Session Postmortem — `s-20260722-225601-whdv` (BUD-11 #2)

> **Status: frozen evidence record.** Facts verified 2026-07-24 directly from `.delivery/sessions/s-20260722-225601-whdv/` and the working tree. This is the second failed delivery of the same item — BUD-11 #1 (`s-20260715-214421-hvfk`, ~3M tokens, never delivered) produced the DW-11…13 fixes ([Delivery Workspace/1 · Feature State](<../Delivery Workspace/1 - Feature State.md>)). This session shows those fixes were necessary but not sufficient: the gap was governance, not mechanics.

---

## 1. The packet

| Field | Value |
|---|---|
| Item | **BUD-11** `[TEST] Verify queryConfig cache timings align with API response patterns` — `Budget/4 - Checklist.md`, lane Now, `_(annoyance - S)_` |
| Mode / agent | `uat` / `claude`, model **`claude-haiku-4-5`**, effort discovery `low` · plan `medium` · building `medium` · review `low` |
| Constraints | `maxFixLoops: 3`, no new deps, forbidden `src/components/ui/**`, `gitPolicy: read-only`, 3 approval gates |
| Acceptance criteria | **8 ACs** (AC1–AC8): enforcement test banning hardcoded `staleTime`, full audit + migration of all hooks to `CACHE_TIMES` constants, JSDoc on every constant, a mapping doc in `ERA Notes/05 - Performance/Performance Optimizations.md`, test green on `pnpm test` |
| Budget envelope | **none** — the packet has no budget field; every `budgets.mjs` cap was unset |
| Workspace at start | `dirtyAtStart: true`; **baseline typecheck already FAILING** (pre-existing `tests/delivery/run-session.test.ts(1058,66)` `onEvent` error) |

**First structural observation:** an S-effort "verify" item entered the spec gate and came out as an 8-AC repo-wide migration program. The scope inflation happened *at spec time, with owner approval*, because nothing measured or displayed the mismatch (→ DLV-7).

## 2. Timeline (UTC; local = UTC+3)

| Time | Event |
|---|---|
| 19:56:01 | Session created → SELECTED → DISCOVERY. |
| 19:56–20:23 | Discovery, 6 turns (0001–0006). Turn 0005 = `guard-violation`, zero-usage, retried (decision 0005). Owner answers **4 substantive clarifying questions** (decisions 0001–0004): staleTime = freshness not latency; dedicated `CACHE_TIMES.BALANCE_HISTORY = 10min`; verify usage before sharing constants; fail-by-default with documented exceptions. |
| 20:26 | **Spec approved** (decision 0006; 0007–0013 spec acks). **Plan approved** (decision 0014). Plan STEP-6 names 13 files across accounts/day-plan/trips/nfc/outfits/recurring/transactions/memories/chores. |
| 20:26–20:51 | BUILDING: turns 0008–0012, then 0019, 0020, 0022, 0023. Agent writes audit docs to repo-root `artifacts/`, adds 3 constants, migrates 5 hooks in 3 files, writes the enforcement test. Validation: **typecheck FAIL (~48 syntax errors** — JSDoc-in-object-literal in `queryConfig.ts`, malformed test file); `lint (skipped)`, `test (skipped)`. Two "fix" turns repair the syntax. |
| 20:36–20:48 | **Seven consecutive blocked→retry cycles** (decisions 0015–0021), all `"retry"`, all note-less, no escalation, no notification. |
| 20:51:39 | **Fatal:** two turns return `isError: true` — *"You've hit your monthly spend limit · raise it at claude.ai/settings/usage."* `quota.mjs` patterns don't match "spend limit" ⇒ treated as retryable ⇒ retries exhausted ⇒ `state: BLOCKED`, `awaiting: {gate: blocked, returnTo: BUILDING}`, `fixLoop: 1`, `lastError.errorKind: null`. |
| later | Retry/resume attempts **crash the runner 3×** on a transiently malformed `.delivery/config.json` ("line 12 column 11", `config.mjs:119`) — `runner.log`. Config parses fine again by 2026-07-24. |

## 3. Cost & usage (`state.json`)

| Phase | Input | Cached input | Output | Cost |
|---|---|---|---|---|
| discovery | 5,557 | 930,222 | 15,906 | $0.34 |
| plan | 19 | 170,648 | 3,967 | $0.05 |
| building | 313 | **7,644,303** | 34,358 | **$2.52** |
| **total** | 5,889 | **8,745,173** | 54,231 | **$2.91** |

$2.91 on the *economy* model, with 8.7M cached-input tokens — and it still hit the account's monthly spend cap, because no session-level envelope existed to stop it earlier (→ DLV-1, DLV-8).

## 4. What the session left behind (uncommitted, as of 2026-07-24)

| Path | State |
|---|---|
| `src/lib/queryConfig.ts` | +3 constants (`BALANCE_HISTORY` 10min, `ALLOCATIONS` 5min, `ALLOCATION_SUGGESTIONS` 10min), comments rewritten. Value-preserving, syntactically repaired. |
| `src/features/balance/hooks.ts`, `src/features/balance/archiveHooks.ts`, `src/features/budget/hooks.ts` | 5 hooks migrated to `CACHE_TIMES.*` — correct, value-preserving. |
| `src/lib/queryConfig.test.ts` (untracked) | 295-line enforcement scanner. **Fails by design** against the 67+ un-migrated occurrences (AC7 unmeetable as left). Bug: line ~227 `expect.soft(violations, …).toBe([])` — reference equality, can never pass; must be `toEqual([])`. |
| `artifacts/` (untracked, repo root) | `STEP-1-audit.md` (72 occurrences / 25+ files), `STEP-2-invalidation-analysis.md`, `STEP-3-decision-matrix.md`, `build-log.md` (superset of the session copy). Genuinely useful audit material. |
| `ERA Notes/05 - Performance/Performance Optimizations.md` | **Untouched** — AC6 never done. |
| `Budget/4 - Checklist.md` BUD-11 | **Still `- [ ]`** — zero PM trace after two sessions (→ DLV-14). |

**Never verified green at any point.** The final persisted validation artifact is `ok: false`; the current on-disk files look repaired but were never re-validated before the spend limit hit.

## 5. What went right (preserve these)

- **Guardrails held 100%** — zero git mutations, `lastError.gitViolation: false`, no `bypassPermissions`, forbidden paths respected, read-only phases stayed read-only.
- **Gates + clarifying questions produced real value** — the owner's 4 answers materially improved the spec (the `BALANCE_HISTORY` constant decision was correct and survives in the diff).
- **Artifact-first persistence proved itself** — this entire postmortem was reconstructed from files alone, days later, with no session memory.
- **The code that exists is safe** — every migrated value is exactly equal to the literal it replaced; nothing behavioral broke.
- **The validate→fix loop mechanism works** — it caught the ~48 syntax errors and drove two successful repair turns.

## 6. Failure → fix traceability

| # | Failure | Root cause | Fix |
|---|---|---|---|
| F1 | No budget envelope; cap-hit came from the *account*, not the session | `budgets.mjs` caps all unset, no packet field, no UI | DLV-1, DLV-2 |
| F2 | Spend-limit error retried, then dead BLOCKED | `quota.mjs` pattern list misses "spend limit" | DLV-4 |
| F3 | Runner crash-loop on malformed config, invisible | no schema validation / atomic write / backoff / surfacing | DLV-3 |
| F4 | 7 note-less retries, no escalation | no per-gate retry cap or escalation policy | DLV-4 |
| F5 | Red baseline + dirty tree polluted the run | non-blocking warning; absolute (not delta) validation | DLV-5 |
| F6 | S-item became 8-AC/72-occurrence program at spec time | no measured scope estimate, no tripwire at the SPEC gate | DLV-7 |
| F7 | Haiku/low on a measured 25-file refactor | recommendation never re-run post-discovery | DLV-9 |
| F8 | "✅ COMPLETED" vs red validation; lint/test silently skipped | no AC matrix, no evidence gate, no validation contract | DLV-10, DLV-11 |
| F9 | True partial result buried in a build log; no revert/remaining-work record | no finish package on non-ACCEPTED exits | DLV-12 |
| F10 | Silent mid-build descoping (5 of 72) | no scope lock / AC reconciliation | DLV-7, DLV-10 |
| F11 | Zero PM trace after two failed sessions | writeback is an agent step, skippable | DLV-14 |
| F12 | Transcript gaps (t-0013…18, t-0021), unexplained zero-usage turns | aborted turns leave no stub record | DLV-17 |
| F13 | Nobody was told anything, ever | no notifications | DLV-16 |

## 7. BUD-11 salvage runbook (owner-executed; the tool never runs git)

Two honest options — decide once, don't drift:

**Option A — Salvage the slice (recommended).**
1. Fix the test bug: `expect.soft(violations, …).toBe([])` → `toEqual([])` in `src/lib/queryConfig.test.ts`.
2. Scope the enforcement test to *migrated modules only* for now (Budget/balance globs), or add the documented-exception comment mechanism it already supports to the 67 remaining occurrences' files — so `pnpm test` is green on the shipped slice.
3. Keep the 3 constants + 5 hook migrations (verified value-preserving).
4. Write the AC6 mapping section into `ERA Notes/05 - Performance/Performance Optimizations.md` (the `staleTime`/`gcTime`/`refetchOnMount`/`Cache-Control` relationship — material exists in `artifacts/STEP-2-invalidation-analysis.md`).
5. Run `pnpm typecheck && pnpm lint && pnpm test`; commit the slice.
6. PM trace: re-scope BUD-11 in [Budget/4](<../Budget/4 - Checklist.md>) — mark the slice done, file the remaining migration as decomposed follow-ups (`BUD-11.1` Schedule/Items, `BUD-11.2` Kitchen/Recipes/Catalogue, `BUD-11.3` remainder + flip the test to repo-wide). Move `artifacts/*.md` audit material somewhere durable (e.g. the Budget campaign folder or delete after filing).
7. Note: the pre-existing red baseline (`tests/delivery/run-session.test.ts` `onEvent`) is separate — fix under DLV-18 or its own item.

**Option B — Revert everything.** Display-only commands; run manually after review:
`git checkout -- src/lib/queryConfig.ts src/features/balance/hooks.ts src/features/balance/archiveHooks.ts src/features/budget/hooks.ts` · delete `src/lib/queryConfig.test.ts` and `artifacts/` · leave BUD-11 open with a Feature State note pointing at this postmortem so attempt #3 starts from the audit, not from zero.
