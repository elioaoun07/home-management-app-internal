---
name: skill-factory
description: "Meta-skill: author a NEW skill for this repo in the house style — decide whether a skill is warranted at all, ground it in verified code, write it to the template, register it in CLAUDE.md + start-task routing, and QA it against the 'junior test'. Use when a new module/domain ships (Healthcare, Diet, Workout, …) or the user asks to 'create a skill for X'."
---

# /skill-factory — How Skills Are Born Here

> **Contract:** skills in this repo are **execution modes and risk domains, not per-module encyclopedias**. Module knowledge lives in the vault (`ERA Notes/02|03 - …`) and the Feature Map — that layer is scaffolded by `new-module` and must stay the single source of module truth. You create a skill only when the decision gate below says yes, and every factual claim inside it must come from files you read in the authoring session. A skill with an invented path or stale constant is worse than no skill — juniors will follow it off a cliff.

## Step 1 — The decision gate (most requests end here)

```
Does the area have INVARIANTS whose violation is silent AND costly?
(money drifts, duplicate occurrences, privacy/PHI leaks, wrong dosage/nutrition
math, destructive data ops)
├─ YES → DOMAIN skill (like money-rules, recurrence-safety). Continue.
└─ NO
   ├─ Is it a REPEATED WORKFLOW needing ordered steps + verification gates?
   │  (like api-route, db-migration, data-repair)
   │  ├─ YES → PROCESS skill. Continue.
   │  └─ NO → Not a skill. Put the knowledge in the module's vault doc
   │          (augment, never create a parallel one) and stop.
   └─ Does an EXISTING skill already own this territory?
      → EXTEND that skill instead of creating a sibling. Two skills sharing
        a territory WILL drift apart and split the truth.
```

Sizing rules: one skill per **risk domain**, not per module (money-rules covers ~8 money modules). Total skill count matters — every description competes for the router's attention, so a marginal skill taxes all the others.

**Future-module examples of the gate applied** *(illustrative, not yet built)*:
- **Healthcare** → YES, domain skill: PHI privacy boundaries, medication/dosage math, household visibility of health data is NOT symmetric by default.
- **Diet/Workout** → probably one shared skill IF nutrition/progression math has silent-failure modes; otherwise vault docs.
- **Catalogue-like browse/CRUD modules** → NO skill; vault doc + existing playbooks cover them.

## Step 2 — Ground it (no writing yet)

1. Read the module's Feature Map file + vault doc + PM campaign files (`ERA Notes/10 - Project Management/<Campaign>/1`, `2`) — known pain and planned direction MUST shape the skill.
2. Read the actual source the skill will govern: the choke-point functions, canonical routes/hooks, DB tables in `migrations/schema.sql`.
3. Collect **verified** artifacts to quote: real snippets with `path` references, exact table/column names, exact commands. Where docs and code disagree, the code wins — and the skill should point to the source (e.g. "see `DEFAULT_TIMEOUT_MS` in safeFetch.ts") rather than hardcode drift-prone values.
4. Harvest failure history: past bugs from PM pain clusters + session notes become the skill's known-cause table. This is the highest-value content a skill can carry.

## Step 3 — Write it in the house style

Location: `.claude/skills/<kebab-name>/SKILL.md`. Target < 150 lines. Structure (match the existing suite):

```markdown
---
name: <kebab-case, verb-or-domain, no collision with existing skills>
description: "<what it enforces> + WHEN to invoke (concrete triggers) + when NOT to. <500 chars — this line alone decides whether a weak model loads the skill."
---

# /<name> — <Title>

> **Contract:** <the non-negotiable behavior + what the agent must produce/prove.
> One short paragraph. This is the tone-setter — obligations, not suggestions.>

## <The verified model>        ← how the domain actually works, cited from code/docs
## Invariants / Steps          ← numbered, imperative; tables for decisions
## Known failure modes         ← symptom → cause → where to confirm (from PM history)
## Mandatory scenarios/gates   ← exact commands, expected outputs, worked examples
## Checklist before leaving    ← 4–8 boxes, each independently checkable
```

Style rules (all existing skills follow these — stay consistent):
- Imperative voice; "never X because Y" with the one-line reason; no hedging.
- Decision trees for judgment calls a junior can't make unaided.
- STOP conditions: name the cases where the agent must ask the user instead of proceeding.
- Cross-route, don't duplicate: money impact → `money-rules`; dates → `timezone-handling`; caches → `cache-invalidation`; done → `finish-task`.
- Worked-example proof obligations for domains where correctness is silent (copy the pattern from `money-rules`).

## Step 4 — Register it (a skill nobody routes to doesn't exist)

1. **CLAUDE.md** → add a row to the "Engineer Playbooks (Skills)" table (keeps Codex/Copilot mirrors aware after sync).
2. **`.claude/skills/start-task/SKILL.md`** → add a routing row (and to the domain-risk gate if it's a domain skill).
3. **`.claude/skills/fix-bug/SKILL.md`** → add known-cause rows if the domain has recognizable bug signatures.
4. Run `pnpm sync:ai` and confirm the new section appears in `AGENTS.md` / `CODEX.md` / `.github/copilot-instructions.md`.

## Step 5 — QA: the junior test

Play a cold-start junior with zero repo memory following only the skill:
- [ ] Every referenced path exists (`Glob` each one — no exceptions)
- [ ] Every command runs as written (`pnpm …`, scripts)
- [ ] Every code snippet was verified against source this session (no memory-written code)
- [ ] The description alone tells a router when to load it — and when not to
- [ ] No territory overlap with an existing skill (grep the suite for the same topics)
- [ ] < ~150 lines; nothing in it duplicates a vault doc (pointer instead)

Finish with the standard close-out (`finish-task`): skills are tooling — if no `src/`/`migrations/` files changed, state "pure tooling, no PM-trackable story" explicitly.
