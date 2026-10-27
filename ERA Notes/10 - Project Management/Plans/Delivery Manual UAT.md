---
created: 2026-10-25
updated: 2026-10-25
type: plan
status: proposed
owner: Elio
evidence_cutoff: 2026-10-25; HEAD 735d3881 plus current working tree; source and fixture review only
---

# Delivery manual UAT and Steward handover

**25 October owner follow-up:** the requested complete build contract is now [Delivery UAT wizard, sign-off and feedback](<Delivery UAT Sign-off and Feedback.md>). It adds explicit owner sign-off as the Shipped gate and deterministic feedback-to-work import on the next `pnpm pm`. The separate [scenario index](../../../docs/Delivery-UAT-Scenarios-2026-10-25.md) covers existing attempts and completed items awaiting UAT, as confirmed by the owner. This original phased plan remains rationale; neither document claims the new runtime capability is implemented.

## Recommendation

**Do both, at different levels.** Define intended behavior and draft acceptance scenarios before implementation; finalize exact manual steps from the delivered candidate at session completion. Waiting until completion to define expectations lets the implementation become its own acceptance standard. Writing every detailed click for the entire backlog now would create stale instructions.

Use the existing [candidate handover template](../../../docs/Delivery-UAT.md#candidate-handover-template). This is already a process requirement; automatic generation, validation and display remain the gap. Keep implementation complete, automated checks, handover complete, applied/deployed and owner UAT as separate facts.

**Scope:** proposed follow-up owned by Delivery, with PM Tooling owning the view and Drive projection. Build on [R75](<../PM Tooling/PM Tooling — Master Book.md#r75>) and [R74](<../PM Tooling/PM Tooling — Master Book.md#r74>); do not reopen their shipped scope. Allocate bounded follow-up IDs in the existing checklists before implementation. This document is a plan, not another execution queue.

## Phase 1 — Check existing coverage

Inventory existing item acceptance and linked UAT records. Prioritize Now/Next items and recent deliveries awaiting owner acceptance. Record coverage as missing, draft, ready, or not applicable with a reason, within existing item records.

Draft expected behavior and core scenarios for upcoming work. Backfill detailed steps only where a completed candidate/build can be identified and testing remains useful. Keep Later at acceptance level until dispatch; preserve historical results and mark unverifiable legacy instructions explicitly.

**Exit:** prioritized items have clear expectations and visible gaps; no invented test results or blanket historical rewrite.

## Phase 2 — Produce the handover within each session

Extend the existing implementation, repair and revision output to include bounded structured scenarios. Each has prerequisites/test data, exact route and numbered actions with expected results, relevant regression/edge cases, cleanup and untested limits. Bug fixes include the original trigger, former symptom and corrected result; tooling-only work gets suitable manual verification rather than fabricated app clicks.

The supervisor validates acceptance coverage, adds trusted run/candidate/build identity and freezes the handover with existing artifacts. Generate it in the existing job; recover retained output without another AI call. New candidates require a new handover and relevant retesting. Failed/cancelled/partial sessions report actual outcomes and what remains untestable.

**Exit:** a successful delivery exposes either usable candidate-bound instructions or explicit **Handover incomplete**. Missing steps never become an owner task to author them. Automated verification stays truthful; manual results start **Pending**. Only the owner’s recorded observation establishes PASS/FAIL/BLOCKED. An unapplied or undeployed candidate is labelled before testing is offered.

## Phase 3 — Complete the Delivery experience

Keep R75’s **Needs you / In progress / Waiting / In focus / Earlier deliveries** grouping and deduplication. Improve it in this order:

1. Preserve known owner decisions when queue loading fails; show unavailable/stale state. Currently queue errors are omitted and a closed Apply candidate can fall into collapsed history without queue data ([view](../../../scripts/pm/app/DeliveryHome.tsx#L295), [classification](../../../scripts/pm/app/deliveryHomeModel.ts#L118)). Avoid asserting “Nothing running” from unavailable data.
2. Add **Test steps** to the existing [Outcome view](../../../scripts/pm/app/OutcomeReview.tsx#L75), with one compact home action for pending UAT. Expand instructions there; keep badges and buttons short. Reuse existing owner-result recording where available; persist tester/date/build/evidence with the result.
3. Add an attempt date to repeated deliveries and **Load more** beyond the current 50-row history display. Preserve the selected filter when returning from a run.

**Exit:** an owner can find the right attempt, follow its steps and distinguish Verified, Applied and manually Passed on desktop and phone.

## Phase 4 — Give Steward the same evidence through Drive

Extend R74’s existing one-way publisher with the canonical handover, completeness, manual result, candidate/build identity, evidence time and direct run link. Ensure published links resolve within Drive or open Command Center; local repository paths alone are insufficient. Retain handovers beyond the rolling recent-run summary.

Steward reads this evidence, surfaces missing/stale handovers and relays the steps. Recommendations remain in **Steward Proposals** for explicit local reconciliation. Drive copies do not become a second task store, acceptance authority or automatic execution channel.

**Exit:** Command Center and the published handover agree by identity/version; stale or unavailable publication is visible, never inferred as completion.

## Phase 5 — Verify one complete example

Use offline fixtures for missing/malformed/oversized handovers, omitted criteria, changed candidates, tampering, interrupted completion, queue failure and desktop/phone/Drive parity. Verify no additional provider dispatch. Then follow one available delivered item’s manual steps, recording actual build/device and results; any live integration or owner-only step stays Pending until performed. Check desktop and 390px layouts, including active, waiting and unavailable states.

**Exit:** one traceable path from acceptance → delivered candidate → manual instructions → recorded owner result, with the same evidence visible to Steward.

## Review evidence and retirement

Source review confirms the missing output contract in [implementationInstruction](../../../scripts/delivery-v2/interaction.mjs#L363); the existing [UAT runtime-gap note](../../../docs/Delivery-UAT.md#candidate-handover-template) already describes artifact reuse. R74’s [publisher](../../../scripts/pm/drive-publish.mjs#L157) exports status without manual scenarios. The existing Delivery home fixtures passed **8/8**. Browser startup failed during sandbox initialization, so this review adds no visual, physical-phone or live Drive acceptance claim.

After adoption, put acceptance and status under the allocated campaign IDs. Archive this plan once those records and the UAT/runbook carry its surviving requirements.
