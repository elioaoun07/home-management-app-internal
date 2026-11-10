---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit e5f537a, 2026-11-10. Proposed design; no scanner exists."
---

# Agentic OS — the setup registry

[Agentic OS index](<_index.md>) · [Inventory](<02 - Current Setup Inventory.md>) · next: [Rule enforcement matrix](<04 - Rule Enforcement Matrix.md>) · item: [R93](<../../PM Tooling/PM Tooling — Master Book.md#r93>)

Everything else in this plan reads one generated file. If the registry is right, the map, the rulebook, the conflict list and the session reports are queries over it.

## What it is

`pnpm os:scan` walks the repository and writes `setup.json`: a list of entities and the relations between them. It is generated, never edited, and cheap enough to rebuild on every file change. A content hash of the whole file is the **setup fingerprint**; every session report records the fingerprint it ran under, so two sessions can be compared knowing whether the rules were the same.

## Entities

| Kind | Identity | Parsed from | Key fields |
|---|---|---|---|
| `rule` | `HR-1` … `HR-29`, module rules as `MR-<module>-n` | The numbered list under "Hard Rules" in `CLAUDE.md`; module Overview docs | text, source line, scope, detectors, enforcement level |
| `skill` | folder name | `SKILL.md` frontmatter and headings, optional `form.json` | description, triggers, inputs, playbooks it routes to, line count |
| `hook` | event + matcher + script | each agent's settings file plus the script | event, matcher, script path, blocking or advisory (does it ever exit 2), rule it serves |
| `permission` | pattern | settings files | allow or deny, tool namespace, rule it serves |
| `instruction` | path | root and mirror files, scoped instruction files | generated-from, header, byte equality with its source |
| `check` | script name | `package.json`, CI workflow, husky | where it runs (hook, pre-commit, CI, manual), rule it serves |
| `detector` | rule id + name | `scripts/os/detectors/` | type, version, fixtures present |
| `agent` | `claude`, `codex`, `copilot` | presence of their config | which entities apply to it |
| `tier` | alias | Model Registry table | provider, selector, efforts, disabled |
| `playbook-route` | task type → skill | the routing table in `start-task` | used to judge whether a session loaded what its task required |

## Relations

`enforces` (hook, permission, check or detector → rule) · `mirrors` (instruction or skill copy → source) · `routes-to` (start-task row → skill) · `applies-to` (entity → agent) · `requires` (path pattern → skill, from the domain-risk gate) · `supersedes` (for retired entities).

Relations are declared where they already are in the files. A hook script's header comment names its rule ("Enforces Hard Rule #24"); the scanner reads that. Where nothing declares the link, the registry records `enforces: unknown`, and that absence is itself shown.

## Shape

```json
{
  "fingerprint": "sha256:…",
  "generatedAt": "2026-11-10T09:00:00Z",
  "commit": "e5f537a",
  "entities": [
    { "id": "HR-24", "kind": "rule", "title": "DB changes require a migration file",
      "source": "CLAUDE.md:74", "level": "reminded",
      "detectors": [], "enforcedBy": ["hook:claude:PostToolUse:check-migration"] },
    { "id": "hook:claude:PostToolUse:check-migration", "kind": "hook", "agent": "claude",
      "event": "PostToolUse", "matcher": "Edit|Write", "script": ".claude/hooks/check-migration.sh",
      "blocking": false, "enforces": ["HR-24"] },
    { "id": "skill:new-module", "kind": "skill", "agents": ["claude"], "lines": 89,
      "form": null, "declaredInputs": 6 }
  ],
  "gaps": [
    { "code": "PARITY", "entity": "hook:claude:PostToolUse:check-migration", "missingFor": ["codex"] }
  ]
}
```

Line numbers and levels above are illustrative of the format; the scanner fills the real ones.

## Global and per-session views

| View | Built from | Answers |
|---|---|---|
| **Global setup** | `setup.json` at the current commit plus user-level settings read locally | What can my setup do? What is enforced, for which agent? |
| **Effective setup of one session** | The fingerprint recorded at session start, the agent, its launch options, and the skills and hooks observed firing | What did this session actually run with? |
| **Diff of two setups** | Two fingerprints | What changed in the rules between the session that passed and the one that failed? |

The third view is the one nothing offers today, and it is what makes an evaluation fair: a model that scored worse after a rule was added did not get worse.

## Rules for the scanner

1. Zero dependencies and no network, like `scripts/pm/scan.mjs`.
2. It parses what exists. It never needs a file to be reformatted first; where a file is ambiguous it records `unknown`.
3. Rule identities are stable. `HR-6` keeps its number when text changes; a deleted rule keeps a tombstone so old reports still resolve.
4. It runs in CI as `pnpm os:check`, failing on error-level gaps only ([conflict detector](<05 - Conflict and Drift Detector.md>)).
5. Its output for this repository at commit `e5f537a` should reproduce the hand-made [inventory](<02 - Current Setup Inventory.md>). That inventory is the scanner's first acceptance test.

## One small convention to add

Each hook script and each check gets a first-line comment `# enforces: HR-24` (several hooks already say this in prose). Each skill may add a `form.json` ([launchpad](<08 - Skill Launchpad.md>)). Nothing else in the repository needs to change for the registry to exist.
