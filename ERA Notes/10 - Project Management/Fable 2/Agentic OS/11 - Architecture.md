---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit e5f537a, 2026-11-10. Proposed design. 'Reuse' rows name code that exists; nothing under scripts/os exists."
---

# Agentic OS — architecture

[Agentic OS index](<_index.md>) · [Visual, motion and game layer](<10 - Visual, Motion and Game Layer.md>) · next: [Roadmap](<12 - Roadmap.md>)

## Data flow

```text
 repo files ──────────────► scan ──► setup.json ──► check ──► conflicts
 (.claude .codex .agents            (registry,
  CLAUDE.md skills hooks             fingerprint)
  settings CI lint)                      │
                                         ▼
 agent session ─► hook runner ─► events.jsonl ─┐
 (Claude, Codex)  (passes through)             │
        │                                      ├─► ingest ─► os.db ─► API ─► PM.2
        └─► transcript (read-only) ────────────┤            (sessions,
                                               │             events,
 git base..head ─► detectors ─► verdicts ──────┤             verdicts,
 supervisor checks (typecheck, lint, tests) ───┘             checks, launches)

 Launchpad ─► form.json ─► rendered prompt ─► native session in a worktree
```

Everything left of `os.db` is a plain script that also works from the command line, so the cockpit is a view, never the only way in.

## Layout

```text
scripts/os/
  scan.mjs            build setup.json from the repository
  check.mjs           conflict queries; exit 1 on errors
  hook.mjs            runner that wraps existing hooks and logs events
  ingest/claude.mjs   transcript → session rows
  ingest/codex.mjs    Codex logs → session rows (after its format is confirmed)
  ingest/delivery.mjs Delivery V2 store → session rows
  eval.mjs            run detectors and checks for a session or a commit range
  report.mjs          session → Markdown flight report
  forms.mjs           validate form.json, render prompts
  detectors/          one file per rule
  store.mjs           SQLite schema and access
scripts/pm2/          the PM.2 app (React, same build as scripts/pm/app)
tests/os/             fixtures and tests
.os/                  runtime: os.db, events/, cache (gitignored)
```

## Commands

| Command | Does | Runs where |
|---|---|---|
| `pnpm os:scan` | Writes the registry, prints the fingerprint | Anywhere, under a second |
| `pnpm os:check` | Conflicts and drift | Locally and in CI |
| `pnpm os:eval <session or base..head>` | Rule verdicts, checks, scorecard | After any session; in CI on pull requests for the Rules panel |
| `pnpm os:report <session>` | Markdown flight report | On demand |
| `pnpm os:arena <case> --tier <alias>` | One gym run | Owner only |

## Reuse

| Need | Already in the repository |
|---|---|
| Markdown and frontmatter parsing, link slugs | `scripts/pm/shared/` |
| File walking that skips archives and dot folders | `scripts/pm/scan.mjs` |
| A local SQLite store with Node's built-in driver | `scripts/delivery-v2/store.mjs` |
| App build, live reload, local server, transport to the UI | `scripts/pm/app-build.mjs`, `scripts/pm-server.mjs`, `scripts/pm/app/transport` |
| React, TanStack Query, framer-motion, lucide icons | Dependencies already installed |
| Native session adapters for Claude and Codex | `scripts/delivery-v2/adapters/` |
| A protected-oracle pattern | `tests/delivery-oracles/` |
| A table-driven contract test pattern | `src/features/era/artifacts.contract.test.ts` |
| Paid-host blocking in tests | `tests/setup/blockPaidApis.ts` |

Not reused: the confined path's policy, authorization, qualification and container modules. The OS observes and evaluates; it does not gate launches.

## Contracts

Versioned and small, so reports written today still read in a year:

| Schema | Holds |
|---|---|
| `os/setup@1` | Entities, relations, gaps, fingerprint |
| `os/event@1` | One hook or lifecycle event |
| `os/session@1` | Identity, setup fingerprint, intent, timeline summary, cost, outcome |
| `os/verdict@1` | Rule, detector and version, verdict, file, line, excerpt |
| `os/form@1` | A skill form |
| `os/case@1` | An Arena case: start commit, brief, oracle reference |

A reader that meets an unknown version refuses it, as the Delivery policy loader already does, instead of guessing.

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Where state lives | Files for truth, `.os/os.db` for derived history | Deleting `.os/` must lose nothing that matters |
| One app or two | Two apps, one server | The owner asked for PM.1 to stay a document place; a shared server keeps one command and one port |
| Graph drawing | Fixed six-column layout in SVG | Deterministic, readable, no layout library, and columns are the information |
| Hook integration | A runner around existing scripts | Hooks keep working unchanged if the runner is removed |
| Detector language | Plain Node modules over diff text, a parser only where a regular expression would lie (rule 1) | Fast, testable, no build step |
| Model review | Out of the pipeline | Determinism; subscription-only rule |
| In the product bundle | Nothing | `src/features/pm-live` already ships tooling inside the product; PM.2 must not add to that |
| Network | None | Local only; the phone relay carries at most a summary line later |

## Testing

| Part | Test |
|---|---|
| Scanner | Its output at `e5f537a` matches the hand-made [inventory](<02 - Current Setup Inventory.md>) |
| Conflict checks | One fixture repository per class, each producing exactly its row |
| Hook runner | Equivalence: with and without the runner, a hook sees the same stdin and returns the same stdout and exit code |
| Detectors | Three fixtures each: fail, pass, not applicable |
| Ingest | A recorded transcript sample produces the expected session rows |
| Forms | Rendered prompt snapshots; validation refusals |
| UI | The existing `tests/pm-ui` pattern |

## Cost to the repository

This plan adds tooling to a repository whose tooling already outweighs its product tests ([verification pyramid](<../01 - Architecture/Verification Pyramid.md>)). Two limits keep it honest:

1. The first three roadmap steps are scripts only, a few hundred lines each, and deliver the answer to "which rule failed" without any UI.
2. PM.2 is built in place of the Home, Delivery and Analytics screens it absorbs, and its arrival is the trigger to delete the two older UI generations (R6), so the interface code shrinks overall.
