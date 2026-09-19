---
created: 2026-09-10
updated: 2026-09-15
type: checklist
status: active
owner: Elio
---

# Delivery — Checklist

[Master Book](<Delivery — Master Book.md>) · [All campaigns](<../_index.md>) · [Grammar](<../_Conventions.md>)

One checkbox per outcome. Follow the ID link for acceptance, dependencies and holds. Lane order is priority, not authorization; owner evidence and policy gates still apply.

The owner-requested [first-run hotfix](<../Plans/Delivery First-Run Hotfix.md>) is the first lane. V1 remains frozen to the bounded real-product trial and its prerequisites; planning does not authorize native dispatch.

## Now

- [ ] **DLV-121** Page frozen diffs and older candidate artifacts — [criteria](<Delivery — Master Book.md#dlv-121>) _(friction - M)_

- [ ] **DLV-120** Retain protected-check logs with precise failure details — [criteria](<Delivery — Master Book.md#dlv-120>) _(friction - M)_

Review workspace implemented locally on 2026-09-15; [owner UAT and real lane examples](<../../../docs/Delivery-UAT.md>) now guide acceptance. Completed implementation appears in Work > Done; manual acceptance stays in UAT. Only remaining engineering is listed below.


## Next

- [ ] **DLV-114** Enforce the subscription token ceiling during each native job — [criteria](<Delivery — Master Book.md#dlv-114>) _(blocker - M)_
- [ ] **DLV-113** Let an owner revise a checked candidate from recorded findings — [criteria](<Delivery — Master Book.md#dlv-113>) _(friction - M)_
- [ ] **DLV-117** Recommend qualified models and effort for each item — [criteria](<Delivery — Master Book.md#dlv-117>) _(friction - M)_
- [ ] **DLV-118** Prepare runnable checks and bounded context for Fast lane — [criteria](<Delivery — Master Book.md#dlv-118>) _(friction - M)_

- [ ] **DLV-111** Refresh subscription sign-ins before unattended remote launches — [criteria](<Delivery — Master Book.md#dlv-111>) _(friction - M)_
- [ ] **DLV-108** Recover completed jobs into plans and results after restart — [criteria](<Delivery — Master Book.md#dlv-108>) _(blocker - M)_
- [ ] **DLV-109** Show observed activity while an executor is running — [criteria](<Delivery — Master Book.md#dlv-109>) _(friction - M)_
- [ ] **DLV-86** Correct forecast units from clean receipt provenance — [criteria](<Delivery — Master Book.md#dlv-86>) _(blocker - M)_
- [ ] **DLV-87** Reject launches with unknown or unpriced cost — [criteria](<Delivery — Master Book.md#dlv-87>) _(blocker - S)_
- [ ] **DLV-88** Separate API cost, estimates and subscription usage — [criteria](<Delivery — Master Book.md#dlv-88>) _(blocker - M)_
- [ ] **DLV-89** Resolve V1 approval interaction costs — [criteria](<Delivery — Master Book.md#dlv-89>) _(friction - M)_
- [ ] **DLV-90** Reject zero-test validation as NOT_TESTED — [criteria](<Delivery — Master Book.md#dlv-90>) _(friction - S)_
- [ ] **DLV-91** Release abandoned session locks safely — [criteria](<Delivery — Master Book.md#dlv-91>) _(friction - M)_
- [ ] **DLV-79** Calibrate INSTANT after three clean completions — [criteria](<Delivery — Master Book.md#dlv-79>) _(annoyance - S)_
- [ ] **DLV-68** Repair abandoned attempt observability — [criteria](<Delivery — Master Book.md#dlv-68>) _(friction - M)_
- [ ] **DLV-69** Preserve the latest request context through continuation — [criteria](<Delivery — Master Book.md#dlv-69>) _(friction - M)_
- [ ] **DLV-70** (rest of DLV-40) Surface the raw-SDK transcript pointer in the desktop session detail — [criteria](<Delivery — Master Book.md#dlv-70>) _(annoyance - S)_

## Later

- [ ] **DLV-52** Reduce measured type debt at the validation boundary — [criteria](<Delivery — Master Book.md#dlv-52>) _(friction - L)_
- [ ] **DLV-84** Burn down `react-hooks/exhaustive-deps` (50 across 25 files) — [criteria](<Delivery — Master Book.md#dlv-84>) _(friction - L)_
- [ ] **DLV-103** Retire V1 only after a supported replacement — [criteria](<Delivery — Master Book.md#dlv-103>) _(friction - M)_
