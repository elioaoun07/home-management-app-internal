---
created: 2026-07-02
type: deep-dive
status: living
owner: Elio
tags:
  - pm/fabled2
  - scope/backlog
---

# Backlog & Ideas · FABLED 2.3 — Optimization Plan

> **FABLED 2:** [_index](<_index.md>) · [1 · Implementation](<1 - FABLED 2 — Current Implementation.md>) · [2 · Gaps](<2 - FABLED 2 — Gaps & Missing.md>) · **3 · Optimization** · [4 · Enhancements](<4 - FABLED 2 — Future Enhancements.md>)

---

## O1 — The one-time triage pass (fixes G1/G2/G4; one focused evening)

Walk every entry in the 11 content files; tag each inline: `✅ promoted → [target]` (FAR item, FABLED 2 file 4, campaign checklist) · `🅿 parked (revisit-when …)` · `❌ rejected (why, date)` · `♻ superseded by [FABLED 2 entry]`. Mark `Dashboard V2 Instructions` shipped-partial with its delta. Move `Schema Reminder.sql` out. The pass is also the reconciliation the FAR promised and never got.

## O2 — The lifecycle header for everything new (fixes G1 going forward)

Three lines atop every new idea: `status: raw` · `module: <target or cross>` · `captured: <date>`. Raw is a legitimate permanent state — the header's job is only to make *processed* distinguishable from *never-looked-at*.

## O3 — Declare the funnel (fixes the pipeline)

One rule in this directory's future index: **ideas graduate only into a campaign FABLED 2 file 4 (or a campaign checklist)** — never directly into a weekly plan. That keeps every idea's grown-up form in the place with seams, efforts, and kill criteria, and makes this directory the *upstream* of exactly one pipe.

## O4 — Merge the four capture files into two (fixes G3)

`Ideas.md` (module-scoped quick capture) + the vision-volume series (cross-module dreaming). Redirect stubs left in the retired files so old links don't dangle ([PM FABLED 2.3 · O3](<../../10 - Project Management/FABLED 2/3 - FABLED 2 — Optimization Plan.md>)'s checker will verify).
