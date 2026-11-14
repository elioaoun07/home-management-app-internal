---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/patterns
---

# Patterns & Lessons · FABLED 2.4 — Future Enhancements

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · [3 · Optimization](<3 - FABLED 2 — Optimization Plan.md>) · **4 · Enhancements**

---

## E1 — The pattern→skill pipeline, mechanized

When a written pattern hits its escalation rung ([file 3 · O3](<3 - FABLED 2 — Optimization Plan.md>)), the skill scaffold should be one command: `node scripts/new-skill.mjs <pattern>` generating the `.claude/skills/<name>/SKILL.md` shell with trigger patterns pre-filled from the pattern doc's "where it applies" section. The three existing skills prove the format; the scaffolder makes rung-climbing frictionless.
**Kill criterion:** if fewer than 2 patterns escalate per quarter, the scaffolder is premature — hand-write them.

## E2 — Patterns as lint (executable lessons)

Some patterns are checkable: P3 (plain `.insert()` in an offline-replayed route), P6 (`.maybeSingle()` on `household_links`), P4 (STABLE_KEYS shape change without buster bump — harder). Each becomes a ~20-line fitness function ([Architecture FABLED 2.4 · E6](<../../01 - Architecture/FABLED 2/4 - FABLED 2 — Future Enhancements.md>)). A lesson that greps for its own recurrence never has to be re-learned.

## E3 — The anti-patterns gallery

The inverse shelf: things this project tried and *retired*, with why (the old localStorage queue → IndexedDB; `next_occurrence` postpone → Google model; Web Speech/VAD → Azure; textual guard tests → behavioral). Future sessions — human or agent — keep proposing retired ideas; the gallery is the cheap immunization. Half its content already exists as struck-through campaign notes; collecting it is an hour.

## E4 — Cross-project pattern export

The patterns here (canonical-definition recipe, AI answer contract, idempotent replay) are portable beyond this app — the Songbook project and any future app can import them. A quarterly copy of the mature shelf into `~/.claude/` global knowledge (or a personal patterns repo) compounds the value of every lesson across projects.
**Kill criterion:** only worth it when a second active project actually consumes one — don't build the export before the importer exists.

---

## Recommended order

```
O1's six patterns first (the shelf must exist before pipelines matter)
  → E3 (one hour, immediate immunization) → E2 (one lint per idle hour) → E1/E4 on demand
```
