---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - module/schedule
---

# Schedule · FABLED 2.3 — Optimization Plan

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · **3 · Optimization** · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>) · v1 baseline: [FABLED/3](<../FABLED/3 - FABLED — Optimization Plan.md>)
>
> The engine work is the campaign; this file is its staging plan plus the hygiene that keeps stalling.

---

## O1 — Un-red the suite (new; do first, ~30 min)

Replace the source-regex placement guard (`expandOccurrences.test.ts:95` asserting `/recurrence_rule\??\.is_flexible/` in view source) with a **behavioral** guard: feed a flexible item + rrule item through the *actual* expansion path each view uses and assert the flexible item lands on schedule rows, not activation day. Behavioral tests survive refactors that move the check into helpers — exactly what broke the current one. Until this lands, every `pnpm test` run trains you to accept red.

## O2 — Delete `MobileItemForm.tsx` and salt the earth (carried v1-O2, third listing)

`grep -r "MobileItemForm" src/` → expect only the file itself → delete → remove from Feature Map if listed. Book it as the first 15 minutes of the next session, not "when convenient" — two cycles of "when convenient" have already failed.

## O3 — Stage 2: one engine, migrated surface-by-surface (the campaign's core)

Target: every view consumes `src/lib/schedule/expandOccurrences.ts`; `dayOccurrences.ts` becomes a thin adapter or is absorbed; `WebCalendar`'s inline engine is deleted last (it currently handles the most dialects, so it's the reference while migrating).

1. **First unify the "move" dialect** — decide: exceptions (`rescheduled_to`) are canonical (matches the tested engine + Google model); write a small translator for existing `postponed_to` action rows (read-time translation, no data migration needed).
2. **Migrate `WebTodayView`** (smallest surface) → diff-test its rendered occurrence set against the old path on a fixture week (golden-file style) → ship.
3. **Migrate the `/reminders` planner** (via `dayOccurrences` adapter) — this is where users live now; the diff test matters most here.
4. **Migrate/absorb `WebCalendar`** — port any dialect the canonical engine lacks *into* the engine (with tests) before deleting the inline code.

Rule: each step lands alone, each keeps a fixture-diff test. No big-bang.

## O4 — Stage 3: one occurrence-action sheet (carried, sequenced after O3)

`ItemActionsSheet` and the `WebEvents` inline modal still disagree on labels/actions. After O3, converge on `ItemActionsSheet` as the single component (it already has skip/complete/reassign wired). One rendering component = the Google-model verbs stay consistent everywhere.

## O5 — Route-level action tests (the surviving half of v1-O1)

Now that inserts are idempotent upserts, pin them: complete → replay complete (no dup, no 500) · skip → exception row + alert suppression · postpone → single representation (post-O3.1) · pause overlap (Trips writes `recurrence_pauses`) masks correctly. ~15 table-driven cases against a test DB or extracted pure functions.

## O6 — Type-retirement tripwire (carried v1-O7, still unbuilt)

One zod refinement or unit test: no write path may produce `type: "task"`. Two new write surfaces shipped since this was first listed; the tripwire is cheaper than the third.

## O7 — RLS generation cleanup + bundle blind-spot fix (carried v1-O4/O5, merged)

One migration, alongside the next deliberate auth change: drop stale policy generations + patch `get_schedule_bundle` for partner-private `responsible=me` rows. Run `migrations/_verify_schedule_rls.md` before/after. The body now lives in `schema.sql`, so this is finally a normal diff-reviewed change.

## O8 — `useItems.ts` subtraction (carried v1-O3)

Unchanged rule: no refactor-for-its-own-sake; move pure helpers to `src/lib/schedule/` whenever the file is open anyway.

---

### Sequencing

```
O1 (un-red, 30 min) → O2 (delete, 15 min) → O3.1 (move dialect) → O3.2–3.4 (surface migrations)
  → O4 (one action sheet) → O5 (action tests as each surface migrates)
O6 cheap tripwire anytime · O7 with next auth work · O8 opportunistic
```

Kill criterion for O3: if a surface migration's fixture-diff shows the canonical engine *missing* a dialect, stop migrating and port the dialect into the engine first — never fork the engine to match a view.
