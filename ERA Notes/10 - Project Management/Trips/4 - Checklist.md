---
created: 2026-09-10
updated: 2026-11-11
type: checklist
status: active
owner: Elio
---

# Trips — Checklist

[Master Book](<Trips — Master Book.md>) · [All campaigns](<../_index.md>) · [Grammar](<../_Conventions.md>)

**Now** is this week's sprint. **Next** is the ordered queue. **Later** is parked or conditional. Each ID links to its acceptance. Finish one with `pnpm pm:ship <ID>`.

## Now

## Next

**Needs you**

- [ ] **TRIP-18** Verify packing schema application and checkpoint contract — [criteria](<Trips — Master Book.md#trip-18>) _(blocker - S)_
- [ ] **TRIP-1** Verify the household trip lifecycle — [criteria](<Trips — Master Book.md#trip-1>) _(blocker - M)_
- [ ] **TRIP-2** Verify the solo trip lifecycle — [criteria](<Trips — Master Book.md#trip-2>) _(blocker - M)_

**Lifecycle safety**

- [ ] **TRIP-3** Keep recurring payments active during trips — [criteria](<Trips — Master Book.md#trip-3>) _(blocker - S)_
- [ ] **TRIP-4** Explain verified lifecycle side-effects — [criteria](<Trips — Master Book.md#trip-4>) _(friction - M)_
- [ ] **TRIP-29** Acknowledge checkpoint writes truthfully — [criteria](<Trips — Master Book.md#trip-29>) _(friction - M)_
- [ ] **TRIP-31** Cover trip ownership predicates — [criteria](<Trips — Master Book.md#trip-31>) _(friction - M)_
- [ ] **TRIP-32** Verify shared trip documents and money setup — [criteria](<Trips — Master Book.md#trip-32>) _(friction - M)_

**Money**

- [ ] **TRIP-28** Open statement audit scoped to a trip — [criteria](<Trips — Master Book.md#trip-28>) _(friction - M)_

## Later

**Lifecycle follow-ons**

- [ ] **TRIP-39** Re-enable the trip activation cascade (disabled 2026-10-05) — [criteria](<Trips — Master Book.md#trip-39>) _(parked - S)_
- [ ] **TRIP-30** Repair trip lifecycle atomically under an agreed inverse — [criteria](<Trips — Master Book.md#trip-30>) _(friction - M)_
- [ ] **TRIP-6** Choose which cascades fire per trip — [criteria](<Trips — Master Book.md#trip-6>) _(annoyance - M)_
- [ ] **TRIP-7** Show trip cascades in Schedule and Kitchen — [criteria](<Trips — Master Book.md#trip-7>) _(annoyance - M)_

**Features**

- [ ] **TRIP-5** Roll up a trip's cost in a post-trip summary — [criteria](<Trips — Master Book.md#trip-5>) _(annoyance - M)_
- [ ] **TRIP-9** Brief the return day in ERA — [criteria](<Trips — Master Book.md#trip-9>) _(annoyance - M)_
- [ ] **TRIP-10** Select catalogue or stock references for packing — [criteria](<Trips — Master Book.md#trip-10>) _(annoyance - M)_
- [ ] **TRIP-11** Show the trip account's real spend on Overview — [criteria](<Trips — Master Book.md#trip-11>) _(annoyance - M)_
- [ ] **TRIP-33** Attach a saved document snapshot to a trip — [criteria](<Trips — Master Book.md#trip-33>) _(friction - M)_

**Parked**

- [ ] **TRIP-8** Add trip templates with cascade preferences — [criteria](<Trips — Master Book.md#trip-8>) _(parked - M)_
- [ ] **TRIP-36** Clear content hidden under the fixed header on every page — [criteria](<Trips — Master Book.md#trip-36>) _(annoyance - M)_
