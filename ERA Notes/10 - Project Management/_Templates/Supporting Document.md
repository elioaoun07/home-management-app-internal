---
created: 2026-09-10
updated: 2026-09-10
type: template
status: template
owner: Elio
---

# Supporting Document template

Use only when a substantial specification or research question cannot fit its owning Master Book. Place in `Plans/` for accepted specifications or fold research into `Research/Options.md` unless it needs its own artifact. [Conventions](<../_Conventions.md#8-studies-plans-and-archive-lifecycle>).

```md
---
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: plan
status: active
owner: Elio
evidence_cutoff: <date/commit and verification limits>
---

# <Subject>

## Contract and ownership

<Accepted spec or unadopted research? Owning campaign/IDs, intended outcome, scope/non-goals. The checklists own execution status.>

## Evidence and constraints

<Source references, established decisions and unresolved questions. No promotion of assumptions into facts.>

## Design or findings

<Only the distinctive information needed for this subject. Avoid copies of book state or source inventories.>

## Disposition and dependencies

| Source label | Canonical owner/ID or decision | Acceptance/boundary |
|---|---|---|
| <local packet/finding> | <linked campaign ID, decision, or unadopted> | <what would justify adoption/completion> |

## Retirement

<Merge into the book when…; archive evidence when…; retain original labels and incoming links.>
```

Use `type: research` for research. No task checkboxes, independent Now/Next/Later lanes or invented approvals. A newly accepted outcome must be filed in a campaign checklist before execution.
