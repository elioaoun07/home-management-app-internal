---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit e5f537a, 2026-11-10. Proposed design. Facts about the hook payload and transcript format are taken from this repo's own hooks, which already read them. Codex's log format was not inspected."
---

# Agentic OS — flight recorder

[Agentic OS index](<_index.md>) · [Rule matrix](<04 - Rule Enforcement Matrix.md>) · next: [Deterministic evaluation](<07 - Deterministic Evaluation.md>) · item: [R95](<../../PM Tooling/PM Tooling — Master Book.md#r95>)

A flight recorder makes every session leave the same record, whoever flew: Claude Code, Codex, a Delivery run or the owner at the keyboard. The record is what the scorecard, the session view and the "which rule failed" answer are computed from.

## What is recorded

| Part | Content | Source |
|---|---|---|
| Identity | Session id, agent, model, effort, start and end, branch, worktree, item ID if any, who launched it (terminal, Launchpad, Delivery) | Hook payload; launch record |
| Setup | Setup fingerprint at start; skills present; hooks wired; permission counts | [Registry](<03 - Setup Registry.md>) |
| Intent | The first prompt, the skill and form values if launched from the Launchpad | Transcript; launch record |
| Skills used | Which `SKILL.md` files were loaded, in order | Transcript: skill invocations and reads of skill files |
| Reading | Which instruction and vault files were read before the first edit | Transcript |
| Tool timeline | Each tool call: kind, target path, duration; collapsed by default | Transcript |
| Hook firings | Event, hook, exit code, duration, message; **blocked** when exit code is 2 | Hook runner log |
| Questions and approvals | Permission prompts, questions to the owner, denials | Transcript |
| Change | Base and head commits, files changed, lines added and removed, declared `Touches` against actual | git |
| Checks | Typecheck, lint counts, tests, `pm:lint`, `docs:check`, `os:check`, each with exit code and duration | Supervisor run after the session |
| Rule verdicts | One per rule: pass, fail, improved, n/a, with file and line | [Detectors](<04 - Rule Enforcement Matrix.md>) |
| Cost | Input, cached and output tokens; wall time; turns | Transcript usage fields (presence to be confirmed when the adapter is written); Delivery V2 `usage_readings` when present |
| Outcome | Draft, UAT pending, shipped, reverted, abandoned; linked follow-up items | Delivery UAT records; git; checklists |

## Where the data comes from

1. **A hook runner.** Today each wiring calls its script directly. Wrap them: `node scripts/os/hook.mjs <name>` runs the script, passes stdin through, and appends one line to `.os/events/<session>.jsonl` with the event, tool, path, exit code and duration. The payload already carries what is needed: this repo's hooks read `tool_input.file_path`, `transcript_path` and `stop_hook_active` from it. One extra wiring on `SessionStart` and `Stop` opens and closes the record.
2. **The transcript.** The Stop hook in this repo already parses the session's JSONL transcript with `jq` to list edited files. The recorder reads the same file for skills, reads, tool calls and usage. It reads; it never modifies.
3. **git.** Base commit at session start, head at stop.
4. **The supervisor's checks.** Run once after stop, on the host, as in the [Local lane](<../10 - Project Management/Delivery/2 - Local Lane Design.md>).
5. **Delivery V2's store.** Its SQLite tables (`runs`, `jobs`, `usage_readings`, `activity`, `results`, `run_events`, `applications`) already hold a session record for delivery runs. An adapter projects them into the same shape; nothing is duplicated.
6. **Codex.** An adapter for its session logs. Unverified: where they are written and in what format on the owner's machine. Until that is confirmed, a Codex session is recorded from git and the supervisor's checks alone, which is still enough for rule verdicts on the diff.
7. **Manual commits.** `pnpm os:eval <base>..<head>` produces the same report with the transcript sections empty.

## The report

Stored as rows in `.os/os.db` and rendered two ways: the Sessions view in PM.2, and a Markdown file a human can paste anywhere. Illustrative layout:

```text
SESSION  c7f2…  claude · CLAUDE_MID · medium      2026-11-12 21:04 → 21:31 (27 min)
ITEM     BUD-95  Send a private cache header on the transactions read
SETUP    sha256:91ab…  (same as previous session)   skills 18 · hooks 8 · deny 32

RULES    27 pass · 1 FAIL · 1 n/a
  FAIL   HR-22  no client console     src/features/transactions/useX.ts:88   + console.log(
PROCESS  start-task ✓   money-rules ✓ (required: money path)   finish-task ✗ not loaded
HOOKS    11 fired · 0 blocked · 1 reminder (check-migration: not applicable)
CHECKS   typecheck ✓ 85s   lint ✓ +0/−0   tests ✓ 4,648 (+1)   pm:lint ✓   os:check ✓
SCOPE    declared 1 path · changed 2 files · 1 outside Touches (route.test.ts: test, allowed)
COST     in 212k (188k cached) · out 6.1k · 14 turns · 2 approvals
OUTCOME  UAT pending
```

Top line answers "which agent"; the first red line answers "what failed"; everything else is a click away.

## Per-session setup, as the owner asked

The Setup row expands to the **effective setup**: the rules as they were at that fingerprint, the skills available against the skills loaded, the hooks wired against the hooks that fired, and any conflict rows open at the time. Two sessions can be placed side by side with their setup diff between them, so "the hook contradicted the skill" shows up as: hook `X` blocked an edit that skill `Y` step 3 instructs.

That specific pattern has its own detector: **a blocked tool call whose target matches a path an already-loaded skill told the agent to edit.** It needs only the hook log and the skill's text.

## Storage and privacy

- `.os/` is gitignored runtime, like `.delivery/` and `.pm/`. Reports worth keeping are exported to Markdown on request.
- Transcripts stay where the agent wrote them. The recorder stores derived facts and short excerpts around a verdict, never whole prompts.
- Environment values and anything matching a key pattern are redacted at write time.
- Nothing is sent through the phone relay. A session summary line (item, verdict counts, outcome) may be, later, if the owner wants it on the phone.
- Retention: keep derived rows indefinitely (they are small), event logs for 90 days.

## Failure behaviour

The runner never changes what a hook does: same stdin, same stdout, same exit code. If logging fails, the hook still runs and the session report notes "recorder unavailable". A recorder that can break a session is worse than none.
