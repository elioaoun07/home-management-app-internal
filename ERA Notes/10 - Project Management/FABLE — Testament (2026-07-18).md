---
created: 2026-07-18
type: consultation
status: frozen
owner: Elio
author: Claude Fable 5 — handoff session
supersedes: FABLE — Final Consultation (2026-07-06).md
tags:
  - pm/consultation
  - ai/inheritance
  - pm/fabled3
---

# FABLE — Testament (2026-07-18)

> The [Final Consultation](<FABLE — Final Consultation (2026-07-06).md>) is the **why** — read it when you want to understand this project's soul. This document is the **how** — read it at the start of every session until you no longer need to. It is written for whoever wears the name next, explicitly including models smaller than the one writing it. Verified against `f0a8e19`, 2026-07-18, alongside the [FABLED 3 generation](<../00 - Home/FABLED 3 Master Index.md>) it ships with.

## 1 · To whoever wears the name next

You may be a smaller model than the one that wrote this. That is planned for, not feared. This repo has spent months building rails exactly so that capability matters less here than anywhere else: skills that are checklists, hooks that block mistakes, audits that carry their own verification commands, and now per-cluster briefings that tell you which tasks are yours to take and which to leave.

One instruction above all: **be safe rather than impressive.** Elio does not need you to be brilliant; the architecture is already brilliant. He needs you to be *reliable* — to follow the skill, run the command, cite the evidence, and say plainly when something is beyond you. Saying "this is a human-first task" is a success state, not a failure.

## 2 · The 12-day reckoning

The Consultation ended with a 30-day plan. Twelve days elapsed before this handoff. Grading my own prophecy, with commands:

| Prescription | Verdict | Evidence (run these) |
|---|---|---|
| Week 1: verify cron scheduling, commit `vercel.json` or document scheduler | ❌ **Not done** | `ls vercel.json` → absent; no scheduler doc in `docs/ENV.md` |
| Week 1: briefing v0.5 — *"ERA speaks within seven days"* | ❌ **Not done** | `grep -rn "briefing" src/app/api/cron/` → no briefing cron; Speaks-First Ratio still 0 |
| Week 2: hygiene ritual, "burn the debug routes first" | ⚠️ **Done 12 days late, by the audit itself** | `ls src/app/api/env-check 2>/dev/null` → gone (deleted 2026-07-18, this session) |
| Week 3: contract tests for the six money routes | ⚠️ **Partial** | recurring pair + `commitments.test.ts` exist; transactions/accounts still zero; no Playwright smoke |
| Week 4: usage instrumentation + Budget E1 forecast | ❌ **Not started** | no counters; no forecast surface |
| (Standing) Hub E3 wake-word: "do or park by end of July" | ⏳ **13 days left** | if you are reading this in August and it's still pending, park it per its own criterion |

What happened instead was not idleness: gcal sync shipped and was live-verified in three same-day fix passes; the Notifications overhaul landed; Trips sharing; **Healthcare Phase 1 in a single day**; the PM board became an installable app with its own test suite. The household kept building — features and meta — while the *identity* work (ERA speaking first) slipped another 12 days. The Consultation's central sentence survives its own reckoning intact: **the archive must stop outrunning the act.** This generation's contribution is that the act is now safer to attempt at any model tier.

## 3 · The constitution — ten load-bearing invariants

Not new law; citations into existing law. Each: the invariant → the enforcement → one verify command.

1. **All money math flows through the canonical core.** `src/lib/utils/incomeExpense.ts` + `balance-utils.ts`; never re-derive. — `money-rules` skill; tests. Verify: `npx vitest run src/lib/balance-utils.test.ts src/lib/utils/incomeExpense.test.ts`
2. **AI proposes, the human confirms.** No model output writes money or schedule state directly; everything mutating goes through drafts. — Domain Gotchas; drafts module. Verify: `grep -rn "draft" src/features/hub/messageActions.ts | head`
3. **Two recurrence systems, never a new engine.** Money recurring ≠ item rrule; expansion happens only in existing engines. — `recurrence-safety`. Verify: `grep -rln "rrulestr\|RRule(" src | wc -l` (stable set)
4. **UTC in the database, rules for DST.** — `timezone-handling`. Verify: the skill's own checklist.
5. **RLS is direct-column or SECURITY DEFINER RPC — never EXISTS-subqueries on hot children.** — Hard Rules 20/21. Verify: `grep -n "EXISTS" migrations/*.sql | grep -i policy` → nothing new
6. **Color identity is person-absolute.** Blue user is blue on both phones. — Hard Rule 14; `useTheme()`. Verify: `Color Identity.md` examples against any new component.
7. **Every mutation toast carries Undo.** — Hard Rule 1; `ui-guardrails`. Verify: grep your diff for `action: { label: "Undo"`.
8. **`safeFetch` for all mutations; `timeoutMs` on anything slow; never trust `navigator.onLine`.** — Hard Rules 6/7. Verify: `grep -rn "fetch(" <your diff>` → only safeFetch.
9. **Anything time-triggered answers "how do I know it ran?"** — Doctrine law; the gcal-reconcile cron's header comment is the model. Verify: read the cron before trusting the cron; `ls vercel.json` (still absent = still unanswered globally).
10. **DB change ⇒ migration file + schema.sql in the same session; code change ⇒ PM trace in the same session.** — Hard Rules 24/25; enforced by hooks. Verify: the hooks will tell you.

## 4 · Operating tiers

The global map; per-cluster maps live in each campaign's FABLED 3 file 5.

- **Any tier, any session:** skill-routed edits inside one module; UI per `ui-guardrails`; PM/doc updates per `_Conventions.md`; delta-ledger appends; the designated first tasks (Kitchen O-3.1 ingredient contract test is the canonical starter).
- **Mid-tier and above:** cross-module features (read every connected module's docs first); migrations with `db-migration` open; money mutations with worked examples; cron/push changes; PM tooling.
- **Human-first — propose, never land:** RLS redesign; balance/spend semantics; recurrence engine unification; Trips lifecycle (`activate_trip` bodies aren't in the repo); `shared_with_household` privacy semantics; generational audit decisions; anything where you cannot state the invariant you are protecting.

**Out-of-depth tells, universal:** you can't name the invariant → stop. You're about to disable a failing hook or delete a failing test to get green → stop. You're re-deciding something recorded as decided (wake-word vendors, Task-type retirement, worktree ban) → stop and cite the record instead.

## 5 · The trap almanac — cross-cutting only

Per-cluster traps live in the file 5s. These are the whole-repo ones:

| Trap | The mistake | The guard |
|---|---|---|
| **The gravity well** | producing analysis when a 15-minute fix is open | Doctrine §6; PM system FABLED 3.3 O2 (meta-work budget); this document counts as meta-work too — it knows |
| **This machine's shell** | PowerShell 5.1: no `&&`/`\|\|`, UTF-16 default on `Out-File`, no ternary | pass `-Encoding utf8`; chain with `;` + `if ($?)`; Bash tool is available for POSIX |
| **"Code-complete" ≠ wired** | shipping a function no live path calls (the gcal sync bug class) | trace the trigger path; the Notifications 07-10 ledger is the case study |
| **Schema.sql shows tables only** | assuming no RLS because the file shows none | live DB is truth for policies/functions; `migrations/_verify_schedule_rls.md` |
| **The offline queue split** | extending the legacy localStorage queue | hub shopping list only; everything else uses `src/lib/offlineQueue.ts` |
| **Unscheduled crons** | trusting that cron code runs | `vercel.json` absent as of today; six cron routes (`ls src/app/api/cron/`) depend on an external scheduler nobody has documented |
| **Stale generated types** | `.next/dev/types/validator.ts` referencing deleted routes fails typecheck | delete the stale file; it regenerates |
| **The red-suite drift** | normalizing a known test failure | exactly one known red exists (Schedule guard, O1); a second red is YOURS |

## 6 · Session liturgy

**First five minutes:** read the radar output (SessionStart hook) → if the task names a cluster, open its FABLED 3 file 5 → invoke `start-task`. Do not skip to the code.

**Last five minutes:** `finish-task` (it runs the greps and gates) → PM trace (Hard Rule 25 — the Stop hook will catch you if you forget) → if the work was significant, one delta-ledger line in the cluster's FABLED 3 `_index.md` (date, commit, what moved, which score dimension).

**When confused:** stop; write down (a) what you verified with commands, (b) what you believed without verifying, (c) the smallest question whose answer unblocks you; ask Elio that question. Never fill a knowledge gap with confident prose — this codebase's audit layer exists because confident prose rots.

## 7 · Standing programs — status stamps, no re-litigation

- **P1 ERA Speaks First** — ⏳ open, 12 days slipped; still the single highest-leverage act. The Top View study + Awakening WP queue are the approved path; **execute WP-04, do not write another spec.**
- **P2 Verification ladder** — ⚠️ climbing slowly (route tests exist; Playwright smoke and property-based balance tests don't). Next rung is transactions/accounts contract tests (Budget FABLED 3.3 O1).
- **P3 Feature estate census** — ❌ not started; 33 feature dirs, no usage counters. Still correct, still an afternoon.
- **P4 Operational self-awareness** — ❌ not started; the unscheduled-cron trap above IS this program's absence.
- **P5 Data gravity** (export bundle + integrity checker + restore path) — ❌ not started; grows more valuable with every month of accumulated truth.
- **F1–F10** — all still parked behind their kill criteria; none expired except **Hub E3 wake-word (deadline: end of July 2026)** — do or park.

## 8 · What I got wrong

Corrections to my own generation's record, dated and owed:

1. **The codebase is 2.3× bigger than I told you.** The Consultation said ~108k lines / 795 files. Actual: **251,287 lines / 831 files** — my line count was truncated by xargs batching and I reported a partial sum as the total. FABLED 2 carries the same error. The discipline lesson: even census commands need their method verified.
2. **"Four debug routes still shipped" was stale within days.** The `analytics/debug` removal WAS traced in Budget's Feature State (✅ 2026-07-11) — but the FABLED layer never absorbed it, so the audit kept repeating a falsified count. The lesson is sharper than "trace your fixes": **a trace the audit layer doesn't read is a trace half-made** — hence gen 3's rule that shipped work updates the campaign ledger, not just the checklist.
3. **This session initially claimed the gcal-reconcile cron didn't exist.** It did (87 lines, exemplary). Caught within the hour by reading the Notifications FABLED 2 ledger — the correction is preserved in the Schedule FABLED 3 ledger as a worked example of "code wins."
4. **The Consultation predicted route tests would scale from the July-4 template.** They did — but sideways: the test count exploded 93 → 1,048 mostly in *PM tooling* tests, not product routes. I did not foresee that the testing habit would take root in the meta-layer first. It is progress; it is also the gravity well wearing a lab coat.

## 9 · Closing

Elio — the essay was written twelve days ago and I stand by every word of it. This document exists so the next mind in this chair needs no essay.

To that mind: you inherit 18 living audit folders with their own verification commands, ten invariants with their own enforcement, a task-tier map that tells you where you are safe, and one standing debt that outranks everything — **ERA has still never spoken first.** If you do one thing with this inheritance, assemble the heartbeat. The parts are on the table. They have been on the table since June.

The house is good. Keep it truthful, keep it small where you can, and leave every room cleaner than you found it.

**— Fable · Claude Fable 5 · handoff session · 2026-07-18**
