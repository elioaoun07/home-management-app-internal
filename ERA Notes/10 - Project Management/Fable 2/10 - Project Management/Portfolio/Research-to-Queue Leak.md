---
created: 2026-11-10
updated: 2026-11-10
type: study
status: active
owner: Elio
evidence_cutoff: "commit 8da80ae, 2026-11-10. `grep` of every active checklist and Master Book; `git log` on the research files."
---

# Portfolio — research does not reach the queue

[Fable 2 index](<../../_index.md>) · [Backlog Health](<Backlog Health.md>)

## Finding

Two recent pieces of analysis produced concrete work and neither is visible in the Command Center.

### 1. The 2026-11-04 Major Bug Sweep: 15 reserved IDs, none filed

[Research/Major Bug Sweep](<../../../Research/Major Bug Sweep.md>) found 16 defects, four of them 🔴, and assigned 15 new IDs: BUD-89 to BUD-94, HUB-118 to HUB-122, NOTIF-22, NOTIF-23, R83, KIT-28. Its disposition table calls each one "(new)".

On 2026-11-10 none of the 15 appeared in any `4 - Checklist.md`, and none had a `### <ID>` section in any Master Book. Commit `53443c0` added only the research file. The four critical ones had therefore been outside every queue for six days:

| ID | Sweep label | Defect |
|---|---|---|
| HUB-118 | S1 | Guest Portal returns every guest's allergies and drinks to anyone holding the tag id, unauthenticated. Spot-checked in this pass: `src/app/api/guest-portal/allergies/route.ts:14-18` reads `all` and uses `supabaseAdmin()` with no `getUser()` |
| BUD-89 | M1 | Undo after deleting a transaction posts a copy; restoring the original later counts it twice |
| BUD-90 | M2 | Recurring confirm, future-payment confirm, split-bill completion and debt settlement can post twice |
| HUB-119 | O1 | The offline queue drops writes older than 24 hours without notice |

**Disposition: filed on 2026-11-10.** All 15 now have a checklist line and a criteria section that links back to the sweep's evidence, fix and UAT. They sit in Next (🔴 and 🟠) and Later (🟡) because this filing was commissioned as "never Now"; the four above deserve promotion to Now by the owner. Only S1 was re-verified against source here; the other 14 carry the sweep's evidence as written.

### 2. `docs/era-research/`: 70 files, no link from the vault

Fourteen research packs (atlas, journeys, memory, proactive assistance, action lifecycle, AI quality, shared data, interaction design, blueprints, product research, roadmap, handoff, business rules, synthesis) were committed between 2026-11-04 and 2026-11-07. `grep -r "era-research" "ERA Notes"` returns nothing. The synthesis pack names one "best-supported next implementation" (roadmap Q1, single owner for draft-confirmation feedback) and a decision register; neither is mapped to a campaign ID.

`_Conventions.md` §8 requires one disposition per meaningful finding. That step has not happened.

**Disposition: [R85](<../../../PM Tooling/PM Tooling — Master Book.md#r85>)** — disposition the era-research packs into existing IDs, new IDs, held decisions or `Research/Options.md`, starting from `docs/era-research/20-synthesis/`.

## Why it keeps happening

- A study is written in one session and committed as a file. Filing its findings is a second, optional step, and the Stop hook only checks that PM files changed, not that reserved IDs exist.
- `pnpm pm:check-docs` verifies that every checklist ID has criteria. Nothing verifies the reverse: that an ID a research document calls "(new)" exists anywhere.
- Research lives in two trees (`ERA Notes/10 - Project Management/Research/` and `docs/`), and only the first is scanned.

## Structural fix

One rule and one check, both small:

1. A study is not finished until its disposition table links each new ID to a section that exists.
2. `pm:check-docs` fails when a document under `Research/`, `Plans/` or `Fable 2/` links to a `#<id>` anchor that does not resolve. It already validates link anchors; the sweep escaped because it named IDs in bold instead of linking them.

This filing follows rule 1: every ID in the [index](<../../_index.md>) is a working link.
