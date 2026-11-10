---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit e5f537a, 2026-11-10. Every example below was observed in the repository in this pass. The detector itself is proposed."
---

# Agentic OS — conflict and drift detector

[Agentic OS index](<_index.md>) · [Setup registry](<03 - Setup Registry.md>) · next: [Flight recorder](<06 - Flight Recorder.md>) · items: [R92](<../../PM Tooling/PM Tooling — Master Book.md#r92>) (fix what exists), [R93](<../../PM Tooling/PM Tooling — Master Book.md#r93>) (detect it from now on)

The owner's question, "which hook is contradicting another thing", has a deterministic answer once the setup is data: a conflict is a query over the [registry](<03 - Setup Registry.md>) that returns rows. `pnpm os:check` runs the queries.

## Conflict classes, each with a case found today

| Code | Class | The query | Found at the cutoff | Severity |
|---|---|---|---|---|
| `MIRROR` | A copy differs from its source | Hash of each mirrored file against its source, after the declared header | `.agents/skills/cache-invalidation` is 13 lines behind `.claude/skills/cache-invalidation`; all four same-named Codex hook scripts differ from the Claude ones | error |
| `PARITY` | A guard exists for one agent and not another | Rules whose `enforcedBy` covers a strict subset of agents | Migration pairing, PM trace, session brief and prompt reminders exist for Claude only; 16 of 18 skills are Claude-only | warning, error for Blocked-level rules |
| `PORTABLE` | Config that works on one machine | Absolute paths, drive letters, user profile folders, shell names in wiring | `.codex/hooks.json` wires three scripts by an absolute Windows user path; `.claude/settings.json` allows two `PowerShell(...)` commands while hooks are bash and CI is Linux | error |
| `DUPLICATE` | Two configs claim the same job and disagree | More than one hook config per agent | `.codex/settings.json` wires `sync-codex.sh` only; `.codex/hooks.json` wires `block-ui-dir`, `sync-copilot`, `update-atlas` | error |
| `DEAD` | Present but unreachable | Scripts no wiring references; hooks git will not run | `.claude/hooks/sync-copilot.sh` is unreferenced; `.husky/pre-commit` lacks the executable bit | warning |
| `NAME-BOUND` | A guard keyed to a name that varies | Deny patterns for a tool family in one namespace only | Supabase write tools denied as `mcp__claude_ai_Supabase__*`, exposed in cloud sessions as `mcp__Supabase__*` | error |
| `SOFT-CLAIM` | Text says "enforced", the mechanism only reminds | Rule text containing "enforced by" where every linked mechanism is non-blocking | Rule 24's hook prints a reminder and exits 0; rule 6's lint is `warn`; rule 25's hook passes if any PM file changed | warning |
| `CONTRADICTION` | Two instruction sources disagree | Same subject, different statement, in files the scanner knows are instructions | `CLAUDE.md`: read the Master Book before working a campaign; `_Conventions.md` §9: read one item, do not load the book. `start-task`: nine junctions including Trips; `CLAUDE.md` table: ten, without Trips. `finish-task` Gate E: six campaign folders; the PM index: eleven. `start-task`: "Platform is Windows"; hooks, CI and cloud sessions: bash on Linux | warning |
| `SHADOW` | Two files share a name with different roles | Same basename in instruction locations | Root `CODEX.md` (generated mirror) and `ERA Notes/CODEX.md` (a July checklist) | warning |
| `STALE-REF` | An instruction points at something moved or archived | Links and paths inside skills and hooks that do not resolve, or resolve into `_Archive/` | `new-module` sends the agent to read an audit that now lives in the archive no tool scans; R71 already records the Stop hook pointing at old files | warning |
| `UNLOADED` | A launch path that drops the setup | Session launch options with empty skills or settings sources | Delivery V2 profiles set `"skills": []` and `"settingSources": []` | warning |
| `TRACKED-LOCAL` | A file meant to be personal is committed | `*.local.*` under version control | `.claude/settings.local.json` is tracked with 226 allow entries | warning |
| `BASELINE` | A rule already broken on `main` | Detector count on the default branch above zero | Rule 22: 184; rule 6: 96; rule 8: 2 of 6 | info; drives delta verdicts |

Thirteen classes, all populated. None of them needed a model to find; each needed someone to look.

## How contradictions are found without a model

`CONTRADICTION` is the only class that sounds like it needs judgment. It does not, if facts are extracted instead of prose compared:

1. The scanner extracts **enumerations** from instruction files: the junction list, the campaign list, the skill list, the hook list, the platform, the commands table.
2. Each enumeration has one declared owner (the Feature Index for modules, the PM index for campaigns, the registry itself for skills and hooks).
3. Every other place that restates the enumeration is compared with the owner. A difference is a row.

Statements that are not enumerations ("read the book first" against "read one item") are caught a second way: a short, hand-kept list of **subjects** (what to read before work, where PM traces go, which client to use) with the file that owns each. A second file making a normative statement on an owned subject is flagged for a human to reconcile. That list is perhaps fifteen lines and changes rarely.

## Output

Illustrative format; the counts are not a measurement.

```text
pnpm os:check

ERROR  MIRROR      .agents/skills/cache-invalidation/SKILL.md   13 lines behind source
ERROR  PORTABLE    .codex/hooks.json:9                          absolute user path
ERROR  DUPLICATE   .codex/settings.json vs .codex/hooks.json    different hook sets
ERROR  NAME-BOUND  .claude/settings.json:8                      Supabase deny covers 1 of 2 namespaces
WARN   PARITY      HR-24, HR-25                                 claude only
WARN   CONTRADICTION  junction list                             start-task (9) vs CLAUDE.md (10)
…
4 errors, 14 warnings. Setup fingerprint sha256:…
```

Errors fail CI. Warnings appear in PM.2's Conflicts view with the two sources side by side and an "Open as item" action that writes an Inbox capture, so nothing is fixed silently.

## Fix once, then keep it fixed

The current rows are one small session of work ([R92](<../../PM Tooling/PM Tooling — Master Book.md#r92>)): generate the Codex and `.agents` copies from the Claude sources instead of keeping them by hand, delete the dead and duplicate files, make paths relative, set the executable bit, and correct the three stale enumerations. The first decision in that session is whether Codex reads `.codex/hooks.json` at all; nothing in the repository proves either Codex hook file has ever fired, so confirm it by observation before generating more of them.
