---
name: start-task
description: "Operating protocol + task router for this repo. Invoke at the START of any coding task (bug fix, feature, refactor, DB, UI) to classify the task, read the right docs in the right order, and pick the correct playbook. Triggers: beginning any new task, being handed a task by another agent, 'where do I start', unclear scope."
---

# /start-task — Operating Protocol & Task Router

> **Contract for the executing agent:** follow the steps in order. Do not skip a gate. Every claim you make about this codebase must be backed by a file you read **in this session** (cite `path:line`). If you cannot pass a gate, STOP and report exactly what blocked you — a correct "I'm blocked because X" is worth more than a plausible guess.

This repo is heavily indexed. The winning move is never "search broadly and improvise" — it is "read the right 3 files, then act". This skill tells you which 3 files.

## Step 1 — Restate the task (before any tool call)

Write this block in your response. If you cannot fill a line, ask the user now — not halfway through.

```
GOAL: <one sentence — what changes for the user>
DONE WHEN: <observable behavior that proves it works>
OUT OF SCOPE: <what you will NOT touch>
TASK TYPE: <bug | feature-in-existing-module | new-module | api | db | ui | docs/pm>
```

## Step 2 — Route to the playbook

| Task type | Playbook to read NOW | Path |
|---|---|---|
| Bug / error / regression / "X doesn't work" | fix-bug | `.claude/skills/fix-bug/SKILL.md` |
| New behavior in an existing module | add-feature | `.claude/skills/add-feature/SKILL.md` |
| Brand-new top-level module | new-module | `.claude/skills/new-module/SKILL.md` |
| Anything under `src/app/api/` | api-route | `.claude/skills/api-route/SKILL.md` |
| Any DB change (table/column/index/policy/enum) | db-migration | `.claude/skills/db-migration/SKILL.md` |
| Any component / page / style change | ui-guardrails | `.claude/skills/ui-guardrails/SKILL.md` |
| Mutation caching / stale data | cache-invalidation | `.claude/skills/cache-invalidation/SKILL.md` |
| Dates, DST, UTC storage | timezone-handling | `.claude/skills/timezone-handling/SKILL.md` |
| Money amounts, balances, transfers, envelopes | money-rules | `.claude/skills/money-rules/SKILL.md` |
| Due dates, occurrences, skip/confirm, auto-posting | recurrence-safety | `.claude/skills/recurrence-safety/SKILL.md` |
| Fix/clean/backfill production data, console scripts | data-repair | `.claude/skills/data-repair/SKILL.md` |
| Authoring a new skill for a new domain/module | skill-factory | `.claude/skills/skill-factory/SKILL.md` |
| Designing a feature, weighing a tradeoff, or NO playbook fits | Design Doctrine (not a skill — the judgment layer) | `ERA Notes/01 - Architecture/Design Doctrine.md` |

Most tasks need 2–3 playbooks (e.g. a feature = add-feature + api-route + ui-guardrails). Read all that apply **before** editing.

**Domain-risk gate — run this classification on EVERY task, whatever its type:** does the change touch (a) money correctness, (b) recurrence/due dates, (c) household visibility, or (d) cached/offline state? Each *yes* adds the matching domain skill (money-rules / recurrence-safety / api-route §household / cache-invalidation) to your reading list before you edit. The dangerous bugs in this app are not TypeScript errors — they are a transfer counted as spending, a payment posted twice, a partner seeing hidden data, or stale money on screen.

**Every task ends with `.claude/skills/finish-task/SKILL.md`. No exceptions.** Plan for it from the start.

## Step 3 — Read the docs in this exact order

Do this BEFORE any Glob/Grep/Read of source files:

1. `ERA Notes/01 - Architecture/Feature Map/_index.md` — find the module by user intent ("quick lookup" table at the top).
2. The module's Feature Map file (`Feature Map/standalone|junction|cross-cutting/<module>.md`) — this gives the **exact source files to edit**.
3. The module's vault doc (`ERA Notes/02 - Standalone Modules/<Module>/` or `03 - Junction Modules/<Module>/`) — architecture, DB tables, **gotchas**. Read the gotchas section even if you think you don't need it.
4. `migrations/schema.sql` — ONLY if the task touches the DB. It is authoritative for tables/columns (NOT for RLS/functions — see db-migration skill).
5. `ERA Notes/01 - Architecture/Common Patterns.md` — ONLY if touching state, mutations, or modals.
6. `ERA Notes/01 - Architecture/Design Doctrine.md` — ONLY if the task involves *designing* something (new feature shape, tradeoff, ambiguous requirement). Run its **Ten Questions** against your plan before Step 4; they catch the household/offline/undo/exactly-once holes that playbooks can't see at plan time.

> Feature Map = *which files*. Vault doc = *why it's built that way*. Doctrine = *how to decide*. Don't substitute one for another.

## Step 4 — Assumption ledger (the anti-guessing gate)

Before your first edit, list every assumption your plan rests on, and verify each with a tool call:

| Assumption about… | How to verify | NEVER |
|---|---|---|
| A file/dir exists | Feature Map first, then `Glob` | Never invent a path from memory |
| A DB column/table exists | Read it in `migrations/schema.sql` | Never write SQL/queries against unverified columns |
| An API route's request/response shape | Read the `route.ts` file | Never call an endpoint you haven't read |
| A helper/util exists (`safeFetch`, `qk`, `localToISO`, …) | Read its export in `src/lib/` | Never re-implement a canonical util |
| A constant's current value (timeouts, cache times) | Read the source file | Never trust docs for values — **code wins over docs**; if they disagree, note the drift in your report |
| Who consumes the code you're changing | `Grep` for the symbol before changing its signature | Never change a shared export without listing all call sites |

If an assumption can't be verified and materially changes the approach → STOP and ask.

## Scope rules (module model)

- **Standalone** modules (`src/features/<name>/`) must not import from other standalone feature dirs. Shared code goes in `src/components/`, `src/lib/`, `src/types/`.
- **Junction** modules (Hub Chat, Shopping List, AI Assistant, Notifications, Household Sharing, Sync & Offline, Prerequisites, Plan My Day, Trips) bridge standalones — before editing one, read the vault docs of **every connected standalone** and trace the cascade.
- Never edit `src/components/ui/` (blocked by hook).

## Environment & commands

| Action | Command | Notes |
|---|---|---|
| Typecheck | `pnpm typecheck` | `tsc --noEmit` — must be clean |
| Lint | `pnpm lint` | eslint |
| Tests | `pnpm test` | vitest run (scope: `pnpm vitest run <path>`) |
| Dev server | `pnpm dev` | Turbopack |
| Docs/index sync check | `pnpm docs:check` | Fails commit if Feature Index ↔ Feature Map drift |
| Regenerate AI mirrors | `pnpm sync:ai` | After CLAUDE.md edits |

Platform is Windows; use forward-slash-safe commands and never assume POSIX-only tooling in scripts.

## STOP conditions — ask the user instead of proceeding

1. The task requires deleting data, dropping tables/columns, or a destructive migration.
2. Requirements are ambiguous in a way that changes which module you'd edit.
3. Your plan unexpectedly grows past the module named in the Feature Map (junction cascade you didn't anticipate).
4. Docs, code, and the user's description disagree with each other.
5. Anything involving auth/RLS behaves differently than documented (RLS is not fully captured in the repo — live DB is truth).

## Exit

State your slice plan (files you will touch, per layer, with one-line justification each), then execute via the routed playbooks. Finish with `finish-task`.
