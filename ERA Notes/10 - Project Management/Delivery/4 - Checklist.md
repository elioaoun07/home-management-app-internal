---
created: 2026-09-10
updated: 2026-09-26
type: checklist
status: active
owner: Elio
---

# Delivery — Checklist

[Master Book](<Delivery — Master Book.md>) · [All campaigns](<../_index.md>) · [Grammar](<../_Conventions.md>)

One checkbox per outcome. Follow the ID link for acceptance, dependencies, holds and its **Reading guide** (where to start in the code). Lane order is priority, not authorization; owner evidence and policy gates still apply.

**2026-09-26 owner scope decision:** Delivery closes as **accepted for supervised use, laptop + phone** once the KIT-11 A→B trial, Apply/rollback on arm B and one phone pass are recorded in [owner UAT](<../../../docs/Delivery-UAT.md>). **Now** holds only what that evidence closes. Everything in **Later** is an enhancement, reopened only when a real run shows a blocker, a safety problem or real friction. V1 items were cancelled the same day (see `_Archive/Cancelled Log.md`); V1 stays frozen.

## Now

- [ ] **DLV-118** Prepare runnable checks and bounded context for Fast lane — [criteria](<Delivery — Master Book.md#dlv-118>) _(friction - M)_
- [ ] **DLV-109** Show observed activity while an executor is running — [criteria](<Delivery — Master Book.md#dlv-109>) _(friction - M)_
- [ ] **DLV-122** Let the owner cancel a waiting run — [criteria](<Delivery — Master Book.md#dlv-122>) _(friction - M)_

**DLV-118 — 2026-09-20 preparation done, nothing launched.** KIT-11 is prepared as the prepared-vs-staged measurement task: a protected behavioural oracle over the real route (`tests/delivery-oracles/kit11-cooking-count.mjs`, discriminating on a host checkout and inside the pinned worker image), a validated **but uninstalled** execution policy revision 7, one `delivery-plan-v1` body, both arms' Master Book section text generated from it, and verified eligibility — `no-single-prepared-plan` for the staged arm, eligible for the prepared arm once the owner sets `ownerReviewed`. `ownerReviewed` is still `false` on disk. Zero provider jobs, runs, reservations or tokens. Everything remaining is owner-only: install the policy, review the plan, choose the qualified selection and limits, launch. Packet: `.delivery/v2/preparations/kit11/LAUNCH-PACKET.md`.

**DLV-109 / DLV-122 — implemented 2026-09-20, fixture-tested.** Live activity is observed during the KIT-11 runs; the waiting-run Cancel is exercised if either arm waits. Both are swept once seen on a real run.

## Next

## Later

- [ ] **DLV-133** Run the deterministic typecheck inside the protected checker — [criteria](<Delivery — Master Book.md#dlv-133>) _(friction - L)_
- [ ] **DLV-114** Enforce the subscription token ceiling during each native job — [criteria](<Delivery — Master Book.md#dlv-114>) _(friction - M)_
- [ ] **DLV-113** Let an owner revise a checked candidate from recorded findings — [criteria](<Delivery — Master Book.md#dlv-113>) _(friction - M)_
- [ ] **DLV-117** Recommend qualified models and effort for each item — [criteria](<Delivery — Master Book.md#dlv-117>) _(friction - M)_
- [ ] **DLV-111** Refresh subscription sign-ins before unattended remote launches *(refusal + reconnect action fixture-tested 2026-09-20; phone UAT U22 and idle refresh open)* — [criteria](<Delivery — Master Book.md#dlv-111>) _(friction - M)_
- [ ] **DLV-121** Page frozen diffs and older candidate artifacts — [criteria](<Delivery — Master Book.md#dlv-121>) _(friction - M)_
- [ ] **DLV-52** Reduce measured type debt at the validation boundary — [criteria](<Delivery — Master Book.md#dlv-52>) _(friction - L)_
- [ ] **DLV-84** Burn down `react-hooks/exhaustive-deps` (50 across 25 files) — [criteria](<Delivery — Master Book.md#dlv-84>) _(friction - L)_
- [ ] **DLV-103** Retire V1 only after a supported replacement — [criteria](<Delivery — Master Book.md#dlv-103>) _(friction - M)_

**DLV-133 — 2026-09-20 partial.** The checker path, the pinned program and the environment record are implemented and demonstrated with a real compiler; two steps are left and both are the owner's: run `node scripts/delivery-v2/setup-checker-deps.mjs` to stage `typescript` and the type declarations into `era-dlv107-dependencies`, then set `checks.requiredVerifications.typecheck.isolation` to `"checker"` in the execution policy. Until then the policy default (`prefer-checker`) falls back to the labelled host path and records why. The in-container witness is written and **unrun**: `ERA_V2_DOCKER=1 pnpm exec vitest run tests/delivery-v2/typecheck.docker.test.ts`. Blocker: `setup-checker-deps.mjs` would recreate the dependency volume without `esbuild` and stop both oracles running. See the Master Book's dated note.

**DLV-114 — 2026-09-20 partial; parked 2026-09-26 (supervised use runs `advisory`).** In-job stopping is implemented and covered by 25 isolated cases (`npx vitest run tests/delivery-v2/budget-stop.test.ts`). Still owed: the bounded **real stop witness** (UAT U20), a wall-time limit and the `Increase limit` / `Change model` / `Reduce scope` escalation actions. Reopen before any unattended use.
