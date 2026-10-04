# Skills & Agents

Reference for the engineer playbooks (skills) and custom agents registered in this repo.

## Skills

Located in `.claude/skills/<name>/SKILL.md`.

| Skill                | What it does                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `add-feature`        | Playbook for adding a feature to an existing module as a vertical slice (DB → API → types → hooks → UI → wiring).   |
| `api-route`          | Recipe and verified template for routes under `src/app/api/` (auth → Zod → household linking → DB → error mapping). |
| `cache-invalidation` | Rules for correct TanStack Query cache invalidation in mutations and feature hooks.                                 |
| `data-repair`        | Safe workflow for production data fixes (inspect, dry-run, backup, idempotent fix, verify, rollback).               |
| `db-migration`       | Database change workflow: write the migration runbook first, update `schema.sql`, pick a safe RLS pattern.          |
| `era-wire`           | Wires an already-shipped manual feature into the ERA command bar (grammar + adapter + Gym case).                    |
| `finish-task`        | Definition-of-done gate run before completing any task (self-review, typecheck/lint/tests, docs, PM update).        |
| `fix-bug`            | Evidence-first debugging playbook (reproduce, locate, root-cause with proof, minimal fix, verify, PM trace).        |
| `money-rules`        | Financial-correctness invariants for any money module, with a required before/after balance example and test.       |
| `new-module`         | Scaffolds a new Standalone or Junction module and keeps all six index surfaces in sync.                             |
| `pwa-install`        | Rules for the many installable PWAs on one origin (manifests, "already installed" errors).                          |
| `recurrence-safety`  | Safety rules for both recurrence systems to prevent duplicate generation of future instances.                       |
| `skill-factory`      | Meta-skill for authoring a new repo skill in house style and registering it.                                        |
| `start-task`         | Operating protocol and task router to run at the start of any coding task.                                          |
| `timezone-handling`  | UTC storage and DST handling rules for dates, RRule/DTSTART, and mutations.                                         |
| `triage-inbox`       | Files raw PM Inbox captures into canonical outcomes/decisions without implementing product work.                    |
| `ui-guardrails`      | UI/UX hard rules (theming, color identity, opaque panels, header offsets, toasts, mobile-first).                    |
| `wizard`             | Runs interleaved AI/owner setup or debug sessions as a shared step-by-step checklist with verification gates.       |

## Agents

None defined in this repo (no `.claude/agents/`, `.github/agents/`, `*.agent.md`, or `*.chatmode.md`).
