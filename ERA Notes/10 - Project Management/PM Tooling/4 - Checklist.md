---
created: 2026-09-10
updated: 2026-11-11
type: checklist
status: active
owner: Elio
---

# PM Tooling — Checklist

[Master Book](<PM Tooling — Master Book.md>) · [All campaigns](<../_index.md>) · [Grammar](<../_Conventions.md>)

**Now** is this week's sprint. **Next** is the ordered queue. **Later** is parked or conditional. Each ID links to its acceptance. Finish one with `pnpm pm:ship <ID>`.

## Now

## Next

**Needs you**

- [ ] **R43** Verify hot-child RLS and read contracts — [criteria](<PM Tooling — Master Book.md#r43>) _(blocker - M)_

**Rule guards**

- [ ] **R47** Enforce the client-only console rule — [criteria](<PM Tooling — Master Book.md#r47>) _(annoyance - S)_
- [ ] **R46** Warn on API mutation routes without Zod validation — [criteria](<PM Tooling — Master Book.md#r46>) _(friction - M)_
- [ ] **R45** Resolve the mutation-toast Undo rule — [criteria](<PM Tooling — Master Book.md#r45>) _(friction - S)_
- [ ] **R48** Replace raw client mutation fetch calls — [criteria](<PM Tooling — Master Book.md#r48>) _(friction - L)_

**Command Center**

- [ ] **R87** Close elapsed sprint weeks and roll their work forward — [criteria](<PM Tooling — Master Book.md#r87>) _(friction - S)_
- [ ] **R55** Page and filter Delivery history across Work and Home — [criteria](<PM Tooling — Master Book.md#r55>) _(friction - M)_
- [ ] **R34** Surface the oldest small hygiene item in session briefs — [criteria](<PM Tooling — Master Book.md#r34>) _(friction - S)_

**Docs and knowledge**

- [ ] **R88** Make cited evidence verifiable and run the docs check in CI — [criteria](<PM Tooling — Master Book.md#r88>) _(friction - S)_
- [ ] **R85** Disposition the ERA research packs into the backlog — [criteria](<PM Tooling — Master Book.md#r85>) _(friction - M)_

## Later

**Agentic OS (PM.2)**

- [ ] **R98** Launch skills from forms with validated inputs — HELD — primary workflow rejected under R108 — [criteria](<PM Tooling — Master Book.md#r98>) _(parked - M)_
- [ ] **R99** Compare tiers on identical work and add the game layer — [criteria](<PM Tooling — Master Book.md#r99>) _(parked - L)_

**Command Center polish**

- [ ] **R79** Carry UAT to the phone relay and show Done apart from Shipped in Work, Sprints and Analytics — [criteria](<PM Tooling — Master Book.md#r79>) _(friction - L)_
- [ ] **R53** Make phone Inbox capture visible and identifiable — [criteria](<PM Tooling — Master Book.md#r53>) _(friction - M)_
- [ ] **R62** Compare Delivery outcomes using observed run data — [criteria](<PM Tooling — Master Book.md#r62>) _(annoyance - M)_
- [ ] **R38** Surface retained session histories in the freshness radar — [criteria](<PM Tooling — Master Book.md#r38>) _(annoyance - S)_
- [ ] **R37** Verify local shell and static data provenance — [criteria](<PM Tooling — Master Book.md#r37>) _(annoyance - M)_
- [ ] **R36** Type the shared PM parsing core — [criteria](<PM Tooling — Master Book.md#r36>) _(friction - M)_

**Security follow-ons**

- [ ] **R90** Cover every service-role route with an authorization contract — [criteria](<PM Tooling — Master Book.md#r90>) _(friction - M)_
- [ ] **R83** Keep one session proxy file or none — [criteria](<PM Tooling — Master Book.md#r83>) _(annoyance - S)_

**Performance and tooling**

- [ ] **R91** Make `pnpm typecheck` run in a 15 GB container — [criteria](<PM Tooling — Master Book.md#r91>) _(annoyance - S)_
- [ ] **R8** Measure index responsiveness on the largest note and on the complete static twin — [criteria](<PM Tooling — Master Book.md#r8>) _(annoyance - S)_
- [ ] **R9** Subset fonts (only if offline load proves slow) — [criteria](<PM Tooling — Master Book.md#r9>) _(parked - S)_
