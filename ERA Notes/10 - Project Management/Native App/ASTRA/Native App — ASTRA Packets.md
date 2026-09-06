---
created: 2026-09-06
updated: 2026-09-06
type: astra-study
status: active
owner: Elio
---

# Native App — ASTRA Packets

> Subordinate to [ERA Top Layer — Master Plan (2026-09-02)](<../../ERA Top Layer — Master Plan (2026-09-02).md>), not a replacement roadmap. Evidence cutoff `3106164`; [Master Book](<../Native App — Master Book.md>) updated 2026-07-30. Study only; no DB calls.

## Phase 5 landing — authoritative on 2026-09-06

This table and the PM fields below complete queue reconciliation at `3106164`. Earlier phase-only editing/validation statements are historical receipts. Implementation gates remain **NOT RUN**. [Coverage and admission](<../../ASTRA — Coverage & Orphans.md>) records the whole allocation; [Contradiction Register](<../../ASTRA — Contradiction Register.md>) preserves unresolved decisions. Existing parent criteria still apply. **HELD means do not dispatch; unallocated means no checkbox exists.** Study acceptance does not approve a policy amendment or another Delivery slot.

| Sheet | Reconciliation | Canonical queue owner | Admission / completion boundary |
|---|---|---|---|
| ASTRA-NAT-1 | DOCKS → N-02; EXTENDS → NAT-3 | NAT-3 | Existing shell acceptance; no additional platform project |

## Plan reconciliation

| Proposal | Mapping | Boundary |
|---|---|---|
| ASTRA-NAT-1 | DOCKS → N-02; EXTENDS → NAT-2/3 acceptance | Acceptance of an existing shell; no second build plan |
| Native queue/push inheritance | DOCKS → E-09 / E-05 / N-03 | Domain guarantees before transport |
| SW guard placement | CONFLICTS → NAT-2 wording versus Non-Interference §2 | Preserve SW; guard registration/bridge outside it |
| Remote-shell certainty | CONFLICTS → Native Master Book architecture rationale | Upstream caveat + device evidence; no unilateral Stage2 pivot |
| Alarm platform ceiling | CONFLICTS → Native platform matrix; NEW held spike | Update factual premise; v1 Time Sensitive/tap-through remains |
| Store/account groundwork | DOCKS → N-00; EXTENDS → NAT-1 | Owner evidence; no external account actions during study |

## Execution contract

These sheets are specifications, **NOT RUN**. Copy this block with an individually dispatched sheet. S ≤ half a session; M ≤ one 2–4h session. Study IDs allocate no campaign integers; Phase 5 landing above records the canonical queue. A partial child never closes an incomplete parent.

**Common gates:** named regressions execute nonzero cases and pass; `pnpm typecheck`, `pnpm lint`, `pnpm pm:lint` exit 0, with output and tested revision attached. The existing PM lint error for the missing DLV-77 migration path is a separately owned Phase-5 prerequisite, not permission to invent SQL. Tests use isolated fixtures and mocked clients; agents make no live DB calls. Owner-run DB/device evidence is separate from mocked tests.

**Forbidden in every sheet:** `src/components/ui/**`; `src/components/hub/HubPage.tsx` (no rider in these campaign sheets); `migrations/schema.sql` without the explicitly paired migration; every path outside the exact allowlist; git writes, production data access, new dependencies, new modules, a second queue/recurrence engine, and changes to existing `/era` layout. New paths are marked **[NEW]**. Relevant PM trace paths named in each sheet are future implementation permissions, not study edits.

| STOP | Condition — stop and leave a five-line evidence/handoff note |
|---|---|
| S1 | A file outside the allowlist needs editing. |
| S2 | A DB write is needed; hand the owner the manual runbook and await APPLIED evidence. |
| S3 | Test count decreases, a required check is red, or a targeted regression executes zero cases. |
| S4 | HubPage grows or a new import of its internals is required. |
| S5 | A new dependency is required. |
| S6 | Work cannot finish in one session; split before proceeding. |
| S7 | A visibility/permission symptom appears; obtain fresh owner DB-state evidence or Hard Rule 27's untruncated queries before route diagnosis. |
| S8 | Money/schedule semantics are ambiguous; ask one focused question rather than guessing. |
| S9 | An AI proposal would write without the required confirmation. |
| S10 | A second engine, queue, parser, regex family, toast system or aggregate for an existing concept is introduced. |
| S11 | Work enters D2's entirely excluded scope. |
| S12 | An existing `/era` element is moved or restyled. |

**NOT done, in every sheet:** migration written ≠ APPLIED; test file ≠ test in CI include; local success ≠ evidence pasted; transport acceptance ≠ observed household outcome; child implementation ≠ parent completion.

## ASTRA-NAT-1 · Qualify the shell on both phones · M · H · N-02 acceptance before N-03

**Outcome:** The owner can accept or reject the remote shell from recorded phone behavior and preserved PWA behavior.

**Prereqs:** NAT-1/N-00 owner groundwork evidence, fixed mobile domain, and N-01/N-02 shell **implementation portion** ready for testing; NAT-3's acceptance is deliberately this sheet, so the parent need not already be closed. Pin tested Capacitor/plugin and OS versions. E-09's endpoint/replay prerequisites must be complete before making an exactly-once claim. Owner resolves the remote-server support caveat and SW-guard wording; existing Non-Interference Contract otherwise stays binding. No migration required by this sheet; underlying exercised feature migrations must have owner-stamped APPLIED evidence.

**Skills:** `start-task → timezone-handling → recurrence-safety → finish-task`. Use the existing wizard protocol only if the owner requests an interleaved device session.

**Files:** `ERA Notes/10 - Project Management/Native App/ASTRA/Native App — Device Witness.md` **[NEW at execution, not part of study delivery]**; `ERA Notes/10 - Project Management/Native App/4 - Checklist.md`; `ERA Notes/10 - Project Management/Native App/Native App — Master Book.md`.

**Boundary:** Acceptance only, no shell/plugin/debug fixes in this allowlist. Record revision, app build, OS, origin, test time, expected result, observed result, PASS/FAIL and linked owner capture for each row. Never include secrets. On failure return the exact evidence to the owning N-01/N-02 sheet; do not grow this packet. Reserve a separate N-03 witness for FCM/APNs delivery.

**DB change?** No. Owner alone performs any fixture action against their app; agents make no production DB call. Prefer isolated test-account/environment fixtures prepared under the owning implementation packet.

**AI call added?** No. A mic permission/capture check needs no model call.

**Money/schedule math?** No new math. Existing replay witness: one approved test draft queued offline → restart → reconnect once and twice → one draft with the same client operation identity. Without E-09's server guarantees, record this row BLOCKED and make no reliability claim; do not substitute a visual count as DB atomicity proof.

**Gate:** Owner screenshot/recording matrix, each row PASS/FAIL (missing evidence = FAIL):
1. Android and iPhone cold online launch, login, relaunch, mic permission/capture, Hub and existing module door.
2. iPhone: bridge plugin responds and SW controls the page in the **same tested configuration**; record app-bound domains and registration scope without credentials.
3. After one successful online visit, force-stop, airplane mode, cold launch; separately record warm offline view and the queued-draft restart/reconnect witness above.
4. Logout/account switch removes prior account's visible persisted state; reconnect cannot replay an old owner's command under the new owner.
5. Valid internal deep link reaches the same target after login; external/malformed URL never becomes a privileged WebView navigation.
6. Existing desktop/browser PWA: login, ordinary draft and module navigation still work; all16 manifest identities/scopes/start URLs match the pre-native inventory; web push device witness stays assigned to N-03.
7. Owner scheduler configuration targets web only; mobile domain/env parity attestation lists names/status, never values.

Attach `pnpm typecheck`, `pnpm lint`, `pnpm pm:lint` exit0 output from the tested implementation revision; its existing relevant tests execute nonzero cases. This document-only sheet adds no mirrored implementation test. If iOS cold start fails, attach the failure and obtain the owner's explicit acceptance of the book's existing online-cold-start fallback; do not silently mark that row PASS. No blanket “all modules work” verdict.

**PM:** Phase 5 embeds this acceptance under NAT-3; no child ID. Shipped sentence: `- ✅ YYYY-MM-DD — **NAT-3** (ASTRA-NAT-1) Remote-shell qualification recorded on both phones; build/OS, PWA and fallback decision evidence: <evidence>.` Tick only after all required rows pass or the owner explicitly accepts the documented fallback. NAT-4/5 and full campaign D1–D3 stay open.

**NOT done:** Shell qualification ≠ native push delivery, store distribution, AlarmKit integration, full offline coverage or permanent session persistence. “Implementation portion ready” is not NAT-3 complete.

**STOP:** S1–S12 above. Additionally, any native fix to SW/manifests violates the inherited contract until owner resolution.

## ASTRA 10× Findings

- **Leverage:** Turn the existing go/no-go spike into a reproducible decision before adding transport.
- **Simplification:** Keep one native build queue; this sheet supplies its missing acceptance precision.
- **Uncomfortable:** A shell that loads the homepage proves almost none of the capabilities for which it is being built.
