---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit e5f537a, 2026-11-10. Proposed direction; nothing here is implemented."
---

# Agentic OS — vision and hype filter

[Agentic OS index](<_index.md>) · next: [Current setup inventory](<02 - Current Setup Inventory.md>)

## What "Agentic OS" means in this repository

An operating system does four things for programs: it knows what is installed, it enforces rules they cannot bypass, it records what they did, and it gives the user one place to start them. Applied to AI agents working in this repository:

| OS job | Here it means | Today |
|---|---|---|
| Know what is installed | One generated registry of every rule, skill, hook, permission, mirror and check, per agent | Spread across `CLAUDE.md`, 18 skills, 7 hook scripts, 4 settings files, 3 mirrors. No view of the whole |
| Enforce | Each Hard Rule has a detector that passes or fails the same way for any model | 3 of 29 rules are blocked by a mechanism, 1 blocks once, 3 remind, 22 are text ([matrix](<04 - Rule Enforcement Matrix.md>)) |
| Record | Every session leaves a flight report: setup used, hooks fired, rules broken, checks, outcome | Delivery V2 records its own runs; ordinary Claude Code and Codex sessions leave nothing in the project |
| Start | Pick a skill, fill a form, launch | Skills are typed from memory; their inputs live in prose tables |

The promise for the owner: **open one screen and see what the setup can do, what it did in the last session, which rule failed, and which model does the work best per unit of cost, without trusting any model's account of itself.**

## Hype filter

| Claim seen in posts | Verdict for this repo | Why |
|---|---|---|
| "Swarms of agents that run your company" | Skip | One writer per item plus a host check already outperforms what was built for more. Parallelism here means separate worktrees, not agents talking to each other |
| "Agents that improve their own prompts" | Skip until evaluation exists | Without a deterministic scorecard a self-edit cannot be shown to be an improvement. With one, a human can make the same edit in a minute |
| "An AI manager supervising AI workers" | Tried, set aside by the owner for now | The Steward experiment took weeks of setup, runbooks and readiness reports around one small applied change (R44, 2026-10-24) ([Delivery diagnosis](<../10 - Project Management/Delivery/1 - Diagnosis.md>)) |
| "A dashboard of everything your agents are doing" | Keep, with one rule | Show outcomes and rule verdicts, never activity counts. Sessions run and tokens spent are costs, not achievements |
| "Skills as an app store" | Keep the small version | Parameterised, repeatable workflows with validated inputs are real leverage. A marketplace is not needed for one repository |
| "Gamified productivity" | Keep, tied to truth | A streak of rule-clean sessions or a debt bar reaching zero is motivating and honest. Points for volume reward the wrong thing |
| "Memory that makes the agent know your codebase" | Already here, too large | The vault is the memory. The problem is its reading cost ([context economy](<../01 - Architecture/Agent Context Economy.md>)), not its absence |

## The five real benefits to aim for

1. **Setup observability.** A map of rules, skills, hooks and checks per agent, with the gaps between Claude and Codex visible.
2. **Guardrails that do not depend on the model.** Move rules from text to detectors and, where cheap, to blocking hooks.
3. **Deterministic outcome evaluation.** The same scorecard for a high-tier session, a low-tier session and the owner's own commit.
4. **Parameterised launch.** A form per skill, validated before any tokens are spent, launching into an isolated worktree.
5. **Cost and quality per tier.** Evidence for the [model tier routing](<../Model Tiers/_Routing.md>), replacing judgment with measurement over time.

## Principles

1. **Files stay the source of truth.** The registry, the reports and the scores are generated from the repository and from session logs. Nothing in PM.2 is edited by hand that a file does not hold.
2. **Deterministic first.** A verdict comes from a script with a version and a fixture test. Model-written review is optional, labelled, and never part of a score.
3. **Judge the change, not the debt.** A rule already broken 184 times on `main` cannot fail every session. Verdicts are on what the session added or removed.
4. **Same yardstick for every author.** Claude, Codex and manual commits go through the same evaluation.
5. **Local, private, subscription only.** No cloud service, no production database, no API keys (Hard Rules 26 and 29). Transcripts never leave the machine.
6. **Text is a cost here too** (Hard Rule 28). PM.2 shows numbers, states and short labels.
7. **Every animation carries information.** If removing the motion loses nothing, remove it.
8. **PM.1 keeps the documents; PM.2 is the cockpit.** One of each. No third home screen ([product design](<09 - PM.2 Product Design.md>)).

## Non-goals

- Running agents unattended or from the phone. That is the confined Delivery path's question, not this plan's.
- Replacing Claude Code's or Codex's own interfaces. PM.2 launches and observes; the engineering happens in the native tools.
- A general product. It is built for this repository's rules and vocabulary.
