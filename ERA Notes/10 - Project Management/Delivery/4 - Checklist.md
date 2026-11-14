---
created: 2026-09-10
updated: 2026-11-11
type: checklist
status: active
owner: Elio
---

# Delivery — Checklist

[Master Book](<Delivery — Master Book.md>) · [All campaigns](<../_index.md>) · [Grammar](<../_Conventions.md>)

**Now** is this week's sprint. **Next** is the ordered queue. **Later** is parked or conditional. Each ID links to its acceptance. Finish one with `pnpm pm:ship <ID>`.

## Now

## Next

**Local lane**

- [ ] **DLV-156** Drive a local delivery through one supervisor command contract — [criteria](<Delivery — Master Book.md#dlv-156>) _(friction - M)_

**Confined V2, awaiting a real run**

- [ ] **DLV-118** Prepare runnable checks and bounded context for Fast lane — [criteria](<Delivery — Master Book.md#dlv-118>) _(friction - M)_
- [ ] **DLV-109** Show observed activity while an executor is running — [criteria](<Delivery — Master Book.md#dlv-109>) _(friction - M)_
- [ ] **DLV-122** Let the owner cancel a waiting run — [criteria](<Delivery — Master Book.md#dlv-122>) _(friction - M)_
- [ ] **DLV-137** HELD — DLV-133 — Prepare Delivery runs with one readiness result — [criteria](<Delivery — Master Book.md#dlv-137>) _(friction - L)_

## Later

**Confined V2 enhancements**

- [ ] **DLV-133** Run the deterministic typecheck inside the protected checker — [criteria](<Delivery — Master Book.md#dlv-133>) _(friction - L)_
- [ ] **DLV-114** Enforce the subscription token ceiling during each native job — [criteria](<Delivery — Master Book.md#dlv-114>) _(friction - M)_
- [ ] **DLV-113** Let an owner revise a checked candidate from recorded findings — [criteria](<Delivery — Master Book.md#dlv-113>) _(friction - M)_
- [ ] **DLV-117** Recommend qualified models and effort for each item — [criteria](<Delivery — Master Book.md#dlv-117>) _(friction - M)_
- [ ] **DLV-111** Refresh subscription sign-ins before unattended remote launches — [criteria](<Delivery — Master Book.md#dlv-111>) _(friction - M)_
- [ ] **DLV-121** Page frozen diffs and older candidate artifacts — [criteria](<Delivery — Master Book.md#dlv-121>) _(friction - M)_
- [ ] **DLV-146** Have the delivering worker emit the structured UAT handover and the supervisor capture it — [criteria](<Delivery — Master Book.md#dlv-146>) _(friction - L)_

**Environment and retirement**

- [ ] **DLV-154** Give agents and UAT a disposable development database — [criteria](<Delivery — Master Book.md#dlv-154>) _(friction - L)_
- [ ] **DLV-155** Retire the confined stack after five local deliveries — [criteria](<Delivery — Master Book.md#dlv-155>) _(parked - L)_
- [ ] **DLV-103** Retire V1 only after a supported replacement — [criteria](<Delivery — Master Book.md#dlv-103>) _(friction - M)_

**Code health**

- [ ] **DLV-52** Reduce measured type debt at the validation boundary — [criteria](<Delivery — Master Book.md#dlv-52>) _(friction - L)_
- [ ] **DLV-84** Burn down the exhaustive-deps lint findings — [criteria](<Delivery — Master Book.md#dlv-84>) _(friction - L)_
