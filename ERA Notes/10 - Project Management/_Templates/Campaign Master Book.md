---
created: 2026-07-30
updated: 2026-07-30
type: template
status: template
owner: Elio
tags:
  - pm/template
---

# <Campaign> — Master Book

> **Template.** Copy to `<Campaign>/<Campaign> — Master Book.md`, set frontmatter `type: master-book`, `status: active`, `updated:`. This plus `4 - Checklist.md` are the **only** two files a campaign folder holds.
>
> Three sections below are **parser-load-bearing** — keep their formats exactly ([_Conventions §3](<../_Conventions.md>)): the Shipped Log's `- ✅ YYYY-MM-DD — **ID** text` lines feed the burndown, the Pain Inventory's emoji-lead bullets feed the Bugs view, and the Acceptance Criteria Index's `### <ID>` blocks feed the delivery flight check.

> **Campaign:** <Campaign> · prefix `XXX` · working queue → [4 · Checklist](<4 - Checklist.md>)

## Identity & North Star

What this module is, in a paragraph a stranger could act on. Then the vision in one line: *turn X from … into …*

**Source:** the feature dirs, routes, pages and libs that make it up. Point at the vault doc for the authoritative code map — do not duplicate file tables here, they drift.

## Current State (verified)

**Maturity N / 10 as of YYYY-MM-DD (evidence cutoff `<commit>`).**

| Dimension | Score | Evidence |
|---|---|---|
| … | … | a command or file that proves it |

| Sub-feature | Tier | Reality | Next step |
|---|---|---|---|
| **<name>** | 🟢 Core · 🔵 Established · 🟡 New/Thin · 🟠 Stub/Partial · ⚫ Unbuilt | what's actually true | the single most useful next step |

## Pain Inventory

Emoji-lead bullets, severity first, most painful first. `🔴` blocker · `🟠` friction · `🟡` annoyance · `⚪` parked.

- 🔴 **The headline pain.** Why it hurts, the root cause, and the evidence that it's real.

## Shipped Log

One line per shipped item, chronological, ID chip included so the burndown can attribute it. Swept here from the checklist — never a `## Done` lane.

- ✅ YYYY-MM-DD — **XXX-1** what landed (evidence path)

## Delivery session log

*(Delivery runner appends dated progress bullets here automatically. Leave the heading even if empty.)*

## Vision & Decisions

Where this is heading, and — more importantly — **what has already been decided so it isn't re-litigated**. Mark a realized decision `*(IMPLEMENTED YYYY-MM-DD)*`.

### Locked decisions

1. **The decision, stated as a rule.** The reasoning, briefly, so a successor can tell whether the reasoning still holds.

### The bets, in order

1. …

### Not now / will not do

- ❌ … — with the reason, so it doesn't get re-proposed.

## Acceptance Criteria Index

Only for **open** items. The delivery flight check greps these.

### XXX-1
- **Acceptance:** the observable condition that makes this item done.

## Successor Briefing

**Who should read this:** the one-paragraph warning for a model about to touch this code — name the historical failure mode.

**First 10 minutes:**

```bash
git log --format="%h %ad %s" --date=short --since=YYYY-MM-DD -- <paths>
<the test command that proves the state above>
```

**Task-tier map:**

| Task archetype | Tier | Route |
|---|---|---|
| … | any-model · mid-tier+ · human-first | the skill to open, the rule to obey |

**Out-of-depth tells — stop if:** …

**Trap registry:**

| Trap | Symptom | Guard |
|---|---|---|
| … | what it looks like when you hit it | what prevents it |

**Verification manifest:**

| Claim | Command | Expected |
|---|---|---|
| … | … | … |

## Pointers

- Working queue: [4 · Checklist](<4 - Checklist.md>) · conventions: [_Conventions](<../_Conventions.md>)
- Vault docs, related campaigns, skills
- Pre-consolidation originals, if any: `../_Archive/<Campaign>/`
